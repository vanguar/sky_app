import { expect, test } from '@playwright/test';
import { seedSettings, waitForSky } from './helpers';

test('map, deep links and multilingual search work in a mobile browser', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./#/object/mars');
  await waitForSky(page);
  await expect(page.getByTestId('object-details')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('open-search').click();
  await page.getByTestId('search-input').fill('Юпитер');
  await page.getByTestId('result-jupiter').click();
  await expect(page.getByTestId('object-details')).toContainText('Jupiter');
  await expect(page).toHaveURL(/#\/object\/jupiter$/);
  await page.keyboard.press('Escape');
  await page.getByTestId('open-settings').click();
  await page.getByTestId('language-select').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await waitForSky(page);
});
