import { create } from 'zustand';
import { loadCatalog } from '../catalog/loader';
import type { Catalog } from '../catalog/types';

interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  catalog: Catalog | null;
  load(): Promise<void>;
}

/** Holds the immutable catalog reference once loaded (data, not UI state). */
export const useCatalogStore = create<CatalogState>()((set, get) => ({
  status: 'idle',
  catalog: null,
  load: async () => {
    if (get().status === 'loading' || get().status === 'ready') return;
    set({ status: 'loading' });
    try {
      const catalog = await loadCatalog();
      set({ catalog, status: 'ready' });
    } catch (e) {
      console.error('[AstroPoint] catalog load failed', e);
      set({ status: 'error' });
    }
  },
}));
