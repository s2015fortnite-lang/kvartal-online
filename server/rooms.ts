import { createHash, randomBytes } from 'node:crypto';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { GameEngine } from '../src/game/engine/GameEngine';
import { createGame } from '../src/game/engine/create-game';
import type { GameEvent, GameState, PlayerSetup } from '../src/game/state/types';
import { deserialize, serialize } from '../src/persistence/SaveManager';
import {
  clientMessage,
  publicState,
  type RoomView,
  type ServerMessage,
} from '../src/online/protocol';

export interface Peer {
  send(message: ServerMessage): void;
  close(): void;
}
interface Seat {
  id: string;
  setup: PlayerSetup;
  tokenHash: string;
  receipts: { id: string; error?: string }[];
}
interface Room {
  code: string;
  host: string;
  updated: number;
  seats: Seat[];
  state: GameState | null;
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const colors = ['#bc5945', '#477f9c', '#65905c', '#9a65a8'];
const tokens: PlayerSetup['token'][] = ['◆', '●', '▲', '✦'];
const diskSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{10}$/),
  host: z.string(),
  updated: z.number(),
  seats: z
    .array(
      z.object({
        id: z.string(),
        setup: z.object({
          name: z.string().min(1).max(24),
          color: z.string(),
          token: z.enum(['◆', '●', '▲', '✦']),
        }),
        tokenHash: z.string().length(64),
        receipts: z.array(z.object({ id: z.string(), error: z.string().optional() })).max(64),
      }),
    )
    .min(1)
    .max(4),
  state: z.string().nullable(),
});

