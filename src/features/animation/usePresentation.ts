import type { PublicGameState } from '../../online/protocol';
import { useEffect, useState } from 'react';
import type { Dice, GameEvent } from '../../game/state/types';

export const DICE_DURATION = 1000;
export const DICE_SETTLE = 250;
export const STEP_DURATION = 320;
export type PresentationStage = 'idle' | 'rolling' | 'walking';

export function usePresentation(state: PublicGameState | null, events: GameEvent[]) {
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [dice, setDice] = useState<Dice | null>(null);
  const [stage, setStage] = useState<PresentationStage>('idle');

  useEffect(() => {
    if (!state) {
      setPositions({});
      setDice(null);
      setStage('idle');
      return;
    }
    const final = Object.fromEntries(state.players.map((p) => [p.id, p.position]));
    const visual = events.filter((e) => e.dice || (e.player && e.path?.length));
    const lastDice = visual.filter((e) => e.dice).at(-1)?.dice ?? state.dice;
    if (!visual.length || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPositions(final);
      setDice(lastDice);
      setStage('idle');
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (time: number, callback: () => void) => timers.push(setTimeout(callback, time));
    let time = 0;
    setStage(visual[0].dice ? 'rolling' : 'walking');
    for (const event of visual) {
      if (event.dice) {
        at(time, () => setStage('rolling'));
        // Cosmetic faces only. The real dice result has already come from the engine.
        for (let frame = 0; frame < DICE_DURATION / 80; frame++) {
          at(time + frame * 80, () => setDice([1 + (frame % 6), 1 + ((frame * 5 + 2) % 6)]));
        }
        at(time + DICE_DURATION, () => {
          setDice(event.dice!);
          setStage('walking');
        });
        time += DICE_DURATION + DICE_SETTLE;
      }
      if (event.player && event.path?.length) {
        at(time, () => setStage('walking'));
        for (const position of event.path) {
          at(time, () => setPositions((p) => ({ ...p, [event.player!]: position })));
          time += STEP_DURATION;
        }
      }
    }
    at(time, () => {
      setPositions(final);
      setDice(lastDice);
      setStage('idle');
    });
    return () => timers.forEach(clearTimeout);
  }, [state, events]);

  return { positions, dice, stage, busy: stage !== 'idle' };
}
