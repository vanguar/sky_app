import { DEG, angleDelta, normalizeDegrees } from '../astronomy/coordinate-transform';
import { multiplyQuat, setAxisAngle } from './quaternion';
import type { Quat } from './types';

const scratch: Quat = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Applies a manual heading correction: positive offsets rotate the view clockwise
 * (toward larger azimuths). out = Ry(−offset) · q. Safe when out aliases q.
 */
export function applyHeadingOffset(q: Quat, offsetDeg: number, out: Quat): Quat {
  if (offsetDeg === 0) {
    out.x = q.x;
    out.y = q.y;
    out.z = q.z;
    out.w = q.w;
    return out;
  }
  setAxisAngle(scratch, 0, 1, 0, -offsetDeg * DEG);
  return multiplyQuat(scratch, q, out);
}

/**
 * New heading offset so that the current view centre azimuth lands on the target's true azimuth.
 * Used by "calibrate on selected object": the user points the phone at a known object and taps.
 */
export function calibrateHeadingOffset(
  currentOffsetDeg: number,
  viewAzimuthDeg: number,
  targetAzimuthDeg: number,
): number {
  const corrected = currentOffsetDeg + angleDelta(viewAzimuthDeg, targetAzimuthDeg);
  // Keep in (−180, 180] for display.
  const n = normalizeDegrees(corrected);
  return n > 180 ? n - 360 : n;
}
