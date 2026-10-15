import { describe, expect, it } from 'vitest';
import { formatCompact, formatDec, formatEventTime, formatRa, formatScientific, formatTime } from './format';

describe('format', () => {
  it('formats events in the observer time zone', () => {
    const date = new Date('2026-10-15T12:00:00Z');
    expect(formatEventTime(date, date, 'en-GB', 'Australia/Sydney')).toBe('23:00');
  });

  it('adds the weekday when the observer crosses midnight even within one UTC date', () => {
    const now = new Date('2026-10-15T14:00:00Z');
    const event = new Date('2026-10-15T15:30:00Z');
    expect(formatEventTime(event, now, 'en-GB', 'Asia/Tokyo')).toBe('Fri 00:30');
  });

  it('omits the weekday for one observer date even across UTC midnight', () => {
    const now = new Date('2026-10-15T23:30:00Z');
    const event = new Date('2026-10-16T01:00:00Z');
    expect(formatEventTime(event, now, 'en-GB', 'Asia/Tokyo')).toBe('10:00');
  });

  it('uses the offset of each event across the daylight-saving transition', () => {
    const now = new Date('2026-10-25T00:00:00Z');
    expect(formatEventTime(new Date('2026-10-25T00:30:00Z'), now, 'en-GB', 'Europe/Berlin')).toBe('02:30');
    expect(formatEventTime(new Date('2026-10-25T01:30:00Z'), now, 'en-GB', 'Europe/Berlin')).toBe('02:30');
  });

  it('preserves device-local formatting when no zone is specified', () => {
    const date = new Date('2026-10-15T12:00:00Z');
    expect(formatEventTime(date, date, 'en-GB')).toBe(formatTime(date, 'en-GB'));
  });
  it('formats right ascension', () => {
    expect(formatRa(6.7525)).toBe('06h 45m 09s');
    expect(formatRa(23.99999)).toBe('00h 00m 00s');
  });

  it('formats declination with sign', () => {
    expect(formatDec(-16.7161)).toBe('−16° 42′ 58″');
    expect(formatDec(89.264)).toBe('+89° 15′ 50″');
  });

  it('formats scientific notation', () => {
    expect(formatScientific(1.898e27, 'en')).toBe('1.898 × 10²⁷');
    expect(formatScientific(42, 'en')).toBe('42');
  });

  it('formats compact numbers', () => {
    expect(formatCompact(1344, 'en')).toBe('1,344');
    expect(formatCompact(2.5e6, 'en')).toBe('2.5M');
  });
});
