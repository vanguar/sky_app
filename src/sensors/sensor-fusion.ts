/**
 * Orientation pipeline:
 *   raw sample → heading resolution (absolute / compass / relative)
 *   → screen-orientation compensated quaternion → calibration offset → target
 *   → (render loop) smoothing → camera orientation
 *
 * Sensor events only update `target`; the render loop calls `step()` once per frame.
 * This decouples the sensor event rate from rendering and keeps the camera steady.
 */
import { applyHeadingOffset } from './calibration';
import { HeadingResolver, deviceOrientationToQuaternion } from './orientation-normalizer';
import { QuaternionSmoother, type SmoothingLevel } from './smoothing';
import type { HeadingQuality, Quat, RawOrientationSample } from './types';

export class OrientationPipeline {
  private readonly target: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly resolver = new HeadingResolver();
  private readonly smoother: QuaternionSmoother;
  private hasTarget = false;
  private headingOffsetDeg = 0;
  private lastSampleAt = 0;

  constructor(level: SmoothingLevel = 'medium') {
    this.smoother = new QuaternionSmoother(level);
  }

  ingest(sample: RawOrientationSample): void {
    if (!Number.isFinite(sample.alpha) || !Number.isFinite(sample.beta) || !Number.isFinite(sample.gamma))
      return;
    const alpha = this.resolver.resolve(sample);
    deviceOrientationToQuaternion(alpha, sample.beta, sample.gamma, sample.screenAngle, this.target);
    applyHeadingOffset(this.target, this.headingOffsetDeg, this.target);
    this.hasTarget = true;
    this.lastSampleAt = sample.timestamp;
  }

  /** Writes the smoothed orientation into out. Returns false while no sensor data has arrived. */
  step(dtMs: number, out: Quat): boolean {
    if (!this.hasTarget) return false;
    this.smoother.update(this.target, dtMs, out);
    return true;
  }

  hasData(): boolean {
    return this.hasTarget;
  }

  getLastSampleTime(): number {
    return this.lastSampleAt;
  }

  getHeadingQuality(): HeadingQuality {
    return this.resolver.getQuality();
  }

  setSmoothing(level: SmoothingLevel): void {
    this.smoother.level = level;
  }

  setHeadingOffset(deg: number): void {
    this.headingOffsetDeg = deg;
  }

  reset(): void {
    this.hasTarget = false;
    this.smoother.reset();
    this.resolver.reset();
  }
}
