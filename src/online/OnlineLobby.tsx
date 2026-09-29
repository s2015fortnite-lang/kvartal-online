import { useState } from 'react';
import type { GameController, OnlineState } from '../controller/GameController';

export function OnlineLobby({
  controller,
  online,
  initialCode,
  onClose,
}: {
  controller: GameController;
  online: OnlineState | null;
  initialCode: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [copied, setCopied] = useState(false);
  const room = online?.room;
  const link = room ? `${location.origin}/game/${room.code}` : '';
  const returning = !!code && !!controller.token(code);
  return (
    <main className="online-lobby">
      <div className="eyebrow">КВАРТАЛ · С ДРУЗЬЯМИ ОНЛАЙН</div>
      <h1>{room ? 'Все собираются за столом.' : 'Встретимся в своём квартале.'}</h1>
      {room ? (
        <>
          <p>Отправьте ссылку друзьям. Можно начать, когда в комнате от двух до четырёх игроков.</p>
          <label>
            Ссылка-приглашение
            <input
              aria-label="Ссылка-приглашение"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Ссылка скопирована' : 'Копировать ссылку'}
          </button>
          <ul className="lobby-players">
            {room.seats.map((p) => (
              <li key={p.id}>
                <span style={{ color: p.color }}>{p.token}</span>
                <strong>
                  {p.name}
                  {p.id === online.playerId ? ' · вы' : ''}
                </strong>
                <small>
                  {p.connected ? 'В комнате' : 'Нет связи'}
                  {p.id === room.host ? ' · создатель' : ''}
                </small>
              </li>
            ))}
          </ul>
          {room.host === online.playerId ? (
            <button
              className="primary large"
              disabled={
                online.pending ||
                online.status !== 'connected' ||
                room.seats.length < 2 ||
                room.seats.some((p) => !p.connected)
              }
              onClick={() => void controller.startOnline()}
            >
              Начать сетевую игру ↗
            </button>
          ) : (
            <p className="muted">Ждём, когда создатель комнаты начнёт игру.</p>
          )}
          <p className="muted small">
            Цвет и фишка назначаются по порядку входа. Вернуться на своё место можно по этой ссылке
            в том же браузере.
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            controller.connectOnline(name.trim(), code || undefined);
          }}
        >
          <p>Создайте комнату или введите код приглашения. Каждый играет со своего устройства.</p>
          {!returning && (
            <label>
              Ваше имя
              <input
                required
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Как вас зовут?"
                autoComplete="nickname"
              />
            </label>
          )}
          <label>
            Код комнаты · оставьте пустым для новой
            <input
              value={code}
              maxLength={10}
              pattern="[A-Z0-9]{10}"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="Код из ссылки друга"
            />
          </label>
          <button className="primary large" disabled={online?.status === 'connecting'}>
            {online?.status === 'connecting'
              ? 'Подключаемся…'
              : returning
                ? 'Вернуться в комнату ↗'
                : code
                  ? 'Войти в комнату ↗'
                  : 'Создать комнату ↗'}
          </button>
        </form>
      )}
      {online && (
        <p role="status" className="muted small">
          {online.status === 'connected'
            ? 'Подключено к серверу'
            : online.status === 'connecting'
              ? 'Восстанавливаем соединение…'
              : 'Соединение прервано'}
        </p>
      )}
      <button className="text-button" onClick={onClose}>
        В главное меню
      </button>
    </main>
  );
}
