import {
  WeatherError,
  type ForecastOptions,
  type WeatherForecast,
  type WeatherHour,
  type WeatherProvider,
  type WeatherQueryLocation,
} from './types';

/**
 * Open-Meteo Forecast API (https://open-meteo.com/en/docs), "best match" model selection.
 *
 * LICENCE: the free endpoint `api.open-meteo.com` is for NON-COMMERCIAL use only (< 10 000 calls/day)
 * and its data are CC BY 4.0 (attribution required). A commercial AstroPoint must switch to a paid
 * plan (`customer-api.open-meteo.com` + `apikey`), a proxy or another provider — pass `baseUrl` /
 * `apiKey` or implement another {@link WeatherProvider}. See docs/DATA_SOURCES.md.
 */
export const OPEN_METEO_FREE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Hourly variables requested (names verified against the official docs, 2026-10-08). */
export const OPEN_METEO_HOURLY = [
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'visibility',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'temperature_2m',
] as const;

type HourlyVar = (typeof OPEN_METEO_HOURLY)[number];

const FIELD: Record<HourlyVar, keyof Omit<WeatherHour, 'time'>> = {
  cloud_cover: 'cloudCover',
  cloud_cover_low: 'cloudCoverLow',
  cloud_cover_mid: 'cloudCoverMid',
  cloud_cover_high: 'cloudCoverHigh',
  visibility: 'visibilityM',
  relative_humidity_2m: 'humidity',
  dew_point_2m: 'dewPointC',
  precipitation_probability: 'precipitationProbability',
  precipitation: 'precipitationMm',
  weather_code: 'weatherCode',
  wind_speed_10m: 'windSpeedKmh',
  wind_gusts_10m: 'windGustsKmh',
  temperature_2m: 'temperatureC',
};

export const DEFAULT_TIMEOUT_MS = 10_000;

export interface OpenMeteoOptions {
  baseUrl?: string;
  /** Required by the commercial endpoint; never needed (and never sent) for the free one. */
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export function buildOpenMeteoUrl(
  loc: WeatherQueryLocation,
  opts: { baseUrl?: string; apiKey?: string; days?: number } = {},
): string {
  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    hourly: OPEN_METEO_HOURLY.join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: String(opts.days ?? 3),
    wind_speed_unit: 'kmh',
  });
  if (opts.apiKey) params.set('apikey', opts.apiKey);
  return `${opts.baseUrl ?? OPEN_METEO_FREE_URL}?${params.toString()}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Validates and converts an Open-Meteo JSON body. Missing variables become `null` (partial
 * responses are allowed); a body without a usable time axis is rejected as malformed.
 */
export function parseOpenMeteoResponse(
  body: unknown,
  location: WeatherQueryLocation,
  fetchedAt: number,
): WeatherForecast {
  if (!isRecord(body)) throw new WeatherError('malformed', 'Response is not an object');
  if (body.error === true) {
    throw new WeatherError('http', typeof body.reason === 'string' ? body.reason : 'Provider error');
  }
  const hourly = body.hourly;
  if (!isRecord(hourly) || !Array.isArray(hourly.time) || hourly.time.length === 0) {
    throw new WeatherError('malformed', 'Missing hourly time axis');
  }
  const times = hourly.time;
  const columns = OPEN_METEO_HOURLY.map((name) => {
    const col = hourly[name];
    return { field: FIELD[name], values: Array.isArray(col) ? col : null };
  });
  const hours: WeatherHour[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = num(times[i]);
    if (t == null) continue;
    const h = { time: t * 1000 } as WeatherHour;
    for (const c of columns) h[c.field] = c.values ? num(c.values[i]) : null;
    hours.push(h);
  }
  if (hours.length === 0) throw new WeatherError('malformed', 'No valid hours');
  hours.sort((a, b) => a.time - b.time);
  return {
    provider: 'open-meteo',
    fetchedAt,
    location,
    timeZone: typeof body.timezone === 'string' && body.timezone ? body.timezone : null,
    utcOffsetSeconds: num(body.utc_offset_seconds),
    hours,
  };
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = 'open-meteo';
  private readonly opts: OpenMeteoOptions;

  constructor(opts: OpenMeteoOptions = {}) {
    this.opts = opts;
  }

  async getForecast(location: WeatherQueryLocation, options: ForecastOptions = {}): Promise<WeatherForecast> {
    const fetchImpl = this.opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const now = this.opts.now ?? Date.now;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new WeatherError('offline', 'Device is offline');
    }
    const days = Math.min(16, Math.max(1, Math.ceil(((options.hours ?? 48) + 24) / 24)));
    const url = buildOpenMeteoUrl(location, { baseUrl: this.opts.baseUrl, apiKey: this.opts.apiKey, days });
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onOuterAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onOuterAbort);
    let res: Response;
    try {
      // No cookies or credentials; the request carries only the rounded coordinates.
      res = await fetchImpl(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    } catch (e) {
      if (timedOut) throw new WeatherError('timeout', 'Weather request timed out');
      if (typeof navigator !== 'undefined' && navigator.onLine === false)
        throw new WeatherError('offline', 'Device is offline');
      throw new WeatherError('unknown', e instanceof Error ? e.message : 'Network error');
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onOuterAbort);
    }
    if (res.status === 429) throw new WeatherError('rateLimited', 'Rate limited', 429);
    if (!res.ok) throw new WeatherError('http', `HTTP ${res.status}`, res.status);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new WeatherError('malformed', 'Invalid JSON');
    }
    return parseOpenMeteoResponse(body, location, now());
  }
}
