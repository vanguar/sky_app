import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { Icon } from '../../components/Icon';
import { useLocationStore } from '../../store/location-store';
import { useSkyStore } from '../../store/sky-store';
import { disableSensorMode, enableSensorMode } from './sensor-mode';
import { skyBridge } from './sky-bridge';

/** Floating controls: phone-pointing toggle, reset view, zoom. */
export function ModeControls() {
  const { t } = useTranslation();
  const platform = usePlatform();
  const viewMode = useSkyStore((s) => s.viewMode);
  const status = useSkyStore((s) => s.sensorStatus);
  const latitude = useLocationStore((s) => s.location.latitude);
  const sensorOn = viewMode === 'sensor';

  return (
    <div className="mode-controls">
      <button
        type="button"
        className={`fab glass ${sensorOn ? 'active' : ''}`}
        aria-pressed={sensorOn}
        aria-label={sensorOn ? t('modes.disableSensor') : t('modes.enableSensor')}
        title={sensorOn ? t('modes.sensorOn') : t('modes.sensorOff')}
        disabled={status === 'requesting'}
        onClick={() => {
          if (sensorOn) disableSensorMode(platform);
          else void enableSensorMode(platform);
        }}
        data-testid="toggle-sensor"
      >
        <Icon name="phone" />
      </button>
      <button
        type="button"
        className="fab glass"
        aria-label={t('modes.resetView')}
        title={t('modes.resetView')}
        onClick={() => {
          if (sensorOn) disableSensorMode(platform);
          skyBridge.renderer?.resetView(latitude);
        }}
      >
        <Icon name="compass" />
      </button>
      <button
        type="button"
        className="fab glass"
        aria-label={t('modes.zoomIn')}
        onClick={() => skyBridge.renderer?.zoomBy(0.7)}
      >
        <Icon name="plus" />
      </button>
      <button
        type="button"
        className="fab glass"
        aria-label={t('modes.zoomOut')}
        onClick={() => skyBridge.renderer?.zoomBy(1 / 0.7)}
      >
        <Icon name="minus" />
      </button>
    </div>
  );
}
