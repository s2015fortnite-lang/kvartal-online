import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { Rooms, type Peer } from './rooms';

export function createGameServer(
  options: { dataDir?: string; staticDir?: string; origin?: string } = {},
) {
  const rooms = new Rooms(options.dataDir);
  const root = resolve(options.staticDir ?? 'dist');
  const mime: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
    );
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      const file =
        path === '/' || /^\/game\/[A-Z0-9]{10}\/?$/.test(path)
          ? resolve(root, 'index.html')
          : resolve(root, `.${path}`);
      if (!file.startsWith(root + sep) || path.includes('\\')) throw new Error('path');
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': file.endsWith('.html') ? 'no-store' : 'public, max-age=3600',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    perMessageDeflate: false,
  });
  server.on('upgrade', (req, socket, head) => {
    let validOrigin = false;
    try {
      validOrigin =
        !!req.headers.origin &&
        (options.origin
          ? req.headers.origin === options.origin
          : new URL(req.headers.origin).host === req.headers.host);
    } catch {
      /* Invalid origin. */
    }
    if (req.url !== '/ws' || !validOrigin || wss.clients.size >= 256) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });
  const alive = new WeakSet<WebSocket>();
  wss.on('connection', (ws) => {
    alive.add(ws);
    const peer: Peer = {
      send: (m) => {
        if (ws.readyState === WebSocket.OPEN) {
          if (ws.bufferedAmount > 1024 * 1024) ws.terminate();
          else ws.send(JSON.stringify(m));
        }
      },
      close: () => ws.close(),
    };
    let windowStart = Date.now(),
      count = 0;
    ws.on('pong', () => alive.add(ws));
    ws.on('error', () => ws.terminate());
    ws.on('close', () => rooms.disconnect(peer));
    ws.on('message', (data, binary) => {
      if (Date.now() - windowStart > 10000) {
        windowStart = Date.now();
        count = 0;
      }
      if (++count > 30 || binary) {
        ws.close(1008, 'Rate limit');
        return;
      }
      try {
        rooms.receive(peer, JSON.parse(data.toString()));
      } catch {
        peer.send({ type: 'ERROR', error: 'Сообщение не удалось прочитать.' });
      }
    });
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) ws.terminate();
      else {
        alive.delete(ws);
        ws.ping();
      }
    }
    rooms.sweep();
  }, 30000);
  server.on('close', () => {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
  return { server, rooms, wss };
}
if (require.main === module) {
  const { server } = createGameServer({
    dataDir: process.env.DATA_DIR ?? 'data',
    origin: process.env.PUBLIC_ORIGIN,
  });
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, '0.0.0.0', () => console.log(`Квартал: http://localhost:${port}`));
}
