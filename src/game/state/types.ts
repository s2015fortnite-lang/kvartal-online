export type PlayerId = string;
export type PropertyId = number;
export type DeckId = 'CHANCE' | 'CHEST';
export type Token = '◆' | '●' | '▲' | '✦';
export type Level = 0 | 1 | 2 | 3 | 4 | 5;
export type Dice = [number, number];
export type SpaceType = 'GO' | 'PROPERTY' | 'RAILROAD' | 'UTILITY' | 'CHANCE' | 'CHEST' | 'TAX' | 'JAIL' | 'PARKING' | 'GO_TO_JAIL';
export interface Space {
  id: number; name: string; type: SpaceType; group?: string; color?: string;
  price?: number; mortgage?: number; buildingPrice?: number;
  rent?: readonly number[]; tax?: number;
}
export interface Board { id: string; version: number; spaces: Space[]; go: number; jail: number }
export interface Player { id: PlayerId; name: string; color: string; token: Token; money: number; position: number; jailed: boolean; jailAttempts: number; bankrupt: boolean }
export interface Property { owner: PlayerId | null; mortgaged: boolean; level: Level }
export interface HeldCard { id: string; deck: DeckId; owner: PlayerId }
export interface RandomState { seed: number; draws: number }
export type CardEffect =
  | { type: 'MONEY'; amount: number }
  | { type: 'MOVE_TO'; position: number }
  | { type: 'BACK'; steps: number }
  | { type: 'NEAREST'; kind: 'RAILROAD' | 'UTILITY' }
  | { type: 'JAIL' }
  | { type: 'REPAIR'; house: number; hotel: number }
  | { type: 'EACH'; amount: number }
  | { type: 'KEEP' };
export interface Card { id: string; deck: DeckId; title: string; text: string; effect: CardEffect }
export type RentModifier = 'NORMAL' | 'DOUBLE_RAILROAD' | 'UTILITY_TEN';
export interface Debt { debtor: PlayerId; creditor: PlayerId | 'BANK'; amount: number; reason: string }
export type Effect =
  | { type: 'PAY'; debt: Debt }
  | { type: 'MOVE'; player: PlayerId; steps: number; salary: boolean; modifier: RentModifier }
  | { type: 'LAND'; player: PlayerId; modifier: RentModifier }
  | { type: 'RELEASE'; player: PlayerId }
  | { type: 'AUCTION'; property: PropertyId }
  | { type: 'MORTGAGE_TRANSFER'; player: PlayerId; property: PropertyId };
export interface Assets { money: number; properties: PropertyId[]; cards: string[] }
export type MortgageChoice = 'KEEP' | 'REDEEM';
export interface Trade { proposer: PlayerId; recipient: PlayerId; offer: Assets; request: Assets; proposerChoices: Record<number, MortgageChoice> }
export type AuctionLot = { kind: 'PROPERTY'; property: PropertyId } | { kind: 'HOUSE' | 'HOTEL'; targets: Record<PlayerId, PropertyId> };
export interface Auction { lot: AuctionLot; participants: PlayerId[]; actor: PlayerId; leader: PlayerId | null; bid: number }
export interface BuildRequest { player: PlayerId; property: PropertyId }
export type Phase =
  | { kind: 'ORDER'; actor: PlayerId }
  | { kind: 'ROLL' }
  | { kind: 'JAIL' }
  | { kind: 'RESOLVE' }
  | { kind: 'BUY'; player: PlayerId; property: PropertyId }
  | { kind: 'CARD'; player: PlayerId; card: string }
  | { kind: 'AUCTION'; auction: Auction }
  | { kind: 'DEBT'; debt: Debt }
  | { kind: 'MORTGAGE_TRANSFER'; player: PlayerId; property: PropertyId }
  | { kind: 'BUILD_REQUESTS'; actor: PlayerId; pending: PlayerId[]; requests: BuildRequest[]; building: 'HOUSE' | 'HOTEL' }
  | { kind: 'MANAGE' }
  | { kind: 'TRADE'; trade: Trade }
  | { kind: 'FINISHED' };
export interface OrderState { blocks: PlayerId[][]; pending: PlayerId[]; scores: Record<PlayerId, number>; round: number }
export type EventType = 'GAME_CREATED' | 'ORDER_ROLLED' | 'ORDER_TIE' | 'GAME_STARTED' | 'TURN_STARTED' | 'TURN_ENDED' | 'DICE_ROLLED' | 'PLAYER_MOVED' | 'PASSED_GO' | 'PROPERTY_BOUGHT' | 'AUCTION_STARTED' | 'BID_PLACED' | 'AUCTION_LEFT' | 'AUCTION_FINISHED' | 'MONEY_TRANSFERRED' | 'DEBT_CREATED' | 'DEBT_SETTLED' | 'CARD_DRAWN' | 'CARD_APPLIED' | 'PLAYER_JAILED' | 'PLAYER_RELEASED' | 'JAIL_FAILED' | 'BUILDING_BUILT' | 'BUILDING_SOLD' | 'PROPERTY_MORTGAGED' | 'PROPERTY_REDEEMED' | 'TRADE_CREATED' | 'TRADE_ACCEPTED' | 'TRADE_DECLINED' | 'PLAYER_BANKRUPT' | 'GAME_FINISHED' | 'DEV_CHANGED';
export interface GameEvent { id: number; type: EventType; turn: number; text: string; player?: PlayerId; path?: number[]; dice?: Dice }
export interface GameState {
  schemaVersion: 1; gameId: string; revision: number; rulesId: string; rulesVersion: number;
  board: Board; cards: Record<string, Card>; players: Player[]; properties: Record<number, Property>;
  bank: { houses: number; hotels: number }; order: PlayerId[]; orderState: OrderState | null;
  currentPlayerId: PlayerId; turn: number; doubles: number; extraRoll: boolean;
  phase: Phase; suspended: Phase[]; effects: Effect[]; dice: Dice | null;
  decks: Record<DeckId, string[]>; heldCards: HeldCard[]; random: RandomState;
  winner: PlayerId | null; history: GameEvent[]; nextEvent: number;
}
export interface PlayerSetup { name: string; color: string; token: Token }
export type Command =
  | { type: 'ROLL_ORDER' | 'ROLL' | 'BUY' | 'DECLINE' | 'ACK_CARD' | 'LEAVE_AUCTION' | 'END_TURN' | 'JAIL_ROLL' | 'PAY_FINE' | 'SETTLE_DEBT' | 'BANKRUPT' | 'DECLINE_TRADE' | 'CANCEL_TRADE' | 'PASS_BUILD' }
  | { type: 'BID'; amount: number }
  | { type: 'BUILD' | 'SELL' | 'MORTGAGE' | 'REDEEM' | 'REQUEST_BUILD'; property: PropertyId }
  | { type: 'SELL_GROUP'; group: string }
  | { type: 'USE_CARD'; card: string }
  | { type: 'MORTGAGE_CHOICE'; choice: MortgageChoice }
  | { type: 'CREATE_TRADE'; recipient: PlayerId; offer: Assets; request: Assets; proposerChoices: Record<number, MortgageChoice> }
  | { type: 'ACCEPT_TRADE'; choices: Record<number, MortgageChoice> };
export interface Envelope { actor: PlayerId; expectedRevision: number; command: Command }
export interface AvailableAction { command: Command; label: string }
export type Result = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: string };
