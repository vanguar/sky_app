import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { azimuthToCompassPoint } from '../../astronomy/coordinate-transform';
import { formatDegrees } from '../../utils/format';
import { skyBridge } from './sky-bridge';

/** Aiming reticle with a compact readout of where the view centre points. */
export function Crosshair() {
  const { t, i18n } = useTranslation();
  const [center, setCenter] = useState<{ alt: number; az: number } | null>(null);

  useEffect(
    () =>
      skyBridge.subscribe((info) => {
        const alt = Math.round(info.centerAltitude);
        const az = Math.round(info.centerAzimuth) % 360;
        setCenter((prev) => (prev && prev.alt === alt && prev.az === az ? prev : { alt, az }));
      }),
    [],
  );

  return (
    <div className="crosshair" aria-hidden={center ? undefined : true}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
        <path
          d="M32 6v12M32 46v12M6 32h12M46 32h12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {center && (
        <div className="crosshair-readout" dir="ltr">
          <span className="sr-only">
            {t('modes.viewCenter', {
              alt: formatDegrees(center.alt, i18n.language, 0),
              az: formatDegrees(center.az, i18n.language, 0),
            })}
          </span>
          <span aria-hidden="true">
            {formatDegrees(center.alt, i18n.language, 0)} ·{' '}
            {t(`cardinal.${azimuthToCompassPoint(center.az)}`)} {formatDegrees(center.az, i18n.language, 0)}
          </span>
        </div>
      )}
    </div>
  );
}
