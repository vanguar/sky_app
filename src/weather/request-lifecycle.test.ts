import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWeatherStore } from '../store/weather-store';
import { WeatherCache, type KeyValueStorage } from './cache';
import { OpenMeteoWeatherProvider } from './open-meteo-provider';
import { WeatherService } from './weather-service';
import type { ForecastOptions, WeatherForecast, WeatherProvider } from './types';

const location = { latitude: 51.5, longitude: 0 };
const now = Date.UTC(2026, 9, 11, 20, 45);
const forecast: WeatherForecast = {
  provider: 'fixture',
  fetchedAt: now,
  location,
  timeZone: 'Europe/London',
  utcOffsetSeconds: 0,
  hours: [],
};

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function slowBody(onSignal?: (signal: AbortSignal) => void): typeof fetch {
  return async (_url, init) =>
    new Response(
      new ReadableStream({
        start(controller) {
          const signal = init!.signal!;
          const timer = setTimeout(() => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ hourly: { time: [1] } })));
            controller.close();
          }, 100);
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              controller.error(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
          onSignal?.(signal);
        },
      }),
    );
}

afterEach(() => useWeatherStore.getState().reset());

describe('weather request lifecycle', () => {
  it('times out while reading the response body', async () => {
    const provider = new OpenMeteoWeatherProvider({ timeoutMs: 20, fetchImpl: slowBody() });
    await expect(provider.getForecast(location)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('honours external cancellation after headers arrive', async () => {
    const controller = new AbortController();
    const provider = new OpenMeteoWeatherProvider({
      fetchImpl: slowBody(() => setTimeout(() => controller.abort(), 5)),
    });
    await expect(provider.getForecast(location, { signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    });
  });

  it('does not send a request with an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = new OpenMeteoWeatherProvider({ fetchImpl });
    await expect(provider.getForecast(location, { signal: controller.signal })).rejects.toMatchObject({
      kind: 'aborted',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not restore cleared cache, even when the provider ignores cancellation', async () => {
    const old = deferred<WeatherForecast>();
    const next = deferred<WeatherForecast>();
    let signal!: AbortSignal;
    const getForecast = vi
      .fn<WeatherProvider['getForecast']>()
      .mockImplementationOnce((_location, options?: ForecastOptions) => {
        signal = options!.signal!;
        return old.promise;
      })
      .mockImplementationOnce(() => next.promise);
    const storage = new MemoryStorage();
    const stableService = new WeatherService(
      { id: 'fixture', getForecast },
      new WeatherCache(() => storage),
      () => now,
    );
    const pending = stableService.load(location);
    stableService.clearCache();
    expect(signal.aborted).toBe(true);
    const replacement = stableService.load(location);
    old.resolve(forecast);
    expect(await pending).toEqual({ status: 'error', error: 'aborted' });
    expect(stableService.peek(location)).toBeNull();
    expect(stableService.load(location)).toBe(replacement);
    next.resolve(forecast);
    await replacement;
    expect(stableService.peek(location)).toEqual(forecast);
  });

  it('ignores results across reset and a return to the same location', async () => {
    const first = deferred<WeatherForecast>();
    const second = deferred<WeatherForecast>();
    const getForecast = vi
      .fn<WeatherProvider['getForecast']>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const storage = new MemoryStorage();
    const service = new WeatherService(
      { id: 'fixture', getForecast },
      new WeatherCache(() => storage),
      () => now,
    );
    const oldRefresh = useWeatherStore.getState().refresh(service, location);
    service.clearCache();
    useWeatherStore.getState().reset();
    const newRefresh = useWeatherStore.getState().refresh(service, location);
    first.resolve(forecast);
    await oldRefresh;
    expect(useWeatherStore.getState().status).toBe('loading');
    second.resolve({ ...forecast, fetchedAt: now + 1 });
    await newRefresh;
    expect(useWeatherStore.getState().forecast?.fetchedAt).toBe(now + 1);
  });
});
