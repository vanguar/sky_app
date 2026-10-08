import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { azimuthToCompassPoint, raDecToVector } from '../../astronomy/coordinate-transform';
import { moonPhaseName } from '../../astronomy/moon';
import type { SolarBodyPosition } from '../../astronomy/types';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { constellationName } from '../../catalog/constellations/constellations';
import { objectName, objectTypeKey, resolveObject, targetOf } from '../../catalog/object-registry';
import { BODY_DATA, MOONS_OF } from '../../catalog/planets/planet-data';
import {
  distanceFromParallax,
  starDesignation,
  starProperName,
  temperatureFromBV,
} from '../../catalog/stars/stars';
import type { Catalog, LanguageCode, SkyObjectRef } from '../../catalog/types';
import { practicalVisibilityOf } from '../../catalog/practical';
import { PRACTICAL_CLASS } from './practical-ui';
import { useCatalogStore } from '../../store/catalog-store';
import { useSettingsStore, type InfoLevel } from '../../store/settings-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import {
  formatCompact,
  formatDec,
  formatDegrees,
  formatEventTime,
  formatNumber,
  formatRa,
  formatScientific,
} from '../../utils/format';
import { useNow } from '../../utils/use-now';
import { useObserver } from '../../utils/use-observer';
import { eqjVectorOf } from '../sky/solar-items';
import { skyBridge } from '../sky/sky-bridge';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatPeriodDays(days: number, t: TFunction, lang: string): string {
  return days > 800
    ? t('units.years', { value: formatNumber(days / 365.25, lang, 1) })
    : t('units.days', { value: formatNumber(days, lang, 1) });
}

function formatRotation(hours: number, t: TFunction, lang: string): string {
  const abs = Math.abs(hours);
  const text =
    abs > 72
      ? t('units.days', { value: formatNumber(abs / 24, lang, 1) })
      : t('units.hours', { value: formatNumber(abs, lang, 1) });
  return hours < 0 ? t('details.retrograde', { value: text }) : text;
}

function formatDistance(km: number, t: TFunction, lang: string): string {
  if (km < 2e7) return t('units.km', { value: formatNumber(Math.round(km), lang, 0) });
  return `${t('units.au', { value: formatNumber(km / 149597870.7, lang, 3) })} · ${t('units.km', {
    value: formatScientific(km, lang, 2),
  })}`;
}

function BodyFacts({
  ref_,
  pos,
  date,
  t,
  lang,
}: {
  ref_: Extract<SkyObjectRef, { body: unknown }>;
  pos: SolarBodyPosition;
  date: Date;
  t: TFunction;
  lang: string;
}) {
  const data = BODY_DATA[ref_.body];
  const platform = usePlatform();
  return (
    <dl className="facts">
      <Fact label={t('details.distanceFromEarth')}>{formatDistance(pos.distanceKm, t, lang)}</Fact>
      {pos.magnitude != null && (
        <Fact label={t('details.magnitude')}>{formatNumber(pos.magnitude, lang, 1)}</Fact>
      )}
      {ref_.body === 'moon' && (
        <Fact label={t('details.phase')}>
          {t(`moonPhases.${moonPhaseName(platform.astronomy.getMoonPhaseAngle(date))}`)}
        </Fact>
      )}
      {pos.illuminatedFraction != null && (
        <Fact label={t('details.illumination')}>
          {t('units.percent', { value: formatNumber(pos.illuminatedFraction * 100, lang, 0) })}
        </Fact>
      )}
      <Fact label={t('details.angularSize')}>
        {pos.angularDiameterArcsec > 120
          ? t('units.arcmin', { value: formatNumber(pos.angularDiameterArcsec / 60, lang, 1) })
          : t('units.arcsec', { value: formatNumber(pos.angularDiameterArcsec, lang, 1) })}
      </Fact>
      <Fact label={t('details.diameter')}>
        {t('units.km', { value: formatNumber(data.diameterKm, lang, 0) })}
      </Fact>
      <Fact label={t('details.mass')}>{t('units.kg', { value: formatScientific(data.massKg, lang) })}</Fact>
      {data.meanDistanceKm != null && (
        <Fact
          label={
            data.meanDistanceFrom === 'earth' ? t('details.meanDistanceEarth') : t('details.meanDistanceSun')
          }
        >
          {formatDistance(data.meanDistanceKm, t, lang)}
        </Fact>
      )}
      {data.orbitalPeriodDays != null && (
        <Fact label={t('details.orbitalPeriod')}>{formatPeriodDays(data.orbitalPeriodDays, t, lang)}</Fact>
      )}
      <Fact label={t('details.rotationPeriod')}>{formatRotation(data.rotationPeriodHours, t, lang)}</Fact>
      <Fact label={ref_.body === 'sun' ? t('details.temperature') : t('details.meanTemperature')}>
        {t('units.celsius', { value: formatNumber(data.meanTemperatureC, lang, 0) })}
      </Fact>
      <Fact label={t('details.atmosphere')}>
        {data.atmosphere ? <span dir="ltr">{data.atmosphere.join(', ')}</span> : t('details.exosphere')}
      </Fact>
      {data.moons && (
        <Fact label={t('details.moons')}>
          {t('details.moonsValue', { count: data.moons.count, year: data.moons.asOf })}
        </Fact>
      )}
      {data.discovery && <Fact label={t('details.discovery')}>{data.discovery}</Fact>}
      <Fact label={t('details.ra')}>
        <span dir="ltr">{formatRa(pos.equatorialJ2000.ra)}</span>
      </Fact>
      <Fact label={t('details.dec')}>
        <span dir="ltr">{formatDec(pos.equatorialJ2000.dec)}</span>
      </Fact>
    </dl>
  );
}

