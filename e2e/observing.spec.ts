import { expect, test, type Page } from '@playwright/test';
import { seedSettings, waitForSky } from './helpers';

/**
 * Observing conditions (weather) and meteor showers. Time is fixed to the night of the 2026
 * Orionid maximum (22:00 in Kyiv); the Open-Meteo API is mocked — no real network calls.
 */
const NOW = new Date('2026-10-21T19:00:00Z');
const OPEN_METEO = 'https://api.open-meteo.com/**';

function mockForecast(): Record<string, unknown> {
  const start = Date.UTC(2026, 9, 21, 0) / 1000;
  const n = 72;
  const time = Array.from({ length: n }, (_, i) => start + i * 3600);
  const fill = (v: number) => Array.from({ length: n }, () => v);
  return {
    latitude: 50.45,
    longitude: 30.5,
    timezone: 'Europe/Kyiv',
    utc_offset_seconds: 10800,
    hourly: {
      time,
      cloud_cover: fill(18),
      cloud_cover_low: fill(5),
      cloud_cover_mid: fill(5),
      cloud_cover_high: fill(15),
      visibility: fill(22000),
      relative_humidity_2m: fill(63),
      dew_point_2m: fill(2),
      precipitation_probability: fill(0),
      precipitation: fill(0),
      weather_code: fill(1),
      wind_speed_10m: fill(7),
      wind_gusts_10m: fill(15),
      temperature_2m: fill(9),
    },
  };
}

async function mockWeatherOk(page: Page) {
  const requests: string[] = [];
  await page.route(OPEN_METEO, (route) => {
    requests.push(route.request().url());
    return route.fulfill({ json: mockForecast() });
  });
  return requests;
}

async function start(page: Page, settings: Record<string, unknown> = {}) {
  await page.clock.setFixedTime(NOW);
  await seedSettings(page, settings);
  await page.goto('./');
  await waitForSky(page);
}

test.describe('observing conditions (weather)', () => {
  test('asks before sending coordinates, then shows score, clouds, humidity and best window', async ({ page }) => {
    const requests = await mockWeatherOk(page);
    await start(page);
    await page.getByTestId('open-tonight').click();
    await page.getByTestId('tonight-open-weather').click();
    const sheet = page.getByTestId('weather-sheet');
    await expect(sheet.getByTestId('weather-consent')).toBeVisible();
    expect(requests).toHaveLength(0); // nothing leaves the device before consent
    await sheet.getByTestId('weather-consent-accept').click();
    await expect(sheet.getByTestId('weather-grade')).toBeVisible();
    await expect(sheet.getByTestId('wx-cloud')).toHaveText('18%');
    await expect(sheet.getByTestId('wx-humidity')).toHaveText('63%');
    await expect(sheet.getByTestId('weather-score')).toContainText('/100');
    await expect(sheet.getByTestId('weather-reasons')).toContainText('cloud');
    await expect(sheet.getByTestId('best-window')).toBeVisible();
    await expect(sheet.getByTestId('hourly-strip').locator('li')).toHaveCount(24);
    await expect(sheet).toContainText('Open-Meteo');
    // Only rounded coordinates were sent (seeded exact location 50.45, 30.52).
    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]);
    expect(url.searchParams.get('latitude')).toBe('50.45');
    expect(url.searchParams.get('longitude')).toBe('30.5');
  });

  test('weather API failure: the app keeps working', async ({ page }) => {
    await page.route(OPEN_METEO, (route) => route.abort('failed'));
    await start(page, { weatherEnabled: true });
    await page.getByTestId('open-tonight').click();
    await page.getByTestId('tonight-open-weather').click();
    await expect(page.getByTestId('weather-unavailable')).toBeVisible();
    await page.getByTestId('weather-sheet').getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('open-search').click();
    await page.getByTestId('search-input').fill('Jupiter');
    await expect(page.getByTestId('result-jupiter')).toBeVisible();
  });

  test('shows the cached forecast as "last forecast" when a refresh fails', async ({ page }) => {
    await mockWeatherOk(page);
    await start(page, { weatherEnabled: true });
    await page.getByTestId('open-tonight').click();
    await page.getByTestId('tonight-open-weather').click();
    await expect(page.getByTestId('wx-cloud')).toHaveText('18%');
    // Two hours later, the provider is down.
    await page.unroute(OPEN_METEO);
    await page.route(OPEN_METEO, (route) => route.fulfill({ status: 503, body: 'down' }));
    await page.clock.setFixedTime(new Date(NOW.getTime() + 2 * 3600_000));
    await page.reload();
    await waitForSky(page);
    await page.getByTestId('open-tonight').click();
    await page.getByTestId('tonight-open-weather').click();
    const sheet = page.getByTestId('weather-sheet');
    await expect(sheet.getByTestId('weather-refresh-failed')).toBeVisible();
    await expect(sheet.getByTestId('weather-age')).toContainText('Last forecast');
    await expect(sheet.getByTestId('weather-age')).toContainText('2 h');
    await expect(sheet.getByTestId('wx-cloud')).toHaveText('18%');
  });
});

