import { useCallback, useEffect, useMemo } from 'react';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { useLocationStore } from '../../store/location-store';
import { useSettingsStore } from '../../store/settings-store';
import { useWeatherStore } from '../../store/weather-store';
import { resolveObserverTimeZone, type ObserverTimeZone } from '../../utils/time-zone';
import { useNow } from '../../utils/use-now';
import { useObserver } from '../../utils/use-observer';
import { buildTonightModel, type TonightModel } from './tonight-model';

/**
 * Weather state for the observer. With `fetch` the forecast is (re)loaded — the service only goes
 * to the network when the cached forecast is older than its TTL; without it only the cache is read.
 * Never called from render loops; components using it are sheets opened by the user.
 */
export function useWeather({ fetch }: { fetch: boolean }) {
  const platform = usePlatform();
  const enabled = useSettingsStore((s) => s.weatherEnabled);
  const lat = useLocationStore((s) => s.location.latitude);
  const lon = useLocationStore((s) => s.location.longitude);
  const status = useWeatherStore((s) => s.status);
  const forecast = useWeatherStore((s) => s.forecast);
  const error = useWeatherStore((s) => s.error);

  useEffect(() => {
    if (!enabled) return;
    const exact = { latitude: lat, longitude: lon };
    const store = useWeatherStore.getState();
    store.hydrate(platform.weather, exact);
    if (!fetch) return;
    void store.refresh(platform.weather, exact);
    const onOnline = () => void useWeatherStore.getState().refresh(platform.weather, exact);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [enabled, fetch, lat, lon, platform]);

  const retry = useCallback(() => {
    void useWeatherStore.getState().refresh(platform.weather, { latitude: lat, longitude: lon }, true);
  }, [platform, lat, lon]);

  return {
    enabled,
    status,
    forecast: enabled ? forecast : null,
    error,
    retry,
  };
}

/** Observer time zone (provider zone when known, see utils/time-zone.ts). */
export function useObserverTimeZone(): ObserverTimeZone {
  const loc = useLocationStore((s) => s.location);
  const forecast = useWeatherStore((s) => s.forecast);
  const enabled = useSettingsStore((s) => s.weatherEnabled);
  const zone = enabled && forecast ? forecast.timeZone : null;
  const fLat = forecast?.location.latitude;
  const fLon = forecast?.location.longitude;
  return useMemo(
    () =>
      resolveObserverTimeZone(
        loc,
        zone && fLat != null && fLon != null ? { timeZone: zone, location: { latitude: fLat, longitude: fLon } } : null,
      ),
    [loc, zone, fLat, fLon],
  );
}

const EMPTY_MODEL: TonightModel = {
  now: 0,
  night: null,
  samples: [],
  weatherHours: null,
  current: null,
  hourly: [],
  bestWindow: null,
  bestWindowMediocre: false,
};

/**
 * Tonight model, recomputed every 10 minutes or when location / forecast change. Closed sheets
 * pass `enabled = false` and get an empty model without any computation.
 */
export function useTonight(enabled = true): TonightModel {
  const platform = usePlatform();
  const observer = useObserver();
  const now = useNow(60_000);
  const bucket = Math.floor(now.getTime() / 600_000);
  const storeForecast = useWeatherStore((s) => s.forecast);
  const weatherEnabled = useSettingsStore((s) => s.weatherEnabled);
  const forecast = weatherEnabled ? storeForecast : null;
  return useMemo(
    () => (enabled ? buildTonightModel(platform.astronomy, observer, platform.time.nowMs(), forecast) : EMPTY_MODEL),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, platform, observer, bucket, forecast],
  );
}
