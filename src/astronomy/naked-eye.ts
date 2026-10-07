/**
 * Practical naked-eye visibility — a deliberately simple, documented ESTIMATE.
 *
 * Geometric visibility (altitude > 0) is not enough. Here we combine:
 *  - apparent magnitude of the object (with a penalty for diffuse deep-sky objects);
 *  - atmospheric extinction growing with airmass near the horizon (Kasten & Young 1989);
 *  - sky brightness from the Sun's altitude (day / twilight / night) → naked-eye limiting magnitude;
 *  - a horizon rule: objects within a few degrees of the horizon are usually blocked by terrain,
 *    buildings or haze.
 *
 * No weather and no light-pollution data are available, so the night-time limit assumes a GENERIC
 * clear sky with moderate (suburban) light pollution. The UI states this assumption.
 */
export type PracticalStatus = 'visible' | 'difficult' | 'notPractical' | 'belowHorizon';

export type PracticalReason =
  'belowHorizon' | 'lowAltitude' | 'daylight' | 'twilight' | 'tooFaint' | 'faint' | 'clear' | 'sun';

export type ObjectClass = 'point' | 'diffuse' | 'cluster' | 'sun' | 'moon';

/** Visual extinction coefficient (mag per airmass) for a typical clear, slightly hazy site. */
export const EXTINCTION_K = 0.25;
/** Naked-eye limiting magnitude at the zenith on a dark night under GENERIC suburban skies. */
export const GENERIC_NIGHT_LIMIT = 5.5;
/** Below this altitude (deg) an object is at best "difficult" (horizon obstruction, haze). */
export const LOW_ALTITUDE_DEG = 5;
/** Below this altitude (deg) it is not practically observable at all. */
export const MIN_PRACTICAL_ALTITUDE_DEG = 1;
/** Margin (mag) between limit and effective brightness for an "easy" object. */
export const VISIBLE_MARGIN = 1;
/** Down to this margin the object is "difficult" (good conditions, knowing where to look). */
export const DIFFICULT_MARGIN = -1;

const DIFFUSE_PENALTY: Record<ObjectClass, number> = {
  point: 0,
  sun: 0,
  moon: 0,
  cluster: 0.5,
  diffuse: 1.0,
};

/** Relative airmass for an apparent altitude (deg); Kasten & Young (1989). */
export function airmass(altitudeDeg: number): number {
  const h = Math.max(altitudeDeg, 0);
  return 1 / (Math.sin((h * Math.PI) / 180) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
}

/** Naked-eye limiting magnitude (zenith) as a function of the Sun's altitude. */
export function skyLimitingMagnitude(sunAltitudeDeg: number, nightLimit = GENERIC_NIGHT_LIMIT): number {
  const s = sunAltitudeDeg;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  if (s <= -18) return nightLimit;
  if (s <= -12) return lerp(nightLimit - 1, nightLimit, (-12 - s) / 6); // astronomical twilight
  if (s <= -6) return lerp(2, nightLimit - 1, (-6 - s) / 6); // nautical twilight
  if (s <= -0.833) return lerp(-1.5, 2, (-0.833 - s) / 5.167); // civil twilight
  return -4; // daytime: only the Moon and (barely) Venus
}

export type SkyCondition = 'day' | 'twilight' | 'night';

export function skyCondition(sunAltitudeDeg: number): SkyCondition {
  if (sunAltitudeDeg > -0.833) return 'day';
  if (sunAltitudeDeg > -12) return 'twilight';
  return 'night';
}

export interface PracticalVisibility {
  status: PracticalStatus;
  reason: PracticalReason;
  /** Brightness after extinction and the diffuse-object penalty. */
  effectiveMagnitude: number | null;
  limitingMagnitude: number;
  /** limit − effective magnitude (positive = brighter than the limit). */
  margin: number | null;
}

export interface PracticalInput {
  /** Apparent (refracted) altitude in degrees. */
  altitude: number;
  /** Apparent visual magnitude; null when unknown. */
  magnitude: number | null;
  sunAltitude: number;
  objectClass?: ObjectClass;
  nightLimit?: number;
}

export function practicalVisibility(input: PracticalInput): PracticalVisibility {
  const { altitude, magnitude, sunAltitude } = input;
  const cls = input.objectClass ?? 'point';
  const limit = skyLimitingMagnitude(sunAltitude, input.nightLimit);
  const base = { limitingMagnitude: limit };

  if (altitude <= 0)
    return {
      ...base,
      status: 'belowHorizon',
      reason: 'belowHorizon',
      effectiveMagnitude: null,
      margin: null,
    };
  if (cls === 'sun')
    return { ...base, status: 'visible', reason: 'sun', effectiveMagnitude: magnitude, margin: null };
  if (altitude < MIN_PRACTICAL_ALTITUDE_DEG)
    return { ...base, status: 'notPractical', reason: 'lowAltitude', effectiveMagnitude: null, margin: null };
  if (magnitude == null) {
    // Unknown brightness: never claim "visible"; only the geometry and sky are known.
    return {
      ...base,
      status: 'difficult',
      reason: altitude < LOW_ALTITUDE_DEG ? 'lowAltitude' : 'faint',
      effectiveMagnitude: null,
      margin: null,
    };
  }

  const effective = magnitude + EXTINCTION_K * airmass(altitude) + DIFFUSE_PENALTY[cls];
  const margin = limit - effective;
  const sky = skyCondition(sunAltitude);
  const skyReason: PracticalReason =
    sky === 'day' ? 'daylight' : sky === 'twilight' ? 'twilight' : 'tooFaint';

  let status: PracticalStatus;
  let reason: PracticalReason;
  if (margin >= VISIBLE_MARGIN) {
    status = 'visible';
    reason = 'clear';
  } else if (margin >= DIFFICULT_MARGIN) {
    status = 'difficult';
    reason = sky === 'night' ? 'faint' : skyReason;
  } else {
    status = 'notPractical';
    reason = skyReason;
  }
  // Horizon rule: terrain, buildings and haze make very low objects unreliable.
  if (altitude < LOW_ALTITUDE_DEG && status === 'visible') {
    status = 'difficult';
    reason = 'lowAltitude';
  } else if (altitude < LOW_ALTITUDE_DEG && status !== 'visible' && reason === 'tooFaint') {
    reason = 'lowAltitude';
  }
  return { ...base, status, reason, effectiveMagnitude: effective, margin };
}
