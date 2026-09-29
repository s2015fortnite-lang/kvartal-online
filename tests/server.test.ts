// @vitest-environment node
import { afterEach, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { createGameServer } from '../server/index';
import type { ServerMessage } from '../src/online/protocol';
const servers: ReturnType<typeof createGameServer>[] = [];
afterEach(async () => {
  for (const app of servers.splice(0)) {
    for (const ws of app.wss.clients) ws.terminate();
    await new Promise<void>((r) => app.server.close(() => r()));
  }
});
async function start() {
  const app = createGameServer();
  servers.push(app);
  await new Promise<void>((r) => app.server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  return { app, origin, url: origin.replace('http:', 'ws:') + '/ws' };
}
function next(ws: WebSocket, type: ServerMessage['type']) {
  return new Promise<ServerMessage>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', receive);
      reject(new Error(`No ${type}`));
    }, 3000);
    const receive = (data: Buffer) => {
      const m = JSON.parse(data.toString()) as ServerMessage;
      if (m.type === type) {
        clearTimeout(timer);
        ws.off('message', receive);
        resolve(m);
      }
    };
    ws.on('message', receive);
  });
}
it('serves health, forbids source files and rejects cross-origin WebSocket connections', async () => {
  const { origin, url } = await start();
  expect((await fetch(origin + '/health')).status).toBe(200);
  expect((await fetch(origin + '/server/rooms.ts')).status).toBe(404);
  const ws = new WebSocket(url, { origin: 'https://unrelated.example' });
  await expect(
    new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    }),
  ).rejects.toThrow('403');
});
it('exchanges room snapshots over real WebSockets and rejects malformed messages', async () => {
  const { origin, url } = await start();
  const a = new WebSocket(url, { origin });
  await new Promise((r) => a.on('open', r));
  const welcome = next(a, 'WELCOME');
  a.send(JSON.stringify({ type: 'CREATE', name: 'Аня' }));
  const response = await welcome;
  expect(response.type).toBe('WELCOME');
  if (response.type !== 'WELCOME') return;
  const b = new WebSocket(url, { origin });
  await new Promise((r) => b.on('open', r));
  const lobby = next(a, 'SNAPSHOT');
  b.send(JSON.stringify({ type: 'JOIN', code: response.code, name: 'Борис' }));
  const snapshot = await lobby;
  expect(snapshot.type === 'SNAPSHOT' && snapshot.room.seats.length).toBe(2);
  const error = next(b, 'ERROR');
  b.send('{not json');
  expect((await error).type).toBe('ERROR');
  const state = next(b, 'SNAPSHOT');
  a.send(JSON.stringify({ type: 'START', id: 'start' }));
  const game = await state;
  expect(game.type === 'SNAPSHOT' && game.state?.phase.kind).toBe('ORDER');
});
