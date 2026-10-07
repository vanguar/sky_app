/**
 * Minimal hash routing (works on GitHub Pages without server rewrites):
 *   #/                 → sky map
 *   #/object/<id>      → sky map with an object selected (e.g. #/object/jupiter, #/object/m31)
 */
export interface Route {
  objectId: string | null;
}

const OBJECT_RE = /^#\/object\/([a-z0-9-]{1,32})$/i;

export function parseHash(hash: string): Route {
  const m = OBJECT_RE.exec(hash);
  return { objectId: m ? decodeURIComponent(m[1]).toLowerCase() : null };
}

export function buildHash(route: Route): string {
  return route.objectId ? `#/object/${encodeURIComponent(route.objectId)}` : '#/';
}

/** Updates the URL without adding history entries or triggering navigation. */
export function replaceHash(route: Route): void {
  const next = buildHash(route);
  if (location.hash === next || (!route.objectId && (location.hash === '' || location.hash === '#/'))) return;
  history.replaceState(history.state, '', `${location.pathname}${location.search}${next}`);
}
