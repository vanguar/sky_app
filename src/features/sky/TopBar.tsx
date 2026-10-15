import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { useLocationStore } from '../../store/location-store';
import { useUiStore } from '../../store/ui-store';
import { formatLatLon, formatTime } from '../../utils/format';
import { useNow } from '../../utils/use-now';
import { useObserverTimeZone } from '../../utils/use-observer-time-zone';

export function TopBar() {
  const { t, i18n } = useTranslation();
  const openPanel = useUiStore((s) => s.openPanel);
  const loc = useLocationStore((s) => s.location);
  const now = useNow(10000);
  const zone = useObserverTimeZone();

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn glass"
        onClick={() => openPanel('menu')}
        aria-label={t('topbar.menu')}
      >
        <Icon name="menu" />
      </button>
      <button
        type="button"
        className="chip glass location-chip"
        onClick={() => openPanel('location')}
        aria-label={t('topbar.location')}
        data-testid="location-chip"
      >
        <Icon name="pin" size={16} />
        <span dir="ltr" className={loc.source === 'default' ? 'muted' : ''}>
          {formatLatLon(loc.latitude, loc.longitude, i18n.language)}
        </span>
      </button>
      <div
        className="chip glass time-chip"
        aria-label={t('topbar.time')}
        title={zone.approximate ? t('observing.timeZoneApprox', { zone: zone.label }) : zone.timeZone}
        role="timer"
      >
        <span dir="ltr">{formatTime(now, i18n.language, zone.timeZone)}</span>
      </div>
      <div className="topbar-spacer" />
      <button
        type="button"
        className="icon-btn glass"
        onClick={() => openPanel('tonight')}
        aria-label={t('tonight.open')}
        title={t('tonight.open')}
        data-testid="open-tonight"
      >
        <Icon name="tonight" />
      </button>
      <button
        type="button"
        className="icon-btn glass"
        onClick={() => openPanel('search')}
        aria-label={t('topbar.search')}
        data-testid="open-search"
      >
        <Icon name="search" />
      </button>
      <button
        type="button"
        className="icon-btn glass"
        onClick={() => openPanel('settings')}
        aria-label={t('topbar.settings')}
        data-testid="open-settings"
      >
        <Icon name="settings" />
      </button>
    </header>
  );
}
