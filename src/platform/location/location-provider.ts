export type LocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

export interface GeoFix {
  latitude: number;
  longitude: number;
  elevation: number;
  accuracyM: number | null;
}

export class LocationError extends Error {
  constructor(public readonly code: LocationErrorCode) {
    super(code);
    this.name = 'LocationError';
  }
}

/**
 * Platform abstraction for one-shot positioning. BrowserLocationProvider is used today;
 * a CapacitorLocationProvider (@capacitor/geolocation) can implement the same interface later.
 */
export interface LocationProvider {
  isSupported(): boolean;
  getCurrentPosition(): Promise<GeoFix>;
}

export class BrowserLocationProvider implements LocationProvider {
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  getCurrentPosition(): Promise<GeoFix> {
    if (!this.isSupported()) return Promise.reject(new LocationError('unsupported'));
    if (typeof window !== 'undefined' && !window.isSecureContext)
      return Promise.reject(new LocationError('insecure'));
    return new Promise<GeoFix>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            elevation: pos.coords.altitude ?? 0,
            accuracyM: pos.coords.accuracy ?? null,
          }),
        (err) => {
          const code: LocationErrorCode =
            err.code === err.PERMISSION_DENIED
              ? 'denied'
              : err.code === err.TIMEOUT
                ? 'timeout'
                : 'unavailable';
          reject(new LocationError(code));
        },
        // Approximate location is enough for the sky; prefer speed and battery.
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
      );
    });
  }
}

export function createLocationProvider(): LocationProvider {
  return new BrowserLocationProvider();
}
