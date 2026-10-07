/**
 * Pointer / wheel / keyboard input for the sky canvas. Plain DOM, no React.
 * Drag pans (free mode only), pinch and wheel zoom, short taps are reported for picking.
 */
export interface SkyControlsHandlers {
  isDragEnabled(): boolean;
  pan(dx: number, dy: number): void;
  fling(vx: number, vy: number): void;
  stop(): void;
  zoom(factor: number): void;
  tap(x: number, y: number): void;
  interact(): void;
}

interface PointerInfo {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startT: number;
}

const TAP_MOVE_PX = 10;
const TAP_TIME_MS = 350;

export class SkyControls {
  private pointers = new Map<number, PointerInfo>();
  private lastPinchDist = 0;
  private moved = false;
  private samples: { x: number; y: number; t: number }[] = [];

  constructor(
    private readonly el: HTMLElement,
    private readonly h: SkyControlsHandlers,
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('keydown', this.onKey);
    el.style.touchAction = 'none';
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onCancel);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('keydown', this.onKey);
  }

  private local(e: PointerEvent | WheelEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent) => {
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not critical */
    }
    const p = this.local(e);
    this.pointers.set(e.pointerId, { x: p.x, y: p.y, startX: p.x, startY: p.y, startT: performance.now() });
    this.h.stop();
    this.h.interact();
    if (this.pointers.size === 1) {
      this.moved = false;
      this.samples = [{ x: p.x, y: p.y, t: performance.now() }];
    } else if (this.pointers.size === 2) {
      this.moved = true;
      this.lastPinchDist = this.pinchDistance();
    }
  };

  private onMove = (e: PointerEvent) => {
    const info = this.pointers.get(e.pointerId);
    if (!info) return;
    const p = this.local(e);
    const dx = p.x - info.x;
    const dy = p.y - info.y;
    info.x = p.x;
    info.y = p.y;
    if (this.pointers.size >= 2) {
      const d = this.pinchDistance();
      if (this.lastPinchDist > 0 && d > 0) this.h.zoom(this.lastPinchDist / d);
      this.lastPinchDist = d;
      return;
    }
    if (Math.hypot(p.x - info.startX, p.y - info.startY) > TAP_MOVE_PX) this.moved = true;
    if (this.moved && this.h.isDragEnabled()) {
      this.h.pan(dx, dy);
      const now = performance.now();
      this.samples.push({ x: p.x, y: p.y, t: now });
      while (this.samples.length > 2 && now - this.samples[0].t > 100) this.samples.shift();
    }
  };

  private onUp = (e: PointerEvent) => {
    const info = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!info) return;
    if (this.pointers.size > 0) {
      // Finishing a pinch: re-base the remaining finger to avoid a jump.
      for (const other of this.pointers.values()) {
        other.startX = other.x;
        other.startY = other.y;
      }
      this.lastPinchDist = 0;
      return;
    }
    const elapsed = performance.now() - info.startT;
    if (!this.moved && elapsed < TAP_TIME_MS) {
      this.h.tap(info.x, info.y);
      return;
    }
    if (this.moved && this.h.isDragEnabled() && this.samples.length >= 2) {
      const a = this.samples[0];
      const b = this.samples[this.samples.length - 1];
      const dt = b.t - a.t;
      if (dt > 0 && performance.now() - b.t < 80) this.h.fling((b.x - a.x) / dt, (b.y - a.y) / dt);
    }
  };

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.lastPinchDist = 0;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.h.interact();
    const factor = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0015)));
    this.h.zoom(factor);
  };

  private onKey = (e: KeyboardEvent) => {
    const step = 40;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
        if (this.h.isDragEnabled()) this.h.pan(step, 0);
        break;
      case 'ArrowRight':
        if (this.h.isDragEnabled()) this.h.pan(-step, 0);
        break;
      case 'ArrowUp':
        if (this.h.isDragEnabled()) this.h.pan(0, step);
        break;
      case 'ArrowDown':
        if (this.h.isDragEnabled()) this.h.pan(0, -step);
        break;
      case '+':
      case '=':
        this.h.zoom(0.8);
        break;
      case '-':
      case '_':
        this.h.zoom(1.25);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.h.interact();
    }
  };

  private pinchDistance(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
}
