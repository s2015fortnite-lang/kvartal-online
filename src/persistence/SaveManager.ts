import { z } from 'zod';
import type { GameState, Phase } from '../game/state/types';
import { classicRules } from '../game/rules/ClassicRuleSet';
import { assertInvariants } from '../game/state/invariants';
const integer=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),id=z.string().min(1).max(120);
const dice=z.tuple([z.number().int().min(1).max(6),z.number().int().min(1).max(6)]);
const debt=z.object({debtor:id,creditor:id,amount:integer,reason:z.string()});
const assets=z.object({money:integer,properties:z.array(integer),cards:z.array(id)});
const choices=z.record(z.enum(['KEEP','REDEEM']));
const lot=z.union([z.object({kind:z.literal('PROPERTY'),property:integer}),z.object({kind:z.enum(['HOUSE','HOTEL']),targets:z.record(integer)})]);
const phase:z.ZodType<Phase>=z.union([
  z.object({kind:z.enum(['ROLL','JAIL','RESOLVE','MANAGE','FINISHED'])}),
  z.object({kind:z.literal('ORDER'),actor:id}),
  z.object({kind:z.literal('BUY'),player:id,property:integer}),
  z.object({kind:z.literal('CARD'),player:id,card:id}),
  z.object({kind:z.literal('DEBT'),debt}),
  z.object({kind:z.literal('MORTGAGE_TRANSFER'),player:id,property:integer}),
  z.object({kind:z.literal('AUCTION'),auction:z.object({lot,participants:z.array(id),actor:id,leader:id.nullable(),bid:integer})}),
  z.object({kind:z.literal('BUILD_REQUESTS'),actor:id,pending:z.array(id),requests:z.array(z.object({player:id,property:integer})),building:z.enum(['HOUSE','HOTEL'])}),
  z.object({kind:z.literal('TRADE'),trade:z.object({proposer:id,recipient:id,offer:assets,request:assets,proposerChoices:choices})}),
]);
const modifier=z.enum(['NORMAL','DOUBLE_RAILROAD','UTILITY_TEN']);
const effect=z.union([
  z.object({type:z.literal('PAY'),debt}),
  z.object({type:z.literal('MOVE'),player:id,steps:z.number().int().min(-100).max(100),salary:z.boolean(),modifier}),
  z.object({type:z.literal('LAND'),player:id,modifier}),
  z.object({type:z.literal('RELEASE'),player:id}),
  z.object({type:z.literal('AUCTION'),property:integer}),
  z.object({type:z.literal('MORTGAGE_TRANSFER'),player:id,property:integer}),
]);
const cardEffect=z.union([
  z.object({type:z.literal('MONEY'),amount:z.number().int()}),z.object({type:z.literal('MOVE_TO'),position:integer}),
  z.object({type:z.literal('BACK'),steps:integer}),z.object({type:z.literal('NEAREST'),kind:z.enum(['RAILROAD','UTILITY'])}),
  z.object({type:z.enum(['JAIL','KEEP'])}),z.object({type:z.literal('REPAIR'),house:integer,hotel:integer}),z.object({type:z.literal('EACH'),amount:z.number().int()}),
]);
const eventTypes=['GAME_CREATED','ORDER_ROLLED','ORDER_TIE','GAME_STARTED','TURN_STARTED','TURN_ENDED','DICE_ROLLED','PLAYER_MOVED','PASSED_GO','PROPERTY_BOUGHT','AUCTION_STARTED','BID_PLACED','AUCTION_LEFT','AUCTION_FINISHED','MONEY_TRANSFERRED','DEBT_CREATED','DEBT_SETTLED','CARD_DRAWN','CARD_APPLIED','PLAYER_JAILED','PLAYER_RELEASED','JAIL_FAILED','BUILDING_BUILT','BUILDING_SOLD','PROPERTY_MORTGAGED','PROPERTY_REDEEMED','TRADE_CREATED','TRADE_ACCEPTED','TRADE_DECLINED','PLAYER_BANKRUPT','GAME_FINISHED','DEV_CHANGED'] as const;
const stateSchema:z.ZodType<GameState>=z.object({
  schemaVersion:z.literal(1),gameId:id,revision:integer,rulesId:z.literal('classic'),rulesVersion:z.literal(1),
  board:z.object({id,version:integer,go:integer,jail:integer,spaces:z.array(z.object({id:integer,name:z.string(),type:z.enum(['GO','PROPERTY','RAILROAD','UTILITY','CHANCE','CHEST','TAX','JAIL','PARKING','GO_TO_JAIL']),group:z.string().optional(),color:z.string().optional(),price:integer.optional(),mortgage:integer.optional(),buildingPrice:integer.optional(),rent:z.array(integer).optional(),tax:integer.optional()})).length(40)}),
  cards:z.record(z.object({id,deck:z.enum(['CHANCE','CHEST']),title:z.string(),text:z.string(),effect:cardEffect})),
  players:z.array(z.object({id,name:z.string().min(1).max(24),color:z.string().regex(/^#[0-9a-f]{6}$/i),token:z.enum(['◆','●','▲','✦']),money:integer,position:integer,jailed:z.boolean(),jailAttempts:integer,bankrupt:z.boolean()})).min(2).max(4),
  properties:z.record(z.object({owner:id.nullable(),mortgaged:z.boolean(),level:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)])})),
  bank:z.object({houses:integer,hotels:integer}),order:z.array(id),orderState:z.object({blocks:z.array(z.array(id)),pending:z.array(id),scores:z.record(integer),round:integer}).nullable(),
  currentPlayerId:id,turn:integer,doubles:integer,extraRoll:z.boolean(),phase,suspended:z.array(phase),effects:z.array(effect),dice:dice.nullable(),
  decks:z.object({CHANCE:z.array(id),CHEST:z.array(id)}),heldCards:z.array(z.object({id,deck:z.enum(['CHANCE','CHEST']),owner:id})),random:z.object({seed:integer.max(4294967295),draws:integer}),
  winner:id.nullable(),history:z.array(z.object({id:integer,type:z.enum(eventTypes),turn:integer,text:z.string(),player:id.optional(),path:z.array(integer).optional(),dice:dice.optional()})),nextEvent:integer,
});
const envelope=z.object({saveVersion:z.literal(1),savedAt:z.string(),gameState:stateSchema});
export const SAVE_KEY='estate-local.current.v1';
export function serialize(s:GameState):string {assertInvariants(s,classicRules);return JSON.stringify({saveVersion:1,savedAt:new Date().toISOString(),gameState:s});}
export function deserialize(value:string):GameState {
  const parsed=envelope.safeParse(JSON.parse(value));if(!parsed.success)throw new Error('Сохранение повреждено или имеет несовместимую версию.');
  assertInvariants(parsed.data.gameState,classicRules);return parsed.data.gameState;
}
export class SaveManager {
  constructor(private storage:Storage){}
  exists(){return this.storage.getItem(SAVE_KEY)!==null;}
  save(s:GameState){this.storage.setItem(SAVE_KEY,serialize(s));}
  load(){const raw=this.storage.getItem(SAVE_KEY);if(!raw)throw new Error('Сохранённой партии пока нет.');return deserialize(raw);}
  clear(){this.storage.removeItem(SAVE_KEY);}
}
