/**
 * Observing conditions — a PRACTICAL ESTIMATE of how much the weather will get in the way of
 * looking at the sky. Pure functions, no React, no network.
 *
 * This is NOT astronomical "seeing" (turbulence / image steadiness at high magnification): the
 * forecast contains no physically meaningful seeing data, so none is claimed. A real seeing
 * provider could later feed an additional factor into {@link ObservingConditionsResult}.
 *
 * Model (documented in docs/ARCHITECTURE.md):
 *  1. Cloud cover is the dominant factor. Total cover is mapped to a base score through a
 *     piecewise-linear curve chosen so that the usual amateur rules of thumb hold:
 *     ≤ 10 % ≈ "excellent", ~25 % still "good", ~50 % "fair" (gaps), ≥ 70 % "poor", ≥ 90 % "bad".
 *  2. Precipitation (actual amount, then probability, then the WMO weather code) caps the score:
 *     you cannot observe in rain whatever the cloud model says.
 *  3. Visibility < 10 km indicates haze / mist near the ground → penalty; fog codes cap the score.
 *  4. High humidity (≥ 85 %) → small penalty: haze and dew on optics become likely. It is never
 *     reported as fog or rain by itself.
 *  5. Strong wind / gusts → small penalty (telescope shake, discomfort).
 * Missing variables are skipped, never guessed.
 */
import type { DarknessPhase } from '../astronomy/twilight';
import { darknessPhase } from '../astronomy/twilight';
import type { WeatherHour } from './types';

export type ConditionsGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export const GRADE_ORDER: readonly ConditionsGrade[] = ['bad', 'poor', 'fair', 'good', 'excellent'];

/** Reason codes; the UI translates them (`observing.reasons.<code>`). */
export type ConditionsReason =
  | 'clearSky'
  | 'fewClouds'
  | 'partlyCloudy'
  | 'mostlyCloudy'
  | 'overcast'
  | 'highCloudsOnly'
  | 'noPrecipitation'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'precipitationLikely'
  | 'precipitationPossible'
  | 'fogForecast'
  | 'goodTransparency'
  | 'reducedVisibility'
  | 'poorVisibility'
  | 'highHumidity'
  | 'veryHighHumidity'
  | 'dewRisk'
  | 'windy'
  | 'strongGusts'
  | 'noCloudData'
  | 'daylight'
  | 'civilTwilight'
  | 'nauticalTwilight'
  | 'astronomicalTwilight'
  | 'darkSky';

export interface ObservingConditionsResult {
  /** 0–100, practical estimate. */
  score: number;
  grade: ConditionsGrade;
  /** Most important first. */
  reasons: ConditionsReason[];
}

export function gradeFromScore(score: number): ConditionsGrade {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'bad';
}

/** 1–5 stars for a grade. */
export function starsForGrade(grade: ConditionsGrade): number {
  return GRADE_ORDER.indexOf(grade) + 1;
}

/** Cloud cover (%) → base score. Piecewise linear through documented anchor points. */
const CLOUD_CURVE: [number, number][] = [
  [0, 100],
  [10, 92],
  [25, 76],
  [45, 55],
  [65, 34],
  [85, 14],
  [100, 4],
];

export function cloudScore(cloudPct: number): number {
  const c = Math.min(100, Math.max(0, cloudPct));
  for (let i = 1; i < CLOUD_CURVE.length; i++) {
    const [x1, y1] = CLOUD_CURVE[i];
    if (c <= x1) {
      const [x0, y0] = CLOUD_CURVE[i - 1];
      return y0 + ((y1 - y0) * (c - x0)) / (x1 - x0);
    }
  }
  return CLOUD_CURVE[CLOUD_CURVE.length - 1][1];
}

/** WMO code groups (Open-Meteo documentation, table "WMO Weather interpretation codes"). */
export function weatherCodeKind(code: number | null): 'fog' | 'rain' | 'snow' | 'thunderstorm' | null {
  if (code == null) return null;
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return null;
}

