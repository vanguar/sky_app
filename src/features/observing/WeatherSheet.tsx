import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { Stars } from '../../components/Stars';
import { useUiStore } from '../../store/ui-store';
import { gradeFromScore, starsForGrade } from '../../weather/observing-conditions';
import type { WeatherHour } from '../../weather/types';
import { formatNumber, formatTime, formatTimeRange } from '../../utils/format';
import {
  GradeBadge,
  OpenMeteoAttribution,
  ReasonList,
  TimeZoneNote,
  WeatherConsent,
  WeatherStatusLine,
} from './observing-ui';
import { GRADE_CLASS } from './observing-format';
import { useObserverTimeZone, useTonight, useWeather } from './use-weather';

function pct(v: number | null, t: TFunction, lang: string): string {
  return v == null ? t('common.notAvailable') : t('units.percent', { value: formatNumber(v, lang, 0) });
}

function WeatherFacts({ hour }: { hour: WeatherHour }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const na = t('common.notAvailable');
  const rows: [string, string, string][] = [
    ['cloud', t('observing.cloudCover'), pct(hour.cloudCover, t, lang)],
    [
      'layers',
      t('observing.cloudLayers'),
      [hour.cloudCoverLow, hour.cloudCoverMid, hour.cloudCoverHigh]
        .map((v) => (v == null ? na : formatNumber(v, lang, 0)))
        .join(' / ') + ' %',
    ],
    [
      'visibility',
      t('observing.visibility'),
      hour.visibilityM == null
        ? na
        : t('units.km', { value: formatNumber(hour.visibilityM / 1000, lang, hour.visibilityM < 10000 ? 1 : 0) }),
    ],
    ['humidity', t('observing.humidity'), pct(hour.humidity, t, lang)],
    [
      'dew',
      t('observing.dewPoint'),
      hour.dewPointC == null ? na : t('units.celsius', { value: formatNumber(hour.dewPointC, lang, 0) }),
    ],
    [
      'wind',
      t('observing.wind'),
      hour.windSpeedKmh == null
        ? na
        : t('units.kmh', { value: formatNumber(hour.windSpeedKmh, lang, 0) }) +
          (hour.windGustsKmh != null
            ? ` · ${t('observing.gusts')} ${t('units.kmh', { value: formatNumber(hour.windGustsKmh, lang, 0) })}`
            : ''),
    ],
    ['precip', t('observing.precipitationProbability'), pct(hour.precipitationProbability, t, lang)],
    [
      'precipAmount',
      t('observing.precipitation'),
      hour.precipitationMm == null ? na : t('units.mm', { value: formatNumber(hour.precipitationMm, lang, 1) }),
    ],
    [
      'temp',
      t('observing.temperature'),
      hour.temperatureC == null ? na : t('units.celsius', { value: formatNumber(hour.temperatureC, lang, 0) }),
    ],
  ];
  return (
    <dl className="facts weather-facts">
      {rows.map(([id, label, value]) => (
        <div className="fact" key={id}>
          <dt>{label}</dt>
          <dd dir="ltr" data-testid={`wx-${id}`}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Observing conditions: current rating, why, hourly outlook and the best window tonight. */
export function WeatherSheet() {
  const { t, i18n } = useTranslation();
  const open = useUiStore((s) => s.panel === 'weather');
  const close = useUiStore((s) => s.closePanel);
  const weather = useWeather({ fetch: open });
  const zone = useObserverTimeZone();
  const tonight = useTonight(open);
  const lang = i18n.language;
  const tz = zone.timeZone;

  return (
    <Sheet open={open} title={t('observing.title')} onClose={close} testId="weather-sheet" className="sheet-tall">
      {!weather.enabled ? (
        <>
          <WeatherConsent />
          <p className="hint small">{t('observing.disabledHint')}</p>
        </>
      ) : (
        <>
          <WeatherStatusLine
            status={weather.status}
            forecast={weather.forecast}
            error={weather.error}
            now={tonight.now}
            onRetry={weather.retry}
          />
          {weather.forecast && !tonight.current && (
            <p className="weather-status warn" data-testid="weather-no-current">
              {t('observing.unavailable')}
            </p>
          )}
          {tonight.current && (
            <section className="sheet-section" data-testid="weather-now">
              <h3>{t('observing.weatherNow')}</h3>
              <GradeBadge grade={tonight.current.weather.grade} testId="weather-grade" />
              <p className="small muted" data-testid="weather-score">
                {t('observing.scoreValue', { value: tonight.current.weather.score })}
              </p>
              <ReasonList reasons={tonight.current.weather.reasons} testId="weather-reasons" />
              {tonight.hourly[0] && tonight.hourly[0].observing.phase === 'day' && (
                <p className="hint small">{t('observing.daylightNote')}</p>
              )}
              {tonight.hourly[0] &&
                ['civil', 'nautical', 'astronomical'].includes(tonight.hourly[0].observing.phase) && (
                  <p className="hint small">{t('observing.twilightNote')}</p>
                )}
            </section>
          )}

          {tonight.hourly.length > 0 && (
            <section className="sheet-section">
              <h3>{t('observing.bestWindow')}</h3>
              {!tonight.night ? (
                <p data-testid="best-window-none">{t('observing.noNight')}</p>
              ) : tonight.bestWindow ? (
                <p className="best-window" data-testid="best-window">
                  <strong dir="ltr">
                    {formatTimeRange(new Date(tonight.bestWindow.start), new Date(tonight.bestWindow.end), lang, tz)}
                  </strong>{' '}
                  <span className={GRADE_CLASS[gradeFromScore(tonight.bestWindow.meanScore)]}>
                    <Stars value={starsForGrade(gradeFromScore(tonight.bestWindow.meanScore))} />
                  </span>
                  {tonight.bestWindowMediocre && (
                    <span className="muted small"> · {t('observing.bestWindowMediocre')}</span>
                  )}
                </p>
              ) : (
                <p data-testid="best-window-none">{t('observing.noWindow')}</p>
              )}
            </section>
          )}

          {tonight.hourly.length > 0 && (
            <section className="sheet-section">
              <h3>{t('observing.hourly')}</h3>
              <ol className="hourly-strip" data-testid="hourly-strip" aria-label={t('observing.hourly')}>
                {tonight.hourly.map((h) => (
                  <li
                    key={h.time}
                    className={`hour-cell ${h.observing.phase === 'day' ? 'is-day' : ''} ${GRADE_CLASS[h.observing.grade]}`}
                  >
                    <span className="hour-time" dir="ltr">
                      {formatTime(new Date(h.time), lang, tz)}
                    </span>
                    <Stars value={starsForGrade(h.observing.grade)} size={11} />
                    <span className="hour-cloud" dir="ltr">
                      {h.hour.cloudCover == null ? '—' : `${formatNumber(h.hour.cloudCover, lang, 0)}%`}
                    </span>
                    <span className="hour-phase">{t(`observing.phases.${h.observing.phase}`)}</span>
                  </li>
                ))}
              </ol>
              <p className="small muted">{t('observing.hourlyHint')}</p>
            </section>
          )}
          {tonight.current && (
            <section className="sheet-section" data-testid="weather-details">
              <h3>{t('details.detailed')}</h3>
              <WeatherFacts hour={tonight.current.hour} />
            </section>
          )}
          <section className="sheet-section">
            <p className="small muted">{t('observing.estimateNote')}</p>
            <TimeZoneNote zone={zone} />
            <OpenMeteoAttribution />
          </section>
        </>
      )}
    </Sheet>
  );
}
