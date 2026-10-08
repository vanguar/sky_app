import type { AstronomyService } from '../astronomy/astronomy.service';
import { normalizeDegrees } from '../astronomy/coordinate-transform';
import type { HorizontalCoords, Observer } from '../astronomy/types';
import type { MeteorShowerDefinition, ShowerOccurrence } from './types';

const DAY = 86_400_000;

/**
 * Radiant position (J2000, degrees) at time `t`: the tabulated position at maximum plus the linear
 * daily drift. Outside the activity window the drift is clamped to the window edges.
 */
export function radiantAt(
  def: MeteorShowerDefinition,
  occ: ShowerOccurrence,
  t: number,
): { raDeg: number; decDeg: number } {
  const clamped = Math.min(occ.end, Math.max(occ.start, t));
  const days = (clamped - occ.peak) / DAY;
  return {
    raDeg: normalizeDegrees(def.radiantRaDeg + def.driftRaDegPerDay * days),
    decDeg: Math.max(-90, Math.min(90, def.radiantDecDeg + def.driftDecDegPerDay * days)),
  };
}

/** Radiant altitude / azimuth through the existing coordinate pipeline (AstronomyService). */
export function radiantHorizontal(
  svc: AstronomyService,
  def: MeteorShowerDefinition,
  occ: ShowerOccurrence,
  t: number,
  observer: Observer,
): HorizontalCoords {
  const r = radiantAt(def, occ, t);
  return svc.getHorizontalFromJ2000(r.raDeg / 15, r.decDeg, new Date(t), observer);
}

/** Great-circle separation of two J2000 positions (degrees). */
export function separationDeg(ra1Deg: number, dec1Deg: number, ra2Deg: number, dec2Deg: number): number {
  const r = Math.PI / 180;
  const c =
    Math.sin(dec1Deg * r) * Math.sin(dec2Deg * r) +
    Math.cos(dec1Deg * r) * Math.cos(dec2Deg * r) * Math.cos((ra1Deg - ra2Deg) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}
