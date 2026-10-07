import type { LanguageCode } from '../catalog/types';
import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import ru from './ru.json';
import uk from './uk.json';

export interface LanguageInfo {
  code: LanguageCode;
  /** Native language name — not translated on purpose. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: 'en', nativeName: 'English', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', dir: 'ltr' },
  { code: 'uk', nativeName: 'Українська', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', dir: 'ltr' },
  { code: 'it', nativeName: 'Italiano', dir: 'ltr' },
  { code: 'ar', nativeName: 'العربية', dir: 'rtl' },
];

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = LANGUAGES.map((l) => l.code);

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const RESOURCES = { en, ru, uk, de, fr, es, it, ar } as const;

export function isSupportedLanguage(code: unknown): code is LanguageCode {
  return typeof code === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

export function languageDirection(code: LanguageCode): 'ltr' | 'rtl' {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? 'ltr';
}

/**
 * Picks the first supported language from the browser preference list ("de-AT" → "de").
 * Returns null when none is supported (onboarding then asks the user).
 */
export function detectBrowserLanguage(preferred: readonly string[] | undefined): LanguageCode | null {
  for (const tag of preferred ?? []) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isSupportedLanguage(base)) return base;
  }
  return null;
}
