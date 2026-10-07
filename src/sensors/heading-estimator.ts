/**
 * HeadingEstimator — robust estimate of the yaw offset between the gyro-stable *relative*
 * orientation and the magnetometer-based *absolute* heading.
 *
 *   offset measurement m = absoluteHeading − relativeHeading   (same physical direction)
 *
 * Physical rotation of the phone changes both headings equally, so m stays constant. A change of m
 * therefore means the magnetic heading moved WITHOUT the device rotating (magnetometer
 * re-calibration, magnetic disturbance, compass glitch) — exactly what must not move the sky.
 *
 *  - startup: collect a series of measurements, never trust a single first sample;
 *    "ready" once the circular spread is small, "unreliable" if it never settles;
 *  - steady state: small deviations are followed slowly (gyro drift compensation);
 *    jumps > JUMP_DEG are flagged suspicious and ignored unless they persist (then accepted
 *    and blended in at a limited rate; repeated re-calibrations mark the compass unreliable).
 */
import { DEG, RAD, angleDelta, normalizeDegrees } from '../astronomy/coordinate-transform';

export type HeadingStatus = 'collecting' | 'ready' | 'unreliable';

export interface HeadingEstimatorOptions {
  startupMs: number;
  maxStartupMs: number;
  minSamples: number;
  /** Circular std-dev (deg) below which startup counts as stable. */
  stableSpreadDeg: number;
  /** Offset change (deg) without matching rotation that marks a sample suspicious. */
  jumpDeg: number;
  /** A suspicious new offset must persist this long before it is accepted. */
  persistMs: number;
  /** Time constant for following slow drift (ms). */
  driftTauMs: number;
  /** Max change rate of the applied offset during startup / afterwards (deg/s). */
  startupSlewDegPerSec: number;
  slewDegPerSec: number;
  /** Accepted re-calibrations after which the compass is reported unreliable. */
  maxRecalibrations: number;
}

export const DEFAULT_HEADING_OPTIONS: HeadingEstimatorOptions = {
  startupMs: 2500,
  maxStartupMs: 6000,
  minSamples: 12,
  stableSpreadDeg: 6,
  jumpDeg: 8,
  persistMs: 3000,
  driftTauMs: 20000,
  startupSlewDegPerSec: 120,
  slewDegPerSec: 4,
  maxRecalibrations: 2,
};

export type MeasurementResult = 'collecting' | 'accepted' | 'suspicious' | 'recalibrated';

interface Sample {
  t: number;
  m: number;
}

/** Circular mean (deg) and spread (circular std-dev, deg) of angles. */
export function circularStats(angles: readonly number[]): { mean: number; spread: number } {
  let s = 0;
  let c = 0;
  for (const a of angles) {
    s += Math.sin(a * DEG);
    c += Math.cos(a * DEG);
  }
  const n = Math.max(1, angles.length);
  const rLen = Math.min(1, Math.hypot(s, c) / n);
  return {
    mean: normalizeDegrees(Math.atan2(s, c) * RAD),
    spread: rLen <= 1e-9 ? 180 : Math.sqrt(-2 * Math.log(rLen)) * RAD,
  };
}

/** Circular mean after discarding outliers further than `trimDeg` from the first-pass mean. */
export function robustCircularMean(angles: readonly number[], trimDeg = 15) {
  const first = circularStats(angles);
  const kept = angles.filter((a) => Math.abs(angleDelta(first.mean, a)) <= trimDeg);
  return kept.length >= Math.max(3, angles.length / 2) ? circularStats(kept) : first;
}

export class HeadingEstimator {
  readonly opts: HeadingEstimatorOptions;
  private status: HeadingStatus = 'collecting';
  private startAt: number | null = null;
  private startup: Sample[] = [];
  private estimate: number | null = null;
  private applied: number | null = null;
  private lastT = 0;
  private pending: Sample[] = [];
  private recalibrations = 0;
  private suspicious = 0;
  private lastResult: MeasurementResult = 'collecting';

