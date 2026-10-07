import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { latLonToSphere } from './globe-math';

/** Finds the SphereGeometry vertex whose UV is closest to (u, v). */
function vertexAtUv(u: number, v: number): THREE.Vector3 {
  const g = new THREE.SphereGeometry(1, 72, 36);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < uv.count; i++) {
    const d = Math.hypot(uv.getX(i) - u, uv.getY(i) - v);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return new THREE.Vector3().fromBufferAttribute(pos, best);
}

describe('latLonToSphere', () => {
  it('matches equirectangular texture placement on three.js spheres', () => {
    // Map centre (lon 0°, lat 0°) is at u = 0.5, v = 0.5.
    expect(latLonToSphere(0, 0).distanceTo(vertexAtUv(0.5, 0.5))).toBeLessThan(0.05);
    // 90°E is at u = 0.75.
    expect(latLonToSphere(0, 90).distanceTo(vertexAtUv(0.75, 0.5))).toBeLessThan(0.05);
    // 45°N, 60°W.
    expect(latLonToSphere(45, -60).distanceTo(vertexAtUv(0.5 - 60 / 360, 0.75))).toBeLessThan(0.06);
  });
});
