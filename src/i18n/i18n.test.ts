import { describe, expect, it } from 'vitest';
import { LANGUAGES, RESOURCES, detectBrowserLanguage, languageDirection } from './languages';

type Json = { [k: string]: string | Json };

function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort().join(',');

describe('localization', () => {
  const en = flatten(RESOURCES.en as unknown as Json);

  it('ships all eight languages', () => {
    expect(LANGUAGES.map((l) => l.code).sort()).toEqual(['ar', 'de', 'en', 'es', 'fr', 'it', 'ru', 'uk']);
  });

  for (const lang of LANGUAGES) {
    it(`${lang.code}: has every key of the English source, non-empty, with matching placeholders`, () => {
      const dict = flatten(RESOURCES[lang.code] as unknown as Json);
      const missing = Object.keys(en).filter((k) => !(k in dict));
      expect(missing).toEqual([]);
      const extra = Object.keys(dict).filter((k) => !(k in en));
      expect(extra).toEqual([]);
      for (const [k, v] of Object.entries(dict)) {
        expect(v.trim().length, `${lang.code}:${k} empty`).toBeGreaterThan(0);
        expect(placeholders(v), `${lang.code}:${k} placeholders`).toBe(placeholders(en[k]));
      }
    });
  }

  it('marks only Arabic as right-to-left', () => {
    expect(languageDirection('ar')).toBe('rtl');
    for (const l of LANGUAGES.filter((x) => x.code !== 'ar')) expect(languageDirection(l.code)).toBe('ltr');
  });

  it('detects browser languages with region subtags and falls back to null', () => {
    expect(detectBrowserLanguage(['de-AT', 'en'])).toBe('de');
    expect(detectBrowserLanguage(['pt-BR', 'uk-UA'])).toBe('uk');
    expect(detectBrowserLanguage(['ja', 'zh'])).toBeNull();
    expect(detectBrowserLanguage(undefined)).toBeNull();
  });
});
