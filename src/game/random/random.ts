import type { Dice, RandomState } from '../state/types';
export interface RandomProvider { next(state: RandomState): number }
// State is changed only on the engine's private working copy.
export const seededRandom: RandomProvider = { next(state) {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.draws++;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
} };
export function roll(state: RandomState, random: RandomProvider): Dice { return [1 + Math.floor(random.next(state) * 6), 1 + Math.floor(random.next(state) * 6)]; }
export function shuffle<T>(items: T[], state: RandomState, random: RandomProvider): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random.next(state) * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
