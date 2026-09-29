import type { GameState, PlayerId } from '../state/types';
import { owned, player } from '../state/selectors';
import { emit } from '../events/events';
import { transfer } from '../economy/payments';
import { jail } from '../turn/turn';
export function applyCard(s:GameState,id:PlayerId,cardId:string) {
  const card=s.cards[cardId],e=card.effect,p=player(s,id),n=s.board.spaces.length;
  if(e.type==='KEEP')s.heldCards.push({id:cardId,deck:card.deck,owner:id});else s.decks[card.deck].push(cardId);
  emit(s,'CARD_APPLIED',card.text,{player:id});
  if(e.type==='MONEY'){
    if(e.amount>=0)transfer(s,'BANK',id,e.amount,card.title);
    else s.effects.unshift({type:'PAY',debt:{debtor:id,creditor:'BANK',amount:-e.amount,reason:card.title}});
  }
  if(e.type==='MOVE_TO'){let steps=(e.position-p.position+n)%n;if(steps===0&&e.position===s.board.go)steps=n;s.effects.unshift({type:'MOVE',player:id,steps,salary:true,modifier:'NORMAL'});}
  if(e.type==='BACK')s.effects.unshift({type:'MOVE',player:id,steps:-e.steps,salary:false,modifier:'NORMAL'});
  if(e.type==='NEAREST'){
    let steps=1;while(steps<=n&&s.board.spaces[(p.position+steps)%n].type!==e.kind)steps++;
    s.effects.unshift({type:'MOVE',player:id,steps,salary:true,modifier:e.kind==='RAILROAD'?'DOUBLE_RAILROAD':'UTILITY_TEN'});
  }
  if(e.type==='JAIL')jail(s,id);
  if(e.type==='REPAIR'){
    const value=owned(s,id).reduce((v,t)=>v+(s.properties[t.id].level===5?e.hotel:s.properties[t.id].level*e.house),0);
    s.effects.unshift({type:'PAY',debt:{debtor:id,creditor:'BANK',amount:value,reason:card.title}});
  }
  if(e.type==='EACH'){
    const i=s.order.indexOf(id),others=[...s.order.slice(i+1),...s.order.slice(0,i)].filter(pid=>!player(s,pid).bankrupt);
    s.effects.unshift(...others.map(other=>({type:'PAY' as const,debt:{debtor:e.amount>0?other:id,creditor:e.amount>0?id:other,amount:Math.abs(e.amount),reason:card.title}})));
  }
}
