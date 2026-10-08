import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { Icon } from '../../components/Icon';
import { objectName, resolveObject, targetOf } from '../../catalog/object-registry';
import type { LanguageCode } from '../../catalog/types';
import type { TargetScreenInfo } from '../../sky/types';
import { useCatalogStore } from '../../store/catalog-store';
import { useSkyStore } from '../../store/sky-store';
import { formatEventTime, formatNumber } from '../../utils/format';
import { useObserver } from '../../utils/use-observer';
import { skyBridge } from '../sky/sky-bridge';
import { NEAR_DEG, ON_TARGET_DEG, navigationHints } from './navigation-hints';

/** "Find in Sky": arrow toward the target plus turn instructions. */
export function Navigator() {
  const { t, i18n } = useTranslation();
  const platform = usePlatform();
  const targetId = useSkyStore((s) => s.navigationTargetId);
  const stop = useSkyStore((s) => s.stopNavigation);
  const viewMode = useSkyStore((s) => s.viewMode);
  const catalog = useCatalogStore((s) => s.catalog);
  const observer = useObserver();
  const [info, setInfo] = useState<TargetScreenInfo | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    if (!targetId) {
      setInfo(null);
      return;
    }
    return skyBridge.subscribe((f) => setInfo(f.target && f.target.id === targetId ? f.target : null));
  }, [targetId]);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const ref = useMemo(() => (targetId ? resolveObject(targetId, catalog) : null), [targetId, catalog]);
  const riseSet = useMemo(
    () => (ref ? platform.astronomy.getRiseSet(targetOf(ref), platform.time.now(), observer) : null),
    [ref, platform, observer],
  );

  if (!targetId || !ref) return null;
  const name = objectName(ref, t, i18n.language as LanguageCode);
  const below = info ? info.targetAltitude < 0 : false;
  const onTarget = info ? info.separation < ON_TARGET_DEG : false;
  const near = info ? info.separation < NEAR_DEG : false;

  const radius = Math.min(size.w, size.h) * 0.32;
  const angle = info?.screenAngle ?? Math.PI / 2;
  const arrowX = size.w / 2 + Math.cos(angle) * radius;
  const arrowY = size.h / 2 - Math.sin(angle) * radius;
  const rotationDeg = 90 - (angle * 180) / Math.PI;

  return (
    <>
      {info && !info.onScreen && (
        <div
          className="nav-arrow"
          style={{
            transform: `translate(${arrowX}px, ${arrowY}px) translate(-50%, -50%) rotate(${rotationDeg}deg)`,
          }}
          aria-hidden="true"
          data-testid="nav-arrow"
        >
          <Icon name="arrow" size={44} />
        </div>
      )}
      <section className="navigator glass" aria-live="polite" data-testid="navigator">
        <div className="navigator-head">
          <strong>
            {t('navigator.title')}: {name}
          </strong>
          <button type="button" className="btn btn-small" onClick={stop} data-testid="navigator-stop">
            <Icon name="stop" size={14} /> {t('navigator.stop')}
          </button>
        </div>
        {below && (
          <p className="navigator-warning" data-testid="navigator-below">
            {riseSet?.neverUp
              ? t('visibility.neverRisesNamed', { name })
              : t('visibility.belowHorizonNamed', { name })}{' '}
            {!riseSet?.neverUp && riseSet?.rise && (
              <span>
                {t('visibility.risesAt', {
                  time: formatEventTime(riseSet.rise, platform.time.now(), i18n.language),
                })}
              </span>
            )}
          </p>
        )}
        {info &&
          (onTarget ? (
            <p className="navigator-ok">{t('navigator.onTarget', { name })}</p>
          ) : (
            <p className="navigator-hints">
              {navigationHints(info).map((h) => (
                <span key={h.key} className="hint-pill">
                  {t(h.key, { value: formatNumber(h.value, i18n.language, 0) })}
                </span>
              ))}
              <span className="muted">
                {near
                  ? t('navigator.almost')
                  : t('navigator.away', {
                      value: formatNumber(Math.round(info.separation), i18n.language, 0),
                    })}
              </span>
            </p>
          ))}
        {ref.kind === 'meteor' && (
          <p className="navigator-sub" data-testid="navigator-meteor-hint">
            {t('meteors.radiantHint')}
          </p>
        )}
        {!onTarget && (
          <p className="navigator-sub muted">
            {below
              ? t('navigator.belowHorizonHint')
              : viewMode === 'sensor'
                ? t('navigator.hintSensor')
                : t('navigator.hintFree')}
          </p>
        )}
      </section>
    </>
  );
}
