import { classicBoard } from '../../data/board';
import { classicCards } from '../../data/cards';
import { classicRules } from '../rules/ClassicRuleSet';
import type { RuleSet } from '../rules/RuleSet';
import { seededRandom, shuffle } from '../random/random';
import type { Board, Card, GameState, PlayerSetup, Property } from '../state/types';
import { emit } from '../events/events';
import { requireRule } from './assert';
export function createGame(setup: PlayerSetup[], seed: number, gameId: string, rules: RuleSet = classicRules, board: Board = classicBoard, cards: Card[] = classicCards): GameState {
  requireRule(setup.length >= 2 && setup.length <= 4, 'Нужно от 2 до 4 игроков.');
  requireRule(setup.every(p => p.name.trim().length > 0 && p.name.trim().length <= 24), 'Имя должно содержать от 1 до 24 символов.');
  requireRule(new Set(setup.map(p => p.token)).size === setup.length, 'Выберите разные фишки.');
  requireRule(setup.every(p => /^#[0-9a-f]{6}$/i.test(p.color)), 'Выберите корректные цвета.');
  requireRule(Number.isInteger(seed), 'Некорректный seed.');
  requireRule(board.spaces.length > 0 && board.spaces.every((t,i) => t.id === i), 'Индексы клеток должны идти подряд.');
  requireRule(board.spaces[board.go]?.type === 'GO' && board.spaces[board.jail]?.type === 'JAIL', 'В поле нужны Старт и тюрьма.');
  const properties: Record<number,Property> = {};
  board.spaces.filter(t => t.price !== undefined).forEach(t => properties[t.id] = {owner:null,mortgaged:false,level:0});
  const players = setup.map((p,i) => ({...p,name:p.name.trim(),id:`p${i+1}`,money:rules.startingMoney,position:board.go,jailed:false,jailAttempts:0,bankrupt:false}));
  const order = players.map(p => p.id), random = { seed: seed >>> 0, draws: 0 };
  const s: GameState = {
    schemaVersion:1, gameId, revision:0, rulesId:rules.id, rulesVersion:rules.version,
    board:structuredClone(board), cards:Object.fromEntries(cards.map(c => [c.id,structuredClone(c)])), players, properties,
    bank:{houses:rules.houses,hotels:rules.hotels}, order, orderState:{blocks:[order.slice()],pending:order.slice(),scores:{},round:1},
    currentPlayerId:order[0],turn:0,doubles:0,extraRoll:false,phase:{kind:'ORDER',actor:order[0]},suspended:[],effects:[],dice:null,
    decks:{CHANCE:shuffle(cards.filter(c=>c.deck==='CHANCE').map(c=>c.id),random,seededRandom), CHEST:shuffle(cards.filter(c=>c.deck==='CHEST').map(c=>c.id),random,seededRandom)},
    heldCards:[],random,winner:null,history:[],nextEvent:1,
  };
  emit(s,'GAME_CREATED','Партия создана. Бросьте кубики, чтобы определить порядок.');
  return s;
}
