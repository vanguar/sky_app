import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { magneticDeclination, magneticField } from './geomagnetism';

// Official NOAA/BGS WMM2025 test values: year, alt(km), lat, lon, D, I, H, X, Y, Z, F, …
const rows = readFileSync(join(process.cwd(), 'data/source/wmm/WMM2025_TestValues.txt'), 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => l.trim().split(/\s+/).map(Number));

describe('World Magnetic Model 2025', () => {
  it('has the official test vectors', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10);
  });

  for (const [year, alt, lat, lon, d, inc, , x, y, z] of rows) {
    it(`matches NOAA test point ${lat}°, ${lon}°, ${alt} km, ${year}`, () => {
      const f = magneticField(lat, lon, alt, year);
      expect(Math.abs(f.declination - d)).toBeLessThan(0.01);
      expect(Math.abs(f.inclination - inc)).toBeLessThan(0.01);
      expect(Math.abs(f.x - x)).toBeLessThan(1);
      expect(Math.abs(f.y - y)).toBeLessThan(1);
      expect(Math.abs(f.z - z)).toBeLessThan(1);
    });
  }

  it('gives a plausible eastward declination for Kyiv in 2026', () => {
    const d = magneticDeclination(50.45, 30.52, 170, new Date('2026-10-07T00:00:00Z'));
    expect(d).toBeGreaterThan(7);
    expect(d).toBeLessThan(10);
  });
});
