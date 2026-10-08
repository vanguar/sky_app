import { raDecToVector } from '../astronomy/coordinate-transform';
import type { RadiantRenderItem } from '../sky/types';
import { showerActivity } from './activity';
import { METEOR_SHOWERS, meteorObjectId } from './catalog';
import { radiantAt } from './radiant';

/**
 * Radiants worth showing on the map at `t`: active showers and those starting within a week.
 * The whole year's showers are never shown at once.
 */
export function radiantRenderItems(t: number): RadiantRenderItem[] {
  const out: RadiantRenderItem[] = [];
  for (const def of METEOR_SHOWERS) {
    const a = showerActivity(def, t);
    if (a.status === 'inactive') continue;
    const r = radiantAt(def, a.occurrence, t);
    out.push({ id: meteorObjectId(def.id), code: def.code, eqj: raDecToVector(r.raDeg, r.decDeg), status: a.status });
  }
  return out;
}
