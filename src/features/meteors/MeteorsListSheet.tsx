import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { showerActivity } from '../../meteors/activity';
import { METEOR_SHOWERS, meteorObjectId } from '../../meteors/catalog';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { formatDayMonth, formatNumber } from '../../utils/format';
import { useNow } from '../../utils/use-now';

/** All showers of the catalog in chronological order of their next/current activity. */
export function MeteorsListSheet() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const open = useUiStore((s) => s.panel === 'meteors');
  const close = useUiStore((s) => s.closePanel);
  const openPanel = useUiStore((s) => s.openPanel);
  const select = useSkyStore((s) => s.select);
  const now = useNow(60_000);
  const day = Math.floor(now.getTime() / 3_600_000);

  const rows = useMemo(
    () =>
      METEOR_SHOWERS.map((def) => ({ def, activity: showerActivity(def, now.getTime()) })).sort(
        (a, b) => a.activity.occurrence.peak - b.activity.occurrence.peak,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day],
  );

  return (
    <Sheet open={open} title={t('meteors.title')} onClose={close} testId="meteors-list" className="sheet-tall">
      <ul className="result-list">
        {rows.map(({ def, activity }) => (
          <li key={def.id} className="result-item">
            <button
              type="button"
              className="result-main"
              onClick={() => {
                select(meteorObjectId(def.id));
                openPanel('meteor');
              }}
              data-testid={`meteor-row-${def.id}`}
            >
              <span className="result-name">
                {t(`meteors.names.${def.id}`)} <span className="muted small" dir="ltr">{def.code}</span>
              </span>
              <span className="result-meta">
                <span className={`meteor-status ${activity.status}`}>{t(`meteors.status.${activity.status}`)}</span>
                {' · '}
                {t('meteors.peak')}{' '}
                <span dir="ltr">{formatDayMonth(new Date(activity.occurrence.peak), lang, 'UTC')}</span>
                {' · '}
                {t('meteors.zhr')}{' '}
                <span dir="ltr">
                  {activity.occurrence.zhr == null
                    ? t('meteors.zhrVariableShort')
                    : `~${formatNumber(activity.occurrence.zhr, lang, 0)}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="small muted">{t('meteors.zhrExplain')}</p>
      <p className="small muted">{t('meteors.source')}</p>
    </Sheet>
  );
}
