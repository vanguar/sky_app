/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

/**
 * Base path resolution:
 *  - VITE_BASE (explicit) wins, e.g. VITE_BASE=/my-fork/ npm run build
 *  - DEPLOY_TARGET=github-pages → /sky_app/ (project site https://vanguar.github.io/sky_app/)
 *  - otherwise "/" (local dev, Vercel, any root deployment)
 */
function resolveBase(): string {
  const explicit = process.env.VITE_BASE;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  if (process.env.DEPLOY_TARGET === 'github-pages') return `/${process.env.PAGES_REPO_NAME ?? 'sky_app'}/`;
  return '/';
}

const base = resolveBase();
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'AstroPoint — Point. Discover. Understand.',
        short_name: 'AstroPoint',
        description:
          'Point your phone at the sky and discover the stars, planets and constellations above you.',
        lang: 'en',
        theme_color: '#05060f',
        background_color: '#05060f',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        categories: ['education', 'navigation', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell + catalogs are precached so the sky map works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Live weather must never be served stale by the service worker. The app keeps its own
            // "last forecast" copy (with its age) for offline use — see src/weather/cache.ts.
            urlPattern: ({ url }) => url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkOnly',
          },
          {
            // Planet textures are large: cached lazily, on first use of the 3D viewer.
            urlPattern: ({ url }) => url.pathname.includes('/textures/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'astropoint-textures',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          astronomy: ['astronomy-engine'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: { deps: { inline: ['astronomy-engine'] } },
  },
});
