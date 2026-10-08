import { create } from 'zustand';
import type { GlobeId } from '../catalog/planets/planet-data';

export type Panel =
  | 'none'
  | 'menu'
  | 'search'
  | 'layers'
  | 'settings'
  | 'location'
  | 'details'
  /** "Tonight" overview: observing conditions + active meteor showers. */
  | 'tonight'
  /** Observing conditions (weather) sheet. */
  | 'weather'
  /** List of all meteor showers of the year. */
  | 'meteors'
  /** One meteor shower card (shower = selected object id "meteor-<code>"). */
  | 'meteor';

export interface Toast {
  id: number;
  /** i18n key */
  messageKey: string;
  values?: Record<string, string | number>;
  tone: 'info' | 'warning' | 'error';
  action?: { labelKey: string; run: () => void };
  durationMs: number;
}

interface UiState {
  panel: Panel;
  viewer3d: GlobeId | null;
  toasts: Toast[];
  openPanel(panel: Panel): void;
  closePanel(): void;
  open3d(body: GlobeId): void;
  close3d(): void;
  pushToast(t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }): number;
  dismissToast(id: number): void;
}

let toastSeq = 1;

export const useUiStore = create<UiState>()((set, get) => ({
  panel: 'none',
  viewer3d: null,
  toasts: [],
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: 'none' }),
  open3d: (viewer3d) => set({ viewer3d }),
  close3d: () => set({ viewer3d: null }),
  pushToast: (t) => {
    const id = toastSeq++;
    // De-duplicate identical messages that are already visible.
    const existing = get().toasts.find((x) => x.messageKey === t.messageKey);
    if (existing) return existing.id;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { durationMs: 5000, ...t, id }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
