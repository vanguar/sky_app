#!/usr/bin/env node
/**
 * Builds the compact runtime catalogs in public/catalogs/ from the raw,
 * license-documented sources in data/source/ (see docs/DATA_SOURCES.md).
 *
 *   node scripts/build-catalogs.mjs
 *
 * Output is deterministic and committed to the repository, so a normal
 * `npm run build` never needs network access.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// astronomy-engine's ESM build lacks a package.json "type" marker, so load the CJS build in Node.
const Astronomy = createRequire(import.meta.url)('astronomy-engine');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'data', 'source', p);
const out = join(root, 'public', 'catalogs');
mkdirSync(out, { recursive: true });

const readJson = (p) => JSON.parse(readFileSync(src(p), 'utf8'));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const normRa = (deg) => ((deg % 360) + 360) % 360;

/* ---------------------------------------------------------------- stars */

const hipLines = readFileSync(src('hipparcos/hip_main_vmag_lt_6.5.tsv'), 'utf8').split(/\r?\n/);
const stars = [];
for (const line of hipLines) {
  if (!line || line.startsWith('#')) continue;
  const cols = line.split('\t');
  const hip = Number(cols[0]);
  if (!Number.isFinite(hip) || hip <= 0 || cols.length < 8) continue;
  const ra = Number(cols[1]);
  const dec = Number(cols[2]);
  const mag = Number(cols[3]);
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
  const bvRaw = cols[4].trim();
  const plxRaw = cols[5].trim();
  stars.push({
    hip,
    ra,
    dec,
    mag,
    bv: bvRaw === '' ? null : Number(bvRaw),
    plx: plxRaw === '' ? null : Number(plxRaw),
    sp: cols[6].trim(),
    hd: cols[7].trim(),
  });
}
stars.sort((a, b) => a.mag - b.mag);

// Flat numeric array: hip, raDeg, decDeg, mag, bv (99 = unknown), plx mas (-1 = unknown)
const starData = [];
const starSp = [];
const starCon = [];
for (const s of stars) {
  starData.push(
    s.hip,
    round(s.ra, 4),
    round(s.dec, 4),
    round(s.mag, 2),
    s.bv === null ? 99 : round(s.bv, 3),
    s.plx === null ? -1 : round(s.plx, 2),
  );
  starSp.push(s.sp);
  starCon.push(Astronomy.Constellation(s.ra / 15, s.dec).symbol);
}
writeFileSync(
  join(out, 'stars.json'),
  JSON.stringify({
    version: 1,
    source: 'Hipparcos Main Catalogue (ESA 1997), V < 6.5',
    stride: 6,
    fields: ['hip', 'raDeg', 'decDeg', 'vmag', 'bv', 'parallaxMas'],
    data: starData,
    spectral: starSp,
    constellation: starCon,
  }),
);

/* ---------------------------------------------------------- star names */

