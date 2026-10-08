import { describe, expect, it } from 'vitest';
import { formatTime } from './format';
import { localDateKey, longitudeTimeZone, resolveObserverTimeZone } from './time-zone';

describe('observer time zone', () => {
  const tokyo = { latitude: 35.68, longitude: 139.77, source: 'manual' as const };

  it('uses the weather provider zone for the same (rounded) place', () => {
    const z = resolveObserverTimeZone(tokyo, {
      timeZone: 'Asia/Tokyo',
      location: { latitude: 35.7, longitude: 139.75 },
    });
    expect(z).toEqual({ timeZone: 'Asia/Tokyo', approximate: false, label: null });
  });

  it('manual location in another country: never shows the device clock', () => {
    // Device in Kyiv (UTC+3), observer typed Tokyo coordinates, no forecast yet.
    const z = resolveObserverTimeZone(tokyo, null, 180);
    expect(z.approximate).toBe(true);
    expect(z.timeZone).toBe('Etc/GMT-9');
    expect(z.label).toBe('UTC+9');
  });

  it('ignores a forecast zone from a different place', () => {
    const z = resolveObserverTimeZone(tokyo, { timeZone: 'Europe/Kyiv', location: { latitude: 50.45, longitude: 30.5 } }, 180);
    expect(z.timeZone).toBe('Etc/GMT-9');
  });

  it('GPS location uses the device zone', () => {
    expect(resolveObserverTimeZone({ ...tokyo, source: 'gps' }, null, 180).timeZone).toBeUndefined();
  });

  it('manual location plausible for the device zone keeps the device clock', () => {
    expect(resolveObserverTimeZone({ latitude: 50.45, longitude: 30.52, source: 'manual' }, null, 180).timeZone).toBe(
      undefined,
    );
  });

  it('formats a UTC instant in the observer zone, not the device zone', () => {
    const t = new Date(Date.UTC(2026, 9, 8, 13, 0));
    expect(formatTime(t, 'en-GB', 'Asia/Tokyo')).toBe('22:00');
    expect(formatTime(t, 'en-GB', longitudeTimeZone(-74).timeZone)).toBe('08:00');
    expect(localDateKey(Date.UTC(2026, 9, 8, 20), 'Asia/Tokyo')).toBe('2026-10-09');
  });

  it('longitude zones have the inverted POSIX sign', () => {
    expect(longitudeTimeZone(30)).toMatchObject({ timeZone: 'Etc/GMT-2', label: 'UTC+2' });
    expect(longitudeTimeZone(-75)).toMatchObject({ timeZone: 'Etc/GMT+5', label: 'UTC−5' });
    expect(longitudeTimeZone(3)).toMatchObject({ timeZone: 'Etc/UTC', label: 'UTC' });
  });
});
