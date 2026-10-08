import { describe, expect, it } from 'vitest';
import { astronomyService } from '../astronomy/astronomy.service';
import { findNightSpan } from '../astronomy/night';
import { darknessPhase } from '../astronomy/twilight';
import { buildTonightModel } from '../features/observing/tonight-model';
import type { WeatherForecast, WeatherHour } from '../weather/types';
import { combineObservability } from './object-observability';

const clear = { score: 95, grade: 'excellent' as const, reasons: ['clearSky' as const] };
const cloudy = { score: 15, grade: 'bad' as const, reasons: ['overcast' as const] };

describe('object observability (astronomy × weather)', () => {
  it('well placed but cloudy', () => {
    expect(combineObservability({ status: 'visible' }, cloudy).verdict).toBe('placedButWeather');
  });
  it('clear sky but the object is low', () => {
    expect(combineObservability({ status: 'difficult' }, clear).verdict).toBe('clearButPosition');
  });
  it('both good', () => {
    expect(combineObservability({ status: 'visible' }, clear).verdict).toBe('goodBoth');
  });
  it('below the horizon: weather is irrelevant', () => {
    expect(combineObservability({ status: 'belowHorizon' }, clear).verdict).toBe('belowHorizon');
  });
  it('no forecast: astronomy only', () => {
    expect(combineObservability({ status: 'visible' }, null).verdict).toBe('weatherUnknown');
  });
});

describe('darkness phases', () => {
  it('follows the standard Sun altitude limits', () => {
    expect(darknessPhase(10)).toBe('day');
    expect(darknessPhase(-3)).toBe('civil');
    expect(darknessPhase(-9)).toBe('nautical');
    expect(darknessPhase(-15)).toBe('astronomical');
    expect(darknessPhase(-25)).toBe('night');
  });
});

describe('tonight model', () => {
  const kyiv = { latitude: 50.45, longitude: 30.52, elevation: 0 };
  // 2026-10-08 12:00 UTC = 15:00 in Kyiv: daytime, the night is still ahead.
  const noon = Date.UTC(2026, 9, 8, 12);

  function clearHours(from: number, n: number): WeatherHour[] {
    return Array.from({ length: n }, (_, i) => ({
      time: from + i * 3600_000,
      cloudCover: 0,
      cloudCoverLow: 0,
      cloudCoverMid: 0,
      cloudCoverHigh: 0,
      visibilityM: 40000,
      humidity: 50,
      dewPointC: 0,
      precipitationProbability: 0,
      precipitationMm: 0,
      weatherCode: 0,
      windSpeedKmh: 5,
      windGustsKmh: 10,
      temperatureC: 12,
    }));
  }

  it('finds the coming night (sunset → sunrise)', () => {
    const night = findNightSpan(astronomyService, kyiv, noon)!;
    expect(night.start).toBeGreaterThan(noon);
    const startH = new Date(night.start).getUTCHours();
    expect(startH).toBeGreaterThanOrEqual(14); // ~18:40 local
    expect(startH).toBeLessThanOrEqual(16);
    expect(night.end - night.start).toBeGreaterThan(11 * 3600_000);
  });

  it('a cloudless afternoon never becomes the best observing window', () => {
    const forecast: WeatherForecast = {
      provider: 'test',
      fetchedAt: noon,
      location: { latitude: 50.45, longitude: 30.5 },
      timeZone: 'Europe/Kyiv',
      utcOffsetSeconds: 10800,
      hours: clearHours(Date.UTC(2026, 9, 8, 0), 72),
    };
    const m = buildTonightModel(astronomyService, kyiv, noon, forecast);
    expect(m.current?.weather.grade).toBe('excellent');
    expect(m.hourly[0].observing.phase).toBe('day');
    expect(m.hourly[0].observing.grade).toBe('bad');
    expect(m.bestWindow).not.toBeNull();
    const night = m.night!;
    expect(m.bestWindow!.start).toBeGreaterThanOrEqual(night.start - 3600_000);
    expect(darknessPhase(astronomyService.getSunPosition(new Date(m.bestWindow!.start + 1800_000), kyiv).horizontal.altitude)).not.toBe('day');
  });

  it('without a forecast the astronomy part still works', () => {
    const m = buildTonightModel(astronomyService, kyiv, noon, null);
    expect(m.current).toBeNull();
    expect(m.hourly).toEqual([]);
    expect(m.samples.length).toBeGreaterThan(20);
  });
});
