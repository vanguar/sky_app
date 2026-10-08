# AstroPoint — Architecture

AstroPoint is a client-only PWA: **React + TypeScript + Vite** for the UI, **Three.js** for the sky,
**Astronomy Engine** for ephemerides, **Zustand** for global UI state, **i18next** for 8 languages and
**vite-plugin-pwa / Workbox** for offline support. There is no backend; the optional weather forecast is
fetched client-side through a replaceable `WeatherProvider`.

```
            ┌────────────── React UI (features/*) ──────────────┐
            │ TopBar · FilterBar · Sheets · Navigator · 3D view │
            └───────┬───────────────────────────┬───────────────┘
        Zustand stores (store/*)          skyBridge (renderer handle + 10 Hz frame info)
                    │                           │
   ┌────────────────┴───────┐        ┌──────────┴───────────────┐
   │ AstronomyService        │        │ SkyRenderer (sky/*)       │
   │ coordinate-transform    │──────▶ │  SkyScene · layers        │
   │ TimeController          │ matrix │  SkyCamera · SkyControls  │
   └────────────────┬───────┘ +bodies │  LabelLayer · Picking     │
                    │                 └──────────┬───────────────┘
            Astronomy Engine                     │ orientation source
                                       ┌─────────┴──────────────┐
                                       │ OrientationPipeline     │
                                       │ (sensors/*)             │
                                       └─────────┬──────────────┘
                                        SensorProvider (Browser… / Native… later)
```

## Directory layout

| Path | Responsibility |
|------|----------------|
| `src/app/` | `App.tsx`, hash routes (`routes.ts`), platform providers (DI of sensor/location providers), PWA hooks |
| `src/astronomy/` | `AstronomyService` (only module importing Astronomy Engine), pure `coordinate-transform`, `visibility`, `TimeController`, sun/moon/planet helpers |
| `src/sensors/` | `SensorProvider` interface, `BrowserSensorProvider`, normaliser (device orientation → quaternion), smoothing, calibration, `OrientationPipeline` |
| `src/platform/location/` | `LocationProvider` interface + browser implementation |
| `src/sky/` | Imperative Three.js renderer: scene, camera, controls, layers (`StarLayer`, `PlanetLayer`, `SunMoonLayer`, `ConstellationLayer`, `DeepSkyLayer`, `HorizonLayer`, `LabelLayer`), `Picking` |
| `src/catalog/` | Catalog types, parsers (stars / constellations / Messier), planet reference data, object registry (ids → refs → names/targets) |
| `src/features/` | UI features: sky, search, object-details, navigator, filters, planet-3d, settings, onboarding |
| `src/store/` | Zustand stores: settings, location, sky (layers, mode, selection, navigation), ui (panels, toasts), catalog |
| `src/i18n/` | `en/ru/uk/de/fr/es/it/ar.json`, init, RTL handling |
| `public/catalogs/` | Generated compact catalogs (precached for offline) |
| `public/textures/` | Planet maps (runtime-cached, lazy) |
| `scripts/build-catalogs.mjs` | Converts `data/source/*` into `public/catalogs/*` |
| `src/weather/` | `WeatherProvider` interface, `OpenMeteoWeatherProvider`, `WeatherService` (cache + fallback), `cache.ts`, `location-privacy.ts` (coordinate rounding), pure `observing-conditions.ts` (score, darkness cap, best window) |
| `src/meteors/` | Shower definitions (`catalog.ts`), year data (`data/<year>.json`), `activity.ts`, `radiant.ts`, `visibility.ts` (MeteorObservability), `best-time.ts`, `sky-items.ts` (map radiants) |
| `src/observability/` | `ObjectObservability`: existing naked-eye estimate × weather verdict |
| `src/astronomy/night.ts`, `twilight.ts` | Night span (sunset → sunrise), Sun/Moon sampling, darkness phases |
| `src/features/observing/`, `src/features/meteors/` | "Tonight", "Observing conditions", meteor list and shower card sheets |

## Coordinates

* Catalog positions are **J2000/ICRS** RA/Dec. They are converted once to unit vectors in the **EQJ** frame.
* Every second `AstronomyService.getEqjToWorldMatrix(time, observer)` returns the rotation EQJ → local horizon
  (Astronomy Engine `Rotation_EQJ_HOR`: precession, nutation, sidereal time), remapped into the render
  **world frame**: `+X = east, +Y = zenith, −Z = north` (Three.js cameras look along −Z, i.e. north).
