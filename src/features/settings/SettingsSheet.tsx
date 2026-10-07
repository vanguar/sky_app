import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { calibrateHeadingOffset } from '../../sensors/calibration';
import { Sheet } from '../../components/Sheet';
import { Toggle } from '../../components/Toggle';
import { resolveObject, targetOf } from '../../catalog/object-registry';
import type { LanguageCode } from '../../catalog/types';
import { changeLanguage } from '../../i18n';
import { LANGUAGES } from '../../i18n/languages';
import { useCatalogStore } from '../../store/catalog-store';
import { useSettingsStore, MIN_BRIGHTNESS } from '../../store/settings-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { formatNumber } from '../../utils/format';
import { useObserver } from '../../utils/use-observer';
import { skyBridge } from '../sky/sky-bridge';
import type { SmoothingLevel } from '../../sensors/smoothing';
import { useInstallPrompt } from '../../app/pwa';

export function LanguageSelect({ testId }: { testId?: string }) {
  const { t, i18n } = useTranslation();
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  return (
    <label className="select-row">
      <span>{t('settings.language')}</span>
      <select
        value={i18n.language}
        onChange={(e) => {
          const lang = e.target.value as LanguageCode;
          setLanguage(lang);
          void changeLanguage(lang);
        }}
        data-testid={testId}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SettingsSheet() {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const open = useUiStore((s) => s.panel === 'settings' || s.panel === 'menu');
  const panel = useUiStore((s) => s.panel);
  const openPanel = useUiStore((s) => s.openPanel);
  const close = useUiStore((s) => s.closePanel);
  const pushToast = useUiStore((s) => s.pushToast);
  const s = useSettingsStore();
  const selectedId = useSkyStore((st) => st.selectedId);
  const viewMode = useSkyStore((st) => st.viewMode);
  const catalog = useCatalogStore((st) => st.catalog);
  const observer = useObserver();
  const install = useInstallPrompt();

  const calibrate = () => {
    const ref = selectedId ? resolveObject(selectedId, catalog) : null;
    const info = skyBridge.getLastInfo();
    if (!ref || !info || viewMode !== 'sensor') {
      pushToast({ messageKey: 'settings.calibrateNeedsTarget', tone: 'warning' });
      return;
    }
    const hor = platform.astronomy.getHorizontalCoordinates(targetOf(ref), platform.time.now(), observer);
    if (hor.altitude < 0) {
      pushToast({ messageKey: 'settings.calibrateNeedsTarget', tone: 'warning' });
      return;
    }
    const next = calibrateHeadingOffset(s.headingOffset, info.centerAzimuth, hor.azimuth);
    s.setHeadingOffset(next);
    pushToast({
      messageKey: 'settings.calibrated',
      values: { value: formatNumber(next, i18n.language, 1) },
      tone: 'info',
    });
  };

  return (
    <Sheet
      open={open}
      title={panel === 'menu' ? t('menu.title') : t('settings.title')}
      onClose={close}
      testId="settings-sheet"
      className="sheet-tall"
    >
      {panel === 'menu' && (
        <nav className="menu-list" aria-label={t('topbar.menu')}>
          <button type="button" className="menu-item" onClick={() => openPanel('search')}>
            {t('menu.search')}
          </button>
          <button type="button" className="menu-item" onClick={() => openPanel('layers')}>
            {t('menu.layers')}
          </button>
          <button type="button" className="menu-item" onClick={() => openPanel('location')}>
            {t('menu.location')}
          </button>
          {install && (
            <button type="button" className="menu-item" onClick={() => void install()}>
              {t('menu.install')}
            </button>
          )}
        </nav>
      )}
      <section className="sheet-section">
        <LanguageSelect testId="language-select" />
      </section>

      <section className="sheet-section">
        <h3>{t('settings.display')}</h3>
        <Toggle
          label={t('settings.nightMode')}
          hint={t('settings.nightModeHint')}
          checked={s.nightMode}
          onChange={s.setNightMode}
          testId="night-mode"
        />
        <Toggle label={t('settings.labels')} checked={s.showLabels} onChange={s.setShowLabels} />
        <label className="range-row">
          <span>{t('settings.brightness')}</span>
          <input
            type="range"
            min={MIN_BRIGHTNESS}
            max={1}
            step={0.05}
            value={s.brightness}
            onChange={(e) => s.setBrightness(Number(e.target.value))}
            data-testid="brightness"
          />
        </label>
        <label className="select-row">
          <span>{t('settings.infoLevel')}</span>
          <select
            value={s.infoLevel}
            onChange={(e) => s.setInfoLevel(e.target.value as 'brief' | 'detailed')}
          >
            <option value="brief">{t('details.brief')}</option>
            <option value="detailed">{t('details.detailed')}</option>
          </select>
        </label>
      </section>

      <section className="sheet-section">
        <h3>{t('settings.sensors')}</h3>
        <label className="select-row">
          <span>{t('settings.smoothing')}</span>
          <select value={s.smoothing} onChange={(e) => s.setSmoothing(e.target.value as SmoothingLevel)}>
            <option value="low">{t('settings.smoothingLow')}</option>
            <option value="medium">{t('settings.smoothingMedium')}</option>
            <option value="high">{t('settings.smoothingHigh')}</option>
          </select>
        </label>
        <label className="range-row">
          <span>
            {t('settings.headingOffset')}:{' '}
            <strong dir="ltr">{formatNumber(s.headingOffset, i18n.language, 0)}°</strong>
          </span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={s.headingOffset}
            onChange={(e) => s.setHeadingOffset(Number(e.target.value))}
            aria-describedby="heading-hint"
          />
          <small id="heading-hint">{t('settings.headingOffsetHint')}</small>
        </label>
        <div className="row-buttons">
          <button type="button" className="btn btn-small" onClick={calibrate}>
            {t('settings.calibrate')}
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => s.setHeadingOffset(0)}>
            {t('settings.resetCalibration')}
          </button>
        </div>
        <p className="hint small">{t('settings.calibrateHint')}</p>
        <p className="hint small">{t('sensors.compassHint')}</p>
      </section>

      <section className="sheet-section" id="about">
        <h3>{t('settings.about')}</h3>
        <p className="small">{t('settings.aboutText')}</p>
        <h3>{t('settings.privacy')}</h3>
        <p className="small">{t('settings.privacyText')}</p>
        <p className="small muted">{t('settings.dataSources')}</p>
        <p className="small muted">{t('settings.version', { version: __APP_VERSION__ })}</p>
        <button
          type="button"
          className="btn btn-small btn-ghost"
          onClick={() => {
            if (window.confirm(t('settings.resetConfirm'))) {
              s.resetAll();
              close();
            }
          }}
        >
          {t('settings.resetAll')}
        </button>
      </section>
    </Sheet>
  );
}
