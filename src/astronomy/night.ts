/**
 * Night timeline: Sun and Moon sampled over the coming night. Used by the observing-window and
 * meteor best-time models. Computed on demand (memoised per ~10 min by the UI), never per frame.
 */
import type { AstronomyService } from './astronomy.service';
import { darknessPhase, type DarknessPhase } from './twilight';
import type { EquatorialCoords, Observer } from './types';

export interface SkySample {
  /** Epoch ms. */
  time: number;
  sunAltitude: number;
  phase: DarknessPhase;
  moonAltitude: number;
  /** Illuminated fraction 0…1. */
  moonIllumination: number;
  /** Topocentric J2000 RA (h) / Dec (deg) of the Moon. */
  moonEquatorial: EquatorialCoords;
}

export interface NightSpan {
  /** Start of the dark-enough period (Sun below the horizon) or "now" if already dark. */
  start: number;
  end: number;
  /** True when the Sun never rises within the scanned range (polar night). */
  sunNeverRises: boolean;
}

const SUN_HORIZON = -0.833;
const SCAN_STEP_MS = 10 * 60 * 1000;
const SCAN_RANGE_MS = 24 * 3600 * 1000;

/**
 * The current or next night after `now`: from sunset (or now, if the Sun is already down) to the
 * following sunrise, resolved to 10 minutes. Null if the Sun stays up for the next 24 h (polar day).
 */
export function findNightSpan(svc: AstronomyService, observer: Observer, now: number): NightSpan | null {
  const sunAlt = (t: number) => svc.getSunPosition(new Date(t), observer).horizontal.altitude;
  let start: number | null = sunAlt(now) < SUN_HORIZON ? now : null;
  let t = now;
  if (start == null) {
    for (t = now + SCAN_STEP_MS; t <= now + SCAN_RANGE_MS; t += SCAN_STEP_MS) {
      if (sunAlt(t) < SUN_HORIZON) {
        start = t;
        break;
      }
    }
    if (start == null) return null;
  }
  for (t = start + SCAN_STEP_MS; t <= start + SCAN_RANGE_MS; t += SCAN_STEP_MS) {
    if (sunAlt(t) >= SUN_HORIZON) return { start, end: t, sunNeverRises: false };
  }
  return { start, end: start + SCAN_RANGE_MS, sunNeverRises: true };
}

/** Sun/Moon samples every `stepMs` in [start, end). */
export function sampleSky(
  svc: AstronomyService,
  observer: Observer,
  start: number,
  end: number,
  stepMs: number,
): SkySample[] {
  const out: SkySample[] = [];
  for (let t = start; t < end; t += stepMs) {
    const d = new Date(t);
    const sun = svc.getSunPosition(d, observer);
    const moon = svc.getMoonPosition(d, observer);
    out.push({
      time: t,
      sunAltitude: sun.horizontal.altitude,
      phase: darknessPhase(sun.horizontal.altitude),
      moonAltitude: moon.horizontal.altitude,
      moonIllumination: moon.illuminatedFraction ?? 0,
      moonEquatorial: moon.equatorialJ2000,
    });
  }
  return out;
}

/** Rounds an instant down to a step boundary (keeps samples on whole hours / half hours). */
export function floorTo(t: number, stepMs: number): number {
  return Math.floor(t / stepMs) * stepMs;
}