// Curated additions for languages missing from the source data.
// Proper names are factual designations; translations by the AstroPoint team.
const extraStarNames = {
  32349: { uk: 'Сіріус', de: 'Sirius', fr: 'Sirius' },
  30438: { uk: 'Канопус', de: 'Canopus', fr: 'Canopus' },
  69673: { uk: 'Арктур', de: 'Arktur', fr: 'Arcturus' },
  91262: { uk: 'Вега', de: 'Wega', fr: 'Véga' },
  24608: { uk: 'Капела', de: 'Kapella', fr: 'Capella' },
  24436: { uk: 'Рігель', de: 'Rigel', fr: 'Rigel' },
  37279: { uk: 'Проціон', de: 'Prokyon', fr: 'Procyon' },
  27989: { uk: 'Бетельгейзе', de: 'Beteigeuze', fr: 'Bételgeuse' },
  7588: { uk: 'Ахернар', de: 'Achernar', fr: 'Achernar' },
  97649: { uk: 'Альтаїр', de: 'Altair', fr: 'Altaïr' },
  21421: { uk: 'Альдебаран', de: 'Aldebaran', fr: 'Aldébaran' },
  80763: { uk: 'Антарес', de: 'Antares', fr: 'Antarès' },
  65474: { uk: 'Спіка', de: 'Spica', fr: 'Spica' },
  37826: { uk: 'Поллукс', de: 'Pollux', fr: 'Pollux' },
  113368: { uk: 'Фомальгаут', de: 'Fomalhaut', fr: 'Fomalhaut' },
  102098: { uk: 'Денеб', de: 'Deneb', fr: 'Deneb' },
  49669: { uk: 'Регул', de: 'Regulus', fr: 'Régulus' },
  36850: { uk: 'Кастор', de: 'Castor', fr: 'Castor' },
  11767: { uk: 'Полярна', de: 'Polarstern', fr: 'Étoile polaire' },
  25336: { uk: 'Беллатрикс', de: 'Bellatrix', fr: 'Bellatrix' },
  26311: { uk: 'Альнілам', de: 'Alnilam', fr: 'Alnilam' },
  26727: { uk: 'Альнітак', de: 'Alnitak', fr: 'Alnitak' },
  25930: { uk: 'Мінтака', de: 'Mintaka', fr: 'Mintaka' },
  60718: { uk: 'Акрукс', de: 'Acrux', fr: 'Acrux' },
  65378: { uk: 'Міцар', de: 'Mizar', fr: 'Mizar' },
  54061: { uk: 'Дубге', de: 'Dubhe', fr: 'Dubhe' },
  62956: { uk: 'Аліот', de: 'Alioth', fr: 'Alioth' },
  67301: { uk: 'Бенетнаш', de: 'Benetnasch', fr: 'Alkaïd' },
  15863: { uk: 'Мірфак', de: 'Mirfak', fr: 'Mirfak' },
  14576: { uk: 'Алголь', de: 'Algol', fr: 'Algol' },
  677: { uk: 'Альферац', de: 'Sirrah', fr: 'Alphératz' },
  3179: { uk: 'Шедар', de: 'Schedir', fr: 'Schédar' },
};

const rawNames = readJson('d3-celestial/starnames.json');
const starHips = new Set(stars.map((s) => s.hip));
const LANGS = ['ru', 'uk', 'de', 'fr', 'es', 'it', 'ar'];
const starNames = {};
for (const [hipStr, n] of Object.entries(rawNames)) {
  const hip = Number(hipStr);
  if (!starHips.has(hip)) continue;
  const name = (n.name || '').trim();
  const bayer = (n.bayer || '').trim();
  const flam = (n.flam || '').trim();
  if (!name && !bayer && !flam) continue;
  const entry = { c: n.c };
  if (name) entry.n = name;
  if (bayer) entry.b = bayer;
  if (flam) entry.f = flam;
  if (name) {
    const loc = {};
    for (const l of LANGS) {
      const v = (n[l] || '').replace(/[‎‏]/g, '').trim();
      if (v && v !== name) loc[l] = v;
    }
    Object.assign(
      loc,
      Object.fromEntries(Object.entries(extraStarNames[hip] || {}).filter(([, v]) => v !== name)),
    );
    if (Object.keys(loc).length) entry.l = loc;
  }
  starNames[hip] = entry;
}
writeFileSync(join(out, 'star-names.json'), JSON.stringify(starNames));

/* ------------------------------------------------------- constellations */

