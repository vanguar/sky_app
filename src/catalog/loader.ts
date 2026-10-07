import { parseConstellations, type ConstellationsFile } from './constellations/constellations';
import { parseMessier, type MessierFile } from './messier/messier';
import { parseStarCatalog, type StarCatalogFile, type StarNamesFile } from './stars/stars';
import type { Catalog } from './types';
import { assetUrl } from '../utils/asset-url';

async function fetchJson<T>(path: string, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(assetUrl(path));
  if (!res.ok) throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function buildCatalog(
  stars: StarCatalogFile,
  names: StarNamesFile,
  constellationsFile: ConstellationsFile,
  messierFile: MessierFile,
): Catalog {
  const constellations = parseConstellations(constellationsFile);
  return {
    stars: parseStarCatalog(stars, names),
    constellations,
    constellationsByAbbr: new Map(constellations.map((c) => [c.abbr, c])),
    messier: parseMessier(messierFile),
  };
}

/** Loads all bundled catalogs (served from /catalogs, precached by the service worker). */
export async function loadCatalog(fetchImpl: typeof fetch = fetch): Promise<Catalog> {
  const [stars, names, constellations, messier] = await Promise.all([
    fetchJson<StarCatalogFile>('catalogs/stars.json', fetchImpl),
    fetchJson<StarNamesFile>('catalogs/star-names.json', fetchImpl),
    fetchJson<ConstellationsFile>('catalogs/constellations.json', fetchImpl),
    fetchJson<MessierFile>('catalogs/messier.json', fetchImpl),
  ]);
  return buildCatalog(stars, names, constellations, messier);
}
