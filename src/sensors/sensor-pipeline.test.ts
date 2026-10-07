import { describe, expect, it, vi } from 'vitest';
import { AstronomyService } from '../astronomy/astronomy.service';
import { angleDelta, applyMat3, raDecToVector } from '../astronomy/coordinate-transform';
import type { Observer } from '../astronomy/types';
import { HeadingEstimator, circularStats } from './heading-estimator';
import { quat } from './quaternion';
import { SensorDiagnosticsLogger } from './sensor-diagnostics';
import { OrientationPipeline, isSuspiciousHeadingChange } from './sensor-fusion';
import type { RawOrientationSample } from './types';

const DT = 50; // 20 Hz sensor events

function sample(p: Partial<RawOrientationSample>): RawOrientationSample {
  return {
    alpha: 0,
    beta: 90,
    gamma: 0,
    absolute: false,
    compassHeading: null,
    compassAccuracy: null,
    screenAngle: 0,
    timestamp: 0,
    ...p,
  };
}

/** Upright phone: back-camera heading H corresponds to alpha = 360 − H. */
const alphaFor = (heading: number) => (360 - heading) % 360;

/** Feeds an iOS-style stream for `ms` and returns the final (unsmoothed) heading afterwards. */
function runIos(
  p: OrientationPipeline,
  t0: number,
  ms: number,
  relHeading: (t: number) => number,
  compass: (t: number) => number,
) {
  const out = quat();
  let t = t0;
  for (; t < t0 + ms; t += DT) {
    p.ingest(
      sample({
        alpha: alphaFor(relHeading(t)),
        compassHeading: compass(t),
        compassAccuracy: 10,
        timestamp: t,
      }),
    );
    p.step(DT, out);
  }
  return { t, heading: p.getDiagnostics().finalHeading! };
}

describe('HeadingEstimator — startup stabilisation', () => {
  it('does not take the first (unstable) sample as north', () => {
    const e = new HeadingEstimator();
    e.addMeasurement(200, 0); // garbage first reading
    for (let t = DT; t <= 3000; t += DT) e.addMeasurement(t % 100 === 0 ? 120 : 121, t);
    expect(e.getStatus()).toBe('ready');
    expect(Math.abs(angleDelta(e.getEstimate()!, 120.5))).toBeLessThan(1);
  });

  it('reports an unreliable compass when readings never settle', () => {
    const e = new HeadingEstimator();
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let t = 0; t <= 7000; t += DT) e.addMeasurement(120 + rnd() * 35, t);
    expect(e.getStatus()).toBe('unreliable');
  });

  it('computes circular statistics across 0/360', () => {
    const s = circularStats([359, 1, 0, 2, 358]);
    expect(Math.abs(angleDelta(s.mean, 0))).toBeLessThan(0.01);
    expect(s.spread).toBeLessThan(2);
  });
});

describe('HeadingEstimator — sudden compass correction', () => {
  function readyEstimator() {
    const e = new HeadingEstimator();
    let t = 0;
    for (; t <= 3000; t += DT) {
      e.addMeasurement([120, 121, 120, 121][(t / DT) % 4], t);
      e.update(DT);
    }
    expect(e.getStatus()).toBe('ready');
    return { e, t };
  }

  it('flags 120,121,120,121 → 143 (no rotation) as suspicious and keeps the reference', () => {
    const { e, t: t0 } = readyEstimator();
    const before = e.getApplied()!;
    let t = t0;
    for (; t < t0 + 1000; t += DT) {
      expect(e.addMeasurement(143, t)).toBe('suspicious');
      e.update(DT);
    }
    expect(Math.abs(angleDelta(e.getApplied()!, before))).toBeLessThan(0.5);
    expect(e.getSuspiciousCount()).toBeGreaterThan(10);
  });

  it('accepts a persistent new heading only after it holds, then blends it in slowly', () => {
    const { e, t: t0 } = readyEstimator();
    const before = e.getApplied()!;
    let t = t0;
    let accepted = false;
    for (; t < t0 + 3500; t += DT) {
      if (e.addMeasurement(143, t) === 'recalibrated') accepted = true;
      e.update(DT);
    }
    expect(accepted).toBe(true);
    expect(Math.abs(angleDelta(e.getEstimate()!, 143))).toBeLessThan(0.5);
    // Rate-limited: no visible jump of the sky.
    expect(Math.abs(angleDelta(before, e.getApplied()!))).toBeLessThan(4);
  });

  it('follows small drifts without flagging them', () => {
    const { e, t: t0 } = readyEstimator();
    expect(e.addMeasurement(123, t0 + DT)).toBe('accepted');
  });
});

describe('jump detector', () => {
  it('distinguishes compass jumps from real rotation using the gyroscope', () => {
    expect(isSuspiciousHeadingChange(22, 0.5)).toBe(true); // heading moved, phone did not
    expect(isSuspiciousHeadingChange(22, 21)).toBe(false); // user really turned
    expect(isSuspiciousHeadingChange(5, 0)).toBe(false); // below threshold
  });
});

