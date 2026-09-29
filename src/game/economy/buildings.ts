import type { GameState, Level, PlayerId } from '../state/types';
import type { RuleSet } from '../rules/RuleSet';
import { group, player, space } from '../state/selectors';
import { requireRule } from '../engine/assert';
import { emit } from '../events/events';
import { transfer } from './payments';
export function placeBuilding(s:GameState,actor:PlayerId,id:number) {
  const p=s.properties[id];
  if(p.level===4){requireRule(s.bank.hotels>0,'В банке нет гостиниц.');s.bank.hotels--;s.bank.houses+=4;}
  else {requireRule(s.bank.houses>0,'В банке нет домов.');s.bank.houses--;}
  p.level=(p.level+1) as Level;
  emit(s,'BUILDING_BUILT',`${player(s,actor).name}: ${space(s,id).name} — ${p.level===5?'гостиница':`${p.level} дом(а)`}.`,{player:actor});
}
export function build(s:GameState,actor:PlayerId,id:number,rules:RuleSet) {
  const error=rules.buildError(s,actor,id);requireRule(!error,error??'Нельзя строить.');
  const p=s.properties[id],stock=p.level===4?s.bank.hotels:s.bank.houses;requireRule(stock>0,'В банке нет нужных зданий.');
  // Offer every eligible rival a chance to request the final building.
  const rivals=s.order.filter(pid=>pid!==actor&&!player(s,pid).bankrupt&&s.board.spaces.some(t=>s.properties[t.id]?.level===p.level&&!rules.buildError(s,pid,t.id)));
  if(stock===1&&rivals.length){s.suspended.push(s.phase);s.phase={kind:'BUILD_REQUESTS',actor:rivals[0],pending:rivals,requests:[{player:actor,property:id}],building:p.level===4?'HOTEL':'HOUSE'};return;}
  transfer(s,actor,'BANK',space(s,id).buildingPrice!,'Строительство');placeBuilding(s,actor,id);
}
export function sell(s:GameState,actor:PlayerId,id:number) {
  const t=space(s,id),p=s.properties[id];requireRule(p?.owner===actor&&p.level>0,'На этом объекте нет ваших зданий.');
  requireRule(group(s,id).every(t=>s.properties[t.id].level<=p.level),'Продавайте равномерно: сначала с более застроенной улицы.');
  if(p.level===5){requireRule(s.bank.houses>=4,'Нужны 4 дома в банке. Можно продать всю застройку группы.');s.bank.houses-=4;s.bank.hotels++;}
  else s.bank.houses++;
  p.level=(p.level-1) as Level;transfer(s,'BANK',actor,t.buildingPrice!/2,'Продажа здания');emit(s,'BUILDING_SOLD',`Продано здание: ${t.name}.`,{player:actor});
}
export function sellGroup(s:GameState,actor:PlayerId,groupId:string) {
  const tiles=s.board.spaces.filter(t=>t.group===groupId);requireRule(tiles.length>0&&tiles.every(t=>s.properties[t.id].owner===actor),'Группа вам не принадлежит.');
  requireRule(tiles.some(t=>s.properties[t.id].level>0),'В группе нет зданий.');
  for(const t of tiles){const p=s.properties[t.id];if(p.level===5)s.bank.hotels++;else s.bank.houses+=p.level;transfer(s,'BANK',actor,p.level*t.buildingPrice!/2,'Продажа застройки');p.level=0;}
  emit(s,'BUILDING_SOLD',`${player(s,actor).name} продаёт всю застройку группы.`,{player:actor});
}
export function mortgage(s:GameState,actor:PlayerId,id:number,redeem:boolean,rules:RuleSet) {
  const t=space(s,id),p=s.properties[id];requireRule(p?.owner===actor,'Объект вам не принадлежит.');
  if(redeem){requireRule(p.mortgaged,'Объект не заложен.');transfer(s,actor,'BANK',rules.redemption(s,id),'Снятие залога');p.mortgaged=false;emit(s,'PROPERTY_REDEEMED',`Снят залог: ${t.name}.`,{player:actor});}
  else {requireRule(!p.mortgaged,'Объект уже заложен.');requireRule(group(s,id).every(t=>s.properties[t.id].level===0),'Сначала продайте всю застройку группы.');p.mortgaged=true;transfer(s,'BANK',actor,t.mortgage!,'Залог');emit(s,'PROPERTY_MORTGAGED',`Заложен объект: ${t.name}.`,{player:actor});}
}
