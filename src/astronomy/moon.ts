import { astronomyService } from './astronomy.service';
import { normalizeDegrees } from './coordinate-transform';
import type { Observer, SolarBodyPosition } from './types';

export type MoonPhaseName =
  | 'new'
  | 'waxingCrescent'
  | 'firstQuarter'
  | 'waxingGibbous'
  | 'full'
  | 'waningGibbous'
  | 'lastQuarter'
  | 'waningCrescent';

export function getMoonPosition(date: Date, observer: Observer): SolarBodyPosition {
  return astronomyService.getMoonPosition(date, observer);
}

/** Phase name from Astronomy Engine's phase angle (0 new, 90 first quarter, 180 full, 270 last quarter). */
export function moonPhaseName(phaseAngleDeg: number): MoonPhaseName {
  const a = normalizeDegrees(phaseAngleDeg);
  if (a < 11.25 || a >= 348.75) return 'new';
  if (a < 78.75) return 'waxingCrescent';
  if (a < 101.25) return 'firstQuarter';
  if (a < 168.75) return 'waxingGibbous';
  if (a < 191.25) return 'full';
  if (a < 258.75) return 'waningGibbous';
  if (a < 281.25) return 'lastQuarter';
  return 'waningCrescent';
}
