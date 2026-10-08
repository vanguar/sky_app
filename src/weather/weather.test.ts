import { describe, expect, it, vi } from 'vitest';
import { FRESH_TTL_MS, STALE_WARNING_MS, WeatherCache, forecastFreshness, type KeyValueStorage } from './cache';
import { toWeatherQueryLocation, WEATHER_GRID_DEG } from './location-privacy';
import {
  assessObserving,
  assessWeather,
  cloudScore,
  findBestWindow,
  gradeFromScore,
  hourAt,
} from './observing-conditions';
import { OpenMeteoWeatherProvider, buildOpenMeteoUrl, parseOpenMeteoResponse } from './open-meteo-provider';
import { WeatherError, type WeatherForecast, type WeatherHour, type WeatherProvider } from './types';
import { WeatherService } from './weather-service';

const H = 3600_000;

function hour(over: Partial<WeatherHour> = {}): WeatherHour {
  return {
    time: Date.UTC(2026, 9, 8, 21),
    cloudCover: 5,
    cloudCoverLow: 0,
    cloudCoverMid: 0,
    cloudCoverHigh: 5,
    visibilityM: 30000,
    humidity: 60,
    dewPointC: 2,
    precipitationProbability: 0,
    precipitationMm: 0,
    weatherCode: 0,
    windSpeedKmh: 8,
    windGustsKmh: 15,
    temperatureC: 10,
    ...over,
  };
}

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function forecast(fetchedAt: number, loc = { latitude: 50.45, longitude: 30.5 }): WeatherForecast {
  return {
    provider: 'test',
    fetchedAt,
    location: loc,
    timeZone: 'Europe/Kyiv',
    utcOffsetSeconds: 10800,
    hours: [hour({ time: fetchedAt - (fetchedAt % H) })],
  };
}

describe('observing conditions score (weather only)', () => {
  it('clear night with no rain is good or excellent', () => {
    const r = assessWeather(hour());
    expect(['excellent', 'good']).toContain(r.grade);
    expect(r.reasons[0]).toBe('clearSky');
    expect(r.reasons).toContain('noPrecipitation');
  });

  it('90 % cloud cover is poor or bad', () => {
    const r = assessWeather(hour({ cloudCover: 90, cloudCoverLow: 90 }));
    expect(['poor', 'bad']).toContain(r.grade);
    expect(r.reasons).toContain('overcast');
  });

  it('heavy precipitation is bad whatever the cloud model says', () => {
    const r = assessWeather(hour({ cloudCover: 20, precipitationMm: 4, precipitationProbability: 95, weatherCode: 63 }));
    expect(r.grade).toBe('bad');
    expect(r.reasons[0]).toBe('rain');
  });

  it('high humidity alone does not turn the forecast into rain or fog', () => {
    const r = assessWeather(hour({ humidity: 97 }));
    expect(r.reasons).toContain('veryHighHumidity');
    expect(r.reasons).not.toContain('rain');
    expect(r.reasons).not.toContain('fogForecast');
    expect(['excellent', 'good']).toContain(r.grade);
  });

  it('fog is only reported when the provider forecasts it', () => {
    expect(assessWeather(hour({ weatherCode: 45 })).reasons).toContain('fogForecast');
  });

  it('cloud curve is monotonic and grades follow the documented thresholds', () => {
    for (let c = 0; c < 100; c += 5) expect(cloudScore(c + 5)).toBeLessThanOrEqual(cloudScore(c));
    expect(gradeFromScore(80)).toBe('excellent');
    expect(gradeFromScore(60)).toBe('good');
    expect(gradeFromScore(40)).toBe('fair');
    expect(gradeFromScore(20)).toBe('poor');
    expect(gradeFromScore(19)).toBe('bad');
  });

  it('missing variables are skipped, not invented', () => {
    const r = assessWeather(
      hour({ cloudCover: null, cloudCoverLow: null, cloudCoverMid: null, cloudCoverHigh: null, visibilityM: null }),
    );
    expect(r.reasons).toContain('noCloudData');
    expect(r.reasons).not.toContain('goodTransparency');
  });

  it('excellent weather during the day is NOT an excellent observing hour', () => {
    const w = assessWeather(hour());
    expect(w.grade).toBe('excellent');
    const day = assessObserving(w, 35);
    expect(day.grade).toBe('bad');
    expect(day.reasons[0]).toBe('daylight');
    expect(assessObserving(w, -25).grade).toBe('excellent');
    // Bright planets are fine in nautical twilight; faint objects are not.
    expect(assessObserving(w, -8, 'bright').score).toBeGreaterThan(assessObserving(w, -8, 'general').score);
  });
});

