import type { Quat } from './types';

export function quat(x = 0, y = 0, z = 0, w = 1): Quat {
  return { x, y, z, w };
}

export function copyQuat(src: Quat, out: Quat): Quat {
  out.x = src.x;
  out.y = src.y;
  out.z = src.z;
  out.w = src.w;
  return out;
}

/** out = a · b (Hamilton product). Safe when out aliases a or b. */
export function multiplyQuat(a: Quat, b: Quat, out: Quat): Quat {
  const ax = a.x,
    ay = a.y,
    az = a.z,
    aw = a.w;
  const bx = b.x,
    by = b.y,
    bz = b.z,
    bw = b.w;
  out.x = ax * bw + aw * bx + ay * bz - az * by;
  out.y = ay * bw + aw * by + az * bx - ax * bz;
  out.z = az * bw + aw * bz + ax * by - ay * bx;
  out.w = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}

export function setAxisAngle(out: Quat, ax: number, ay: number, az: number, angleRad: number): Quat {
  const h = angleRad / 2;
  const s = Math.sin(h);
  out.x = ax * s;
  out.y = ay * s;
  out.z = az * s;
  out.w = Math.cos(h);
  return out;
}

export function normalizeQuat(q: Quat): Quat {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  q.x /= l;
  q.y /= l;
  q.z /= l;
  q.w /= l;
  return q;
}

export function dotQuat(a: Quat, b: Quat): number {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

/** Angle in radians between two orientations. */
export function quatAngle(a: Quat, b: Quat): number {
  const d = Math.min(1, Math.abs(dotQuat(a, b)));
  return 2 * Math.acos(d);
}

/** Spherical linear interpolation from a toward b by t, written into out (may alias a). */
export function slerpQuat(a: Quat, b: Quat, t: number, out: Quat): Quat {
  let bx = b.x,
    by = b.y,
    bz = b.z,
    bw = b.w;
  let cos = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  let k0: number;
  let k1: number;
  if (cos > 0.9995) {
    k0 = 1 - t;
    k1 = t;
  } else {
    const theta = Math.acos(cos);
    const sin = Math.sin(theta);
    k0 = Math.sin((1 - t) * theta) / sin;
    k1 = Math.sin(t * theta) / sin;
  }
  out.x = a.x * k0 + bx * k1;
  out.y = a.y * k0 + by * k1;
  out.z = a.z * k0 + bz * k1;
  out.w = a.w * k0 + bw * k1;
  return normalizeQuat(out);
}

/** Rotates vector (vx, vy, vz) by q; writes into out. */
export function rotateVector(
  q: Quat,
  vx: number,
  vy: number,
  vz: number,
  out: { x: number; y: number; z: number },
) {
  // t = 2 * cross(q.xyz, v)
  const tx = 2 * (q.y * vz - q.z * vy);
  const ty = 2 * (q.z * vx - q.x * vz);
  const tz = 2 * (q.x * vy - q.y * vx);
  out.x = vx + q.w * tx + (q.y * tz - q.z * ty);
  out.y = vy + q.w * ty + (q.z * tx - q.x * tz);
  out.z = vz + q.w * tz + (q.x * ty - q.y * tx);
  return out;
}
