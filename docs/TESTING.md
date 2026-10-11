# Verification

```bash
npm ci
npx playwright install chromium webkit
npm run lint
npm run typecheck
npm test
npm run test:e2e
```

Playwright runs the production build with two workers. Chromium covers the full suite, including
service worker installation and offline reloads. WebKit covers mobile map, deep links, multilingual
search and RTL persistence. Weather tests block service workers so network mocks remain effective
after reload; PWA tests keep service workers enabled.

To exercise the GitHub Pages path locally (PowerShell):

```powershell
$env:VITE_BASE = '/sky_app/'
npm run test:e2e
Remove-Item Env:VITE_BASE
```

For a build that already exists, set `E2E_SKIP_BUILD=1` and set `VITE_BASE` to that build's base.
Both CI workflows run browser checks before accepting or publishing the build and retain failure traces.

Regression coverage includes full-response weather timeout, cancellation during body reading,
late results after cache clearing/reset, remaining-night windows, repeated WebGL loss/restoration,
renderer retry, root/unknown routes and browser history, and modal focus/background restoration.
The 3D rotation test waits for the actual texture-ready state before comparing frames, uses a
single-pixel device scale to limit software-GPU work, and hides transient DOM overlays in captures.

## Language bundles

English fallback is in the app shell. Other UI dictionaries and feature panels are loaded on demand
and are precached by the production service worker, so offline language switching remains available.
Search uses a compact dictionary containing object names in all supported languages.
After changing names in `src/i18n/*.json`, run `npm run i18n:names`; unit tests reject stale search names.

## Physical-device release checklist

Browser emulation does not verify physical orientation or battery use. Check on Android Chrome and
iPhone Safari, both in browser tabs and as installed PWAs:

- First-run location and sensor permissions: allow, deny, then retry from a user tap.
- Portrait/landscape rotation, true heading, manual calibration, and loss/recovery of sensor data.
- Background/resume: clock and sky update; fullscreen 3D pauses the underlying map.
- 3D open/close repeatedly, late texture responses, pinch zoom, and auto-rotation off.
- Install, reload offline, open a previously unopened panel, switch language offline, update the PWA.
- Keyboard Tab/Shift+Tab, Escape and focus return; VoiceOver/TalkBack dialog announcements.
- Observe memory and battery during extended sky/sensor/3D sessions on a lower-powered phone.

These device checks require hardware and are separate from automated CI results.
