import type { WeatherQueryLocation } from './types';

/**
 * Grid step (degrees) for coordinates sent to a weather provider. 0.05° ≈ 5.5 km in latitude —
 * finer than the forecast models' own resolution, coarse enough not to reveal an exact address.
 */
export const WEATHER_GRID_DEG = 0.05;

function roundTo(value: number, step: number): number {
  // Round to the grid, then strip floating-point noise (0.15000000000000002 → 0.15).
  return Number((Math.round(value / step) * step).toFixed(4));
}

/**
 * Converts the exact observer location into the coarse location that may leave the device.
 * Only latitude/longitude are kept — no elevation, accuracy, timestamps or ids.
 */
export function toWeatherQueryLocation(
  exact: { latitude: number; longitude: number },
  step = WEATHER_GRID_DEG,
): WeatherQueryLocation {
  const latitude = Math.max(-90, Math.min(90, roundTo(exact.latitude, step)));
  let longitude = roundTo(exact.longitude, step);
  if (longitude > 180) longitude -= 360;
  if (longitude <= -180) longitude += 360;
  return { latitude, longitude };
}

/** Cache key for a rounded location. */
export function weatherLocationKey(loc: WeatherQueryLocation): string {
  return `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
}
