import * as THREE from 'three';
import { horizontalToVector, raDecToVector } from '../astronomy/coordinate-transform';
import type { SolarBodyId } from '../astronomy/types';
import type { Catalog, DeepSkyCategory } from '../catalog/types';
import type { Layers } from '../store/sky-store';
import { isCategoryVisible } from './DeepSkyLayer';
import type { LabelTexts, SolarRenderItem } from './types';
import { pointPassesFilter, worldAltitudeDeg, type PracticalFilterState } from './practical-filter';

const FONT_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", Tahoma, sans-serif';
const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelFrame {
  camera: THREE.PerspectiveCamera;
  celestial: THREE.Matrix4;
  width: number;
  height: number;
  dpr: number;
  layers: Layers;
  showLabels: boolean;
  daylight: number;
  selectedEqj: THREE.Vector3 | null;
  selectedIsWorld: boolean;
  practical: PracticalFilterState;
}

/**
 * Text labels drawn on a 2D canvas overlay (fast, supports every script incl. Arabic shaping).
 * A small pool of labels is projected each rendered frame with simple overlap rejection.
 */
export class LabelLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private texts: LabelTexts | null = null;
  private stars: { hip: number; idx: number; mag: number }[] = [];
  private constellations: { abbr: string; zodiac: boolean; eqj: THREE.Vector3[] }[] = [];
  private messier: { designation: string; idx: number; category: DeepSkyCategory; mag: number }[] = [];
  private bodies: SolarRenderItem[] = [];
  private starEqj: Float32Array | null = null;
  private messierEqj: Float32Array | null = null;
  private readonly cardinalVecs = CARDINALS.map((_, i) => {
    const v = horizontalToVector(0, i * 45);
    return new THREE.Vector3(v.x, v.y, v.z);
  });
  private readonly mvp = new THREE.Matrix4();
  private readonly vp = new THREE.Matrix4();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp4 = new THREE.Vector4();
  private rects: Rect[] = [];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sky-labels';
    this.canvas.setAttribute('aria-hidden', 'true');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  setCatalog(catalog: Catalog, starEqj: Float32Array, messierEqj: Float32Array): void {
    this.starEqj = starEqj;
    this.messierEqj = messierEqj;
    this.stars = catalog.stars.stars
      .filter((s) => s.name && s.mag < 4.5)
      .map((s) => ({ hip: s.hip, idx: s.index, mag: s.mag }))
      .sort((a, b) => a.mag - b.mag);
    this.constellations = catalog.constellations.map((c) => ({
      abbr: c.abbr,
      zodiac: c.zodiac,
      eqj: c.labels.map(([ra, dec]) => {
        const v = raDecToVector(ra, dec);
        return new THREE.Vector3(v.x, v.y, v.z);
      }),
    }));
    this.messier = catalog.messier
      .map((m, idx) => ({ designation: m.designation, idx, category: m.category, mag: m.mag ?? 10 }))
      .sort((a, b) => a.mag - b.mag);
  }

  setTexts(texts: LabelTexts): void {
    this.texts = texts;
  }

  setBodies(items: SolarRenderItem[]): void {
    this.bodies = items;
  }

  resize(width: number, height: number, dpr: number): void {
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  /** Projects an EQJ (celestial=true) or world vector to CSS pixels. Returns false if behind/outside. */
  private project(
    v: THREE.Vector3,
    celestial: boolean,
    f: LabelFrame,
    out: { x: number; y: number },
  ): boolean {
    const m = celestial ? this.mvp : this.vp;
    this.tmp4.set(v.x, v.y, v.z, 1).applyMatrix4(m);
    if (this.tmp4.w <= 1e-6) return false;
    const x = this.tmp4.x / this.tmp4.w;
    const y = this.tmp4.y / this.tmp4.w;
    if (x < -1.1 || x > 1.1 || y < -1.1 || y > 1.1) return false;
    out.x = ((x + 1) / 2) * f.width;
    out.y = ((1 - y) / 2) * f.height;
    return true;
  }

  private tryPlace(x: number, y: number, w: number, h: number): boolean {
    for (const r of this.rects) {
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return false;
    }
    this.rects.push({ x, y, w, h });
    return true;
  }

  private label(
    text: string,
    x: number,
    y: number,
    color: string,
    size: number,
    weight: number,
    offset = 8,
  ): void {
    const ctx = this.ctx;
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    const w = ctx.measureText(text).width;
    const rtl = this.texts?.rtl ?? false;
    const lx = rtl ? x - offset - w : x + offset;
    const ly = y - size / 2;
    if (!this.tryPlace(lx - 2, ly - 2, w + 4, size + 4)) return;
    ctx.fillStyle = color;
    ctx.fillText(text, lx, ly + size * 0.85);
  }

  draw(f: LabelFrame): void {
    const ctx = this.ctx;
    ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    ctx.clearRect(0, 0, f.width, f.height);
    this.rects = [];
    if (!this.texts) return;
    const texts = this.texts;
    this.vp.multiplyMatrices(f.camera.projectionMatrix, f.camera.matrixWorldInverse);
    this.mvp.multiplyMatrices(this.vp, f.celestial);
    const p = { x: 0, y: 0 };
    const fov = f.camera.fov;
    const dim = 1 - 0.5 * f.daylight;
    ctx.textBaseline = 'alphabetic';
    // Bidi direction for correct ordering of mixed runs; 'left' alignment keeps x as the left edge.
    ctx.direction = texts.rtl ? 'rtl' : 'ltr';
    ctx.textAlign = 'left';

    // Selection ring first so its area is reserved.
    if (f.selectedEqj && this.project(f.selectedEqj, !f.selectedIsWorld, f, p)) {
      ctx.strokeStyle = 'rgba(160, 176, 255, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cardinal directions on the horizon.
    this.cardinalVecs.forEach((v, i) => {
      if (!this.project(v, false, f, p)) return;
      const key = CARDINALS[i];
      const main = i % 2 === 0;
      ctx.font = `${main ? 700 : 500} ${main ? 15 : 12}px ${FONT_STACK}`;
      const text = texts.cardinals[key];
      const w = ctx.measureText(text).width;
      ctx.fillStyle = key === 'N' ? 'rgba(255, 140, 120, 0.95)' : `rgba(170, 182, 240, ${main ? 0.9 : 0.6})`;
      ctx.fillText(text, p.x - w / 2, p.y + 20);
      this.rects.push({ x: p.x - w / 2 - 2, y: p.y + 4, w: w + 4, h: 20 });
    });

    if (!f.showLabels) return;

    // Solar System bodies.
    for (const b of this.bodies) {
      const layerOn = b.id === 'sun' ? f.layers.sun : b.id === 'moon' ? f.layers.moon : f.layers.planets;
      if (!layerOn || (f.practical.enabled && !b.practicalVisible)) continue;
      this.tmp.set(b.eqj.x, b.eqj.y, b.eqj.z);
      if (!this.project(this.tmp, true, f, p)) continue;
      const name = texts.bodies[b.id as SolarBodyId];
      if (name) this.label(name, p.x, p.y, `rgba(255, 226, 168, ${0.95 * dim + 0.05})`, 14, 600, 12);
    }

    // Bright named stars — threshold depends on zoom.
    if (f.layers.stars && this.starEqj) {
      const limit = fov > 80 ? 1.2 : fov > 50 ? 2.0 : fov > 25 ? 3.0 : 4.5;
      const dayLimit = limit - f.daylight * 3;
      for (const s of this.stars) {
        if (s.mag > dayLimit) break;
        if (
          f.practical.enabled &&
          !pointPassesFilter(
            f.practical,
            s.mag,
            worldAltitudeDeg(
              f.celestial,
              this.starEqj[s.idx * 3],
              this.starEqj[s.idx * 3 + 1],
              this.starEqj[s.idx * 3 + 2],
            ),
          )
        )
          continue;
        this.tmp.set(this.starEqj[s.idx * 3], this.starEqj[s.idx * 3 + 1], this.starEqj[s.idx * 3 + 2]);
        if (!this.project(this.tmp, true, f, p)) continue;
        const name = texts.stars.get(s.hip);
        if (name) this.label(name, p.x, p.y, `rgba(200, 210, 255, ${0.85 * dim})`, 12, 500);
      }
    }

    // Constellation names.
    const allNames = f.layers.constellationNames;
    if ((allNames || f.layers.zodiac) && !f.practical.constellationsHidden) {
      for (const c of this.constellations) {
        if (!allNames && !c.zodiac) continue;
        const name = texts.constellations.get(c.abbr);
        if (!name) continue;
        const highlight = c.zodiac && f.layers.zodiac;
        for (const v of c.eqj) {
          if (!this.project(v, true, f, p)) continue;
          const ctxText = texts.rtl ? name : name.toLocaleUpperCase();
          ctx.font = `600 11px ${FONT_STACK}`;
          const w = ctx.measureText(ctxText).width;
          if (!this.tryPlace(p.x - w / 2 - 2, p.y - 8, w + 4, 16)) continue;
          ctx.fillStyle = highlight
            ? `rgba(230, 196, 110, ${0.85 * dim})`
            : `rgba(128, 144, 214, ${0.75 * dim})`;
          ctx.fillText(ctxText, p.x - w / 2, p.y + 4);
        }
      }
    }

    // Messier labels when zoomed in (or bright ones at medium zoom).
    if (this.messierEqj && (f.layers.galaxies || f.layers.nebulae || f.layers.clusters)) {
      const magLimit = fov < 25 ? 99 : fov < 50 ? 8 : fov < 80 ? 5.5 : 4.5;
      for (const m of this.messier) {
        if (m.mag > magLimit) break;
        if (!isCategoryVisible(m.category, f.layers)) continue;
        if (f.practical.messierHidden?.[m.idx]) continue;
        this.tmp.set(
          this.messierEqj[m.idx * 3],
          this.messierEqj[m.idx * 3 + 1],
          this.messierEqj[m.idx * 3 + 2],
        );
        if (!this.project(this.tmp, true, f, p)) continue;
        const text = texts.messier.get(m.designation) ?? m.designation;
        this.label(text, p.x, p.y, `rgba(160, 214, 200, ${0.85 * dim})`, 11, 500, 11);
      }
    }
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
