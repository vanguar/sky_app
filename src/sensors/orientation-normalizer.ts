/**
 * Device orientation → camera quaternion in the AstroPoint world frame (x east, y up, −z north).
 *
 * W3C DeviceOrientation uses an earth frame X = east, Y = north, Z = up and intrinsic Z-X'-Y''
 * angles (alpha, beta, gamma). Mapping that frame to ours (Y_up, −Z_north) gives the well-known
 * formula: Euler(beta, alpha, −gamma, 'YXZ') · Rx(−90°) · Rz(−screenAngle).
 * The back camera of the device (device −Z) then points along the camera's −Z.
 */
import { DEG, angleDelta, normalizeDegrees } from '../astronomy/coordinate-transform';
import { multiplyQuat, normalizeQuat, setAxisAngle } from './quaternion';
import type { HeadingQuality, Quat, RawOrientationSample } from './types';

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

/**
 * Turns possibly-relative alpha values into north-referenced ones.
 *  - absolute events (Android `deviceorientationabsolute`) are used directly;
 *  - iOS provides `webkitCompassHeading`: we low-pass an offset between it and the relative alpha;
 *  - otherwise alpha stays relative and the UI asks the user to calibrate.
 */
export class HeadingResolver {
  private offset = 0;
  private hasOffset = false;
  private quality: HeadingQuality = 'relative';

  /** Max acceptable iOS compass accuracy (degrees). */
  static readonly MAX_COMPASS_ERROR = 35;
  /** Low-pass factor for compass offset updates (0…1). */
  static readonly OFFSET_GAIN = 0.05;

  resolve(sample: RawOrientationSample): number {
    if (sample.absolute) {
      this.quality = 'absolute';
      return normalizeDegrees(sample.alpha);
    }
    const heading = sample.compassHeading;
    const accuracy = sample.compassAccuracy;
    const compassUsable =
      heading != null &&
      Number.isFinite(heading) &&
      (accuracy == null || (accuracy >= 0 && accuracy <= HeadingResolver.MAX_COMPASS_ERROR));
    if (compassUsable) {
      const measured = normalizeDegrees(360 - heading - sample.alpha);
      if (!this.hasOffset) {
        this.offset = measured;
        this.hasOffset = true;
      } else {
        // Circular low-pass suppresses magnetometer noise and sudden glitches.
        this.offset = normalizeDegrees(
          this.offset + HeadingResolver.OFFSET_GAIN * angleDelta(this.offset, measured),
        );
      }
      this.quality = 'compass';
    } else if (!this.hasOffset) {
      this.quality = 'relative';
    }
    return normalizeDegrees(sample.alpha + (this.hasOffset ? this.offset : 0));
  }

  getQuality(): HeadingQuality {
    return this.quality;
  }

  reset(): void {
    this.offset = 0;
    this.hasOffset = false;
    this.quality = 'relative';
  }
}