describe('OrientationPipeline — iOS (relative alpha + webkitCompassHeading)', () => {
  it('stabilises on the compass heading, independent of the arbitrary relative zero', () => {
    const p = new OrientationPipeline('low');
    const { heading } = runIos(
      p,
      0,
      3500,
      () => 37,
      (t) => ((t / DT) % 2 ? 120 : 121),
    );
    expect(p.getMode()).toBe('compass');
    expect(p.getHeadingStatus()).toBe('ready');
    expect(Math.abs(angleDelta(heading, 120.5))).toBeLessThan(1);
  });

  it('keeps the view still when the compass jumps 120 → 143 without device rotation', () => {
    const p = new OrientationPipeline('low');
    const { t } = runIos(
      p,
      0,
      3500,
      () => 37,
      (tt) => ((tt / DT) % 2 ? 120 : 121),
    );
    const { heading } = runIos(
      p,
      t,
      1500,
      () => 37,
      () => 143,
    );
    expect(Math.abs(angleDelta(heading, 120.5))).toBeLessThan(1);
    expect(p.getDiagnostics().suspiciousSamples).toBeGreaterThan(10);
  });

  it('follows a real 22° turn (gyro and compass agree)', () => {
    const p = new OrientationPipeline('low');
    const { t } = runIos(
      p,
      0,
      3500,
      () => 37,
      () => 120,
    );
    const { heading } = runIos(
      p,
      t,
      1000,
      () => 37 + 22,
      () => 142,
    );
    expect(Math.abs(angleDelta(heading, 142))).toBeLessThan(1);
    expect(p.getDiagnostics().suspiciousSamples).toBe(0);
  });

  it('is invariant to equivalent Euler representations (phone raised past vertical)', () => {
    // (30°, 120°, 20°) and (210°, 60°, −160°) are the same physical pose; the old alpha-only
    // compass offset formula differed by 180° between them.
    const run = (alpha: number, beta: number, gamma: number) => {
      const p = new OrientationPipeline('low');
      const out = quat();
      for (let t = 0; t < 3500; t += DT) {
        p.ingest(sample({ alpha, beta, gamma, compassHeading: 200, compassAccuracy: 5, timestamp: t }));
        p.step(DT, out);
      }
      return p.getDiagnostics().finalHeading!;
    };
    expect(Math.abs(angleDelta(run(30, 120, 20), run(210, 60, -160)))).toBeLessThan(0.5);
  });

  it('ignores readings with poor webkitCompassAccuracy', () => {
    const p = new OrientationPipeline('low');
    const out = quat();
    for (let t = 0; t < 3500; t += DT) {
      p.ingest(sample({ alpha: alphaFor(37), compassHeading: 120, compassAccuracy: 10, timestamp: t }));
      p.step(DT, out);
    }
    for (let t = 3500; t < 4500; t += DT) {
      p.ingest(sample({ alpha: alphaFor(37), compassHeading: 250, compassAccuracy: 60, timestamp: t }));
      p.step(DT, out);
    }
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 120))).toBeLessThan(1);
  });
});

describe('OrientationPipeline — Android (relative + absolute streams)', () => {
  function feed(p: OrientationPipeline, t0: number, ms: number, rel: number, abs: number) {
    const out = quat();
    let t = t0;
    for (; t < t0 + ms; t += DT) {
      p.ingest(sample({ alpha: alphaFor(rel), absolute: false, timestamp: t }));
      p.ingest(sample({ alpha: alphaFor(abs), absolute: true, timestamp: t + 2 }));
      p.step(DT, out);
    }
    return t;
  }

  it('fuses: view uses the absolute heading, driven by the gyro-stable stream', () => {
    const p = new OrientationPipeline('low');
    feed(p, 0, 3500, 77, 200);
    expect(p.getMode()).toBe('fused');
    expect(p.getHeadingStatus()).toBe('ready');
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 200))).toBeLessThan(1);
  });

  it('does not switch heading source mid-session (no jump when streams interleave)', () => {
    const p = new OrientationPipeline('low');
    const out = quat();
    // Relative events arrive first, absolute ones a bit later (typical Chrome start-up).
    for (let t = 0; t < 300; t += DT) {
      p.ingest(sample({ alpha: alphaFor(77), absolute: false, timestamp: t }));
      expect(p.step(DT, out)).toBe(false); // nothing shown until the mode is known
    }
    feed(p, 300, 3500, 77, 200);
    expect(p.getMode()).toBe('fused');
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 200))).toBeLessThan(1);
  });

  it('ignores a magnetic re-calibration jump of the absolute stream', () => {
    const p = new OrientationPipeline('low');
    const t = feed(p, 0, 3500, 77, 200);
    feed(p, t, 1500, 77, 225);
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 200))).toBeLessThan(1);
  });

  it('applies magnetic declination (magnetic → true north)', () => {
    const p = new OrientationPipeline('low');
    p.setMagneticDeclination(8.5);
    feed(p, 0, 3500, 77, 200);
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 208.5))).toBeLessThan(1);
  });
});

