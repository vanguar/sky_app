import { SOLAR_BODY_IDS } from '../../astronomy/types';
import { starDesignation } from '../../catalog/stars/stars';
import type { Catalog, SkyObjectKind } from '../../catalog/types';

export interface SearchEntry {
  id: string;
  kind: SkyObjectKind;
  /** Normalised search terms (all languages + designations). */
  terms: string[];
  /** Lower = more prominent (used as a tie-breaker). */
  prominence: number;
}

export type NameDictionary = Record<
  string,
  { bodies?: Record<string, string>; messierNames?: Record<string, string> }
>;

/**
 * Lower-cases, strips diacritics and punctuation so "Andromède", "andromede" and "M 31" match.
 * Combining marks are removed after NFD decomposition; Cyrillic й/ё are folded consistently on both sides.
 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ‎‏]/g, '')
    .toLowerCase()
    .replace(/[’'`´·.,\-_/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const compact = (s: string) => s.replace(/\s+/g, '');

function addTerms(target: Set<string>, ...values: (string | null | undefined)[]) {
  for (const v of values) {
    if (!v) continue;
    const n = normalizeSearchText(v);
    if (!n) continue;
    target.add(n);
    const c = compact(n);
    if (c !== n) target.add(c);
  }
}

/** Builds the local search index from catalogs and the localisation dictionaries of every language. */
export function buildSearchIndex(catalog: Catalog, dictionaries: NameDictionary): SearchEntry[] {
  const entries: SearchEntry[] = [];
  const langs = Object.values(dictionaries);

  for (const id of SOLAR_BODY_IDS) {
    const terms = new Set<string>();
    addTerms(terms, id, ...langs.map((d) => d.bodies?.[id]));
    entries.push({
      id,
      kind: id === 'sun' ? 'sun' : id === 'moon' ? 'moon' : 'planet',
      terms: [...terms],
      prominence: -30,
    });
  }

  for (const c of catalog.constellations) {
    const terms = new Set<string>();
    addTerms(terms, c.latin, c.abbr, c.genitive, c.meaningEn, ...Object.values(c.names));
    entries.push({ id: c.id, kind: 'constellation', terms: [...terms], prominence: -5 + c.rank });
  }

  for (const m of catalog.messier) {
    const terms = new Set<string>();
    addTerms(
      terms,
      m.designation,
      `Messier ${m.number}`,
      m.ngc,
      m.commonName,
      ...langs.map((d) => d.messierNames?.[m.designation]),
    );
    entries.push({ id: m.id, kind: 'messier', terms: [...terms], prominence: m.mag ?? 10 });
  }

  for (const s of catalog.stars.stars) {
    // Only stars with a name or classical designation are searchable (plus HIP numbers).
    if (!s.name && !s.bayer && !s.flamsteed) continue;
    const terms = new Set<string>();
    addTerms(terms, s.name, ...Object.values(s.localNames), starDesignation(s), `HIP ${s.hip}`);
    entries.push({ id: s.id, kind: 'star', terms: [...terms], prominence: s.mag });
  }

  return entries;
}

export interface SearchHit {
  id: string;
  kind: SkyObjectKind;
  score: number;
}

/** Ranks entries: exact > prefix > word-prefix > substring; ties by prominence. */
export function searchIndex(index: SearchEntry[], query: string, limit = 30): SearchHit[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const qc = compact(q);
  const hits: SearchHit[] = [];
  for (const e of index) {
    let best = 0;
    for (const term of e.terms) {
      let s = 0;
      if (term === q || term === qc) s = 100;
      else if (term.startsWith(q) || term.startsWith(qc)) s = 70;
      else if (term.includes(` ${q}`)) s = 50;
      else if (q.length >= 3 && term.includes(q)) s = 30;
      if (s > best) best = s;
      if (best === 100) break;
    }
    if (best > 0) hits.push({ id: e.id, kind: e.kind, score: best - e.prominence * 0.5 });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
