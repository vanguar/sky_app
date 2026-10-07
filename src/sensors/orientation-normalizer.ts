/**
 * Device orientation → camera quaternion in the AstroPoint world frame (x east, y up, −z north).
 *
 * W3C DeviceOrientation uses an earth frame X = east, Y = north, Z = up and intrinsic Z-X'-Y''
 * angles (alpha, beta, gamma). Mapping that frame to ours (Y_up, −Z_north) gives the well-known
 * formula: Euler(beta, alpha, −gamma, 'YXZ') · Rx(−90°) · Rz(−screenAngle).
 * The back camera of the device (device −Z) then points along the camera's −Z.
 */
import { DEG, RAD, normalizeDegrees } from '../astronomy/coordinate-transform';
import { multiplyQuat, normalizeQuat, rotateVector, setAxisAngle } from './quaternion';
import type { Quat } from './types';

const SQRT_HALF = Math.SQRT1_2;
const scratchScreen: Quat = { x: 0, y: 0, z: 0, w: 1 };
const DEVICE_TO_CAMERA: Quat = { x: -SQRT_HALF, y: 0, z: 0, w: SQRT_HALF };

export function deviceOrientationToQuaternion(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number,
  out: Quat,
): Quat {
  // Euler (x = beta, y = alpha, z = −gamma) in 'YXZ' order.
  const x = betaDeg * DEG;
  const y = alphaDeg * DEG;
  const z = -gammaDeg * DEG;
  const c1 = Math.cos(x / 2);
  const c2 = Math.cos(y / 2);
  const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2);
  const s2 = Math.sin(y / 2);
  const s3 = Math.sin(z / 2);
  out.x = s1 * c2 * c3 + c1 * s2 * s3;
  out.y = c1 * s2 * c3 - s1 * c2 * s3;
  out.z = c1 * c2 * s3 - s1 * s2 * c3;
  out.w = c1 * c2 * c3 + s1 * s2 * s3;
  multiplyQuat(out, DEVICE_TO_CAMERA, out);
  setAxisAngle(scratchScreen, 0, 0, 1, -screenAngleDeg * DEG);
  multiplyQuat(out, scratchScreen, out);
  return normalizeQuat(out);
}

/** Normalises a screen orientation angle to 0/90/180/270. */
export function normalizeScreenAngle(angle: number | null | undefined): number {
  if (angle == null || !Number.isFinite(angle)) return 0;
  return normalizeDegrees(Math.round(angle / 90) * 90);
}

/** Which device axis a heading refers to. */
export type HeadingAxis = 'back' | 'top';

const tmpVec = { x: 0, y: 0, z: 0 };

/**
 * Azimuth (deg, from north through east) of a device axis for a *device* quaternion
 * (screenAngle = 0, so camera −Z = back of the phone, camera +Y = top edge).
 * Returns null when the axis is (nearly) vertical and the azimuth is undefined.
 */
export function axisAzimuth(q: Quat, axis: HeadingAxis, minHorizontal = 0.15): number | null {
  if (axis === 'back') rotateVector(q, 0, 0, -1, tmpVec);
  else rotateVector(q, 0, 1, 0, tmpVec);
  const horizontal = Math.hypot(tmpVec.x, tmpVec.z);
  if (horizontal < minHorizontal) return null;
  return normalizeDegrees(Math.atan2(tmpVec.x, -tmpVec.z) * RAD);
}

/** Horizontal share of the back axis (1 = phone upright, 0 = phone flat). */
export function backAxisHorizontal(q: Quat): number {
  rotateVector(q, 0, 0, -1, tmpVec);
  return Math.hypot(tmpVec.x, tmpVec.z);
}

/**
 * Axis best suited to compare two estimates of the same orientation: the back camera axis unless
 * the phone lies (nearly) flat, then the top edge. Both quaternions must use the same axis.
 */
export function referenceAxis(q: Quat): HeadingAxis {
  return backAxisHorizontal(q) >= 0.5 ? 'back' : 'top';
}
