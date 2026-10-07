import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSkyStore } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';

/** Compass stabilisation status shown while phone pointing is active. */
export function SensorStatus() {
  const { t } = useTranslation();
  const viewMode = useSkyStore((s) => s.viewMode);
  const status = useSkyStore((s) => s.headingStatus);
  const openPanel = useUiStore((s) => s.openPanel);
  const [showReady, setShowReady] = useState(false);

  useEffect(() => {
    if (status !== 'ready') return;
    setShowReady(true);
    const id = setTimeout(() => setShowReady(false), 2500);
    return () => clearTimeout(id);
  }, [status]);

  if (viewMode !== 'sensor' || !status) return null;
  if (status === 'ready' && !showReady) return null;

  const warn = status === 'unreliable' || status === 'uncalibrated';
  const text =
    status === 'collecting'
      ? t('sensors.calibrating')
      : status === 'ready'
        ? t('sensors.ready')
        : status === 'unreliable'
          ? t('sensors.needsCalibration')
          : t('sensors.uncalibrated');

  return (
    <div className={`sensor-status glass ${warn ? 'warn' : ''}`} role="status" data-testid="sensor-status">
      <span>{text}</span>
      {warn && (
        <button type="button" className="btn btn-small" onClick={() => openPanel('settings')}>
          {t('sensors.calibrateAction')}
        </button>
      )}
    </div>
  );
}
