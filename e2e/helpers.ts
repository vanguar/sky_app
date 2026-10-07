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

/** Number of pixels whose channels differ by more than `threshold` (ignores rasteriser noise). */
export async function pixelDiff(page: Page, a: Buffer, b: Buffer, threshold = 8): Promise<number> {
  return page.evaluate(
    async ([a64, b64, thr]) => {
      const load = async (s: string) => {
        const blob = await (await fetch(`data:image/png;base64,${s}`)).blob();
        const bmp = await createImageBitmap(blob);
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height).data;
      };
      const [da, db] = await Promise.all([load(a64 as string), load(b64 as string)]);
      let n = 0;
      for (let i = 0; i < Math.min(da.length, db.length); i += 4) {
        if (
          Math.abs(da[i] - db[i]) > (thr as number) ||
          Math.abs(da[i + 1] - db[i + 1]) > (thr as number) ||
          Math.abs(da[i + 2] - db[i + 2]) > (thr as number)
        )
          n++;
      }
      return n;
    },
    [a.toString('base64'), b.toString('base64'), threshold] as const,
  );
}
