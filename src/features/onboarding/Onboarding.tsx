import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { Icon } from '../../components/Icon';
import { useSettingsStore } from '../../store/settings-store';
import { LanguageSelect } from '../settings/SettingsSheet';
import { LocationForm } from '../settings/LocationForm';
import { enableSensorMode } from '../sky/sensor-mode';

type Step = 'welcome' | 'language' | 'location' | 'sensors';

/** Short first-run flow: welcome → (language) → location → optional sensors → sky. */
export function Onboarding({ askLanguage }: { askLanguage: boolean }) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const complete = useSettingsStore((s) => s.completeOnboarding);
  const steps: Step[] = askLanguage
    ? ['welcome', 'language', 'location', 'sensors']
    : ['welcome', 'location', 'sensors'];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const next = () => (index < steps.length - 1 ? setIndex(index + 1) : complete());
  const sensorsAvailable = platform.sensors.getCapabilities().orientation;

  return (
    <div
      className="onboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-title"
      data-testid="onboarding"
    >
      <div className="onboarding-card glass">
        <p className="muted small" aria-live="polite">
          {t('onboarding.step', { current: index + 1, total: steps.length })}
        </p>
        {step === 'welcome' && (
          <>
            <div className="onboarding-logo" aria-hidden="true">
              <Icon name="target" size={56} />
            </div>
            <h1 id="onb-title">{t('onboarding.welcomeTitle')}</h1>
            <p className="tagline">{t('app.tagline')}</p>
            <p>{t('onboarding.welcomeText')}</p>
            {!askLanguage && <LanguageSelect testId="onboarding-language" />}
            <button
              type="button"
              className="btn btn-accent btn-block"
              onClick={next}
              data-testid="onboarding-start"
              data-autofocus
            >
              {t('onboarding.start')}
            </button>
          </>
        )}
        {step === 'language' && (
          <>
            <h1 id="onb-title">{t('onboarding.languageTitle')}</h1>
            <LanguageSelect testId="onboarding-language" />
            <button type="button" className="btn btn-accent btn-block" onClick={next}>
              {t('common.next')}
            </button>
          </>
        )}
        {step === 'location' && (
          <>
            <h1 id="onb-title">{t('onboarding.locationTitle')}</h1>
            <p>{t('onboarding.locationText')}</p>
            <LocationForm onDone={next} />
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={next}
              data-testid="onboarding-skip-location"
            >
              {t('common.skip')}
            </button>
          </>
        )}
        {step === 'sensors' && (
          <>
            <h1 id="onb-title">{t('onboarding.sensorsTitle')}</h1>
            <p>{t('onboarding.sensorsText')}</p>
            {sensorsAvailable ? (
              <button
                type="button"
                className="btn btn-accent btn-block"
                onClick={() => {
                  // Must be called synchronously inside the tap for iOS permission prompts.
                  void enableSensorMode(platform);
                  complete();
                }}
                data-testid="onboarding-enable-sensors"
              >
                <Icon name="phone" size={18} /> {t('onboarding.enableSensors')}
              </button>
            ) : (
              <p className="hint">{t('sensors.unavailable')}</p>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={complete}
              data-testid="onboarding-finish"
            >
              {sensorsAvailable ? t('onboarding.later') : t('onboarding.finish')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
