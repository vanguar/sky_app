import { describe, expect, it } from 'vitest';
import { AstronomyService } from './astronomy.service';
import { applyMat3, raDecToVector, vectorToHorizontal } from './coordinate-transform';
import { daylightFactor, riseSetLimits, skyLightFromSunAltitude } from './visibility';
import { moonPhaseName } from './moon';
import { TimeController } from './time-controller';
import type { Observer } from './types';

const svc = new AstronomyService();
const berlin: Observer = { latitude: 52.52, longitude: 13.405, elevation: 34 };
const SIRIUS = { raHours: 101.2871553 / 15, decDeg: -16.7161159 };
const POLARIS = { raHours: 37.9545607 / 15, decDeg: 89.2641094 };

describe('AstronomyService — solar system', () => {
  it('returns the Sun near RA 0h / Dec 0° at the March 2024 equinox', () => {
    const p = svc.getSunPosition(new Date('2024-03-20T03:06:00Z'), berlin);
    expect(Math.min(p.equatorialOfDate.ra, 24 - p.equatorialOfDate.ra)).toBeLessThan(0.01);
    expect(Math.abs(p.equatorialOfDate.dec)).toBeLessThan(0.05);
    expect(p.distanceAu).toBeGreaterThan(0.99);
    expect(p.distanceAu).toBeLessThan(1.0);
  });

  it('puts the Sun high in the south at local noon in Berlin in summer', () => {
    // Solar noon in Berlin ≈ 11:08 UTC around the June solstice.
    const p = svc.getSunPosition(new Date('2024-06-21T11:08:00Z'), berlin);
    expect(p.horizontal.altitude).toBeGreaterThan(60);
    expect(p.horizontal.altitude).toBeLessThan(61.5);
    expect(Math.abs(p.horizontal.azimuth - 180)).toBeLessThan(3);
  });

  it('keeps the Moon between perigee and apogee distance', () => {
    const p = svc.getMoonPosition(new Date('2025-01-01T00:00:00Z'), berlin);
    expect(p.distanceKm).toBeGreaterThan(355000);
    expect(p.distanceKm).toBeLessThan(407500);
    expect(p.angularDiameterArcsec / 60).toBeGreaterThan(29);
    expect(p.angularDiameterArcsec / 60).toBeLessThan(34);
  });

  it('reports a full Moon near the 2024-04-23 full moon', () => {
    const date = new Date('2024-04-23T23:49:00Z');
    expect(moonPhaseName(svc.getMoonPhaseAngle(date))).toBe('full');
    expect(svc.getMoonPosition(date, berlin).illuminatedFraction).toBeGreaterThan(0.99);
  });

  it('computes plausible Jupiter distances and magnitude', () => {
    const p = svc.getPlanetPosition('jupiter', new Date('2024-12-07T00:00:00Z'), berlin);
    // Jupiter opposition 2024-12-07: ~4.08 AU, mag ≈ −2.8
    expect(p.distanceAu).toBeGreaterThan(4.0);
    expect(p.distanceAu).toBeLessThan(4.2);
    expect(p.magnitude).not.toBeNull();
    expect(p.magnitude!).toBeLessThan(-2.5);
  });

  it('finds sunrise in the east and sunset in the west on the equinox', () => {
    const eq: Observer = { latitude: 0, longitude: 0, elevation: 0 };
    const start = new Date('2024-03-20T00:00:00Z');
    const rs = svc.getRiseSet({ kind: 'body', body: 'sun' }, start, eq);
    expect(rs.rise).not.toBeNull();
    expect(rs.set).not.toBeNull();
    const riseAz = svc.getSunPosition(rs.rise!, eq).horizontal.azimuth;
    const setAz = svc.getSunPosition(rs.set!, eq).horizontal.azimuth;
    expect(Math.abs(riseAz - 90)).toBeLessThan(1);
    expect(Math.abs(setAz - 270)).toBeLessThan(1);
    // Sunrise at 0° longitude on the equinox is around 06:04 UTC.
    expect(rs.rise!.getUTCHours()).toBe(6);
  });

  it('detects the midnight sun above the Arctic Circle', () => {
    const tromso: Observer = { latitude: 69.65, longitude: 18.96, elevation: 0 };
    const rs = svc.getRiseSet({ kind: 'body', body: 'sun' }, new Date('2024-06-21T00:00:00Z'), tromso);
    expect(rs.alwaysUp).toBe(true);
    expect(rs.neverUp).toBe(false);
  });
});

