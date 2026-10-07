import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { useLocationStore } from '../../store/location-store';
import { useUiStore } from '../../store/ui-store';
import { formatLatLon } from '../../utils/format';
import { LocationForm } from './LocationForm';

export function LocationSheet() {
  const { t, i18n } = useTranslation();
  const open = useUiStore((s) => s.panel === 'location');
  const close = useUiStore((s) => s.closePanel);
  const pushToast = useUiStore((s) => s.pushToast);
  const loc = useLocationStore((s) => s.location);

  return (
    <Sheet open={open} title={t('location.title')} onClose={close} testId="location-sheet">
      <p className="current-location">
        <span className="muted">{t('location.current')}: </span>
        <strong dir="ltr">{formatLatLon(loc.latitude, loc.longitude, i18n.language)}</strong>{' '}
        <span className="muted">({t(`location.source.${loc.source}`)})</span>
      </p>
      {loc.source === 'default' && <p className="hint">{t('location.defaultNotice')}</p>}
      <LocationForm
        onDone={() => {
          pushToast({ messageKey: 'location.updated', tone: 'info', durationMs: 2500 });
          close();
        }}
      />
    </Sheet>
  );
}
