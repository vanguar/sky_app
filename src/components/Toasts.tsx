import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../store/ui-store';
import { Icon } from './Icon';

export function Toasts() {
  const { t } = useTranslation();
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  useEffect(() => {
    const timers = toasts
      .filter((x) => x.durationMs > 0)
      .map((x) => setTimeout(() => dismiss(x.id), x.durationMs));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast glass tone-${x.tone}`}>
          <span>{t(x.messageKey, x.values)}</span>
          {x.action && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                x.action!.run();
                dismiss(x.id);
              }}
            >
              {t(x.action.labelKey)}
            </button>
          )}
          <button
            type="button"
            className="icon-btn small"
            onClick={() => dismiss(x.id)}
            aria-label={t('common.close')}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
