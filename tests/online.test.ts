// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Rooms, type Peer } from '../server/rooms';
import type { ServerMessage } from '../src/online/protocol';
import { ready, give } from './helpers';

class Client implements Peer {
  messages: ServerMessage[] = [];
  closed = false;
  send(message: ServerMessage) {
    this.messages.push(structuredClone(message));
  }
  close() {
    this.closed = true;
  }
  last<T extends ServerMessage['type']>(type: T) {
    return this.messages
      .slice()
      .reverse()
      .find((m) => m.type === type) as Extract<ServerMessage, { type: T }>;
  }
}
function room(directory?: string) {
  const service = new Rooms(directory),
    a = new Client(),
    b = new Client();
  service.receive(a, { type: 'CREATE', name: 'Аня' });
  const code = a.last('WELCOME').code;
  service.receive(b, { type: 'JOIN', code, name: 'Борис' });
  return { service, a, b, code };
}
function start(service: Rooms, a: Client) {
  service.receive(a, { type: 'START', id: 'start' });
}
function command(
  service: Rooms,
  client: Client,
  cmd: unknown,
  id = 'move',
  revision = client.last('SNAPSHOT').state!.revision,
) {
  service.receive(client, { type: 'COMMAND', id, revision, command: cmd });
}
const directories: string[] = [];
afterEach(() => {
  for (const d of directories.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('authoritative online rooms', () => {
  it('assigns distinct seats, synchronizes a move, keeps RNG/decks and tokens private', () => {
    const { service, a, b } = room();
    start(service, a);
    command(service, a, { type: 'ROLL_ORDER' });
    expect(a.last('ACK').error).toBeUndefined();
    expect(a.last('SNAPSHOT').state).toEqual(b.last('SNAPSHOT').state);
    expect(b.last('SNAPSHOT').state!.revision).toBe(1);
    expect(b.last('SNAPSHOT').events.some((e) => e.dice)).toBe(true);
    for (const field of ['random', 'decks', 'effects', 'suspended', 'nextEvent'])
      expect(b.last('SNAPSHOT').state).not.toHaveProperty(field);
    expect(JSON.stringify(b.last('SNAPSHOT'))).not.toContain(a.last('WELCOME').token!);
    expect(b.last('WELCOME').playerId).toBe('p2');
  });
  it('rejects чужой ход and actor spoofing without changing state', () => {
    const { service, a, b } = room();
    start(service, a);
    command(service, b, { type: 'ROLL_ORDER' });
    expect(b.last('ACK').error).toBeTruthy();
    expect(b.last('SNAPSHOT').state!.revision).toBe(0);
    service.receive(b, {
      type: 'COMMAND',
      actor: 'p1',
      id: 'spoof',
      revision: 0,
      command: { type: 'ROLL_ORDER' },
    });
    expect(b.last('ERROR').error).toBeTruthy();
    expect(a.last('SNAPSHOT').state!.revision).toBe(0);
  });
  it('deduplicates accepted commands and rejects stale revisions', () => {
    const { service, a, b } = room();
    start(service, a);
    command(service, a, { type: 'ROLL_ORDER' }, 'one', 0);
    const state = a.last('SNAPSHOT').state;
    command(service, a, { type: 'ROLL_ORDER' }, 'one', 0);
    expect(a.last('SNAPSHOT').state).toEqual(state);
    expect(a.last('ACK').error).toBeUndefined();
    command(service, b, { type: 'ROLL_ORDER' }, 'two', 0);
    expect(b.last('ACK').error).toBeTruthy();
    expect(b.last('SNAPSHOT').state!.revision).toBe(1);
  });
  it('only lets the host start, requires connected players and caps seats at four', () => {
    const { service, a, b, code } = room();
    start(service, b);
    expect(b.last('ACK').error).toBeTruthy();
    service.disconnect(b);
    start(service, a);
    expect(a.last('ACK').error).toBeTruthy();
    service.receive(b, { type: 'RESUME', code, token: b.last('WELCOME').token });
    for (let i = 0; i < 2; i++)
      service.receive(new Client(), { type: 'JOIN', code, name: `Гость${i}` });
    const extra = new Client();
    service.receive(extra, { type: 'JOIN', code, name: 'Пятый' });
    expect(extra.last('ERROR').error).toContain('четыре');
    service.receive(a, { type: 'START', id: 'retry' });
    expect(a.last('SNAPSHOT').state!.players).toHaveLength(4);
  });
  it('resumes same seat and invalidates old socket; rejects bad tokens and new joins after start', () => {
    const { service, a, b, code } = room();
    start(service, a);
    const newA = new Client();
    service.receive(newA, { type: 'RESUME', code, token: a.last('WELCOME').token });
    expect(newA.last('WELCOME').playerId).toBe('p1');
    expect(a.closed).toBe(true);
    command(service, a, { type: 'ROLL_ORDER' });
    expect(a.last('ACK').error).toBeTruthy();
    command(service, newA, { type: 'ROLL_ORDER' });
    expect(newA.last('ACK').error).toBeUndefined();
    const bad = new Client();
    service.receive(bad, { type: 'RESUME', code, token: '0'.repeat(64) });
    expect(bad.last('ERROR').fatal).toBe(true);
    service.receive(bad, { type: 'JOIN', code, name: 'Новый' });
    expect(bad.last('ERROR').error).toContain('началась');
    expect(b.last('SNAPSHOT').room.seats.every((s) => s.connected)).toBe(true);
  });
  it('persists game and command receipts across restart without storing raw reconnect tokens', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kvartal-online-'));
    directories.push(directory);
    const { service, a, code } = room(directory);
    start(service, a);
    command(service, a, { type: 'ROLL_ORDER' }, 'one', 0);
    const token = a.last('WELCOME').token!;
    expect(readFileSync(join(directory, `${code}.json`), 'utf8')).not.toContain(token);
    const restarted = new Rooms(directory),
      returned = new Client();
    restarted.receive(returned, { type: 'RESUME', code, token });
    expect(returned.last('SNAPSHOT').state).toEqual(a.last('SNAPSHOT').state);
    expect(returned.last('SNAPSHOT').room.seats[1].connected).toBe(false);
    command(restarted, returned, { type: 'ROLL_ORDER' }, 'one', 0);
    expect(returned.last('SNAPSHOT').state!.revision).toBe(1);
    expect(returned.last('ACK').error).toBeUndefined();
  });
  it('enforces ownership for property management and trade acceptance', () => {
    const { service, a, b, code } = room();
    const state = ready();
    give(state, 'p1', 1, 3);
    service.rooms.get(code)!.state = state;
    service.receive(a, { type: 'START', id: 'sync' });
    service.receive(b, { type: 'START', id: 'sync' });
    command(service, b, { type: 'MORTGAGE', property: 1 }, 'bad');
    expect(b.last('ACK').error).toBeTruthy();
    command(service, a, { type: 'BUILD', property: 1 }, 'build');
    expect(a.last('ACK').error).toBeUndefined();
    command(service, a, { type: 'SELL', property: 1 }, 'sell');
    command(
      service,
      a,
      {
        type: 'CREATE_TRADE',
        recipient: 'p2',
        offer: { money: 0, properties: [1], cards: [] },
        request: { money: 100, properties: [], cards: [] },
        proposerChoices: {},
      },
      'offer',
    );
    expect(a.last('ACK').error).toBeUndefined();
    command(service, a, { type: 'ACCEPT_TRADE', choices: {} }, 'bad-accept');
    expect(a.last('ACK').error).toBeTruthy();
    command(service, b, { type: 'ACCEPT_TRADE', choices: {} }, 'accept');
    expect(b.last('ACK').error).toBeUndefined();
    expect(b.last('SNAPSHOT').state!.properties[1].owner).toBe('p2');
  });
  it('expires only disconnected rooms after seven days', () => {
    const { service, a, b, code } = room();
    service.sweep(Date.now() + 8 * 86400000);
    expect(service.rooms.has(code)).toBe(true);
    service.disconnect(a);
    service.disconnect(b);
    service.sweep(Date.now() + 8 * 86400000);
    expect(service.rooms.has(code)).toBe(false);
  });
});
