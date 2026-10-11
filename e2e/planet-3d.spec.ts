import { expect, test } from '@playwright/test';
import { pixelDiff, seedSettings } from './helpers';

// This checks motion, not Retina rendering. Limit software-GPU pixel work under parallel CI.
test.use({ deviceScaleFactor: 1 });

test('3D globe auto-rotates and the toggle stops it', async ({ page }) => {
  await seedSettings(page);
  await page.goto('./#/object/mars');
  await page.getByTestId('details-3d').click();
  const viewer = page.getByTestId('planet-3d');
  const canvas = viewer.locator('canvas');
  // Canvas screenshots include overlaid DOM; transient PWA toasts are unrelated to rotation.
  const capture = () =>
    canvas.screenshot({ style: '.toasts, .viewer3d-labels { visibility: hidden !important; }' });
  await expect(viewer).toHaveAttribute('data-status', 'ready');
  const a = await capture();
  await page.waitForTimeout(1200);
  const b = await capture();
  expect(await pixelDiff(page, a, b)).toBeGreaterThan(500);
  await viewer.getByRole('button', { name: 'Auto-rotate' }).click();
  await page.waitForTimeout(600); // let damping settle
  const c = await capture();
  await page.waitForTimeout(1000);
  const d = await capture();
  expect(await pixelDiff(page, c, d)).toBeLessThan(50);
});
