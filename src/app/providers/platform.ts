import { astronomyService, type AstronomyService } from '../../astronomy/astronomy.service';
import { timeController, type TimeController } from '../../astronomy/time-controller';
import { createLocationProvider, type LocationProvider } from '../../platform/location/location-provider';
import { OrientationPipeline } from '../../sensors/sensor-fusion';
import { createSensorProvider } from '../../sensors/sensor-provider';
import type { SensorProvider } from '../../sensors/types';
import { OpenMeteoWeatherProvider } from '../../weather/open-meteo-provider';
import { WeatherService } from '../../weather/weather-service';

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
  /** Observing-conditions forecast (swap the provider here: paid plan, proxy, other source). */
  weather: WeatherService;
}

export function createPlatform(): Platform {
  return {
    sensors: createSensorProvider(),
    location: createLocationProvider(),
    orientation: new OrientationPipeline(),
    astronomy: astronomyService,
    time: timeController,
    weather: new WeatherService(new OpenMeteoWeatherProvider()),
  };
}
