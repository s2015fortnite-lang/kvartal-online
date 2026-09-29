import type { PublicGameState } from '../../online/protocol';
import type { PlayerId, PropertyId } from './types';
export const player = (s: PublicGameState, id: PlayerId) => {
  const p = s.players.find((p) => p.id === id);
  if (!p) throw new Error('Игрок не найден.');
  return p;
};
export const space = (s: PublicGameState, id: PropertyId) => {
  const tile = s.board.spaces.find((t) => t.id === id);
  if (!tile) throw new Error('Клетка не найдена.');
  return tile;
};
export const owned = (s: PublicGameState, id: PlayerId) =>
  s.board.spaces.filter((t) => s.properties[t.id]?.owner === id);
export const group = (s: PublicGameState, id: PropertyId) => {
  const g = space(s, id).group;
  return g ? s.board.spaces.filter((t) => t.group === g) : [space(s, id)];
};
export const monopoly = (s: PublicGameState, id: PropertyId, owner: PlayerId) =>
  !!space(s, id).group && group(s, id).every((t) => s.properties[t.id].owner === owner);
export const active = (s: PublicGameState) => s.players.filter((p) => !p.bankrupt);
export function actingPlayer(s: PublicGameState): PlayerId {
  const f = s.phase;
  if (f.kind === 'ORDER' || f.kind === 'BUILD_REQUESTS') return f.actor;
  if (f.kind === 'AUCTION') return f.auction.actor;
  if (f.kind === 'DEBT') return f.debt.debtor;
  if (f.kind === 'BUY' || f.kind === 'CARD' || f.kind === 'MORTGAGE_TRANSFER') return f.player;
  if (f.kind === 'TRADE') return f.trade.recipient;
  return s.currentPlayerId;
}