describe('best observing window', () => {
  const t0 = Date.UTC(2026, 9, 8, 18);
  const slots = [10, 30, 70, 85, 90, 65, 20, 75].map((score, i) => ({ time: t0 + i * H, score }));

  it('returns the best continuous run at hourly resolution', () => {
    const w = findBestWindow(slots, H, 60)!;
    expect(w.start).toBe(t0 + 2 * H);
    expect(w.end).toBe(t0 + 6 * H);
    expect(w.score).toBe(90);
  });

  it('returns null when nothing reaches the threshold', () => {
    expect(findBestWindow(slots, H, 95)).toBeNull();
  });

  it('does not join slots across a gap in the data', () => {
    const gappy = [
      { time: t0, score: 80 },
      { time: t0 + 3 * H, score: 80 },
    ];
    const w = findBestWindow(gappy, H, 60)!;
    expect(w.end - w.start).toBe(H);
  });

  it('finds the forecast hour covering an instant', () => {
    const hs = [hour({ time: t0 }), hour({ time: t0 + H })];
    expect(hourAt(hs, t0 + 90 * 60_000)?.time).toBe(t0 + H);
    expect(hourAt(hs, t0 + 3 * H)).toBeNull();
  });
});

describe('privacy: coordinate rounding', () => {
  it('rounds to the 0.05° grid', () => {
    expect(toWeatherQueryLocation({ latitude: 50.4501234, longitude: 30.5234567 })).toEqual({
      latitude: 50.45,
      longitude: 30.5,
    });
    expect(WEATHER_GRID_DEG).toBe(0.05);
  });

  it('the exact GPS position never reaches the provider', async () => {
    const getForecast = vi.fn(async (loc) => forecast(Date.now(), loc));
    const provider: WeatherProvider = { id: 'spy', getForecast };
    const svc = new WeatherService(provider, new WeatherCache(() => new MemoryStorage()));
    await svc.load({ latitude: 48.858371, longitude: 2.294481 });
    const sent = getForecast.mock.calls[0][0];
    expect(sent).toEqual({ latitude: 48.85, longitude: 2.3 });
    expect(Object.keys(sent).sort()).toEqual(['latitude', 'longitude']);
  });

  it('the request URL only carries rounded coordinates and forecast options', () => {
    const url = new URL(buildOpenMeteoUrl(toWeatherQueryLocation({ latitude: 48.858371, longitude: 2.294481 })));
    expect(url.searchParams.get('latitude')).toBe('48.85');
    expect(url.searchParams.get('longitude')).toBe('2.3');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.has('apikey')).toBe(false);
    expect(url.toString()).not.toContain('858371');
  });
});

