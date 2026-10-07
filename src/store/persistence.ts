import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * localStorage-backed storage for zustand/persist that never throws:
 *  - storage unavailable (private mode, disabled cookies) → behaves as empty;
 *  - corrupted JSON → entry is discarded and defaults are used;
 *  - quota errors on write are ignored.
 */
export function createSafeStorage<T>(): PersistStorage<T> {
  const ls = (): Storage | null => {
    try {
      return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch {
      return null;
    }
  };
  return {
    getItem(name: string): StorageValue<T> | null {
      const storage = ls();
      if (!storage) return null;
      let raw: string | null = null;
      try {
        raw = storage.getItem(name);
      } catch {
        return null;
      }
      if (raw == null) return null;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) throw new Error('bad shape');
        return parsed as StorageValue<T>;
      } catch {
        try {
          storage.removeItem(name);
        } catch {
          /* ignore */
        }
        return null;
      }
    },
    setItem(name: string, value: StorageValue<T>): void {
      try {
        ls()?.setItem(name, JSON.stringify(value));
      } catch {
        /* quota exceeded or storage disabled: settings simply won't persist */
      }
    },
    removeItem(name: string): void {
      try {
        ls()?.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function pickBoolean(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function pickNumber(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

export function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}
