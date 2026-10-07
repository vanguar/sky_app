import * as THREE from 'three';

/** Lat/lon (deg, east-positive) → point on a unit sphere matching three.js SphereGeometry UVs. */
export function latLonToSphere(lat: number, lon: number, r = 1): THREE.Vector3 {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(la) * Math.cos(lo) * r,
    Math.sin(la) * r,
    -Math.cos(la) * Math.sin(lo) * r,
  );
}
