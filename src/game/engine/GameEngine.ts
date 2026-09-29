import type { AvailableAction, Command, Envelope, GameState, Result } from '../state/types';
import type { RuleSet } from '../rules/RuleSet';
import { classicRules } from '../rules/ClassicRuleSet';
import { seededRandom, roll, type RandomProvider } from '../random/random';
import { commandSchema } from '../commands/schema';
import { actingPlayer, owned, player, space } from '../state/selectors';
import { assertInvariants } from '../state/invariants';
import { requireRule } from './assert';
import { emit } from '../events/events';
import { orderRoll, jail, release, nextTurn } from '../turn/turn';
import { resolve } from './resolve';
import { transfer } from '../economy/payments';
import { build, mortgage, sell, sellGroup, placeBuilding } from '../economy/buildings';
import { auctionAction, startAuction } from '../auction/auction';
import { applyCard } from '../cards/cards';
import { propose, accept, canTrade } from '../trade/trade';
import { bankrupt } from '../bankruptcy/bankruptcy';

export class GameEngine {
  constructor(readonly rules:RuleSet=classicRules,readonly random:RandomProvider=seededRandom){}
  execute(input:GameState,envelope:Envelope):Result {
    try{
      requireRule(envelope.expectedRevision===input.revision,'Состояние изменилось. Повторите действие.');
      requireRule(input.rulesId===this.rules.id&&input.rulesVersion===this.rules.version,'Версия правил не поддерживается.');
      requireRule(input.phase.kind!=='FINISHED','Партия уже завершена.');
      const parsed=commandSchema.safeParse(envelope.command);requireRule(parsed.success,'Некорректная команда.');
      const s=structuredClone(input),actor=envelope.actor,c=parsed.data;requireRule(!player(s,actor).bankrupt,'Игрок выбыл.');
      this.dispatch(s,actor,c);resolve(s,this.rules,this.random);s.revision++;
      assertInvariants(s,this.rules);
      return {ok:true,state:s,events:s.history.slice(input.history.length)};
    }catch(error){return {ok:false,error:error instanceof Error?error.message:'Не удалось выполнить действие.'};}
  }
  private dispatch(s:GameState,actor:string,c:Command) {
    const r=this.rules,p=player(s,actor),f=s.phase;
    const acting=()=>requireRule(actingPlayer(s)===actor,'Сейчас действие другого игрока.');
    const phase=(...kinds:GameState['phase']['kind'][])=>requireRule(kinds.includes(s.phase.kind),'Это действие сейчас недоступно.');
    if(['BUILD','SELL','SELL_GROUP','MORTGAGE','REDEEM'].includes(c.type)){
      phase('ROLL','JAIL','MANAGE','BUY','DEBT','AUCTION');
      if(f.kind==='DEBT'||f.kind==='AUCTION')acting();
      if(f.kind==='DEBT'||f.kind==='AUCTION')requireRule(!['BUILD','REDEEM'].includes(c.type),'Сейчас доступны только продажа и залог.');
    }
    switch(c.type){
      case 'ROLL_ORDER':orderRoll(s,actor,this.random);break;
      case 'ROLL':{
        acting();phase('ROLL','MANAGE');requireRule(!p.jailed,'Сначала решите вопрос с тюрьмой.');requireRule(f.kind==='ROLL'||s.extraRoll,'Кубики уже брошены.');
        const dice=roll(s.random,this.random);s.dice=dice;s.extraRoll=dice[0]===dice[1];s.doubles=s.extraRoll?s.doubles+1:0;
        emit(s,'DICE_ROLLED',`${p.name} бросает ${dice[0]} + ${dice[1]}${s.extraRoll?' — дубль!':''}`,{player:actor,dice});
        s.phase={kind:'RESOLVE'};
        if(s.doubles===r.maxDoubles)jail(s,actor);else s.effects.push({type:'MOVE',player:actor,steps:dice[0]+dice[1],salary:true,modifier:'NORMAL'});break;
      }
      case 'BUY':{
        acting();requireRule(f.kind==='BUY','Нет предложения покупки.');const t=space(s,f.property);requireRule(!s.properties[t.id].owner,'У объекта уже есть владелец.');
        transfer(s,actor,'BANK',t.price!,'Покупка');s.properties[t.id].owner=actor;emit(s,'PROPERTY_BOUGHT',`${p.name} покупает ${t.name} за $${t.price}.`,{player:actor});s.phase={kind:'RESOLVE'};break;
      }
      case 'DECLINE':acting();requireRule(f.kind==='BUY','Нет предложения покупки.');startAuction(s,{kind:'PROPERTY',property:f.property});break;
      case 'BID':auctionAction(s,actor,c.amount,r);break;
      case 'LEAVE_AUCTION':auctionAction(s,actor,null,r);break;
      case 'ACK_CARD':acting();requireRule(f.kind==='CARD','Карта не открыта.');s.phase={kind:'RESOLVE'};applyCard(s,actor,f.card);break;
      case 'END_TURN':acting();phase('MANAGE');requireRule(!s.extraRoll,'После дубля положен ещё один бросок.');emit(s,'TURN_ENDED',`${p.name} завершает ход.`);nextTurn(s);break;
      case 'BUILD':build(s,actor,c.property,r);break;
      case 'SELL':sell(s,actor,c.property);break;
      case 'SELL_GROUP':sellGroup(s,actor,c.group);break;
      case 'MORTGAGE':mortgage(s,actor,c.property,false,r);break;
      case 'REDEEM':mortgage(s,actor,c.property,true,r);break;
      case 'REQUEST_BUILD':case 'PASS_BUILD':{
        acting();requireRule(f.kind==='BUILD_REQUESTS','Нет сбора заявок.');
        if(c.type==='REQUEST_BUILD'){const error=r.buildError(s,actor,c.property);requireRule(!error,error??'Нельзя строить.');requireRule((s.properties[c.property].level===4)===(f.building==='HOTEL'),'Нужен другой тип здания.');f.requests.push({player:actor,property:c.property});}
        f.pending.shift();if(f.pending.length){f.actor=f.pending[0];break;}
        const resume=s.suspended.pop()!;
        if(f.requests.length===1){const request=f.requests[0];transfer(s,request.player,'BANK',space(s,request.property).buildingPrice!,'Строительство');placeBuilding(s,request.player,request.property);s.phase=resume;}
        else startAuction(s,{kind:f.building,targets:Object.fromEntries(f.requests.map(q=>[q.player,q.property]))},resume);break;
      }
      case 'PAY_FINE':acting();phase('JAIL');transfer(s,actor,'BANK',r.jailFine,'Выход из тюрьмы');release(s,actor);s.phase={kind:'ROLL'};break;
      case 'USE_CARD':{
        acting();phase('JAIL');const card=s.heldCards.find(card=>card.id===c.card&&card.owner===actor);requireRule(card,'Этой карты нет у игрока.');s.heldCards=s.heldCards.filter(q=>q.id!==c.card);s.decks[card.deck].push(card.id);release(s,actor);s.phase={kind:'ROLL'};break;
      }
      case 'JAIL_ROLL':{
        acting();phase('JAIL');const dice=roll(s.random,this.random);s.dice=dice;s.extraRoll=false;
        emit(s,'DICE_ROLLED',`${p.name} пытается выйти: ${dice.join(' + ')}.`,{player:actor,dice});
        if(dice[0]===dice[1]){release(s,actor);s.phase={kind:'RESOLVE'};s.effects.push({type:'MOVE',player:actor,steps:dice[0]+dice[1],salary:true,modifier:'NORMAL'});}
        else if(p.jailAttempts+1===r.jailAttempts){s.phase={kind:'RESOLVE'};s.effects.push({type:'PAY',debt:{debtor:actor,creditor:'BANK',amount:r.jailFine,reason:'Обязательный выход из тюрьмы'}},{type:'RELEASE',player:actor},{type:'MOVE',player:actor,steps:dice[0]+dice[1],salary:true,modifier:'NORMAL'});}
        else {p.jailAttempts++;s.phase={kind:'MANAGE'};emit(s,'JAIL_FAILED',`Дубль не выпал. Попытка ${p.jailAttempts} из ${r.jailAttempts}.`);}break;
      }
      case 'SETTLE_DEBT':acting();requireRule(f.kind==='DEBT','Долга нет.');transfer(s,actor,f.debt.creditor,f.debt.amount,f.debt.reason);emit(s,'DEBT_SETTLED',`${p.name} погашает долг.`,{player:actor});s.phase={kind:'RESOLVE'};break;
      case 'BANKRUPT':acting();bankrupt(s,r);break;
      case 'MORTGAGE_CHOICE':{
        acting();requireRule(f.kind==='MORTGAGE_TRANSFER','Нет расчёта по залогу.');
        const value=c.choice==='REDEEM'?r.redemption(s,f.property):r.transferFee(s,f.property);
        // The mortgage is cleared only after payment; the effect is queued behind the debt.
        if(c.choice==='REDEEM'){requireRule(p.money>=value,'Для немедленного снятия залога нужны деньги. Можно оставить залог и оплатить процент.');transfer(s,actor,'BANK',value,'Снятие полученного залога');s.properties[f.property].mortgaged=false;s.phase={kind:'RESOLVE'};}
        else {s.phase={kind:'RESOLVE'};s.effects.unshift({type:'PAY',debt:{debtor:actor,creditor:'BANK',amount:value,reason:'Процент за полученный залог'}});}break;
      }
      case 'CREATE_TRADE':propose(s,{proposer:actor,recipient:c.recipient,offer:c.offer,request:c.request,proposerChoices:c.proposerChoices});break;
      case 'ACCEPT_TRADE':accept(s,actor,c.choices,r);break;
      case 'DECLINE_TRADE':case 'CANCEL_TRADE':{
        requireRule(f.kind==='TRADE','Нет обмена.');requireRule(actor===(c.type==='CANCEL_TRADE'?f.trade.proposer:f.trade.recipient),'Нет права закрыть предложение.');s.phase=s.suspended.pop()!;emit(s,'TRADE_DECLINED','Предложение обмена закрыто.');break;
      }
    }
  }
  canTrade(s:GameState,actor:string){return canTrade(s,actor);}
  getAvailableActions(s:GameState,actor:string):AvailableAction[]{
    if(s.phase.kind==='FINISHED'||player(s,actor).bankrupt)return [];
    const options:AvailableAction[]=[
      {command:{type:'ROLL_ORDER'},label:'Бросить для очередности'}, {command:{type:'ROLL'},label:s.extraRoll?'Ещё один бросок':'Бросить кубики'},
      {command:{type:'BUY'},label:'Купить'}, {command:{type:'DECLINE'},label:'На аукцион'}, {command:{type:'ACK_CARD'},label:'Выполнить карту'},
      {command:{type:'END_TURN'},label:'Завершить ход'}, {command:{type:'JAIL_ROLL'},label:'Попытаться выбросить дубль'}, {command:{type:'PAY_FINE'},label:`Заплатить $${this.rules.jailFine}`},
      {command:{type:'SETTLE_DEBT'},label:'Погасить долг'}, {command:{type:'BANKRUPT'},label:'Объявить банкротство'},
      {command:{type:'LEAVE_AUCTION'},label:'Выйти из аукциона'}, {command:{type:'PASS_BUILD'},label:'Не участвовать'},
      {command:{type:'MORTGAGE_CHOICE',choice:'KEEP'},label:'Оставить залог и оплатить процент'}, {command:{type:'MORTGAGE_CHOICE',choice:'REDEEM'},label:'Снять залог сейчас'},
    ];
    for(const card of s.heldCards.filter(c=>c.owner===actor))options.push({command:{type:'USE_CARD',card:card.id},label:'Карта выхода из тюрьмы'});
    for(const t of owned(s,actor))for(const [type,label] of [['BUILD','Построить'],['SELL','Продать здание'],['MORTGAGE','Заложить'],['REDEEM','Снять залог'],['REQUEST_BUILD','Заявка на здание']] as const)options.push({command:{type,property:t.id},label});
    for(const g of new Set(owned(s,actor).map(t=>t.group).filter((g):g is string=>!!g)))options.push({command:{type:'SELL_GROUP',group:g},label:'Продать всю застройку группы'});
    return options.filter(o=>this.execute(s,{actor,expectedRevision:s.revision,command:o.command}).ok);
  }
}
