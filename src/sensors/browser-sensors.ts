import { normalizeScreenAngle } from './orientation-normalizer';
import type {
  MotionListener,
  RawOrientationSample,
  SensorCapabilities,
  SensorListener,
  SensorPermission,
  SensorProvider,
} from './types';

/** iOS-specific extensions of DeviceOrientationEvent. */
interface WebkitDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface PermissionCapableOrientation {
  requestPermission?: () => Promise<string>;
}

function getScreenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return normalizeScreenAngle(screen.orientation.angle);
  }
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return normalizeScreenAngle(typeof legacy === 'number' ? legacy : 0);
}

/**
 * DeviceOrientation-based provider for browsers / PWAs.
 *
 * Both streams are forwarded, each tagged with its frame, and the pipeline decides how to fuse
 * them (a single heading value never silently switches its source):
 *  - `deviceorientation`          → relative, gyro-stable orientation (iOS also adds webkitCompassHeading)
 *  - `deviceorientationabsolute`  → magnetic-north referenced orientation (Chrome / Android)
 *  - `devicemotion`               → gyroscope rotation rates (tell real rotation from compass jumps)
 */
export class BrowserSensorProvider implements SensorProvider {
  private listener: SensorListener | null = null;
  private motion: MotionListener | null = null;
  private listening = false;

  getCapabilities(): SensorCapabilities {
    const hasWindow = typeof window !== 'undefined';
    const orientation = hasWindow && 'DeviceOrientationEvent' in window;
    const ctor = orientation
      ? (window.DeviceOrientationEvent as unknown as PermissionCapableOrientation)
      : null;
    return {
      orientation,
      requiresPermission: !!ctor && typeof ctor.requestPermission === 'function',
      secureContext: hasWindow ? window.isSecureContext : false,
    };
  }

  async requestPermission(): Promise<SensorPermission> {
    const caps = this.getCapabilities();
    if (!caps.orientation) return 'unsupported';
    if (!caps.secureContext) return 'insecure';
    if (!caps.requiresPermission) return 'granted';
    try {
      const ctor = window.DeviceOrientationEvent as unknown as PermissionCapableOrientation;
      const result: string = await ctor.requestPermission!();
      // Only an explicit refusal is final. Some engines report 'prompt'/'default' and still deliver
      // events; the no-data watchdog in sensor mode handles the case where nothing arrives.
      return result === 'denied' ? 'denied' : 'granted';
    } catch {
      // Called outside a user gesture or unsupported: try listening anyway (watchdog decides).
      return 'granted';
    }
  }

  start(listener: SensorListener, motion?: MotionListener): void {
    this.stop();
    this.listener = listener;
    this.motion = motion ?? null;
    this.listening = true;
    window.addEventListener('deviceorientation', this.onRelative as EventListener, { passive: true });
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', this.onAbsolute as EventListener, {
        passive: true,
      });
    }
    if (this.motion && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this.onMotion as EventListener, { passive: true });
    }
  }

  stop(): void {
    if (this.listening) {
      window.removeEventListener('deviceorientation', this.onRelative as EventListener);
      window.removeEventListener('deviceorientationabsolute', this.onAbsolute as EventListener);
      window.removeEventListener('devicemotion', this.onMotion as EventListener);
    }
    this.listening = false;
    this.listener = null;
    this.motion = null;
  }

  isRunning(): boolean {
    return this.listener !== null;
  }

  // Some browsers (e.g. Firefox for Android) deliver absolute data via 'deviceorientation';
  // trust the event's own `absolute` flag there.
  private readonly onRelative = (e: DeviceOrientationEvent) => this.emit(e, e.absolute === true);
  private readonly onAbsolute = (e: DeviceOrientationEvent) => this.emit(e, true);

  private readonly onMotion = (e: DeviceMotionEvent) => {
    const r = e.rotationRate;
    if (!this.motion || !r || r.alpha == null || r.beta == null || r.gamma == null) return;
    this.motion({
      alphaRate: r.alpha,
      betaRate: r.beta,
      gammaRate: r.gamma,
      intervalMs: e.interval ?? 16,
      timestamp: performance.now(),
    });
  };

  private emit(ev: DeviceOrientationEvent, absolute: boolean): void {
    const e = ev as WebkitDeviceOrientationEvent;
    if (!this.listener || e.alpha == null || e.beta == null || e.gamma == null) return;
    const sample: RawOrientationSample = {
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute,
      compassHeading: typeof e.webkitCompassHeading === 'number' ? e.webkitCompassHeading : null,
      compassAccuracy: typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null,
      screenAngle: getScreenAngle(),
      timestamp: performance.now(),
    };
    this.listener(sample);
  }
}
