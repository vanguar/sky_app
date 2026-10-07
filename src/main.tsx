import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { App } from './app/App';
import { PlatformProvider } from './app/providers/PlatformProvider';
import { initI18n } from './i18n';
import { DEFAULT_LANGUAGE, detectBrowserLanguage } from './i18n/languages';
import { useSettingsStore } from './store/settings-store';
import './styles.css';

// Language: saved choice → browser preference → English (onboarding then asks).
const saved = useSettingsStore.getState().language;
const detected = detectBrowserLanguage(typeof navigator !== 'undefined' ? navigator.languages : undefined);
const i18n = initI18n(saved ?? detected ?? DEFAULT_LANGUAGE);
const askLanguage = !saved && !detected;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <PlatformProvider>
        <App askLanguage={askLanguage} />
      </PlatformProvider>
    </I18nextProvider>
  </StrictMode>,
);
