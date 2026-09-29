import type { GameState, PlayerId, RentModifier } from '../state/types';
import type { RuleSet } from '../rules/RuleSet';
import type { RandomProvider } from '../random/random';
import { roll } from '../random/random';
import { player, space } from '../state/selectors';
import { emit } from '../events/events';
import { pay, transfer } from '../economy/payments';
import { checkVictory, jail, nextTurn, release } from '../turn/turn';
import { startAuction, canAuctionProperty } from '../auction/auction';
import { requireRule } from './assert';
export function land(s:GameState,id:PlayerId,modifier:RentModifier,rules:RuleSet,random:RandomProvider) {
  const p=player(s,id),t=space(s,p.position),property=s.properties[t.id];
  if(property){
    if(!property.owner){s.phase={kind:'BUY',player:id,property:t.id};return;}
    if(property.owner===id||property.mortgaged)return;
    let total=(s.dice?.[0]??0)+(s.dice?.[1]??0);
    if(t.type==='UTILITY'&&modifier==='UTILITY_TEN'){const dice=roll(s.random,random);total=dice[0]+dice[1];emit(s,'DICE_ROLLED',`Бросок для коммунальной аренды: ${dice.join(' + ')}.`,{player:id,dice});}
    s.effects.unshift({type:'PAY',debt:{debtor:id,creditor:property.owner,amount:rules.rent(s,t.id,total,modifier),reason:`Аренда: ${t.name}`}});return;
  }
  if(t.type==='TAX')s.effects.unshift({type:'PAY',debt:{debtor:id,creditor:'BANK',amount:t.tax!,reason:t.name}});
  if(t.type==='GO_TO_JAIL')jail(s,id);
  if(t.type==='CHANCE'||t.type==='CHEST'){
    const card=s.decks[t.type].shift();requireRule(card,'Колода пуста.');s.phase={kind:'CARD',player:id,card};emit(s,'CARD_DRAWN',`${p.name}: ${s.cards[card].title}.`,{player:id});
  }
}
export function resolve(s:GameState,rules:RuleSet,random:RandomProvider) {
  let steps=0;
  while(s.phase.kind==='RESOLVE'){
    requireRule(++steps<=300,'Слишком длинная цепочка эффектов.');
    const e=s.effects.shift();
    if(!e){if(checkVictory(s))return;if(player(s,s.currentPlayerId).bankrupt){nextTurn(s);return;}s.phase={kind:'MANAGE'};return;}
    if('player' in e&&player(s,e.player).bankrupt)continue;
    if(e.type==='PAY')pay(s,e.debt);
    if(e.type==='RELEASE')release(s,e.player);
    if(e.type==='LAND')land(s,e.player,e.modifier,rules,random);
    if(e.type==='AUCTION'&&canAuctionProperty(s))startAuction(s,{kind:'PROPERTY',property:e.property});
    if(e.type==='MORTGAGE_TRANSFER'&&s.properties[e.property].owner===e.player&&s.properties[e.property].mortgaged)s.phase={kind:'MORTGAGE_TRANSFER',player:e.player,property:e.property};
    if(e.type==='MOVE'){
      const p=player(s,e.player),n=s.board.spaces.length,path:number[]=[];let salaryCount=0;
      for(let i=0;i<Math.abs(e.steps);i++){p.position=(p.position+Math.sign(e.steps)+n)%n;path.push(p.position);if(e.steps>0&&p.position===s.board.go&&e.salary)salaryCount++;}
      if(salaryCount){transfer(s,'BANK',p.id,salaryCount*rules.salary,'Проход через Старт');emit(s,'PASSED_GO',`${p.name} получает $${salaryCount*rules.salary} за Старт.`,{player:p.id});}
      emit(s,'PLAYER_MOVED',`${p.name} → ${space(s,p.position).name}.`,{player:p.id,path});
      s.effects.unshift({type:'LAND',player:p.id,modifier:e.modifier});
    }
  }
}
