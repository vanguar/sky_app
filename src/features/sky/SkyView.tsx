import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { daylightFactor } from '../../astronomy/visibility';
import { SOLAR_BODY_IDS } from '../../astronomy/types';
import { constellationId, constellationName } from '../../catalog/constellations/constellations';
import { resolveObject } from '../../catalog/object-registry';
import { starProperName } from '../../catalog/stars/stars';
import type { Catalog, LanguageCode } from '../../catalog/types';
import { languageDirection } from '../../i18n/languages';
import { SkyRenderer, WebGLUnavailableError } from '../../sky/SkyRenderer';
import type { LabelTexts } from '../../sky/types';
import { useCatalogStore } from '../../store/catalog-store';
import { useSettingsStore } from '../../store/settings-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { useObserver } from '../../utils/use-observer';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { computeSolarSnapshot, eqjVectorOf, type SolarSnapshot } from './solar-items';
import { skyBridge } from './sky-bridge';

const CARDINAL_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function buildLabelTexts(catalog: Catalog | null, t: (k: string) => string, lang: LanguageCode): LabelTexts {
  const bodies: LabelTexts['bodies'] = {};
  for (const id of SOLAR_BODY_IDS) bodies[id] = t(`bodies.${id}`);
  const stars = new Map<number, string>();
  const constellations = new Map<string, string>();
  const messier = new Map<string, string>();
  if (catalog) {
    for (const s of catalog.stars.stars) {
      const n = starProperName(s, lang);
      if (n) stars.set(s.hip, n);
    }
    for (const c of catalog.constellations) constellations.set(c.abbr, constellationName(c, lang));
    for (const m of catalog.messier) messier.set(m.designation, m.designation);
  }
  const cardinals = Object.fromEntries(
    CARDINAL_KEYS.map((k) => [k, t(`cardinal.${k}`)]),
  ) as LabelTexts['cardinals'];
  return { bodies, stars, constellations, messier, cardinals, rtl: languageDirection(lang) === 'rtl' };
}

/** Mounts the imperative SkyRenderer and keeps it in sync with stores, time and location. */
export function SkyView() {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SkyRenderer | null>(null);
  const snapshotRef = useRef<SolarSnapshot | null>(null);
  const [webglError, setWebglError] = useState(false);

  const catalog = useCatalogStore((s) => s.catalog);
  const layers = useSkyStore((s) => s.layers);
  const selectedId = useSkyStore((s) => s.selectedId);
  const navigationTargetId = useSkyStore((s) => s.navigationTargetId);
  const showLabels = useSettingsStore((s) => s.showLabels);
  const brightness = useSettingsStore((s) => s.brightness);
  const smoothing = useSettingsStore((s) => s.smoothing);
  const headingOffset = useSettingsStore((s) => s.headingOffset);
  const observer = useObserver();
  const lang = i18n.language as LanguageCode;

  // Create / destroy the renderer.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: SkyRenderer;
    try {
      renderer = new SkyRenderer(host, useSkyStore.getState().layers, {
        onFrameInfo: (info) => skyBridge.publish(info),
        onTap: (x, y) => {
          const r = rendererRef.current;
          if (!r) return;
          let id = r.pick(x, y);
          const l = useSkyStore.getState().layers;
          if (!id && (l.constellationLines || l.constellationNames || l.zodiac)) {
            const eq = r.screenToEquatorial(x, y);
            const abbr = platform.astronomy.getConstellationAt(eq.ra, eq.dec);
            const con = useCatalogStore.getState().catalog?.constellationsByAbbr.get(abbr);
            if (con && (l.constellationLines || l.constellationNames || con.zodiac))
              id = constellationId(abbr);
          }
          if (id) {
            useSkyStore.getState().select(id);
            useUiStore.getState().openPanel('details');
          } else {
            useSkyStore.getState().select(null);
            if (useUiStore.getState().panel === 'details') useUiStore.getState().closePanel();
          }
        },
        onContextLost: () => setWebglError(true),
      });
    } catch (e) {
      if (e instanceof WebGLUnavailableError || e instanceof Error) {
        console.error('[AstroPoint] renderer init failed', e);
        setWebglError(true);
        return;
      }
      throw e;
    }
    rendererRef.current = renderer;
    skyBridge.setRenderer(renderer);
    return () => {
      skyBridge.setRenderer(null);
      rendererRef.current = null;
      renderer.dispose();
    };
  }, [platform]);

  useEffect(() => {
    if (catalog) rendererRef.current?.setCatalog(catalog);
  }, [catalog]);

  useEffect(() => {
    rendererRef.current?.setLayers(layers);
  }, [layers]);

  useEffect(() => {
    rendererRef.current?.setShowLabels(showLabels);
  }, [showLabels]);

  useEffect(() => {
    rendererRef.current?.setBrightness(brightness);
  }, [brightness]);

  useEffect(() => {
    platform.orientation.setSmoothing(smoothing);
    platform.orientation.setHeadingOffset(headingOffset);
  }, [platform, smoothing, headingOffset]);

  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.setLabelTexts(buildLabelTexts(catalog, t, lang));
    r.canvas.setAttribute('role', 'application');
    r.canvas.setAttribute('aria-label', t('modes.skyMap'));
  }, [catalog, t, lang]);

  // Astronomy tick: observer frame + Solar System positions (1 Hz), selection & navigation vectors.
  useEffect(() => {
    const tick = () => {
      const r = rendererRef.current;
      if (!r) return;
      const date = platform.time.now();
      r.setEqjToWorld(platform.astronomy.getEqjToWorldMatrix(date, observer));
      const snapshot = computeSolarSnapshot(date, observer);
      snapshotRef.current = snapshot;
      r.setSolarItems(snapshot.items);
      const sun = snapshot.positions.find((p) => p.id === 'sun');
      r.setDaylight(sun ? daylightFactor(sun.horizontal.altitude) : 0);
      const cat = useCatalogStore.getState().catalog;
      const { selectedId: sel, navigationTargetId: nav } = useSkyStore.getState();
      const selRef = sel ? resolveObject(sel, cat) : null;
      r.setSelection(sel, selRef ? eqjVectorOf(selRef, snapshot) : null);
      const navRef = nav ? resolveObject(nav, cat) : null;
      r.setNavigationTarget(nav, navRef ? eqjVectorOf(navRef, snapshot) : null);
    };
    tick();
    const id = setInterval(tick, 1000);
    const off = platform.time.subscribe(tick);
    return () => {
      clearInterval(id);
      off();
    };
  }, [platform, observer, catalog, selectedId, navigationTargetId]);

  if (webglError) {
    return (
      <div className="sky-error" role="alert">
        <p>{t('errors.webgl')}</p>
      </div>
    );
  }

  return (
    <div className="sky-host" ref={hostRef} data-testid="sky-view">
      <span className="sr-only">{t('modes.skyMap')}</span>
    </div>
  );
}
