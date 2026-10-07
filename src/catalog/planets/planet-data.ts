import type { SolarBodyId } from '../../astronomy/types';

/**
 * Physical reference data for the Sun, Moon and planets.
 * Source: NASA Goddard Space Flight Center — Planetary Fact Sheets (public domain),
 * https://nssdc.gsfc.nasa.gov/planetary/factsheet/ .  Moon counts change with new discoveries:
 * `moons.asOf` records when the value was last checked.
 */
export interface BodyPhysicalData {
  diameterKm: number;
  massKg: number;
  /** Mean distance from the Sun (planets) or from Earth (Moon), km. */
  meanDistanceKm: number | null;
  meanDistanceFrom: 'sun' | 'earth' | null;
  /** Sidereal orbital period in days. */
  orbitalPeriodDays: number | null;
  /** Sidereal rotation period in hours; negative = retrograde. */
  rotationPeriodHours: number;
  /** Mean surface (or 1-bar level) temperature, °C. */
  meanTemperatureC: number;
  /** Major atmospheric constituents; null = no substantial atmosphere (exosphere only). */
  atmosphere: string[] | null;
  moons: { count: number; asOf: string } | null;
  discovery: string | null;
  /** Bodies that have a 3D globe in the viewer, and whether it uses a real (photographic) map. */
  globe: { texture: 'photo' | 'procedural' } | null;
}

export const BODY_DATA: Record<SolarBodyId, BodyPhysicalData> = {
  sun: {
    diameterKm: 1392700,
    massKg: 1.989e30,
    meanDistanceKm: null,
    meanDistanceFrom: null,
    orbitalPeriodDays: null,
    rotationPeriodHours: 609.12,
    meanTemperatureC: 5505,
    atmosphere: ['H 73%', 'He 25%'],
    moons: null,
    discovery: null,
    globe: null,
  },
  moon: {
    diameterKm: 3475,
    massKg: 7.346e22,
    meanDistanceKm: 384400,
    meanDistanceFrom: 'earth',
    orbitalPeriodDays: 27.3217,
    rotationPeriodHours: 655.72,
    meanTemperatureC: -20,
    atmosphere: null,
    moons: null,
    discovery: null,
    globe: { texture: 'photo' },
  },
  mercury: {
    diameterKm: 4879,
    massKg: 3.301e23,
    meanDistanceKm: 57.9e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 88.0,
    rotationPeriodHours: 1407.6,
    meanTemperatureC: 167,
    atmosphere: null,
    moons: { count: 0, asOf: '2025' },
    discovery: null,
    globe: { texture: 'procedural' },
  },
  venus: {
    diameterKm: 12104,
    massKg: 4.867e24,
    meanDistanceKm: 108.2e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 224.7,
    rotationPeriodHours: -5832.5,
    meanTemperatureC: 464,
    atmosphere: ['CO₂ 96.5%', 'N₂ 3.5%'],
    moons: { count: 0, asOf: '2025' },
    discovery: null,
    globe: { texture: 'procedural' },
  },
  mars: {
    diameterKm: 6792,
    massKg: 6.417e23,
    meanDistanceKm: 227.9e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 687.0,
    rotationPeriodHours: 24.6,
    meanTemperatureC: -65,
    atmosphere: ['CO₂ 95%', 'N₂ 2.8%', 'Ar 2%'],
    moons: { count: 2, asOf: '2025' },
    discovery: null,
    globe: { texture: 'photo' },
  },
  jupiter: {
    diameterKm: 142984,
    massKg: 1.898e27,
    meanDistanceKm: 778.5e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 4331,
    rotationPeriodHours: 9.9,
    meanTemperatureC: -110,
    atmosphere: ['H₂ 90%', 'He 10%'],
    moons: { count: 95, asOf: '2024' },
    discovery: null,
    globe: { texture: 'photo' },
  },
  saturn: {
    diameterKm: 120536,
    massKg: 5.683e26,
    meanDistanceKm: 1432.0e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 10747,
    rotationPeriodHours: 10.7,
    meanTemperatureC: -140,
    atmosphere: ['H₂ 96%', 'He 3%'],
    moons: { count: 274, asOf: '2025' },
    discovery: null,
    globe: { texture: 'procedural' },
  },
  uranus: {
    diameterKm: 51118,
    massKg: 8.681e25,
    meanDistanceKm: 2867.0e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 30589,
    rotationPeriodHours: -17.2,
    meanTemperatureC: -195,
    atmosphere: ['H₂ 83%', 'He 15%', 'CH₄ 2%'],
    moons: { count: 29, asOf: '2025' },
    discovery: 'William Herschel, 1781',
    globe: { texture: 'procedural' },
  },
  neptune: {
    diameterKm: 49528,
    massKg: 1.024e26,
    meanDistanceKm: 4515.0e6,
    meanDistanceFrom: 'sun',
    orbitalPeriodDays: 59800,
    rotationPeriodHours: 16.1,
    meanTemperatureC: -200,
    atmosphere: ['H₂ 80%', 'He 19%', 'CH₄ 1.5%'],
    moons: { count: 16, asOf: '2024' },
    discovery: 'Johann Galle & Heinrich d’Arrest (predicted by Urbain Le Verrier), 1846',
    globe: { texture: 'procedural' },
  },
};

/** Display colours used for planet markers in the sky view. */
export const BODY_COLORS: Record<SolarBodyId, [number, number, number]> = {
  sun: [1.0, 0.92, 0.7],
  moon: [0.92, 0.92, 0.88],
  mercury: [0.8, 0.75, 0.7],
  venus: [1.0, 0.97, 0.85],
  mars: [1.0, 0.55, 0.35],
  jupiter: [1.0, 0.9, 0.75],
  saturn: [0.98, 0.88, 0.65],
  uranus: [0.65, 0.9, 0.95],
  neptune: [0.5, 0.65, 1.0],
};

/** Named surface features shown on 3D globes (IAU planetary nomenclature; lat/lon in degrees, east-positive). */
export interface Landmark {
  name: string;
  lat: number;
  lon: number;
}

export const LANDMARKS: Partial<Record<SolarBodyId, Landmark[]>> = {
  mars: [
    { name: 'Olympus Mons', lat: 18.65, lon: -133.8 },
    { name: 'Valles Marineris', lat: -13.9, lon: -59.2 },
    { name: 'Gale', lat: -5.4, lon: 137.8 },
    { name: 'Jezero', lat: 18.38, lon: 77.58 },
    { name: 'Hellas Planitia', lat: -42.4, lon: 70.5 },
    { name: 'Elysium Mons', lat: 25.02, lon: 147.21 },
    { name: 'Syrtis Major', lat: 8.4, lon: 69.5 },
  ],
  moon: [
    { name: 'Mare Tranquillitatis', lat: 8.5, lon: 31.4 },
    { name: 'Apollo 11', lat: 0.674, lon: 23.473 },
    { name: 'Mare Imbrium', lat: 32.8, lon: -15.6 },
    { name: 'Mare Serenitatis', lat: 28.0, lon: 17.5 },
    { name: 'Mare Crisium', lat: 17.0, lon: 59.1 },
    { name: 'Oceanus Procellarum', lat: 18.4, lon: -57.4 },
    { name: 'Tycho', lat: -43.31, lon: -11.36 },
    { name: 'Copernicus', lat: 9.62, lon: -20.08 },
  ],
};
