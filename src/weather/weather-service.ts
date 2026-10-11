import { FRESH_TTL_MS, WeatherCache } from './cache';
import { toWeatherQueryLocation, weatherLocationKey } from './location-privacy';
import {
  WeatherError,
  type WeatherErrorKind,
  type WeatherForecast,
  type WeatherProvider,
  type WeatherQueryLocation,
} from './types';

export type WeatherLoadResult =
  /** Forecast from the network or a cache entry younger than the TTL. */
  | { status: 'ready'; forecast: WeatherForecast; source: 'network' | 'cache' }
  /** Refresh failed, an older cached forecast is shown instead ("last forecast"). */
  | { status: 'fallback'; forecast: WeatherForecast; error: WeatherErrorKind }
  /** Refresh failed and nothing is cached. */
  | { status: 'error'; error: WeatherErrorKind };

/**
 * Orchestrates provider + cache. Takes the EXACT observer location but only ever hands the
 * rounded {@link WeatherQueryLocation} to the provider. Concurrent calls for the same place
 * share one request.
 */
export class WeatherService {
  private readonly provider: WeatherProvider;
  private readonly cache: WeatherCache;
  private readonly now: () => number;
  private inFlight = new Map<string, { promise: Promise<WeatherLoadResult>; controller: AbortController }>();
  private generation = 0;

  constructor(provider: WeatherProvider, cache = new WeatherCache(), now: () => number = Date.now) {
    this.provider = provider;
    this.cache = cache;
    this.now = now;
  }

  get providerId(): string {
    return this.provider.id;
  }

  queryLocationFor(exact: { latitude: number; longitude: number }): WeatherQueryLocation {
    return toWeatherQueryLocation(exact);
  }

  /** Forgets the stored forecast (feature turned off / reset). */
  clearCache(): void {
    this.generation++;
    for (const request of this.inFlight.values()) request.controller.abort();
    this.inFlight.clear();
    this.cache.clear();
  }

  /** Cached forecast for a location without any network access. */
  peek(exact: { latitude: number; longitude: number }): WeatherForecast | null {
    return this.cache.read(this.queryLocationFor(exact), this.now());
  }

  load(
    exact: { latitude: number; longitude: number },
    opts: { force?: boolean } = {},
  ): Promise<WeatherLoadResult> {
    const query = this.queryLocationFor(exact);
    const key = weatherLocationKey(query);
    const running = this.inFlight.get(key);
    if (running) return running.promise;
    const controller = new AbortController();
    const p = this.doLoad(query, !!opts.force, controller.signal, this.generation).finally(() => {
      if (this.inFlight.get(key)?.promise === p) this.inFlight.delete(key);
    });
    this.inFlight.set(key, { promise: p, controller });
    return p;
  }

  private async doLoad(
    query: WeatherQueryLocation,
    force: boolean,
    signal: AbortSignal,
    generation: number,
  ): Promise<WeatherLoadResult> {
    const now = this.now();
    const cached = this.cache.read(query, now);
    if (cached && !force && now - cached.fetchedAt < FRESH_TTL_MS) {
      return { status: 'ready', forecast: cached, source: 'cache' };
    }
    try {
      const forecast = await this.provider.getForecast(query, { hours: 48, signal });
      // Providers may finish even after cancellation. Never restore a cache that was cleared.
      if (signal.aborted || generation !== this.generation) return { status: 'error', error: 'aborted' };
      this.cache.write(forecast);
      return { status: 'ready', forecast, source: 'network' };
    } catch (e) {
      if (signal.aborted || generation !== this.generation) return { status: 'error', error: 'aborted' };
      const kind: WeatherErrorKind = e instanceof WeatherError ? e.kind : 'unknown';
      return cached
        ? { status: 'fallback', forecast: cached, error: kind }
        : { status: 'error', error: kind };
    }
  }
}