/** Effective cloud cover: the total if available, otherwise the largest layer. */
export function effectiveCloudCover(h: WeatherHour): number | null {
  if (h.cloudCover != null) return h.cloudCover;
  const layers = [h.cloudCoverLow, h.cloudCoverMid, h.cloudCoverHigh].filter((v): v is number => v != null);
  return layers.length ? Math.max(...layers) : null;
}

/** Weather-only assessment of one forecast hour (ignores the Sun). */
export function assessWeather(h: WeatherHour): ObservingConditionsResult {
  const reasons: ConditionsReason[] = [];
  let cap = 100;
  let penalty = 0;

  const cloud = effectiveCloudCover(h);
  let score: number;
  if (cloud == null) {
    // Without cloud data the sky cannot be judged; stay in the middle and say so.
    score = 50;
    reasons.push('noCloudData');
  } else {
    score = cloudScore(cloud);
    if (cloud <= 10) reasons.push('clearSky');
    else if (cloud <= 30) reasons.push('fewClouds');
    else if (cloud <= 60) reasons.push('partlyCloudy');
    else if (cloud <= 85) reasons.push('mostlyCloudy');
    else reasons.push('overcast');
    const low = h.cloudCoverLow ?? 0;
    const mid = h.cloudCoverMid ?? 0;
    if (
      cloud > 30 &&
      h.cloudCoverHigh != null &&
      h.cloudCoverHigh >= cloud - 5 &&
      low < 15 &&
      mid < 15
    ) {
      // Mostly thin high cloud: bright objects usually shine through, faint ones do not.
      reasons.push('highCloudsOnly');
      score = Math.min(100, score + 8);
    }
  }

  // Precipitation: amount > probability > weather code.
  const kind = weatherCodeKind(h.weatherCode);
  const mm = h.precipitationMm;
  const prob = h.precipitationProbability;
  if (kind === 'thunderstorm') {
    reasons.unshift('thunderstorm');
    cap = Math.min(cap, 5);
  } else if ((mm != null && mm >= 0.1) || kind === 'rain' || kind === 'snow') {
    reasons.unshift(kind === 'snow' ? 'snow' : 'rain');
    cap = Math.min(cap, mm != null && mm >= 1 ? 5 : 12);
  } else if (prob != null && prob >= 60) {
    reasons.push('precipitationLikely');
    cap = Math.min(cap, 30);
  } else if (prob != null && prob >= 30) {
    reasons.push('precipitationPossible');
    penalty += 10;
  } else if (mm != null || prob != null) {
    reasons.push('noPrecipitation');
  }

  if (kind === 'fog') {
    reasons.push('fogForecast');
    cap = Math.min(cap, 15);
  }

  const vis = h.visibilityM;
  if (vis != null) {
    if (vis < 1000) {
      reasons.push('poorVisibility');
      cap = Math.min(cap, 15);
    } else if (vis < 4000) {
      reasons.push('poorVisibility');
      penalty += 25;
    } else if (vis < 10000) {
      reasons.push('reducedVisibility');
      penalty += 10;
    } else if (vis >= 20000 && cloud != null && cloud <= 30) {
      reasons.push('goodTransparency');
    }
  }

  const rh = h.humidity;
  if (rh != null) {
    if (rh >= 95) {
      reasons.push('veryHighHumidity');
      penalty += 12;
    } else if (rh >= 85) {
      reasons.push('highHumidity');
      penalty += 6;
    }
  }
  if (
    h.temperatureC != null &&
    h.dewPointC != null &&
    h.temperatureC - h.dewPointC <= 2 &&
    !reasons.includes('rain') &&
    !reasons.includes('snow')
  ) {
    reasons.push('dewRisk');
  }

  const gust = h.windGustsKmh;
  const wind = h.windSpeedKmh;
  if ((gust != null && gust >= 50) || (wind != null && wind >= 40)) {
    reasons.push('strongGusts');
    penalty += 15;
  } else if ((gust != null && gust >= 35) || (wind != null && wind >= 25)) {
    reasons.push('windy');
    penalty += 6;
  }

  const final = Math.round(Math.max(0, Math.min(cap, score - penalty)));
  return { score: final, grade: gradeFromScore(final), reasons };
}

