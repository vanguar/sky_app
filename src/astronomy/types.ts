/** Geographic observer location. Latitude/longitude in degrees, east longitude positive. */
export interface Observer {
  latitude: number;
  longitude: number;
  /** Metres above mean sea level. */
  elevation: number;
}

/** Equatorial coordinates. RA in hours [0, 24), Dec in degrees [-90, 90]. */
export interface EquatorialCoords {
  ra: number;
  dec: number;
}

/** Horizontal coordinates in degrees. Azimuth is measured from north through east [0, 360). */
export interface HorizontalCoords {
  altitude: number;
  azimuth: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export type PlanetId = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type SolarBodyId = 'sun' | 'moon' | PlanetId;

export const PLANET_IDS: readonly PlanetId[] = [
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

export const SOLAR_BODY_IDS: readonly SolarBodyId[] = ['sun', 'moon', ...PLANET_IDS] as const;

/** Anything the astronomy layer can compute a position for. */
export type SkyTarget =
  | { kind: 'body'; body: SolarBodyId }
  /** Fixed object with J2000 (ICRS) coordinates: stars, deep-sky objects, constellation centres. */
  | { kind: 'fixed'; raHours: number; decDeg: number };

export interface SolarBodyPosition {
  id: SolarBodyId;
  /** Topocentric J2000 equatorial coordinates (used for rendering together with catalog stars). */
  equatorialJ2000: EquatorialCoords;
  /** Topocentric equatorial coordinates of date. */
  equatorialOfDate: EquatorialCoords;
  /** Horizontal coordinates including standard atmospheric refraction. */
  horizontal: HorizontalCoords;
  /** Distance from the observer in astronomical units. */
  distanceAu: number;
  distanceKm: number;
  /** Apparent visual magnitude, if available. */
  magnitude: number | null;
  /** Illuminated fraction of the disc 0…1 (Moon & planets). */
  illuminatedFraction: number | null;
  /** Angular diameter in arcseconds. */
  angularDiameterArcsec: number;
}

export interface RiseSetInfo {
  rise: Date | null;
  set: Date | null;
  transit: Date | null;
  /** Object never sets at this latitude (circumpolar). */
  alwaysUp: boolean;
  /** Object never rises at this latitude. */
  neverUp: boolean;
}

export type VisibilityStatus = 'up' | 'down';

export interface Visibility {
  status: VisibilityStatus;
  aboveHorizon: boolean;
  altitude: number;
  azimuth: number;
  alwaysUp: boolean;
  neverUp: boolean;
}
