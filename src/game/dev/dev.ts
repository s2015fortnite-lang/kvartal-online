import type { GameState } from '../state/types';
import { player } from '../state/selectors';
import { jail } from '../turn/turn';
import { emit } from '../events/events';
import { amount, requireRule } from '../engine/assert';
import { assertInvariants } from '../state/invariants';
import { classicRules } from '../rules/ClassicRuleSet';
import { seededRandom, roll } from '../random/random';
export type DevAction={type:'MONEY'|'POSITION'|'GIVE';player:string;value:number}|{type:'JAIL'|'CURRENT';player:string}|{type:'DICE';values:[number,number]};
export function executeDev(input:GameState,action:DevAction):GameState {
  const s=structuredClone(input);
  if(action.type==='DICE'){
    requireRule(action.values.every(v=>Number.isInteger(v)&&v>=1&&v<=6),'Кубики: от 1 до 6.');
    // Find a seed whose next two draws match, preserving the normal RNG contract.
    for(let seed=1;seed<100000;seed++){const random={seed,draws:0};const dice=roll(random,seededRandom);if(dice[0]===action.values[0]&&dice[1]===action.values[1]){s.random={seed,draws:0};break;}}
  }else{
    const p=player(s,action.player);requireRule(!p.bankrupt,'Игрок уже выбыл.');
    if(action.type==='MONEY'){amount(action.value);p.money=action.value;}
    if(action.type==='POSITION'){requireRule(Number.isInteger(action.value)&&action.value>=0&&action.value<s.board.spaces.length,'Позиция вне поля.');p.position=action.value;p.jailed=false;p.jailAttempts=0;}
    if(action.type==='GIVE'){requireRule(s.properties[action.value],'Выберите собственность.');s.properties[action.value].owner=p.id;}
    if(action.type==='JAIL')jail(s,p.id);
    if(action.type==='CURRENT'||action.type==='JAIL'){
      requireRule(!['CARD','ORDER'].includes(s.phase.kind),'Сначала завершите карту или определение порядка.');
      s.currentPlayerId=p.id;s.phase={kind:p.jailed?'JAIL':'ROLL'};s.suspended=[];s.effects=[];s.doubles=0;s.extraRoll=false;
    }
  }
  emit(s,'DEV_CHANGED','Состояние изменено инструментами разработчика.');s.revision++;assertInvariants(s,classicRules);return s;
}
