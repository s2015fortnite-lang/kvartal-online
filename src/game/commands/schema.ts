import { z } from 'zod';
const money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const property=z.number().int().nonnegative();
const assets=z.object({money,properties:z.array(property),cards:z.array(z.string())});
const choices=z.record(z.enum(['KEEP','REDEEM']));
export const commandSchema=z.union([
  z.object({type:z.enum(['ROLL_ORDER','ROLL','BUY','DECLINE','ACK_CARD','LEAVE_AUCTION','END_TURN','JAIL_ROLL','PAY_FINE','SETTLE_DEBT','BANKRUPT','DECLINE_TRADE','CANCEL_TRADE','PASS_BUILD'])}),
  z.object({type:z.literal('BID'),amount:money}),
  z.object({type:z.enum(['BUILD','SELL','MORTGAGE','REDEEM','REQUEST_BUILD']),property}),
  z.object({type:z.literal('SELL_GROUP'),group:z.string()}),
  z.object({type:z.literal('USE_CARD'),card:z.string()}),
  z.object({type:z.literal('MORTGAGE_CHOICE'),choice:z.enum(['KEEP','REDEEM'])}),
  z.object({type:z.literal('CREATE_TRADE'),recipient:z.string(),offer:assets,request:assets,proposerChoices:choices}),
  z.object({type:z.literal('ACCEPT_TRADE'),choices}),
]);
