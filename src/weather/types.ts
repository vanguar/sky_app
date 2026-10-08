/**
 * Weather types used by the observing-conditions feature.
 *
 * Every numeric field is `number | null`: a provider may omit a variable for some models or
 * hours, and the app must never invent values that were not delivered.
 */

/** Location sent to a weather provider. Always ROUNDED (see `location-privacy.ts`), never exact GPS. */
export interface WeatherQueryLocation {
  latitude: number;
  longitude: number;
}

/** One forecast hour. `time` is the UTC start of the hour in epoch milliseconds. */
export interface WeatherHour {
  time: number;
  /** Total cloud cover, %. */
  cloudCover: number | null;
  cloudCoverLow: number | null;
  cloudCoverMid: number | null;
  cloudCoverHigh: number | null;
  /** Horizontal visibility near the ground, metres. */
  visibilityM: number | null;
  /** Relative humidity at 2 m, %. */
  humidity: number | null;
  dewPointC: number | null;
  /** Probability of precipitation, %. */
  precipitationProbability: number | null;
  /** Precipitation during the hour, mm. */
  precipitationMm: number | null;
  /** WMO weather interpretation code. */
  weatherCode: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  temperatureC: number | null;
}

export interface WeatherForecast {
  /** Provider id, e.g. "open-meteo". */
  provider: string;
  /** Epoch ms when the forecast was downloaded. */
  fetchedAt: number;
  /** The rounded location the forecast was requested for. */
  location: WeatherQueryLocation;
  /** IANA time zone of the forecast location as reported by the provider (null if unknown). */
  timeZone: string | null;
  /** UTC offset of the forecast location in seconds as reported by the provider. */
  utcOffsetSeconds: number | null;
  hours: WeatherHour[];
}

export interface ForecastOptions {
  /** Number of hourly steps to request (from the current hour). */
  hours?: number;
  /** Abort signal for cancellation (the provider adds its own timeout as well). */
  signal?: AbortSignal;
}

/**
 * Pluggable weather source. The UI only talks to this interface, so the free Open-Meteo
 * endpoint can be replaced (commercial plan, self-hosted proxy, another provider) without
 * touching components.
 */
export interface WeatherProvider {
  readonly id: string;
  getForecast(location: WeatherQueryLocation, options?: ForecastOptions): Promise<WeatherForecast>;
}

export type WeatherErrorKind = 'offline' | 'timeout' | 'http' | 'rateLimited' | 'malformed' | 'unknown';

export class WeatherError extends Error {
  readonly kind: WeatherErrorKind;
  readonly status?: number;
  constructor(kind: WeatherErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'WeatherError';
    this.kind = kind;
    this.status = status;
  }
}
