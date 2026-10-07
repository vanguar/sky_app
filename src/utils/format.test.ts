import { describe, expect, it } from 'vitest';
import { formatCompact, formatDec, formatRa, formatScientific } from './format';

describe('format', () => {
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