  constructor(opts: Partial<HeadingEstimatorOptions> = {}) {
    this.opts = { ...DEFAULT_HEADING_OPTIONS, ...opts };
  }

  reset(): void {
    this.status = 'collecting';
    this.startAt = null;
    this.startup = [];
    this.estimate = null;
    this.applied = null;
    this.pending = [];
    this.recalibrations = 0;
    this.suspicious = 0;
    this.lastT = 0;
  }

  /** Feed one offset measurement (degrees) at time t (ms). */
  addMeasurement(measured: number, t: number): MeasurementResult {
    const m = normalizeDegrees(measured);
    if (this.startAt === null) this.startAt = t;
    const dtMs = this.lastT ? Math.max(0, t - this.lastT) : 0;
    this.lastT = t;

    if (this.status === 'collecting') {
      this.startup.push({ t, m });
      const stats = robustCircularMean(this.startup.map((s) => s.m));
      this.estimate = stats.mean;
      const elapsed = t - this.startAt;
      if (elapsed >= this.opts.startupMs && this.startup.length >= this.opts.minSamples) {
        // Judge stability on the most recent window (the compass often settles after a moment).
        const recent = this.startup.filter((s) => t - s.t <= this.opts.startupMs).map((s) => s.m);
        const r = robustCircularMean(recent);
        if (r.spread <= this.opts.stableSpreadDeg) {
          this.estimate = r.mean;
          this.status = 'ready';
        } else if (elapsed >= this.opts.maxStartupMs) {
          this.estimate = r.mean;
          this.status = 'unreliable';
        }
      }
      return (this.lastResult = 'collecting');
    }

    const est = this.estimate ?? m;
    const dev = angleDelta(est, m);
    if (Math.abs(dev) <= this.opts.jumpDeg) {
      // Consistent with the reference: follow slow drift only.
      this.pending = [];
      const k = dtMs > 0 ? 1 - Math.exp(-dtMs / this.opts.driftTauMs) : 0;
      this.estimate = normalizeDegrees(est + dev * k);
      return (this.lastResult = 'accepted');
    }

    // Heading moved without matching device rotation → suspicious.
    this.suspicious++;
    if (this.pending.length) {
      const p = circularStats(this.pending.map((s) => s.m));
      if (Math.abs(angleDelta(p.mean, m)) > this.opts.jumpDeg / 2) this.pending = [];
    }
    this.pending.push({ t, m });
    if (t - this.pending[0].t >= this.opts.persistMs && this.pending.length >= 3) {
      // Persistent, self-consistent new heading: accept as a re-calibrated reference.
      this.estimate = circularStats(this.pending.map((s) => s.m)).mean;
      this.pending = [];
      this.recalibrations++;
      if (this.recalibrations >= this.opts.maxRecalibrations) this.status = 'unreliable';
      return (this.lastResult = 'recalibrated');
    }
    return (this.lastResult = 'suspicious');
  }

  /** Advances the applied (displayed) offset toward the estimate with a rate limit. */
  update(dtMs: number): number | null {
    if (this.estimate === null) return null;
    if (this.applied === null) {
      this.applied = this.estimate;
      return this.applied;
    }
    const rate = this.status === 'collecting' ? this.opts.startupSlewDegPerSec : this.opts.slewDegPerSec;
    const maxStep = (rate * Math.max(0, dtMs)) / 1000;
    const d = angleDelta(this.applied, this.estimate);
    this.applied = normalizeDegrees(this.applied + Math.max(-maxStep, Math.min(maxStep, d)));
    return this.applied;
  }

  /** Forces unreliable status (e.g. iOS reports poor compass accuracy). */
  markUnreliable(): void {
    if (this.status !== 'collecting') this.status = 'unreliable';
  }

  getStatus(): HeadingStatus {
    return this.status;
  }
  getEstimate(): number | null {
    return this.estimate;
  }
  getApplied(): number | null {
    return this.applied;
  }
  getSuspiciousCount(): number {
    return this.suspicious;
  }
  getRecalibrations(): number {
    return this.recalibrations;
  }
  getLastResult(): MeasurementResult {
    return this.lastResult;
  }
}
