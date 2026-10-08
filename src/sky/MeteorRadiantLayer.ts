import * as THREE from 'three';
import type { RadiantRenderItem } from './types';

const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", Tahoma, sans-serif';

/**
 * Meteor shower radiants on the 2D overlay: a static star-burst symbol plus the IAU code ("PER").
 * Purely a position marker — no animated or simulated meteors are ever drawn (the app cannot know
 * where an individual meteor will appear).
 */
export class MeteorRadiantLayer {
  private items: RadiantRenderItem[] = [];
  private readonly tmp = new THREE.Vector3();

  setItems(items: RadiantRenderItem[]): void {
    this.items = items;
  }

  getItems(): readonly RadiantRenderItem[] {
    return this.items;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    project: (v: THREE.Vector3, out: { x: number; y: number }) => boolean,
    reserve: (x: number, y: number, w: number, h: number) => boolean,
    showLabels: boolean,
    rtl: boolean,
    dim: number,
  ): void {
    const p = { x: 0, y: 0 };
    for (const it of this.items) {
      this.tmp.set(it.eqj.x, it.eqj.y, it.eqj.z);
      if (!project(this.tmp, p)) continue;
      const active = it.status !== 'upcoming';
      const alpha = (active ? 0.95 : 0.55) * dim + 0.05;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 190, 120, ${alpha})`;
      ctx.lineWidth = active ? 1.6 : 1.2;
      if (!active) ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r1 = 8;
        const r2 = i % 2 === 0 ? 14 : 11;
        ctx.moveTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
        ctx.lineTo(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2);
      }
      ctx.stroke();
      ctx.restore();
      reserve(p.x - 14, p.y - 14, 28, 28);
      if (!showLabels) continue;
      ctx.font = `700 11px ${FONT}`;
      const w = ctx.measureText(it.code).width;
      const lx = rtl ? p.x - 17 - w : p.x + 17;
      if (!reserve(lx - 2, p.y - 8, w + 4, 16)) continue;
      ctx.fillStyle = `rgba(255, 205, 150, ${alpha})`;
      ctx.fillText(it.code, lx, p.y + 4);
    }
  }
}
