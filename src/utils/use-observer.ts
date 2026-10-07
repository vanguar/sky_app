import { useMemo } from 'react';
import type { Observer } from '../astronomy/types';
import { useLocationStore } from '../store/location-store';

/** Current observer as a stable object (changes only when the location changes). */
export function useObserver(): Observer {
  const loc = useLocationStore((s) => s.location);
  return useMemo(
    () => ({ latitude: loc.latitude, longitude: loc.longitude, elevation: loc.elevation }),
    [loc.latitude, loc.longitude, loc.elevation],
  );
}