test.describe('meteor showers', () => {
  test('tonight screen → active shower card → find radiant', async ({ page }) => {
    await mockWeatherOk(page);
    await start(page, { weatherEnabled: true });
    await page.getByTestId('open-tonight').click();
    const tonight = page.getByTestId('tonight-sheet');
    await expect(tonight.getByTestId('tonight-showers')).toContainText('Orionids');
    await tonight.getByTestId('tonight-shower-ori').click();

    const card = page.getByTestId('meteor-sheet');
    await expect(card.getByRole('heading', { name: 'Orionids' })).toBeVisible();
    await expect(card.getByTestId('meteor-status')).toHaveText('At peak');
    await expect(card.getByTestId('meteor-activity')).toContainText('Oct');
    await expect(card.getByTestId('meteor-zhr')).toHaveText('up to ~20 under ideal conditions');
    await expect(card.getByTestId('meteor-zhr-explain')).toContainText('not a promise');
    await expect(card.getByTestId('meteor-radiant-now')).toBeVisible();
    await expect(card.getByTestId('meteor-moon')).toContainText('%');
    await expect(card.getByTestId('meteor-moon-impact')).toBeVisible();
    await expect(card.getByTestId('meteor-grade')).toBeVisible();
    await expect(card.getByTestId('meteor-weather-unknown')).toHaveCount(0);
    await expect(card.getByTestId('meteor-best-window').or(card.getByTestId('meteor-best-none'))).toBeVisible();
    await expect(card).not.toContainText(/you will see \d+/i);

    await card.getByTestId('meteor-find-radiant').click();
    const nav = page.getByTestId('navigator');
    await expect(nav).toContainText('Orionids');
    await expect(page.getByTestId('navigator-meteor-hint')).toContainText("don't need to stare");
  });

  test('without the forecast the shower card says weather is not taken into account', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-tonight').click();
    await page.getByTestId('tonight-shower-ori').click();
    await expect(page.getByTestId('meteor-weather-unknown')).toContainText('Weather not taken into account');
  });

  test('meteor layer is off by default and can be enabled in Layers', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-layers').click();
    await expect(page.getByTestId('layer-meteors')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('layer-meteors').click();
    await expect(page.getByTestId('layer-meteors')).toHaveAttribute('aria-checked', 'true');
    // Overlay layer: quick filters stay as they are.
    await expect(page.getByTestId('filter-all')).toHaveAttribute('aria-checked', 'true');
  });

  test('all showers list and search by localized name', async ({ page }) => {
    await start(page, { language: 'ru' });
    await page.getByTestId('open-search').click();
    await page.getByTestId('search-input').fill('Персеиды');
    await page.getByTestId('result-meteor-per').click();
    await expect(page.getByTestId('meteor-sheet').getByRole('heading', { name: 'Персеиды' })).toBeVisible();
    await page.getByTestId('meteor-all').click();
    await expect(page.getByTestId('meteors-list').getByTestId('meteor-row-gem')).toContainText('Геминиды');
  });
});

test.describe('localization of the new screens', () => {
  test('Russian texts', async ({ page }) => {
    await mockWeatherOk(page);
    await start(page, { language: 'ru', weatherEnabled: true });
    await page.getByTestId('open-tonight').click();
    const sheet = page.getByTestId('tonight-sheet');
    await expect(sheet.getByRole('heading', { name: 'Сегодня ночью' })).toBeVisible();
    await expect(sheet).toContainText('Активные метеорные потоки');
    await expect(sheet.getByTestId('tonight-showers')).toContainText('Ориониды');
    await sheet.getByTestId('tonight-open-weather').click();
    await expect(page.getByTestId('weather-sheet')).toContainText('Облачность');
    await expect(page.getByTestId('weather-sheet')).toContainText('Влажность');
  });

  test('Arabic is right-to-left', async ({ page }) => {
    await start(page, { language: 'ar' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByTestId('open-tonight').click();
    await expect(page.getByTestId('tonight-sheet').getByRole('heading', { name: 'الليلة' })).toBeVisible();
    await page.getByTestId('tonight-shower-ori').click();
    await expect(page.getByTestId('meteor-sheet').getByRole('heading', { name: 'الجباريات' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('offline', () => {
  test('meteor catalog works offline; weather says a fresh forecast is unavailable', async ({ page, context }) => {
    await page.clock.setFixedTime(NOW);
    await seedSettings(page, { weatherEnabled: true });
    await page.route(OPEN_METEO, (route) => route.abort('internetdisconnected'));
    await page.goto('./');
    await waitForSky(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await waitForSky(page);
    await page.getByTestId('open-tonight').click();
    await expect(page.getByTestId('tonight-showers')).toContainText('Orionids');
    await expect(page.getByTestId('tonight-sheet').getByTestId('weather-unavailable')).toContainText(
      'not available offline',
    );
    await page.getByTestId('tonight-shower-ori').click();
    await expect(page.getByTestId('meteor-grade')).toBeVisible();
    await expect(page.getByTestId('meteor-weather-unknown')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('responsive layout', () => {
  for (const width of [320, 360, 390, 430]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await mockWeatherOk(page);
      await start(page, { weatherEnabled: true });
      const noOverflow = async () =>
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      await expect(page.getByTestId('open-tonight')).toBeVisible();
      await noOverflow();
      await page.getByTestId('open-tonight').click();
      await expect(page.getByTestId('tonight-sheet')).toBeVisible();
      await noOverflow();
      await page.getByTestId('tonight-open-weather').click();
      await expect(page.getByTestId('hourly-strip')).toBeVisible();
      await noOverflow();
      const box = await page.getByTestId('weather-sheet').boundingBox();
      expect(box!.width).toBeLessThanOrEqual(width);
      await page.getByTestId('weather-sheet').getByRole('button', { name: 'Close' }).click();
      await page.getByTestId('open-tonight').click();
      await page.getByTestId('tonight-shower-ori').click();
      await expect(page.getByTestId('meteor-sheet')).toBeVisible();
      await noOverflow();
    });
  }
});
