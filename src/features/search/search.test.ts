import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildCatalog } from '../../catalog/loader';
import { resolveObject } from '../../catalog/object-registry';
import type { Catalog } from '../../catalog/types';
import { RESOURCES } from '../../i18n/languages';
import { buildSearchIndex, normalizeSearchText, searchIndex, type SearchEntry } from './search-index';

const read = (f: string) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'catalogs', f), 'utf8'));

let catalog: Catalog;
let index: SearchEntry[];

beforeAll(() => {
  catalog = buildCatalog(
    read('stars.json'),
    read('star-names.json'),
    read('constellations.json'),
    read('messier.json'),
  );
  index = buildSearchIndex(catalog, RESOURCES);
});

const top = (q: string) => searchIndex(index, q, 5)[0]?.id;

describe('catalogs', () => {
  it('contains 88 constellations with 12 zodiac members, and 110 Messier objects', () => {
    expect(catalog.constellations).toHaveLength(88);
    const zodiac = catalog.constellations.filter((c) => c.zodiac).map((c) => c.abbr);
    expect(zodiac).toHaveLength(12);
    expect(zodiac).not.toContain('UMa');
    expect(zodiac).not.toContain('Oph');
    expect(catalog.messier).toHaveLength(110);
  });

  it('contains several thousand stars with sane values', () => {
    expect(catalog.stars.stars.length).toBeGreaterThan(5000);
    const sirius = catalog.stars.byHip.get(32349)!;
    expect(sirius.name).toBe('Sirius');
    expect(sirius.mag).toBeLessThan(-1.4);
    expect(sirius.constellation).toBe('CMa');
    expect(sirius.spectral.startsWith('A')).toBe(true);
  });

  it('resolves object ids', () => {
    expect(resolveObject('jupiter', catalog)?.kind).toBe('planet');
    expect(resolveObject('m31', catalog)?.kind).toBe('messier');
    expect(resolveObject('con-ori', catalog)?.kind).toBe('constellation');
    expect(resolveObject('hip-32349', catalog)?.kind).toBe('star');
    expect(resolveObject('nope', catalog)).toBeNull();
  });
});

describe('search', () => {
  it('normalises text', () => {
    expect(normalizeSearchText('  Andromède ')).toBe('andromede');
    expect(normalizeSearchText('M-31')).toBe('m 31');
  });

  it('finds planets in several languages', () => {
    expect(top('Jupiter')).toBe('jupiter');
    expect(top('Юпитер')).toBe('jupiter');
    expect(top('Юпітер')).toBe('jupiter');
    expect(top('Giove')).toBe('jupiter');
    expect(top('المشتري')).toBe('jupiter');
  });

  it('finds Messier objects by designation and name', () => {
    expect(top('M31')).toBe('m31');
    expect(top('m 31')).toBe('m31');
    expect(top('Messier 42')).toBe('m42');
    expect(top('NGC 224')).toBe('m31');
    expect(top('Pleiades')).toBe('m45');
    expect(top('Плеяды')).toBe('m45');
  });

  it('finds constellations, preferring them for "Andromeda"', () => {
    const hits = searchIndex(index, 'Andromeda', 10).map((h) => h.id);
    expect(hits).toContain('con-and');
    expect(hits).toContain('m31');
    expect(top('Андромеда')).toBe('con-and');
    expect(top('Orion')).toBe('con-ori');
    expect(top('Großer Bär')).toBe('con-uma');
  });

  it('finds stars by name and designation', () => {
    expect(top('Sirius')).toBe('hip-32349');
    expect(top('Сириус')).toBe('hip-32349');
    expect(top('Wega')).toBe('hip-91262');
    expect(top('α CMa')).toBe('hip-32349');
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(searchIndex(index, '')).toEqual([]);
    expect(searchIndex(index, 'zzzzqqq')).toEqual([]);
  });
});
