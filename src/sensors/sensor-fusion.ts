/**
 * Orientation pipeline (device orientation only — it never touches astronomical positions):
 *
 *   relative (gyro-stable) device quaternion  ──────────────────────────────┐
 *   absolute / compass heading → offset measurement → HeadingEstimator ──→ yaw offset
 *                                                   (+ magnetic declination + manual calibration)
 *   target = Ry(−totalOffset) · qRelative · Rz(−screenAngle)  → smoothing (render loop) → camera
 *
 * Modes (decided once per session, never switched silently):
 *  - fused:         Android Chrome — relative `deviceorientation` drives the view, the absolute
 *                   stream only feeds the heading estimator (jumps detected in the offset domain);
 *  - compass:       iOS Safari — relative alpha + webkitCompassHeading feed the estimator;
 *  - absolute-only: only absolute events; compass jumps detected with the gyroscope (devicemotion);
 *  - relative-only: no north reference at all → heading uncalibrated, user must calibrate.
 */
import { angleDelta, normalizeDegrees } from '../astronomy/coordinate-transform';
import { applyHeadingOffset } from './calibration';
import { HeadingEstimator, type HeadingStatus, type MeasurementResult } from './heading-estimator';
import {
  axisAzimuth,
  deviceOrientationToQuaternion,
  referenceAxis,
  type HeadingAxis,
} from './orientation-normalizer';
import { copyQuat, multiplyQuat, setAxisAngle } from './quaternion';
import { QuaternionSmoother, type SmoothingLevel } from './smoothing';
import type { HeadingQuality, MotionSample, Quat, RawOrientationSample } from './types';
import { DEG } from '../astronomy/coordinate-transform';

export type PipelineMode = 'pending' | 'fused' | 'compass' | 'absolute-only' | 'relative-only';
export type PipelineHeadingStatus = HeadingStatus | 'uncalibrated';

/** Wait this long after the first event to learn which streams exist. */
export const MODE_DECISION_MS = 400;
/** Absolute/relative samples are paired only if this close in time. */
const PAIRING_MS = 150;
/** iOS webkitCompassAccuracy above this (deg) is not trusted. */
export const MAX_COMPASS_ACCURACY_DEG = 25;
/** Bad iOS accuracy for this long after startup → compass reported unreliable. */
const BAD_ACCURACY_MS = 5000;

export interface PipelineDiagnostics {
  mode: PipelineMode;
  status: PipelineHeadingStatus;
  lastRelative: RawOrientationSample | null;
  lastAbsolute: RawOrientationSample | null;
  /** Heading (back axis) of the relative orientation before any offset. */
  relativeHeading: number | null;
  /** Last offset measurement (absolute − relative) and its classification. */
  measurement: number | null;
  measurementResult: MeasurementResult;
  estimatorOffset: number | null;
  appliedOffset: number | null;
  magneticDeclination: number;
  manualOffset: number;
  /** Heading of the final (target) view, true north. */
  finalHeading: number | null;
  cameraQuaternion: Quat;
  suspiciousSamples: number;
  recalibrations: number;
}

export class OrientationPipeline {
  private readonly qRel: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly qAbs: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly target: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly screenQ: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly smoothed: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly estimator = new HeadingEstimator();
  private readonly smoother: QuaternionSmoother;
  private mode: PipelineMode = 'pending';
  private firstAt: number | null = null;
  private relAt = -Infinity;
  private absAt = -Infinity;
  private sawCompass = false;
  private hasRel = false;
  private screenAngle = 0;
  private declination = 0;
  private manualOffset = 0;
  private lastRelSample: RawOrientationSample | null = null;
  private lastAbsSample: RawOrientationSample | null = null;
  private lastMeasurement: number | null = null;
  private badAccuracySince: number | null = null;
  // absolute-only mode: gyro-checked removal of compass jumps
  private glitchDeg = 0;
  private lastAbsAzimuth: number | null = null;
  private lastAbsAxis: HeadingAxis = 'back';
  private gyroDegSinceAbs = 0;
  private hasGyro = false;

  constructor(level: SmoothingLevel = 'medium') {
    this.smoother = new QuaternionSmoother(level);
  }

  /* ------------------------------------------------------------- input */

