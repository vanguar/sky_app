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
    globe: { texture: 'photo' },
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
    globe: { texture: 'photo' },
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

/**
 * Named surface features shown on 3D globes. Names and planetocentric coordinates (lat, east-positive
 * lon, degrees) from the IAU Gazetteer of Planetary Nomenclature (USGS, public domain); landing sites
 * from NASA/ESA/CNSA mission records. Rounded to ~0.1°.
 */
export interface Landmark {
  name: string;
  lat: number;
  lon: number;
  kind: 'feature' | 'landing';
}

const f = (name: string, lat: number, lon: number): Landmark => ({ name, lat, lon, kind: 'feature' });
const l = (name: string, lat: number, lon: number): Landmark => ({ name, lat, lon, kind: 'landing' });

export const LANDMARKS: Partial<Record<GlobeId, Landmark[]>> = {
  mercury: [
    f('Caloris Planitia', 31.0, 162.7),
    f('Rembrandt', -33.2, 88.2),
    f('Beethoven', -20.0, -124.0),
    f('Tolstoj', -16.3, -163.5),
    f('Rachmaninoff', 27.6, 57.6),
    f('Raditladi', 27.3, 119.1),
    f('Shakespeare', 45.7, -150.9),
    f('Dostoevskij', -45.1, -176.4),
    f('Homer', -1.0, -36.5),
    f('Kuiper', -11.3, -31.5),
    l('MESSENGER (impact)', 54.4, -149.9),
  ],
  venus: [
    f('Maxwell Montes', 65.2, 3.3),
    f('Ishtar Terra', 70.4, 27.5),
    f('Lakshmi Planum', 68.6, -20.7),
    f('Aphrodite Terra', -5.8, 104.8),
    f('Beta Regio', 25.3, -77.2),
    f('Alpha Regio', -22.0, 4.7),
    f('Atla Regio', 9.2, -160.5),
    f('Maat Mons', 0.5, -165.2),
    l('Venera 7', -5.0, -9.0),
    l('Venera 9', 31.7, -69.2),
    l('Venera 13', -7.5, -56.5),
    l('Vega 1', 7.2, 177.8),
  ],
  io: [
    f('Pele', -18.7, 104.7),
    f('Loki Patera', 13.0, 51.2),
    f('Prometheus', -1.5, -153.0),
    f('Tvashtar Paterae', 62.8, -124.0),
    f('Ra Patera', -8.6, 34.7),
    f('Masubi', -45.4, -54.4),
  ],
  europa: [
    f('Pwyll', -25.2, 88.6),
    f('Conamara Chaos', 9.7, 86.3),
    f('Thera Macula', -46.7, -178.9),
    f('Callanish', -16.7, 25.5),
    f('Tyre', 33.6, -146.6),
  ],
  ganymede: [
    f('Galileo Regio', 35.7, -144.4),
    f('Gilgamesh', -62.6, -125.1),
    f('Osiris', -38.1, -166.1),
    f('Tros', 11.0, -27.9),
    f('Uruk Sulcus', 0.0, -160.0),
  ],
  callisto: [
    f('Valhalla', 14.7, -56.0),
    f('Asgard', 32.2, -140.0),
    f('Adlinda', -49.9, -31.7),
    f('Bran', -24.4, -152.4),
  ],
  titan: [
    f('Xanadu', -15.0, -100.0),
    f('Kraken Mare', 68.0, 50.0),
    f('Ligeia Mare', 79.0, 112.0),
    f('Shangri-La', -10.0, -165.0),
    f('Belet', -5.0, 105.0),
    f('Menrva', 20.1, -87.2),
    f('Selk (Dragonfly target)', 7.0, 161.0),
    l('Huygens', -10.3, 167.7),
  ],
  // Cloud features drift: positions refer to the Cassini map (December 2000), not to today's sky.
  jupiter: [
    f('Great Red Spot (2000)', -21.0, -48.9),
    f('North Equatorial Belt', 14.4, 120),
    f('Equatorial Zone', -0.5, 120),
    f('South Equatorial Belt', -12.0, 120),
  ],
  mars: [
    f('Olympus Mons', 18.65, -133.8),
    f('Ascraeus Mons', 11.92, -104.08),
    f('Pavonis Mons', 1.48, -112.96),
    f('Arsia Mons', -8.26, -120.09),
    f('Alba Mons', 40.47, -109.6),
    f('Elysium Mons', 25.02, 147.21),
    f('Valles Marineris', -13.9, -59.2),
    f('Noctis Labyrinthus', -6.94, -101.9),
    f('Hellas Planitia', -42.4, 70.5),
    f('Argyre Planitia', -49.7, -43.4),
    f('Utopia Planitia', 46.7, 117.5),
    f('Acidalia Planitia', 49.76, -20.7),
    f('Chryse Planitia', 28.4, -40.2),
    f('Isidis Planitia', 12.9, 87.0),
    f('Syrtis Major Planum', 8.4, 69.5),
    f('Hesperia Planum', -21.4, 109.9),
    f('Arabia Terra', 21.0, 5.0),
    f('Planum Boreum', 87.3, 0),
    f('Planum Australe', -83.9, 160),
    l('Gale · Curiosity', -4.59, 137.44),
    l('Jezero · Perseverance', 18.44, 77.45),
    l('Gusev · Spirit', -14.57, 175.47),
    l('Meridiani · Opportunity', -1.95, -5.53),
    l('Viking 1', 22.27, -47.95),
    l('Viking 2', 47.64, 134.29),
    l('Mars Pathfinder', 19.13, -33.22),
    l('InSight', 4.5, 135.62),
    l('Zhurong', 25.07, 109.93),
  ],
  moon: [
    f('Mare Tranquillitatis', 8.5, 31.4),
    f('Mare Serenitatis', 28.0, 17.5),
    f('Mare Imbrium', 32.8, -15.6),
    f('Mare Crisium', 17.0, 59.1),
    f('Mare Fecunditatis', -7.8, 51.3),
    f('Mare Nectaris', -15.2, 35.5),
    f('Mare Nubium', -21.3, -16.6),
    f('Mare Humorum', -24.4, -38.6),
    f('Mare Frigoris', 56.0, 1.4),
    f('Mare Vaporum', 13.3, 3.6),
    f('Oceanus Procellarum', 18.4, -57.4),
    f('Mare Orientale', -19.4, -92.8),
    f('Mare Moscoviense', 27.3, 147.9),
    f('Tycho', -43.31, -11.36),
    f('Copernicus', 9.62, -20.08),
    f('Kepler', 8.1, -38.0),
    f('Aristarchus', 23.7, -47.4),
    f('Plato', 51.6, -9.4),
    f('Clavius', -58.4, -14.4),
    f('Grimaldi', -5.2, -68.6),
    f('Langrenus', -8.9, 61.0),
    f('Petavius', -25.3, 60.4),
    f('Theophilus', -11.4, 26.4),
    f('Ptolemaeus', -9.3, -1.9),
    f('Archimedes', 29.7, -4.0),
    f('Schickard', -44.4, -54.6),
    f('Tsiolkovskiy', -20.4, 129.1),
    f('South Pole–Aitken basin', -53.0, -169.0),
    f('Montes Apenninus', 18.9, -3.7),
    l('Apollo 11', 0.674, 23.473),
    l('Apollo 12', -3.01, -23.42),
    l('Apollo 14', -3.65, -17.47),
    l('Apollo 15', 26.13, 3.63),
    l('Apollo 16', -8.97, 15.5),
    l('Apollo 17', 20.19, 30.77),
    l('Luna 9', 7.08, -64.37),
    l('Lunokhod 1', 38.24, -35.0),
    l("Chang'e 3", 44.12, -19.51),
    l("Chang'e 4", -45.44, 177.6),
  ],
};

