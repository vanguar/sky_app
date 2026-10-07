/**
 * Resolves a public asset path against Vite's base URL, so the app works both at "/"
 * (local, Vercel) and under a sub-path such as "/sky_app/" (GitHub Pages project site).
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const clean = path.replace(/^\/+/, '');
  return `${base.endsWith('/') ? base : `${base}/`}${clean}`;
}
