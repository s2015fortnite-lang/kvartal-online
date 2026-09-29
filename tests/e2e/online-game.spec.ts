import { test, expect, type Page } from '@playwright/test';
import type { ServerMessage, PublicGameState } from '../../src/online/protocol';

test('two separate browsers play, trade, disconnect and resume the same server game', async ({
  page: host,
  browser,
}) => {
  const guestContext = await browser.newContext({
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  });
  const guest = await guestContext.newPage();
  const states = new Map<Page, PublicGameState>();
  const errors: string[] = [];
  for (const page of [host, guest]) {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('websocket', (socket) =>
      socket.on('framereceived', (frame) => {
        const m = JSON.parse(frame.payload.toString()) as ServerMessage;
        if (m.type === 'SNAPSHOT' && m.state) {
          expect(m.state).not.toHaveProperty('random');
          expect(m.state).not.toHaveProperty('decks');
          states.set(page, m.state);
        }
      }),
    );
  }
  await host.goto('/');
  await host.getByRole('button', { name: /Играть онлайн/ }).click();
  await host.getByLabel('Ваше имя').fill('Аня');
  await host.getByRole('button', { name: /Создать комнату/ }).click();
  const link = host.getByLabel('Ссылка-приглашение');
  await expect(link).toBeVisible();
  await guest.goto(await link.inputValue());
  await guest.getByLabel('Ваше имя').fill('Борис');
  await guest.getByRole('button', { name: /Войти в комнату/ }).click();
  await expect(host.locator('.lobby-players li')).toHaveCount(2);
  await host.screenshot({ path: 'test-results/online/lobby.png', fullPage: true });
  await host.getByRole('button', { name: /Начать сетевую игру/ }).click();
  await expect(guest.locator('.player-card')).toHaveCount(2);
  await expect(guest.getByRole('button', { name: /Бросить для очередности/ })).toHaveCount(0);
  await expect(host.locator('.dev-panel')).toHaveCount(0);
  for (let turn = 0; turn < 30 && states.get(host)?.phase.kind === 'ORDER'; turn++) {
    const state = states.get(host)!;
    if (state.phase.kind !== 'ORDER') break;
    const page = state.phase.actor === 'p1' ? host : guest;
    await page.getByRole('button', { name: /Бросить для очередности/ }).click();
    await expect.poll(() => states.get(host)?.revision).toBeGreaterThan(state.revision);
    await expect.poll(() => states.get(guest)?.revision).toBe(states.get(host)!.revision);
  }
  expect(states.get(host)?.phase.kind).toBe('ROLL');
  // A gift requires a real response from the other browser.
  await host.getByRole('button', { name: /⇄ Обмен/ }).click();
  await host.getByLabel('Я отдаю: деньги').fill('100');
  await host.getByRole('button', { name: /Предложить обмен/ }).click();
  await expect(guest.getByRole('button', { name: 'Принять обмен', exact: true })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Принять обмен', exact: true })).toHaveCount(0);
  await guest.getByRole('button', { name: 'Принять обмен', exact: true }).click();
  await expect(host.locator('.player-card').filter({ hasText: 'Борис' })).toContainText('$1 600');
  const before = states.get(host)!;
  const active = before.currentPlayerId === 'p1' ? host : guest;
  await active.getByRole('button', { name: /Бросить кубики/ }).click();
  await expect.poll(() => states.get(host)?.revision).toBeGreaterThan(before.revision);
  await expect.poll(() => states.get(guest)?.revision).toBe(states.get(host)!.revision);
  expect(states.get(host)).toEqual(states.get(guest));
  await guestContext.setOffline(true);
  await guest.reload().catch(() => {});
  await guestContext.setOffline(false);
  await guest.goto(await host.evaluate(() => location.href));
  await guest.getByRole('button', { name: /Вернуться в комнату/ }).click();
  await expect(guest.locator('.network-note')).toContainText('Вы — Борис');
  expect(states.get(guest)).toEqual(states.get(host));
  await host.screenshot({ path: 'test-results/online/game.png', fullPage: true });
  expect(errors).toEqual([]);
  await guestContext.close();
});
