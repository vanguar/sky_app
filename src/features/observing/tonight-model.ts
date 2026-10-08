/**
 * Glue between astronomy (Sun/Moon timeline), weather forecast and the scoring models.
 * Plain functions — the React hooks only memoise them.
 */
import type { AstronomyService } from '../../astronomy/astronomy.service';
import { findNightSpan, floorTo, sampleSky, type NightSpan, type SkySample } from '../../astronomy/night';
import type { Observer } from '../../astronomy/types';
import { METEOR_STEP_MS } from '../../meteors/best-time';
import {
  assessObserving,
  assessWeather,
  findBestWindow,
  hourAt,
  type BestWindow,
  type ObservingConditionsResult,
} from '../../weather/observing-conditions';
import type { WeatherForecast, WeatherHour } from '../../weather/types';

const HOUR = 3600_000;

export interface HourlyOutlook {
  time: number;
  hour: WeatherHour;
  weather: ObservingConditionsResult;
  observing: ReturnType<typeof assessObserving>;
}

export interface TonightModel {
  now: number;
  night: NightSpan | null;
  /** 30-minute Sun/Moon samples over the remaining night. */
  samples: SkySample[];
  /** Forecast hours still relevant (current hour onward), or null without a forecast. */
  weatherHours: WeatherHour[] | null;
  /** Weather of the current hour (null if not covered by the forecast). */
  current: { hour: WeatherHour; weather: ObservingConditionsResult } | null;
  /** Next 24 forecast hours with weather + darkness-limited observing scores. */
  hourly: HourlyOutlook[];
  /** Best observing window tonight (hourly resolution). */
  bestWindow: BestWindow | null;
  /** The best window does not reach "good"; it is the best of a mediocre night. */
  bestWindowMediocre: boolean;
}

/** Threshold for a recommended observing window ("good"); "fair" is used as a fallback. */
export const GOOD_WINDOW_SCORE = 60;
export const FAIR_WINDOW_SCORE = 40;

export function buildTonightModel(
  svc: AstronomyService,
  observer: Observer,
  now: number,
  forecast: WeatherForecast | null,
): TonightModel {
  const night = findNightSpan(svc, observer, now);
  const samples = night
    ? sampleSky(svc, observer, Math.max(floorTo(night.start, METEOR_STEP_MS), floorTo(now, METEOR_STEP_MS)), night.end, METEOR_STEP_MS)
    : [];
  const currentHourStart = floorTo(now, HOUR);
  const weatherHours = forecast ? forecast.hours.filter((h) => h.time >= currentHourStart) : null;
  const usable = weatherHours && weatherHours.length > 0 ? weatherHours : null;

  const currentHour = usable ? hourAt(usable, now) : null;
  const current = currentHour ? { hour: currentHour, weather: assessWeather(currentHour) } : null;

  const hourly: HourlyOutlook[] = (usable ?? [])
    .filter((h) => h.time < currentHourStart + 24 * HOUR)
    .map((h) => {
      const weather = assessWeather(h);
      // Darkness at the middle of the hour.
      const sunAlt = svc.getSunPosition(new Date(h.time + HOUR / 2), observer).horizontal.altitude;
      return { time: h.time, hour: h, weather, observing: assessObserving(weather, sunAlt) };
    });

  let bestWindow: BestWindow | null = null;
  let bestWindowMediocre = false;
  if (night && hourly.length) {
    const inNight = hourly
      .filter((h) => h.time + HOUR > night.start && h.time < night.end)
      .map((h) => ({ time: h.time, score: h.observing.score }));
    bestWindow = findBestWindow(inNight, HOUR, GOOD_WINDOW_SCORE);
    if (!bestWindow) {
      bestWindow = findBestWindow(inNight, HOUR, FAIR_WINDOW_SCORE);
      bestWindowMediocre = !!bestWindow;
    }
  }

  return { now, night, samples, weatherHours: usable, current, hourly, bestWindow, bestWindowMediocre };
}
