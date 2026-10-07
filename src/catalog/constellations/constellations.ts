import type { ConstellationRecord, LanguageCode } from '../types';

export interface ConstellationFileEntry {
  id: string;
  latin: string;
  genitive: string;
  rank: number;
  zodiac: boolean;
  eclipticCrossing: boolean;
  names: Record<LanguageCode, string>;
  meaningEn: string;
  labels: [number, number][];
  lines: [number, number][][];
  bounds: [number, number][][];
}

export interface ConstellationsFile {
  version: number;
  constellations: ConstellationFileEntry[];
}

/** The 12 classical zodiac constellations, in ecliptic order. Ophiuchus crosses the ecliptic but is not zodiacal. */
export const ZODIAC_ABBRS = [
  'Ari',
  'Tau',
  'Gem',
  'Cnc',
  'Leo',
  'Vir',
  'Lib',
  'Sco',
  'Sgr',
  'Cap',
  'Aqr',
  'Psc',
] as const;

export function constellationId(abbr: string): string {
  return `con-${abbr.toLowerCase()}`;
}

export function parseConstellations(file: ConstellationsFile): ConstellationRecord[] {
  if (!file || !Array.isArray(file.constellations)) throw new Error('Invalid constellation catalog');
  return file.constellations.map((c) => ({
    id: constellationId(c.id),
    abbr: c.id,
    latin: c.latin,
    genitive: c.genitive,
    rank: c.rank,
    zodiac: c.zodiac,
    eclipticCrossing: c.eclipticCrossing,
    names: c.names,
    meaningEn: c.meaningEn,
    labels: c.labels,
    lines: c.lines,
    bounds: c.bounds,
  }));
}

export function constellationName(c: ConstellationRecord, lang: LanguageCode): string {
  return c.names[lang] ?? c.latin;
}
