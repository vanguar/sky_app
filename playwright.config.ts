import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const basePath =
  process.env.VITE_BASE ??
  (process.env.DEPLOY_TARGET === 'github-pages' ? `/${process.env.PAGES_REPO_NAME ?? 'sky_app'}/` : '/');
const baseURL = `http://localhost:${PORT}${basePath.endsWith('/') ? basePath : `${basePath}/`}`;

/**
 * E2E tests run against the production build (vite preview) so the service worker,
 * manifest and precache are exercised. Geolocation and orientation are mocked per test.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        // SwiftShader keeps WebGL working on headless CI machines.
        launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
    {
      name: 'mobile-webkit',
      testMatch: '**/smoke.spec.ts',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD ? '' : 'npm run build && '}npx vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
