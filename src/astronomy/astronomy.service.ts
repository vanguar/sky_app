/**
 * AstronomyService — the only module that talks to Astronomy Engine directly.
 * UI and rendering code depend on the plain types in ./types instead.
 */
import * as Astronomy from 'astronomy-engine';
import { AU_KM, BODY_RADIUS_KM, ENGINE_BODY } from './bodies';
import {
  RAD,
  horFrameToWorld,
  normalizeDegrees,
  transposeMat3,
  applyMat3,
  vectorToRaDec,
} from './coordinate-transform';
import { buildVisibility, riseSetLimits } from './visibility';
import type {
  EquatorialCoords,
  HorizontalCoords,
  Mat3,
  Observer,
  RiseSetInfo,
  SkyTarget,
  SolarBodyId,
  SolarBodyPosition,
  Vec3,
  Visibility,
} from './types';

const RISE_SET_WINDOW_DAYS = 1.2;

function toEngineObserver(o: Observer): Astronomy.Observer {
  return new Astronomy.Observer(o.latitude, o.longitude, o.elevation);
}

function safeTime(d: Astronomy.AstroTime | null | undefined): Date | null {
  return d ? d.date : null;
}

export class AstronomyService {
  /** Full position information for the Sun, Moon or a planet. */
  getBodyPosition(id: SolarBodyId, date: Date, observer: Observer): SolarBodyPosition {
    const body = ENGINE_BODY[id];
    const obs = toEngineObserver(observer);
    const eqj = Astronomy.Equator(body, date, obs, false, true);
    const eqd = Astronomy.Equator(body, date, obs, true, true);
    const hor = Astronomy.Horizon(date, obs, eqd.ra, eqd.dec, 'normal');
    let magnitude: number | null = null;
    let illuminatedFraction: number | null = null;
    try {
      const ill = Astronomy.Illumination(body, date);
      magnitude = ill.mag;
      illuminatedFraction = id === 'sun' ? null : ill.phase_fraction;
    } catch {
      // Illumination is undefined for some bodies; leave as null.
    }
    const distanceKm = eqd.dist * AU_KM;
    const angularDiameterArcsec = 2 * Math.atan(BODY_RADIUS_KM[id] / distanceKm) * RAD * 3600;
    return {
      id,
      equatorialJ2000: { ra: eqj.ra, dec: eqj.dec },
      equatorialOfDate: { ra: eqd.ra, dec: eqd.dec },
      horizontal: { altitude: hor.altitude, azimuth: normalizeDegrees(hor.azimuth) },
      distanceAu: eqd.dist,
      distanceKm,
      magnitude,
      illuminatedFraction,
      angularDiameterArcsec,
    };
  }

  getSunPosition(date: Date, observer: Observer): SolarBodyPosition {
    return this.getBodyPosition('sun', date, observer);
  }

  getMoonPosition(date: Date, observer: Observer): SolarBodyPosition {
    return this.getBodyPosition('moon', date, observer);
  }

  getPlanetPosition(
    body: Exclude<SolarBodyId, 'sun' | 'moon'>,
    date: Date,
    observer: Observer,
  ): SolarBodyPosition {
    return this.getBodyPosition(body, date, observer);
  }

  /** Moon phase angle in degrees: 0 = new, 90 = first quarter, 180 = full, 270 = last quarter. */
  getMoonPhaseAngle(date: Date): number {
    return Astronomy.MoonPhase(date);
  }

  /**
   * Rotation matrix taking J2000 equatorial unit vectors (EQJ) to the AstroPoint world frame
   * (x = east, y = up, −z = north) for this time and place. Includes precession, nutation and
   * Earth rotation; excludes refraction.
   */
  getEqjToWorldMatrix(date: Date, observer: Observer): Mat3 {
    const time = Astronomy.MakeTime(date);
    const rot = Astronomy.Rotation_EQJ_HOR(time, toEngineObserver(observer));
    const cols: Vec3[] = [];
    for (const [x, y, z] of [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]) {
      const v = Astronomy.RotateVector(rot, new Astronomy.Vector(x, y, z, time));
      cols.push(horFrameToWorld({ x: v.x, y: v.y, z: v.z }));
    }
    return [
      cols[0].x,
      cols[1].x,
      cols[2].x,
      cols[0].y,
      cols[1].y,
      cols[2].y,
      cols[0].z,
      cols[1].z,
      cols[2].z,
    ];
  }

