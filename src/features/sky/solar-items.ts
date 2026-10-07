import { astronomyService } from '../../astronomy/astronomy.service';
import { practicalVisibility } from '../../astronomy/naked-eye';
import { raDecToVector } from '../../astronomy/coordinate-transform';
import { SOLAR_BODY_IDS, type Observer, type SolarBodyPosition, type Vec3 } from '../../astronomy/types';
import { targetOf } from '../../catalog/object-registry';
import type { SkyObjectRef } from '../../catalog/types';
import type { SolarRenderItem } from '../../sky/types';

export interface SolarSnapshot {
  positions: SolarBodyPosition[];
  items: SolarRenderItem[];
}

/** Computes all Sun/Moon/planet positions for the renderer (≈1 Hz). */
export function computeSolarSnapshot(date: Date, observer: Observer): SolarSnapshot {
  const positions = SOLAR_BODY_IDS.map((id) => astronomyService.getBodyPosition(id, date, observer));
  const sunAltitude = positions.find((p) => p.id === 'sun')?.horizontal.altitude ?? -90;
  const items = positions.map((p) => ({
    id: p.id,
    eqj: raDecToVector(p.equatorialJ2000.ra * 15, p.equatorialJ2000.dec),
    magnitude: p.magnitude,
    angularDiameterDeg: p.angularDiameterArcsec / 3600,
    illuminatedFraction: p.illuminatedFraction,
    practicalVisible:
      practicalVisibility({
        altitude: p.horizontal.altitude,
        magnitude: p.magnitude,
        sunAltitude,
        objectClass: p.id === 'sun' ? 'sun' : p.id === 'moon' ? 'moon' : 'point',
      }).status === 'visible',
  }));
  return { positions, items };
}

/** J2000 unit vector of any object (solar-system bodies taken from the latest snapshot). */
export function eqjVectorOf(ref: SkyObjectRef, snapshot: SolarSnapshot | null): Vec3 | null {
  const target = targetOf(ref);
  if (target.kind === 'body') {
    return snapshot?.items.find((i) => i.id === target.body)?.eqj ?? null;
  }
  return raDecToVector(target.raHours * 15, target.decDeg);
}
