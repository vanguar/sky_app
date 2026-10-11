import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '../../catalog/types';
import { changeLanguage } from '../../i18n';
import { LANGUAGES } from '../../i18n/languages';
import { useSettingsStore } from '../../store/settings-store';

export function LanguageSelect({ testId }: { testId?: string }) {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const [failed, setFailed] = useState(false);
  return (
    <label className="select-row">
      <span>{t('settings.language')}</span>
      <select
        value={i18n.language}
        onChange={(e) => {
          const lang = e.target.value as LanguageCode;
          setFailed(false);
          void changeLanguage(lang)
            .then(() => {
              setLanguage(i18n.language as LanguageCode);
            })
            .catch(() => setFailed(true));
        }}
        data-testid={testId}
      >
        {LANGUAGES.map((language) => (
          <option key={language.code} value={language.code} lang={language.code}>
            {language.nativeName}
          </option>
        ))}
      </select>
      {failed && <span role="alert">{t('common.retry')}</span>}
    </label>
  );
}
