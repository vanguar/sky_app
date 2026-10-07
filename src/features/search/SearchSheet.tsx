import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { Sheet } from '../../components/Sheet';
import { objectName, objectTypeKey, resolveObject } from '../../catalog/object-registry';
import { practicalVisibilityOf } from '../../catalog/practical';
import { PRACTICAL_CLASS } from '../object-details/practical-ui';
import type { LanguageCode } from '../../catalog/types';
import { RESOURCES } from '../../i18n/languages';
import { useCatalogStore } from '../../store/catalog-store';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';
import { formatDegrees } from '../../utils/format';
import { useObserver } from '../../utils/use-observer';
import { buildSearchIndex, searchIndex } from './search-index';

export function SearchSheet() {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const open = useUiStore((s) => s.panel === 'search');
  const openPanel = useUiStore((s) => s.openPanel);
  const close = useUiStore((s) => s.closePanel);
  const catalog = useCatalogStore((s) => s.catalog);
  const select = useSkyStore((s) => s.select);
  const startNavigation = useSkyStore((s) => s.startNavigation);
  const observer = useObserver();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const lang = i18n.language as LanguageCode;

  const index = useMemo(() => (catalog ? buildSearchIndex(catalog, RESOURCES) : []), [catalog]);

  const results = useMemo(() => {
    if (!open || !deferred.trim()) return [];
    const now = platform.time.now();
    return searchIndex(index, deferred, 25)
      .map((hit) => {
        const ref = resolveObject(hit.id, catalog);
        if (!ref) return null;
        const vis = practicalVisibilityOf(ref, catalog, platform.astronomy, now, observer);
        return { id: hit.id, name: objectName(ref, t, lang), type: t(objectTypeKey(ref)), vis };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [open, deferred, index, catalog, platform, observer, t, lang]);

  return (
    <Sheet open={open} title={t('search.title')} onClose={close} testId="search-sheet" className="sheet-tall">
      <input
        type="search"
        className="search-input"
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-autofocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        data-testid="search-input"
      />
      {!query.trim() && <p className="hint">{t('search.hint')}</p>}
      {query.trim() && results.length === 0 && deferred === query && (
        <p className="hint">{t('search.noResults')}</p>
      )}
      <ul className="result-list" aria-live="polite">
        {results.map((r) => (
          <li key={r.id} className="result-item">
            <button
              type="button"
              className="result-main"
              onClick={() => {
                select(r.id);
                openPanel('details');
              }}
              data-testid={`result-${r.id}`}
            >
              <span className="result-name">{r.name}</span>
              <span className="result-meta">
                {r.type} ·{' '}
                <span className={PRACTICAL_CLASS[r.vis.status]} data-testid={`result-status-${r.id}`}>
                  {t(`practical.${r.vis.status}`)}
                </span>{' '}
                <span dir="ltr">{formatDegrees(r.vis.altitude, i18n.language, 0)}</span>
              </span>
            </button>
            <button
              type="button"
              className="btn btn-small btn-accent"
              onClick={() => {
                startNavigation(r.id);
                close();
              }}
              data-testid={`find-${r.id}`}
            >
              {t('search.findInSky')}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
