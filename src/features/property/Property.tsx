import type { PublicGameState } from '../../online/protocol';

import type { GameController } from '../../controller/GameController';
import { player, space } from '../../game/state/selectors';
import { Dialog } from '../../components/Dialog';

const money = (n: number) => `$${n.toLocaleString('ru-RU')}`;

export function PropertyCard({
  state,
  id,
  controller,
  onClose,
}: {
  state: PublicGameState;
  id: number;
  controller: GameController;
  onClose: () => void;
}) {
  const t = space(state, id),
    property = state.properties[id];
  const owner = property?.owner;
  const actions = owner
    ? controller
        .availableActions(owner)
        .filter(
          (a) =>
            ('property' in a.command &&
              a.command.property === id &&
              ['BUILD', 'SELL', 'MORTGAGE', 'REDEEM'].includes(a.command.type)) ||
            (a.command.type === 'SELL_GROUP' && a.command.group === t.group),
        )
    : [];
  const buildingReason =
    owner && t.type === 'PROPERTY'
      ? controller.transport.engine.rules.buildError(state, owner, id)
      : null;
  return (
    <Dialog title={t.name} onClose={onClose}>
      <div className="deed-band" style={{ background: t.color ?? '#91a38b' }} />
      <div className="deed-owner">
        {owner ? `Владелец: ${player(state, owner).name}` : 'Собственность банка'}
        {property?.mortgaged ? ' · в залоге' : ''}
      </div>
      {owner && !state.winner && (
        <section className="property-actions" aria-label="Действия с собственностью">
          <h3>Действия владельца · {player(state, owner).name}</h3>
          <p className="muted small">
            {property.level === 5
              ? 'Гостиница'
              : property.level
                ? `Домов: ${property.level}`
                : 'Без зданий'}{' '}
            · баланс {money(player(state, owner).money)}
          </p>
          <div className="stack">
            {actions.map((a) => {
              const c = a.command;
              const label =
                c.type === 'BUILD'
                  ? `${property.level === 4 ? 'Построить гостиницу' : 'Построить дом'} · ${money(t.buildingPrice!)}`
                  : c.type === 'MORTGAGE'
                    ? `Заложить · +${money(t.mortgage!)}`
                    : c.type === 'REDEEM'
                      ? `Снять залог · ${money(controller.transport.engine.rules.redemption(state, id))}`
                      : c.type === 'SELL'
                        ? `Продать здание · +${money(t.buildingPrice! / 2)}`
                        : 'Продать всю застройку группы';
              return (
                <button
                  key={c.type}
                  className={c.type === 'BUILD' ? 'primary' : ''}
                  onClick={async () => {
                    await controller.dispatch(c, owner);
                    if (controller.getSnapshot().state?.phase.kind === 'BUILD_REQUESTS') onClose();
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {buildingReason && property.level !== 5 && (
            <p className="muted small">{buildingReason}</p>
          )}
          {!actions.length && (
            <p className="muted small">
              Сейчас нет доступных операций. Сначала завершите текущее действие.
            </p>
          )}
        </section>
      )}
      {t.price ? (
        <>
          <div className="deed-price">
            {money(t.price)}
            <small>цена покупки</small>
          </div>
          <dl className="details">
            {t.rent?.map((rent, i) => (
              <div key={i}>
                <dt>
                  {t.type === 'PROPERTY'
                    ? [
                        'Аренда без зданий',
                        'С одним домом',
                        'С двумя домами',
                        'С тремя домами',
                        'С четырьмя домами',
                        'С гостиницей',
                      ][i]
                    : t.type === 'RAILROAD'
                      ? `${i + 1} вокзал(а) у владельца`
                      : `${i + 1} предприятие у владельца`}
                </dt>
                <dd>{t.type === 'UTILITY' ? `Кубики × ${rent}` : money(rent)}</dd>
              </div>
            ))}
            {t.buildingPrice && (
              <div>
                <dt>Стоимость дома / гостиницы</dt>
                <dd>{money(t.buildingPrice)}</dd>
              </div>
            )}
            <div>
              <dt>Залог</dt>
              <dd>{money(t.mortgage!)}</dd>
            </div>
          </dl>
          {t.type === 'PROPERTY' && (
            <p className="muted small">
              Аренда пустой улицы удваивается при владении всей цветовой группой.
            </p>
          )}
        </>
      ) : (
        <p>
          {t.type === 'GO'
            ? 'За каждый проход вперёд через Старт вы получаете $200.'
            : t.type === 'TAX'
              ? `Обязательный платёж банку: ${money(t.tax!)}.`
              : t.type === 'PARKING'
                ? 'Здесь можно перевести дух. Никаких платежей и наград.'
                : t.type === 'JAIL'
                  ? 'Обычное попадание — просто визит. Заключённым доступны штраф, карта освобождения или попытка дубля.'
                  : t.type === 'GO_TO_JAIL'
                    ? 'Немедленно отправляйтесь в тюрьму без выплаты за Старт.'
                    : 'Возьмите верхнюю карту соответствующей колоды и выполните её указание.'}
        </p>
      )}
    </Dialog>
  );
}
