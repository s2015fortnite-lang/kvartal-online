import type { GameState } from '../state/types';
import type { RuleSet } from '../rules/RuleSet';
import { owned, player } from '../state/selectors';
import { requireRule } from '../engine/assert';
import { emit } from '../events/events';
export function bankrupt(s:GameState,rules:RuleSet) {
  requireRule(s.phase.kind==='DEBT','Банкротство возможно только при непогашенном долге.');const d=s.phase.debt,p=player(s,d.debtor);
  requireRule(rules.liquidation(s,p.id)<d.amount,'Имущества достаточно для погашения: продайте здания или оформите залог.');
  const assets=owned(s,p.id),held=s.heldCards.filter(c=>c.owner===p.id);
  for(const t of assets){const prop=s.properties[t.id];p.money+=prop.level*(t.buildingPrice??0)/2;if(prop.level===5)s.bank.hotels++;else s.bank.houses+=prop.level;prop.level=0;}
  if(d.creditor==='BANK'){
    for(const t of assets){s.properties[t.id]={owner:null,mortgaged:false,level:0};}
    for(const c of held)s.decks[c.deck].push(c.id);
    s.heldCards=s.heldCards.filter(c=>c.owner!==p.id);
    s.effects.unshift(...assets.map(t=>({type:'AUCTION' as const,property:t.id})));
  }else{
    player(s,d.creditor).money+=p.money;
    for(const t of assets)s.properties[t.id].owner=d.creditor;
    for(const c of held)c.owner=d.creditor;
    s.effects.unshift(...assets.filter(t=>s.properties[t.id].mortgaged).map(t=>({type:'MORTGAGE_TRANSFER' as const,player:d.creditor,property:t.id})));
  }
  p.money=0;p.bankrupt=true;p.jailed=false;p.jailAttempts=0;
  if(s.currentPlayerId===p.id){s.extraRoll=false;s.doubles=0;}
  s.phase={kind:'RESOLVE'};emit(s,'PLAYER_BANKRUPT',`${p.name} объявляет банкротство. Имущество передано ${d.creditor==='BANK'?'банку':player(s,d.creditor).name}.`,{player:p.id});
}
