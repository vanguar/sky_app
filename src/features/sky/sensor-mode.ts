import type { Platform } from '../../app/providers/platform';
import { magneticDeclination } from '../../astronomy/geomagnetism';
import { SensorDiagnosticsLogger, sensorDiagnosticsEnabled } from '../../sensors/sensor-diagnostics';
import { useLocationStore } from '../../store/location-store';
import { useSettingsStore } from '../../store/settings-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { skyBridge } from './sky-bridge';

const NO_DATA_TIMEOUT_MS = 3000;
const STATUS_POLL_MS = 250;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let poller: ReturnType<typeof setInterval> | null = null;
let unsubscribeLocation: (() => void) | null = null;

function toast(messageKey: string, tone: 'info' | 'warning' = 'warning') {
  useUiStore.getState().pushToast({ messageKey, tone, durationMs: 6000 });
}

function stopBackgroundTasks() {
  if (watchdog) clearTimeout(watchdog);
  if (poller) clearInterval(poller);
  unsubscribeLocation?.();
  watchdog = null;
  poller = null;
  unsubscribeLocation = null;
}

function fallbackToFree(platform: Platform) {
  stopBackgroundTasks();
  platform.sensors.stop();
  useSkyStore.getState().setViewMode('free');
  useSkyStore.getState().setHeadingStatus(null);
  skyBridge.renderer?.setViewMode('free', null);
}

/** Browser compasses report MAGNETIC north; astronomy uses TRUE north → WMM declination. */
function updateDeclination(platform: Platform) {
  const loc = useLocationStore.getState().location;
  platform.orientation.setMagneticDeclination(
    magneticDeclination(loc.latitude, loc.longitude, loc.elevation, platform.time.now()),
  );
}

/**
 * Turns on phone pointing. Must run inside a user gesture (iOS permission prompt).
 * Never throws: on any failure the app stays in free mode with a clear message.
 */
export async function enableSensorMode(platform: Platform): Promise<boolean> {
  const sky = useSkyStore.getState();
  sky.setSensorStatus('requesting');
  const permission = await platform.sensors.requestPermission();
  if (permission !== 'granted') {
    const status =
      permission === 'denied' ? 'denied' : permission === 'insecure' ? 'insecure' : 'unsupported';
    sky.setSensorStatus(status);
    toast(
      status === 'denied'
        ? 'sensors.denied'
        : status === 'insecure'
          ? 'sensors.insecure'
          : 'sensors.unavailable',
    );
    fallbackToFree(platform);
    return false;
  }
  stopBackgroundTasks();
  const settings = useSettingsStore.getState();
  const pipeline = platform.orientation;
  pipeline.reset();
  pipeline.setSmoothing(settings.smoothing);
  pipeline.setHeadingOffset(settings.headingOffset);
  updateDeclination(platform);
  unsubscribeLocation = useLocationStore.subscribe(() => updateDeclination(platform));

  platform.sensors.start(
    (sample) => pipeline.ingest(sample),
    (motion) => pipeline.ingestMotion(motion),
  );
  sky.setSensorStatus('active');
  sky.setViewMode('sensor');
  sky.setHeadingStatus('collecting');
  skyBridge.renderer?.setViewMode('sensor', (dt, out) => pipeline.step(dt, out));

  // Heading status for the UI + development diagnostics (~2 Hz log).
  const logger = new SensorDiagnosticsLogger(sensorDiagnosticsEnabled());
  poller = setInterval(() => {
    const s = useSkyStore.getState();
    const status = pipeline.getHeadingStatus();
    if (status && status !== s.headingStatus) s.setHeadingStatus(status);
    if (status && s.headingQuality !== pipeline.getHeadingQuality())
      s.setHeadingQuality(pipeline.getHeadingQuality());
    logger.maybeLog(() => pipeline.getDiagnostics(), performance.now());
  }, STATUS_POLL_MS);

  watchdog = setTimeout(() => {
    watchdog = null;
    if (!pipeline.hasData() && useSkyStore.getState().viewMode === 'sensor') {
      useSkyStore.getState().setSensorStatus('noData');
      toast('sensors.noData');
      fallbackToFree(platform);
    }
  }, NO_DATA_TIMEOUT_MS);
  return true;
}

export function disableSensorMode(platform: Platform): void {
  fallbackToFree(platform);
  useSkyStore.getState().setSensorStatus('idle');
}
