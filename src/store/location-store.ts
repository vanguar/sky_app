import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Observer } from '../astronomy/types';
import { createSafeStorage, isRecord, pickEnum, pickNumber } from './persistence';

export type LocationSource = 'gps' | 'manual' | 'default';

export interface StoredLocation extends Observer {
  source: LocationSource;
  updatedAt: number;
}

/** Used until the user shares or enters a location: Royal Observatory, Greenwich. */
export const DEFAULT_LOCATION: StoredLocation = {
  latitude: 51.4779,
  longitude: -0.0015,
  elevation: 46,
  source: 'default',
  updatedAt: 0,
};

interface LocationState {
  location: StoredLocation;
  setLocation(loc: Omit<StoredLocation, 'updatedAt'>): void;
  reset(): void;
}

export const LOCATION_STORAGE_KEY = 'astropoint.location';

export function isValidLatitude(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}
export function isValidLongitude(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}

export function sanitizeLocation(raw: unknown): StoredLocation {
  if (!isRecord(raw) || !isRecord(raw.location)) return { ...DEFAULT_LOCATION };
  const l = raw.location;
  const latitude = pickNumber(l.latitude, NaN, -90, 90);
  const longitude = pickNumber(l.longitude, NaN, -180, 180);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return { ...DEFAULT_LOCATION };
  return {
    latitude,
    longitude,
    elevation: pickNumber(l.elevation, 0, -500, 9000),
    source: pickEnum(l.source, ['gps', 'manual', 'default'] as const, 'manual'),
    updatedAt: pickNumber(l.updatedAt, 0, 0),
  };
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: { ...DEFAULT_LOCATION },
      setLocation: (loc) => set({ location: { ...loc, updatedAt: Date.now() } }),
      reset: () => set({ location: { ...DEFAULT_LOCATION } }),
    }),
    {
      name: LOCATION_STORAGE_KEY,
      version: 1,
      storage: createSafeStorage<{ location: StoredLocation }>(),
      partialize: (s) => ({ location: s.location }),
      merge: (persisted, current) => ({ ...current, location: sanitizeLocation(persisted) }),
    },
  ),
);
