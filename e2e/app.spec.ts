import { expect, test } from '@playwright/test';
import { magneticDeclination } from '../src/astronomy/geomagnetism';
import { pixelDiff, seedSettings, waitForSky } from './helpers';

test.describe('first run', () => {
  test('onboarding → manual location → sky map', async ({ page }) => {
    await page.goto('./');
    const onboarding = page.getByTestId('onboarding');
    await expect(onboarding).toBeVisible();
    await expect(onboarding.getByRole('heading', { name: 'Welcome to AstroPoint' })).toBeVisible();
    await page.getByTestId('onboarding-start').click();
    await page.getByTestId('enter-manually').click();
    await page.getByTestId('lat-input').fill('48.85');
    await page.getByTestId('lon-input').fill('2.35');
    await page.getByTestId('apply-location').click();
    // Sensors step: skip.
    await page.getByTestId('onboarding-finish').click();
    await expect(onboarding).toBeHidden();
    await waitForSky(page);
    await expect(page.getByTestId('location-chip')).toContainText('48.85');
  });

  test('uses the (mocked) device location', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 59.94, longitude: 30.31 });
    await page.goto('./');
    await page.getByTestId('onboarding-start').click();
    await page.getByTestId('use-gps').click();
    await page.getByTestId('onboarding-finish').click();
    await expect(page.getByTestId('location-chip')).toContainText('59.94');
  });

  test('rejects invalid manual coordinates', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('onboarding-start').click();
    await page.getByTestId('enter-manually').click();
    await page.getByTestId('lat-input').fill('123');
    await page.getByTestId('lon-input').fill('10');
    await page.getByTestId('apply-location').click();
    await expect(page.getByRole('alert')).toContainText('latitude between');
  });
});

