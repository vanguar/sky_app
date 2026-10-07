import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { FILTER_PRESETS, presetForLayers, useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';

/** Bottom quick filters (exclusive presets) + layers button. */
export function FilterBar() {
  const { t } = useTranslation();
  const layers = useSkyStore((s) => s.layers);
  const applyPreset = useSkyStore((s) => s.applyPreset);
  const openPanel = useUiStore((s) => s.openPanel);
  const visibleNow = useSkyStore((s) => s.visibleNow);
  const setVisibleNow = useSkyStore((s) => s.setVisibleNow);
  const active = presetForLayers(layers);

  return (
    <nav className="filterbar glass" aria-label={t('filters.label')}>
      <div className="filter-chips" role="radiogroup" aria-label={t('filters.label')}>
        {FILTER_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active === p}
            className={`filter-chip ${active === p ? 'active' : ''}`}
            onClick={() => applyPreset(p)}
            data-testid={`filter-${p}`}
          >
            {t(`filters.${p}`)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`filter-chip visible-now-btn ${visibleNow ? 'active' : ''}`}
        aria-pressed={visibleNow}
        onClick={() => setVisibleNow(!visibleNow)}
        aria-label={t('filters.visibleNow')}
        title={t('practical.note')}
        data-testid="filter-visible-now"
      >
        <Icon name="eye" size={18} />
        <span className="layers-label">{t('filters.visibleNow')}</span>
      </button>
      <button
        type="button"
        className={`filter-chip layers-btn ${active === 'custom' ? 'active' : ''}`}
        onClick={() => openPanel('layers')}
        aria-label={t('filters.layers')}
        data-testid="open-layers"
      >
        <Icon name="layers" size={18} />
        <span className="layers-label">{t('filters.layers')}</span>
      </button>
    </nav>
  );
}
