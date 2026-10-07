import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LanguageCode } from '../catalog/types';
import { DEFAULT_LANGUAGE, RESOURCES, languageDirection } from './languages';

/** Applies lang/dir to <html> so CSS logical properties and RTL layout follow the language. */
export function applyDocumentLanguage(lang: LanguageCode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = languageDirection(lang);
}

export function initI18n(initial: LanguageCode = DEFAULT_LANGUAGE) {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: Object.fromEntries(Object.entries(RESOURCES).map(([k, v]) => [k, { translation: v }])),
      lng: initial,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false },
      returnNull: false,
      initImmediate: false,
    });
  }
  applyDocumentLanguage(initial);
  return i18n;
}

export async function changeLanguage(lang: LanguageCode): Promise<void> {
  await i18n.changeLanguage(lang);
  applyDocumentLanguage(lang);
}

export { i18n };
