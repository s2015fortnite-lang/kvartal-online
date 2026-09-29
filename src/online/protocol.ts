import { z } from 'zod';
import { commandSchema } from '../game/commands/schema';
import type { AvailableAction, GameEvent, GameState, PlayerSetup } from '../game/state/types';

// Only these fields may leave the server. Random state and deck order stay private.
export type PublicGameState = Omit<
  GameState,
  'random' | 'decks' | 'effects' | 'suspended' | 'nextEvent'
>;
export interface RoomView {
  code: string;
  host: string;
  seats: (PlayerSetup & { id: string; connected: boolean })[];
  started: boolean;
}
const id = z.string().min(1).max(100);
const code = z.string().regex(/^[A-Z0-9]{10}$/);
export const clientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CREATE'), name: z.string().trim().min(1).max(24) }).strict(),
  z.object({ type: z.literal('JOIN'), code, name: z.string().trim().min(1).max(24) }).strict(),
  z.object({ type: z.literal('RESUME'), code, token: z.string().length(64) }).strict(),
  z.object({ type: z.literal('START'), id }).strict(),
  z
    .object({
      type: z.literal('COMMAND'),
      id,
      revision: z.number().int().nonnegative(),
      command: commandSchema,
    })
    .strict(),
]);
export type ClientMessage = z.infer<typeof clientMessage>;
export type ServerMessage =
  | { type: 'WELCOME'; code: string; playerId: string; token?: string }
  | {
      type: 'SNAPSHOT';
      room: RoomView;
      state: PublicGameState | null;
      events: GameEvent[];
      actions: AvailableAction[];
      canTrade: boolean;
    }
  | { type: 'ACK'; id: string; error?: string }
  | { type: 'ERROR'; error: string; fatal?: boolean };

export function publicState(state: GameState): PublicGameState {
  const {
    random: _random,
    decks: _decks,
    effects: _effects,
    suspended: _suspended,
    nextEvent: _nextEvent,
    ...view
  } = state;
  return view;
}