test.describe('sky map', () => {
  test.beforeEach(async ({ page }) => {
    await seedSettings(page);
    await page.goto('./');
    await waitForSky(page);
  });

  test('loads the map with WebGL canvas and controls', async ({ page }) => {
    await expect(page.getByTestId('open-search')).toBeVisible();
    await expect(page.getByTestId('filter-all')).toHaveAttribute('aria-checked', 'true');
    const size = await page.locator('canvas.sky-canvas').boundingBox();
    expect(size!.width).toBeGreaterThan(300);
  });

  test('quick filters really switch layers', async ({ page }) => {
    await page.getByTestId('filter-planets').click();
    await expect(page.getByTestId('filter-planets')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('open-layers').click();
    await expect(page.getByTestId('layer-planets')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('layer-stars')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('layer-galaxies')).toHaveAttribute('aria-checked', 'false');
    // Turning on the zodiac layer makes the combination custom.
    await page.getByTestId('layer-zodiac').click();
    await expect(page.getByTestId('layer-zodiac')).toHaveAttribute('aria-checked', 'true');
    for (const p of ['all', 'planets', 'stars', 'constellations', 'deepSky']) {
      await expect(page.getByTestId(`filter-${p}`)).toHaveAttribute('aria-checked', 'false');
    }
  });

  test('search finds Jupiter and opens its card with real values', async ({ page }) => {
    await page.getByTestId('open-search').click();
    await page.getByTestId('search-input').fill('Jupiter');
    await page.getByTestId('result-jupiter').click();
    const card = page.getByTestId('object-details');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Jupiter' })).toBeVisible();
    await expect(card.getByTestId('details-altitude')).toHaveText(/^-?\d+(\.\d)?°$/);
    await expect(card.getByTestId('details-azimuth')).toContainText('°');
    await card.getByTestId('tab-detailed').click();
    await expect(card).toContainText('Known moons');
    await expect(card).toContainText('Distance from Earth');
    await expect(page).toHaveURL(/#\/object\/jupiter$/);
  });

  test('search works across languages and catalog ids', async ({ page }) => {
    await page.getByTestId('open-search').click();
    const input = page.getByTestId('search-input');
    await input.fill('Юпитер');
    await expect(page.getByTestId('result-jupiter')).toBeVisible();
    await input.fill('M31');
    await expect(page.getByTestId('result-m31')).toBeVisible();
    await input.fill('Andromeda');
    await expect(page.getByTestId('result-con-and')).toBeVisible();
  });

  test('Find in Sky shows the navigator', async ({ page }) => {
    await page.getByTestId('open-search').click();
    await page.getByTestId('search-input').fill('Saturn');
    await page.getByTestId('find-saturn').click();
    const nav = page.getByTestId('navigator');
    await expect(nav).toBeVisible();
    await expect(nav).toContainText('Saturn');
    await page.getByTestId('navigator-stop').click();
    await expect(nav).toBeHidden();
  });

  test('opens the 3D viewer for Mars', async ({ page }) => {
    await page.goto('./#/object/mars');
    await expect(page.getByTestId('object-details')).toBeVisible();
    await page.getByTestId('details-3d').click();
    await expect(page.getByTestId('planet-3d')).toBeVisible();
    await expect(page.getByTestId('planet-3d').locator('canvas')).toBeVisible();
    await page.getByTestId('close-3d').click();
    await expect(page.getByTestId('planet-3d')).toBeHidden();
  });

  test('3D globe auto-rotates and the toggle stops it', async ({ page }) => {
    await page.goto('./#/object/mars');
    await page.getByTestId('details-3d').click();
    const canvas = page.getByTestId('planet-3d').locator('canvas');
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(1500); // texture load
    const a = await canvas.screenshot();
    await page.waitForTimeout(1200);
    const b = await canvas.screenshot();
    expect(await pixelDiff(page, a, b)).toBeGreaterThan(500);
    await page.getByRole('button', { name: 'Auto-rotate' }).click();
    await page.waitForTimeout(600); // let damping settle
    const c = await canvas.screenshot();
    await page.waitForTimeout(1000);
    const d = await canvas.screenshot();
    expect(await pixelDiff(page, c, d)).toBeLessThan(50);
  });

  test('"Visible now" filter and practical visibility in the card', async ({ page }) => {
    const toggle = page.getByTestId('filter-visible-now');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.goto('./#/object/saturn');
    const card = page.getByTestId('object-details');
    await expect(card.getByTestId('details-practical-status')).toHaveText(
      /^(Visible|Difficult|Not practically visible|Below horizon)$/,
    );
    await expect(card.getByTestId('details-practical-reason')).not.toBeEmpty();
    await page.reload();
    await expect(page.getByTestId('filter-visible-now')).toHaveAttribute('aria-pressed', 'true');
  });

  test('changes location manually from the top bar', async ({ page }) => {
    await page.getByTestId('location-chip').click();
    await page.getByTestId('enter-manually').click();
    await page.getByTestId('lat-input').fill('-33.87');
    await page.getByTestId('lon-input').fill('151.21');
    await page.getByTestId('apply-location').click();
    await expect(page.getByTestId('location-chip')).toContainText('-33.87');
    await page.reload();
    await expect(page.getByTestId('location-chip')).toContainText('-33.87');
  });

  test('sensor mode falls back gracefully without orientation data', async ({ page }) => {
    await page.getByTestId('toggle-sensor').click();
    // Desktop/headless has no orientation events: after the watchdog we are back in free mode.
    await expect(page.getByTestId('toggle-sensor')).toHaveAttribute('aria-pressed', 'false', {
      timeout: 8000,
    });
  });
});

test.describe('phone pointing (mocked sensors)', () => {
  test('follows simulated device orientation', async ({ page }) => {
    await seedSettings(page);
    await page.goto('./');
    await waitForSky(page);
    // Emit absolute orientation events: phone upright, back camera facing east (alpha = 270°).
    await page.evaluate(() => {
      const fire = () =>
        window.dispatchEvent(
          new DeviceOrientationEvent('deviceorientationabsolute', {
            alpha: 270,
            beta: 90,
            gamma: 0,
            absolute: true,
          }),
        );
      (window as unknown as { __orient: number }).__orient = window.setInterval(fire, 50);
    });
    await page.getByTestId('toggle-sensor').click();
    await expect(page.getByTestId('toggle-sensor')).toHaveAttribute('aria-pressed', 'true');
    // Absolute (magnetic) east + WMM magnetic declination for the seeded location = true azimuth.
    const expected = 90 + magneticDeclination(50.45, 30.52, 0, new Date());
    await expect
      .poll(
        async () => {
          const text = (await page.locator('.crosshair-readout').textContent()) ?? '';
          const az = Number(/(\d+)°\s*$/.exec(text.trim())?.[1]);
          return Math.abs(az - expected);
        },
        { timeout: 8000 },
      )
      .toBeLessThanOrEqual(1);
    await expect(page.locator('.crosshair-readout')).toContainText('0°');
    await expect(page.getByTestId('sensor-status')).toBeVisible();
    await page.waitForTimeout(3500); // past the no-data watchdog
    await expect(page.getByTestId('toggle-sensor')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('localization', () => {
  test('switches language live and applies RTL for Arabic', async ({ page }) => {
    await seedSettings(page, { language: 'ru' });
    await page.goto('./');
    await waitForSky(page);
    await expect(page.getByTestId('filter-planets')).toHaveText('Планеты');
    await page.getByTestId('open-settings').click();
    await page.getByTestId('language-select').selectOption('de');
    await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
    await expect(page.getByTestId('filter-planets')).toHaveText('Planeten');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByTestId('language-select').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByTestId('filter-planets')).toHaveText('الكواكب');
    // Persisted across reloads.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});

test.describe('PWA', () => {
  test('serves a valid manifest and icons', async ({ page, request }) => {
    await seedSettings(page);
    await page.goto('./');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const res = await request.get(new URL(href!, page.url()).toString());
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.short_name).toBe('AstroPoint');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const ir = await request.get(new URL(icon.src, new URL(href!, page.url())).toString());
      expect(ir.ok(), icon.src).toBe(true);
    }
  });

  test('registers a service worker and works offline after first load', async ({ page, context }) => {
    await seedSettings(page);
    await page.goto('./');
    await waitForSky(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Wait until the SW controls the page (precache complete).
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await waitForSky(page);
    await page.getByTestId('open-search').click();
    await page.getByTestId('search-input').fill('Sirius');
    await expect(page.getByTestId('result-hip-32349')).toBeVisible();
    await context.setOffline(false);
  });
});
