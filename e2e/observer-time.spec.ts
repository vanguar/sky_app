import { expect, test, type Locator, type Page } from '@playwright/test';
import { seedSettings, waitForSky } from './helpers';

test.use({ timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });
const NOW = new Date('2026-10-15T12:00:00Z');
const SYDNEY = { latitude: -33.87, longitude: 151.21, elevation: 0 };

/** Value cell of a details fact row, matched by its exact label. */
function fact(card: Locator, label: string): Locator {
  return card
    .locator('.fact')
    .filter({ has: card.page().getByText(label, { exact: true }) })
    .locator('dd');
}

async function setLocation(page: Page, latitude: number, longitude: number) {
  await page.getByTestId('location-chip').click();
  await page.getByTestId('enter-manually').click();
  await page.getByTestId('lat-input').fill(String(latitude));
  await page.getByTestId('lon-input').fill(String(longitude));
  await page.getByTestId('apply-location').click();
}

for (const weatherEnabled of [false, true]) {
  test(`remote observer times agree in the clock, card and navigator (${weatherEnabled ? 'provider zone' : 'approximate zone'})`, async ({
    page,
  }) => {
    await page.clock.setFixedTime(NOW);
    await seedSettings(page, { weatherEnabled });
    await page.route('https://api.open-meteo.com/**', (route) =>
      route.fulfill({
        json: {
          timezone: 'Australia/Sydney',
          utc_offset_seconds: 39600,
          hourly: { time: Array.from({ length: 48 }, (_, i) => NOW.getTime() / 1000 + i * 3600) },
        },
      }),
    );
    await page.goto('./');
    await waitForSky(page);
    await setLocation(page, SYDNEY.latitude, SYDNEY.longitude);
    if (weatherEnabled) {
      await page.getByTestId('open-tonight').click();
      await expect(page.getByTestId('weather-age')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    const timeZone = weatherEnabled ? 'Australia/Sydney' : 'Etc/GMT-10';
    const clock = new Intl.DateTimeFormat('en', { timeZone, hour: '2-digit', minute: '2-digit' });
    await expect(page.locator('.time-chip')).toHaveText(clock.format(NOW));
    await page.evaluate(() => {
      location.hash = '#/object/sun';
    });
    const card = page.getByTestId('object-details');
    await expect(card).toBeVisible();
    // Sunrise fixture for Sydney on 16 October (15 October UTC), independently of UI formatting.
    const rise = new Date('2026-10-15T19:13:06.925Z');
    const expectedRise = new Intl.DateTimeFormat('en', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(rise);
    await expect(fact(card, 'Next rise')).toHaveText(expectedRise);
    if (!weatherEnabled) await expect(card.getByTestId('tz-note')).toContainText('UTC+10');
    await card.getByTestId('details-find').click();
    await expect(page.getByTestId('navigator-below')).toContainText(expectedRise);
    if (!weatherEnabled)
      await expect(page.getByTestId('navigator').getByTestId('tz-note')).toContainText('UTC+10');
  });
}

test('lunar events remain visible near the circumpolar boundary', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-05T00:00:00Z'));
  await seedSettings(page);
  await page.goto('./');
  await waitForSky(page);
  await setLocation(page, 70, 20);
  await page.evaluate(() => {
    location.hash = '#/object/moon';
  });
  const card = page.getByTestId('object-details');
  await expect(fact(card, 'Next rise')).toHaveText('10:20 PM');
  await expect(fact(card, 'Next set')).toHaveText('07:20 PM');
  await expect(card.getByTestId('details-visibility')).not.toContainText('Always');
});
