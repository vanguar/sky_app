import { DEG } from './coordinate-transform';
import type { Visibility } from './types';

/** Standard altitude of a point source at rise/set, accounting for refraction (degrees). */
export const STANDARD_HORIZON_ALTITUDE = -0.5667;

/**
 * Whether a fixed object with declination `decDeg` is circumpolar or never rises at `latitudeDeg`.
 * Uses the standard refracted horizon.
 */
export function riseSetLimits(decDeg: number, latitudeDeg: number, h0 = STANDARD_HORIZON_ALTITUDE) {
  const lat = latitudeDeg * DEG;
  const dec = decDeg * DEG;
  const denom = Math.cos(lat) * Math.cos(dec);
  if (Math.abs(denom) < 1e-12) {
    // Observer at a pole or object at a celestial pole: altitude is constant.
    const constantAlt = Math.asin(Math.sin(lat) * Math.sin(dec)) / DEG;
    return { alwaysUp: constantAlt > h0, neverUp: constantAlt <= h0 };
  }
  const cosH = (Math.sin(h0 * DEG) - Math.sin(lat) * Math.sin(dec)) / denom;
  return { alwaysUp: cosH < -1, neverUp: cosH > 1 };
}

/** Altitude above which an object counts as "above the horizon". */
export const VISIBLE_ALTITUDE = 0;

export function buildVisibility(
  altitude: number,
  azimuth: number,
  limits: { alwaysUp: boolean; neverUp: boolean } = { alwaysUp: false, neverUp: false },
): Visibility {
  const aboveHorizon = altitude > VISIBLE_ALTITUDE;
  return {
    status: aboveHorizon ? 'up' : 'down',
    aboveHorizon,
    altitude,
    azimuth,
    alwaysUp: limits.alwaysUp,
    neverUp: limits.neverUp,
  };
}

/** Sky brightness regime derived from the Sun's altitude. */
export type SkyLight = 'day' | 'civilTwilight' | 'nauticalTwilight' | 'astronomicalTwilight' | 'night';

export function skyLightFromSunAltitude(sunAltitude: number): SkyLight {
  if (sunAltitude > -0.833) return 'day';
  if (sunAltitude > -6) return 'civilTwilight';
  if (sunAltitude > -12) return 'nauticalTwilight';
  if (sunAltitude > -18) return 'astronomicalTwilight';
  return 'night';
}

/** 0 at night … 1 in full daylight — used to fade stars and tint the sky. */
export function daylightFactor(sunAltitude: number): number {
  if (sunAltitude <= -12) return 0;
  if (sunAltitude >= 6) return 1;
  return (sunAltitude + 12) / 18;
}
