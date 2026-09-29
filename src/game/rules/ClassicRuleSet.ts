import type { RuleSet } from './RuleSet';
import { group, monopoly, owned, player, space } from '../state/selectors';
export const classicRules: RuleSet = {
  id: 'classic', version: 1, startingMoney: 1500, salary: 200, jailFine: 50, jailAttempts: 3,
  maxDoubles: 3, houses: 32, hotels: 12, mortgageRate: 0.1, minimumBid: 1,
  rent(s, id, dice, modifier) {
    const p = s.properties[id], t = space(s,id);
    if (!p?.owner || p.mortgaged) return 0;
    if (t.type === 'PROPERTY') return t.rent![p.level] * (p.level === 0 && monopoly(s,id,p.owner) ? 2 : 1);
    const count = owned(s,p.owner).filter(o => o.type === t.type).length;
    if (t.type === 'RAILROAD') return t.rent![count - 1] * (modifier === 'DOUBLE_RAILROAD' ? 2 : 1);
    if (t.type === 'UTILITY') return dice * (modifier === 'UTILITY_TEN' ? 10 : t.rent![count - 1]);
    return 0;
  },
  buildError(s, actor, id) {
    const t = space(s,id), p = s.properties[id];
    if (t.type !== 'PROPERTY' || p?.owner !== actor) return 'Строить можно только на своей улице.';
    if (!monopoly(s,id,actor)) return 'Нужна вся цветовая группа.';
    if (group(s,id).some(t => s.properties[t.id].mortgaged)) return 'Сначала снимите все залоги группы.';
    if (p.level === 5) return 'Гостиница уже построена.';
    if (group(s,id).some(t => s.properties[t.id].level < p.level)) return 'Стройте равномерно: сначала на менее застроенной улице.';
    if (player(s,actor).money < t.buildingPrice!) return 'Недостаточно денег для строительства.';
    return null;
  },
  transferFee(s,id) { return Math.ceil(space(s,id).mortgage! * this.mortgageRate); },
  redemption(s,id) { return space(s,id).mortgage! + this.transferFee(s,id); },
  liquidation(s,id) { return player(s,id).money + owned(s,id).reduce((sum,t) => sum + (s.properties[t.id].mortgaged ? 0 : t.mortgage!) + s.properties[t.id].level * (t.buildingPrice ?? 0) / 2,0); },
};
