import { GameEngine } from '../game/engine/GameEngine';
import { createGame } from '../game/engine/create-game';
import type {
  AvailableAction,
  Command,
  GameEvent,
  GameState,
  PlayerSetup,
} from '../game/state/types';
import { actingPlayer } from '../game/state/selectors';
import { SaveManager } from '../persistence/SaveManager';
import { Connection } from '../online/Connection';
import type { ClientMessage, PublicGameState, RoomView, ServerMessage } from '../online/protocol';

export interface OnlineState {
  room: RoomView | null;
  playerId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  pending: boolean;
  actions: AvailableAction[];
  canTrade: boolean;
}
export interface Snapshot {
  state: PublicGameState | null;
  events: GameEvent[];
  error: string | null;
  notice: string | null;
  online: OnlineState | null;
}
export interface GameTransport {
  send(state: GameState, actor: string, command: Command): ReturnType<GameEngine['execute']>;
}
export class LocalGameTransport implements GameTransport {
  constructor(readonly engine = new GameEngine()) {}
  send(state: GameState, actor: string, command: Command) {
    return this.engine.execute(state, { actor, expectedRevision: state.revision, command });
  }
}
export class GameController {
  private snapshot: Snapshot = { state: null, events: [], error: null, notice: null, online: null };
  private localState: GameState | null = null;
  private listeners = new Set<() => void>();
  private connection?: Connection;
  private pending?: {
    message: ClientMessage;
    resolve: (ok: boolean) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  private retryAfterResume = false;
  readonly transport: LocalGameTransport;
  readonly saves: SaveManager;
  constructor(
    private storage: Storage,
    transport = new LocalGameTransport(),
  ) {
    this.saves = new SaveManager(storage);
    this.transport = transport;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: Snapshot) {
    this.snapshot = next;
    this.listeners.forEach((f) => f());
  }
  private online(patch: Partial<OnlineState>) {
    if (this.snapshot.online)
      this.publish({ ...this.snapshot, online: { ...this.snapshot.online, ...patch } });
  }
  owns(actor: string) {
    return !this.snapshot.online || this.snapshot.online.playerId === actor;
  }
  availableActions(actor: string) {
    const online = this.snapshot.online;
    if (online)
      return this.owns(actor) && online.status === 'connected' && !online.pending
        ? online.actions
        : [];
    return this.localState ? this.transport.engine.getAvailableActions(this.localState, actor) : [];
  }
  canTrade(actor: string) {
    const online = this.snapshot.online;
    return online
      ? this.owns(actor) && online.status === 'connected' && !online.pending && online.canTrade
      : !!this.localState && this.transport.engine.canTrade(this.localState, actor);
  }
  token(code: string) {
    try {
      return this.storage.getItem(`estate-online.${code}`);
    } catch {
      return null;
    }
  }
  lastRoom() {
    try {
      return this.storage.getItem('estate-online.last');
    } catch {
      return null;
    }
  }
  connectOnline(name: string, code?: string) {
    this.menu();
    const token = code && this.token(code);
    const initial: ClientMessage = token
      ? { type: 'RESUME', code: code!, token }
      : code
        ? { type: 'JOIN', name, code }
        : { type: 'CREATE', name };
    this.publish({
      ...this.snapshot,
      online: {
        room: null,
        playerId: '',
        status: 'connecting',
        pending: false,
        actions: [],
        canTrade: false,
      },
    });
    this.connection = new Connection(initial, this.receive, (status) => this.online({ status }));
    this.connection.connect();
  }
  private receive = (message: ServerMessage) => {
    if (message.type === 'WELCOME') {
      try {
        if (message.token) this.storage.setItem(`estate-online.${message.code}`, message.token);
        this.storage.setItem('estate-online.last', message.code);
      } catch {
        this.publish({
          ...this.snapshot,
          notice:
            'Браузер не сохраняет данные. Не закрывайте вкладку: место не удастся восстановить.',
        });
      }
      history.replaceState(null, '', `/game/${message.code}`);
      this.retryAfterResume = true;
      this.online({ playerId: message.playerId });
    } else if (message.type === 'SNAPSHOT') {
      const same =
        message.state?.gameId === this.snapshot.state?.gameId &&
        message.state?.revision === this.snapshot.state?.revision;
      this.publish({
        ...this.snapshot,
        state: same ? this.snapshot.state : message.state,
        events: same ? this.snapshot.events : message.events,
        online: {
          ...this.snapshot.online!,
          room: message.room,
          actions: message.actions,
          canTrade: message.canTrade,
        },
      });
      // Retry only on reconnect, with the original id; never replay an accepted move.
      if (this.retryAfterResume && this.pending) this.connection?.send(this.pending.message);
      this.retryAfterResume = false;
    } else if (message.type === 'ACK') {
      if (this.pending && 'id' in this.pending.message && message.id === this.pending.message.id) {
        const pending = this.pending;
        this.pending = undefined;
        clearTimeout(pending.timer);
        this.online({ pending: false });
        if (message.error) this.error(message.error);
        pending.resolve(!message.error);
      }
    } else {
      this.error(message.error);
      if (message.fatal) this.finishPending();
    }
  };
  private finishPending() {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.resolve(false);
      this.pending = undefined;
    }
    this.online({ pending: false });
  }
  private sendOnline(message: ClientMessage): Promise<boolean> {
    if (this.pending || this.snapshot.online?.status !== 'connected') {
      this.error('Дождитесь подключения к серверу и завершения действия.');
      return Promise.resolve(false);
    }
    this.publish({ ...this.snapshot, error: null });
    this.online({ pending: true });
    return new Promise((resolve) => {
      this.pending = {
        message,
        resolve,
        timer: setTimeout(() => this.connection?.reconnect(), 8000),
      };
      if (!this.connection?.send(message)) {
        this.finishPending();
        this.error('Нет подключения к серверу.');
      }
    });
  }
  startOnline() {
    return this.sendOnline({ type: 'START', id: crypto.randomUUID() });
  }
  start(setup: PlayerSetup[]) {
    this.menu();
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      this.commit(createGame(setup, seed, crypto.randomUUID()), []);
    } catch (e) {
      this.error(e);
    }
  }
  dispatch(command: Command, actor?: string): boolean | Promise<boolean> {
    const s = this.snapshot.state;
    if (!s) return false;
    if (this.snapshot.online) {
      if (actor && !this.owns(actor)) {
        this.error('Можно управлять только своим игроком.');
        return false;
      }
      return this.sendOnline({
        type: 'COMMAND',
        id: crypto.randomUUID(),
        revision: s.revision,
        command,
      });
    }
    if (!this.localState) return false;
    const result = this.transport.send(this.localState, actor ?? actingPlayer(s), command);
    if (!result.ok) {
      this.error(result.error);
      return false;
    }
    this.commit(result.state, result.events);
    return true;
  }
  private commit(state: GameState, events: GameEvent[]) {
    this.localState = state;
    let notice: string | null = null;
    try {
      if (state.winner) this.saves.clear();
      else this.saves.save(state);
    } catch {
      notice =
        'Не удалось сохранить в браузере. Партия работает, но обновление страницы может потерять прогресс.';
    }
    this.publish({ state, events, error: null, notice, online: null });
  }
  save() {
    if (!this.localState || this.snapshot.online) return;
    try {
      this.saves.save(this.localState);
      this.publish({ ...this.snapshot, error: null, notice: 'Партия сохранена в этом браузере.' });
    } catch (e) {
      this.error(e);
    }
  }
  load() {
    this.menu();
    try {
      const state = this.saves.load();
      this.localState = state;
      this.publish({
        state,
        events: [],
        error: null,
        notice: 'Партия восстановлена.',
        online: null,
      });
    } catch (e) {
      this.error(e);
    }
  }
  menu() {
    this.connection?.stop();
    this.connection = undefined;
    this.finishPending();
    this.localState = null;
    this.publish({ state: null, events: [], error: null, notice: null, online: null });
  }
  clearMessage() {
    this.publish({ ...this.snapshot, error: null, notice: null });
  }
  private error(e: unknown) {
    this.publish({ ...this.snapshot, error: e instanceof Error ? e.message : String(e) });
  }
  async dev(action: import('../game/dev/dev').DevAction) {
    if (!import.meta.env.DEV || this.snapshot.online) return;
    try {
      if (!this.localState) return;
      const { executeDev } = await import('../game/dev/dev');
      this.commit(executeDev(this.localState, action), []);
    } catch (e) {
      this.error(e);
    }
  }
}
