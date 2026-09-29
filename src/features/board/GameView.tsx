import type { PublicGameState } from '../../online/protocol';
import type { CSSProperties } from 'react';
import type { GameController } from '../../controller/GameController';
import type { GameEvent, Player } from '../../game/state/types';
import { actingPlayer, owned, player } from '../../game/state/selectors';
import type { usePresentation } from '../animation/usePresentation';
import { Board } from './Board';
import { Dice } from '../turn/Dice';
import { Actions } from '../turn/Actions';

function Players({
  state,
  players,
  side,
}: {
  state: PublicGameState;
  players: Player[];
  side: 'left' | 'right';
}) {
  return (
    <aside
      className={`players-side players-${side}`}
      aria-label={`Игроки ${side === 'left' ? 'слева' : 'справа'}`}
    >
      <div className="section-title">
        <h2>За столом</h2>
      </div>
      {players.map((p) => (
        <div
          key={p.id}
          className={`player-card ${p.id === state.currentPlayerId ? 'current' : ''} ${p.bankrupt ? 'bankrupt' : ''}`}
          style={{ '--player-color': p.color } as CSSProperties}
        >
          <div className="player-token" style={{ background: p.color }}>
            {p.token}
          </div>
          <div className="player-info">
            <strong>
              {p.name}
              {p.id === state.currentPlayerId && !p.bankrupt && <span>ХОД</span>}
            </strong>
            <small>
              {p.bankrupt
                ? 'Банкрот'
                : `${owned(state, p.id).length} объектов${p.jailed ? ' · В тюрьме' : ''}`}
            </small>
          </div>
          <span className="player-money" key={p.money}>
            ${p.money.toLocaleString('ru-RU')}
          </span>
        </div>
      ))}
    </aside>
  );
}

interface Props {
  state: PublicGameState;
  controller: GameController;
  events: GameEvent[];
  presentation: ReturnType<typeof usePresentation>;
  onSpace: (id: number) => void;
  onTrade: () => void;
  onNew: () => void;
  onMenu: () => void;
  onRules: () => void;
}
export function GameView({
  state: s,
  controller,
  events,
  presentation,
  onSpace,
  onTrade,
  onNew,
  onMenu,
  onRules,
}: Props) {
  const { positions, dice, stage, busy } = presentation;
  const split = s.players.length > 2;
  const online = controller.getSnapshot().online;
  const locked = !!online && (online.pending || online.status !== 'connected');
  const actor = busy ? (events.find((e) => e.dice)?.player ?? actingPlayer(s)) : actingPlayer(s);
  const history = busy && events.length ? s.history.filter((e) => e.id < events[0].id) : s.history;
  return (
    <main className="game-page">
      <div className="game-heading">
        <div>
          <div className="eyebrow">
            {s.phase.kind === 'ORDER' ? 'НОВАЯ ПАРТИЯ' : `ХОД ${s.turn} · КЛАССИЧЕСКАЯ ПАРТИЯ`}
          </div>
          <h1>
            {s.winner ? 'Город нашёл своего победителя.' : 'У каждого адреса — своя история.'}
          </h1>
        </div>
        <span className="local-badge">
          <i className="status-dot" />
          {online ? 'Сетевая игра' : 'Локальная игра'}
        </span>
      </div>
      {online && (
        <div className="network-note" role="status">
          Вы — {player(s, online.playerId).name} ·{' '}
          {online.status === 'connected'
            ? online.pending
              ? 'Ждём подтверждения…'
              : 'Подключено · партия сохраняется на сервере'
            : 'Связь потеряна. Переподключаемся…'}
          {online.room?.seats
            .filter((p) => !p.connected)
            .map((p) => (
              <span key={p.id}> · {p.name}: нет связи</span>
            ))}
        </div>
      )}
      <div className={`table-layout ${split ? 'table-split' : 'table-one-side'}`}>
        {split && <Players state={s} players={s.players.slice(0, 2)} side="left" />}
        <Board state={s} onSpace={onSpace} positions={positions} busy={busy}>
          <div className="center-toolbar">
            <span className="center-brand">КВАРТАЛ.</span>
            <nav aria-label="Управление партией">
              {!online && (
                <button disabled={busy} onClick={() => controller.save()}>
                  Сохранить
                </button>
              )}
              <button disabled={busy} onClick={onRules}>
                Правила
              </button>
              <button disabled={busy} onClick={onMenu}>
                В меню
              </button>
            </nav>
          </div>
          {s.winner ? (
            <div className="winner-card">
              <span>✦ ПОБЕДИТЕЛЬ</span>
              <h2>{player(s, s.winner).name}</h2>
              <p>
                ${player(s, s.winner).money.toLocaleString('ru-RU')} · {owned(s, s.winner).length}{' '}
                объектов
              </p>
              <button className="primary" onClick={online ? onMenu : onNew}>
                Сыграть ещё раз ↗
              </button>
            </div>
          ) : (
            <>
              <div className="central-dice">
                <div>
                  <div className="eyebrow">
                    {stage === 'rolling'
                      ? 'БРОСАЕМ КУБИКИ'
                      : stage === 'walking'
                        ? 'ПЕРЕМЕЩЕНИЕ ФИШКИ'
                        : 'ВАШ ХОД'}
                  </div>
                  <h3>
                    <span style={{ color: player(s, actor).color }}>{player(s, actor).token}</span>{' '}
                    {player(s, actor).name}
                  </h3>
                  {dice && stage !== 'rolling' && (
                    <p className="dice-total">{dice[0] + dice[1]} очков</p>
                  )}
                </div>
                <Dice values={dice} rolling={stage === 'rolling'} />
              </div>
              {busy ? (
                <div className="turn-progress" role="status" aria-live="polite">
                  {stage === 'rolling' ? 'Бросаем кубики…' : 'Фишка перемещается по полю…'}
                </div>
              ) : (
                <div inert={locked}>
                  <Actions state={s} controller={controller} moving={locked} onTrade={onTrade} />
                </div>
              )}
              <div className="bank-note">
                В банке <strong>{s.bank.houses}</strong> домов · <strong>{s.bank.hotels}</strong>{' '}
                гостиниц
              </div>
            </>
          )}
          <div className="center-log">
            <div className="eyebrow">ПОСЛЕДНИЕ СОБЫТИЯ</div>
            {history.slice(-2).map((e) => (
              <p key={e.id}>{e.text}</p>
            ))}
          </div>
          <details className="history-panel">
            <summary>
              Журнал партии <span>{history.length} событий</span>
            </summary>
            <ol>
              {history
                .slice()
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    <span>{e.turn ? `Ход ${e.turn}` : 'Старт'}</span>
                    {e.text}
                  </li>
                ))}
            </ol>
          </details>
        </Board>
        <Players state={s} players={split ? s.players.slice(2) : s.players} side="right" />
      </div>
    </main>
  );
}