const ukNames = {
  And: 'Андромеда',
  Ant: 'Насос',
  Aps: 'Райський Птах',
  Aqr: 'Водолій',
  Aql: 'Орел',
  Ara: 'Жертовник',
  Ari: 'Овен',
  Aur: 'Візничий',
  Boo: 'Волопас',
  Cae: 'Різець',
  Cam: 'Жираф',
  Cnc: 'Рак',
  CVn: 'Гончі Пси',
  CMa: 'Великий Пес',
  CMi: 'Малий Пес',
  Cap: 'Козеріг',
  Car: 'Кіль',
  Cas: 'Кассіопея',
  Cen: 'Центавр',
  Cep: 'Цефей',
  Cet: 'Кит',
  Cha: 'Хамелеон',
  Cir: 'Циркуль',
  Col: 'Голуб',
  Com: 'Волосся Вероніки',
  CrA: 'Південна Корона',
  CrB: 'Північна Корона',
  Crv: 'Ворон',
  Crt: 'Чаша',
  Cru: 'Південний Хрест',
  Cyg: 'Лебідь',
  Del: 'Дельфін',
  Dor: 'Золота Риба',
  Dra: 'Дракон',
  Equ: 'Малий Кінь',
  Eri: 'Ерідан',
  For: 'Піч',
  Gem: 'Близнята',
  Gru: 'Журавель',
  Her: 'Геркулес',
  Hor: 'Годинник',
  Hya: 'Гідра',
  Hyi: 'Південна Гідра',
  Ind: 'Індіанець',
  Lac: 'Ящірка',
  Leo: 'Лев',
  LMi: 'Малий Лев',
  Lep: 'Заєць',
  Lib: 'Терези',
  Lup: 'Вовк',
  Lyn: 'Рись',
  Lyr: 'Ліра',
  Men: 'Столова Гора',
  Mic: 'Мікроскоп',
  Mon: 'Єдиноріг',
  Mus: 'Муха',
  Nor: 'Косинець',
  Oct: 'Октант',
  Oph: 'Змієносець',
  Ori: 'Оріон',
  Pav: 'Павич',
  Peg: 'Пегас',
  Per: 'Персей',
  Phe: 'Фенікс',
  Pic: 'Живописець',
  Psc: 'Риби',
  PsA: 'Південна Риба',
  Pup: 'Корма',
  Pyx: 'Компас',
  Ret: 'Сітка',
  Sge: 'Стріла',
  Sgr: 'Стрілець',
  Sco: 'Скорпіон',
  Scl: 'Скульптор',
  Sct: 'Щит',
  Ser: 'Змія',
  Sex: 'Секстант',
  Tau: 'Телець',
  Tel: 'Телескоп',
  Tri: 'Трикутник',
  TrA: 'Південний Трикутник',
  Tuc: 'Тукан',
  UMa: 'Велика Ведмедиця',
  UMi: 'Мала Ведмедиця',
  Vel: 'Вітрила',
  Vir: 'Діва',
  Vol: 'Летюча Риба',
  Vul: 'Лисичка',
};
const ZODIAC = new Set(['Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc']);

const cNames = readJson('d3-celestial/constellations.json').features;
const cLines = readJson('d3-celestial/constellations.lines.json').features;
const cBounds = readJson('d3-celestial/constellations.bounds.json').features;

const toRaDec = ([ra, dec]) => [round(normRa(ra), 4), round(dec, 4)];
const constellations = new Map();
for (const f of cNames) {
  const p = f.properties;
  const id = f.id;
  const label = toRaDec(f.geometry.coordinates);
  const existing = constellations.get(id);
  if (existing) {
    // Serpens is split into Caput and Cauda in the source; it is one IAU constellation.
    existing.labels.push(label);
    continue;
  }
  const latin = id === 'Ser' ? 'Serpens' : p.name;
  constellations.set(id, {
    id,
    latin,
    genitive: p.gen,
    rank: Number(p.rank),
    zodiac: ZODIAC.has(id),
    eclipticCrossing: ZODIAC.has(id) || id === 'Oph',
    names: {
      en: latin,
      ru: id === 'Ser' ? 'Змея' : p.ru,
      uk: ukNames[id],
      de: id === 'Ser' ? 'Schlange' : p.de,
      fr: id === 'Ser' ? 'Serpent' : p.fr,
      es: id === 'Ser' ? 'Serpiente' : p.es,
      it: id === 'Ser' ? 'Serpente' : p.it,
      ar: p.ar,
    },
    meaningEn: p.en,
    labels: [label],
    lines: [],
    bounds: [],
  });
}
for (const f of cLines) {
  const c = constellations.get(f.id);
  for (const line of f.geometry.coordinates) c.lines.push(line.map(toRaDec));
}
for (const f of cBounds) {
  const c = constellations.get(f.id);
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) for (const ring of poly) c.bounds.push(ring.map(toRaDec));
}
const constellationList = [...constellations.values()];
if (constellationList.length !== 88)
  throw new Error(`Expected 88 constellations, got ${constellationList.length}`);
for (const c of constellationList) {
  for (const [lang, v] of Object.entries(c.names))
    if (!v) throw new Error(`Missing ${lang} name for ${c.id}`);
}
writeFileSync(
  join(out, 'constellations.json'),
  JSON.stringify({ version: 1, constellations: constellationList }),
);

/* -------------------------------------------------------------- messier */

