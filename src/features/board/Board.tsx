import type { PublicGameState } from '../../online/protocol';
import type { CSSProperties, ReactNode } from 'react';
import type { Space } from '../../game/state/types';
import { player } from '../../game/state/selectors';
import styles from './Board.module.css';
export function coordinates(id: number): CSSProperties {
  if (id <= 10) return { gridRow: 11, gridColumn: 11 - id };
  if (id <= 20) return { gridRow: 21 - id, gridColumn: 1 };
  if (id <= 30) return { gridRow: 1, gridColumn: id - 19 };
  return { gridRow: id - 29, gridColumn: 11 };
}
const symbols: Partial<Record<Space['type'], string>> = {
  GO: '↖',
  JAIL: '▤',
  PARKING: 'P',
  GO_TO_JAIL: '↳',
  CHANCE: '?',
  CHEST: '✧',
  TAX: '$',
  RAILROAD: '↔',
  UTILITY: '◉',
};
export function Board({
  state,
  onSpace,
  positions,
  children,
  busy = false,
}: {
  state: PublicGameState;
  onSpace: (id: number) => void;
  positions: Record<string, number>;
  children: ReactNode;
  busy?: boolean;
}) {
  const activePosition =
    positions[state.currentPlayerId] ?? player(state, state.currentPlayerId).position;
  return (
    <div className={styles.scroll}>
      <div className={styles.board} aria-label="Игровое поле, 40 клеток">
        {state.board.spaces.map((t) => {
          const prop = state.properties[t.id],
            owner = prop?.owner ? player(state, prop.owner) : null,
            corner = t.id % 10 === 0;
          const edge = t.id < 10 ? 'bottom' : t.id < 20 ? 'left' : t.id < 30 ? 'top' : 'right';
          return (
            <button
              key={t.id}
              data-space={t.id}
              data-group={t.group}
              disabled={busy}
              style={
                {
                  ...coordinates(t.id),
                  '--group': t.color ?? '#dedccf',
                  '--owner': owner?.color ?? 'transparent',
                  '--flag-ink': owner ? flagInk(owner.color) : '#fff',
                } as CSSProperties
              }
              className={`${styles.space} ${t.type === 'PROPERTY' ? styles.street : ''} ${corner ? styles.corner : ''} ${activePosition === t.id ? styles.active : ''} ${prop?.mortgaged ? styles.mortgaged : ''}`}
              onClick={() => onSpace(t.id)}
              aria-label={`${t.name}${owner ? `, владелец ${owner.name}` : ''}${prop?.level ? `, ${prop.level === 5 ? 'гостиница' : `${prop.level} дома`}` : ''}`}
            >
              {t.type === 'PROPERTY' ? (
                <span className={styles.buildings}>
                  {prop?.level ? (prop.level === 5 ? '▣' : '⌂'.repeat(prop.level)) : ''}
                </span>
              ) : (
                <span className={styles.symbol}>{symbols[t.type]}</span>
              )}
              <span className={styles.name}>{t.name}</span>
              <span className={styles.price}>
                {prop?.mortgaged
                  ? 'ЗАЛОГ'
                  : t.price
                    ? `$${t.price}`
                    : t.tax
                      ? `−$${t.tax}`
                      : t.type === 'GO'
                        ? '+$200'
                        : ''}
              </span>
              {owner && (
                <span
                  className={`${styles.flag} ${styles[edge]}`}
                  data-owner={owner.id}
                  data-edge={edge}
                  aria-label={`Владелец: ${owner.name}`}
                  title={`Владелец: ${owner.name}`}
                >
                  <b>{owner.token}</b>
                </span>
              )}
            </button>
          );
        })}
        <div className={styles.center} data-board-center>
          {children}
        </div>
        {state.players
          .filter((p) => !p.bankrupt)
          .map((p) => {
            const index = state.players.findIndex((q) => q.id === p.id),
              position = positions[p.id] ?? p.position;
            return (
              <span
                key={p.id}
                className={styles.token}
                data-token={p.id}
                data-position={position}
                title={p.name}
                style={{
                  ...tokenCoordinates(position),
                  background: p.color,
                  color: flagInk(p.color),
                  marginLeft: (index - 1.5) * 12,
                }}
              >
                {p.token}
              </span>
            );
          })}
      </div>
    </div>
  );
}

export function tokenCoordinates(id: number): CSSProperties {
  const { gridRow, gridColumn } = coordinates(id);
  const center = (n: number) => (100 * (n === 1 ? 0.625 : n === 11 ? 10.875 : n - 0.25)) / 11.5;
  return { left: `${center(Number(gridColumn))}%`, top: `${center(Number(gridRow)) + 2.3}%` };
}
function flagInk(hex: string) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 155 ? '#20352b' : '#fff';
}
