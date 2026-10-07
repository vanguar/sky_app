import * as THREE from 'three';
import { starId } from '../catalog/stars/stars';
import type { Catalog } from '../catalog/types';
import type { Layers } from '../store/sky-store';
import { isCategoryVisible } from './DeepSkyLayer';
import type { SolarRenderItem } from './types';

/** Touch target radius in CSS px — intentionally larger than the drawn objects. */
export const PICK_RADIUS_PX = 30;

export interface PickContext {
  camera: THREE.PerspectiveCamera;
  celestial: THREE.Matrix4;
  width: number;
  height: number;
  layers: Layers;
  starMagLimit: number;
}

/**
 * Screen-space hit testing: project candidates and choose the best one near the tap,
 * favouring bright / prominent objects. Allocation-light; runs only on tap.
 */
export class Picking {
  private catalog: Catalog | null = null;
  private starEqj: Float32Array | null = null;
  private messierEqj: Float32Array | null = null;
  private bodies: SolarRenderItem[] = [];
  private readonly mvp = new THREE.Matrix4();
  private readonly v4 = new THREE.Vector4();

  setCatalog(catalog: Catalog, starEqj: Float32Array, messierEqj: Float32Array): void {
    this.catalog = catalog;
    this.starEqj = starEqj;
    this.messierEqj = messierEqj;
  }

  setBodies(items: SolarRenderItem[]): void {
    this.bodies = items;
  }

  private screenDistance(x: number, y: number, z: number, tx: number, ty: number, ctx: PickContext): number {
    this.v4.set(x, y, z, 1).applyMatrix4(this.mvp);
    if (this.v4.w <= 1e-6) return Infinity;
    const sx = ((this.v4.x / this.v4.w + 1) / 2) * ctx.width;
    const sy = ((1 - this.v4.y / this.v4.w) / 2) * ctx.height;
    return Math.hypot(sx - tx, sy - ty);
  }

  pick(tx: number, ty: number, ctx: PickContext): string | null {
    this.mvp
      .multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse)
      .multiply(ctx.celestial);
    let bestId: string | null = null;
    let bestScore = Infinity;
    const consider = (id: string, dist: number, bonus: number) => {
      if (dist > PICK_RADIUS_PX) return;
      const score = dist - bonus;
      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    };

    for (const b of this.bodies) {
      const on = b.id === 'sun' ? ctx.layers.sun : b.id === 'moon' ? ctx.layers.moon : ctx.layers.planets;
      if (!on) continue;
      consider(b.id, this.screenDistance(b.eqj.x, b.eqj.y, b.eqj.z, tx, ty, ctx), 16);
    }

    if (this.catalog && this.messierEqj) {
      const e = this.messierEqj;
      this.catalog.messier.forEach((m, i) => {
        if (!isCategoryVisible(m.category, ctx.layers)) return;
        consider(m.id, this.screenDistance(e[i * 3], e[i * 3 + 1], e[i * 3 + 2], tx, ty, ctx), 6);
      });
    }

    if (this.catalog && this.starEqj && ctx.layers.stars) {
      const e = this.starEqj;
      const stars = this.catalog.stars.stars;
      const limit = Math.min(ctx.starMagLimit, 6.5);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (s.mag > limit) break; // catalog is sorted by magnitude
        const d = this.screenDistance(e[i * 3], e[i * 3 + 1], e[i * 3 + 2], tx, ty, ctx);
        consider(starId(s.hip), d, Math.max(0, (4.5 - s.mag) * 3));
      }
    }
    return bestId;
  }

  /** Direction (world frame) of a screen point. */
  screenToWorld(tx: number, ty: number, ctx: PickContext, out: THREE.Vector3): THREE.Vector3 {
    out.set((tx / ctx.width) * 2 - 1, -(ty / ctx.height) * 2 + 1, 0.5).unproject(ctx.camera);
    return out.normalize();
  }
}
