import { copyQuat, quatAngle, slerpQuat } from './quaternion';
import type { Quat } from './types';

export type SmoothingLevel = 'low' | 'medium' | 'high';

/** Time constants (ms) of the exponential filter per level. */
export const SMOOTHING_TAU_MS: Record<SmoothingLevel, number> = {
  low: 45,
  medium: 100,
  high: 200,
};

/** Rotations smaller than this are treated as sensor noise (radians, ≈0.06°). */
export const DEAD_ZONE_RAD = 0.001;
/** Above this, the filter speeds up so large intentional moves don't lag (radians, ≈12°). */
export const FAST_FOLLOW_RAD = 0.21;

/**
 * Frame-rate independent quaternion low-pass filter with a dead zone (noise suppression)
 * and adaptive catch-up for large, intentional movements. Allocation-free.
 */
export class QuaternionSmoother {
  private readonly state: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private initialized = false;
  level: SmoothingLevel;

  constructor(level: SmoothingLevel = 'medium') {
    this.level = level;
  }

  reset(): void {
    this.initialized = false;
  }

  /** Advances the filter by dtMs toward target and writes the smoothed orientation into out. */
  update(target: Quat, dtMs: number, out: Quat): Quat {
    if (!this.initialized) {
      copyQuat(target, this.state);
      this.initialized = true;
      return copyQuat(this.state, out);
    }
    const angle = quatAngle(this.state, target);
    if (angle > DEAD_ZONE_RAD) {
      let tau = SMOOTHING_TAU_MS[this.level];
      if (angle > FAST_FOLLOW_RAD) tau /= 3;
      const dt = Math.min(Math.max(dtMs, 0), 250);
      const t = 1 - Math.exp(-dt / tau);
      slerpQuat(this.state, target, t, this.state);
    }
    return copyQuat(this.state, out);
  }
}
