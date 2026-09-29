import type { Debt, GameState, PlayerId } from '../state/types';
import { player } from '../state/selectors';
import { emit } from '../events/events';
import { amount, requireRule } from '../engine/assert';
export function transfer(s: GameState, from: PlayerId | 'BANK', to: PlayerId | 'BANK', value: number, reason: string) {
  amount(value);
  if (!value || from === to) return;
  if (from !== 'BANK') { requireRule(player(s,from).money >= value,'Недостаточно денег.'); player(s,from).money -= value; }
  if (to !== 'BANK') { const p=player(s,to); amount(p.money+value); p.money += value; }
  const sender=from==='BANK'?'Банк':player(s,from).name, receiver=to==='BANK'?'банку':player(s,to).name;
  emit(s,'MONEY_TRANSFERRED',`${sender} → ${receiver}: $${value}. ${reason}`,to==='BANK'?{}:{player:to});
}
export function pay(s: GameState, debt: Debt) {
  if (player(s,debt.debtor).bankrupt || (debt.creditor!=='BANK' && player(s,debt.creditor).bankrupt)) return;
  if (player(s,debt.debtor).money < debt.amount) {
    s.phase={kind:'DEBT',debt};
    emit(s,'DEBT_CREATED',`${player(s,debt.debtor).name}: нужно $${debt.amount}. Можно продать здания, заложить имущество или договориться об обмене.`,{player:debt.debtor});
  } else transfer(s,debt.debtor,debt.creditor,debt.amount,debt.reason);
}
