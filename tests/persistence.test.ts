import { expect,it } from 'vitest';
import { deserialize,serialize,SaveManager } from '../src/persistence/SaveManager';
import { ready,send } from './helpers';
it('roundtrips RNG and auction state',()=>{let s=ready();s.phase={kind:'BUY',player:'p1',property:3};s=send(s,{type:'DECLINE'});s=send(s,{type:'BID',amount:50});expect(deserialize(serialize(s))).toEqual(s);});
it('roundtrips debt and suspended trade',()=>{let s=ready();s.phase={kind:'DEBT',debt:{debtor:'p1',creditor:'BANK',amount:1800,reason:'test'}};s=send(s,{type:'CREATE_TRADE',recipient:'p2',offer:{money:0,properties:[],cards:[]},request:{money:500,properties:[],cards:[]},proposerChoices:{}});expect(deserialize(serialize(s))).toEqual(s);});
it('rejects corrupt state and incompatible version',()=>{const json=JSON.parse(serialize(ready()));json.gameState.players[0].money=-10;expect(()=>deserialize(JSON.stringify(json))).toThrow();expect(()=>deserialize('{')).toThrow();json.saveVersion=99;expect(()=>deserialize(JSON.stringify(json))).toThrow();});
it('stores just the current game',()=>{const saves=new SaveManager(localStorage);saves.save(ready());expect(saves.exists()).toBe(true);expect(saves.load().gameId).toBe('test');saves.clear();expect(saves.exists()).toBe(false);});