* All celestial layers live in one `celestial` group whose matrix is that rotation; stars never get
  per-frame CPU work. The horizon layer lives in the world frame.
* Sun/Moon/planets: topocentric J2000 vectors from `Equator(…, ofdate=false, aberration=true)` so they sit
  consistently among the stars; the info card uses refracted alt/az from `Horizon(…, 'normal')`.
* `coordinate-transform.ts` holds pure math (GMST/LST, RA/Dec ↔ Alt/Az, vectors) and is unit-tested against
  Meeus examples and against Astronomy Engine.

## Rendering

* Stars: one `THREE.Points` with a custom shader; size/alpha from magnitude and zoom, colour from B−V,
  daylight fade. Constellations: `LineSegments` (normal + zodiac subsets), IAU boundaries interpolated along
  constant-declination arcs, ecliptic line. Deep sky: one `Points` with per-category SDF markers.
* Labels are drawn on a 2D canvas overlay (any script incl. Arabic shaping), with zoom-dependent thresholds and
  overlap rejection; no React components per object.
* **On-demand rendering:** in free mode a frame is only drawn when something changed (drag, zoom, data tick);
  in sensor mode frames follow the orientation stream. Rendering pauses when the tab is hidden.
* Picking is screen-space hit testing (30 px touch radius, brightness-weighted). Tapping empty sky selects the
  constellation that contains the tap point (`Astronomy.Constellation`).

## Sensors

Device orientation (camera) and astronomical positions are strictly separated: sensors only rotate the
camera; the sky (`celestial` group) depends on time + location only.

```
deviceorientation (relative, gyro-stable)  ──► qRelative (device frame) ──────────────────────┐
deviceorientationabsolute / webkitCompassHeading                                              │
   └─► offset measurement m = absHeading − relHeading (same device axis: back camera / top edge)
          └─► HeadingEstimator: startup series (2.5–6 s, robust circular mean, spread check)
                             jump detector (offset change > 8° without device rotation = suspicious;
                             accepted only if it persists ≥ 3 s, then blended in ≤ 4°/s)
   yaw offset = estimator + WMM magnetic declination (magnetic → true north) + manual calibration
target = Ry(−yaw) · qRelative · Rz(−screenAngle) ─► QuaternionSmoother (render loop) ─► camera
```

* Physical rotation changes absolute and relative headings equally, so it cancels in `m`; a change of
  `m` means the magnetic heading moved on its own (re-calibration, disturbance).
* Modes are decided once per session: `fused` (Android: both streams), `compass` (iOS),
  `absolute-only` (gyro rates from `devicemotion` tell real turns from compass jumps), `relative-only`
  (no north reference → "compass needs calibration").
* UI status: "Calibrating compass…" → "Pointing ready", or "Compass needs calibration" with a shortcut to
  manual calibration on a known object.
* Development diagnostics: in `npm run dev` (or with `?sensorDebug=1`) a snapshot of the pipeline is logged
  every 500 ms (`sensor-diagnostics.ts`); production builds stay silent.

`SensorProvider` is an interface; `BrowserSensorProvider` is the web implementation. A Capacitor build would add a
`NativeSensorProvider` (and `CapacitorLocationProvider`) in `src/app/providers/platform.ts` only.

## Visibility

* Geometric: altitude > 0 (refracted), rise/set/transit, circumpolar.
* Practical naked-eye (`astronomy/naked-eye.ts`): magnitude + extinction (Kasten–Young airmass, k = 0.25),
  sky limiting magnitude from the Sun's altitude (day / twilight / night, generic suburban night limit 5.5),
  a horizon rule (< 5° at best "difficult"), a penalty for diffuse deep-sky objects. Statuses: visible,
  difficult, not practically visible, below horizon — each with a reason. No weather or light-pollution data
  is used; the UI says so.
* "Visible now" filter hides everything not practically visible (stars in the shader, planets, Messier,
  labels, picking), without changing the normal astronomy view.

## State

Zustand holds only global UI/state: settings (persisted), observer location (persisted), layers + view mode
(persisted), selection, navigation target, open panel, toasts. The Three.js scene graph, catalogs' typed arrays
and orientation samples are **not** in Zustand. Persisted state is validated field-by-field; corrupted JSON is
discarded (`store/persistence.ts`).

## Time

`TimeController` is the single source of observation time (`now()`), supporting `setTime`, `setRate`
(time-lapse) and `resetToNow`. v1 uses live "now"; time travel UI can be added without touching astronomy code.

