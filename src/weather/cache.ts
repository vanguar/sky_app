import { weatherLocationKey } from './location-privacy';
import type { WeatherForecast, WeatherQueryLocation } from './types';

/**
 * Last-forecast cache. The project has no IndexedDB layer, and a forecast is ~10 KB, so a single
 * localStorage entry is the simplest robust choice. Only the ROUNDED location is stored.
 *
 * The cache serves two purposes:
 *  - avoid re-requesting within {@link FRESH_TTL_MS} (no request per render / per sheet opening);
 *  - offline / error fallback, always shown as "last forecast" with its age.
 */
export const WEATHER_CACHE_KEY = 'astropoint.weather.v1';
/** A forecast younger than this is used without a network request. */
export const FRESH_TTL_MS = 30 * 60 * 1000;
/** Older than this, the UI explicitly warns that the forecast is outdated. */
export const STALE_WARNING_MS = 6 * 60 * 60 * 1000;
/** Older than this, the cached forecast is discarded. */
export const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000;

export type Freshness = 'fresh' | 'aging' | 'stale';

export function forecastFreshness(fetchedAt: number, now: number): Freshness {
  const age = now - fetchedAt;
  if (age < FRESH_TTL_MS) return 'fresh';
  if (age < STALE_WARNING_MS) return 'aging';
  return 'stale';
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function isForecast(v: unknown): v is WeatherForecast {
  if (!v || typeof v !== 'object') return false;
  const f = v as Partial<WeatherForecast>;
  return (
    typeof f.provider === 'string' &&
    typeof f.fetchedAt === 'number' &&
    !!f.location &&
    typeof f.location.latitude === 'number' &&
    typeof f.location.longitude === 'number' &&
    Array.isArray(f.hours) &&
    f.hours.every((h) => h && typeof h.time === 'number')
  );
}

export class WeatherCache {
  private readonly storage: () => KeyValueStorage | null;

  constructor(storage: () => KeyValueStorage | null = defaultStorage) {
    this.storage = storage;
  }

  /** Last forecast for this rounded location, or null (missing, corrupted, other place, too old). */
  read(loc: WeatherQueryLocation, now: number): WeatherForecast | null {
    const s = this.storage();
    if (!s) return null;
    let raw: string | null = null;
    try {
      raw = s.getItem(WEATHER_CACHE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { key?: string; forecast?: unknown };
      if (parsed.key !== weatherLocationKey(loc) || !isForecast(parsed.forecast)) return null;
      if (now - parsed.forecast.fetchedAt > MAX_CACHE_AGE_MS || parsed.forecast.fetchedAt > now + 60_000)
        return null;
      return parsed.forecast;
    } catch {
      this.clear();
      return null;
    }
  }

  write(forecast: WeatherForecast): void {
    try {
      this.storage()?.setItem(
        WEATHER_CACHE_KEY,
        JSON.stringify({ key: weatherLocationKey(forecast.location), forecast }),
      );
    } catch {
      /* quota / disabled storage: the app simply refetches next time */
    }
  }

  clear(): void {
    try {
      this.storage()?.removeItem(WEATHER_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}
