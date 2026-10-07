import type { TargetScreenInfo } from '../../sky/types';

/** Below this separation (degrees) the target counts as "in the crosshair". */
export const ON_TARGET_DEG = 2.5;
export const NEAR_DEG = 8;

export type HintKey = 'navigator.left' | 'navigator.right' | 'navigator.raise' | 'navigator.lower';

/** Turn instructions from azimuth / altitude differences (degrees). */
export function navigationHints(info: Pick<TargetScreenInfo, 'deltaAz' | 'deltaAlt'>, threshold = 1.5) {
  const hints: { key: HintKey; value: number }[] = [];
  if (Math.abs(info.deltaAz) > threshold)
    hints.push({
      key: info.deltaAz > 0 ? 'navigator.right' : 'navigator.left',
      value: Math.round(Math.abs(info.deltaAz)),
    });
  if (Math.abs(info.deltaAlt) > threshold)
    hints.push({
      key: info.deltaAlt > 0 ? 'navigator.raise' : 'navigator.lower',
      value: Math.round(Math.abs(info.deltaAlt)),
    });
  return hints;
}
