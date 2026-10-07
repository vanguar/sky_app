import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Toasts } from '../components/Toasts';
import { objectName, resolveObject } from '../catalog/object-registry';
import type { LanguageCode } from '../catalog/types';
import { FilterBar } from '../features/filters/FilterBar';
import { LayersSheet } from '../features/filters/LayersSheet';
import { Navigator } from '../features/navigator/Navigator';
import { ObjectDetailsSheet } from '../features/object-details/ObjectDetailsSheet';
import { Onboarding } from '../features/onboarding/Onboarding';
import { SearchSheet } from '../features/search/SearchSheet';
import { LocationSheet } from '../features/settings/LocationSheet';
import { SettingsSheet } from '../features/settings/SettingsSheet';
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
import { parseHash, replaceHash } from './routes';

// 3D viewer (and its textures) is loaded only when first opened.
const Planet3DViewer = lazy(() => import('../features/planet-3d/Planet3DViewer'));

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
        useUiStore.getState().openPanel('details');
      }
    };
    apply();
    routeReady.current = true;
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [catalog]);

  useEffect(() => {
    if (routeReady.current) replaceHash({ objectId: selectedId });
  }, [selectedId, catalog]);

  const viewerRef = viewer3d ? resolveObject(viewer3d, catalog) : null;

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
        <SearchSheet />
        <LayersSheet />
        <ObjectDetailsSheet />
        <SettingsSheet />
        <LocationSheet />
      </ErrorBoundary>

      {viewer3d && viewerRef && (
        <ErrorBoundary>
          <Suspense fallback={<div className="viewer3d loading">{t('common.loading')}</div>}>
            <Planet3DViewer
              body={viewer3d}
              name={objectName(viewerRef, t, i18n.language as LanguageCode)}
              onClose={close3d}
            />
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