describe('OrientationPipeline — absolute-only and relative-only', () => {
  it('removes compass jumps that the gyroscope did not see', () => {
    const p = new OrientationPipeline('low');
    const out = quat();
    let t = 0;
    for (; t < 3500; t += DT) {
      p.ingestMotion({ alphaRate: 0, betaRate: 0, gammaRate: 0, intervalMs: DT, timestamp: t });
      p.ingest(sample({ alpha: alphaFor(150), absolute: true, timestamp: t }));
      p.step(DT, out);
    }
    expect(p.getMode()).toBe('absolute-only');
    for (const end = t + 1000; t < end; t += DT) {
      p.ingestMotion({ alphaRate: 0, betaRate: 0, gammaRate: 0, intervalMs: DT, timestamp: t });
      p.ingest(sample({ alpha: alphaFor(170), absolute: true, timestamp: t }));
      p.step(DT, out);
    }
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 150))).toBeLessThan(1);
  });

  it('follows a real turn reported by the gyroscope', () => {
    const p = new OrientationPipeline('low');
    const out = quat();
    let t = 0;
    for (; t < 3500; t += DT) {
      p.ingest(sample({ alpha: alphaFor(150), absolute: true, timestamp: t }));
      p.step(DT, out);
    }
    // 20° turn in one 50 ms step, gyro reports ~400°/s.
    p.ingestMotion({ alphaRate: 400, betaRate: 0, gammaRate: 0, intervalMs: DT, timestamp: t });
    p.ingest(sample({ alpha: alphaFor(170), absolute: true, timestamp: t }));
    p.step(DT, out);
    expect(Math.abs(angleDelta(p.getDiagnostics().finalHeading!, 170))).toBeLessThan(1);
  });

  it('reports an uncalibrated heading when there is no north reference', () => {
    const p = new OrientationPipeline('low');
    const out = quat();
    for (let t = 0; t < 1000; t += DT) {
      p.ingest(sample({ alpha: 10, absolute: false, timestamp: t }));
      p.step(DT, out);
    }
    expect(p.getMode()).toBe('relative-only');
    expect(p.getHeadingStatus()).toBe('uncalibrated');
  });
});

describe('astronomical position vs device orientation', () => {
  it("keeps Saturn's Alt/Az and world direction fixed while the sensor heading changes", () => {
    const svc = new AstronomyService();
    const observer: Observer = { latitude: 50.45, longitude: 30.52, elevation: 0 };
    const date = new Date('2026-10-07T20:30:00Z');
    const before = svc.getBodyPosition('saturn', date, observer);
    const matrix = svc.getEqjToWorldMatrix(date, observer);
    const eq = before.equatorialJ2000;
    const worldBefore = applyMat3(matrix, raDecToVector(eq.ra * 15, eq.dec));

    const p = new OrientationPipeline('low');
    runIos(
      p,
      0,
      3500,
      () => 37,
      () => 120,
    );
    runIos(
      p,
      3500,
      2000,
      () => 37,
      () => 143,
    ); // compass glitch
    runIos(
      p,
      5500,
      2000,
      (t) => 37 + (t - 5500) / 50,
      () => 160,
    ); // user turning

    const after = svc.getBodyPosition('saturn', date, observer);
    expect(after.horizontal.altitude).toBe(before.horizontal.altitude);
    expect(after.horizontal.azimuth).toBe(before.horizontal.azimuth);
    const worldAfter = applyMat3(svc.getEqjToWorldMatrix(date, observer), raDecToVector(eq.ra * 15, eq.dec));
    expect(worldAfter).toEqual(worldBefore);
  });
});

describe('diagnostics logger', () => {
  it('is silent when disabled and throttled to one line per 500 ms when enabled', () => {
    const p = new OrientationPipeline('low');
    const sink = vi.fn();
    const off = new SensorDiagnosticsLogger(false, 500, sink);
    expect(off.maybeLog(() => p.getDiagnostics(), 1000)).toBe(false);
    const on = new SensorDiagnosticsLogger(true, 500, sink);
    for (let t = 0; t < 2000; t += 100) on.maybeLog(() => p.getDiagnostics(), t);
    expect(sink).toHaveBeenCalledTimes(4);
    const line = sink.mock.calls[0][0];
    for (const k of [
      'alpha',
      'beta',
      'gamma',
      'absolute',
      'webkitCompassHeading',
      'webkitCompassAccuracy',
      'screenAngle',
      'normalizedHeading',
      'calibrationOffset',
      'finalHeading',
      'cameraQuaternion',
    ])
      expect(line).toHaveProperty(k);
  });
});
