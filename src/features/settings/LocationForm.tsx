import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { Icon } from '../../components/Icon';
import { LocationError } from '../../platform/location/location-provider';
import { isValidLatitude, isValidLongitude, useLocationStore } from '../../store/location-store';

interface Props {
  onDone?(): void;
  /** Show the manual form immediately (otherwise after a GPS failure or on request). */
  initiallyManual?: boolean;
}

function parseCoordinate(v: string): number {
  return Number(v.trim().replace(',', '.').replace('−', '-'));
}

/** GPS request with friendly errors + manual latitude/longitude entry. */
export function LocationForm({ onDone, initiallyManual = false }: Props) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const location = useLocationStore((s) => s.location);
  const setLocation = useLocationStore((s) => s.setLocation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(initiallyManual);
  const [lat, setLat] = useState(location.source === 'default' ? '' : String(location.latitude));
  const [lon, setLon] = useState(location.source === 'default' ? '' : String(location.longitude));
  const [invalid, setInvalid] = useState(false);

  const useGps = async () => {
    setBusy(true);
    setError(null);
    try {
      const fix = await platform.location.getCurrentPosition();
      setLocation({
        latitude: fix.latitude,
        longitude: fix.longitude,
        elevation: Math.max(0, fix.elevation),
        source: 'gps',
      });
      onDone?.();
    } catch (e) {
      const code = e instanceof LocationError ? e.code : 'unavailable';
      setError(t(`location.errors.${code}`));
      setManual(true);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const la = parseCoordinate(lat);
    const lo = parseCoordinate(lon);
    if (!isValidLatitude(la) || !isValidLongitude(lo) || lat.trim() === '' || lon.trim() === '') {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setLocation({ latitude: la, longitude: lo, elevation: 0, source: 'manual' });
    onDone?.();
  };

  return (
    <div className="location-form">
      <button
        type="button"
        className="btn btn-accent btn-block"
        onClick={useGps}
        disabled={busy}
        data-testid="use-gps"
      >
        <Icon name="pin" size={18} /> {busy ? t('onboarding.locating') : t('location.useGps')}
      </button>
      {error && (
        <p className="form-error" role="alert" data-testid="location-error">
          {error}
        </p>
      )}
      {!manual ? (
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => setManual(true)}
          data-testid="enter-manually"
        >
          {t('onboarding.enterManually')}
        </button>
      ) : (
        <form className="manual-form" onSubmit={submit} noValidate>
          <label>
            <span>{t('location.latitude')}</span>
            <input
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="50.45"
              dir="ltr"
              aria-describedby="lat-hint"
              data-testid="lat-input"
            />
            <small id="lat-hint">{t('location.latitudeHint')}</small>
          </label>
          <label>
            <span>{t('location.longitude')}</span>
            <input
              inputMode="decimal"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              placeholder="30.52"
              dir="ltr"
              aria-describedby="lon-hint"
              data-testid="lon-input"
            />
            <small id="lon-hint">{t('location.longitudeHint')}</small>
          </label>
          {invalid && (
            <p className="form-error" role="alert">
              {t('location.invalid')}
            </p>
          )}
          <button type="submit" className="btn btn-block" data-testid="apply-location">
            {t('common.apply')}
          </button>
        </form>
      )}
      <p className="hint small">{t('location.privacy')}</p>
    </div>
  );
}
