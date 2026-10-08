import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Stars } from '../../components/Stars';
import { useSettingsStore } from '../../store/settings-store';
import type { WeatherStatus } from '../../store/weather-store';
import { STALE_WARNING_MS, FRESH_TTL_MS } from '../../weather/cache';
import { starsForGrade, type ConditionsGrade } from '../../weather/observing-conditions';
import type { WeatherErrorKind, WeatherForecast } from '../../weather/types';
import type { ObserverTimeZone } from '../../utils/time-zone';
import { GRADE_CLASS, formatAge, useReasonText } from './observing-format';



export function GradeBadge({ grade, testId, label }: { grade: ConditionsGrade; testId?: string; label?: string }) {
  const { t } = useTranslation();
  return (
    <span className={`grade ${GRADE_CLASS[grade]}`} data-testid={testId} data-grade={grade}>
      <Stars value={starsForGrade(grade)} />
      <span className="grade-text">{label ?? t(`observing.grades.${grade}`)}</span>
    </span>
  );
}


export function ReasonList({ reasons, max = 4, testId }: { reasons: string[]; max?: number; testId?: string }) {
  const text = useReasonText();
  return (
    <ul className="reason-list" data-testid={testId}>
      {reasons.slice(0, max).map((r) => (
        <li key={r}>{text(r)}</li>
      ))}
    </ul>
  );
}

/**
 * Freshness line: "Last forecast · updated 47 min ago", outdated warning, refresh failure,
 * offline without cache. Old data are never presented as current.
 */
export function WeatherStatusLine({
  status,
  forecast,
  error,
  now,
  onRetry,
}: {
  status: WeatherStatus;
  forecast: WeatherForecast | null;
  error: WeatherErrorKind | null;
  now: number;
  onRetry(): void;
}) {
  const { t, i18n } = useTranslation();
  if (!forecast) {
    if (status === 'loading' || status === 'idle')
      return (
        <p className="weather-status muted" data-testid="weather-loading">
          {t('observing.loading')}
        </p>
      );
    return (
      <div className="weather-status warn" role="status" data-testid="weather-unavailable">
        <p>{error === 'offline' ? t('observing.offlineNoCache') : t('observing.unavailable')}</p>
        <button type="button" className="btn btn-small" onClick={onRetry} data-testid="weather-retry">
          <Icon name="refresh" size={16} /> {t('observing.retry')}
        </button>
      </div>
    );
  }
  const age = now - forecast.fetchedAt;
  const ageText = formatAge(age, t, i18n.language);
  const failed = status === 'fallback' && error != null;
  const old = age >= STALE_WARNING_MS;
  const showLast = failed || age >= FRESH_TTL_MS || status === 'fallback';
  return (
    <div className={`weather-status ${old || failed ? 'warn' : 'muted'}`} role="status" data-testid="weather-status">
      {failed && <p data-testid="weather-refresh-failed">{t('observing.refreshFailed')}</p>}
      {old ? (
        <p data-testid="weather-outdated">{t('observing.outdated', { value: ageText })}</p>
      ) : (
        <p data-testid="weather-age">
          {showLast && <strong>{t('observing.lastForecast')} · </strong>}
          {t('observing.updatedAgo', { value: ageText })}
        </p>
      )}
      {(failed || showLast) && status !== 'loading' && (
        <button type="button" className="btn btn-small btn-ghost" onClick={onRetry} data-testid="weather-retry">
          <Icon name="refresh" size={16} /> {t('observing.retry')}
        </button>
      )}
    </div>
  );
}

/** One-time explanation before the first request leaves the device (no system permission dialog). */
export function WeatherConsent({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const setEnabled = useSettingsStore((s) => s.setWeatherEnabled);
  return (
    <div className={`weather-consent ${compact ? 'compact' : ''}`} data-testid="weather-consent">
      <p className="consent-title">
        <Icon name="cloud" size={18} /> <strong>{t('observing.consent.title')}</strong>
      </p>
      <p className="small">{t('observing.consent.text')}</p>
      <div className="row-buttons">
        <button
          type="button"
          className="btn btn-small btn-accent"
          onClick={() => setEnabled(true)}
          data-testid="weather-consent-accept"
        >
          {t('observing.consent.accept')}
        </button>
      </div>
    </div>
  );
}

export function TimeZoneNote({ zone }: { zone: ObserverTimeZone }) {
  const { t } = useTranslation();
  if (!zone.approximate) return null;
  return (
    <p className="small muted" data-testid="tz-note">
      {t('observing.timeZoneApprox', { zone: zone.label })}
    </p>
  );
}

export function OpenMeteoAttribution() {
  const { t } = useTranslation();
  return (
    <p className="small muted attribution">
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
        {t('observing.attribution')}
      </a>
    </p>
  );
}
