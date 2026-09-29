import type { GameState, PlayerId } from '../state/types';
import { active, player } from '../state/selectors';
import { emit } from '../events/events';
import { roll, type RandomProvider } from '../random/random';
import { requireRule } from '../engine/assert';
export function startTurn(s: GameState, id: PlayerId) {
  s.currentPlayerId=id;s.turn++;s.doubles=0;s.extraRoll=false;
  s.phase={kind:player(s,id).jailed?'JAIL':'ROLL'};
  emit(s,'TURN_STARTED',`Ход ${s.turn}. Играет ${player(s,id).name}.`,{player:id});
}
export function nextTurn(s: GameState) {
  const index=s.order.indexOf(s.currentPlayerId);
  for(let n=1;n<=s.order.length;n++){const id=s.order[(index+n)%s.order.length];if(!player(s,id).bankrupt){startTurn(s,id);return;}}
}
export function checkVictory(s: GameState): boolean {
  const remaining=active(s);
  if(remaining.length!==1) return false;
  s.winner=remaining[0].id;s.phase={kind:'FINISHED'};s.effects=[];s.suspended=[];s.extraRoll=false;
  emit(s,'GAME_FINISHED',`Победитель — ${remaining[0].name}!`,{player:remaining[0].id});return true;
}
export function jail(s: GameState, id: PlayerId) {
  const p=player(s,id);p.position=s.board.jail;p.jailed=true;p.jailAttempts=0;
  if(id===s.currentPlayerId){s.extraRoll=false;s.doubles=0;}
  emit(s,'PLAYER_JAILED',`${p.name} отправляется в тюрьму.`,{player:id,path:[s.board.jail]});
}
export function release(s: GameState,id: PlayerId) {const p=player(s,id);p.jailed=false;p.jailAttempts=0;emit(s,'PLAYER_RELEASED',`${p.name} выходит из тюрьмы.`,{player:id});}
export function orderRoll(s:GameState,actor:PlayerId,random:RandomProvider) {
  requireRule(s.phase.kind==='ORDER'&&s.phase.actor===actor,'Сейчас бросает другой игрок.');
  const order=s.orderState!;const dice=roll(s.random,random);s.dice=dice;order.scores[actor]=dice[0]+dice[1];order.pending.shift();
  emit(s,'ORDER_ROLLED',`${player(s,actor).name}: ${dice[0]} + ${dice[1]} = ${dice[0]+dice[1]}.`,{player:actor,dice});
  if(order.pending.length){s.phase={kind:'ORDER',actor:order.pending[0]};return;}
  order.blocks=order.blocks.flatMap(block=>{
    if(block.length===1)return [block];
    const scores=[...new Set(block.map(id=>order.scores[id]))].sort((a,b)=>b-a);
    return scores.map(score=>block.filter(id=>order.scores[id]===score));
  });
  const ties=order.blocks.filter(b=>b.length>1);
  if(ties.length){order.pending=ties.flat();order.scores={};order.round++;s.phase={kind:'ORDER',actor:order.pending[0]};emit(s,'ORDER_TIE','Ничья: повторный бросок только между игроками с одинаковым результатом.');return;}
  s.order=order.blocks.flat();s.orderState=null;
  emit(s,'GAME_STARTED',`Порядок: ${s.order.map(id=>player(s,id).name).join(' → ')}.`);startTurn(s,s.order[0]);
}
