import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PipelineHeadingStatus } from '../sensors/sensor-fusion';
import type { HeadingQuality, SensorStatus } from '../sensors/types';
import { createSafeStorage, isRecord, pickEnum } from './persistence';

export const LAYER_IDS = [
  'sun',
  'moon',
  'planets',
  'stars',
  'zodiac',
  'constellationLines',
  'constellationNames',
  'constellationBoundaries',
  'galaxies',
  'nebulae',
  'clusters',
  'grid',
  /** Meteor shower radiants (active / soon active showers only). Off by default. */
  'meteors',
] as const;
export type LayerId = (typeof LAYER_IDS)[number];
export type Layers = Record<LayerId, boolean>;

export const FILTER_PRESETS = ['all', 'planets', 'stars', 'constellations', 'deepSky'] as const;
export type FilterPreset = (typeof FILTER_PRESETS)[number];

const allOff = (): Layers => Object.fromEntries(LAYER_IDS.map((id) => [id, false])) as Layers;

/** Layer sets behind the quick filter chips. */
export function layersForPreset(preset: FilterPreset): Layers {
  const l = allOff();
  switch (preset) {
    case 'all':
      Object.assign(l, {
        sun: true,
        moon: true,
        planets: true,
        stars: true,
        constellationLines: true,
        constellationNames: true,
        galaxies: true,
        nebulae: true,
        clusters: true,
      });
      break;
    case 'planets':
      l.planets = true;
      break;
    case 'stars':
      l.stars = true;
      break;
    case 'constellations':
      // Lines connect stars, so the star field stays visible.
      Object.assign(l, { stars: true, constellationLines: true, constellationNames: true });
      break;
    case 'deepSky':
      Object.assign(l, { galaxies: true, nebulae: true, clusters: true });
      break;
  }
  return l;
}

/** Layers kept as they are when a quick filter is applied. */
export const OVERLAY_LAYERS: readonly LayerId[] = ['grid', 'meteors'];

/** Which preset (if any) exactly matches a layer set. */
export function presetForLayers(layers: Layers): FilterPreset | 'custom' {
  for (const p of FILTER_PRESETS) {
    const ref = layersForPreset(p);
    // The horizon grid and meteor radiants are overlays, independent of object filters.
    if (LAYER_IDS.every((id) => OVERLAY_LAYERS.includes(id) || ref[id] === layers[id])) return p;
  }
  return 'custom';
}

export type ViewMode = 'free' | 'sensor';

interface SkyState {
  layers: Layers;
  /** "Visible now": show only objects practically visible to the naked eye. */
  visibleNow: boolean;
  viewMode: ViewMode;
  sensorStatus: SensorStatus;
  headingQuality: HeadingQuality | null;
  /** Compass stabilisation state while phone pointing is active. */
  headingStatus: PipelineHeadingStatus | null;
  selectedId: string | null;
  navigationTargetId: string | null;
  setLayer(id: LayerId, on: boolean): void;
  setVisibleNow(on: boolean): void;
  applyPreset(preset: FilterPreset): void;
  setViewMode(mode: ViewMode): void;
  setSensorStatus(status: SensorStatus): void;
  setHeadingQuality(q: HeadingQuality | null): void;
  setHeadingStatus(s: PipelineHeadingStatus | null): void;
  select(id: string | null): void;
  startNavigation(id: string): void;
  stopNavigation(): void;
}

export const SKY_STORAGE_KEY = 'astropoint.sky';

export function sanitizeLayers(raw: unknown): Layers {
  const defaults = layersForPreset('all');
  if (!isRecord(raw) || !isRecord(raw.layers)) return defaults;
  const src = raw.layers;
  return Object.fromEntries(
    LAYER_IDS.map((id) => [id, typeof src[id] === 'boolean' ? (src[id] as boolean) : defaults[id]]),
  ) as Layers;
}

export const useSkyStore = create<SkyState>()(
  persist(
    (set) => ({
      layers: layersForPreset('all'),
      visibleNow: false,
      viewMode: 'free',
      sensorStatus: 'idle',
      headingQuality: null,
      headingStatus: null,
      selectedId: null,
      navigationTargetId: null,
      setVisibleNow: (visibleNow) => set({ visibleNow }),
      setLayer: (id, on) => set((s) => ({ layers: { ...s.layers, [id]: on } })),
      applyPreset: (preset) =>
        set((s) => ({
          layers: { ...layersForPreset(preset), grid: s.layers.grid, meteors: s.layers.meteors },
        })),
      setViewMode: (viewMode) => set({ viewMode }),
      setSensorStatus: (sensorStatus) => set({ sensorStatus }),
      setHeadingQuality: (headingQuality) => set({ headingQuality }),
      setHeadingStatus: (headingStatus) => set({ headingStatus }),
      select: (selectedId) => set({ selectedId }),
      startNavigation: (id) => set({ navigationTargetId: id, selectedId: id }),
      stopNavigation: () => set({ navigationTargetId: null }),
    }),
    {
      name: SKY_STORAGE_KEY,
      version: 1,
      storage: createSafeStorage<{ layers: Layers; viewMode: ViewMode; visibleNow: boolean }>(),
      partialize: (s) => ({ layers: s.layers, viewMode: s.viewMode, visibleNow: s.visibleNow }),
      merge: (persisted, current) => ({
        ...current,
        layers: sanitizeLayers(persisted),
        visibleNow: isRecord(persisted) && persisted.visibleNow === true,
        // Sensor mode needs a fresh permission each session; start in free mode but remember intent.
        viewMode: isRecord(persisted)
          ? pickEnum(persisted.viewMode, ['free', 'sensor'] as const, 'free')
          : 'free',
      }),
    },
  ),
);
