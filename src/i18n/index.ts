import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { LanguageCode } from '../catalog/types';
import { DEFAULT_LANGUAGE, languageDirection } from './languages';
import en from './en.json';

const loaders = {
  en: async () => ({ default: en }),
  ar: () => import('./ar.json'),
  de: () => import('./de.json'),
  es: () => import('./es.json'),
  fr: () => import('./fr.json'),
  it: () => import('./it.json'),
  ru: () => import('./ru.json'),
  uk: () => import('./uk.json'),
};

async function ensureLanguage(lang: LanguageCode) {
  if (!i18n.hasResourceBundle(lang, 'translation')) {
    const { default: dictionary } = await loaders[lang]();
    i18n.addResourceBundle(lang, 'translation', dictionary);
  }
}

let languageRequest = 0;

/** Applies lang/dir to <html> so CSS logical properties and RTL layout follow the language. */
export function applyDocumentLanguage(lang: LanguageCode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = languageDirection(lang);
}

export async function initI18n(initial: LanguageCode = DEFAULT_LANGUAGE) {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { en: { translation: en } },
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: { escapeValue: false },
      returnNull: false,
      initImmediate: false,
    });
  }
  try {
    await changeLanguage(initial);
  } catch {
    await changeLanguage(DEFAULT_LANGUAGE);
  }
  return i18n;
}

export async function changeLanguage(lang: LanguageCode): Promise<void> {
  const request = ++languageRequest;
  await ensureLanguage(lang);
  if (request !== languageRequest) return;
  await i18n.changeLanguage(lang);
  applyDocumentLanguage(lang);
}

export { i18n };