function constellationLabel(abbr: string, catalog: Catalog | null, lang: LanguageCode): string {
  const c = catalog?.constellationsByAbbr.get(abbr);
  return c ? constellationName(c, lang) : abbr;
}

function FixedFacts({
  ref_,
  catalog,
  t,
  lang,
}: {
  ref_: SkyObjectRef;
  catalog: Catalog | null;
  t: TFunction;
  lang: LanguageCode;
}) {
  if (ref_.kind === 'star') {
    const s = ref_.star;
    const dist = distanceFromParallax(s.parallaxMas);
    return (
      <dl className="facts">
        <Fact label={t('details.designation')}>
          <span dir="ltr">
            {starDesignation(s)} · HIP {s.hip}
          </span>
        </Fact>
        <Fact label={t('details.magnitude')}>{formatNumber(s.mag, lang, 2)}</Fact>
        {s.spectral && (
          <Fact label={t('details.spectralClass')}>
            <span dir="ltr">{s.spectral}</span>
          </Fact>
        )}
        {dist != null && (
          <Fact label={t('details.distance')}>
            {t('units.ly', { value: formatCompact(Math.round(dist), lang) })}{' '}
            <small>({t('details.parallaxNote')})</small>
          </Fact>
        )}
        {s.bv != null && (
          <Fact label={t('details.temperature')}>
            {t('details.temperatureEstimate', {
              value: t('units.kelvin', {
                value: formatNumber(Math.round(temperatureFromBV(s.bv) / 100) * 100, lang, 0),
              }),
            })}
          </Fact>
        )}
        <Fact label={t('details.constellation')}>{constellationLabel(s.constellation, catalog, lang)}</Fact>
        <Fact label={t('details.ra')}>
          <span dir="ltr">{formatRa(s.raDeg / 15)}</span>
        </Fact>
        <Fact label={t('details.dec')}>
          <span dir="ltr">{formatDec(s.decDeg)}</span>
        </Fact>
      </dl>
    );
  }
  if (ref_.kind === 'messier') {
    const m = ref_.messier;
    return (
      <dl className="facts">
        <Fact label={t('details.messierNumber')}>{m.designation}</Fact>
        {m.ngc && (
          <Fact label={t('details.ngc')}>
            <span dir="ltr">{m.ngc}</span>
          </Fact>
        )}
        <Fact label={t('details.designation')}>{t(`types.${m.subtype ?? m.category}`)}</Fact>
        {m.mag != null && <Fact label={t('details.magnitude')}>{formatNumber(m.mag, lang, 1)}</Fact>}
        {m.sizeArcmin && <Fact label={t('details.size')}>{t('units.arcmin', { value: m.sizeArcmin })}</Fact>}
        {m.distanceLy != null && (
          <Fact label={t('details.distance')}>
            {t('units.ly', { value: formatCompact(m.distanceLy, lang) })}
          </Fact>
        )}
        <Fact label={t('details.constellation')}>{constellationLabel(m.constellation, catalog, lang)}</Fact>
        <Fact label={t('details.ra')}>
          <span dir="ltr">{formatRa(m.raDeg / 15)}</span>
        </Fact>
        <Fact label={t('details.dec')}>
          <span dir="ltr">{formatDec(m.decDeg)}</span>
        </Fact>
      </dl>
    );
  }
  if (ref_.kind === 'constellation') {
    const c = ref_.constellation;
    const brightest = (catalog?.stars.stars ?? [])
      .filter((s) => s.constellation === c.abbr)
      .slice(0, 4)
      .map((s) => starProperName(s, lang) ?? starDesignation(s));
    return (
      <dl className="facts">
        <Fact label={t('details.designation')}>
          <span dir="ltr">
            {c.latin} ({c.abbr}) · {c.genitive}
          </span>
        </Fact>
        {brightest.length > 0 && <Fact label={t('details.brightestStars')}>{brightest.join(', ')}</Fact>}
      </dl>
    );
  }
  return null;
}