const TYPE_MAP = {
  s: 'galaxy',
  e: 'galaxy',
  i: 'galaxy',
  gc: 'globularCluster',
  oc: 'openCluster',
  pn: 'planetaryNebula',
  snr: 'nebula',
  sfr: 'nebula',
  rn: 'nebula',
  pos: 'other',
};
const SUBTYPE_MAP = {
  s: 'spiralGalaxy',
  e: 'ellipticalGalaxy',
  i: 'irregularGalaxy',
  snr: 'supernovaRemnant',
  sfr: 'emissionNebula',
  rn: 'reflectionNebula',
};
// Approximate distances in light-years, rounded literature values
// (NASA Hubble Messier Catalog / SEDS Messier database). Facts, not creative content.
const DIST_LY = {
  M1: 6500,
  M2: 37500,
  M3: 33900,
  M4: 7200,
  M5: 24500,
  M6: 1600,
  M7: 980,
  M8: 4100,
  M9: 25800,
  M10: 14300,
  M11: 6200,
  M12: 15700,
  M13: 22200,
  M14: 30300,
  M15: 33600,
  M16: 7000,
  M17: 5500,
  M18: 4900,
  M19: 28700,
  M20: 5200,
  M21: 4250,
  M22: 10600,
  M23: 2150,
  M24: 10000,
  M25: 2000,
  M26: 5000,
  M27: 1360,
  M28: 17900,
  M29: 4000,
  M30: 26100,
  M31: 2.5e6,
  M32: 2.65e6,
  M33: 2.73e6,
  M34: 1500,
  M35: 2800,
  M36: 4100,
  M37: 4500,
  M38: 4200,
  M39: 825,
  M40: 510,
  M41: 2300,
  M42: 1344,
  M43: 1600,
  M44: 577,
  M45: 444,
  M46: 5400,
  M47: 1600,
  M48: 1500,
  M49: 5.6e7,
  M50: 3000,
  M51: 2.3e7,
  M52: 5000,
  M53: 58000,
  M54: 87400,
  M55: 17600,
  M56: 32900,
  M57: 2300,
  M58: 6.2e7,
  M59: 6.0e7,
  M60: 5.5e7,
  M61: 5.25e7,
  M62: 22500,
  M63: 2.9e7,
  M64: 1.7e7,
  M65: 3.5e7,
  M66: 3.6e7,
  M67: 2700,
  M68: 33600,
  M69: 29700,
  M70: 29400,
  M71: 13000,
  M72: 55400,
  M73: 2500,
  M74: 3.2e7,
  M75: 67500,
  M76: 2500,
  M77: 4.7e7,
  M78: 1600,
  M79: 41000,
  M80: 32600,
  M81: 1.2e7,
  M82: 1.2e7,
  M83: 1.5e7,
  M84: 6.0e7,
  M85: 6.0e7,
  M86: 5.2e7,
  M87: 5.35e7,
  M88: 4.7e7,
  M89: 5.0e7,
  M90: 5.8e7,
  M91: 6.3e7,
  M92: 26700,
  M93: 3600,
  M94: 1.6e7,
  M95: 3.3e7,
  M96: 3.1e7,
  M97: 2030,
  M98: 4.4e7,
  M99: 5.0e7,
  M100: 5.5e7,
  M101: 2.1e7,
  M102: 5.0e7,
  M103: 8500,
  M104: 3.1e7,
  M105: 3.2e7,
  M106: 2.4e7,
  M107: 20900,
  M108: 4.6e7,
  M109: 8.3e7,
  M110: 2.69e6,
};
const messier = readJson('d3-celestial/messier.json').features.map((f) => {
  const p = f.properties;
  const [raRaw, dec] = f.geometry.coordinates;
  const ra = normRa(raRaw);
  return {
    id: f.id,
    number: Number(f.id.slice(1)),
    ngc: p.desig || null,
    commonName: (p.alt || '').replace('´', "'").replace('’', "'") || null,
    category: TYPE_MAP[p.type],
    subtype: SUBTYPE_MAP[p.type] ?? null,
    sourceType: p.type,
    mag: typeof p.mag === 'number' ? p.mag : null,
    sizeArcmin: p.dim || null,
    raDeg: round(ra, 4),
    decDeg: round(dec, 4),
    constellation: Astronomy.Constellation(ra / 15, dec).symbol,
    distanceLy: DIST_LY[f.id] ?? null,
  };
});
if (messier.length !== 110) throw new Error('Expected 110 Messier objects');
// M73 / M40 / M24 are asterisms / star clouds; tidy common names.
for (const m of messier) {
  if (m.id === 'M73') m.commonName = null;
  if (m.id === 'M24') m.commonName = 'Sagittarius Star Cloud';
}
writeFileSync(join(out, 'messier.json'), JSON.stringify({ version: 1, objects: messier }));

console.log(
  `stars: ${stars.length}, named: ${Object.keys(starNames).length}, constellations: ${constellationList.length}, messier: ${messier.length}`,
);