describe('Open-Meteo provider', () => {
  const loc = { latitude: 50.45, longitude: 30.5 };
  const body = {
    timezone: 'Europe/Kyiv',
    utc_offset_seconds: 10800,
    hourly: {
      time: [1791493200, 1791496800],
      cloud_cover: [10, 95],
      relative_humidity_2m: [70, 90],
      visibility: [24140, 1200],
      weather_code: [0, 61],
    },
  };

  it('parses a partial response; missing variables become null', () => {
    const f = parseOpenMeteoResponse(body, loc, 1);
    expect(f.timeZone).toBe('Europe/Kyiv');
    expect(f.hours).toHaveLength(2);
    expect(f.hours[0]).toMatchObject({ time: 1791493200000, cloudCover: 10, humidity: 70, visibilityM: 24140 });
    expect(f.hours[0].windGustsKmh).toBeNull();
    expect(f.hours[0].precipitationProbability).toBeNull();
  });

  it('rejects malformed bodies and provider errors', () => {
    expect(() => parseOpenMeteoResponse('nope', loc, 1)).toThrow(WeatherError);
    expect(() => parseOpenMeteoResponse({ hourly: {} }, loc, 1)).toThrow(/time axis/);
    expect(() => parseOpenMeteoResponse({ error: true, reason: 'bad' }, loc, 1)).toThrow('bad');
  });

  it('maps HTTP errors, rate limiting and malformed JSON', async () => {
    const make = (res: Response) => new OpenMeteoWeatherProvider({ fetchImpl: async () => res });
    await expect(make(new Response('x', { status: 500 })).getForecast(loc)).rejects.toMatchObject({ kind: 'http' });
    await expect(make(new Response('x', { status: 429 })).getForecast(loc)).rejects.toMatchObject({
      kind: 'rateLimited',
    });
    await expect(make(new Response('{oops', { status: 200 })).getForecast(loc)).rejects.toMatchObject({
      kind: 'malformed',
    });
    const ok = await make(new Response(JSON.stringify(body), { status: 200 })).getForecast(loc);
    expect(ok.hours).toHaveLength(2);
  });

  it('times out with AbortController', async () => {
    const provider = new OpenMeteoWeatherProvider({
      timeoutMs: 20,
      fetchImpl: (_url, init) =>
        new Promise((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
    });
    await expect(provider.getForecast(loc)).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('weather cache & fallback', () => {
  const exact = { latitude: 50.4501, longitude: 30.5234 };

  it('serves a fresh cache entry without a request', async () => {
    const now = Date.UTC(2026, 9, 8, 20);
    const storage = new MemoryStorage();
    const cache = new WeatherCache(() => storage);
    cache.write(forecast(now - 5 * 60_000));
    const getForecast = vi.fn();
    const svc = new WeatherService({ id: 'x', getForecast }, cache, () => now);
    const r = await svc.load(exact);
    expect(r).toMatchObject({ status: 'ready', source: 'cache' });
    expect(getForecast).not.toHaveBeenCalled();
  });

  it('API failure → last forecast is returned as fallback (never as fresh)', async () => {
    const now = Date.UTC(2026, 9, 8, 20);
    const storage = new MemoryStorage();
    const cache = new WeatherCache(() => storage);
    cache.write(forecast(now - 2 * H));
    const svc = new WeatherService(
      {
        id: 'x',
        getForecast: async () => {
          throw new WeatherError('offline', 'offline');
        },
      },
      cache,
      () => now,
    );
    const r = await svc.load(exact);
    expect(r.status).toBe('fallback');
    if (r.status === 'fallback') {
      expect(r.error).toBe('offline');
      expect(forecastFreshness(r.forecast.fetchedAt, now)).toBe('aging');
    }
  });

  it('API failure without cache → error result, no exception', async () => {
    const svc = new WeatherService(
      {
        id: 'x',
        getForecast: async () => {
          throw new Error('boom');
        },
      },
      new WeatherCache(() => new MemoryStorage()),
    );
    await expect(svc.load(exact)).resolves.toEqual({ status: 'error', error: 'unknown' });
  });

  it('classifies age: fresh → aging → stale', () => {
    const now = 10 * STALE_WARNING_MS;
    expect(forecastFreshness(now - FRESH_TTL_MS + 1, now)).toBe('fresh');
    expect(forecastFreshness(now - FRESH_TTL_MS - 1, now)).toBe('aging');
    expect(forecastFreshness(now - STALE_WARNING_MS - 1, now)).toBe('stale');
  });

  it('ignores corrupted entries and entries for another place', () => {
    const storage = new MemoryStorage();
    const cache = new WeatherCache(() => storage);
    storage.setItem('astropoint.weather.v1', '{not json');
    expect(cache.read({ latitude: 50.45, longitude: 30.5 }, Date.now())).toBeNull();
    cache.write(forecast(Date.now()));
    expect(cache.read({ latitude: 10, longitude: 10 }, Date.now())).toBeNull();
    expect(cache.read({ latitude: 50.45, longitude: 30.5 }, Date.now())).not.toBeNull();
  });
});
