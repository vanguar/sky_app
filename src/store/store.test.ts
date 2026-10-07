// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, sanitizeSettings, useSettingsStore } from './settings-store';
import { DEFAULT_LOCATION, LOCATION_STORAGE_KEY, sanitizeLocation, useLocationStore } from './location-store';
import { layersForPreset, presetForLayers, sanitizeLayers, useSkyStore } from './sky-store';

beforeEach(() => {
  localStorage.clear();
});

describe('settings persistence', () => {
  it('persists changes to localStorage', () => {
    useSettingsStore.getState().setLanguage('de');
    useSettingsStore.getState().setNightMode(true);
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!);
    expect(stored.state.language).toBe('de');
    expect(stored.state.nightMode).toBe(true);
    expect(stored.state).not.toHaveProperty('setLanguage');
  });

  it('rehydrates stored settings', async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { ...DEFAULT_SETTINGS, language: 'ar', brightness: 0.5 }, version: 1 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe('ar');
    expect(useSettingsStore.getState().brightness).toBe(0.5);
  });

  it('survives corrupted JSON and falls back to defaults', async () => {
    useSettingsStore.getState().resetAll();
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().language).toBe(DEFAULT_SETTINGS.language);
    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBe('{not json');
  });

  it('sanitizes invalid fields individually', () => {
    const s = sanitizeSettings({
      language: 'xx',
      brightness: 7,
      nightMode: 'yes',
      smoothing: 'high',
      headingOffset: 12,
    });
    expect(s.language).toBeNull();
    expect(s.brightness).toBe(DEFAULT_SETTINGS.brightness);
    expect(s.nightMode).toBe(false);
    expect(s.smoothing).toBe('high');
    expect(s.headingOffset).toBe(12);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps brightness and heading offset in setters', () => {
    useSettingsStore.getState().setBrightness(0);
    expect(useSettingsStore.getState().brightness).toBeCloseTo(0.3);
    useSettingsStore.getState().setHeadingOffset(500);
    expect(useSettingsStore.getState().headingOffset).toBe(180);
  });
});

describe('location persistence', () => {
  it('stores manual coordinates', () => {
    useLocationStore
      .getState()
      .setLocation({ latitude: 50.45, longitude: 30.52, elevation: 0, source: 'manual' });
    const stored = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY)!);
    expect(stored.state.location.latitude).toBe(50.45);
    expect(stored.state.location.source).toBe('manual');
  });

  it('rejects out-of-range or malformed coordinates', () => {
    expect(sanitizeLocation({ location: { latitude: 120, longitude: 0 } })).toEqual(DEFAULT_LOCATION);
    expect(sanitizeLocation({ location: { latitude: '10', longitude: 0 } })).toEqual(DEFAULT_LOCATION);
    expect(sanitizeLocation('garbage')).toEqual(DEFAULT_LOCATION);
    const ok = sanitizeLocation({ location: { latitude: -33.9, longitude: 151.2, source: 'gps' } });
    expect(ok.latitude).toBe(-33.9);
    expect(ok.source).toBe('gps');
  });
});

describe('layers & filters', () => {
  it('maps presets to layer sets', () => {
    const planets = layersForPreset('planets');
    expect(planets.planets).toBe(true);
    expect(planets.stars).toBe(false);
    expect(planets.galaxies).toBe(false);
    const deep = layersForPreset('deepSky');
    expect(deep.galaxies && deep.nebulae && deep.clusters).toBe(true);
    expect(deep.planets).toBe(false);
  });

  it('recognises the active preset and custom combinations', () => {
    expect(presetForLayers(layersForPreset('constellations'))).toBe('constellations');
    expect(presetForLayers({ ...layersForPreset('all'), grid: true })).toBe('all');
    expect(presetForLayers({ ...layersForPreset('all'), zodiac: true })).toBe('custom');
  });

  it('applies presets in the store and keeps the grid toggle', () => {
    useSkyStore.getState().setLayer('grid', true);
    useSkyStore.getState().applyPreset('planets');
    const l = useSkyStore.getState().layers;
    expect(l.planets).toBe(true);
    expect(l.stars).toBe(false);
    expect(l.grid).toBe(true);
  });

  it('sanitizes persisted layers', () => {
    const l = sanitizeLayers({ layers: { stars: false, planets: 'x' } });
    expect(l.stars).toBe(false);
    expect(l.planets).toBe(true);
  });
});
