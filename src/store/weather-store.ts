import { create } from 'zustand';
import { weatherLocationKey } from '../weather/location-privacy';
import type { WeatherErrorKind, WeatherForecast, WeatherQueryLocation } from '../weather/types';
import type { WeatherService } from '../weather/weather-service';

export type WeatherStatus = 'idle' | 'loading' | 'ready' | 'fallback' | 'error';

interface WeatherState {
  status: WeatherStatus;
  forecast: WeatherForecast | null;
  error: WeatherErrorKind | null;
  /**
   * The rounded location used for the request (the exact observer location stays in the location
   * store and is never handed to the provider).
   */
  queryLocation: WeatherQueryLocation | null;
  /** Shows a cached forecast without any network access. */
  hydrate(service: WeatherService, exact: { latitude: number; longitude: number }): void;
  /** Loads (cache-aware) a forecast; `force` bypasses the freshness TTL. */
  refresh(
    service: WeatherService,
    exact: { latitude: number; longitude: number },
    force?: boolean,
  ): Promise<void>;
  reset(): void;
}

const sameQuery = (a: WeatherQueryLocation | null, b: WeatherQueryLocation) =>
  !!a && weatherLocationKey(a) === weatherLocationKey(b);

export const useWeatherStore = create<WeatherState>()((set, get) => ({
  status: 'idle',
  forecast: null,
  error: null,
  queryLocation: null,
  hydrate: (service, exact) => {
    const query = service.queryLocationFor(exact);
    const s = get();
    if (sameQuery(s.queryLocation, query) && s.forecast) return;
    const cached = service.peek(exact);
    set({
      queryLocation: query,
      forecast: cached,
      status: cached ? 'fallback' : 'idle',
      error: null,
    });
  },
  refresh: async (service, exact, force = false) => {
    const query = service.queryLocationFor(exact);
    const prev = get();
    const keep = sameQuery(prev.queryLocation, query) ? prev.forecast : null;
    set({ status: 'loading', queryLocation: query, forecast: keep, error: null });
    const result = await service.load(exact, { force });
    // Ignore results for a location the user has meanwhile changed.
    if (!sameQuery(get().queryLocation, query)) return;
    if (result.status === 'ready') {
      set({ status: 'ready', forecast: result.forecast, error: null });
    } else if (result.status === 'fallback') {
      set({ status: 'fallback', forecast: result.forecast, error: result.error });
    } else {
      set({ status: 'error', forecast: null, error: result.error });
    }
  },
  reset: () => set({ status: 'idle', forecast: null, error: null, queryLocation: null }),
}));