## Offline / PWA

* Workbox precaches the app shell, JS/CSS, icons, manifest and **all catalogs** (~1.8 MB).
* Planet textures are **not** precached; they are cached on first use (`CacheFirst`, `astropoint-textures`).
* `base` is configurable (`/` for local/Vercel, `/sky_app/` for GitHub Pages); all asset URLs go through
  `import.meta.env.BASE_URL` (`utils/asset-url.ts`), manifest `start_url`/`scope` follow the base.
* Routing is hash-based (`#/object/jupiter`), so refreshes never hit a missing server route.

## Error handling

WebGL unavailable / context lost → message, search & cards keep working. Catalog load error → banner + retry.
Texture load error → procedural fallback globe. GPS denied/timeout/insecure → manual coordinates.
Sensors missing/denied/no data → free mode + message. Corrupted local settings → defaults. Error boundaries
isolate features.

## Observing conditions (weather)

```
React sheets ─► useWeather() ─► useWeatherStore (zustand, not persisted)
                                   └─► WeatherService.load(exactObserver)
                                          ├─ toWeatherQueryLocation()  → rounded 0.05° (≈5 km) — only this leaves the device
                                          ├─ WeatherCache (localStorage, last forecast, TTL 30 min)
                                          └─ WeatherProvider.getForecast(rounded)  ← OpenMeteoWeatherProvider (default)
```

* **Pluggable provider.** `Platform.weather = new WeatherService(new OpenMeteoWeatherProvider())` in
  `app/providers/platform.ts` is the only place that knows the provider. A paid Open-Meteo plan
  (`baseUrl` + `apiKey`), a self-hosted instance / backend proxy or another API is a new `WeatherProvider`
  implementation — no UI change. **Licence:** the free Open-Meteo endpoint is non-commercial only; see
  [DATA_SOURCES.md](DATA_SOURCES.md) #16.
* **Opt-in & privacy.** Disabled until the user accepts the in-app explanation (`settings.weatherEnabled`).
  The exact observer location stays in `location-store`; `weather-store.queryLocation` holds the rounded one.
* **Requests.** Hourly variables only (cloud cover total/low/mid/high, visibility, RH, dew point, precipitation
  probability/amount, weather code, wind/gusts, temperature), `timezone=auto`, `timeformat=unixtime`.
  `AbortController` timeout (10 s); offline, timeout, HTTP errors, 429, malformed JSON and partial responses are
  mapped to `WeatherError` kinds — missing variables become `null`, never invented.
* **Cache & staleness.** Fresh < 30 min → no request. On failure the last forecast is shown as "Last forecast,
  updated N ago"; > 6 h → explicit "outdated" warning; > 48 h → discarded. Requests happen only when a weather
  sheet is open (never per render, never in the render loop). The service worker uses `NetworkOnly` for
  `*.open-meteo.com`, so it can never serve an old forecast as new.
* **Score (`observing-conditions.ts`, pure).** Practical 0–100 estimate; grades excellent ≥ 80, good ≥ 60,
  fair ≥ 40, poor ≥ 20, bad. Cloud cover maps through a documented piecewise curve (0 % → 100, 10 % → 92,
  25 % → 76, 45 % → 55, 65 % → 34, 85 % → 14, 100 % → 4); precipitation / thunderstorm / fog codes cap the score;
  visibility < 10 km, humidity ≥ 85 % and strong wind subtract. Humidity alone never means rain or fog. It is
  **not "seeing"** — the forecast contains no turbulence data; a real seeing provider could add a factor later.
* **Night only.** `assessObserving()` limits the weather score by sky darkness from the Sun's altitude
  (`twilight.ts`: day / civil / nautical / astronomical / night). Caps: general sky 5 / 25 / 55 / 80 / 100,
  bright objects (Moon, planets) 10 / 60 / 90 / 100 / 100. The **best observing window** is the best continuous
  run of hours ≥ "good" (fallback ≥ "fair") inside tonight's span (sunset → sunrise), at the forecast's hourly
  resolution — never finer than the data.
* **Time zones.** `utils/time-zone.ts`: the provider's IANA zone for the same rounded place; else the device zone
  for GPS (or when the device offset fits the longitude); else a whole-hour zone from longitude, labelled
  "UTC+N" as approximate. All forecast and meteor times are formatted in that zone (`formatTime(…, tz)`).
