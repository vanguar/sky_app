import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LanguageCode } from '../catalog/types';
import { isSupportedLanguage } from '../i18n/languages';
import type { SmoothingLevel } from '../sensors/smoothing';
import { createSafeStorage, isRecord, pickBoolean, pickEnum, pickNumber } from './persistence';

export type InfoLevel = 'brief' | 'detailed';

export interface SettingsData {
  /** null until chosen/detected. */
  language: LanguageCode | null;
  nightMode: boolean;
  /** UI + sky brightness multiplier, 0.3 … 1. */
  brightness: number;
  showLabels: boolean;
  infoLevel: InfoLevel;
  smoothing: SmoothingLevel;
  /** Manual compass correction in degrees, −180 … 180. */
  headingOffset: number;
  onboardingDone: boolean;
  /**
   * Observing-conditions forecast enabled. Off until the user accepts that an APPROXIMATE location
   * is sent to the weather provider (opt-in, see PRIVACY.md).
   */
  weatherEnabled: boolean;
}

interface SettingsActions {
  setLanguage(lang: LanguageCode): void;
  setNightMode(on: boolean): void;
  setBrightness(v: number): void;
  setShowLabels(on: boolean): void;
  setInfoLevel(level: InfoLevel): void;
  setSmoothing(level: SmoothingLevel): void;
  setHeadingOffset(deg: number): void;
  completeOnboarding(): void;
  setWeatherEnabled(on: boolean): void;
  resetAll(): void;
}

export type SettingsState = SettingsData & SettingsActions;

export const SETTINGS_STORAGE_KEY = 'astropoint.settings';
export const MIN_BRIGHTNESS = 0.3;

export const DEFAULT_SETTINGS: SettingsData = {
  language: null,
  nightMode: false,
  brightness: 1,
  showLabels: true,
  infoLevel: 'brief',
  smoothing: 'medium',
  headingOffset: 0,
  onboardingDone: false,
  weatherEnabled: false,
};

/** Validates persisted data field by field; anything invalid falls back to the default. */
export function sanitizeSettings(raw: unknown): SettingsData {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  return {
    language: isSupportedLanguage(raw.language) ? raw.language : null,
    nightMode: pickBoolean(raw.nightMode, DEFAULT_SETTINGS.nightMode),
    brightness: pickNumber(raw.brightness, DEFAULT_SETTINGS.brightness, MIN_BRIGHTNESS, 1),
    showLabels: pickBoolean(raw.showLabels, DEFAULT_SETTINGS.showLabels),
    infoLevel: pickEnum(raw.infoLevel, ['brief', 'detailed'] as const, DEFAULT_SETTINGS.infoLevel),
    smoothing: pickEnum(raw.smoothing, ['low', 'medium', 'high'] as const, DEFAULT_SETTINGS.smoothing),
    headingOffset: pickNumber(raw.headingOffset, DEFAULT_SETTINGS.headingOffset, -180, 180),
    onboardingDone: pickBoolean(raw.onboardingDone, DEFAULT_SETTINGS.onboardingDone),
    weatherEnabled: pickBoolean(raw.weatherEnabled, DEFAULT_SETTINGS.weatherEnabled),
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setLanguage: (language) => set({ language }),
      setNightMode: (nightMode) => set({ nightMode }),
      setBrightness: (v) => set({ brightness: Math.min(1, Math.max(MIN_BRIGHTNESS, v)) }),
      setShowLabels: (showLabels) => set({ showLabels }),
      setInfoLevel: (infoLevel) => set({ infoLevel }),
      setSmoothing: (smoothing) => set({ smoothing }),
      setHeadingOffset: (deg) => set({ headingOffset: Math.max(-180, Math.min(180, deg)) }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setWeatherEnabled: (weatherEnabled) => set({ weatherEnabled }),
      resetAll: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: SETTINGS_STORAGE_KEY,
      version: 1,
      storage: createSafeStorage<SettingsData>(),
      partialize: (s): SettingsData => ({
        language: s.language,
        nightMode: s.nightMode,
        brightness: s.brightness,
        showLabels: s.showLabels,
        infoLevel: s.infoLevel,
        smoothing: s.smoothing,
        headingOffset: s.headingOffset,
        onboardingDone: s.onboardingDone,
        weatherEnabled: s.weatherEnabled,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted) }),
    },
  ),
);
