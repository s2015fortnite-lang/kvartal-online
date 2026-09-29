import type { PublicGameState } from '../../online/protocol';
import { useState } from 'react';
import type { Assets, MortgageChoice, Trade } from '../../game/state/types';
import type { GameController } from '../../controller/GameController';
import { owned, player, space } from '../../game/state/selectors';
import { Dialog } from '../../components/Dialog';
const blank = (): Assets => ({ money: 0, properties: [], cards: [] });
export function TradeEditor({
  state,
  controller,
  actor,
  onClose,
}: {
  state: PublicGameState;
  controller: GameController;
  actor: string;
  onClose: () => void;
}) {
  const [recipient, setRecipient] = useState(
    state.players.find((p) => p.id !== actor && !p.bankrupt)!.id,
  );
  const [offer, setOffer] = useState(blank),
    [request, setRequest] = useState(blank),
    [choices, setChoices] = useState<Record<number, MortgageChoice>>({});
  const [error, setError] = useState('');
  function side(owner: string, assets: Assets, set: (a: Assets) => void, label: string) {
    return (
      <section className="trade-side">
        <h3>{label}</h3>
        <label>
          Деньги
          <input
            type="number"
            min={0}
            step={1}
            value={assets.money}
            onChange={(e) => set({ ...assets, money: Number(e.target.value) })}
            aria-label={`${label}: деньги`}
          />
        </label>
        <h4>Собственность</h4>
        {owned(state, owner).map((t) => (
          <label className="check-row" key={t.id}>
            <input
              type="checkbox"
              checked={assets.properties.includes(t.id)}
              onChange={(e) =>
                set({
                  ...assets,
                  properties: e.target.checked
                    ? [...assets.properties, t.id]
                    : assets.properties.filter((id) => id !== t.id),
                })
              }
            />
            <i style={{ background: t.color ?? '#879886' }} />
            {t.name}
            {state.properties[t.id].mortgaged ? ' (залог)' : ''}
          </label>
        ))}
        {!owned(state, owner).length && <p className="muted small">Нет собственности</p>}
        {state.heldCards
          .filter((c) => c.owner === owner)
          .map((c) => (
            <label className="check-row" key={c.id}>
              <input
                type="checkbox"
                checked={assets.cards.includes(c.id)}
                onChange={(e) =>
                  set({
                    ...assets,
                    cards: e.target.checked
                      ? [...assets.cards, c.id]
                      : assets.cards.filter((id) => id !== c.id),
                  })
                }
              />
              Карта освобождения · {c.deck === 'CHANCE' ? 'Шанс' : 'Казна'}
            </label>
          ))}
      </section>
    );
  }
  return (
    <Dialog title={`Обмен · ${player(state, actor).name}`} onClose={onClose} wide>
      <label>
        Другой участник
        <select
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setRequest(blank());
            setChoices({});
          }}
        >
          {state.players
            .filter((p) => p.id !== actor && !p.bankrupt)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <div className="trade-sides">
        {side(actor, offer, setOffer, 'Я отдаю')}
        {side(recipient, request, setRequest, 'Я получаю')}
      </div>
      {request.properties
        .filter((id) => state.properties[id].mortgaged)
        .map((id) => (
          <label className="check-row" key={id}>
            <input
              type="checkbox"
              checked={choices[id] === 'REDEEM'}
              onChange={(e) =>
                setChoices({ ...choices, [id]: e.target.checked ? 'REDEEM' : 'KEEP' })
              }
            />
            Снять получаемый залог «{space(state, id).name}» сейчас
          </label>
        ))}
      <p className="muted small">
        Получатель залога платит банку 10%. При немедленном снятии — сумму залога и 10%. Застроенные
        группы передавать нельзя.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <button onClick={onClose}>Отмена</button>
        <button
          className="primary"
          disabled={!!controller.getSnapshot().online?.pending}
          onClick={async () => {
            await controller.dispatch(
              { type: 'CREATE_TRADE', recipient, offer, request, proposerChoices: choices },
              actor,
            );
            const next = controller.getSnapshot();
            if (next.error) setError(next.error);
            else onClose();
          }}
        >
          Предложить обмен ↗
        </button>
      </div>
    </Dialog>
  );
}
function AssetSummary({ assets, state }: { assets: Assets; state: PublicGameState }) {
  return (
    <ul className="asset-summary">
      <li>${assets.money.toLocaleString('ru-RU')}</li>
      {assets.properties.map((id) => (
        <li key={id}>
          {space(state, id).name}
          {state.properties[id].mortgaged ? ' · залог' : ''}
        </li>
      ))}
      {assets.cards.map((id) => (
        <li key={id}>Карта освобождения</li>
      ))}
    </ul>
  );
}
export function TradeReview({
  state,
  trade,
  controller,
}: {
  state: PublicGameState;
  trade: Trade;
  controller: GameController;
}) {
  const [choices, setChoices] = useState<Record<number, MortgageChoice>>({});
  return (
    <>
      <p>
        <strong>{player(state, trade.proposer).name}</strong> предлагает обмен игроку{' '}
        {player(state, trade.recipient).name}.
      </p>
      <div className="trade-review">
        <h4>Получает {player(state, trade.recipient).name}</h4>
        <AssetSummary assets={trade.offer} state={state} />
        <h4>Получает {player(state, trade.proposer).name}</h4>
        <AssetSummary assets={trade.request} state={state} />
      </div>
      {trade.offer.properties
        .filter((id) => controller.owns(trade.recipient) && state.properties[id].mortgaged)
        .map((id) => (
          <label className="check-row small" key={id}>
            <input
              type="checkbox"
              checked={choices[id] === 'REDEEM'}
              onChange={(e) =>
                setChoices({ ...choices, [id]: e.target.checked ? 'REDEEM' : 'KEEP' })
              }
            />
            Снять залог: {space(state, id).name}
          </label>
        ))}
      <div className="stack">
        <button
          hidden={!controller.owns(trade.recipient)}
          disabled={!!controller.getSnapshot().online?.pending}
          className="primary"
          onClick={() => controller.dispatch({ type: 'ACCEPT_TRADE', choices }, trade.recipient)}
        >
          Принять обмен
        </button>
        <button
          hidden={!controller.owns(trade.recipient)}
          onClick={() => controller.dispatch({ type: 'DECLINE_TRADE' }, trade.recipient)}
        >
          Отклонить
        </button>
        <button
          hidden={!controller.owns(trade.proposer)}
          className="text-button"
          onClick={() => controller.dispatch({ type: 'CANCEL_TRADE' }, trade.proposer)}
        >
          Отменить от имени инициатора
        </button>
      </div>
    </>
  );
}
