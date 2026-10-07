import type * as THREE from 'three';
import { practicalVisibility, skyLimitingMagnitude } from '../astronomy/naked-eye';
import { deepSkyClass } from '../catalog/practical';
import type { MessierRecord } from '../catalog/types';

/** State of the "Visible now" filter shared by layers, labels and picking. */
export interface PracticalFilterState {
  enabled: boolean;
  sunAltitude: number;
  skyLimit: number;
  /** 1 = Messier object hidden. */
  messierHidden: Uint8Array | null;
  /** Constellation figures are pointless when only a handful of stars show through a bright sky. */
  constellationsHidden: boolean;
}

export const FILTER_OFF: PracticalFilterState = {
  enabled: false,
  sunAltitude: -90,
  skyLimit: skyLimitingMagnitude(-90),
  messierHidden: null,
  constellationsHidden: false,
};

/** Geometric altitude (deg) of an EQJ unit vector after the celestial (EQJ → world) rotation. */
export function worldAltitudeDeg(celestial: THREE.Matrix4, x: number, y: number, z: number): number {
  const e = celestial.elements; // column-major
  const wy = e[1] * x + e[5] * y + e[9] * z;
  return (Math.asin(Math.max(-1, Math.min(1, wy))) * 180) / Math.PI;
}

export function pointPassesFilter(f: PracticalFilterState, magnitude: number, altitude: number): boolean {
  if (!f.enabled) return true;
  return practicalVisibility({ altitude, magnitude, sunAltitude: f.sunAltitude }).status === 'visible';
}

export function computeMessierHidden(
  messier: readonly MessierRecord[],
  eqj: Float32Array,
  celestial: THREE.Matrix4,
  sunAltitude: number,
): Uint8Array {
  const mask = new Uint8Array(messier.length);
  messier.forEach((m, i) => {
    const alt = worldAltitudeDeg(celestial, eqj[i * 3], eqj[i * 3 + 1], eqj[i * 3 + 2]);
    const v = practicalVisibility({
      altitude: alt,
      magnitude: m.mag,
      sunAltitude,
      objectClass: deepSkyClass(m.category),
    });
    mask[i] = v.status === 'visible' ? 0 : 1;
  });
  return mask;
}
