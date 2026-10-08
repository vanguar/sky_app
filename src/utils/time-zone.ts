/**
 * Which clock to show times in. Forecast and meteor times must be the OBSERVER's local time:
 *  1. the weather provider's IANA zone for this place (exact, incl. DST) when a forecast for the
 *     same rounded location is known;
 *  2. the device zone when the location comes from GPS (the phone is where the observer is), or when
 *     the device's UTC offset is plausible for the observer's longitude;
 *  3. otherwise (manual coordinates in another part of the world, offline) a fixed whole-hour
 *     offset from the longitude, explicitly marked as approximate ("UTC+3").
 */
export interface ObserverTimeZone {
  /** IANA zone for Intl; undefined = device zone. */
  timeZone: string | undefined;
  approximate: boolean;
  /** "UTC+3" style label for approximate zones (null otherwise). */
  label: string | null;
}

export interface TimeZoneInput {
  latitude: number;
  longitude: number;
  source: 'gps' | 'manual' | 'default';
}

export interface ForecastZoneHint {
  timeZone: string | null;
  location: { latitude: number; longitude: number };
}

/** Is the zone name usable by this browser's Intl? */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Whole-hour zone from the longitude (nautical time zones). Etc/GMT signs are inverted by POSIX. */
export function longitudeTimeZone(longitude: number): { timeZone: string; label: string; offsetHours: number } {
  const offset = Math.max(-12, Math.min(12, Math.round(longitude / 15)));
  if (offset === 0) return { timeZone: 'Etc/UTC', label: 'UTC', offsetHours: 0 };
  const sign = offset > 0 ? '+' : '−';
  return {
    timeZone: `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`,
    label: `UTC${sign}${Math.abs(offset)}`,
    offsetHours: offset,
  };
}

export function resolveObserverTimeZone(
  loc: TimeZoneInput,
  forecast: ForecastZoneHint | null,
  deviceOffsetMinutes: number = -new Date().getTimezoneOffset(),
): ObserverTimeZone {
  if (
    forecast?.timeZone &&
    Math.abs(forecast.location.latitude - loc.latitude) <= 0.1 &&
    Math.abs(forecast.location.longitude - loc.longitude) <= 0.1 &&
    isValidTimeZone(forecast.timeZone)
  ) {
    return { timeZone: forecast.timeZone, approximate: false, label: null };
  }
  if (loc.source === 'gps') return { timeZone: undefined, approximate: false, label: null };
  // Real zones deviate from longitude/15 by up to ~2–3 h (China, Spain, DST); accept the device zone
  // when it is within that range, otherwise the observer is clearly elsewhere.
  if (Math.abs(deviceOffsetMinutes / 60 - loc.longitude / 15) <= 2.5) {
    return { timeZone: undefined, approximate: false, label: null };
  }
  const z = longitudeTimeZone(loc.longitude);
  return { timeZone: z.timeZone, approximate: true, label: z.label };
}

/** Calendar date (YYYY-MM-DD) of an instant in a zone. */
export function localDateKey(t: number, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
