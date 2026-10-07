/**
 * Magnetic declination from the World Magnetic Model (WMM2025), so magnetic compass headings
 * reported by browsers can be converted to TRUE north (astronomical azimuths are true-north based).
 *
 * Standard WMM synthesis (NOAA technical report): geodetic → geocentric conversion, Schmidt
 * semi-normalised associated Legendre functions, spherical-harmonic field, rotation back to the
 * geodetic frame. Declination D = atan2(Y, X); true bearing = magnetic bearing + D (east positive).
 */
import { DEG, RAD } from './coordinate-transform';
import { WMM_COEFFICIENTS, WMM_EPOCH } from './wmm2025';

const MAX_N = 12;
const A_REF = 6371.2; // geomagnetic reference radius, km
const WGS84_A = 6378.137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

/** Valid model interval. Outside it the result is extrapolated and flagged. */
export const WMM_VALID_FROM = WMM_EPOCH;
export const WMM_VALID_TO = WMM_EPOCH + 5;

export interface MagneticField {
  /** Declination in degrees, east positive. */
  declination: number;
  /** Inclination (dip) in degrees, down positive. */
  inclination: number;
  /** North, east, down components and horizontal intensity in nT. */
  x: number;
  y: number;
  z: number;
  h: number;
  /** True when the date is outside the model's 5-year validity window. */
  extrapolated: boolean;
}

// Schmidt normalisation factors, computed once.
const SCHMIDT: number[][] = (() => {
  const s: number[][] = Array.from({ length: MAX_N + 1 }, () => new Array<number>(MAX_N + 1).fill(0));
  s[0][0] = 1;
  for (let n = 1; n <= MAX_N; n++) {
    s[n][0] = (s[n - 1][0] * (2 * n - 1)) / n;
    for (let m = 1; m <= n; m++) {
      s[n][m] = s[n][m - 1] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
    }
  }
  return s;
})();

export function decimalYear(date: Date): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const end = Date.UTC(y + 1, 0, 1);
  return y + (date.getTime() - start) / (end - start);
}

/**
 * Geomagnetic field at a geodetic position.
 * @param latDeg geodetic latitude, @param lonDeg east longitude, @param altKm height above the ellipsoid.
 */
export function magneticField(latDeg: number, lonDeg: number, altKm: number, year: number): MagneticField {
  const dt = year - WMM_EPOCH;
  const g: number[][] = Array.from({ length: MAX_N + 1 }, () => new Array<number>(MAX_N + 1).fill(0));
  const h: number[][] = Array.from({ length: MAX_N + 1 }, () => new Array<number>(MAX_N + 1).fill(0));
  for (const [n, m, gnm, hnm, gdot, hdot] of WMM_COEFFICIENTS) {
    g[n][m] = (gnm + dt * gdot) * SCHMIDT[n][m];
    h[n][m] = (hnm + dt * hdot) * SCHMIDT[n][m];
  }

  // Geodetic → geocentric spherical.
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const rc = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const p = (rc + altKm) * cosLat;
  const zc = (rc * (1 - WGS84_E2) + altKm) * sinLat;
  const r = Math.hypot(p, zc);
  const latC = Math.asin(zc / r);

  // Colatitude θ: cosθ = sin(latC), sinθ = cos(latC).
  const ct = Math.sin(latC);
  const st = Math.max(Math.cos(latC), 1e-10);

  // Gauss-normalised Legendre functions and their θ-derivatives.
  const P: number[][] = Array.from({ length: MAX_N + 1 }, () => new Array<number>(MAX_N + 1).fill(0));
  const dP: number[][] = Array.from({ length: MAX_N + 1 }, () => new Array<number>(MAX_N + 1).fill(0));
  P[0][0] = 1;
  for (let n = 1; n <= MAX_N; n++) {
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        P[n][m] = st * P[n - 1][m - 1];
        dP[n][m] = st * dP[n - 1][m - 1] + ct * P[n - 1][m - 1];
      } else if (n === 1 && m === 0) {
        P[n][m] = ct * P[0][0];
        dP[n][m] = ct * dP[0][0] - st * P[0][0];
      } else {
        const k = n > 1 ? ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3)) : 0;
        const p2 = n - 2 >= m ? P[n - 2][m] : 0;
        const dp2 = n - 2 >= m ? dP[n - 2][m] : 0;
        P[n][m] = ct * P[n - 1][m] - k * p2;
        dP[n][m] = ct * dP[n - 1][m] - st * P[n - 1][m] - k * dp2;
      }
    }
  }

  let br = 0; // radial (outward)
  let bt = 0; // θ (southward)
  let bp = 0; // φ (eastward)
  for (let n = 1; n <= MAX_N; n++) {
    const ar = Math.pow(A_REF / r, n + 2);
    for (let m = 0; m <= n; m++) {
      const cm = Math.cos(m * lon);
      const sm = Math.sin(m * lon);
      const gc = g[n][m] * cm + h[n][m] * sm;
      br += ar * (n + 1) * gc * P[n][m];
      bt -= ar * gc * dP[n][m];
      bp += (ar * m * (g[n][m] * sm - h[n][m] * cm) * P[n][m]) / st;
    }
  }

  // Geocentric north/east/down → geodetic.
  const xc = -bt;
  const yc = bp;
  const zcomp = -br;
  const psi = latC - lat;
  const x = xc * Math.cos(psi) - zcomp * Math.sin(psi);
  const z = xc * Math.sin(psi) + zcomp * Math.cos(psi);
  const y = yc;
  const hh = Math.hypot(x, y);
  return {
    declination: Math.atan2(y, x) * RAD,
    inclination: Math.atan2(z, hh) * RAD,
    x,
    y,
    z,
    h: hh,
    extrapolated: year < WMM_VALID_FROM || year > WMM_VALID_TO,
  };
}

/** Magnetic declination (deg, east positive) at a place and time. */
export function magneticDeclination(latDeg: number, lonDeg: number, elevationM: number, date: Date): number {
  return magneticField(latDeg, lonDeg, elevationM / 1000, decimalYear(date)).declination;
}
