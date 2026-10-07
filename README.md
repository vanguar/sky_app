# AstroPoint

**Point. Discover. Understand.** · *Наведи. Найди. Узнай.*

AstroPoint is an installable, offline-capable planetarium PWA. Open it on your phone, allow location and motion
sensors, point the phone at the sky and see the real stars, planets, Sun, Moon, constellations and Messier objects
in that direction — computed on the device for your place and the current time.

**Live:** https://vanguar.github.io/sky_app/

## Features

* Real-time sky for your location: 8 789 Hipparcos stars (V < 6.5), Sun, Moon (with phase), Mercury–Neptune,
  88 IAU constellations (lines, names, boundaries), zodiac subset + ecliptic, all 110 Messier objects.
* Three map modes: **Free** (drag, pinch/wheel zoom, inertia, reset), **Phone pointing** (DeviceOrientation with
  compass handling, screen-orientation compensation, smoothing, calibration), **Find in Sky** (arrow + "left/right/up/down N°",
  "below the horizon — rises at …").
* Quick filters (All / Planets / Stars / Constellations / Deep Sky) and a layer menu (Sun, Moon, Planets, Stars,
  Zodiac, constellation lines/names/boundaries, galaxies, nebulae, clusters, horizon grid).
* Tap any object → bottom-sheet card: altitude, azimuth, visibility, next rise/set/transit, distance, physical data
  (Brief / Details).
* Local search in every supported language and by designation: “Jupiter”, “Юпитер”, “Юпітер”, “M31”, “NGC 224”,
  “Andromeda”, “Андромеда”, “α CMa”, “HIP 32349”.
* 3D globes (Moon, Mars, Jupiter with NASA/USGS public-domain maps; Saturn with rings, Mercury, Venus, Uranus,
  Neptune with illustrative textures), rotate / pinch / reset / auto-rotate, Moon & Mars landmarks.
* 8 languages (en, ru, uk, de, fr, es, it, ar) with live switching and full RTL for Arabic.
* Practical naked-eye visibility (visible / difficult / not practically visible / below horizon, with a reason) and a “Visible now” filter.
* Dark UI for night use, brightness control, **night vision (red)** mode.
* PWA: installable, works offline after the first visit (app shell + catalogs precached; textures cached on use).
* Privacy: no backend, no account, no analytics. Location never leaves the device.

## Screens

Onboarding (welcome → location → optional sensors) · Sky map (top bar, crosshair, side controls, filter bar) ·
Search sheet · Object card · Find-in-Sky navigator · Layers · Settings/menu · Location · 3D viewer.

## Stack

React 18 · TypeScript (strict) · Vite 6 · Three.js · Astronomy Engine · Zustand · i18next/react-i18next ·
vite-plugin-pwa (Workbox) · Vitest · Playwright · ESLint · Prettier.

## Getting started

```bash
git clone https://github.com/vanguar/sky_app.git
cd sky_app
npm install
npm run dev          # http://localhost:5173
```

| Script | |
|--------|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (base `/`) |
| `npm run build:pages` | Production build for GitHub Pages (base `/sky_app/`) |
| `npm run preview` | Serve the production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright, mobile Chromium; run `npx playwright install chromium` once) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run catalogs` | Regenerate `public/catalogs/*` from `data/source/*` |

Sensors and geolocation need **HTTPS** (or `localhost`). To test on a phone during development use
`npm run dev -- --host` behind an HTTPS tunnel, or deploy a preview.

## PWA

* Manifest with standalone display, any orientation, regular + maskable icons; `start_url`/`scope` follow the base path.
* Service worker (Workbox `generateSW`): precaches the app shell and catalogs; planet textures use runtime
  `CacheFirst`. Update prompt when a new version is deployed.
* Install: Android Chrome → menu → *Install app* (or Menu → *Install app* inside AstroPoint);
  iOS Safari → Share → *Add to Home Screen*.

## Browser requirements

Modern Chrome/Edge/Firefox/Safari with WebGL (WebGL 2 preferred). Phone pointing requires DeviceOrientation:
Chrome for Android (absolute orientation), Safari on iOS 13+ (permission prompt after a tap).

## Sensor limitations

* Browser compasses report **magnetic** north; AstroPoint converts to true north with the World Magnetic Model (WMM2025).
* After enabling phone pointing the compass is stabilised for a few seconds (“Calibrating compass…”); sudden compass jumps without device rotation are ignored unless they persist.
* Debug: open the app with `?sensorDebug=1` to log the sensor pipeline to the console every 500 ms.

* Compass accuracy depends on the magnetometer; metal, magnets and phone cases cause errors. Use
  Settings → *Compass correction* or *Calibrate on selected object* (point at a known bright object, tap).
* Some browsers provide only relative orientation (no north reference) — the app tells you and lets you calibrate.
* iOS requires a tap to grant motion access; it must be re-granted in new sessions.
* Desktop browsers have no orientation sensors — the app falls back to free mode with a message.

How to verify on a real device: see *Testing on a phone* below.

## Testing on a phone

1. Open https://vanguar.github.io/sky_app/ on the phone (HTTPS).
2. Allow location → check the coordinates chip.
3. Tap the phone icon (right side) → on iOS allow motion access.
4. Point at a known bright object (Moon, a bright planet, Polaris/Sirius). The object should be near the crosshair.
   If it is consistently offset left/right, use *Calibrate on selected object*.
5. Rotate to landscape — the view must stay level.
6. Search “Jupiter” → *Find in Sky* → follow the arrow until “Jupiter is in the crosshair”.

## Privacy

See [PRIVACY.md](PRIVACY.md). TL;DR: everything is computed locally; nothing is sent anywhere.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub Pages via Actions (`.github/workflows/deploy-pages.yml`),
Vercel (`vercel.json`), any static host.

## Data sources

See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md): ESA Hipparcos, d3-celestial (BSD-3), Astronomy Engine (MIT),
NASA fact sheets and NASA/JPL/USGS/NRL maps (public domain). No data with unclear licensing is included.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

* Time travel / time-lapse UI (TimeController is ready)
* Satellites & ISS (TLE + SGP4 in a worker)
* Camera AR overlay, plate solving for heading correction
* Events: eclipses, conjunctions, meteor showers
* Surface maps (Moon, Mars, Mercury), more planetary textures
* Capacitor builds for Android / iOS with native sensor providers
* Fainter star tiles loaded progressively

## License

MIT for the code — see [LICENSE](LICENSE). Bundled data keeps its own licenses (see DATA_SOURCES.md).
