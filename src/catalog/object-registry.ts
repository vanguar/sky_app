import type { TFunction } from 'i18next';
import { SOLAR_BODY_IDS, type SkyTarget, type SolarBodyId } from '../astronomy/types';
import { constellationName } from './constellations/constellations';
import { starDesignation, starProperName } from './stars/stars';
import type { Catalog, LanguageCode, SkyObjectRef } from './types';
import { timeController } from '../astronomy/time-controller';
import { showerFromObjectId } from '../meteors/catalog';
import { showerActivity } from '../meteors/activity';
import { radiantAt } from '../meteors/radiant';

export function isSolarBodyId(id: string): id is SolarBodyId {
  return (SOLAR_BODY_IDS as readonly string[]).includes(id);
}

/** Resolves any object id ("jupiter", "hip-32349", "m31", "con-ori") to a reference. */
export function resolveObject(id: string, catalog: Catalog | null): SkyObjectRef | null {
  if (isSolarBodyId(id)) {
    const kind = id === 'sun' ? 'sun' : id === 'moon' ? 'moon' : 'planet';
    return { kind, id, body: id };
  }
  const shower = showerFromObjectId(id);
  if (shower) {
    // Radiants drift slowly (≈1°/day): the position for the current observation time is enough.
    const t = timeController.nowMs();
    const r = radiantAt(shower, showerActivity(shower, t).occurrence, t);
    return { kind: 'meteor', id, shower, raDeg: r.raDeg, decDeg: r.decDeg };
  }
  if (!catalog) return null;
  if (id.startsWith('hip-')) {
    const star = catalog.stars.byHip.get(Number(id.slice(4)));
    return star ? { kind: 'star', id, star } : null;
  }
  if (id.startsWith('con-')) {
    const abbr = id.slice(4);
    const c = catalog.constellations.find((x) => x.abbr.toLowerCase() === abbr);
    return c ? { kind: 'constellation', id, constellation: c } : null;
  }
  if (/^m\d{1,3}$/.test(id)) {
    const m = catalog.messier.find((x) => x.id === id);
    return m ? { kind: 'messier', id, messier: m } : null;
  }
  return null;
}

/** Astronomical target for position / visibility computations. */
export function targetOf(ref: SkyObjectRef): SkyTarget {
  switch (ref.kind) {
    case 'sun':
    case 'moon':
    case 'planet':
      return { kind: 'body', body: ref.body };
    case 'star':
      return { kind: 'fixed', raHours: ref.star.raDeg / 15, decDeg: ref.star.decDeg };
    case 'messier':
      return { kind: 'fixed', raHours: ref.messier.raDeg / 15, decDeg: ref.messier.decDeg };
    case 'constellation': {
      const [ra, dec] = ref.constellation.labels[0];
      return { kind: 'fixed', raHours: ra / 15, decDeg: dec };
    }
    case 'meteor':
      return { kind: 'fixed', raHours: ref.raDeg / 15, decDeg: ref.decDeg };
  }
}

/** Primary display name in the current language. */
export function objectName(ref: SkyObjectRef, t: TFunction, lang: LanguageCode): string {
  switch (ref.kind) {
    case 'sun':
    case 'moon':
    case 'planet':
      return t(`bodies.${ref.body}`);
    case 'star':
      return starProperName(ref.star, lang) ?? starDesignation(ref.star);
    case 'messier': {
      const key = `messierNames.${ref.messier.designation}`;
      const localized = t(key, { defaultValue: '' });
      const common = localized || ref.messier.commonName;
      return common ? `${ref.messier.designation} · ${common}` : ref.messier.designation;
    }
    case 'constellation':
      return constellationName(ref.constellation, lang);
    case 'meteor':
      return t(`meteors.names.${ref.shower.id}`);
  }
}

/** i18n key of the object type. */
export function objectTypeKey(ref: SkyObjectRef): string {
  switch (ref.kind) {
    case 'sun':
      return 'types.sun';
    case 'moon':
      return 'types.moon';
    case 'planet':
      return 'types.planet';
    case 'star':
      return 'types.star';
    case 'messier':
      return `types.${ref.messier.subtype ?? ref.messier.category}`;
    case 'constellation':
      return ref.constellation.zodiac ? 'types.zodiacConstellation' : 'types.constellation';
    case 'meteor':
      return 'types.meteorRadiant';
  }
}
