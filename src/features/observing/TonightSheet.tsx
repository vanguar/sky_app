import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { Stars } from '../../components/Stars';
import { isActiveStatus } from '../../meteors/activity';
import { meteorObjectId } from '../../meteors/catalog';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { gradeFromScore, starsForGrade } from '../../weather/observing-conditions';
import { formatDayMonth, formatTime, formatTimeRange } from '../../utils/format';
import { useShowersTonight } from '../meteors/use-meteors';
import { GradeBadge, TimeZoneNote, WeatherConsent, WeatherStatusLine } from './observing-ui';
import { GRADE_CLASS } from './observing-format';
import { useObserverTimeZone, useTonight, useWeather } from './use-weather';

/**
 * "Tonight": answers in a few seconds — is it worth going out, when, and is there a meteor shower.
 * Kept short on purpose; details live in the conditions sheet and the shower cards.
 */
export function TonightSheet() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const open = useUiStore((s) => s.panel === 'tonight');
  const close = useUiStore((s) => s.closePanel);
  const openPanel = useUiStore((s) => s.openPanel);
  const select = useSkyStore((s) => s.select);
  const weather = useWeather({ fetch: open });
  const tonight = useTonight(open);
  const zone = useObserverTimeZone();
  const showers = useShowersTonight(tonight, open);
  const tz = zone.timeZone;
  if (!open) return null;

  const active = showers.filter((s) => isActiveStatus(s.activity.status));
  const upcoming = showers.filter((s) => s.activity.status === 'upcoming');
  const best = tonight.bestWindow;

  return (
    <Sheet open title={t('tonight.title')} onClose={close} testId="tonight-sheet" className="sheet-tall">
      <section className="sheet-section tonight-conditions">
        <h3>{t('tonight.conditions')}</h3>
        {!weather.enabled ? (
          <WeatherConsent compact />
        ) : (
          <>
            {tonight.current && <GradeBadge grade={tonight.current.weather.grade} testId="tonight-grade" />}
            {!tonight.night ? (
              <p>{t('observing.noNight')}</p>
            ) : best ? (
              <p data-testid="tonight-best-window">
                {t('observing.bestWindowShort')}{' '}
                <strong dir="ltr">{formatTimeRange(new Date(best.start), new Date(best.end), lang, tz)}</strong>
              </p>
            ) : tonight.hourly.length > 0 ? (
              <p>{t('observing.noWindow')}</p>
            ) : null}
            <WeatherStatusLine
              status={weather.status}
              forecast={weather.forecast}
              error={weather.error}
              now={tonight.now}
              onRetry={weather.retry}
            />
          </>
        )}
        <button type="button" className="btn btn-small" onClick={() => openPanel('weather')} data-testid="tonight-open-weather">
          <Icon name="cloud" size={16} /> {t('tonight.showConditions')}
        </button>
      </section>

      <section className="sheet-section">
        <h3>{t('tonight.activeShowers')}</h3>
        {active.length === 0 ? (
          <p data-testid="tonight-no-showers">{t('tonight.noShowers')}</p>
        ) : (
          <ul className="result-list" data-testid="tonight-showers">
            {active.slice(0, 4).map((s) => {
              const grade = gradeFromScore(s.plan.best?.score ?? s.now.score);
              const weak = s.activity.occurrence.zhr != null && s.activity.occurrence.zhr < 10;
              return (
                <li key={s.def.id} className="result-item">
                  <button
                    type="button"
                    className="result-main"
                    onClick={() => {
                      select(meteorObjectId(s.def.id));
                      openPanel('meteor');
                    }}
                    data-testid={`tonight-shower-${s.def.id}`}
                  >
                    <span className="result-name">
                      {t(`meteors.names.${s.def.id}`)}{' '}
                      <span className={GRADE_CLASS[grade]}>
                        <Stars value={starsForGrade(grade)} size={13} />
                      </span>
                    </span>
                    <span className="result-meta">
                      {t(`meteors.status.${s.activity.status}`)}
                      {s.plan.window && (
                        <>
                          {' · '}
                          {t('tonight.bestTime', {
                            time: formatTimeRange(new Date(s.plan.window.start), new Date(s.plan.window.end), lang, tz),
                          })}
                        </>
                      )}
                      {!s.plan.window && <> · {t('tonight.noGoodTime')}</>}
                      {s.plan.radiantHighAfter && (
                        <>
                          {' · '}
                          {t('tonight.radiantHigherAfter', {
                            time: formatTime(new Date(s.plan.radiantHighAfter), lang, tz),
                          })}
                        </>
                      )}
                      {weak && <> · {t('tonight.weakActivity')}</>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {upcoming.length > 0 && (
          <p className="small muted" data-testid="tonight-upcoming">
            {t('tonight.upcomingShowers')}:{' '}
            {upcoming
              .map(
                (s) =>
                  `${t(`meteors.names.${s.def.id}`)} (${formatDayMonth(new Date(s.activity.occurrence.start), lang, 'UTC')})`,
              )
              .join(', ')}
          </p>
        )}
        {weather.enabled === false && active.length > 0 && (
          <p className="small muted">{t('meteors.reasons.weatherUnknown')}</p>
        )}
        <button type="button" className="btn btn-small" onClick={() => openPanel('meteors')} data-testid="tonight-all-showers">
          <Icon name="meteor" size={16} /> {t('tonight.showAll')}
        </button>
      </section>
      <TimeZoneNote zone={zone} />
    </Sheet>
  );
}
