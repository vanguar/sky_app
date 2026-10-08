/**
 * Curated factual dataset of well-observable visual meteor showers.
 *
 * Source of the numbers: IMO Meteor Shower Calendar 2026 (J. Rendtel, IMO INFO(3-25)), "Working
 * List of Visual Meteor Showers" (Table 5) and radiant drift table (Table 6). Parent bodies only where
 * confirmed by NASA's shower pages (QUA, LYR, ETA, ORI, LEO, GEM, PER) or the IMO calendar text
 * (JBO, DRA, STA/NTA); otherwise null. Only FACTS are used
 * (dates, coordinates, speeds, rates) — no text of the sources is copied; descriptions in the UI
 * are original AstroPoint texts. See docs/DATA_SOURCES.md.
 *
 * Deliberately excluded: the Antihelion Source (a broad, ill-defined radiant area), daytime radio
 * showers and minor streams with ZHR ≈ 2–3 that are hard to tell from sporadic meteors.
 */
import type { MeteorShowerDefinition } from './types';

export const METEOR_SHOWERS: readonly MeteorShowerDefinition[] = [
  {
    id: 'qua', code: 'QUA', iauNumber: 10,
    typicalStart: '12-28', typicalEnd: '01-12', typicalPeak: '01-03', peakSolarLongitude: 283.15,
    radiantRaDeg: 230, radiantDecDeg: 49, driftRaDegPerDay: 0.6, driftDecDegPerDay: -0.2,
    speedKms: 41, typicalZhr: 80, constellation: 'Boo', parentBody: '2003 EH1', major: true,
  },
  {
    id: 'ace', code: 'ACE', iauNumber: 102,
    typicalStart: '01-31', typicalEnd: '02-20', typicalPeak: '02-08', peakSolarLongitude: 319.4,
    radiantRaDeg: 211, radiantDecDeg: -58, driftRaDegPerDay: 1.3, driftDecDegPerDay: -0.3,
    speedKms: 58, typicalZhr: 6, constellation: 'Cen', parentBody: null, major: false,
  },
  {
    id: 'lyr', code: 'LYR', iauNumber: 6,
    typicalStart: '04-14', typicalEnd: '04-30', typicalPeak: '04-22', peakSolarLongitude: 32.32,
    radiantRaDeg: 271, radiantDecDeg: 34, driftRaDegPerDay: 1.1, driftDecDegPerDay: 0,
    speedKms: 49, typicalZhr: 18, constellation: 'Lyr', parentBody: 'C/1861 G1 (Thatcher)', major: true,
  },
  {
    id: 'ppu', code: 'PPU', iauNumber: 137,
    typicalStart: '04-15', typicalEnd: '04-28', typicalPeak: '04-24', peakSolarLongitude: 33.5,
    radiantRaDeg: 110, radiantDecDeg: -45, driftRaDegPerDay: 0.5, driftDecDegPerDay: 0,
    speedKms: 18, typicalZhr: null, constellation: 'Pup', parentBody: null, major: false,
  },
  {
    id: 'eta', code: 'ETA', iauNumber: 31,
    typicalStart: '04-19', typicalEnd: '05-28', typicalPeak: '05-06', peakSolarLongitude: 45.5,
    radiantRaDeg: 338, radiantDecDeg: -1, driftRaDegPerDay: 0.9, driftDecDegPerDay: 0.4,
    speedKms: 66, typicalZhr: 50, constellation: 'Aqr', parentBody: '1P/Halley', major: true,
  },
  {
    id: 'jbo', code: 'JBO', iauNumber: 170,
    typicalStart: '06-22', typicalEnd: '07-02', typicalPeak: '06-22', peakSolarLongitude: 90.3,
    radiantRaDeg: 221, radiantDecDeg: 48, driftRaDegPerDay: 0.2, driftDecDegPerDay: -0.2,
    speedKms: 18, typicalZhr: null, constellation: 'Boo', parentBody: '7P/Pons–Winnecke', major: false,
  },
  {
    id: 'cap', code: 'CAP', iauNumber: 1,
    typicalStart: '07-03', typicalEnd: '08-15', typicalPeak: '07-31', peakSolarLongitude: 128,
    radiantRaDeg: 307, radiantDecDeg: -10, driftRaDegPerDay: 0.9, driftDecDegPerDay: 0.26,
    speedKms: 23, typicalZhr: 5, constellation: 'Cap', parentBody: null, major: false,
  },
  {
    id: 'sda', code: 'SDA', iauNumber: 5,
    typicalStart: '07-12', typicalEnd: '08-23', typicalPeak: '07-31', peakSolarLongitude: 128,
    radiantRaDeg: 340, radiantDecDeg: -16, driftRaDegPerDay: 0.75, driftDecDegPerDay: 0.18,
    speedKms: 41, typicalZhr: 25, constellation: 'Aqr', parentBody: null, major: true,
  },
  {
    id: 'per', code: 'PER', iauNumber: 7,
    typicalStart: '07-17', typicalEnd: '08-24', typicalPeak: '08-12', peakSolarLongitude: 140.0,
    radiantRaDeg: 48, radiantDecDeg: 58, driftRaDegPerDay: 1.3, driftDecDegPerDay: 0.15,
    speedKms: 59, typicalZhr: 100, constellation: 'Per', parentBody: '109P/Swift–Tuttle', major: true,
  },
  {
    id: 'kcg', code: 'KCG', iauNumber: 12,
    typicalStart: '08-03', typicalEnd: '08-28', typicalPeak: '08-17', peakSolarLongitude: 144,
    radiantRaDeg: 286, radiantDecDeg: 59, driftRaDegPerDay: 0.5, driftDecDegPerDay: 0.7,
    speedKms: 23, typicalZhr: 3, constellation: 'Dra', parentBody: null, major: false,
  },
  {
    id: 'aur', code: 'AUR', iauNumber: 206,
    typicalStart: '08-28', typicalEnd: '09-05', typicalPeak: '09-01', peakSolarLongitude: 158.6,
    radiantRaDeg: 91, radiantDecDeg: 39, driftRaDegPerDay: 1.1, driftDecDegPerDay: 0,
    speedKms: 66, typicalZhr: 6, constellation: 'Aur', parentBody: null, major: false,
  },
  {
    id: 'spe', code: 'SPE', iauNumber: 208,
    typicalStart: '09-05', typicalEnd: '09-21', typicalPeak: '09-09', peakSolarLongitude: 166.7,
    radiantRaDeg: 48, radiantDecDeg: 40, driftRaDegPerDay: 1.0, driftDecDegPerDay: 0.05,
    speedKms: 64, typicalZhr: 8, constellation: 'Per', parentBody: null, major: false,
  },
  {
    id: 'dra', code: 'DRA', iauNumber: 9,
    typicalStart: '10-06', typicalEnd: '10-10', typicalPeak: '10-08', peakSolarLongitude: 195.4,
    radiantRaDeg: 262, radiantDecDeg: 54, driftRaDegPerDay: 0, driftDecDegPerDay: 0,
    speedKms: 20, typicalZhr: null, constellation: 'Dra', parentBody: '21P/Giacobini–Zinner', major: true,
  },
  {
    id: 'ori', code: 'ORI', iauNumber: 8,
    typicalStart: '10-02', typicalEnd: '11-07', typicalPeak: '10-21', peakSolarLongitude: 208,
    radiantRaDeg: 95, radiantDecDeg: 16, driftRaDegPerDay: 0.66, driftDecDegPerDay: 0.08,
    speedKms: 66, typicalZhr: 20, constellation: 'Ori', parentBody: '1P/Halley', major: true,
  },
  {
    id: 'sta', code: 'STA', iauNumber: 2,
    typicalStart: '09-20', typicalEnd: '11-20', typicalPeak: '11-05', peakSolarLongitude: 223,
    radiantRaDeg: 52, radiantDecDeg: 15, driftRaDegPerDay: 0.78, driftDecDegPerDay: 0.2,
    speedKms: 27, typicalZhr: 7, constellation: 'Tau', parentBody: '2P/Encke', major: false,
  },
  {
    id: 'nta', code: 'NTA', iauNumber: 17,
    typicalStart: '10-20', typicalEnd: '12-10', typicalPeak: '11-12', peakSolarLongitude: 230,
    radiantRaDeg: 58, radiantDecDeg: 22, driftRaDegPerDay: 0.9, driftDecDegPerDay: 0.15,
    speedKms: 29, typicalZhr: 5, constellation: 'Tau', parentBody: '2P/Encke', major: false,
  },
  {
    id: 'leo', code: 'LEO', iauNumber: 13,
    typicalStart: '11-06', typicalEnd: '11-30', typicalPeak: '11-17', peakSolarLongitude: 235.27,
    radiantRaDeg: 152, radiantDecDeg: 22, driftRaDegPerDay: 0.6, driftDecDegPerDay: -0.25,
    speedKms: 71, typicalZhr: 15, constellation: 'Leo', parentBody: '55P/Tempel–Tuttle', major: true,
  },
  {
    id: 'amo', code: 'AMO', iauNumber: 246,
    typicalStart: '11-15', typicalEnd: '11-25', typicalPeak: '11-21', peakSolarLongitude: 239.32,
    radiantRaDeg: 117, radiantDecDeg: 1, driftRaDegPerDay: 0.8, driftDecDegPerDay: -0.2,
    speedKms: 65, typicalZhr: null, constellation: 'CMi', parentBody: null, major: false,
  },
  {
    id: 'pho', code: 'PHO', iauNumber: 254,
    typicalStart: '12-01', typicalEnd: '12-05', typicalPeak: '12-02', peakSolarLongitude: 249.5,
    radiantRaDeg: 8, radiantDecDeg: -27, driftRaDegPerDay: 0.6, driftDecDegPerDay: 0,
    speedKms: 15, typicalZhr: null, constellation: 'Scl', parentBody: null, major: false,
  },
  {
    id: 'hyd', code: 'HYD', iauNumber: 16,
    typicalStart: '12-03', typicalEnd: '12-20', typicalPeak: '12-09', peakSolarLongitude: 257,
    radiantRaDeg: 125, radiantDecDeg: 2, driftRaDegPerDay: 0.8, driftDecDegPerDay: -0.2,
    speedKms: 58, typicalZhr: 7, constellation: 'Hya', parentBody: null, major: false,
  },
  {
    id: 'gem', code: 'GEM', iauNumber: 4,
    typicalStart: '12-04', typicalEnd: '12-20', typicalPeak: '12-14', peakSolarLongitude: 262.2,
    radiantRaDeg: 112, radiantDecDeg: 33, driftRaDegPerDay: 1.0, driftDecDegPerDay: -0.05,
    speedKms: 35, typicalZhr: 150, constellation: 'Gem', parentBody: '3200 Phaethon', major: true,
  },
  {
    id: 'urs', code: 'URS', iauNumber: 15,
    typicalStart: '12-17', typicalEnd: '12-26', typicalPeak: '12-22', peakSolarLongitude: 270.7,
    radiantRaDeg: 217, radiantDecDeg: 76, driftRaDegPerDay: 0, driftDecDegPerDay: 0,
    speedKms: 33, typicalZhr: 10, constellation: 'UMi', parentBody: null, major: true,
  },
];

export const SHOWERS_BY_ID: ReadonlyMap<string, MeteorShowerDefinition> = new Map(
  METEOR_SHOWERS.map((s) => [s.id, s]),
);

export const METEOR_ID_PREFIX = 'meteor-';

export function meteorObjectId(showerId: string): string {
  return `${METEOR_ID_PREFIX}${showerId}`;
}

export function isMeteorObjectId(id: string): boolean {
  return id.startsWith(METEOR_ID_PREFIX);
}

export function showerFromObjectId(id: string): MeteorShowerDefinition | null {
  if (!id.startsWith(METEOR_ID_PREFIX)) return null;
  return SHOWERS_BY_ID.get(id.slice(METEOR_ID_PREFIX.length)) ?? null;
}
