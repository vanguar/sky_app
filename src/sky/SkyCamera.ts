import * as THREE from 'three';
import {
  DEG,
  clamp,
  normalizeDegrees,
  vectorToHorizontal,
  angleDelta,
} from '../astronomy/coordinate-transform';

export const MIN_FOV = 3;
export const MAX_FOV = 110;
export const DEFAULT_FOV = 70;

/**
 * Perspective camera at the centre of the celestial sphere.
 * Free mode: driven by azimuth/altitude (+ inertia). Sensor mode: driven by a quaternion.
 */
export class SkyCamera {
  readonly camera: THREE.PerspectiveCamera;
  azimuth = 180;
  altitude = 30;
  private velAz = 0;
  private velAlt = 0;
  private anim: {
    fromAz: number;
    fromAlt: number;
    toAz: number;
    toAlt: number;
    t: number;
    dur: number;
  } | null = null;
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly forward = new THREE.Vector3();
  reducedMotion = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(DEFAULT_FOV, aspect, 0.1, 1000);
    this.applyAltAz();
  }

  get fov(): number {
    return this.camera.fov;
  }

  setFov(fov: number): void {
    this.camera.fov = clamp(fov, MIN_FOV, MAX_FOV);
    this.camera.updateProjectionMatrix();
  }

  zoomBy(factor: number): void {
    this.setFov(this.camera.fov * factor);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Degrees per CSS pixel along the vertical axis. */
  degreesPerPixel(viewportHeight: number): number {
    return this.camera.fov / Math.max(1, viewportHeight);
  }

  panByPixels(dx: number, dy: number, viewportHeight: number): void {
    const k = this.degreesPerPixel(viewportHeight);
    this.anim = null;
    this.azimuth = normalizeDegrees(this.azimuth - dx * k);
    this.altitude = clamp(this.altitude + dy * k, -89.9, 89.9);
    this.applyAltAz();
  }

  /** Sets inertial velocity in degrees per ms (from the last drag). */
  fling(velAzDegPerMs: number, velAltDegPerMs: number): void {
    if (this.reducedMotion) return;
    this.velAz = velAzDegPerMs;
    this.velAlt = velAltDegPerMs;
  }

  stopMotion(): void {
    this.velAz = 0;
    this.velAlt = 0;
    this.anim = null;
  }

  lookAt(altitude: number, azimuth: number, animate = true): void {
    this.velAz = 0;
    this.velAlt = 0;
    const alt = clamp(altitude, -89.9, 89.9);
    if (!animate || this.reducedMotion) {
      this.anim = null;
      this.azimuth = normalizeDegrees(azimuth);
      this.altitude = alt;
      this.applyAltAz();
      return;
    }
    this.anim = { fromAz: this.azimuth, fromAlt: this.altitude, toAz: azimuth, toAlt: alt, t: 0, dur: 700 };
  }

  /** Advances inertia / animation. Returns true when the camera moved. */
  update(dtMs: number): boolean {
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(a.dur, a.t + dtMs);
      const p = a.t / a.dur;
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      this.azimuth = normalizeDegrees(a.fromAz + angleDelta(a.fromAz, a.toAz) * e);
      this.altitude = a.fromAlt + (a.toAlt - a.fromAlt) * e;
      if (a.t >= a.dur) this.anim = null;
      this.applyAltAz();
      return true;
    }
    if (Math.abs(this.velAz) < 1e-4 && Math.abs(this.velAlt) < 1e-4) return false;
    const dt = Math.min(dtMs, 50);
    this.azimuth = normalizeDegrees(this.azimuth + this.velAz * dt);
    this.altitude = clamp(this.altitude + this.velAlt * dt, -89.9, 89.9);
    const decay = Math.exp(-dt / 280);
    this.velAz *= decay;
    this.velAlt *= decay;
    this.applyAltAz();
    return true;
  }

  applyAltAz(): void {
    this.euler.set(this.altitude * DEG, -this.azimuth * DEG, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
    this.camera.updateMatrixWorld(true);
  }

  setQuaternion(x: number, y: number, z: number, w: number): void {
    this.camera.quaternion.set(x, y, z, w);
    this.camera.updateMatrixWorld(true);
  }

  /** Re-derives azimuth/altitude from the current orientation (e.g. when leaving sensor mode). */
  syncAltAzFromOrientation(): void {
    const h = this.getCenter();
    this.azimuth = h.azimuth;
    this.altitude = clamp(h.altitude, -89.9, 89.9);
    this.applyAltAz();
  }

  getCenter(): { altitude: number; azimuth: number } {
    this.forward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    return vectorToHorizontal(this.forward);
  }
}