  ingest(sample: RawOrientationSample): void {
    if (!Number.isFinite(sample.alpha) || !Number.isFinite(sample.beta) || !Number.isFinite(sample.gamma))
      return;
    const t = sample.timestamp;
    if (this.firstAt === null) this.firstAt = t;
    this.screenAngle = sample.screenAngle;

    if (sample.absolute) {
      this.lastAbsSample = sample;
      this.absAt = t;
      deviceOrientationToQuaternion(sample.alpha, sample.beta, sample.gamma, 0, this.qAbs);
    } else {
      this.lastRelSample = sample;
      this.relAt = t;
      this.hasRel = true;
      if (sample.compassHeading != null) this.sawCompass = true;
      deviceOrientationToQuaternion(sample.alpha, sample.beta, sample.gamma, 0, this.qRel);
    }

    this.decideMode(t);

    switch (this.mode) {
      case 'fused':
        if (sample.absolute && t - this.relAt <= PAIRING_MS) this.measureFused(t);
        break;
      case 'compass':
        if (!sample.absolute) this.measureCompass(sample, t);
        break;
      case 'absolute-only':
        if (sample.absolute) this.trackAbsoluteOnly(t);
        break;
      default:
        break;
    }
  }

  /** Gyroscope rates — used to tell physical rotation from compass jumps (absolute-only mode). */
  ingestMotion(m: MotionSample): void {
    if (![m.alphaRate, m.betaRate, m.gammaRate].every(Number.isFinite)) return;
    this.hasGyro = true;
    const rate = Math.hypot(m.alphaRate, m.betaRate, m.gammaRate); // deg/s
    this.gyroDegSinceAbs += (rate * Math.min(Math.max(m.intervalMs, 0), 200)) / 1000;
  }

  private decideMode(t: number): void {
    if (this.mode !== 'pending') {
      // Relative stream died while absolute continues: degrade explicitly, once.
      if (
        (this.mode === 'fused' || this.mode === 'relative-only') &&
        t - this.relAt > 1500 &&
        t - this.absAt < 200
      ) {
        this.switchTo('absolute-only');
      }
      return;
    }
    if (this.sawCompass) return this.switchTo('compass');
    if (t - (this.firstAt ?? t) < MODE_DECISION_MS) return;
    const relRecent = t - this.relAt < MODE_DECISION_MS;
    const absRecent = t - this.absAt < MODE_DECISION_MS;
    if (relRecent && absRecent) this.switchTo('fused');
    else if (absRecent) this.switchTo('absolute-only');
    else if (relRecent) this.switchTo('relative-only');
  }

  private switchTo(mode: PipelineMode): void {
    this.mode = mode;
    this.estimator.reset();
    this.glitchDeg = 0;
    this.lastAbsAzimuth = null;
    if (mode === 'absolute-only') {
      copyQuat(this.qAbs, this.qRel);
      this.hasRel = true;
    }
  }

  private measureFused(t: number): void {
    const axis = referenceAxis(this.qRel);
    const abs = axisAzimuth(this.qAbs, axis);
    const rel = axisAzimuth(this.qRel, axis);
    if (abs === null || rel === null) return;
    this.feed(normalizeDegrees(abs - rel), t);
  }

  private measureCompass(s: RawOrientationSample, t: number): void {
    const heading = s.compassHeading;
    if (heading == null || !Number.isFinite(heading)) return;
    const acc = s.compassAccuracy;
    const accurate = acc == null || (acc >= 0 && acc <= MAX_COMPASS_ACCURACY_DEG);
    if (!accurate) {
      this.badAccuracySince ??= t;
      if (t - this.badAccuracySince > BAD_ACCURACY_MS) this.estimator.markUnreliable();
      return;
    }
    this.badAccuracySince = null;
    // webkitCompassHeading follows the back camera when the phone is held up, the top edge when flat.
    const rel = axisAzimuth(this.qRel, referenceAxis(this.qRel));
    if (rel === null) return;
    this.feed(normalizeDegrees(heading - rel), t);
  }

  /**
   * Absolute-only: the absolute quaternion drives the view directly. A heading change much larger
   * than the rotation measured by the gyroscope is treated as a compass jump and removed from the
   * view (accumulated in glitchDeg); the estimator then decides whether the new heading persists.
   */
  private trackAbsoluteOnly(t: number): void {
    const axis = referenceAxis(this.qAbs);
    const az = axisAzimuth(this.qAbs, axis);
    if (az !== null && this.lastAbsAzimuth !== null && axis === this.lastAbsAxis) {
      const delta = angleDelta(this.lastAbsAzimuth, az);
      if (
        this.hasGyro &&
        isSuspiciousHeadingChange(delta, this.gyroDegSinceAbs, this.estimator.opts.jumpDeg)
      ) {
        this.glitchDeg = normalizeDegrees(this.glitchDeg - delta);
      }
    }
    this.lastAbsAzimuth = az;
    this.lastAbsAxis = axis;
    this.gyroDegSinceAbs = 0;
    // Pseudo-relative orientation = absolute with detected jumps removed.
    applyHeadingOffset(this.qAbs, this.glitchDeg, this.qRel);
    this.feed(normalizeDegrees(-this.glitchDeg), t);
  }

