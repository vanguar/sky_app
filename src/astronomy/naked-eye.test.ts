import { describe, expect, it } from 'vitest';
import { airmass, practicalVisibility, skyLimitingMagnitude } from './naked-eye';

const NIGHT = -30;
const DAY = 35;

describe('practical naked-eye visibility', () => {
  it('bright planet at altitude 40° at night → visible', () => {
    const v = practicalVisibility({ altitude: 40, magnitude: -2.5, sunAltitude: NIGHT });
    expect(v.status).toBe('visible');
  });

  it('bright planet at altitude 2° → difficult (horizon), not "visible"', () => {
    const v = practicalVisibility({ altitude: 2, magnitude: -2.5, sunAltitude: NIGHT });
    expect(['difficult', 'notPractical']).toContain(v.status);
    expect(v.reason).toBe('lowAltitude');
  });

  it('magnitude +6 star under generic (city-like) skies → difficult', () => {
    const v = practicalVisibility({ altitude: 60, magnitude: 6, sunAltitude: NIGHT });
    expect(v.status).toBe('difficult');
    expect(v.reason).toBe('faint');
  });

  it('planet above the horizon in daylight → not practically visible', () => {
    const v = practicalVisibility({ altitude: 40, magnitude: -2.5, sunAltitude: DAY });
    expect(v.status).toBe('notPractical');
    expect(v.reason).toBe('daylight');
  });

  it('object below the horizon → below horizon', () => {
    const v = practicalVisibility({ altitude: -5, magnitude: -2.5, sunAltitude: NIGHT });
    expect(v.status).toBe('belowHorizon');
  });

  it('the Moon is visible in daylight, Venus only barely', () => {
    expect(
      practicalVisibility({ altitude: 30, magnitude: -11, sunAltitude: DAY, objectClass: 'moon' }).status,
    ).toBe('visible');
    expect(practicalVisibility({ altitude: 40, magnitude: -4.6, sunAltitude: DAY }).status).toBe('difficult');
  });

  it('bright twilight hides faint stars but not bright planets', () => {
    expect(practicalVisibility({ altitude: 30, magnitude: 4, sunAltitude: -4 }).status).toBe('notPractical');
    expect(practicalVisibility({ altitude: 30, magnitude: 4, sunAltitude: -4 }).reason).toBe('twilight');
    expect(practicalVisibility({ altitude: 30, magnitude: -2.5, sunAltitude: -4 }).status).toBe('visible');
  });

  it('diffuse objects are harder than their magnitude suggests', () => {
    const point = practicalVisibility({ altitude: 60, magnitude: 4.0, sunAltitude: NIGHT });
    const galaxy = practicalVisibility({
      altitude: 60,
      magnitude: 4.0,
      sunAltitude: NIGHT,
      objectClass: 'diffuse',
    });
    expect(point.status).toBe('visible');
    expect(galaxy.status).toBe('difficult');
  });

  it('never claims "visible" for unknown brightness', () => {
    expect(practicalVisibility({ altitude: 50, magnitude: null, sunAltitude: NIGHT }).status).toBe(
      'difficult',
    );
  });

  it('uses physically sensible airmass and sky limits', () => {
    expect(airmass(90)).toBeCloseTo(1, 2);
    expect(airmass(30)).toBeCloseTo(2, 1);
    expect(airmass(0)).toBeGreaterThan(30);
    expect(skyLimitingMagnitude(-30)).toBeGreaterThan(skyLimitingMagnitude(-8));
    expect(skyLimitingMagnitude(-8)).toBeGreaterThan(skyLimitingMagnitude(20));
  });
});
