import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  angularSeparation,
  azimuthToCompassPoint,
  eclipticToEquatorialVector,
  equatorialToHorizontal,
  greenwichMeanSiderealTime,
  horFrameToWorld,
  horizontalToEquatorial,
  horizontalToVector,
  julianDate,
  localSiderealTime,
  raDecToVector,
  vectorToHorizontal,
  vectorToRaDec,
} from './coordinate-transform';

describe('time scales', () => {
  it('computes the Julian date of the J2000 epoch', () => {
    expect(julianDate(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(2451545.0, 6);
  });

  it('computes GMST at J2000.0', () => {
    expect(greenwichMeanSiderealTime(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(280.46061837, 5);
  });

  it('matches Meeus example 12.a (GMST 1987-04-10 0h UT = 13h10m46.3668s)', () => {
    const gmst = greenwichMeanSiderealTime(new Date('1987-04-10T00:00:00Z'));
    const expected = (13 + 10 / 60 + 46.3668 / 3600) * 15;
    expect(gmst).toBeCloseTo(expected, 4);
  });

  it('adds east longitude to get local sidereal time', () => {
    const d = new Date('2024-01-01T00:00:00Z');
    expect(localSiderealTime(d, 30) - greenwichMeanSiderealTime(d)).toBeCloseTo(30, 9);
  });
});

describe('equatorial ↔ horizontal', () => {
  it('reproduces Meeus example 13.b (Venus from Washington, 1987-04-10 19:21 UT)', () => {
    const ra = (23 + 9 / 60 + 16.641 / 3600) * 1; // hours
    const dec = -(6 + 43 / 60 + 11.61 / 3600);
    const lat = 38 + 55 / 60 + 17 / 3600;
    // Apparent sidereal time at Greenwich 8h34m56.853s, longitude 77°03'56" W.
    const gast = (8 + 34 / 60 + 56.853 / 3600) * 15;
    const lst = gast - (77 + 3 / 60 + 56 / 3600);
    const hor = equatorialToHorizontal(ra, dec, lat, lst);
    expect(hor.altitude).toBeCloseTo(15.1249, 3);
    // Meeus measures azimuth from the south: 68.0337° → 248.0337° from north.
    expect(hor.azimuth).toBeCloseTo(248.0337, 3);
  });

  it('places the celestial pole at altitude = latitude, due north', () => {
    const hor = equatorialToHorizontal(0, 90, 51.5, 123);
    expect(hor.altitude).toBeCloseTo(51.5, 9);
    expect(Math.min(hor.azimuth, 360 - hor.azimuth)).toBeCloseTo(0, 6);
  });

  it('puts an object on the meridian due south when it transits south of the zenith', () => {
    const lst = 100;
    const hor = equatorialToHorizontal(lst / 15, 10, 50, lst);
    expect(hor.azimuth).toBeCloseTo(180, 6);
    expect(hor.altitude).toBeCloseTo(50, 6); // 90 − 50 + 10
  });

  it('round-trips horizontal → equatorial → horizontal', () => {
    for (const [alt, az] of [
      [10, 20],
      [45, 135],
      [-30, 250],
      [80, 359],
    ]) {
      const eq = horizontalToEquatorial(alt, az, 48.2, 211.3);
      const back = equatorialToHorizontal(eq.ra, eq.dec, 48.2, 211.3);
      expect(back.altitude).toBeCloseTo(alt, 8);
      expect(angleDelta(back.azimuth, az)).toBeCloseTo(0, 8);
    }
  });
});

describe('vectors', () => {
  it('maps compass directions into the world frame (x east, y up, −z north)', () => {
    const north = horizontalToVector(0, 0);
    expect(north.z).toBeCloseTo(-1);
    const east = horizontalToVector(0, 90);
    expect(east.x).toBeCloseTo(1);
    const zenith = horizontalToVector(90, 0);
    expect(zenith.y).toBeCloseTo(1);
  });

  it('round-trips horizontal coordinates through vectors', () => {
    const v = horizontalToVector(33.3, 212.1);
    const h = vectorToHorizontal(v);
    expect(h.altitude).toBeCloseTo(33.3, 9);
    expect(h.azimuth).toBeCloseTo(212.1, 9);
  });

  it('round-trips RA/Dec through vectors', () => {
    const v = raDecToVector(101.2871, -16.7161);
    const eq = vectorToRaDec(v);
    expect(eq.ra * 15).toBeCloseTo(101.2871, 8);
    expect(eq.dec).toBeCloseTo(-16.7161, 8);
  });

  it('converts Astronomy Engine HOR frame (north, west, zenith) to world', () => {
    const w = horFrameToWorld({ x: 0, y: 1, z: 0 }); // west
    expect(w.x).toBeCloseTo(-1);
    const n = horFrameToWorld({ x: 1, y: 0, z: 0 });
    expect(n.z).toBeCloseTo(-1);
  });

  it('measures angular separation', () => {
    expect(angularSeparation(horizontalToVector(0, 0), horizontalToVector(0, 90))).toBeCloseTo(90, 9);
    expect(angularSeparation(horizontalToVector(10, 10), horizontalToVector(10.001, 10))).toBeCloseTo(
      0.001,
      6,
    );
  });

  it('puts the ecliptic north pole at RA 18h, Dec +66.56°', () => {
    const pole = vectorToRaDec(eclipticToEquatorialVector(0, 90));
    expect(pole.ra).toBeCloseTo(18, 6);
    expect(pole.dec).toBeCloseTo(66.5607, 3);
  });
});

describe('helpers', () => {
  it('computes signed angle deltas', () => {
    expect(angleDelta(350, 10)).toBeCloseTo(20);
    expect(angleDelta(10, 350)).toBeCloseTo(-20);
  });

  it('names compass points', () => {
    expect(azimuthToCompassPoint(0)).toBe('N');
    expect(azimuthToCompassPoint(359)).toBe('N');
    expect(azimuthToCompassPoint(91)).toBe('E');
    expect(azimuthToCompassPoint(225)).toBe('SW');
  });
});
