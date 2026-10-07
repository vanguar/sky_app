import { astronomyService, type AstronomyService } from '../../astronomy/astronomy.service';
import { timeController, type TimeController } from '../../astronomy/time-controller';
import { createLocationProvider, type LocationProvider } from '../../platform/location/location-provider';
import { OrientationPipeline } from '../../sensors/sensor-fusion';
import { createSensorProvider } from '../../sensors/sensor-provider';
import type { SensorProvider } from '../../sensors/types';

/**
 * Platform services. Swap implementations here (e.g. Capacitor providers) without touching
 * astronomy, rendering or UI code.
 */
export interface Platform {
  sensors: SensorProvider;
  location: LocationProvider;
  orientation: OrientationPipeline;
  astronomy: AstronomyService;
  time: TimeController;
}

export function createPlatform(): Platform {
  return {
    sensors: createSensorProvider(),
    location: createLocationProvider(),
    orientation: new OrientationPipeline(),
    astronomy: astronomyService,
    time: timeController,
  };
}
