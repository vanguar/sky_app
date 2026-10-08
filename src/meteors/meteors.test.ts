import { describe, expect, it } from 'vitest';
import { astronomyService } from '../astronomy/astronomy.service';
import { equatorialToHorizontal, localSiderealTime } from '../astronomy/coordinate-transform';
import { RESOURCES, LANGUAGES } from '../i18n/languages';
import type { ObservingConditionsResult } from '../weather/observing-conditions';
import { YEAR_DATA, occurrenceFor, showerActivity, typicalOccurrence } from './activity';
import { bestFromSlots, type MeteorSlot } from './best-time';
import { METEOR_SHOWERS, SHOWERS_BY_ID, showerFromObjectId } from './catalog';
import { radiantAt, radiantHorizontal } from './radiant';
import { radiantRenderItems } from './sky-items';
import { meteorObservability, type MeteorConditionsInput } from './visibility';

const per = SHOWERS_BY_ID.get('per')!;
const qua = SHOWERS_BY_ID.get('qua')!;
const gem = SHOWERS_BY_ID.get('gem')!;
const ori = SHOWERS_BY_ID.get('ori')!;
const kyiv = { latitude: 50.45, longitude: 30.52, elevation: 0 };

describe('meteor catalog', () => {
  it('contains the major visual showers with sane data', () => {
    for (const id of ['qua', 'lyr', 'eta', 'sda', 'per', 'dra', 'ori', 'leo', 'gem', 'urs']) {
      expect(SHOWERS_BY_ID.has(id), id).toBe(true);
    }
    expect(METEOR_SHOWERS.length).toBeGreaterThanOrEqual(15);
    expect(METEOR_SHOWERS.length).toBeLessThanOrEqual(30);
    for (const s of METEOR_SHOWERS) {
      expect(s.radiantRaDeg).toBeGreaterThanOrEqual(0);
      expect(s.radiantRaDeg).toBeLessThan(360);
      expect(Math.abs(s.radiantDecDeg)).toBeLessThanOrEqual(90);
      expect(s.speedKms).toBeGreaterThan(10);
      expect(s.speedKms).toBeLessThan(75);
      expect(s.code).toBe(s.id.toUpperCase());
    }
  });

  it('every shower has 2026 data and every year entry belongs to a shower', () => {
    const y = YEAR_DATA.get(2026)!;
    expect(Object.keys(y.showers).sort()).toEqual(METEOR_SHOWERS.map((s) => s.id).sort());
    for (const [id, e] of Object.entries(y.showers)) {
      const o = occurrenceFor(SHOWERS_BY_ID.get(id)!, 2026);
      expect(o.start, id).toBeLessThan(o.peak);
      expect(o.peak, id).toBeLessThan(o.end);
      expect(e.peakPrecision === 'hour' || e.peakPrecision === 'day').toBe(true);
    }
  });

  it('resolves object ids', () => {
    expect(showerFromObjectId('meteor-per')?.code).toBe('PER');
    expect(showerFromObjectId('meteor-xyz')).toBeNull();
    expect(showerFromObjectId('jupiter')).toBeNull();
  });
});

