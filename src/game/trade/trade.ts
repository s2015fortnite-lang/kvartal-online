import type { Assets, GameState, MortgageChoice, PlayerId, Trade } from '../state/types';
import type { RuleSet } from '../rules/RuleSet';
import { group, player } from '../state/selectors';
import { amount, requireRule } from '../engine/assert';
import { emit } from '../events/events';
export function canTrade(s:GameState,actor:PlayerId):boolean {
  if(player(s,actor).bankrupt)return false;
  return ['ROLL','JAIL','MANAGE','BUY'].includes(s.phase.kind)||(s.phase.kind==='DEBT'&&s.phase.debt.debtor===actor);
}
function validateAssets(s:GameState,owner:PlayerId,a:Assets) {
  amount(a.money);requireRule(new Set(a.properties).size===a.properties.length&&new Set(a.cards).size===a.cards.length,'Активы не должны повторяться.');
  for(const id of a.properties){requireRule(s.properties[id]?.owner===owner,'Объект не принадлежит участнику обмена.');requireRule(group(s,id).every(t=>s.properties[t.id].level===0),'Сначала продайте здания всей группы.');}
  for(const id of a.cards)requireRule(s.heldCards.some(c=>c.id===id&&c.owner===owner),'Карта не принадлежит участнику обмена.');
}
function fee(s:GameState,assets:Assets,choices:Record<number,MortgageChoice>,rules:RuleSet) {
  return assets.properties.reduce((sum,id)=>sum+(s.properties[id].mortgaged?(choices[id]==='REDEEM'?rules.redemption(s,id):rules.transferFee(s,id)):0),0);
}
export function propose(s:GameState,trade:Trade) {
  requireRule(canTrade(s,trade.proposer),'Обмен сейчас недоступен.');
  requireRule(trade.proposer!==trade.recipient&&!player(s,trade.recipient).bankrupt,'Выберите другого активного игрока.');
  validateAssets(s,trade.proposer,trade.offer);validateAssets(s,trade.recipient,trade.request);
  requireRule(trade.offer.money+trade.request.money+trade.offer.properties.length+trade.request.properties.length+trade.offer.cards.length+trade.request.cards.length>0,'Добавьте деньги, объект или карту.');
  s.suspended.push(s.phase);s.phase={kind:'TRADE',trade};emit(s,'TRADE_CREATED',`${player(s,trade.proposer).name} предлагает обмен ${player(s,trade.recipient).name}.`);
}
export function accept(s:GameState,actor:PlayerId,choices:Record<number,MortgageChoice>,rules:RuleSet) {
  requireRule(s.phase.kind==='TRADE','Нет предложения обмена.');const t=s.phase.trade;
  requireRule(actor===t.recipient,'Принять может только получатель.');
  validateAssets(s,t.proposer,t.offer);validateAssets(s,t.recipient,t.request);
  const a=player(s,t.proposer),b=player(s,t.recipient),fa=fee(s,t.request,t.proposerChoices,rules),fb=fee(s,t.offer,choices,rules);
  const ma=a.money-t.offer.money+t.request.money-fa,mb=b.money-t.request.money+t.offer.money-fb;
  amount(ma);amount(mb);
  const returnPhase=s.suspended[s.suspended.length-1];
  const before=returnPhase?.kind==='DEBT'?rules.liquidation(s,returnPhase.debt.debtor):0;
  a.money=ma;b.money=mb;
  function move(assets:Assets,to:PlayerId,choice:Record<number,MortgageChoice>){for(const id of assets.properties){s.properties[id].owner=to;if(choice[id]==='REDEEM')s.properties[id].mortgaged=false;}for(const id of assets.cards)s.heldCards.find(c=>c.id===id)!.owner=to;}
  move(t.offer,t.recipient,choices);move(t.request,t.proposer,t.proposerChoices);
  if(returnPhase?.kind==='DEBT')requireRule(rules.liquidation(s,returnPhase.debt.debtor)>=Math.min(before,returnPhase.debt.amount),'Обмен ухудшает возможность погасить текущий долг.');
  s.phase=s.suspended.pop()!;emit(s,'TRADE_ACCEPTED',`${a.name} и ${b.name} заключили обмен. Банковские проценты: $${fa+fb}.`);
}
