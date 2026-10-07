import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  /** Extra content rendered in the header (e.g. actions). */
  headerExtra?: ReactNode;
  className?: string;
  testId?: string;
  /** Non-modal sheets let the user keep interacting with the sky behind them. */
  modal?: boolean;
}

/** Mobile bottom sheet / desktop side card, with Escape to close and focus management. */
export function Sheet({
  open,
  title,
  onClose,
  children,
  headerExtra,
  className,
  testId,
  modal = true,
}: SheetProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const focusTarget = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
    focusTarget?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      {modal && <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />}
      <div
        ref={ref}
        className={`sheet glass ${className ?? ''}`}
        role="dialog"
        aria-modal={modal}
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid={testId}
      >
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-header">
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          {headerExtra}
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
