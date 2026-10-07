import type { PracticalStatus } from '../../astronomy/naked-eye';

/** CSS class per practical naked-eye status. */
export const PRACTICAL_CLASS: Record<PracticalStatus, string> = {
  visible: 'vis-up',
  difficult: 'vis-difficult',
  notPractical: 'vis-not',
  belowHorizon: 'vis-down',
};
