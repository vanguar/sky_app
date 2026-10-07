import type { PipelineDiagnostics } from './sensor-fusion';

/** Diagnostics are on in development builds, or in any build with `?sensorDebug=1` in the URL. */
export function sensorDiagnosticsEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(location.search).get('sensorDebug') === '1';
  } catch {
    return false;
  }
}

const r1 = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Flat, log-friendly snapshot of the whole sensor pipeline. */
export function formatDiagnostics(d: PipelineDiagnostics, now: number) {
  const ev = d.lastRelative ?? d.lastAbsolute;
  return {
    t: Math.round(now),
    mode: d.mode,
    status: d.status,
    alpha: r1(ev?.alpha),
    beta: r1(ev?.beta),
    gamma: r1(ev?.gamma),
    absoluteAlpha: r1(d.lastAbsolute?.alpha),
    absolute: ev?.absolute ?? null,
    webkitCompassHeading: r1(d.lastRelative?.compassHeading),
    webkitCompassAccuracy: r1(d.lastRelative?.compassAccuracy),
    screenAngle: ev?.screenAngle ?? null,
    normalizedHeading: r1(d.relativeHeading),
    measurement: r1(d.measurement),
    measurementResult: d.measurementResult,
    estimatorOffset: r1(d.estimatorOffset),
    appliedOffset: r1(d.appliedOffset),
    magneticDeclination: r1(d.magneticDeclination),
    calibrationOffset: r1(d.manualOffset),
    finalHeading: r1(d.finalHeading),
    cameraQuaternion: [
      d.cameraQuaternion.x,
      d.cameraQuaternion.y,
      d.cameraQuaternion.z,
      d.cameraQuaternion.w,
    ].map(r4),
    suspicious: d.suspiciousSamples,
    recalibrations: d.recalibrations,
  };
}

/** Logs a pipeline snapshot at most every `intervalMs`; no-op when disabled. */
export class SensorDiagnosticsLogger {
  private last = -Infinity;

  constructor(
    private readonly enabled: boolean,
    private readonly intervalMs = 500,
    private readonly sink: (line: ReturnType<typeof formatDiagnostics>) => void = (line) =>
      console.debug('[AstroPoint sensors]', line),
  ) {}

  maybeLog(getDiagnostics: () => PipelineDiagnostics, now: number): boolean {
    if (!this.enabled || now - this.last < this.intervalMs) return false;
    this.last = now;
    this.sink(formatDiagnostics(getDiagnostics(), now));
    return true;
  }
}
