/**
 * Sky darkness from the Sun's apparent altitude (standard definitions):
 *   day           Sun above −0.833° (upper limb on the horizon, with refraction)
 *   civil         −0.833° … −6°
 *   nautical      −6° … −12°
 *   astronomical  −12° … −18°
 *   night         below −18° (astronomical darkness)
 */
export type DarknessPhase = 'day' | 'civil' | 'nautical' | 'astronomical' | 'night';

export const DARKNESS_PHASES: readonly DarknessPhase[] = [
  'day',
  'civil',
  'nautical',
  'astronomical',
  'night',
] as const;

export function darknessPhase(sunAltitudeDeg: number): DarknessPhase {
  if (sunAltitudeDeg > -0.833) return 'day';
  if (sunAltitudeDeg > -6) return 'civil';
  if (sunAltitudeDeg > -12) return 'nautical';
  if (sunAltitudeDeg > -18) return 'astronomical';
  return 'night';
}
