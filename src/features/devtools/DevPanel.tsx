import type { PublicGameState } from '../../online/protocol';
import { useState } from 'react';
import type { GameController } from '../../controller/GameController';
export default function DevPanel({
  state,
  controller,
}: {
  state: PublicGameState;
  controller: GameController;
}) {
  const [actor, setActor] = useState(state.currentPlayerId),
    [value, setValue] = useState(1000),
    [position, setPosition] = useState(0),
    [property, setProperty] = useState(1),
    [d1, setD1] = useState(1),
    [d2, setD2] = useState(2);
  return (
    <details className="dev-panel">
      <summary>Инструменты разработчика</summary>
      <div className="dev-content">
        <p>Только development. Изменения могут повлиять на партию.</p>
        <div className="dev-row">
          <label>
            Кубик 1
            <input
              aria-label="Dev кубик 1"
              type="number"
              min={1}
              max={6}
              value={d1}
              onChange={(e) => setD1(+e.target.value)}
            />
          </label>
          <label>
            Кубик 2
            <input
              aria-label="Dev кубик 2"
              type="number"
              min={1}
              max={6}
              value={d2}
              onChange={(e) => setD2(+e.target.value)}
            />
          </label>
          <button onClick={() => void controller.dev({ type: 'DICE', values: [d1, d2] })}>
            Задать кубики
          </button>
        </div>
        <label>
          Участник
          <select aria-label="Dev игрок" value={actor} onChange={(e) => setActor(e.target.value)}>
            {state.players
              .filter((p) => !p.bankrupt)
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <div className="dev-row">
          <input
            aria-label="Dev деньги"
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(+e.target.value)}
          />
          <button onClick={() => void controller.dev({ type: 'MONEY', player: actor, value })}>
            Задать деньги
          </button>
        </div>
        <div className="dev-row">
          <input
            aria-label="Dev позиция"
            type="number"
            min={0}
            max={39}
            value={position}
            onChange={(e) => setPosition(+e.target.value)}
          />
          <button
            onClick={() =>
              void controller.dev({ type: 'POSITION', player: actor, value: position })
            }
          >
            Задать позицию
          </button>
        </div>
        <label>
          Объект
          <select
            aria-label="Dev объект"
            value={property}
            onChange={(e) => setProperty(+e.target.value)}
          >
            {state.board.spaces
              .filter((t) => t.price)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
        <div className="dev-row">
          <button
            onClick={() => void controller.dev({ type: 'GIVE', player: actor, value: property })}
          >
            Выдать объект
          </button>
          <button onClick={() => void controller.dev({ type: 'JAIL', player: actor })}>
            В тюрьму
          </button>
          <button onClick={() => void controller.dev({ type: 'CURRENT', player: actor })}>
            Передать ход
          </button>
        </div>
      </div>
    </details>
  );
}
