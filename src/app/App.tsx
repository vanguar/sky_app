import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Toasts } from '../components/Toasts';
import { objectName, resolveObject } from '../catalog/object-registry';
import type { LanguageCode } from '../catalog/types';
import { isMoonId } from '../catalog/planets/planet-data';
import { FilterBar } from '../features/filters/FilterBar';
import { Navigator } from '../features/navigator/Navigator';
import { Onboarding } from '../features/onboarding/Onboarding';
import { Crosshair } from '../features/sky/Crosshair';
import { ModeControls } from '../features/sky/ModeControls';
import { enableSensorMode } from '../features/sky/sensor-mode';
import { SensorStatus } from '../features/sky/SensorStatus';
import { SkyView } from '../features/sky/SkyView';
import { TopBar } from '../features/sky/TopBar';
import { useCatalogStore } from '../store/catalog-store';
import { useSettingsStore } from '../store/settings-store';
import { useSkyStore } from '../store/sky-store';
import { useUiStore } from '../store/ui-store';
import { usePlatform } from './providers/PlatformProvider';
import { PwaUpdater } from './PwaUpdater';
import { isMeteorObjectId } from '../meteors/catalog';
import { parseHash, replaceHash } from './routes';

// 3D viewer (and its textures) is loaded only when first opened.
const Planet3DViewer = lazy(() => import('../features/planet-3d/Planet3DViewer'));
const SearchSheet = lazy(() =>
  import('../features/search/SearchSheet').then((module) => ({ default: module.SearchSheet })),
);
const LayersSheet = lazy(() =>
  import('../features/filters/LayersSheet').then((module) => ({ default: module.LayersSheet })),
);
const ObjectDetailsSheet = lazy(() =>
  import('../features/object-details/ObjectDetailsSheet').then((module) => ({
    default: module.ObjectDetailsSheet,
  })),
);
const SettingsSheet = lazy(() =>
  import('../features/settings/SettingsSheet').then((module) => ({ default: module.SettingsSheet })),
);
const LocationSheet = lazy(() =>
  import('../features/settings/LocationSheet').then((module) => ({ default: module.LocationSheet })),
);
const TonightSheet = lazy(() =>
  import('../features/observing/TonightSheet').then((module) => ({ default: module.TonightSheet })),
);
const WeatherSheet = lazy(() =>
  import('../features/observing/WeatherSheet').then((module) => ({ default: module.WeatherSheet })),
);
const MeteorsListSheet = lazy(() =>
  import('../features/meteors/MeteorsListSheet').then((module) => ({ default: module.MeteorsListSheet })),
);
const MeteorShowerSheet = lazy(() =>
  import('../features/meteors/MeteorShowerSheet').then((module) => ({ default: module.MeteorShowerSheet })),
);

export function App({ askLanguage }: { askLanguage: boolean }) {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const nightMode = useSettingsStore((s) => s.nightMode);
  const brightness = useSettingsStore((s) => s.brightness);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const catalogStatus = useCatalogStore((s) => s.status);
  const catalog = useCatalogStore((s) => s.catalog);
  const loadCatalog = useCatalogStore((s) => s.load);
  const selectedId = useSkyStore((s) => s.selectedId);
  const viewer3d = useUiStore((s) => s.viewer3d);
  const panel = useUiStore((s) => s.panel);
  const close3d = useUiStore((s) => s.close3d);
  // The URL is only rewritten after the initial deep link has been applied (catalog loaded).
  const routeReady = useRef(false);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  // Remember the language once onboarding is finished.
  useEffect(() => {
    if (onboardingDone && !language) setLanguage(i18n.language as LanguageCode);
  }, [onboardingDone, language, setLanguage, i18n.language]);

  // Restore phone pointing where no permission prompt is required (Android); iOS needs a tap.
  useEffect(() => {
    const sky = useSkyStore.getState();
    if (sky.viewMode !== 'sensor') return;
    if (platform.sensors.getCapabilities().requiresPermission) sky.setViewMode('free');
    else void enableSensorMode(platform);
  }, [platform]);

  // Deep link: #/object/<id>
  useEffect(() => {
    if (!catalog) return;
    const apply = () => {
      const { objectId } = parseHash(location.hash);
      if (objectId && resolveObject(objectId, catalog)) {
        useSkyStore.getState().select(objectId);
        useUiStore.getState().openPanel(isMeteorObjectId(objectId) ? 'meteor' : 'details');
      } else {
        useSkyStore.getState().select(null);
        const ui = useUiStore.getState();
        if (ui.panel === 'details' || ui.panel === 'meteor') ui.closePanel();
        ui.close3d();
        replaceHash({ objectId: null });
      }
    };
    apply();
    routeReady.current = true;
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [catalog]);

  useEffect(() => {
    if (routeReady.current) replaceHash({ objectId: useSkyStore.getState().selectedId });
  }, [selectedId, catalog]);

  const viewerRef = viewer3d && !isMoonId(viewer3d) ? resolveObject(viewer3d, catalog) : null;
  const viewerName = !viewer3d
    ? null
    : isMoonId(viewer3d)
      ? t(`moons.${viewer3d}`)
      : viewerRef
        ? objectName(viewerRef, t, i18n.language as LanguageCode)
        : null;

  return (
    <div className={`app ${nightMode ? 'night' : ''}`}>
      <ErrorBoundary fallback={<div className="sky-error">{t('errors.webgl')}</div>}>
        <SkyView />
      </ErrorBoundary>
      <Crosshair />
      <TopBar />
      <ModeControls />
      <Navigator />
      <SensorStatus />
      <FilterBar />

      {catalogStatus === 'error' && (
        <div className="banner glass" role="alert">
          <span>{t('errors.catalog')}</span>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              useCatalogStore.setState({ status: 'idle' });
              void loadCatalog();
            }}
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="banner glass" role="status">
              {t('common.loading')}
            </div>
          }
        >
          {panel === 'search' && <SearchSheet />}
          {panel === 'layers' && <LayersSheet />}
          {panel === 'details' && <ObjectDetailsSheet />}
          {(panel === 'settings' || panel === 'menu') && <SettingsSheet />}
          {panel === 'location' && <LocationSheet />}
          {panel === 'tonight' && <TonightSheet />}
          {panel === 'weather' && <WeatherSheet />}
          {panel === 'meteors' && <MeteorsListSheet />}
          {panel === 'meteor' && <MeteorShowerSheet />}
        </Suspense>
      </ErrorBoundary>

      {viewer3d && viewerName && (
        <ErrorBoundary>
          <Suspense fallback={<div className="viewer3d loading">{t('common.loading')}</div>}>
            <Planet3DViewer body={viewer3d} name={viewerName} onClose={close3d} />
          </Suspense>
        </ErrorBoundary>
      )}

      <Toasts />
      {!onboardingDone && <Onboarding askLanguage={askLanguage} />}
      <PwaUpdater />

      {/* Night vision: multiply everything by pure red (removes green/blue light). */}
      <div className="night-filter" aria-hidden="true" />
      <div className="dim-overlay" style={{ opacity: 1 - brightness }} aria-hidden="true" />
    </div>
  );
}
