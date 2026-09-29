import type { PublicGameState } from '../../online/protocol';
import { useState } from 'react';
import type { GameController } from '../../controller/GameController';
import { actingPlayer, player, space } from '../../game/state/selectors';
import { TradeReview } from '../trade/Trade';
export const phaseNames: Record<PublicGameState['phase']['kind'], string> = {
  ORDER: 'Определяем очередность',
  ROLL: 'Время бросать кубики',
  JAIL: 'Вы в тюрьме',
  RESOLVE: 'События хода',
  BUY: 'Свободная собственность',
  CARD: 'Вам выпала карта',
  AUCTION: 'Аукцион',
  DEBT: 'Нужно погасить долг',
  MORTGAGE_TRANSFER: 'Получен заложенный объект',
  BUILD_REQUESTS: 'Последнее здание в банке',
  MANAGE: 'Ещё один шаг',
  TRADE: 'Предложение обмена',
  FINISHED: 'Партия завершена',
};
export function Actions({
  state: s,
  controller,
  moving,
  onTrade,
}: {
  state: PublicGameState;
  controller: GameController;
  moving: boolean;
  onTrade: () => void;
}) {
  const actor = actingPlayer(s),
    p = player(s, actor),
    f = s.phase;
  const actions = controller.availableActions(actor);
  const [bid, setBid] = useState('');
  const online = controller.getSnapshot().online;
  if (online && !controller.owns(actor))
    return (
      <section className="action-card" aria-label="Ожидание игрока">
        <div className="eyebrow">{phaseNames[f.kind]}</div>
        <h2>Сейчас действует {p.name}</h2>
        <p className="muted small">
          Вы играете за {player(s, online.playerId).name}. Дождитесь своего действия; свою
          собственность можно открыть нажатием на поле.
        </p>
        {f.kind === 'TRADE' && f.trade.proposer === online.playerId && (
          <TradeReview state={s} trade={f.trade} controller={controller} />
        )}
        {controller.canTrade(online.playerId) && <button onClick={onTrade}>⇄ Обмен</button>}
      </section>
    );
  const main = actions.filter(
    (a) =>
      !['BUILD', 'SELL', 'MORTGAGE', 'REDEEM', 'SELL_GROUP', 'REQUEST_BUILD'].includes(
        a.command.type,
      ),
  );
  return (
    <section className="action-card" aria-label="Действия игрока">
      <div className="eyebrow">{f.kind === 'ORDER' ? 'ПЕРЕД НАЧАЛОМ' : 'ВАШЕ ДЕЙСТВИЕ'}</div>
      <h2>{phaseNames[f.kind]}</h2>
      <p className="acting-label">
        <i style={{ background: p.color }} />
        {p.name}
        <span>{p.token}</span>
      </p>
      {f.kind === 'ORDER' && (
        <p className="muted small">
          Самый высокий результат начинает. При ничьей — повторный бросок.
        </p>
      )}
      {f.kind === 'ROLL' && (
        <p className="muted small">Бросьте два кубика и найдите свой следующий адрес.</p>
      )}
      {f.kind === 'MANAGE' && (
        <p className="muted small">
          {s.extraRoll
            ? 'Выпал дубль — вас ждёт дополнительный бросок.'
            : 'Управляйте имуществом или передайте ход следующему игроку.'}
        </p>
      )}
      {f.kind === 'JAIL' && (
        <p className="muted small">
          Попыток использовано: {p.jailAttempts} из 3. Можно заплатить $50, использовать карту или
          попытаться выбросить дубль.
        </p>
      )}
      {f.kind === 'BUY' && (
        <div
          className="purchase-preview"
          style={{ borderTopColor: space(s, f.property).color ?? '#7a9177' }}
        >
          <strong>{space(s, f.property).name}</strong>
          <div>
            ${space(s, f.property).price}
            <span>стоимость покупки</span>
          </div>
        </div>
      )}
      {f.kind === 'CARD' && (
        <div className="drawn-card">
          <span>{s.cards[f.card].deck === 'CHANCE' ? '?' : '✧'}</span>
          <h3>{s.cards[f.card].title}</h3>
          <p>{s.cards[f.card].text}</p>
        </div>
      )}
      {f.kind === 'DEBT' && (
        <div className="debt">
          <strong>${f.debt.amount}</strong>
          <p>
            {f.debt.reason}
            <br />
            Получатель: {f.debt.creditor === 'BANK' ? 'банк' : player(s, f.debt.creditor).name}
          </p>
          <span>Не хватает: ${Math.max(0, f.debt.amount - p.money)}</span>
        </div>
      )}
      {f.kind === 'MORTGAGE_TRANSFER' && (
        <p className="muted">
          {space(s, f.property).name}. Процент сейчас: $
          {controller.transport.engine.rules.transferFee(s, f.property)}. Снять залог сейчас: $
          {controller.transport.engine.rules.redemption(s, f.property)}.
        </p>
      )}
      {f.kind === 'AUCTION' && (
        <div className="auction-form">
          <h3>
            {f.auction.lot.kind === 'PROPERTY'
              ? space(s, f.auction.lot.property).name
              : f.auction.lot.kind === 'HOUSE'
                ? 'Дом'
                : 'Гостиница'}
          </h3>
          <div className="auction-price">${f.auction.bid}</div>
          <p className="muted small">
            {f.auction.leader ? `Лидер: ${player(s, f.auction.leader).name}` : 'Ставок пока нет'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              controller.dispatch({ type: 'BID', amount: Number(bid || f.auction.bid + 1) });
              setBid('');
            }}
          >
            <label>
              Ваша ставка
              <input
                aria-label="Ваша ставка"
                type="number"
                min={f.auction.bid + 1}
                max={p.money}
                step={1}
                value={bid}
                placeholder={String(f.auction.bid + 1)}
                onChange={(e) => setBid(e.target.value)}
              />
            </label>
            <button className="primary" type="submit" disabled={moving}>
              Сделать ставку ↗
            </button>
          </form>
        </div>
      )}
      {f.kind === 'BUILD_REQUESTS' && (
        <>
          <p className="muted small">
            Другой игрок хочет купить последнее здание. Можно заявить своё право — тогда состоится
            аукцион.
          </p>
          {actions
            .filter((a) => a.command.type === 'REQUEST_BUILD')
            .map((a) => (
              <button
                key={a.command.type === 'REQUEST_BUILD' ? a.command.property : ''}
                onClick={() => controller.dispatch(a.command)}
              >
                {a.command.type === 'REQUEST_BUILD' ? space(s, a.command.property).name : ''}
              </button>
            ))}
        </>
      )}
      {f.kind === 'TRADE' && (
        <TradeReview key={s.revision} state={s} trade={f.trade} controller={controller} />
      )}
      <div className="stack">
        {main.map((a) => (
          <button
            key={JSON.stringify(a.command)}
            className={
              ['ROLL', 'ROLL_ORDER', 'BUY', 'ACK_CARD', 'END_TURN', 'SETTLE_DEBT'].includes(
                a.command.type,
              )
                ? 'primary'
                : a.command.type === 'BANKRUPT'
                  ? 'danger'
                  : ''
            }
            disabled={moving}
            onClick={() => {
              if (
                a.command.type === 'BANKRUPT' &&
                !window.confirm('Объявить банкротство и выйти из партии?')
              )
                return;
              controller.dispatch(a.command);
            }}
          >
            {a.label}
            {a.command.type === 'BUY' && f.kind === 'BUY'
              ? ` за $${space(s, f.property).price}`
              : ''}
            {['ROLL', 'ROLL_ORDER', 'END_TURN'].includes(a.command.type) ? ' ↗' : ''}
          </button>
        ))}
      </div>
      {f.kind !== 'ORDER' && f.kind !== 'FINISHED' && (
        <div className="secondary-actions">
          <span className="property-tip">
            Нажмите на свою улицу, чтобы строить или заложить её.
          </span>
          {controller.canTrade(actor) && <button onClick={onTrade}>⇄ Обмен</button>}
        </div>
      )}
      {moving && (
        <p className="muted small" role="status">
          Фишка перемещается…
        </p>
      )}
    </section>
  );
}
