import { useTranslation } from 'react-i18next';

const STAR = 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z';

/** 1–5 star rating (SVG, follows currentColor; the accessible label states the value). */
export function Stars({ value, size = 16, testId }: { value: number; size?: number; testId?: string }) {
  const { t } = useTranslation();
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      className="stars"
      role="img"
      aria-label={t('observing.starsLabel', { value: n })}
      data-testid={testId}
      data-value={n}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d={STAR}
            fill={i < n ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            opacity={i < n ? 1 : 0.45}
          />
        </svg>
      ))}
    </span>
  );
}
