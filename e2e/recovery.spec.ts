import { expect, test } from '@playwright/test';
import { seedSettings, waitForSky } from './helpers';

test.beforeEach(async ({ page }) => {
  await seedSettings(page);
  await page.goto('./');
  await waitForSky(page);
});

test('restores the sky UI after repeated WebGL context loss', async ({ page }) => {
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.sky-canvas')!;
      const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
      (window as unknown as { restoreSky: () => void }).restoreSky = () => extension.restoreContext();
      extension.loseContext();
    });
    await expect(page.locator('.sky-error')).toBeVisible();
    await page.evaluate(() => (window as unknown as { restoreSky: () => void }).restoreSky());
    await expect(page.locator('.sky-error')).toBeHidden();
    await expect(page.getByTestId('sky-view')).toBeVisible();
  }
});

test('retry recreates a lost renderer with its current catalog and filters', async ({ page }) => {
  await page.getByTestId('filter-planets').click();
  await page.evaluate(() => {
    document
      .querySelector<HTMLCanvasElement>('canvas.sky-canvas')!
      .getContext('webgl2')!
      .getExtension('WEBGL_lose_context')!
      .loseContext();
  });
  await page.locator('.sky-error').getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.sky-error')).toBeHidden();
  await waitForSky(page);
  await expect(page.locator('canvas.sky-canvas')).toHaveCount(1);
  await expect(page.getByTestId('filter-planets')).toHaveAttribute('aria-checked', 'true');
});

test('root, unknown object and Back/Forward agree with the displayed card', async ({ page }) => {
  await page.goto('./#/object/mars');
  const card = page.getByTestId('object-details');
  await expect(card).toBeVisible();
  await page.evaluate(() => {
    location.hash = '#/';
  });
  await expect(card).toBeHidden();
  await page.goBack();
  await expect(card.getByRole('heading', { name: 'Mars' })).toBeVisible();
  await page.goForward();
  await expect(card).toBeHidden();
  await page.evaluate(() => {
    location.hash = '#/object/jupiter';
  });
  await expect(card.getByRole('heading', { name: 'Jupiter' })).toBeVisible();
  await page.evaluate(() => {
    location.hash = '#/object/nonexistent';
  });
  await expect(card).toBeHidden();
  await expect(page).toHaveURL(/#\/$/);
});

test('modal search traps Tab and Shift+Tab, blocks background and restores focus', async ({ page }) => {
  const opener = page.getByTestId('open-search');
  await opener.click();
  const sheet = page.getByTestId('search-sheet');
  await expect(page.getByTestId('search-input')).toBeFocused();
  const buttons = sheet.locator('button,input');
  await buttons.last().focus();
  await page.keyboard.press('Tab');
  await expect(buttons.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(buttons.last()).toBeFocused();
  expect(await page.getByTestId('sky-view').evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.getByTestId('sky-view').evaluate((element) => (element as HTMLElement).inert)).toBe(
    false,
  );
});

test('3D dialog traps focus and returns it to the object card', async ({ page }) => {
  await page.goto('./#/object/mars');
  const opener = page.getByTestId('details-3d');
  await opener.click();
  const dialog = page.getByTestId('planet-3d');
  await expect(dialog).toHaveAttribute('data-status', 'ready');
  await dialog.locator('button').last().focus();
  await page.keyboard.press('Tab');
  await expect(dialog.locator('button').first()).toBeFocused();
  expect(await page.getByTestId('object-details').evaluate((element) => (element as HTMLElement).inert)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('onboarding keeps focus across its steps', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.removeItem('astropoint.settings');
  });
  await page.reload();
  const dialog = page.getByTestId('onboarding');
  await expect(dialog).toBeVisible();
  await dialog.locator('button').last().focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="onboarding"]'))).toBe(
    true,
  );
  await page.getByTestId('onboarding-start').click();
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="onboarding"]'))).toBe(
    true,
  );
});
