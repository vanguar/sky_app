/**
 * Pure coordinate math, independent of Astronomy Engine and Three.js.
 *
 * World (render) frame used throughout AstroPoint — the observer sits at the origin
 * inside the celestial sphere:
 *   +X = east, +Y = zenith (up), −Z = north   (so +Z = south)
 * This matches Three.js conventions (camera looks along −Z, i.e. north, by default).
 */
import type { EquatorialCoords, HorizontalCoords, Mat3, Vec3 } from './types';

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export function normalizeDegrees(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
}

export function normalizeHours(h: number): number {
  const r = h % 24;
  return r < 0 ? r + 24 : r;
}

/** Signed smallest difference b − a in degrees, in (−180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = normalizeDegrees(b - a);
  if (d > 180) d -= 360;
  return d;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Julian Date (UT) for a JS Date. */
export function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Greenwich mean sidereal time in degrees (IAU 1982 expression).
 * Accurate to well below 0.1 s of time for current epochs — enough for display and tests.
 */
export function greenwichMeanSiderealTime(date: Date): number {
  const jd = julianDate(date);
  const t = (jd - 2451545.0) / 36525;
  const gmst =
    280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000;
  return normalizeDegrees(gmst);
}

/** Local mean sidereal time in degrees for an east-positive longitude. */
export function localSiderealTime(date: Date, longitudeDeg: number): number {
  return normalizeDegrees(greenwichMeanSiderealTime(date) + longitudeDeg);
}

/**
 * Equatorial (RA hours, Dec deg) → horizontal (alt, az deg) for a given local sidereal time.
 * Geometric (no refraction). Azimuth from north through east.
 */
export function equatorialToHorizontal(
  raHours: number,
  decDeg: number,
  latitudeDeg: number,
  lstDeg: number,
): HorizontalCoords {
  const ha = (lstDeg - raHours * 15) * DEG;
  const dec = decDeg * DEG;
  const lat = latitudeDeg * DEG;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const altitude = Math.asin(clamp(sinAlt, -1, 1));
  // Azimuth measured from north, eastward.
  const y = -Math.cos(dec) * Math.sin(ha);
  const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha);
  const azimuth = Math.atan2(y, x);
  return { altitude: altitude * RAD, azimuth: normalizeDegrees(azimuth * RAD) };
}

/** Inverse of {@link equatorialToHorizontal}. */
export function horizontalToEquatorial(
  altitudeDeg: number,
  azimuthDeg: number,
  latitudeDeg: number,
  lstDeg: number,
): EquatorialCoords {
  const alt = altitudeDeg * DEG;
  const az = azimuthDeg * DEG;
  const lat = latitudeDeg * DEG;
  const sinDec = Math.sin(alt) * Math.sin(lat) + Math.cos(alt) * Math.cos(lat) * Math.cos(az);
  const dec = Math.asin(clamp(sinDec, -1, 1));
  const y = -Math.sin(az) * Math.cos(alt);
  const x = Math.sin(alt) * Math.cos(lat) - Math.cos(alt) * Math.sin(lat) * Math.cos(az);
  const ha = Math.atan2(y, x) * RAD;
  return { ra: normalizeHours((lstDeg - ha) / 15), dec: dec * RAD };
}

/** Horizontal coordinates → unit vector in the world frame. */
export function horizontalToVector(
  altitudeDeg: number,
  azimuthDeg: number,
  out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const alt = altitudeDeg * DEG;
  const az = azimuthDeg * DEG;
  const c = Math.cos(alt);
  out.x = c * Math.sin(az);
  out.y = Math.sin(alt);
  out.z = -c * Math.cos(az);
  return out;
}

/** World-frame direction → horizontal coordinates (vector need not be normalized). */
export function vectorToHorizontal(v: Vec3): HorizontalCoords {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  const altitude = Math.asin(clamp(v.y / len, -1, 1)) * RAD;
  const azimuth = normalizeDegrees(Math.atan2(v.x, -v.z) * RAD);
  return { altitude, azimuth };
}

/** J2000 equatorial (RA/Dec in degrees) → unit vector in the J2000 equatorial (EQJ) frame. */
export function raDecToVector(raDeg: number, decDeg: number, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const c = Math.cos(dec);
  out.x = c * Math.cos(ra);
  out.y = c * Math.sin(ra);
  out.z = Math.sin(dec);
  return out;
}

/** EQJ vector → RA (hours) / Dec (degrees). */
export function vectorToRaDec(v: Vec3): EquatorialCoords {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  const dec = Math.asin(clamp(v.z / len, -1, 1)) * RAD;
  const ra = normalizeHours((Math.atan2(v.y, v.x) * RAD) / 15);
  return { ra, dec };
}

export function applyMat3(m: Mat3, v: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const x = v.x;
  const y = v.y;
  const z = v.z;
  out.x = m[0] * x + m[1] * y + m[2] * z;
  out.y = m[3] * x + m[4] * y + m[5] * z;
  out.z = m[6] * x + m[7] * y + m[8] * z;
  return out;
}

/** Transpose (= inverse for rotation matrices). */
export function transposeMat3(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/**
 * Converts a vector expressed in Astronomy Engine's HOR frame
 * (x = north, y = west, z = zenith) into the AstroPoint world frame.
 */
export function horFrameToWorld(v: Vec3, out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const north = v.x;
  const west = v.y;
  const up = v.z;
  out.x = -west;
  out.y = up;
  out.z = -north;
  return out;
}

/** Angular separation between two directions in degrees. */
export function angularSeparation(a: Vec3, b: Vec3): number {
  const la = Math.hypot(a.x, a.y, a.z) || 1;
  const lb = Math.hypot(b.x, b.y, b.z) || 1;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  // Use atan2 of cross/dot for numerical stability at small angles.
  const cx = a.y * b.z - a.z * b.y;
  const cy = a.z * b.x - a.x * b.z;
  const cz = a.x * b.y - a.y * b.x;
  const cross = Math.hypot(cx, cy, cz) / (la * lb);
  return Math.atan2(cross, dot) * RAD;
}

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export type CompassPoint = (typeof COMPASS_POINTS)[number];

/** 8-wind compass point for an azimuth. */
export function azimuthToCompassPoint(azimuthDeg: number): CompassPoint {
  const idx = Math.round(normalizeDegrees(azimuthDeg) / 45) % 8;
  return COMPASS_POINTS[idx];
}

/** Mean obliquity of the ecliptic at J2000 (degrees). */
export const OBLIQUITY_J2000 = 23.4392911;

/** Ecliptic (J2000) longitude/latitude → EQJ unit vector. */
export function eclipticToEquatorialVector(
  lonDeg: number,
  latDeg: number,
  out: Vec3 = { x: 0, y: 0, z: 0 },
): Vec3 {
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  const eps = OBLIQUITY_J2000 * DEG;
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.cos(lat) * Math.sin(lon);
  const z = Math.sin(lat);
  out.x = x;
  out.y = y * Math.cos(eps) - z * Math.sin(eps);
  out.z = y * Math.sin(eps) + z * Math.cos(eps);
  return out;
}
