import type { Platform } from '../../app/providers/platform';
import { useSettingsStore } from '../../store/settings-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { skyBridge } from './sky-bridge';

const NO_DATA_TIMEOUT_MS = 3000;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function toast(messageKey: string, tone: 'info' | 'warning' = 'warning') {
  useUiStore.getState().pushToast({ messageKey, tone, durationMs: 6000 });
}

function fallbackToFree(platform: Platform) {
  platform.sensors.stop();
  useSkyStore.getState().setViewMode('free');
  skyBridge.renderer?.setViewMode('free', null);
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
  const settings = useSettingsStore.getState();
  const pipeline = platform.orientation;
  pipeline.reset();
  pipeline.setSmoothing(settings.smoothing);
  pipeline.setHeadingOffset(settings.headingOffset);
  let qualityReported = false;
  platform.sensors.start((sample) => {
    pipeline.ingest(sample);
    if (!qualityReported && pipeline.hasData()) {
      qualityReported = true;
      const quality = pipeline.getHeadingQuality();
      useSkyStore.getState().setHeadingQuality(quality);
      if (quality === 'relative') toast('sensors.relativeHeading', 'info');
    }
  });
  sky.setSensorStatus('active');
  sky.setViewMode('sensor');
  skyBridge.renderer?.setViewMode('sensor', (dt, out) => pipeline.step(dt, out));

  if (watchdog) clearTimeout(watchdog);
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
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
  fallbackToFree(platform);
  useSkyStore.getState().setSensorStatus('idle');
}
