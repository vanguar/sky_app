import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/format';
import type { ConditionsGrade } from '../../weather/observing-conditions';

export const GRADE_CLASS: Record<ConditionsGrade, string> = {
  excellent: 'grade-excellent',
  good: 'grade-good',
  fair: 'grade-fair',
  poor: 'grade-poor',
  bad: 'grade-bad',
};


/** "47 min" / "2 h" — age of data, without plural forms (works in all 8 languages). */
export function formatAge(ms: number, t: TFunction, lang: string): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return t('units.minutesShort', { value: formatNumber(min, lang, 0) });
  const h = ms / 3600000;
  return t('units.hours', { value: formatNumber(h, lang, h < 10 ? 1 : 0) });
}

/** Translated reason; meteor-specific codes live under meteors.reasons, weather ones under observing.reasons. */
export function useReasonText() {
  const { t, i18n } = useTranslation();
  return (code: string) =>
    i18n.exists(`meteors.reasons.${code}`) ? t(`meteors.reasons.${code}`) : t(`observing.reasons.${code}`);
}
