import { test, expect, type Page } from '@playwright/test';
import { ready, give } from '../helpers';
import { serialize } from '../../src/persistence/SaveManager';
const key = 'estate-local.current.v1';
async function setDice(page: Page, a: number, b: number) {
  const details = page.locator('.dev-panel');
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  await page.getByLabel('Dev кубик 1').fill(String(a));
  await page.getByLabel('Dev кубик 2').fill(String(b));
  const revision = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).gameState.revision,
    key,
  );
  await page.getByRole('button', { name: 'Задать кубики', exact: true }).click();
  await page.waitForFunction(
    ({ key, revision }) => JSON.parse(localStorage.getItem(key)!).gameState.revision > revision,
    { key, revision },
  );
}
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Новая игра/ }).click();
  await page.getByLabel('Имя игрока 1').fill('Яков');
  await page.getByLabel('Имя игрока 2').fill('Лена');
  await page.getByRole('button', { name: /Начать игру/ }).click();
  await setDice(page, 6, 5);
  await page.getByRole('button', { name: /Бросить для очередности/ }).click();
  await setDice(page, 1, 2);
  await page.getByRole('button', { name: /Бросить для очередности/ }).click();
  await expect(page.getByRole('button', { name: /Бросить кубики/ })).toBeVisible();
}
test('creates a game, buys property, changes turn and restores a save', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.screenshot({ path: 'test-results/menu.png', fullPage: true });
  await start(page);
  await setDice(page, 1, 2);
  await page.getByRole('button', { name: /Бросить кубики/ }).click();
  await expect(page.getByRole('button', { name: 'Купить за $60' })).toBeVisible();
  await page.getByRole('button', { name: 'Купить за $60' }).click();
  await expect(page.getByRole('button', { name: /Садовая улица, владелец Яков/ })).toBeVisible();
  await page.getByRole('button', { name: /Завершить ход/ }).click();
  await expect(page.locator('.acting-label')).toContainText('Лена');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Продолжить партию' }).click();
  await expect(page.locator('.acting-label')).toContainText('Лена');
  await expect(page.getByRole('button', { name: /Садовая улица, владелец Яков/ })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/game.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('runs an auction and a trade entirely through the UI', async ({ page }) => {
  await start(page);
  await setDice(page, 1, 2);
  await page.getByRole('button', { name: /Бросить кубики/ }).click();
  await page.getByRole('button', { name: 'На аукцион', exact: true }).click();
  await page.getByLabel('Ваша ставка').fill('20');
  await page.getByRole('button', { name: /Сделать ставку/ }).click();
  await page.getByRole('button', { name: 'Выйти из аукциона' }).click();
  await expect(page.getByRole('button', { name: /Садовая улица, владелец Яков/ })).toBeVisible();
  await page.getByRole('button', { name: /⇄ Обмен/ }).click();
  await page.getByLabel('Я отдаю: деньги').fill('100');
  await page.getByRole('button', { name: /Предложить обмен/ }).click();
  await expect(page.locator('.acting-label')).toContainText('Лена');
  await page.getByRole('button', { name: 'Принять обмен', exact: true }).click();
  await expect(page.locator('.player-card').filter({ hasText: 'Лена' })).toContainText('$1 600');
});
test('supports four players and property details on a smaller screen', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Новая игра/ }).click();
  await page.getByRole('button', { name: '4 игрока' }).click();
  await page.getByRole('button', { name: /Начать игру/ }).click();
  await expect(page.locator('.player-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Житная улица', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('С гостиницей');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('uses pastel streets, outward flags and direct property actions with four players', async ({
  page,
}) => {
  const state = ready(4);
  give(state, 'p1', 1, 3, 21);
  give(state, 'p2', 11);
  give(state, 'p3', 31);
  give(state, 'p4', 6);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key,
    value: serialize(state),
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить партию' }).click();
  await expect(page.locator('.players-left .player-card')).toHaveCount(2);
  await expect(page.locator('.players-right .player-card')).toHaveCount(2);
  await expect(
    page.locator('[data-board-center]').getByRole('button', { name: /Бросить кубики/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Имущество/ })).toHaveCount(0);
  const backgrounds = await page
    .locator('[data-space="1"], [data-space="3"], [data-space="21"]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
  expect(backgrounds[0]).toBe(backgrounds[1]);
  expect(backgrounds[0]).not.toBe(backgrounds[2]);
  for (const [id, edge] of [
    [1, 'bottom'],
    [11, 'left'],
    [21, 'top'],
    [31, 'right'],
  ] as const) {
    const tile = await page.locator(`[data-space="${id}"]`).boundingBox();
    const flag = await page.locator(`[data-space="${id}"] [data-edge="${edge}"]`).boundingBox();
    expect(tile).not.toBeNull();
    expect(flag).not.toBeNull();
    if (edge === 'top') expect(flag!.y + flag!.height).toBeLessThanOrEqual(tile!.y + 1);
    if (edge === 'bottom') expect(flag!.y).toBeGreaterThanOrEqual(tile!.y + tile!.height - 1);
    if (edge === 'left') expect(flag!.x + flag!.width).toBeLessThanOrEqual(tile!.x + 1);
    if (edge === 'right') expect(flag!.x).toBeGreaterThanOrEqual(tile!.x + tile!.width - 1);
  }
  await page.getByRole('button', { name: 'Скрыть сообщение' }).click();
  await page.screenshot({ path: 'test-results/four-player-table.png', fullPage: true });
  await page.getByRole('button', { name: /Житная улица, владелец Яков/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Построить дом/ }).click();
  await expect(dialog).toContainText('Домов: 1');
  await dialog.getByRole('button', { name: /Продать здание/ }).click();
  await dialog.getByRole('button', { name: /^Заложить/ }).click();
  await expect(dialog).toContainText('в залоге');
  await expect(dialog.getByRole('button', { name: /Снять залог/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/property-actions.png', fullPage: true });
});

test('cycles dice for a second before smoothly moving the existing token', async ({ page }) => {
  await start(page);
  await setDice(page, 1, 2);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const token = page.locator('[data-token="p1"]');
  await expect(token).toHaveAttribute('data-position', '0');
  await page.getByRole('button', { name: /Бросить кубики/ }).click();
  await expect(page.locator('.central-dice .dice-pair')).toHaveAttribute('data-rolling', 'true');
  await expect(token).toHaveAttribute('data-position', '0');
  await expect(page.locator('.central-dice .dice-pair')).toHaveAttribute('data-rolling', 'false');
  await expect(page.locator('.central-dice .die').first()).toHaveAttribute('data-value', '1');
  await expect(page.locator('.central-dice .die').last()).toHaveAttribute('data-value', '2');
  expect(await token.evaluate((el) => getComputedStyle(el).transitionDuration)).toContain('0.32s');
  await expect(token).toHaveAttribute('data-position', '3');
  await expect(page.getByRole('button', { name: 'Купить за $60' })).toBeVisible();
});