/* ------------------------------------------------------------ satellites */

export type MoonId = 'io' | 'europa' | 'ganymede' | 'callisto' | 'titan';
/** Anything that can be shown in the 3D globe viewer. */
export type GlobeId = SolarBodyId | MoonId;

export const MOON_IDS: readonly MoonId[] = ['io', 'europa', 'ganymede', 'callisto', 'titan'];

export interface SatelliteData {
  parent: 'jupiter' | 'saturn';
  diameterKm: number;
  orbitalPeriodDays: number;
  semiMajorAxisKm: number;
  discovery: string;
}

/** NASA planetary satellite fact sheets (public domain). */
export const SATELLITES: Record<MoonId, SatelliteData> = {
  io: {
    parent: 'jupiter',
    diameterKm: 3643,
    orbitalPeriodDays: 1.769,
    semiMajorAxisKm: 421700,
    discovery: 'Galileo Galilei, 1610',
  },
  europa: {
    parent: 'jupiter',
    diameterKm: 3122,
    orbitalPeriodDays: 3.551,
    semiMajorAxisKm: 671034,
    discovery: 'Galileo Galilei, 1610',
  },
  ganymede: {
    parent: 'jupiter',
    diameterKm: 5268,
    orbitalPeriodDays: 7.155,
    semiMajorAxisKm: 1070412,
    discovery: 'Galileo Galilei, 1610',
  },
  callisto: {
    parent: 'jupiter',
    diameterKm: 4821,
    orbitalPeriodDays: 16.689,
    semiMajorAxisKm: 1882709,
    discovery: 'Galileo Galilei, 1610',
  },
  titan: {
    parent: 'saturn',
    diameterKm: 5150,
    orbitalPeriodDays: 15.945,
    semiMajorAxisKm: 1221870,
    discovery: 'Christiaan Huygens, 1655',
  },
};

export const MOONS_OF: Partial<Record<SolarBodyId, MoonId[]>> = {
  jupiter: ['io', 'europa', 'ganymede', 'callisto'],
  saturn: ['titan'],
};

export function isMoonId(id: string): id is MoonId {
  return (MOON_IDS as readonly string[]).includes(id);
}

export function hasGlobe(id: GlobeId): boolean {
  return isMoonId(id) || !!BODY_DATA[id].globe;
}
