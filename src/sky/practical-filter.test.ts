import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AstronomyService } from '../astronomy/astronomy.service';
import { applyMat3, raDecToVector } from '../astronomy/coordinate-transform';
import { skyLimitingMagnitude } from '../astronomy/naked-eye';
import { SOLAR_BODY_IDS, type Observer } from '../astronomy/types';
import { parseMessier } from '../catalog/messier/messier';
import { quat } from '../sensors/quaternion';
import { OrientationPipeline } from '../sensors/sensor-fusion';
import {
  computeMessierHidden,
  pointPassesFilter,
  worldAltitudeDeg,
  type PracticalFilterState,
} from './practical-filter';

const svc = new AstronomyService();
const observer: Observer = { latitude: 50.45, longitude: 30.52, elevation: 0 };

function celestialMatrix(date: Date): THREE.Matrix4 {
  const m = svc.getEqjToWorldMatrix(date, observer);
  return new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
}

const filter = (sunAltitude: number): PracticalFilterState => ({
  enabled: true,
  sunAltitude,
  skyLimit: skyLimitingMagnitude(sunAltitude),
  messierHidden: null,
  constellationsHidden: false,
});

describe('below-horizon objects in the rendered sky', () => {
  it('place every body below the horizon in the lower (ground) hemisphere, whatever the sensors do', () => {
    const date = new Date('2026-10-07T20:30:00Z');
    const m = svc.getEqjToWorldMatrix(date, observer);
    const pipeline = new OrientationPipeline('low');
    const out = quat();
    for (let t = 0; t < 2000; t += 50) {
      pipeline.ingest({
        alpha: (t / 10) % 360,
        beta: 120,
        gamma: 10,
        absolute: true,
        compassHeading: null,
        compassAccuracy: null,
        screenAngle: 0,
        timestamp: t,
      });
      pipeline.step(50, out);
    }
    let checked = 0;
    for (const id of SOLAR_BODY_IDS) {
      const p = svc.getBodyPosition(id, date, observer);
      if (p.horizontal.altitude > -1) continue; // skip refraction edge cases
      const world = applyMat3(m, raDecToVector(p.equatorialJ2000.ra * 15, p.equatorialJ2000.dec));
      // The world frame is gravity-aligned (+Y = zenith); sensors rotate only the camera.
      expect(world.y).toBeLessThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('agrees with the computed altitude', () => {
    const date = new Date('2026-10-07T20:30:00Z');
    const c = celestialMatrix(date);
    const p = svc.getBodyPosition('saturn', date, observer);
    const v = raDecToVector(p.equatorialJ2000.ra * 15, p.equatorialJ2000.dec);
    expect(Math.abs(worldAltitudeDeg(c, v.x, v.y, v.z) - p.horizontal.altitude)).toBeLessThan(0.6);
  });
});

describe('"Visible now" filter', () => {
  it('keeps bright high stars at night and drops them by day or below the horizon', () => {
    expect(pointPassesFilter(filter(-30), 1.0, 45)).toBe(true);
    expect(pointPassesFilter(filter(-30), 6.0, 45)).toBe(false); // only "difficult"
    expect(pointPassesFilter(filter(30), 1.0, 45)).toBe(false); // daylight
    expect(pointPassesFilter(filter(-30), 1.0, -3)).toBe(false); // below horizon
    expect(pointPassesFilter({ ...filter(30), enabled: false }, 6, -10)).toBe(true); // filter off
  });

  it('hides faint / low / below-horizon Messier objects', () => {
    const messier = parseMessier(
      JSON.parse(readFileSync(join(process.cwd(), 'public/catalogs/messier.json'), 'utf8')),
    );
    const eqj = new Float32Array(messier.length * 3);
    messier.forEach((m, i) => eqj.set(Object.values(raDecToVector(m.raDeg, m.decDeg)), i * 3));
    const date = new Date('2026-10-07T20:30:00Z'); // Kyiv, ~23:30 local, dark
    const c = celestialMatrix(date);
    const night = computeMessierHidden(messier, eqj, c, -40);
    const day = computeMessierHidden(messier, eqj, c, 30);
    const shown = messier.filter((_, i) => !night[i]).map((m) => m.designation);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(20); // most Messier objects are not naked-eye objects
    expect(shown).toContain('M45'); // Pleiades are up in October evenings
    expect([...day].every((h) => h === 1)).toBe(true);
    messier.forEach((_m, i) => {
      const alt = worldAltitudeDeg(c, eqj[i * 3], eqj[i * 3 + 1], eqj[i * 3 + 2]);
      if (alt < 0) expect(night[i]).toBe(1);
    });
  });
});
