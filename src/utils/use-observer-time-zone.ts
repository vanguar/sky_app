import { useMemo } from 'react';
import { useLocationStore } from '../store/location-store';
import { useSettingsStore } from '../store/settings-store';
import { useWeatherStore } from '../store/weather-store';
import { resolveObserverTimeZone, type ObserverTimeZone } from './time-zone';

/** Shared display zone for the map, object events and observing panels; never requests weather. */
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
        zone && fLat != null && fLon != null
          ? { timeZone: zone, location: { latitude: fLat, longitude: fLon } }
          : null,
      ),
    [loc, zone, fLat, fLon],
  );
}
