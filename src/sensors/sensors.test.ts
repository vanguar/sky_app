import { describe, expect, it } from 'vitest';
import { vectorToHorizontal } from '../astronomy/coordinate-transform';
import { applyHeadingOffset, calibrateHeadingOffset } from './calibration';
import { deviceOrientationToQuaternion, normalizeScreenAngle } from './orientation-normalizer';
import { quat, quatAngle, rotateVector } from './quaternion';
import { QuaternionSmoother } from './smoothing';
import type { Quat } from './types';

/** Direction the back camera looks at (camera −Z) for an orientation. */
function viewDirection(q: Quat) {
  const v = rotateVector(q, 0, 0, -1, { x: 0, y: 0, z: 0 });
  return vectorToHorizontal(v);
}
/** Camera "up" (+Y) direction. */
function upDirection(q: Quat) {
  return rotateVector(q, 0, 1, 0, { x: 0, y: 0, z: 0 });
}

describe('deviceOrientationToQuaternion', () => {
  it('upright phone with alpha=0 looks north at the horizon', () => {
    const q = deviceOrientationToQuaternion(0, 90, 0, 0, quat());
    const h = viewDirection(q);
    expect(h.altitude).toBeCloseTo(0, 6);
    expect(Math.min(h.azimuth, 360 - h.azimuth)).toBeCloseTo(0, 6);
    expect(upDirection(q).y).toBeCloseTo(1, 6);
  });

  it('alpha increases counter-clockwise: alpha=90 looks west', () => {
    const h = viewDirection(deviceOrientationToQuaternion(90, 90, 0, 0, quat()));
    expect(h.azimuth).toBeCloseTo(270, 6);
  });

  it('alpha=270 looks east', () => {
    const h = viewDirection(deviceOrientationToQuaternion(270, 90, 0, 0, quat()));
    expect(h.azimuth).toBeCloseTo(90, 6);
  });

  it('flat phone (beta=0) screen up looks at the ground (nadir)', () => {
    const h = viewDirection(deviceOrientationToQuaternion(0, 0, 0, 0, quat()));
    expect(h.altitude).toBeCloseTo(-90, 6);
  });

  it('phone tilted back (beta=135) looks 45° above the horizon', () => {
    const h = viewDirection(deviceOrientationToQuaternion(0, 135, 0, 0, quat()));
    expect(h.altitude).toBeCloseTo(45, 6);
  });

  it('compensates landscape screen orientation (view direction unchanged, camera up stays up)', () => {
    // Phone rotated into landscape-left: device rotated about its z axis, gamma = -90.
    const q = deviceOrientationToQuaternion(0, 0, -90, 90, quat());
    const up = upDirection(q);
    expect(up.y).toBeCloseTo(1, 6);
    const h = viewDirection(q);
    expect(h.altitude).toBeCloseTo(0, 6);
  });

  it('normalises screen angles', () => {
    expect(normalizeScreenAngle(-90)).toBe(270);
    expect(normalizeScreenAngle(undefined)).toBe(0);
    expect(normalizeScreenAngle(180)).toBe(180);
  });
});

describe('smoothing & calibration', () => {
  it('snaps on first sample and converges afterwards', () => {
    const s = new QuaternionSmoother('medium');
    const a = deviceOrientationToQuaternion(0, 90, 0, 0, quat());
    const b = deviceOrientationToQuaternion(30, 90, 0, 0, quat());
    const out = quat();
    s.update(a, 16, out);
    expect(quatAngle(out, a)).toBeLessThan(1e-9);
    s.update(b, 16, out);
    const partial = quatAngle(out, b);
    expect(partial).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) s.update(b, 16, out);
    expect(quatAngle(out, b)).toBeLessThan(0.002);
  });

  it('suppresses sub-threshold noise', () => {
    const s = new QuaternionSmoother('low');
    const a = deviceOrientationToQuaternion(0, 90, 0, 0, quat());
    const noisy = deviceOrientationToQuaternion(0.01, 90.01, 0, 0, quat());
    const out = quat();
    s.update(a, 16, out);
    s.update(noisy, 16, out);
    expect(quatAngle(out, a)).toBeLessThan(1e-9);
  });

  it('applies a positive heading offset clockwise', () => {
    const q = deviceOrientationToQuaternion(0, 90, 0, 0, quat());
    const h = viewDirection(applyHeadingOffset(q, 10, quat()));
    expect(h.azimuth).toBeCloseTo(10, 6);
  });

  it('computes calibration offsets', () => {
    expect(calibrateHeadingOffset(0, 100, 110)).toBeCloseTo(10);
    expect(calibrateHeadingOffset(5, 350, 10)).toBeCloseTo(25);
    expect(calibrateHeadingOffset(170, 0, 30)).toBeCloseTo(-160);
  });
});
