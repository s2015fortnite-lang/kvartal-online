import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  usePresentation,
  DICE_DURATION,
  DICE_SETTLE,
  STEP_DURATION,
} from '../src/features/animation/usePresentation';
import { ready } from './helpers';
import type { GameEvent } from '../src/game/state/types';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('keeps the token still while faces cycle, reveals final dice, then walks one cell at a time', () => {
  const start = ready();
  const hook = renderHook(({ state, events }) => usePresentation(state, events), {
    initialProps: { state: start, events: [] as GameEvent[] },
  });
  const final = structuredClone(start);
  final.players[0].position = 3;
  final.dice = [1, 2];
  const events: GameEvent[] = [
    { id: 1, type: 'DICE_ROLLED', turn: 1, text: 'roll', player: 'p1', dice: [1, 2] },
    { id: 2, type: 'PLAYER_MOVED', turn: 1, text: 'move', player: 'p1', path: [1, 2, 3] },
  ];
  hook.rerender({ state: final, events });
  act(() => vi.advanceTimersByTime(80));
  const faces = hook.result.current.dice;
  expect(hook.result.current.positions.p1).toBe(0);
  expect(hook.result.current.stage).toBe('rolling');
  act(() => vi.advanceTimersByTime(80));
  expect(hook.result.current.dice).not.toEqual(faces);
  act(() => vi.advanceTimersByTime(DICE_DURATION - 160));
  expect(hook.result.current.dice).toEqual([1, 2]);
  expect(hook.result.current.positions.p1).toBe(0);
  act(() => vi.advanceTimersByTime(DICE_SETTLE));
  expect(hook.result.current.positions.p1).toBe(1);
  act(() => vi.advanceTimersByTime(STEP_DURATION));
  expect(hook.result.current.positions.p1).toBe(2);
  act(() => vi.advanceTimersByTime(STEP_DURATION * 2));
  expect(hook.result.current.positions.p1).toBe(3);
  expect(hook.result.current.busy).toBe(false);
});

it('animates a turn-order roll even when there is no movement', () => {
  const state = ready();
  state.dice = [6, 5];
  const events: GameEvent[] = [
    { id: 1, type: 'ORDER_ROLLED', turn: 0, text: 'order', player: 'p1', dice: [6, 5] },
  ];
  const { result } = renderHook(() => usePresentation(state, events));
  expect(result.current.busy).toBe(true);
  act(() => vi.advanceTimersByTime(DICE_DURATION + DICE_SETTLE));
  expect(result.current.dice).toEqual([6, 5]);
  expect(result.current.busy).toBe(false);
});

it('honors reduced motion and cancels timers on unmount', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const state = ready();
  state.players[0].position = 3;
  state.dice = [1, 2];
  const events: GameEvent[] = [
    { id: 1, type: 'PLAYER_MOVED', turn: 1, text: 'move', player: 'p1', path: [1, 2, 3] },
  ];
  const hook = renderHook(() => usePresentation(state, events));
  expect(hook.result.current.positions.p1).toBe(3);
  expect(hook.result.current.busy).toBe(false);
  hook.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