/**
 * Upper bound of the observing score set by sky brightness. `general` targets the whole sky incl.
 * faint objects (prefers astronomical darkness); `bright` targets the Moon and bright planets,
 * which are fine in twilight.
 */
export const DARKNESS_CAP: Record<'general' | 'bright', Record<DarknessPhase, number>> = {
  general: { day: 5, civil: 25, nautical: 55, astronomical: 80, night: 100 },
  bright: { day: 10, civil: 60, nautical: 90, astronomical: 100, night: 100 },
};

const DARKNESS_REASON: Record<DarknessPhase, ConditionsReason> = {
  day: 'daylight',
  civil: 'civilTwilight',
  nautical: 'nauticalTwilight',
  astronomical: 'astronomicalTwilight',
  night: 'darkSky',
};

/**
 * Observing assessment = weather assessment limited by the darkness of the sky. Weather can be
 * perfect at 14:00 — this function makes sure that is never called an excellent observing hour.
 */
export function assessObserving(
  weather: ObservingConditionsResult | null,
  sunAltitudeDeg: number,
  target: 'general' | 'bright' = 'general',
): ObservingConditionsResult & { phase: DarknessPhase; weatherKnown: boolean } {
  const phase = darknessPhase(sunAltitudeDeg);
  const cap = DARKNESS_CAP[target][phase];
  const base = weather?.score ?? 100;
  const score = Math.round(Math.min(base, cap));
  const reasons: ConditionsReason[] = [];
  if (phase !== 'night' || !weather) reasons.push(DARKNESS_REASON[phase]);
  if (weather) reasons.push(...weather.reasons);
  // Put the darkness reason first when it is the limiting factor.
  if (cap < base && reasons[0] !== DARKNESS_REASON[phase]) {
    reasons.splice(reasons.indexOf(DARKNESS_REASON[phase]), 1);
    reasons.unshift(DARKNESS_REASON[phase]);
  }
  return { score, grade: gradeFromScore(score), reasons, phase, weatherKnown: !!weather };
}

export interface ScoredSlot {
  /** Start of the slot, epoch ms. */
  time: number;
  score: number;
}

export interface BestWindow {
  start: number;
  /** End of the last slot (start + step). */
  end: number;
  score: number;
  /** Average score over the window. */
  meanScore: number;
}

/**
 * Best continuous window: maximal runs of consecutive slots with score ≥ `threshold`; the run with
 * the largest total score above the threshold wins (long good windows beat a single great hour).
 * Never returns a window finer than the input step.
 */
export function findBestWindow(
  slots: ScoredSlot[],
  stepMs: number,
  threshold: number,
): BestWindow | null {
  let best: BestWindow | null = null;
  let bestWeight = -Infinity;
  let i = 0;
  while (i < slots.length) {
    if (slots[i].score < threshold) {
      i++;
      continue;
    }
    let j = i;
    let sum = 0;
    let max = 0;
    let weight = 0;
    while (
      j < slots.length &&
      slots[j].score >= threshold &&
      (j === i || slots[j].time - slots[j - 1].time <= stepMs * 1.01)
    ) {
      sum += slots[j].score;
      max = Math.max(max, slots[j].score);
      weight += slots[j].score - threshold + 1;
      j++;
    }
    if (weight > bestWeight) {
      bestWeight = weight;
      best = {
        start: slots[i].time,
        end: slots[j - 1].time + stepMs,
        score: max,
        meanScore: Math.round(sum / (j - i)),
      };
    }
    i = j;
  }
  return best;
}

/** Forecast hour covering an instant (hour start ≤ t < hour start + 1 h), or null. */
export function hourAt(hours: WeatherHour[], t: number): WeatherHour | null {
  for (const h of hours) if (t >= h.time && t < h.time + 3600_000) return h;
  return null;
}
