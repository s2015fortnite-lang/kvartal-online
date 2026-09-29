import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game/engine/create-game';
import { classicBoard } from '../src/data/board';
import { classicCards } from '../src/data/cards';
import { classicRules } from '../src/game/rules/ClassicRuleSet';
import type { PlayerSetup } from '../src/game/state/types';
export const setup: PlayerSetup[] = [{name:'Яков',color:'#d5644c',token:'◆'},{name:'Лена',color:'#5585af',token:'●'}];
describe('domain and initialization',()=>{
  it('has a complete classic board and decks',()=>{expect(classicBoard.spaces).toHaveLength(40);expect(classicBoard.spaces.filter(t=>t.price)).toHaveLength(28);expect(classicCards).toHaveLength(32);expect(new Set(classicCards.map(c=>c.id)).size).toBe(32);});
  it('creates serializable deterministic state',()=>{const a=createGame(setup,42,'test'),b=createGame(setup,42,'test');expect(a).toEqual(b);expect(JSON.parse(JSON.stringify(a))).toEqual(a);expect(a.players.every(p=>p.money===1500)).toBe(true);expect(a.bank).toEqual({houses:32,hotels:12});});
  it('rejects invalid setup',()=>{expect(()=>createGame(setup.slice(0,1),1,'t')).toThrow();expect(()=>createGame([setup[0],setup[0]],1,'t')).toThrow();});
  it('calculates monopoly and mortgage rent separately',()=>{const s=createGame(setup,1,'t');s.properties[1].owner='p1';s.properties[3].owner='p1';expect(classicRules.rent(s,1,7,'NORMAL')).toBe(4);s.properties[3].mortgaged=true;expect(classicRules.rent(s,1,7,'NORMAL')).toBe(4);expect(classicRules.rent(s,3,7,'NORMAL')).toBe(0);});
});