describe('AstronomyService — fixed stars', () => {
  it('agrees between the EQJ→world matrix and the direct horizon calculation', () => {
    const date = new Date('2025-02-01T21:00:00Z');
    const m = svc.getEqjToWorldMatrix(date, berlin);
    const world = applyMat3(m, raDecToVector(SIRIUS.raHours * 15, SIRIUS.decDeg));
    const viaMatrix = vectorToHorizontal(world);
    const direct = svc.getHorizontalFromJ2000(SIRIUS.raHours, SIRIUS.decDeg, date, berlin);
    // Direct includes refraction (a few arcminutes at low altitude).
    expect(Math.abs(viaMatrix.altitude - direct.altitude)).toBeLessThan(0.1);
    expect(Math.abs(viaMatrix.azimuth - direct.azimuth)).toBeLessThan(0.05);
  });

  it('places Polaris at altitude ≈ latitude, due north', () => {
    const hor = svc.getHorizontalFromJ2000(
      POLARIS.raHours,
      POLARIS.decDeg,
      new Date('2025-06-01T00:00:00Z'),
      berlin,
    );
    expect(Math.abs(hor.altitude - berlin.latitude)).toBeLessThan(1.1);
    expect(Math.min(hor.azimuth, 360 - hor.azimuth)).toBeLessThan(1.5);
  });

  it('classifies Polaris as circumpolar from Berlin and invisible from Sydney', () => {
    const fromBerlin = svc.getVisibility(
      { kind: 'fixed', ...POLARIS },
      new Date('2025-06-01T00:00:00Z'),
      berlin,
    );
    expect(fromBerlin.alwaysUp).toBe(true);
    expect(fromBerlin.aboveHorizon).toBe(true);
    const sydney: Observer = { latitude: -33.87, longitude: 151.21, elevation: 0 };
    const fromSydney = svc.getVisibility(
      { kind: 'fixed', ...POLARIS },
      new Date('2025-06-01T00:00:00Z'),
      sydney,
    );
    expect(fromSydney.neverUp).toBe(true);
    expect(fromSydney.aboveHorizon).toBe(false);
  });

  it('finds rise and set times for Sirius from Berlin', () => {
    const rs = svc.getRiseSet({ kind: 'fixed', ...SIRIUS }, new Date('2025-01-15T12:00:00Z'), berlin);
    expect(rs.rise).not.toBeNull();
    expect(rs.set).not.toBeNull();
    expect(rs.transit).not.toBeNull();
    const altAtTransit = svc.getHorizontalFromJ2000(
      SIRIUS.raHours,
      SIRIUS.decDeg,
      rs.transit!,
      berlin,
    ).altitude;
    // 90 − 52.52 − 16.72 ≈ 20.8°
    expect(altAtTransit).toBeGreaterThan(20);
    expect(altAtTransit).toBeLessThan(21.5);
  });

  it('identifies constellations', () => {
    expect(svc.getConstellationAt(SIRIUS.raHours, SIRIUS.decDeg)).toBe('CMa');
    expect(svc.getConstellationAt(0.712, 41.27)).toBe('And'); // M31
  });
});

describe('visibility helpers', () => {
  it('computes circumpolar limits', () => {
    expect(riseSetLimits(80, 50).alwaysUp).toBe(true);
    expect(riseSetLimits(-60, 50).neverUp).toBe(true);
    const ok = riseSetLimits(0, 50);
    expect(ok.alwaysUp || ok.neverUp).toBe(false);
  });

  it('classifies sky light', () => {
    expect(skyLightFromSunAltitude(10)).toBe('day');
    expect(skyLightFromSunAltitude(-3)).toBe('civilTwilight');
    expect(skyLightFromSunAltitude(-25)).toBe('night');
    expect(daylightFactor(-20)).toBe(0);
    expect(daylightFactor(20)).toBe(1);
  });
});

describe('TimeController', () => {
  it('follows the clock in live mode and supports time travel', () => {
    let t = 1_000_000;
    const tc = new TimeController(() => t);
    expect(tc.nowMs()).toBe(1_000_000);
    t += 5000;
    expect(tc.nowMs()).toBe(1_005_000);
    expect(tc.isLive()).toBe(true);
    tc.setTime(new Date(0));
    t += 1000;
    expect(tc.nowMs()).toBe(1000);
    expect(tc.isLive()).toBe(false);
    tc.setRate(60);
    t += 1000;
    expect(tc.nowMs()).toBe(61000);
    tc.resetToNow();
    expect(tc.nowMs()).toBe(t);
    expect(tc.isLive()).toBe(true);
  });

  it('notifies subscribers', () => {
    const tc = new TimeController(() => 0);
    const seen: number[] = [];
    const off = tc.subscribe((d) => seen.push(d.getTime()));
    tc.setTime(new Date(42));
    off();
    tc.setTime(new Date(43));
    expect(seen).toEqual([42]);
  });
});
