/** Plain quaternion (x, y, z, w). Kept free of Three.js so the pipeline is unit-testable. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** One raw device-orientation reading, normalised across browsers / native bridges. */
export interface RawOrientationSample {
  /** Degrees [0, 360). Rotation about the device z axis. May be relative (arbitrary zero) if !absolute. */
  alpha: number;
  /** Degrees [−180, 180). Front-to-back tilt. */
  beta: number;
  /** Degrees [−90, 90). Left-to-right tilt. */
  gamma: number;
  /** True when alpha is referenced to magnetic/true north. */
  absolute: boolean;
  /** iOS Safari: compass heading in degrees clockwise from north (`webkitCompassHeading`). */
  compassHeading: number | null;
  /** iOS Safari: heading accuracy in degrees (`webkitCompassAccuracy`); negative = invalid. */
  compassAccuracy: number | null;
  /** Screen orientation angle at sample time (0, 90, 180, 270). */
  screenAngle: number;
  timestamp: number;
}

export type SensorPermission = 'granted' | 'denied' | 'unsupported' | 'insecure';

export interface SensorCapabilities {
  /** DeviceOrientation API exists at all. */
  orientation: boolean;
  /** iOS 13+ style explicit permission request is required. */
  requiresPermission: boolean;
  /** Page is in a secure context (required by modern browsers for sensors). */
  secureContext: boolean;
}

export type SensorStatus =
  'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'insecure' | 'noData' | 'error';

/** Heading quality reported to the UI. */
export type HeadingQuality = 'absolute' | 'compass' | 'relative';

export type SensorListener = (sample: RawOrientationSample) => void;

/**
 * Platform abstraction for orientation sensors. Implemented by BrowserSensorProvider today and,
 * later, by a Capacitor/native provider without touching rendering or UI code.
 */
export interface SensorProvider {
  getCapabilities(): SensorCapabilities;
  /** Must be called from a user gesture on iOS. */
  requestPermission(): Promise<SensorPermission>;
  start(listener: SensorListener): void;
  stop(): void;
  isRunning(): boolean;
}
