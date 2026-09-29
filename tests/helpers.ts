import { createGame } from '../src/game/engine/create-game';
import { GameEngine } from '../src/game/engine/GameEngine';
import type { Command, GameState, PlayerSetup } from '../src/game/state/types';
import { actingPlayer } from '../src/game/state/selectors';
import type { RandomProvider } from '../src/game/random/random';
export const players:PlayerSetup[]=[{name:'Яков',color:'#d5644c',token:'◆'},{name:'Лена',color:'#5585af',token:'●'},{name:'Саша',color:'#789c67',token:'▲'},{name:'Маша',color:'#b985b3',token:'✦'}];
export function ready(count=2):GameState {const s=createGame(players.slice(0,count),42,'test');s.orderState=null;s.phase={kind:'ROLL'};s.turn=1;return s;}
export function fixed(...dice:number[]):RandomProvider {return {next(state){return ((dice[state.draws++%dice.length]??1)-0.5)/6;}};}
export function send(s:GameState,c:Command,actor=actingPlayer(s),engine=new GameEngine()):GameState {const result=engine.execute(s,{actor,expectedRevision:s.revision,command:c});if(!result.ok)throw new Error(`${c.type}: ${result.error}`);return result.state;}
export function fail(s:GameState,c:Command,actor=actingPlayer(s)){return new GameEngine().execute(s,{actor,expectedRevision:s.revision,command:c});}
export function diceEngine(s:GameState,...dice:number[]){s.random.draws=0;return new GameEngine(undefined,fixed(...dice));}
export function give(s:GameState,id:string,...properties:number[]){for(const property of properties)s.properties[property].owner=id;}
export function levels(s:GameState,entries:Record<number,number>){for(const [id,level] of Object.entries(entries))s.properties[Number(id)].level=level as 0|1|2|3|4|5;s.bank.houses=32-Object.values(s.properties).reduce((n,p)=>n+(p.level<5?p.level:0),0);s.bank.hotels=12-Object.values(s.properties).filter(p=>p.level===5).length;}
export function reveal(s:GameState,card:string,actor='p1'){const deck=s.cards[card].deck;s.decks[deck]=s.decks[deck].filter(c=>c!==card);s.phase={kind:'CARD',player:actor,card};}
