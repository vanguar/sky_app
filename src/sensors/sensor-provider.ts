import { BrowserSensorProvider } from './browser-sensors';
import type { SensorProvider } from './types';

export type { SensorProvider } from './types';

/**
 * Factory for the platform sensor provider. A future Capacitor build can return a
 * NativeSensorProvider here (e.g. based on @capacitor/motion) without other changes.
 */
export function createSensorProvider(): SensorProvider {
  return new BrowserSensorProvider();
}
