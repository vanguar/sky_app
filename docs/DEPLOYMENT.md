# Deployment

AstroPoint is a static site (`dist/`). No server code, no rewrites required (hash routing).

## Base path

`vite.config.ts` resolves the public base path:

| Situation | Command | Base |
|-----------|---------|------|
| Local dev / preview, Vercel, Netlify, any root domain | `npm run build` | `/` |
| GitHub Pages project site `https://<user>.github.io/<repo>/` | `npm run build:pages` (sets `DEPLOY_TARGET=github-pages`) | `/<PAGES_REPO_NAME or sky_app>/` |
| Any other sub-path | `VITE_BASE=/my/path/ npm run build` | `/my/path/` |

All runtime asset URLs (catalogs, textures, icons, manifest `start_url`/`scope`, service worker scope) derive from
this base, so the same code works at `/` and under a sub-path.

## GitHub Pages (production: https://vanguar.github.io/sky_app/)

Workflow: [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml), triggered on push to `main`
and manually (`workflow_dispatch`). Steps: checkout → Node 20 → `npm ci` → lint → typecheck → unit tests →
`npm run build:pages` (with `PAGES_REPO_NAME` = repository name) → `configure-pages` → `upload-pages-artifact` →
`deploy-pages`. Uses `concurrency: pages` to avoid overlapping deployments.

One-time setting (done automatically via the GitHub API by the maintainer, or manually):
**Settings → Pages → Build and deployment → Source → GitHub Actions.**

Forks with a different repository name work automatically because the workflow passes the repository name.

## Vercel

`vercel.json` is included (`npm run build`, output `dist`, framework `vite`, no-cache header for `sw.js`).

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

Or import the GitHub repository in the Vercel dashboard — no settings needed (base path `/`).

## Any static host

```bash
npm ci
npm run build        # or VITE_BASE=/sub/path/ npm run build
# upload dist/
```

Serve `sw.js` with `Cache-Control: no-cache` so updates are picked up promptly. HTTPS is required for the service
worker, geolocation and motion sensors.

## Verifying a deployment

1. Open the URL → onboarding → sky map renders.
2. DevTools → Application → Manifest: name, icons (incl. maskable), `start_url`/`scope` match the base.
3. Application → Service Workers: `sw.js` activated; Cache Storage contains `workbox-precache-*` with
   `catalogs/*.json`.
4. Go offline (DevTools → Network → Offline) and reload: the map, search and object cards still work.
5. Chrome on Android: menu → “Install app”; iOS Safari: Share → “Add to Home Screen”.
