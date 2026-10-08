import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { azimuthToCompassPoint } from '../../astronomy/coordinate-transform';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { constellationName } from '../../catalog/constellations/constellations';
import type { LanguageCode } from '../../catalog/types';
import { showerFromObjectId } from '../../meteors/catalog';
import { useCatalogStore } from '../../store/catalog-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { formatDayMonth, formatDegrees, formatNumber, formatTime, formatTimeRange } from '../../utils/format';
import { useObserver } from '../../utils/use-observer';
import { GradeBadge, ReasonList, TimeZoneNote, WeatherConsent } from '../observing/observing-ui';
import { useObserverTimeZone, useTonight, useWeather } from '../observing/use-weather';
import { useShowerTonight } from './use-meteors';

const STATUS_CLASS = {
  peak: 'meteor-status peak',
  nearPeak: 'meteor-status near',
  active: 'meteor-status active',
  upcoming: 'meteor-status upcoming',
  inactive: 'meteor-status inactive',
} as const;

/** Card of one meteor shower: activity, radiant now, ZHR explained, Moon, conditions, best time. */
export function MeteorShowerSheet() {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const lang = i18n.language;
  const open = useUiStore((s) => s.panel === 'meteor');
  const close = useUiStore((s) => s.closePanel);
  const openPanel = useUiStore((s) => s.openPanel);
  const selectedId = useSkyStore((s) => s.selectedId);
  const startNavigation = useSkyStore((s) => s.startNavigation);
  const setLayer = useSkyStore((s) => s.setLayer);
  const catalog = useCatalogStore((s) => s.catalog);
  const observer = useObserver();
  const def = useMemo(() => (selectedId ? showerFromObjectId(selectedId) : null), [selectedId]);
  const weather = useWeather({ fetch: open && !!def });
  const tonight = useTonight(open);
  const zone = useObserverTimeZone();
  const info = useShowerTonight(open ? def : null, tonight);
  const tz = zone.timeZone;

  const moon = useMemo(
    () => (open ? platform.astronomy.getMoonPosition(new Date(tonight.now), observer) : null),
    [open, platform, observer, tonight.now],
  );

  if (!open || !def || !info || !moon) {
    return (
      <Sheet open={false} title="" onClose={close}>
        {null}
      </Sheet>
    );
  }

  const name = t(`meteors.names.${def.id}`);
  const occ = info.activity.occurrence;
  const con = catalog?.constellationsByAbbr.get(def.constellation);
  const conName = con ? constellationName(con, lang as LanguageCode) : def.constellation;
  const result = info.now.result;
  const plan = info.plan;
  const descKey = `meteors.desc.${def.id}`;
  const zhrText =
    occ.zhr == null ? t('meteors.zhrVariable') : t('meteors.zhrValue', { value: formatNumber(occ.zhr, lang, 0) });
  const lastDay = new Date(occ.end - 86_400_000);
  const peakText =
    occ.peakPrecision === 'hour'
      ? `${formatDayMonth(new Date(occ.peak), lang, tz)}, ${formatTime(new Date(occ.peak), lang, tz)}`
      : formatDayMonth(new Date(occ.peak), lang, 'UTC');

  return (
    <Sheet open title={name} onClose={close} testId="meteor-sheet" className="sheet-tall" modal={false}>
      <p className="details-type">
        <span dir="ltr">{def.code}</span> · {t('types.meteorRadiant')}
      </p>
      <p>
        <span className={STATUS_CLASS[info.activity.status]} data-testid="meteor-status">
          {t(`meteors.status.${info.activity.status}`)}
        </span>
      </p>

      <dl className="stats meteor-stats">
        <div className="fact">
          <dt>{t('meteors.activity')}</dt>
          <dd dir="ltr" data-testid="meteor-activity">
            {formatDayMonth(new Date(occ.start), lang, 'UTC')} – {formatDayMonth(lastDay, lang, 'UTC')}
          </dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.peak')}</dt>
          <dd data-testid="meteor-peak">
            <span dir="ltr">{peakText}</span>
          </dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.radiant')}</dt>
          <dd>{conName}</dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.now')}</dt>
          <dd data-testid="meteor-radiant-now">
            {info.now.radiantAltitude > 0 ? (
              <span dir="ltr">
                {t('meteors.radiantAlt', { value: formatDegrees(info.now.radiantAltitude, lang, 0) })},{' '}
                {t('meteors.radiantAz', { value: formatDegrees(info.now.radiantAzimuth, lang, 0) })}{' '}
                {t(`cardinal.${azimuthToCompassPoint(info.now.radiantAzimuth)}`)}
              </span>
            ) : (
              t('meteors.radiantBelow')
            )}
          </dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.velocity')}</dt>
          <dd dir="ltr">{t('meteors.velocityValue', { value: formatNumber(def.speedKms, lang, 0) })}</dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.zhr')}</dt>
          <dd data-testid="meteor-zhr">{zhrText}</dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.moon')}</dt>
          <dd data-testid="meteor-moon">
            {t('meteors.moonValue', {
              value: formatNumber((moon.illuminatedFraction ?? 0) * 100, lang, 0),
              position: moon.horizontal.altitude > 0 ? t('meteors.moonUp') : t('meteors.moonDown'),
            })}
          </dd>
        </div>
        <div className="fact">
          <dt>{t('meteors.moonInterference')}</dt>
          <dd data-testid="meteor-moon-impact">{t(`meteors.moonImpact.${result.moon}`)}</dd>
        </div>
      </dl>
      {occ.approximate && <p className="small muted">{t('meteors.approxDates')}</p>}

      <section className="sheet-section" data-testid="meteor-conditions">
        <h3>{t('meteors.conditions')}</h3>
        <GradeBadge grade={result.grade} testId="meteor-grade" />
        {result.weatherUnknown && (
          <p className="small warn-text" data-testid="meteor-weather-unknown">
            {t('meteors.astronomyOnly')} · {t('meteors.reasons.weatherUnknown')}
          </p>
        )}
        <ReasonList reasons={result.reasons} testId="meteor-reasons" />
        {!weather.enabled && <WeatherConsent compact />}
      </section>

      <section className="sheet-section">
        <h3>{t('meteors.bestTimeTonight')}</h3>
        {info.activity.status === 'upcoming' || info.activity.status === 'inactive' ? (
          <p data-testid="meteor-best-none">{t('meteors.reasons.notActive')}</p>
        ) : plan.window ? (
          <p className="best-window" data-testid="meteor-best-window">
            <strong dir="ltr">
              {formatTimeRange(new Date(plan.window.start), new Date(plan.window.end), lang, tz)}
            </strong>
          </p>
        ) : (
          <>
            <p data-testid="meteor-best-none">{t('meteors.noGoodTime')}</p>
            {plan.best && <ReasonList reasons={plan.best.result.reasons} max={3} />}
          </>
        )}
        {plan.radiantHighAfter && (
          <p className="small muted">
            {t('tonight.radiantHigherAfter', { time: formatTime(new Date(plan.radiantHighAfter), lang, tz) })}
          </p>
        )}
        <TimeZoneNote zone={zone} />
      </section>

      <div className="details-actions">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            setLayer('meteors', true);
            startNavigation(`meteor-${def.id}`);
            close();
          }}
          data-testid="meteor-find-radiant"
        >
          <Icon name="target" size={18} /> {t('meteors.findRadiant')}
        </button>
        <button type="button" className="btn" onClick={() => openPanel('meteors')} data-testid="meteor-all">
          <Icon name="meteor" size={18} /> {t('tonight.showAll')}
        </button>
      </div>
      <p className="hint small" data-testid="meteor-radiant-hint">
        {t('meteors.radiantHint')}
      </p>

      <section className="sheet-section meteor-learn">
        <h3>{t('meteors.learn')}</h3>
        {i18n.exists(descKey) && <p>{t(descKey)}</p>}
        <p className="small">{t('meteors.whatIsRadiant')}</p>
        <p className="small" data-testid="meteor-zhr-explain">
          {t('meteors.zhrExplain')}
        </p>
        {def.parentBody && (
          <p className="small muted">
            {t('meteors.parent')}: <span dir="ltr">{def.parentBody}</span>
          </p>
        )}
        <p className="small muted">{t('meteors.estimateNote')}</p>
        <p className="small muted">{t('meteors.source')}</p>
      </section>
    </Sheet>
  );
}
