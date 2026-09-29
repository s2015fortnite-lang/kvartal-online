import type { GameState } from './types';
import type { RuleSet } from '../rules/RuleSet';
import { requireRule, amount } from '../engine/assert';
import { group, player } from './selectors';
export function assertInvariants(s:GameState,rules:RuleSet) {
  requireRule(s.players.length>=2&&s.players.length<=4,'Повреждено число игроков.');
  requireRule(new Set(s.players.map(p=>p.id)).size===s.players.length,'Повторяются игроки.');
  for(const p of s.players){amount(p.money);requireRule(Number.isInteger(p.position)&&p.position>=0&&p.position<s.board.spaces.length,'Некорректная позиция.');requireRule(p.jailAttempts>=0&&p.jailAttempts<=2,'Некорректное число попыток.');}
  let houses=s.bank.houses,hotels=s.bank.hotels;
  requireRule(houses>=0&&hotels>=0,'Отрицательный запас зданий.');
  for(const [key,p] of Object.entries(s.properties)){
    const id=Number(key),t=s.board.spaces[id];requireRule(t&&t.price!==undefined,'Неизвестный объект.');
    requireRule(Number.isInteger(p.level)&&p.level>=0&&p.level<=5,'Некорректная застройка.');
    if(p.owner)requireRule(!player(s,p.owner).bankrupt,'Банкрот владеет имуществом.');
    if(!p.owner)requireRule(!p.level&&!p.mortgaged,'У банка объект с залогом или зданиями.');
    if(p.level){requireRule(t.type==='PROPERTY'&&group(s,id).every(t=>s.properties[t.id].owner===p.owner&&!s.properties[t.id].mortgaged),'Здания без свободной от залогов монополии.');requireRule(group(s,id).every(t=>Math.abs(s.properties[t.id].level-p.level)<=1),'Неравномерная застройка.');}
    if(p.level===5)hotels++;else houses+=p.level;
  }
  requireRule(houses===rules.houses&&hotels===rules.hotels,'Нарушен запас зданий.');
  const cards=[...s.decks.CHANCE,...s.decks.CHEST,...s.heldCards.map(c=>c.id)];
  if(s.phase.kind==='CARD')cards.push(s.phase.card);
  requireRule(new Set(cards).size===cards.length&&cards.length===Object.keys(s.cards).length&&cards.every(id=>!!s.cards[id]),'Карта потеряна или продублирована.');
  requireRule(s.order.length===s.players.length&&new Set(s.order).size===s.order.length&&s.order.every(id=>s.players.some(p=>p.id===id)),'Повреждён порядок ходов.');
  for(const card of s.heldCards)requireRule(!player(s,card.owner).bankrupt&&s.cards[card.id].effect.type==='KEEP','Недопустимая удерживаемая карта.');
  if(s.winner)requireRule(s.phase.kind==='FINISHED'&&s.players.filter(p=>!p.bankrupt).length===1&&!player(s,s.winner).bankrupt,'Некорректный победитель.');
}
