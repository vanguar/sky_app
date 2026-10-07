import type { Page } from '@playwright/test';

/** Pre-seeds settings so tests start directly on the sky map (onboarding done). */
export async function seedSettings(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((o) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(
      'astropoint.settings',
      JSON.stringify({
        state: {
          language: 'en',
          nightMode: false,
          brightness: 1,
          showLabels: true,
          infoLevel: 'brief',
          smoothing: 'medium',
          headingOffset: 0,
          onboardingDone: true,
          ...o,
        },
        version: 1,
      }),
    );
    localStorage.setItem(
      'astropoint.location',
      JSON.stringify({
        state: {
          location: { latitude: 50.45, longitude: 30.52, elevation: 0, source: 'manual', updatedAt: 1 },
        },
        version: 1,
      }),
    );
  }, overrides);
}

export async function waitForSky(page: Page) {
  await page.getByTestId('sky-view').locator('canvas.sky-canvas').waitFor({ state: 'visible' });
}