  /** Horizontal coordinates (with refraction) of a J2000 fixed position. */
  getHorizontalFromJ2000(raHours: number, decDeg: number, date: Date, observer: Observer): HorizontalCoords {
    const time = Astronomy.MakeTime(date);
    const rot = Astronomy.Rotation_EQJ_HOR(time, toEngineObserver(observer));
    const sphere = new Astronomy.Spherical(decDeg, raHours * 15, 1);
    const vec = Astronomy.RotateVector(rot, Astronomy.VectorFromSphere(sphere, time));
    const hor = Astronomy.HorizonFromVector(vec, 'normal');
    return { altitude: hor.lat, azimuth: normalizeDegrees(hor.lon) };
  }

  /** Horizontal coordinates for any target. */
  getHorizontalCoordinates(target: SkyTarget, date: Date, observer: Observer): HorizontalCoords {
    if (target.kind === 'body') return this.getBodyPosition(target.body, date, observer).horizontal;
    return this.getHorizontalFromJ2000(target.raHours, target.decDeg, date, observer);
  }

  /** J2000 equatorial coordinates for any target (topocentric for solar-system bodies). */
  getEquatorialJ2000(target: SkyTarget, date: Date, observer: Observer): EquatorialCoords {
    if (target.kind === 'body') return this.getBodyPosition(target.body, date, observer).equatorialJ2000;
    return { ra: target.raHours, dec: target.decDeg };
  }

  getVisibility(target: SkyTarget, date: Date, observer: Observer): Visibility {
    const hor = this.getHorizontalCoordinates(target, date, observer);
    const dec =
      target.kind === 'fixed'
        ? target.decDeg
        : this.getBodyPosition(target.body, date, observer).equatorialOfDate.dec;
    return buildVisibility(hor.altitude, hor.azimuth, riseSetLimits(dec, observer.latitude));
  }

  /** Next rise, set and upper transit after `date` (within ~1 day). */
  getRiseSet(target: SkyTarget, date: Date, observer: Observer): RiseSetInfo {
    const obs = toEngineObserver(observer);
    let body: Astronomy.Body;
    let limits: { alwaysUp: boolean; neverUp: boolean };
    if (target.kind === 'body') {
      body = ENGINE_BODY[target.body];
      const dec = this.getBodyPosition(target.body, date, observer).equatorialOfDate.dec;
      limits = riseSetLimits(dec, observer.latitude);
    } else {
      body = Astronomy.Body.Star1;
      Astronomy.DefineStar(body, target.raHours, target.decDeg, 1000);
      limits = riseSetLimits(target.decDeg, observer.latitude);
    }
    try {
      const rise = Astronomy.SearchRiseSet(body, obs, +1, date, RISE_SET_WINDOW_DAYS);
      const set = Astronomy.SearchRiseSet(body, obs, -1, date, RISE_SET_WINDOW_DAYS);
      const transit = Astronomy.SearchHourAngle(body, obs, 0, date, +1);
      const noEvents = !rise && !set;
      return {
        rise: safeTime(rise),
        set: safeTime(set),
        transit: transit ? transit.time.date : null,
        alwaysUp:
          limits.alwaysUp || (noEvents && target.kind === 'body' && this.isUp(target, date, observer)),
        neverUp: limits.neverUp || (noEvents && target.kind === 'body' && !this.isUp(target, date, observer)),
      };
    } catch {
      return { rise: null, set: null, transit: null, ...limits };
    }
  }

  /** Constellation (IAU 3-letter symbol) containing a J2000 position. */
  getConstellationAt(raHours: number, decDeg: number): string {
    return Astronomy.Constellation(raHours, decDeg).symbol;
  }

  /** Converts a world-frame direction back to J2000 RA/Dec using a matrix from {@link getEqjToWorldMatrix}. */
  worldToJ2000(world: Vec3, eqjToWorld: Mat3): EquatorialCoords {
    return vectorToRaDec(applyMat3(transposeMat3(eqjToWorld), world));
  }

  private isUp(target: SkyTarget, date: Date, observer: Observer): boolean {
    return this.getHorizontalCoordinates(target, date, observer).altitude > 0;
  }
}

/** Shared default instance (stateless apart from Astronomy Engine's user-defined star slot). */
export const astronomyService = new AstronomyService();
