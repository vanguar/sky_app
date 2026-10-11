import { describe, expect, it } from 'vitest';
import { AstronomyService } from '../../astronomy/astronomy.service';
import { planMeteorNight } from '../../meteors/best-time';
import { METEOR_SHOWERS } from '../../meteors/catalog';
import { buildTonightModel } from './tonight-model';
import type { WeatherForecast, WeatherHour } from '../../weather/types';

const HOUR = 3_600_000;
const observer = { latitude: 51.5, longitude: 0, elevation: 0 };
function forecast(now: number): WeatherForecast {
  return {
    provider: 'fixture',
    fetchedAt: now,
    location: observer,
    timeZone: 'Europe/London',
    utcOffsetSeconds: 0,
    hours: Array.from(
      { length: 48 },
      (_, index) =>
        ({
          time: Math.floor(now / HOUR) * HOUR + index * HOUR,
          cloudCover: 0,
          cloudCoverLow: 0,
          cloudCoverMid: 0,
          cloudCoverHigh: 0,
          visibilityM: 24_000,
          humidity: 60,
          dewPointC: 0,
          precipitationProbability: 0,
          precipitationMm: 0,
          weatherCode: 0,
          windSpeedKmh: 5,
          windGustsKmh: 7,
          temperatureC: 10,
        }) satisfies WeatherHour,
    ),
  };
}

describe('remaining observing night', () => {
  const astronomy = new AstronomyService();
  it.each(['2026-10-11T20:45:00Z', '2026-10-11T23:55:00Z', '2026-10-12T04:10:00Z', '2026-10-11T16:30:00Z'])(
    'clips recommendations to the remaining night at %s',
    (date) => {
      const now = Date.parse(date);
      const model = buildTonightModel(astronomy, observer, now, forecast(now));
      expect(model.night).not.toBeNull();
      expect(model.bestWindow).not.toBeNull();
      expect(model.bestWindow!.start).toBeGreaterThanOrEqual(Math.max(now, model.night!.start));
      expect(model.bestWindow!.end).toBeLessThanOrEqual(model.night!.end);
      expect(model.samples[0].time).toBeGreaterThanOrEqual(Math.max(now, model.night!.start));
      const plan = planMeteorNight(
        astronomy,
        METEOR_SHOWERS.find((shower) => shower.code === 'ORI')!,
        observer,
        model.samples,
        model.weatherHours,
        model.night!.end,
      );
      for (const slot of plan.slots) {
        expect(slot.time).toBeGreaterThanOrEqual(now);
        expect(slot.end).toBeLessThanOrEqual(model.night!.end);
      }
      if (plan.window) expect(plan.window.end).toBeLessThanOrEqual(model.night!.end);
    },
  );

  it('has no recommendation during polar day or without a forecast', () => {
    const now = Date.parse('2026-06-21T12:15:00Z');
    expect(buildTonightModel(astronomy, { ...observer, latitude: 89 }, now, forecast(now)).night).toBeNull();
    expect(buildTonightModel(astronomy, observer, now, null).bestWindow).toBeNull();
  });
});