describe('meteor activity', () => {
  it('is active inside the activity window', () => {
    const a = showerActivity(per, Date.UTC(2026, 7, 1));
    expect(a.status).toBe('active');
    expect(a.occurrence.approximate).toBe(false);
  });

  it('is inactive outside the window', () => {
    expect(showerActivity(per, Date.UTC(2026, 2, 1)).status).toBe('inactive');
  });

  it('is upcoming shortly before the start', () => {
    const a = showerActivity(ori, Date.UTC(2026, 8, 28));
    expect(a.status).toBe('upcoming');
    expect(a.daysToStart).toBeCloseTo(4, 0);
  });

  it('distinguishes peak and near peak (no flat activity window)', () => {
    expect(showerActivity(gem, Date.UTC(2026, 11, 14, 14)).status).toBe('peak');
    expect(showerActivity(gem, Date.UTC(2026, 11, 12, 20)).status).toBe('nearPeak');
    expect(showerActivity(gem, Date.UTC(2026, 11, 6)).status).toBe('active');
  });

  it('handles the Quadrantids across the new year (Dec → Jan)', () => {
    // 2026 data: 2025-12-28 … 2026-01-12, peak Jan 3 21h UT.
    expect(showerActivity(qua, Date.UTC(2025, 11, 30)).status).toBe('active');
    expect(showerActivity(qua, Date.UTC(2026, 0, 3, 20)).status).toBe('peak');
    // Dec 2026 → Jan 2027 falls back to typical dates, flagged approximate.
    const lateDec = showerActivity(qua, Date.UTC(2026, 11, 30));
    expect(lateDec.status).toBe('active');
    expect(lateDec.occurrence.approximate).toBe(true);
    expect(new Date(lateDec.occurrence.peak).getUTCFullYear()).toBe(2027);
    expect(showerActivity(qua, Date.UTC(2027, 0, 5)).status).toBe('nearPeak');
    expect(showerActivity(qua, Date.UTC(2026, 11, 24)).status).toBe('upcoming');
    expect(showerActivity(qua, Date.UTC(2026, 0, 20)).status).toBe('inactive');
  });

  it('typical occurrences span the year boundary correctly', () => {
    const o = typicalOccurrence(qua, 2027);
    expect(new Date(o.start).toISOString().slice(0, 10)).toBe('2026-12-28');
    expect(new Date(o.end).toISOString().slice(0, 10)).toBe('2027-01-13');
  });

  it('shows only active / soon-active radiants on the map', () => {
    const items = radiantRenderItems(Date.UTC(2026, 9, 21, 0));
    const ids = items.map((i) => i.id);
    expect(ids).toContain('meteor-ori');
    expect(ids).not.toContain('meteor-per');
    expect(items.length).toBeLessThan(METEOR_SHOWERS.length);
  });
});

describe('radiant position', () => {
  it('drifts linearly and is the tabulated position at the peak', () => {
    const occ = showerActivity(per, Date.UTC(2026, 7, 13)).occurrence;
    expect(radiantAt(per, occ, occ.peak)).toEqual({ raDeg: 48, decDeg: 58 });
    const before = radiantAt(per, occ, occ.peak - 10 * 86_400_000);
    expect(before.raDeg).toBeCloseTo(48 - 13, 5);
  });

  it('altitude/azimuth agree with an independent RA/Dec → Alt/Az computation', () => {
    const t = Date.UTC(2026, 7, 13, 0, 0); // ~03:00 Kyiv summer time
    const occ = showerActivity(per, t).occurrence;
    const hor = radiantHorizontal(astronomyService, per, occ, t, kyiv);
    const r = radiantAt(per, occ, t);
    const ref = equatorialToHorizontal(r.raDeg / 15, r.decDeg, kyiv.latitude, localSiderealTime(new Date(t), kyiv.longitude));
    // Differences: precession J2000 → date and refraction (≪ 1°).
    expect(Math.abs(hor.altitude - ref.altitude)).toBeLessThan(1);
    expect(Math.abs(hor.azimuth - ref.azimuth)).toBeLessThan(1.5);
    expect(hor.altitude).toBeGreaterThan(40);
  });
});

const clear: ObservingConditionsResult = { score: 96, grade: 'excellent', reasons: ['clearSky'] };
const cloudy: ObservingConditionsResult = { score: 12, grade: 'bad', reasons: ['overcast'] };

function input(over: Partial<MeteorConditionsInput> = {}): MeteorConditionsInput {
  return {
    status: 'peak',
    zhr: 100,
    radiantAltitude: 60,
    sunAltitude: -30,
    moonAltitude: -20,
    moonIllumination: 0.1,
    moonSeparation: 120,
    weather: clear,
    ...over,
  };
}

