import type { AstronomyService } from '../astronomy/astronomy.service';
import { practicalVisibility, type ObjectClass, type PracticalVisibility } from '../astronomy/naked-eye';
import type { Observer } from '../astronomy/types';
import type { DeepSkyCategory, Catalog, SkyObjectRef } from './types';
import { targetOf } from './object-registry';

export function deepSkyClass(category: DeepSkyCategory): ObjectClass {
  return category === 'galaxy' || category === 'nebula' || category === 'planetaryNebula'
    ? 'diffuse'
    : 'cluster';
}

/** Brightest catalog star of a constellation (stars are sorted by magnitude). */
function brightestStarMag(abbr: string, catalog: Catalog | null): number | null {
  const s = catalog?.stars.stars.find((x) => x.constellation === abbr);
  return s ? s.mag : null;
}

/** Magnitude and object class used for the naked-eye estimate. */
export function brightnessOf(
  ref: SkyObjectRef,
  catalog: Catalog | null,
  bodyMagnitude: number | null,
): { magnitude: number | null; objectClass: ObjectClass } {
  switch (ref.kind) {
    case 'sun':
      return { magnitude: bodyMagnitude ?? -26.7, objectClass: 'sun' };
    case 'moon':
      return { magnitude: bodyMagnitude, objectClass: 'moon' };
    case 'planet':
      return { magnitude: bodyMagnitude, objectClass: 'point' };
    case 'star':
      return { magnitude: ref.star.mag, objectClass: 'point' };
    case 'messier':
      return { magnitude: ref.messier.mag, objectClass: deepSkyClass(ref.messier.category) };
    case 'constellation':
      // A constellation is "visible" when its brightest star is.
      return { magnitude: brightestStarMag(ref.constellation.abbr, catalog), objectClass: 'point' };
  }
}

/** Practical naked-eye visibility of any object now (refracted altitude, current Sun altitude). */
export function practicalVisibilityOf(
  ref: SkyObjectRef,
  catalog: Catalog | null,
  svc: AstronomyService,
  date: Date,
  observer: Observer,
): PracticalVisibility & { altitude: number } {
  const sunAltitude = svc.getSunPosition(date, observer).horizontal.altitude;
  let altitude: number;
  let bodyMag: number | null = null;
  if (ref.kind === 'sun' || ref.kind === 'moon' || ref.kind === 'planet') {
    const p = svc.getBodyPosition(ref.body, date, observer);
    altitude = p.horizontal.altitude;
    bodyMag = p.magnitude;
  } else {
    altitude = svc.getHorizontalCoordinates(targetOf(ref), date, observer).altitude;
  }
  const { magnitude, objectClass } = brightnessOf(ref, catalog, bodyMag);
  return { ...practicalVisibility({ altitude, magnitude, sunAltitude, objectClass }), altitude };
}
