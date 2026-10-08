/**
 * Activity status of a shower at a given instant.
 *
 * Deliberately simple and explicit (no invented ZHR curve):
 *   peak      within ±12 h of a maximum known to the hour (±24 h when only the date is known)
 *   nearPeak  within ±2 days of the maximum (±1 day for short showers, window ≤ 10 days)
 *   active    elsewhere inside the activity window
 *   upcoming  activity starts within the next 7 days
 *   inactive  otherwise
 *
 * Year-specific data (src/meteors/data/<year>.json) are preferred; a year without data falls back
 * to the typical dates of the definition and is flagged `approximate`. Adding 2027 only requires a
 * new JSON file registered in {@link YEAR_DATA}.
 */
import year2026 from './data/2026.json';
import type {
  ActivityStatus,
  MeteorShowerDefinition,
  MeteorShowerYearData,
  ShowerActivity,
  ShowerOccurrence,
} from './types';

const DAY = 86_400_000;
export const UPCOMING_DAYS = 7;

export const YEAR_DATA: ReadonlyMap<number, MeteorShowerYearData> = new Map(
  [year2026 as MeteorShowerYearData].map((d) => [d.year, d]),
);

function mmdd(s: string): { m: number; d: number } {
  const [m, d] = s.split('-').map(Number);
  return { m, d };
}

/** Typical occurrence whose maximum falls in `year` (handles windows crossing New Year). */
export function typicalOccurrence(def: MeteorShowerDefinition, year: number): ShowerOccurrence {
  const p = mmdd(def.typicalPeak);
  const s = mmdd(def.typicalStart);
  const e = mmdd(def.typicalEnd);
  const order = (x: { m: number; d: number }) => x.m * 100 + x.d;
  const startYear = order(s) > order(p) ? year - 1 : year;
  const endYear = order(e) < order(p) ? year + 1 : year;
  return {
    start: Date.UTC(startYear, s.m - 1, s.d),
    end: Date.UTC(endYear, e.m - 1, e.d) + DAY,
    peak: Date.UTC(year, p.m - 1, p.d, 12),
    peakPrecision: 'day',
    zhr: def.typicalZhr,
    approximate: true,
  };
}

/** Occurrence with its maximum in `year`: verified year data if available, typical dates otherwise. */
export function occurrenceFor(
  def: MeteorShowerDefinition,
  year: number,
  data: ReadonlyMap<number, MeteorShowerYearData> = YEAR_DATA,
): ShowerOccurrence {
  const entry = data.get(year)?.showers[def.id];
  if (!entry) return typicalOccurrence(def, year);
  return {
    start: Date.parse(`${entry.start}T00:00:00Z`),
    end: Date.parse(`${entry.end}T00:00:00Z`) + DAY,
    peak: Date.parse(entry.peak),
    peakPrecision: entry.peakPrecision,
    zhr: entry.zhr,
    approximate: false,
  };
}

function statusInside(occ: ShowerOccurrence, t: number): ActivityStatus {
  const dist = Math.abs(t - occ.peak);
  const peakHalf = occ.peakPrecision === 'hour' ? 12 * 3600_000 : DAY;
  if (dist <= peakHalf) return 'peak';
  const short = occ.end - occ.start <= 10 * DAY;
  if (dist <= (short ? 1 : 2) * DAY) return 'nearPeak';
  return 'active';
}

export function showerActivity(
  def: MeteorShowerDefinition,
  t: number,
  data: ReadonlyMap<number, MeteorShowerYearData> = YEAR_DATA,
): ShowerActivity {
  const y = new Date(t).getUTCFullYear();
  const occurrences = [y - 1, y, y + 1].map((yr) => occurrenceFor(def, yr, data));
  const current = occurrences.find((o) => t >= o.start && t < o.end);
  if (current) {
    return {
      status: statusInside(current, t),
      occurrence: current,
      daysToPeak: (current.peak - t) / DAY,
      daysToStart: null,
    };
  }
  const next = occurrences.filter((o) => o.start > t).sort((a, b) => a.start - b.start)[0];
  const daysToStart = (next.start - t) / DAY;
  return {
    status: daysToStart <= UPCOMING_DAYS ? 'upcoming' : 'inactive',
    occurrence: next,
    daysToPeak: (next.peak - t) / DAY,
    daysToStart,
  };
}

export const isActiveStatus = (s: ActivityStatus): boolean =>
  s === 'active' || s === 'nearPeak' || s === 'peak';

/**
 * Relative activity weight used by the observing score — NOT a rate. Peak 1, near peak 0.7,
 * rest of the window 0.35, otherwise 0.
 */
export function activityWeight(status: ActivityStatus): number {
  switch (status) {
    case 'peak':
      return 1;
    case 'nearPeak':
      return 0.7;
    case 'active':
      return 0.35;
    default:
      return 0;
  }
}
