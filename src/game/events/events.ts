import type { EventType, GameEvent, GameState } from '../state/types';
export function emit(s: GameState, type: EventType, text: string, details: Pick<GameEvent, 'player' | 'path' | 'dice'> = {}) {
  s.history.push({ id: s.nextEvent++, type, text, turn: s.turn, ...details });
}
