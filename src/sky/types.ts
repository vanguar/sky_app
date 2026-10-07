import type { SolarBodyId, Vec3 } from '../astronomy/types';
import type { Layers } from '../store/sky-store';

export const SKY_RADIUS = 100;

/** Per-body data pushed to the renderer roughly once per second. */
export interface SolarRenderItem {
  id: SolarBodyId;
  /** Unit vector in the J2000 equatorial frame (topocentric). */
  eqj: Vec3;
  magnitude: number | null;
  angularDiameterDeg: number;
  illuminatedFraction: number | null;
  /** Practically visible to the naked eye now (used by the "Visible now" filter). */
  practicalVisible: boolean;
}

export interface TargetScreenInfo {
  id: string;
  /** Inside the viewport (and in front of the camera). */
  onScreen: boolean;
  x: number;
  y: number;
  /** Angular distance between view centre and target, degrees. */
  separation: number;
  /** Direction from screen centre toward the target, radians (0 = right, π/2 = up). */
  screenAngle: number;
  /** Signed azimuth difference target − centre (−180…180), positive = turn right. */
  deltaAz: number;
  /** Altitude difference target − centre, positive = look up. */
  deltaAlt: number;
  targetAltitude: number;
}

export interface FrameInfo {
  centerAltitude: number;
  centerAzimuth: number;
  fov: number;
  target: TargetScreenInfo | null;
}

export interface LabelTexts {
  bodies: Partial<Record<SolarBodyId, string>>;
  /** hip → localised proper name */
  stars: Map<number, string>;
  /** IAU abbr → localised name */
  constellations: Map<string, string>;
  /** "M31" → label */
  messier: Map<string, string>;
  cardinals: Record<'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW', string>;
  rtl: boolean;
}

export interface RendererOptions {
  layers: Layers;
  showLabels: boolean;
}
