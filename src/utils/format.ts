import { normalizeDegrees, normalizeHours } from '../astronomy/coordinate-transform';

/** Locale tag used for Intl formatting (Arabic uses Western digits for readability of coordinates). */
export function intlLocale(lang: string): string {
  return lang === 'ar' ? 'ar-u-nu-latn' : lang;
}

export function formatNumber(value: number, lang: string, maxFractionDigits = 1): string {
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: maxFractionDigits }).format(value);
}

export function formatDegrees(value: number, lang: string, digits = 1): string {
  return `${formatNumber(value, lang, digits)}°`;
}

/** Hours and minutes; `timeZone` (IANA) formats in the observer's zone instead of the device zone. */
export function formatTime(date: Date, lang: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
}

/** Day and month, e.g. "12 Aug" / "12 авг.", in the observer's zone when given. */
export function formatDayMonth(date: Date, lang: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(intlLocale(lang), { day: 'numeric', month: 'short', timeZone }).format(date);
}

/** "22:00–01:00" (the en dash is kept left-to-right in RTL text by the caller's dir="ltr"). */
export function formatTimeRange(start: Date, end: Date, lang: string, timeZone?: string): string {
  return `${formatTime(start, lang, timeZone)}–${formatTime(end, lang, timeZone)}`;
}

/** Time, with weekday when the date is not today. */
export function formatEventTime(date: Date, now: Date, lang: string): string {
  const sameDay = date.toDateString() === now.toDateString();
  const opts: Intl.DateTimeFormatOptions = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { weekday: 'short', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(intlLocale(lang), opts).format(date);
}

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** 1.898e27 → "1.898 × 10²⁷" */
export function formatScientific(value: number, lang: string, digits = 3): string {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp < 6) return formatNumber(value, lang, 2);
  const mantissa = value / 10 ** exp;
  const sup = String(exp)
    .split('')
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join('');
  return `${formatNumber(mantissa, lang, digits)} × 10${sup}`;
}

/** Large values compactly: 2 500 000 → "2.5 M" (localised). */
export function formatCompact(value: number, lang: string): string {
  if (Math.abs(value) < 100000) return formatNumber(value, lang, value < 10 ? 2 : 0);
  return new Intl.NumberFormat(intlLocale(lang), { notation: 'compact', maximumFractionDigits: 2 }).format(
    value,
  );
}

/** RA in hours → "06h 45m 09s". */
export function formatRa(hours: number): string {
  let h = normalizeHours(hours);
  let totalSec = Math.round(h * 3600);
  if (totalSec >= 86400) totalSec -= 86400;
  h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/** Dec in degrees → "−16° 42′ 58″". */
export function formatDec(deg: number): string {
  const sign = deg < 0 ? '−' : '+';
  const totalSec = Math.round(Math.abs(deg) * 3600);
  const d = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${sign}${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}

export function formatAzimuth(deg: number, lang: string): string {
  return formatDegrees(normalizeDegrees(deg), lang, 0);
}

export function formatLatLon(lat: number, lon: number, lang: string): string {
  return `${formatNumber(lat, lang, 2)}°, ${formatNumber(lon, lang, 2)}°`;
}