export function ObjectDetailsSheet() {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const lang = i18n.language as LanguageCode;
  const panelOpen = useUiStore((s) => s.panel === 'details');
  const close = useUiStore((s) => s.closePanel);
  const open3d = useUiStore((s) => s.open3d);
  const selectedId = useSkyStore((s) => s.selectedId);
  const startNavigation = useSkyStore((s) => s.startNavigation);
  const viewMode = useSkyStore((s) => s.viewMode);
  const catalog = useCatalogStore((s) => s.catalog);
  const defaultLevel = useSettingsStore((s) => s.infoLevel);
  const [level, setLevel] = useState<InfoLevel>(defaultLevel);
  const observer = useObserver();
  const now = useNow(1000);
  const minute = Math.floor(now.getTime() / 60000);

  const ref = useMemo(() => (selectedId ? resolveObject(selectedId, catalog) : null), [selectedId, catalog]);
  useEffect(() => setLevel(defaultLevel), [selectedId, defaultLevel]);

  const target = ref ? targetOf(ref) : null;
  const visibility = target ? platform.astronomy.getVisibility(target, now, observer) : null;
  const bodyPos =
    ref && (ref.kind === 'sun' || ref.kind === 'moon' || ref.kind === 'planet')
      ? platform.astronomy.getBodyPosition(ref.body, now, observer)
      : null;
  const riseSet = useMemo(
    () => (target ? platform.astronomy.getRiseSet(target, new Date(minute * 60000), observer) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, minute, observer, platform],
  );

  const practical = ref ? practicalVisibilityOf(ref, catalog, platform.astronomy, now, observer) : null;

  const open = panelOpen && !!ref;
  if (!open || !ref || !visibility || !practical) {
    return (
      <Sheet open={false} title="" onClose={close}>
        {null}
      </Sheet>
    );
  }

  const name = objectName(ref, t, lang);
  const briefKey = ref.kind === 'messier' ? `briefs.${ref.messier.designation}` : `briefs.${ref.id}`;
  const brief = i18n.exists(briefKey) ? t(briefKey) : null;
  const has3d = (ref.kind === 'moon' || ref.kind === 'planet') && !!BODY_DATA[ref.body].globe;

  const statusText = riseSet?.neverUp
    ? t('visibility.neverUp')
    : riseSet?.alwaysUp
      ? t('visibility.alwaysUp')
      : visibility.aboveHorizon
        ? t('visibility.up')
        : t('visibility.down');

  const eventTime = (d: Date | null) =>
    d ? formatEventTime(d, now, i18n.language) : t('common.notAvailable');

  return (
    <Sheet open title={name} onClose={close} testId="object-details" className="details-sheet" modal={false}>
      <p className="details-type">
        {t(objectTypeKey(ref))}
        {ref.kind === 'constellation' && ref.constellation.zodiac && <> · {t('layers.zodiac')}</>}
      </p>

      <dl className="stats">
        <Fact label={t('details.altitude')}>
          <span dir="ltr" data-testid="details-altitude">
            {formatDegrees(visibility.altitude, i18n.language, 1)}
          </span>
        </Fact>
        <Fact label={t('details.azimuth')}>
          <span dir="ltr" data-testid="details-azimuth">
            {formatDegrees(visibility.azimuth, i18n.language, 1)}{' '}
            {t(`cardinal.${azimuthToCompassPoint(visibility.azimuth)}`)}
          </span>
        </Fact>
        <Fact label={t('details.visibility')}>
          <span className={visibility.aboveHorizon ? 'vis-up' : 'vis-down'} data-testid="details-visibility">
            {statusText}
          </span>
        </Fact>
        <Fact label={t('details.rise')}>
          {riseSet?.alwaysUp || riseSet?.neverUp ? '—' : eventTime(riseSet?.rise ?? null)}
        </Fact>
        <Fact label={t('details.set')}>
          {riseSet?.alwaysUp || riseSet?.neverUp ? '—' : eventTime(riseSet?.set ?? null)}
        </Fact>
        <Fact label={t('details.transit')}>
          {riseSet?.neverUp ? '—' : eventTime(riseSet?.transit ?? null)}
        </Fact>
      </dl>

      <div className="practical" data-testid="details-practical">
        <p className="practical-status">
          <span className="muted">{t('practical.label')}: </span>
          <strong className={PRACTICAL_CLASS[practical.status]} data-testid="details-practical-status">
            {t(`practical.${practical.status}`)}
          </strong>
        </p>
        <p className="practical-reason" data-testid="details-practical-reason">
          {t(`practical.reasons.${practical.reason}`, {
            name,
            alt: formatNumber(Math.max(0, practical.altitude), i18n.language, 0),
          })}
        </p>
        <p className="practical-note muted">{t('practical.note')}</p>
      </div>

      <div className="details-actions">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => {
            startNavigation(ref.id);
            close();
          }}
          data-testid="details-find"
        >
          <Icon name="target" size={18} /> {t('search.findInSky')}
        </button>
        {viewMode === 'free' && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const v = bodyPos
                ? raDecToVector(bodyPos.equatorialJ2000.ra * 15, bodyPos.equatorialJ2000.dec)
                : eqjVectorOf(ref, null);
              if (v) skyBridge.renderer?.lookAtVector(v, false);
            }}
          >
            <Icon name="eye" size={18} /> {t('details.show')}
          </button>
        )}
        {has3d && (
          <button type="button" className="btn" onClick={() => open3d(ref.body)} data-testid="details-3d">
            <Icon name="cube" size={18} /> {t('details.view3d')}
          </button>
        )}
      </div>

      {ref.kind === 'planet' && MOONS_OF[ref.body] && (
        <div className="moons-row" data-testid="moons-3d">
          <span className="muted small">{t('details.moons3d')}:</span>
          {MOONS_OF[ref.body]!.map((m) => (
            <button
              key={m}
              type="button"
              className="btn btn-small"
              onClick={() => open3d(m)}
              data-testid={`moon-3d-${m}`}
            >
              {t(`moons.${m}`)}
            </button>
          ))}
        </div>
      )}

      <div className="tabs" role="tablist">
        {(['brief', 'detailed'] as const).map((l) => (
          <button
            key={l}
            type="button"
            role="tab"
            aria-selected={level === l}
            className={`tab ${level === l ? 'active' : ''}`}
            onClick={() => setLevel(l)}
            data-testid={`tab-${l}`}
          >
            {t(`details.${l}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {level === 'brief' ? (
          <div className="brief">
            {brief && <p>{brief}</p>}
            {ref.kind === 'constellation' && ref.constellation.zodiac && <p>{t('details.zodiacNote')}</p>}
            {!brief && !(ref.kind === 'constellation' && ref.constellation.zodiac) && (
              <p className="hint">{t('details.noBrief')}</p>
            )}
          </div>
        ) : bodyPos && (ref.kind === 'sun' || ref.kind === 'moon' || ref.kind === 'planet') ? (
          <BodyFacts ref_={ref} pos={bodyPos} date={now} t={t} lang={i18n.language} />
        ) : (
          <FixedFacts ref_={ref} catalog={catalog} t={t} lang={lang} />
        )}
      </div>
    </Sheet>
  );
}
