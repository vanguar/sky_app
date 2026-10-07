import { useTranslation } from 'react-i18next';
import { Sheet } from '../../components/Sheet';
import { Toggle } from '../../components/Toggle';
import { useSkyStore, type LayerId } from '../../store/sky-store';
import { useUiStore } from '../../store/ui-store';

const GROUPS: { titleKey: string; layers: LayerId[] }[] = [
  { titleKey: 'layers.solarSystem', layers: ['sun', 'moon', 'planets'] },
  {
    titleKey: 'layers.starsGroup',
    layers: ['stars', 'constellationLines', 'constellationNames', 'zodiac', 'constellationBoundaries'],
  },
  { titleKey: 'layers.deepSkyGroup', layers: ['galaxies', 'nebulae', 'clusters'] },
  { titleKey: 'settings.display', layers: ['grid'] },
];

export function LayersSheet() {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.panel === 'layers');
  const close = useUiStore((s) => s.closePanel);
  const layers = useSkyStore((s) => s.layers);
  const setLayer = useSkyStore((s) => s.setLayer);

  return (
    <Sheet open={open} title={t('layers.title')} onClose={close} testId="layers-sheet" modal={false}>
      {GROUPS.map((g) => (
        <section key={g.titleKey} className="sheet-section">
          <h3>{t(g.titleKey)}</h3>
          {g.layers.map((id) => (
            <Toggle
              key={id}
              label={t(`layers.${id}`)}
              hint={id === 'zodiac' ? t('layers.zodiacHint') : undefined}
              checked={layers[id]}
              onChange={(on) => setLayer(id, on)}
              testId={`layer-${id}`}
            />
          ))}
        </section>
      ))}
    </Sheet>
  );
}
