/**
 * Meteor showers are not point objects: the central notion is the RADIANT, the point on the sky
 * from which the meteor trails appear to diverge. Data are split into
 *  - {@link MeteorShowerDefinition}: stable properties (radiant, speed, parent, typical dates);
 *  - {@link MeteorShowerYearData}: per-year activity window, peak time and ZHR (they change).
 */

/** "MM-DD" */
export type MonthDay = `${number}${number}-${number}${number}`;

export interface MeteorShowerDefinition {
  /** Lower-case IAU code, e.g. "per". Also used in ids: "meteor-per". */
  id: string;
  /** IAU three-letter code, e.g. "PER". */
  code: string;
  /** IAU MDC number. */
  iauNumber: number;
  /** Typical activity window (used when no year data is available). */
  typicalStart: MonthDay;
  typicalEnd: MonthDay;
  typicalPeak: MonthDay;
  /** Solar longitude of the maximum, J2000, degrees. */
  peakSolarLongitude: number;
  /** Radiant at maximum, J2000, degrees. */
  radiantRaDeg: number;
  radiantDecDeg: number;
  /** Approximate daily radiant drift (degrees/day), linearised from IMO Table 6. */
  driftRaDegPerDay: number;
  driftDecDegPerDay: number;
  /** Geocentric (atmospheric entry) speed, km/s. */
  speedKms: number;
  /** Typical maximum ZHR; null = variable / not reliably defined. */
  typicalZhr: number | null;
  /** IAU constellation abbreviation containing the radiant. */
  constellation: string;
  /** Parent body when reliably established; null otherwise. */
  parentBody: string | null;
  /** True for the major annual showers that get a description and priority in lists. */
  major: boolean;
}

export type PeakPrecision = 'hour' | 'day';

export interface MeteorShowerYearEntry {
  /** ISO date (UTC) of the first day of activity. */
  start: string;
  /** ISO date (UTC) of the last day of activity (inclusive). */
  end: string;
  /** ISO instant of the maximum (UTC). */
  peak: string;
  peakPrecision: PeakPrecision;
  /** Expected maximum ZHR; null = variable. */
  zhr: number | null;
}

export interface MeteorShowerYearData {
  year: number;
  source: string;
  /** Date the data were checked against the source. */
  checked: string;
  showers: Record<string, MeteorShowerYearEntry>;
}

export type ActivityStatus = 'inactive' | 'upcoming' | 'active' | 'nearPeak' | 'peak';

export interface ShowerOccurrence {
  start: number;
  /** Exclusive end (end of the last active day). */
  end: number;
  peak: number;
  peakPrecision: PeakPrecision;
  zhr: number | null;
  /** True when derived from typical dates, not from verified year data. */
  approximate: boolean;
}

export interface ShowerActivity {
  status: ActivityStatus;
  occurrence: ShowerOccurrence;
  /** Days from now to the peak (negative = peak has passed). */
  daysToPeak: number;
  /** Days until activity starts (only for "upcoming"). */
  daysToStart: number | null;
}
