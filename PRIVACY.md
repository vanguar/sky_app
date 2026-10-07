# AstroPoint — Privacy

**Short version: AstroPoint does not send any of your data anywhere.**

* **No account.** There is no sign-up, login or user profile.
* **Location stays on your device.** If you allow geolocation, your approximate position is used only inside the app
  to compute the sky. It is stored in your browser's `localStorage` (so you don't have to share it again) and is
  **never transmitted** to any server — AstroPoint has no backend.
* **Motion sensors stay on your device.** Orientation / compass readings are processed in memory to point the sky
  map and are never stored or transmitted.
* **No analytics, no tracking, no ads, no cookies.** The app contains no third-party scripts.
* **Network use.** The only network requests are for the app's own static files (HTML, JavaScript, star catalogs,
  icons, planet textures) from the host it is served from (e.g. GitHub Pages or Vercel). These hosts may keep
  standard technical access logs (IP address, user agent) as any web server does; AstroPoint itself adds nothing.
* **Offline cache.** A service worker caches the app and catalogs on your device so it works offline.
* **Deleting your data.** Settings → "Reset all settings", or clear the site data for AstroPoint in your browser.

Questions: open an issue in the project repository.