export class Rooms {
  readonly rooms = new Map<string, Room>();
  private members = new Map<Peer, { code: string; player: string }>();
  private engine = new GameEngine();
  constructor(private directory?: string) {
    if (!directory) return;
    mkdirSync(directory, { recursive: true });
    for (const file of readdirSync(directory).filter((f) => /^[A-Z0-9]{10}\.json$/.test(f))) {
      const value = diskSchema.parse(JSON.parse(readFileSync(join(directory, file), 'utf8')));
      this.rooms.set(value.code, {
        ...value,
        state: value.state ? deserialize(value.state) : null,
      });
    }
    this.sweep();
  }
  private persist(room: Room) {
    if (!this.directory) return;
    const target = join(this.directory, `${room.code}.json`);
    writeFileSync(
      `${target}.tmp`,
      JSON.stringify({ ...room, state: room.state ? serialize(room.state) : null }),
      { mode: 0o600, flush: true },
    );
    renameSync(`${target}.tmp`, target);
  }
  private put(room: Room) {
    this.persist(room);
    this.rooms.set(room.code, room);
  }
  private seat(index: number, name: string) {
    const token = randomBytes(32).toString('hex');
    return {
      token,
      seat: {
        id: `p${index + 1}`,
        setup: { name, color: colors[index], token: tokens[index] },
        tokenHash: hash(token),
        receipts: [],
      } as Seat,
    };
  }
  private attach(peer: Peer, room: Room, seat: Seat, token?: string) {
    // A reconnect replaces the previous tab; two tabs cannot control the same seat.
    for (const [old, member] of this.members) {
      if (member.code === room.code && member.player === seat.id && old !== peer) {
        this.members.delete(old);
        old.send({ type: 'ERROR', error: 'Игра открыта в другой вкладке.', fatal: true });
        old.close();
      }
    }
    this.members.set(peer, { code: room.code, player: seat.id });
    peer.send({ type: 'WELCOME', code: room.code, playerId: seat.id, token });
    this.broadcast(room);
  }
  private view(room: Room): RoomView {
    return {
      code: room.code,
      host: room.host,
      started: !!room.state,
      seats: room.seats.map((s) => ({
        ...s.setup,
        id: s.id,
        connected: [...this.members.values()].some(
          (m) => m.code === room.code && m.player === s.id,
        ),
      })),
    };
  }
  private snapshot(peer: Peer, room: Room, player: string, events: GameEvent[] = []) {
    peer.send({
      type: 'SNAPSHOT',
      room: this.view(room),
      state: room.state ? publicState(room.state) : null,
      events,
      actions: room.state ? this.engine.getAvailableActions(room.state, player) : [],
      canTrade: room.state ? this.engine.canTrade(room.state, player) : false,
    });
  }
  private broadcast(room: Room, events: GameEvent[] = []) {
    for (const [peer, member] of this.members)
      if (member.code === room.code) this.snapshot(peer, room, member.player, events);
  }
  disconnect(peer: Peer) {
    const member = this.members.get(peer);
    this.members.delete(peer);
    const room = member && this.rooms.get(member.code);
    if (room) this.broadcast(room);
  }
  receive(peer: Peer, raw: unknown) {
    const parsed = clientMessage.safeParse(raw);
    if (!parsed.success) {
      peer.send({ type: 'ERROR', error: 'Некорректное сообщение.' });
      return;
    }
    const message = parsed.data;
    try {
      const member = this.members.get(peer);
      if (message.type === 'CREATE' || message.type === 'JOIN' || message.type === 'RESUME') {
        if (member) throw new Error('Вы уже подключены к комнате.');
        if (message.type === 'CREATE') {
          this.sweep();
          if (this.rooms.size >= 100) throw new Error('Сервер заполнен. Попробуйте позже.');
          let code: string;
          do {
            code = randomBytes(5).toString('hex').toUpperCase();
          } while (this.rooms.has(code));
          const { seat, token } = this.seat(0, message.name);
          const room: Room = {
            code,
            host: seat.id,
            seats: [seat],
            state: null,
            updated: Date.now(),
          };
          this.put(room);
          this.attach(peer, room, seat, token);
          return;
        }
        const room = this.rooms.get(message.code);
        if (!room) throw new Error('Комната не найдена или срок её хранения истёк.');
        if (message.type === 'RESUME') {
          const seat = room.seats.find((s) => s.tokenHash === hash(message.token));
          if (!seat)
            throw new Error('Не удалось восстановить место. Откройте игру в прежнем браузере.');
          this.attach(peer, room, seat);
          return;
        }
        if (room.state)
          throw new Error('Партия уже началась. Новые игроки не могут присоединиться.');
        if (room.seats.length >= 4) throw new Error('В комнате уже четыре игрока.');
        const { seat, token } = this.seat(room.seats.length, message.name);
        const next = { ...room, seats: [...room.seats, seat], updated: Date.now() };
        this.put(next);
        this.attach(peer, next, seat, token);
        return;
      }
      if (!member) throw new Error('Сначала войдите в комнату.');
      const room = this.rooms.get(member.code)!;
      const seat = room.seats.find((s) => s.id === member.player)!;
      const receipt = seat.receipts.find((r) => r.id === message.id);
      if (receipt) {
        this.snapshot(peer, room, seat.id);
        peer.send({ type: 'ACK', ...receipt });
        return;
      }
      let nextState = room.state;
      let events: GameEvent[] = [];
      let error: string | undefined;
      if (message.type === 'START') {
        if (room.host !== seat.id) error = 'Начать игру может создатель комнаты.';
        else if (room.state) error = 'Игра уже началась.';
        else if (room.seats.length < 2 || this.view(room).seats.some((s) => !s.connected))
          error = 'Нужны от двух до четырёх подключённых игроков.';
        else
          nextState = createGame(
            room.seats.map((s) => s.setup),
            randomBytes(4).readUInt32LE(),
            room.code,
          );
      } else if (!room.state) error = 'Игра ещё не началась.';
      else {
        const result = this.engine.execute(room.state, {
          actor: seat.id,
          expectedRevision: message.revision,
          command: message.command,
        });
        if (result.ok) {
          nextState = result.state;
          events = result.events;
        } else error = result.error;
      }
      const next: Room = {
        ...room,
        state: nextState,
        updated: Date.now(),
        seats: room.seats.map((s) =>
          s.id !== seat.id
            ? s
            : { ...s, receipts: [...s.receipts, { id: message.id, error }].slice(-64) },
        ),
      };
      this.put(next);
      if (!error) this.broadcast(next, events);
      else this.snapshot(peer, next, seat.id);
      peer.send({ type: 'ACK', id: message.id, error });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Ошибка сервера.';
      // Do not expose disk paths or operating-system errors to clients.
      const safe = /^(E[A-Z]+:|Invalid)/.test(text)
        ? 'Не удалось сохранить партию на сервере. Повторите позже.'
        : text;
      if ('id' in message) peer.send({ type: 'ACK', id: message.id, error: safe });
      else peer.send({ type: 'ERROR', error: safe, fatal: true });
    }
  }
  sweep(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      if (
        now - room.updated < 7 * 86400000 ||
        [...this.members.values()].some((m) => m.code === code)
      )
        continue;
      if (this.directory) unlinkSync(join(this.directory, `${code}.json`));
      this.rooms.delete(code);
    }
  }
}
