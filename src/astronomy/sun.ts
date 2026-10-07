import { astronomyService } from './astronomy.service';
import type { Observer, SolarBodyPosition } from './types';

export function getSunPosition(date: Date, observer: Observer): SolarBodyPosition {
  return astronomyService.getSunPosition(date, observer);
}

/** Refracted altitude of the Sun in degrees. */
export function getSunAltitude(date: Date, observer: Observer): number {
  return getSunPosition(date, observer).horizontal.altitude;
}