* **ObjectObservability.** The naked-eye model (`naked-eye.ts`) is unchanged; `observability/` combines its
  status with the current-hour weather into a verdict ("well placed, but clouds may get in the way" …). The
  object card reads only the cached forecast — opening a card never triggers a request.

## Meteor showers

* **Data.** `MeteorShowerDefinition` (radiant at maximum, linear daily drift, speed, typical dates, parent body)
  + `MeteorShowerYearData` (`data/2026.json`: activity window, peak instant and precision, ZHR). Years without
  data fall back to typical dates, flagged `approximate` (this also covers Dec → Jan showers such as the
  Quadrantids). Bundled with the JS → precached, fully offline, base-path independent.
* **Activity.** inactive / upcoming (≤ 7 days) / active / nearPeak (±2 d, ±1 d for short showers) / peak (±12 h,
  ±24 h when only the date is known). No invented ZHR curve.
* **Radiant.** `radiantAt()` (J2000) → `AstronomyService.getHorizontalFromJ2000()` for alt/az. On the map,
  `MeteorRadiantLayer` draws a static symbol + IAU code on the label overlay for active / upcoming showers only
  (layer "Meteor radiants", off by default; an overlay like the grid, independent of quick filters). Radiants are
  pickable; ids `meteor-<code>` resolve through the object registry, so **Find in Sky**, deep links
  (`#/object/meteor-per`) and search work unchanged. No simulated meteors or trajectories are drawn.
* **MeteorObservability** (`visibility.ts`, separate from naked-eye visibility):
  `100 · (0.25 + 0.75·activity·zhrFactor) · (0.3 + 0.7·sin h_radiant) · (1 − 0.6·moonImpact) · weather/90`,
  capped by darkness (day 3, civil 10, nautical 30, astronomical twilight 70) and by a radiant below / near the
  horizon. Moon impact uses illumination, altitude and Moon–radiant separation. Without a forecast the result is
  marked `weatherUnknown` ("Astronomical conditions only — weather not taken into account"). It estimates
  conditions, never a meteor count; ZHR is always shown as "up to ~N under ideal conditions" with an explanation.
* **Best time tonight** (`best-time.ts`): the night is sampled every 30 min (Sun, Moon, radiant, weather,
  activity); the best continuous run within 75 % of the night's best score is reported, or "conditions are poor"
  with the dominant reasons. Computed on demand and memoised (10-minute buckets), never per frame.
* **Adding 2027**: create `src/meteors/data/2027.json` with the same shape and add it to `YEAR_DATA`.

## Future extensions (not implemented in v1)

| Feature | How it fits |
|---------|-------------|
| **Artificial satellites, ISS** | New `SatelliteLayer` (Points + trails) fed by a `SatelliteService` using SGP4 (e.g. `satellite.js`) in a Web Worker; positions converted to topocentric J2000 vectors like planets. |
| **TLE updater** | Fetch CelesTrak TLEs on demand, store in IndexedDB with timestamp, refresh daily; offline uses last cached set with an "age" warning. |
| **Camera AR overlay** | `getUserMedia` video behind a transparent WebGL canvas; reuse the sensor pipeline; needs per-device FOV calibration (camera intrinsics) — add `CameraProvider` abstraction. |
| **Plate solving / star recognition** | Worker running a lightweight solver (e.g. astrometry-style quad hashing against the Hipparcos subset) on camera frames; result feeds `calibration.ts` to correct heading drift. |
| **Notifications** | Push requires a server; local reminders via Notification Triggers / Capacitor Local Notifications for rises, conjunctions, ISS passes. |
| **Eclipses** | Astronomy Engine already provides `SearchLunarEclipse`, `SearchGlobalSolarEclipse`, `SearchLocalSolarEclipse`; add an events screen using `TimeController.setTime` to preview. |
| **Astronomical seeing** | A dedicated seeing/transparency provider can add a factor to `ObservingConditionsResult` without touching the UI. |
| **Time travel** | UI for `TimeController.setTime/setRate`; everything already reads time from it. |
| **Surface maps** | `features/planet-3d` already has landmark support; a 2D `SurfaceMap` view can reuse `LANDMARKS` and the same textures (Moon, Mars, Mercury). |
| **Capacitor Android/iOS** | Add `@capacitor/core`, implement `NativeSensorProvider` (`@capacitor/motion` or a small plugin for rotation-vector sensors) and `CapacitorLocationProvider`, swap in `createPlatform()`. Build with `base: './'`. |
| **Larger star catalogs** | Binary typed-array tiles (by magnitude/region), loaded progressively in a Web Worker. |
