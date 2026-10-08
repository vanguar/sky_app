/**
 * MeteorObservability — a practical 0–100 estimate of how worthwhile it is to watch a shower now.
 * It is NOT a prediction of how many meteors you will see; the UI never turns it into a rate.
 * Separate from the naked-eye visibility model of point objects.
 *
 *   strength  = 0.25 + 0.75 · activityWeight · zhrFactor        (activity status × shower class)
 *   radiantF  = 0.3 + 0.7 · sin(radiant altitude)                (0 below the horizon)
 *   moonMult  = 1 − 0.6 · moonImpact                             (illumination × altitude, + near radiant)
 *   weatherF  = weather score / 90 (capped at 1); 1 and "weather unknown" without a forecast
 *   score     = 100 · strength · radiantF · moonMult · weatherF, then capped by sky darkness
 *               (day 3, civil 10, nautical 30, astronomical twilight 70) and by a low radiant.
 */
import { darknessPhase, type DarknessPhase } from '../astronomy/twilight';
import {
  gradeFromScore,
  type ConditionsGrade,
  type ConditionsReason,
  type ObservingConditionsResult,
} from '../weather/observing-conditions';
import { activityWeight } from './activity';
import type { ActivityStatus } from './types';

export type MeteorOnlyReason =
  | 'notActive'
  | 'atPeak'
  | 'nearPeak'
  | 'activeWindow'
  | 'strongShower'
  | 'weakShower'
  | 'variableShower'
  | 'radiantBelowHorizon'
  | 'radiantLow'
  | 'radiantHigh'
  | 'moonDown'
  | 'moonFaint'
  | 'moonBright'
  | 'moonNearRadiant'
  | 'weatherUnknown'
  | 'weatherFavourable'
  | 'weatherUnfavourable';

export type MeteorReason = MeteorOnlyReason | ConditionsReason;

export type MoonInterference = 'none' | 'low' | 'moderate' | 'strong';

export interface MeteorConditionsInput {
  status: ActivityStatus;
  /** Expected maximum ZHR; null = variable. */
  zhr: number | null;
  radiantAltitude: number;
  sunAltitude: number;
  moonAltitude: number;
  moonIllumination: number;
  /** Angular distance Moon–radiant, degrees (null if unknown). */
  moonSeparation: number | null;
  /** Weather assessment for this hour; null = no forecast available. */
  weather: ObservingConditionsResult | null;
}

export interface MeteorObservability {
  score: number;
  grade: ConditionsGrade;
  reasons: MeteorReason[];
  weatherUnknown: boolean;
  moon: MoonInterference;
  phase: DarknessPhase;
}

const SUN_CAP: Record<DarknessPhase, number> = {
  day: 3,
  civil: 10,
  nautical: 30,
  astronomical: 70,
  night: 100,
};

const DARKNESS_REASON: Record<DarknessPhase, ConditionsReason> = {
  day: 'daylight',
  civil: 'civilTwilight',
  nautical: 'nauticalTwilight',
  astronomical: 'astronomicalTwilight',
  night: 'darkSky',
};

export function zhrFactor(zhr: number | null): number {
  if (zhr == null) return 0.45;
  return Math.min(1, Math.max(0.25, Math.log10(Math.max(1, zhr)) / 2));
}

/** Moon impact 0…1 from illumination, altitude and distance to the radiant. */
export function moonImpact(moonAltitude: number, illumination: number, separation: number | null): number {
  if (moonAltitude <= 0) return 0;
  const altF = Math.min(1, Math.max(0.3, (moonAltitude + 5) / 25));
  const near = separation != null && separation < 30 ? 0.15 : 0;
  return Math.min(1, illumination * (altF + near));
}

export function meteorObservability(input: MeteorConditionsInput): MeteorObservability {
  const phase = darknessPhase(input.sunAltitude);
  const weatherUnknown = !input.weather;
  const moonRaw = moonImpact(input.moonAltitude, input.moonIllumination, input.moonSeparation);
  const moon: MoonInterference =
    moonRaw < 0.1 ? 'none' : moonRaw < 0.35 ? 'low' : moonRaw < 0.65 ? 'moderate' : 'strong';

  const negative: [MeteorReason, number][] = [];
  const positive: MeteorReason[] = [];

  const weight = activityWeight(input.status);
  if (weight === 0) {
    return {
      score: 0,
      grade: 'bad',
      reasons: ['notActive'],
      weatherUnknown,
      moon,
      phase,
    };
  }
  if (input.status === 'peak') positive.push('atPeak');
  else if (input.status === 'nearPeak') positive.push('nearPeak');
  else positive.push('activeWindow');
  if (input.zhr == null) positive.push('variableShower');
  else if (input.zhr >= 50) positive.push('strongShower');
  else if (input.zhr < 10) negative.push(['weakShower', 20]);

  const strength = 0.25 + 0.75 * weight * zhrFactor(input.zhr);
  const alt = input.radiantAltitude;
  const radiantF = alt <= 0 ? 0 : 0.3 + 0.7 * Math.sin((alt * Math.PI) / 180);
  let cap = SUN_CAP[phase];
  if (phase !== 'night') negative.push([DARKNESS_REASON[phase], 100 - cap]);
  else positive.push('darkSky');

  if (alt <= 0) {
    negative.push(['radiantBelowHorizon', 90]);
    cap = Math.min(cap, 10);
  } else if (alt < 20) {
    negative.push(['radiantLow', 50]);
    if (alt < 10) cap = Math.min(cap, 35);
  } else if (alt >= 45) {
    positive.push('radiantHigh');
  }

  const moonMult = 1 - 0.6 * moonRaw;
  if (input.moonAltitude <= 0) positive.push('moonDown');
  else if (input.moonIllumination < 0.25 || moon === 'none') positive.push('moonFaint');
  else {
    negative.push(['moonBright', moonRaw * 80]);
    if (input.moonSeparation != null && input.moonSeparation < 30) negative.push(['moonNearRadiant', 30]);
  }

  let weatherF = 1;
  if (input.weather) {
    weatherF = Math.min(1, input.weather.score / 90);
    const top = input.weather.reasons[0];
    if (input.weather.score >= 60) positive.push('weatherFavourable');
    else {
      negative.push([top ?? 'weatherUnfavourable', 100 - input.weather.score]);
    }
  } else {
    negative.push(['weatherUnknown', 1]);
  }

  const raw = 100 * strength * radiantF * moonMult * weatherF;
  const score = Math.round(Math.max(0, Math.min(cap, raw)));
  negative.sort((a, b) => b[1] - a[1]);
  const reasons: MeteorReason[] = [];
  for (const [r] of negative) if (!reasons.includes(r)) reasons.push(r);
  for (const r of positive) if (!reasons.includes(r)) reasons.push(r);
  return { score, grade: gradeFromScore(score), reasons, weatherUnknown, moon, phase };
}
