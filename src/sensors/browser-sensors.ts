import { normalizeScreenAngle } from './orientation-normalizer';
import type {
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
 *  - Android Chrome: prefers `deviceorientationabsolute` (north-referenced alpha).
 *  - iOS Safari: `deviceorientation` + `webkitCompassHeading`, permission via user gesture.
 */
export class BrowserSensorProvider implements SensorProvider {
  private listener: SensorListener | null = null;
  private eventName: 'deviceorientationabsolute' | 'deviceorientation' | null = null;
  private absoluteSeen = false;

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

  start(listener: SensorListener): void {
    this.stop();
    this.listener = listener;
    this.absoluteSeen = false;
    this.eventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(this.eventName, this.handle as EventListener, { passive: true });
    if (this.eventName === 'deviceorientationabsolute') {
      // Some browsers expose the absolute event but never fire it; listen to both and prefer absolute.
      window.addEventListener('deviceorientation', this.handleRelative as EventListener, { passive: true });
    }
  }

  stop(): void {
    if (this.eventName) {
      window.removeEventListener(this.eventName, this.handle as EventListener);
      window.removeEventListener('deviceorientation', this.handleRelative as EventListener);
    }
    this.eventName = null;
    this.listener = null;
  }

  isRunning(): boolean {
    return this.listener !== null;
  }

  private readonly handleRelative = (e: DeviceOrientationEvent) => {
    if (this.absoluteSeen) return;
    this.emit(e as WebkitDeviceOrientationEvent, e.absolute === true);
  };

  private readonly handle = (e: DeviceOrientationEvent) => {
    const absolute = this.eventName === 'deviceorientationabsolute' || e.absolute === true;
    if (this.eventName === 'deviceorientationabsolute' && e.alpha != null) this.absoluteSeen = true;
    this.emit(e as WebkitDeviceOrientationEvent, absolute);
  };

  private emit(e: WebkitDeviceOrientationEvent, absolute: boolean): void {
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
