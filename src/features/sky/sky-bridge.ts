import type { SkyRenderer } from '../../sky/SkyRenderer';
import type { FrameInfo } from '../../sky/types';

/**
 * Thin bridge between React features and the imperative renderer:
 * the current renderer instance plus a throttled frame-info stream (≈10 Hz).
 */
type Listener = (info: FrameInfo) => void;

let current: SkyRenderer | null = null;
let lastInfo: FrameInfo | null = null;
const listeners = new Set<Listener>();

export const skyBridge = {
  get renderer(): SkyRenderer | null {
    return current;
  },
  setRenderer(r: SkyRenderer | null): void {
    current = r;
  },
  publish(info: FrameInfo): void {
    lastInfo = info;
    for (const l of listeners) l(info);
  },
  getLastInfo(): FrameInfo | null {
    return lastInfo;
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
