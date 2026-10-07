import type { SolarBodyId } from '../astronomy/types';

export type LanguageCode = 'en' | 'ru' | 'uk' | 'de' | 'fr' | 'es' | 'it' | 'ar';

export type LocalizedNames = Partial<Record<LanguageCode, string>>;

export interface StarRecord {
  id: string;
  index: number;
  hip: number;
  raDeg: number;
  decDeg: number;
  mag: number;
  bv: number | null;
  parallaxMas: number | null;
  spectral: string;
  constellation: string;
  name: string | null;
  bayer: string | null;
  flamsteed: string | null;
  localNames: LocalizedNames;
}

export interface StarCatalog {
  stars: StarRecord[];
  byHip: Map<number, StarRecord>;
}

export interface ConstellationRecord {
  id: string;
  /** IAU three-letter abbreviation, e.g. "Ori". */
  abbr: string;
  latin: string;
  genitive: string;
  rank: number;
  zodiac: boolean;
  eclipticCrossing: boolean;
  names: Record<LanguageCode, string>;
  meaningEn: string;
  /** Label anchor(s), [raDeg, decDeg]. */
  labels: [number, number][];
  /** Stick-figure polylines, [raDeg, decDeg] points. */
  lines: [number, number][][];
  /** IAU boundary rings, [raDeg, decDeg] points. */
  bounds: [number, number][][];
}

export type DeepSkyCategory =
  'galaxy' | 'nebula' | 'planetaryNebula' | 'openCluster' | 'globularCluster' | 'other';

export interface MessierRecord {
  id: string;
  /** "M31" */
  designation: string;
  number: number;
  ngc: string | null;
  commonName: string | null;
  category: DeepSkyCategory;
  subtype: string | null;
  mag: number | null;
  sizeArcmin: string | null;
  raDeg: number;
  decDeg: number;
  constellation: string;
  distanceLy: number | null;
}

export interface Catalog {
  stars: StarCatalog;
  constellations: ConstellationRecord[];
  constellationsByAbbr: Map<string, ConstellationRecord>;
  messier: MessierRecord[];
}

export type SkyObjectKind = 'sun' | 'moon' | 'planet' | 'star' | 'messier' | 'constellation';

/** Unified reference to anything selectable. */
export type SkyObjectRef =
  | { kind: 'sun' | 'moon' | 'planet'; id: SolarBodyId; body: SolarBodyId }
  | { kind: 'star'; id: string; star: StarRecord }
  | { kind: 'messier'; id: string; messier: MessierRecord }
  | { kind: 'constellation'; id: string; constellation: ConstellationRecord };
