import type { PublicGameState } from '../../online/protocol';
import type { PlayerId, PropertyId, RentModifier } from '../state/types';
export interface RuleSet {
  id: string;
  version: number;
  startingMoney: number;
  salary: number;
  jailFine: number;
  jailAttempts: number;
  maxDoubles: number;
  houses: number;
  hotels: number;
  mortgageRate: number;
  minimumBid: number;
  rent(s: PublicGameState, property: PropertyId, dice: number, modifier: RentModifier): number;
  buildError(s: PublicGameState, actor: PlayerId, property: PropertyId): string | null;
  redemption(s: PublicGameState, property: PropertyId): number;
  transferFee(s: PublicGameState, property: PropertyId): number;
  liquidation(s: PublicGameState, actor: PlayerId): number;
}