describe('meteor observability', () => {
  it('radiant high + dark sky + Moon down + clear → excellent', () => {
    const r = meteorObservability(input());
    expect(r.grade).toBe('excellent');
    expect(r.reasons).toEqual(expect.arrayContaining(['atPeak', 'radiantHigh', 'moonDown', 'darkSky']));
  });

  it('radiant below the horizon → poor or bad', () => {
    const r = meteorObservability(input({ radiantAltitude: -5 }));
    expect(['poor', 'bad']).toContain(r.grade);
    expect(r.reasons[0]).toBe('radiantBelowHorizon');
  });

  it('a higher radiant scores better', () => {
    expect(meteorObservability(input({ radiantAltitude: 70 })).score).toBeGreaterThan(
      meteorObservability(input({ radiantAltitude: 20 })).score,
    );
  });

  it('a bright Moon above the horizon lowers the score', () => {
    const dark = meteorObservability(input());
    const moon = meteorObservability(input({ moonAltitude: 40, moonIllumination: 0.95, moonSeparation: 60 }));
    expect(moon.score).toBeLessThan(dark.score - 20);
    expect(moon.reasons).toContain('moonBright');
    expect(moon.moon).toBe('strong');
  });

  it('daylight → poor', () => {
    const r = meteorObservability(input({ sunAltitude: 20 }));
    expect(r.grade).toBe('bad');
    expect(r.reasons[0]).toBe('daylight');
  });

  it('clouds lower the score', () => {
    const r = meteorObservability(input({ weather: cloudy }));
    expect(r.score).toBeLessThan(meteorObservability(input()).score / 3);
    expect(r.reasons).toContain('overcast');
  });

  it('without weather the result still exists and is marked weatherUnknown', () => {
    const r = meteorObservability(input({ weather: null }));
    expect(r.weatherUnknown).toBe(true);
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons).toContain('weatherUnknown');
  });

  it('weak showers rate lower than strong ones in identical conditions', () => {
    expect(meteorObservability(input({ zhr: 5, status: 'active' })).score).toBeLessThan(
      meteorObservability(input({ zhr: 100, status: 'active' })).score,
    );
  });

  it('an inactive shower scores 0', () => {
    expect(meteorObservability(input({ status: 'inactive' }))).toMatchObject({ score: 0, reasons: ['notActive'] });
  });

  it('never returns a meteor count', () => {
    const r = meteorObservability(input()) as unknown as Record<string, unknown>;
    for (const key of Object.keys(r)) expect(key).not.toMatch(/rate|count|perHour|zhr/i);
  });
});

describe('best time tonight', () => {
  const step = 30 * 60_000;
  const t0 = Date.UTC(2026, 7, 12, 19);
  const scores = [5, 20, 40, 72, 85, 90, 88, 60, 30];
  const slots: MeteorSlot[] = scores.map((score, i) => ({
    time: t0 + i * step,
    score,
    radiantAltitude: 10 + i * 6,
    radiantAzimuth: 40,
    result: { ...meteorObservability(input()), score },
  }));

  it('returns the best continuous interval from a controlled fixture', () => {
    const plan = bestFromSlots(slots, step);
    // Threshold = 75 % of 90 = 68 → slots 3..6.
    expect(plan.window).toEqual({ start: t0 + 3 * step, end: t0 + 7 * step, score: 90, meanScore: 84 });
    expect(plan.best?.score).toBe(90);
    // Radiant passes 30° at slot 4 (10 + 4·6 = 34).
    expect(plan.radiantHighAfter).toBe(t0 + 4 * step);
  });

  it('reports no window on a poor night', () => {
    const poor = slots.map((s) => ({ ...s, score: Math.min(s.score, 20) }));
    expect(bestFromSlots(poor, step).window).toBeNull();
  });
});

describe('ZHR wording', () => {
  it('is always qualified, never presented as a personal hourly count', () => {
    for (const { code } of LANGUAGES) {
      const m = (RESOURCES[code] as unknown as { meteors: Record<string, string> }).meteors;
      expect(m.zhrValue, code).not.toBe('{{value}}');
      expect(m.zhrValue.length, code).toBeGreaterThan('{{value}}'.length + 8);
      expect(m.zhrExplain.length, code).toBeGreaterThan(80);
    }
    const en = (RESOURCES.en as unknown as { meteors: Record<string, unknown> }).meteors;
    expect(en.zhrValue).toMatch(/ideal conditions/);
    expect(JSON.stringify(en)).not.toMatch(/you will see \{\{/i);
  });
});
