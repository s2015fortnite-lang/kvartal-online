import type { ClientMessage, ServerMessage } from './protocol';

export class Connection {
  private socket?: WebSocket;
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private handshakeTimer?: ReturnType<typeof setTimeout>;
  private attempt = 0;
  private resume?: Extract<ClientMessage, { type: 'RESUME' }>;
  constructor(
    private initial: ClientMessage,
    private message: (message: ServerMessage) => void,
    private status: (status: 'connecting' | 'connected' | 'disconnected') => void,
  ) {
    if (initial.type === 'RESUME') this.resume = initial;
  }
  connect = () => {
    if (this.stopped) return;
    this.status('connecting');
    const ws = new WebSocket(
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`,
    );
    this.socket = ws;
    this.handshakeTimer = setTimeout(() => ws.close(), 12000);
    ws.onopen = () => ws.send(JSON.stringify(this.resume ?? this.initial));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === 'WELCOME') {
        clearTimeout(this.handshakeTimer);
        this.attempt = 0;
        if (message.token)
          this.resume = { type: 'RESUME', code: message.code, token: message.token };
        this.status('connected');
      }
      if (message.type === 'ERROR' && message.fatal) {
        this.stopped = true;
        ws.close();
      }
      this.message(message);
    };
    ws.onclose = () => {
      clearTimeout(this.handshakeTimer);
      this.status('disconnected');
      if (this.stopped) return;
      if (this.resume)
        this.timer = setTimeout(this.connect, Math.min(1000 * 2 ** this.attempt++, 10000));
      else
        this.message({
          type: 'ERROR',
          fatal: true,
          error: 'Не удалось подключиться. Проверьте интернет и работу сервера.',
        });
    };
    ws.onerror = () => ws.close();
  };
  send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }
  reconnect() {
    this.socket?.close();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.handshakeTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.onerror = null;
      this.socket.close();
    }
  }
}