  private feed(measurement: number, t: number): void {
    this.lastMeasurement = measurement;
    this.estimator.addMeasurement(measurement, t);
  }

  /* ------------------------------------------------------------ output */

  /** Writes the smoothed camera orientation into out. Returns false while no usable data exists. */
  step(dtMs: number, out: Quat): boolean {
    if (this.mode === 'pending' || !this.hasRel) return false;
    const applied = this.mode === 'relative-only' ? 0 : (this.estimator.update(dtMs) ?? 0);
    const magnetic = this.mode === 'relative-only' ? 0 : this.declination;
    const total = applied + magnetic + this.manualOffset;
    applyHeadingOffset(this.qRel, total, this.target);
    setAxisAngle(this.screenQ, 0, 0, 1, -this.screenAngle * DEG);
    multiplyQuat(this.target, this.screenQ, this.target);
    this.smoother.update(this.target, dtMs, out);
    copyQuat(out, this.smoothed);
    return true;
  }

  hasData(): boolean {
    return this.firstAt !== null;
  }

  getMode(): PipelineMode {
    return this.mode;
  }

  getHeadingStatus(): PipelineHeadingStatus | null {
    if (this.mode === 'pending') return null;
    if (this.mode === 'relative-only') return 'uncalibrated';
    return this.estimator.getStatus();
  }

  getHeadingQuality(): HeadingQuality {
    if (this.mode === 'fused' || this.mode === 'absolute-only') return 'absolute';
    if (this.mode === 'compass') return 'compass';
    return 'relative';
  }

  setSmoothing(level: SmoothingLevel): void {
    this.smoother.level = level;
  }

  /** Manual calibration (user action only). */
  setHeadingOffset(deg: number): void {
    this.manualOffset = deg;
  }

  /** Magnetic declination (east positive) converting magnetic headings to true north. */
  setMagneticDeclination(deg: number): void {
    this.declination = Number.isFinite(deg) ? deg : 0;
  }

  reset(): void {
    this.mode = 'pending';
    this.firstAt = null;
    this.relAt = -Infinity;
    this.absAt = -Infinity;
    this.sawCompass = false;
    this.hasRel = false;
    this.lastRelSample = null;
    this.lastAbsSample = null;
    this.lastMeasurement = null;
    this.badAccuracySince = null;
    this.glitchDeg = 0;
    this.lastAbsAzimuth = null;
    this.gyroDegSinceAbs = 0;
    this.hasGyro = false;
    this.estimator.reset();
    this.smoother.reset();
  }

  getDiagnostics(): PipelineDiagnostics {
    const rel = this.hasRel ? axisAzimuth(this.qRel, 'back') : null;
    const fin = this.hasRel ? axisAzimuth(this.target, 'back', 0.05) : null;
    return {
      mode: this.mode,
      status: this.getHeadingStatus() ?? 'collecting',
      lastRelative: this.lastRelSample,
      lastAbsolute: this.lastAbsSample,
      relativeHeading: rel,
      measurement: this.lastMeasurement,
      measurementResult: this.estimator.getLastResult(),
      estimatorOffset: this.estimator.getEstimate(),
      appliedOffset: this.estimator.getApplied(),
      magneticDeclination: this.declination,
      manualOffset: this.manualOffset,
      finalHeading: fin,
      cameraQuaternion: { ...this.smoothed },
      suspiciousSamples: this.estimator.getSuspiciousCount(),
      recalibrations: this.estimator.getRecalibrations(),
    };
  }
}

/**
 * Jump detector: a heading change counts as suspicious when it exceeds `jumpDeg` while the
 * gyroscope measured much less rotation over the same interval (real turns are allowed).
 */
export function isSuspiciousHeadingChange(
  headingDeltaDeg: number,
  gyroRotationDeg: number,
  jumpDeg = 8,
): boolean {
  const d = Math.abs(headingDeltaDeg);
  return d > jumpDeg && gyroRotationDeg < d * 0.5;
}
