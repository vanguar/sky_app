# AstroPoint — Privacy

**Short version: AstroPoint computes the sky on your device. The only feature that sends anything
about you to a third party is the optional weather forecast — and it sends only approximate
coordinates, after you explicitly turn it on.**

* **No account.** There is no sign-up, login or user profile.
* **Location stays on your device by default.** If you allow geolocation, your position is used inside the app
  to compute the sky. It is stored in your browser's `localStorage` (so you don't have to share it again).
  AstroPoint has no backend.
* **Optional weather forecast ("Observing conditions") — the one exception.**
  * It is **off by default**. Before the first request the app explains that approximate coordinates will be
    sent to the weather service and asks you to enable it (Settings → *Weather forecast* turns it off again).
  * What is sent to **Open-Meteo** (`api.open-meteo.com`): **latitude and longitude rounded to a 0.05° grid**
    (≈ 5 km) plus forecast options (variable names, time zone "auto"). Your exact GPS position is never sent.
  * What is **never** sent: exact coordinates, elevation, device or user identifiers, e-mail, sensor data,
    compass heading, location history. No cookies or credentials are attached to the request.
  * Like any web server, Open-Meteo receives your IP address with the request. See the
    [Open-Meteo terms & privacy](https://open-meteo.com/en/terms).
  * The last forecast is cached in `localStorage` (keyed by the rounded location) so it can be shown offline,
    always labelled with its age. Turning the feature off or "Reset all settings" deletes it.
* **Meteor showers** are computed entirely on the device from a bundled catalog — no network access.
* **Motion sensors stay on your device.** Orientation / compass readings are processed in memory to point the sky
  map and are never stored or transmitted.
* **No analytics, no tracking, no ads, no cookies.** The app contains no third-party scripts.
* **Network use.** Apart from the optional forecast, the only network requests are for the app's own static files
  (HTML, JavaScript, star catalogs, icons, planet textures) from the host it is served from (e.g. GitHub Pages or
  Vercel). These hosts may keep standard technical access logs (IP address, user agent) as any web server does.
* **Offline cache.** A service worker caches the app and catalogs on your device so it works offline. Weather API
  responses are never cached by the service worker.
* **Deleting your data.** Settings → "Reset all settings", or clear the site data for AstroPoint in your browser.

Questions: open an issue in the project repository.
