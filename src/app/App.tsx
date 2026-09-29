import { OnlineLobby } from '../online/OnlineLobby';
import '../online/online.css';
import { lazy, Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import { GameController } from '../controller/GameController';
import { Setup } from '../features/setup/Setup';
import { GameView } from '../features/board/GameView';
import { Dice } from '../features/turn/Dice';
import { PropertyCard } from '../features/property/Property';
import { TradeEditor } from '../features/trade/Trade';
import { usePresentation } from '../features/animation/usePresentation';
import { actingPlayer } from '../game/state/selectors';
const DevPanel = import.meta.env.DEV ? lazy(() => import('../features/devtools/DevPanel')) : null;
export default function App() {
  const controller = useMemo(() => new GameController(localStorage), []);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot),
    s = snapshot.state;
  const [setup, setSetup] = useState(false),
    [property, setProperty] = useState<number | null>(null),
    [trade, setTrade] = useState(false),
    [rules, setRules] = useState(false);
  const presentation = usePresentation(s, snapshot.events);
  const actor = snapshot.online?.playerId ?? (s ? actingPlayer(s) : '');
  const [onlineScreen, setOnlineScreen] = useState(() => location.pathname.startsWith('/game/'));
  const [roomCode, setRoomCode] = useState(
    () => location.pathname.match(/^\/game\/([A-Z0-9]{10})/i)?.[1].toUpperCase() ?? '',
  );
  let hasSave = false;
  try {
    hasSave = controller.saves.exists();
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  const menu = () => {
    setProperty(null);
    setTrade(false);
    controller.menu();
    setOnlineScreen(false);
    history.replaceState(null, '', '/');
  };
  return (
    <>
      <header className="topbar">
        <button className="wordmark" onClick={menu}>
          <span className="brand-icon">▥</span> КВАРТАЛ<span className="wordmark-dot">.</span>
        </button>
        <span className="header-note">НАСТОЛЬНАЯ КЛАССИКА · ВАШИ ПРАВИЛА УСПЕХА</span>
        {!s && (
          <nav>
            <button onClick={() => setRules(!rules)}>
              Как играть <span>↗</span>
            </button>
          </nav>
        )}
      </header>
      {(snapshot.error || snapshot.notice) && (
        <div
          className={`toast ${snapshot.error ? 'error' : ''}`}
          role={snapshot.error ? 'alert' : 'status'}
        >
          <span>{snapshot.error ?? snapshot.notice}</span>
          <button aria-label="Скрыть сообщение" onClick={() => controller.clearMessage()}>
            ×
          </button>
        </div>
      )}
      {rules && (
        <section className="rules-panel">
          <button
            className="icon-button"
            onClick={() => setRules(false)}
            aria-label="Закрыть правила"
          >
            ×
          </button>
          <h2>Один город. Много возможностей.</h2>
          <p>
            Покупайте улицы, собирайте цветовые группы, стройте равномерно и получайте аренду. Отказ
            от покупки запускает аукцион. Дубль даёт дополнительный бросок, три дубля подряд
            отправляют в тюрьму.
          </p>
          <p>
            Если не хватает денег, продайте здания, заложите объекты или предложите обмен. Побеждает
            последний игрок, который не стал банкротом. Свободная парковка ничего не выплачивает. На
            экране всегда указано, кто действует сейчас.
          </p>
          <p>
            Банк: 32 дома и 12 гостиниц. Здания продаются за половину цены. Снятие залога — номинал
            + 10%. Получатель залога также платит процент. Налоги: $200 и $100.
          </p>
          <p className="muted small">
            Цифровые соглашения: автоматическая аренда; аукцион по очереди с окончательным выходом;
            минимальное повышение $1; платежи нескольким игрокам — по очереди. Порядок начала
            определяется бросками.
          </p>
        </section>
      )}
      {!s && (onlineScreen || snapshot.online) ? (
        <OnlineLobby
          controller={controller}
          online={snapshot.online}
          initialCode={roomCode}
          onClose={menu}
        />
      ) : !s ? (
        <main className="landing">
          <section className="hero-copy">
            <div className="eyebrow">
              <i className="status-dot" /> 2–4 ИГРОКА · РЯДОМ ИЛИ ОНЛАЙН
            </div>
            <h1>Квартал</h1>
            <p className="hero-subtitle">
              Большие планы.
              <br />
              <em>Хорошая компания.</em>
            </p>
            <p className="hero-description">
              Покупайте улицы, заключайте сделки
              <br />и постройте свой маленький городской успех.
            </p>
            <div className="hero-buttons">
              <button
                className="primary large"
                onClick={() => {
                  setRoomCode('');
                  setOnlineScreen(true);
                }}
              >
                Играть онлайн ↗
              </button>
              {controller.lastRoom() && (
                <button
                  onClick={() => {
                    setRoomCode(controller.lastRoom()!);
                    setOnlineScreen(true);
                  }}
                >
                  Вернуться в сетевую игру
                </button>
              )}
              <button className="primary large" onClick={() => setSetup(true)}>
                Новая игра <span>↗</span>
              </button>
              {hasSave && (
                <button className="large" onClick={() => controller.load()}>
                  Продолжить партию
                </button>
              )}
            </div>
            <div className="hero-meta">
              <span>Без регистрации</span>
              <i /> <span>Без ботов</span>
              <i /> <span>По ссылке с друзьями</span>
            </div>
          </section>
          <section className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-label">СОБЕРИТЕ СВОЙ ГОРОД</div>
            <div className="building b-one">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="building b-two">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="building b-three">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="art-street">
              НАБЕРЕЖНАЯ <strong>$120</strong>
            </div>
            <div className="art-token">◆</div>
            <div className="art-dice">
              <Dice values={[3, 5]} />
            </div>
            <span className="art-note">
              Ваш следующий ход
              <br />
              может изменить всё.
            </span>
          </section>
          <div className="landing-bottom">
            <span>01 / КЛАССИЧЕСКАЯ ПАРТИЯ</span>
            <span>40 КЛЕТОК · БЕСКОНЕЧНО МНОГО ИСТОРИЙ</span>
          </div>
        </main>
      ) : (
        <GameView
          state={s}
          controller={controller}
          events={snapshot.events}
          presentation={presentation}
          onSpace={setProperty}
          onTrade={() => setTrade(true)}
          onNew={() => {
            menu();
            setSetup(true);
          }}
          onMenu={menu}
          onRules={() => setRules(!rules)}
        />
      )}
      {s && DevPanel && !snapshot.online && !s.winner && (
        <div className="dev-wrapper" inert={presentation.busy}>
          <Suspense>
            <DevPanel state={s} controller={controller} />
          </Suspense>
        </div>
      )}
      <footer className="footer">
        <span>КВАРТАЛ · ИГРА ДЛЯ СВОИХ</span>
        <span>Планы меняются. Компания остаётся.</span>
      </footer>
      {setup && (
        <Setup
          onClose={() => setSetup(false)}
          onStart={(players) => {
            controller.start(players);
            if (controller.getSnapshot().state) setSetup(false);
          }}
        />
      )}
      {s && property !== null && (
        <PropertyCard
          state={s}
          id={property}
          controller={controller}
          onClose={() => setProperty(null)}
        />
      )}
      {s && trade && (
        <TradeEditor
          state={s}
          controller={controller}
          actor={actor}
          onClose={() => setTrade(false)}
        />
      )}
    </>
  );
}
