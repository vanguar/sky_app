import type { LanguageCode, StarCatalog, StarRecord } from '../types';

/** On-disk format of public/catalogs/stars.json (see scripts/build-catalogs.mjs). */
export interface StarCatalogFile {
  version: number;
  stride: number;
  data: number[];
  spectral: string[];
  constellation: string[];
}

export interface StarNameEntry {
  c?: string;
  n?: string;
  b?: string;
  f?: string;
  l?: Partial<Record<LanguageCode, string>>;
}

export type StarNamesFile = Record<string, StarNameEntry>;

export function starId(hip: number): string {
  return `hip-${hip}`;
}

export function parseStarCatalog(file: StarCatalogFile, names: StarNamesFile): StarCatalog {
  if (!file || !Array.isArray(file.data) || file.stride !== 6) throw new Error('Invalid star catalog');
  const count = Math.floor(file.data.length / file.stride);
  const stars: StarRecord[] = new Array(count);
  const byHip = new Map<number, StarRecord>();
  for (let i = 0; i < count; i++) {
    const o = i * 6;
    const hip = file.data[o];
    const bv = file.data[o + 4];
    const plx = file.data[o + 5];
    const n = names[String(hip)];
    const rec: StarRecord = {
      id: starId(hip),
      index: i,
      hip,
      raDeg: file.data[o + 1],
      decDeg: file.data[o + 2],
      mag: file.data[o + 3],
      bv: bv === 99 ? null : bv,
      parallaxMas: plx < 0 ? null : plx,
      spectral: file.spectral[i] ?? '',
      constellation: file.constellation[i] ?? n?.c ?? '',
      name: n?.n ?? null,
      bayer: n?.b ?? null,
      flamsteed: n?.f ?? null,
      localNames: n?.l ?? {},
    };
    stars[i] = rec;
    byHip.set(hip, rec);
  }
  return { stars, byHip };
}

/** Localised proper name of a star, or null if it has none. */
export function starProperName(star: StarRecord, lang: LanguageCode): string | null {
  if (!star.name) return null;
  return star.localNames[lang] ?? star.name;
}

/** Catalogue designation such as "α CMa", "61 Cyg" or "HIP 12345". */
export function starDesignation(star: StarRecord): string {
  if (star.bayer && star.constellation) return `${star.bayer} ${star.constellation}`;
  if (star.flamsteed && star.constellation) return `${star.flamsteed} ${star.constellation}`;
  return `HIP ${star.hip}`;
}

/**
 * Effective temperature estimated from the B−V colour index (Ballesteros 2012).
 * Only an approximation — the UI labels it as an estimate.
 */
export function temperatureFromBV(bv: number): number {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Distance in light-years from a Hipparcos parallax (mas); null when unreliable. */
export function distanceFromParallax(parallaxMas: number | null): number | null {
  if (parallaxMas == null || parallaxMas <= 1) return null; // < 1 mas → > ~3000 ly, too uncertain
  return 3261.56 / parallaxMas;
}

/** Approximate RGB colour (0…1) for a B−V index, for rendering. */
export function bvToRgb(bv: number | null): [number, number, number] {
  const b = bv == null ? 0.6 : Math.max(-0.4, Math.min(2.0, bv));
  // Piecewise fit (after Mitchell Charity's blackbody table), softened for display.
  let r: number;
  let g: number;
  let bl: number;
  if (b < 0) {
    r = 0.65 + (0.35 * (b + 0.4)) / 0.4;
    g = 0.75 + (0.2 * (b + 0.4)) / 0.4;
    bl = 1;
  } else if (b < 0.4) {
    r = 1;
    g = 0.95 + 0.05 * (1 - b / 0.4);
    bl = 1 - 0.2 * (b / 0.4);
  } else if (b < 1.0) {
    r = 1;
    g = 0.95 - 0.2 * ((b - 0.4) / 0.6);
    bl = 0.8 - 0.35 * ((b - 0.4) / 0.6);
  } else {
    r = 1;
    g = 0.75 - 0.2 * Math.min(1, (b - 1.0) / 1.0);
    bl = 0.45 - 0.2 * Math.min(1, (b - 1.0) / 1.0);
  }
  return [r, g, bl];
}
