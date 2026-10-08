/**
 * "Best time tonight" for a meteor shower: the night is sampled every 30 minutes; for each sample
 * Sun, radiant, Moon, weather and activity are evaluated with {@link meteorObservability}; the
 * best continuous window is returned. Runs on demand (memoised), never in the render loop.
 */
import type { AstronomyService } from '../astronomy/astronomy.service';
import type { SkySample } from '../astronomy/night';
import type { Observer } from '../astronomy/types';
import {
  assessWeather,
  findBestWindow,
  hourAt,
  type BestWindow,
  type ScoredSlot,
} from '../weather/observing-conditions';
import type { WeatherHour } from '../weather/types';
import { showerActivity } from './activity';
import { radiantAt, separationDeg } from './radiant';
import type { MeteorShowerDefinition } from './types';
import { meteorObservability, type MeteorObservability } from './visibility';

export const METEOR_STEP_MS = 30 * 60 * 1000;
/** Below this best score the night is reported as poor (no window recommended). */
export const MIN_WINDOW_SCORE = 30;
export const HIGH_RADIANT_DEG = 30;
/** Slots within 75 % of the night's best score belong to the recommended window. */
export const WINDOW_RATIO = 0.75;

export interface MeteorSlot extends ScoredSlot {
  radiantAltitude: number;
  radiantAzimuth: number;
  result: MeteorObservability;
}

export interface MeteorNightPlan {
  slots: MeteorSlot[];
  window: BestWindow | null;
  /** Assessment at the best moment of the night (or the first sample if the night is empty). */
  best: MeteorSlot | null;
  /** When the radiant first climbs above 30° (if it is lower at the start of the night). */
  radiantHighAfter: number | null;
  weatherUsed: boolean;
}

/** Evaluates one instant (shared by the card's "now" line and the night plan). */
export function evaluateMeteorAt(
  svc: AstronomyService,
  def: MeteorShowerDefinition,
  observer: Observer,
  sample: SkySample,
  weatherHours: WeatherHour[] | null,
): MeteorSlot {
  const activity = showerActivity(def, sample.time);
  const r = radiantAt(def, activity.occurrence, sample.time);
  const hor = svc.getHorizontalFromJ2000(r.raDeg / 15, r.decDeg, new Date(sample.time), observer);
  const hour = weatherHours ? hourAt(weatherHours, sample.time) : null;
  const result = meteorObservability({
    status: activity.status,
    zhr: activity.occurrence.zhr,
    radiantAltitude: hor.altitude,
    sunAltitude: sample.sunAltitude,
    moonAltitude: sample.moonAltitude,
    moonIllumination: sample.moonIllumination,
    moonSeparation: separationDeg(
      r.raDeg,
      r.decDeg,
      sample.moonEquatorial.ra * 15,
      sample.moonEquatorial.dec,
    ),
    weather: hour ? assessWeather(hour) : null,
  });
  return {
    time: sample.time,
    score: result.score,
    radiantAltitude: hor.altitude,
    radiantAzimuth: hor.azimuth,
    result,
  };
}

export function planMeteorNight(
  svc: AstronomyService,
  def: MeteorShowerDefinition,
  observer: Observer,
  samples: SkySample[],
  weatherHours: WeatherHour[] | null,
): MeteorNightPlan {
  const slots = samples.map((s) => evaluateMeteorAt(svc, def, observer, s, weatherHours));
  return bestFromSlots(slots, METEOR_STEP_MS);
}

/** Pure part of the plan (unit-testable with fixtures). */
export function bestFromSlots(slots: MeteorSlot[], stepMs: number): MeteorNightPlan {
  const weatherUsed = slots.some((s) => !s.result.weatherUnknown);
  if (slots.length === 0) return { slots, window: null, best: null, radiantHighAfter: null, weatherUsed };
  const best = slots.reduce((a, b) => (b.score > a.score ? b : a));
  let window: BestWindow | null = null;
  if (best.score >= MIN_WINDOW_SCORE) {
    const threshold = Math.max(MIN_WINDOW_SCORE, Math.round(best.score * WINDOW_RATIO));
    window = findBestWindow(slots, stepMs, threshold);
  }
  let radiantHighAfter: number | null = null;
  if (slots[0].radiantAltitude < HIGH_RADIANT_DEG) {
    radiantHighAfter = slots.find((s) => s.radiantAltitude >= HIGH_RADIANT_DEG)?.time ?? null;
  }
  return { slots, window, best, radiantHighAfter, weatherUsed };
}
