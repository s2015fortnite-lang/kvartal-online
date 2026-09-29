import type { AuctionLot, GameState, Phase, PlayerId } from '../state/types';
import { active, player, space } from '../state/selectors';
import { emit } from '../events/events';
import { amount, requireRule } from '../engine/assert';
import { transfer } from '../economy/payments';
import type { RuleSet } from '../rules/RuleSet';
import { placeBuilding } from '../economy/buildings';
export function startAuction(s:GameState,lot:AuctionLot,returnPhase:Phase={kind:'RESOLVE'}) {
  const participants=s.order.filter(id=>!player(s,id).bankrupt&&(lot.kind==='PROPERTY'||id in lot.targets));
  requireRule(participants.length>0,'Нет участников аукциона.');
  s.suspended.push(returnPhase);
  s.phase={kind:'AUCTION',auction:{lot,participants,actor:participants[0],leader:null,bid:0}};
  emit(s,'AUCTION_STARTED',lot.kind==='PROPERTY'?`Аукцион: ${space(s,lot.property).name}.`:'Аукцион последнего здания.');
}
export function auctionAction(s:GameState,actor:PlayerId,value:number|null,rules:RuleSet) {
  requireRule(s.phase.kind==='AUCTION','Аукцион не открыт.');const a=s.phase.auction;
  requireRule(a.actor===actor,'Сейчас ставка другого участника.');
  if(value===null){requireRule(a.leader!==actor,'Лидер не может отозвать ставку.');a.participants=a.participants.filter(id=>id!==actor);emit(s,'AUCTION_LEFT',`${player(s,actor).name} выходит из аукциона.`);}
  else {amount(value);requireRule(value>=a.bid+rules.minimumBid,'Ставка должна быть выше текущей.');requireRule(player(s,actor).money>=value,'Не хватает денег на ставку.');a.leader=actor;a.bid=value;emit(s,'BID_PLACED',`${player(s,actor).name}: ставка $${value}.`);}
  const challengers=a.participants.filter(id=>id!==a.leader);
  if(a.leader&&challengers.length===0){
    transfer(s,a.leader,'BANK',a.bid,'Победа на аукционе');
    if(a.lot.kind==='PROPERTY'){s.properties[a.lot.property].owner=a.leader;emit(s,'PROPERTY_BOUGHT',`${player(s,a.leader).name} получает ${space(s,a.lot.property).name} за $${a.bid}.`,{player:a.leader});}
    else placeBuilding(s,a.leader,a.lot.targets[a.leader]);
    emit(s,'AUCTION_FINISHED',`Аукцион завершён. Победил ${player(s,a.leader).name}.`);s.phase=s.suspended.pop()??{kind:'RESOLVE'};return;
  }
  if(!a.participants.length){emit(s,'AUCTION_FINISHED','Ставок нет. Лот остался у банка.');s.phase=s.suspended.pop()??{kind:'RESOLVE'};return;}
  const index=s.order.indexOf(actor);
  for(let i=1;i<=s.order.length;i++){const id=s.order[(index+i)%s.order.length];if(challengers.includes(id)){a.actor=id;break;}}
}
export function canAuctionProperty(s:GameState) { return active(s).length>1; }
