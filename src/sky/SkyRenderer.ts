import * as THREE from 'three';
import { angleDelta, angularSeparation, vectorToHorizontal } from '../astronomy/coordinate-transform';
import type { Mat3, Vec3 } from '../astronomy/types';
import type { Catalog } from '../catalog/types';
import type { Quat } from '../sensors/types';
import type { Layers, ViewMode } from '../store/sky-store';
import { LabelLayer } from './LabelLayer';
import { Picking } from './Picking';
import { SkyCamera } from './SkyCamera';
import { SkyControls } from './SkyControls';
import { SkyScene } from './SkyScene';
import { StarLayer } from './StarLayer';
import type { FrameInfo, LabelTexts, RadiantRenderItem, SolarRenderItem, TargetScreenInfo } from './types';
import { skyLimitingMagnitude } from '../astronomy/naked-eye';
import { FILTER_OFF, computeMessierHidden, type PracticalFilterState } from './practical-filter';

export class WebGLUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('WebGL is not available');
    this.name = 'WebGLUnavailableError';
    this.cause = cause;
  }
}

/** Orientation source for sensor mode: writes the camera quaternion, returns false while no data. */
export type OrientationSource = (dtMs: number, out: Quat) => boolean;

export interface SkyRendererEvents {
  onTap?(x: number, y: number): void;
  onUserInteract?(): void;
  onFrameInfo?(info: FrameInfo): void;
  onContextLost?(): void;
}

const NIGHT_SKY = new THREE.Color('#02030a');
const TWILIGHT_SKY = new THREE.Color('#0b1636');
const DAY_SKY = new THREE.Color('#1f3c6e');

interface Pointed {
  id: string;
  vec: THREE.Vector3;
  /** true = world frame (alt/az fixed), false = EQJ (moves with the sky). */
  world: boolean;
}

/**
 * Owns the WebGL renderer, the scene and the render loop. Rendering is on-demand in free mode
 * (only when something changed) and continuous in sensor mode. No React inside.
 */
export class SkyRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sky = new SkyScene();
  private readonly cam: SkyCamera;
  private readonly labels = new LabelLayer();
  private readonly picking = new Picking();
  private readonly controls: SkyControls;
  private readonly root: HTMLElement;
  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private lastT = 0;
  private dirty = true;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private layers: Layers;
  private practical: PracticalFilterState = FILTER_OFF;
  private catalog: Catalog | null = null;
  private showLabels = true;
  private daylight = 0;
  private brightness = 1;
  private viewMode: ViewMode = 'free';
  private orientationSource: OrientationSource | null = null;
  private readonly sensorQuat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private selected: Pointed | null = null;
  private target: Pointed | null = null;
  private bodies: SolarRenderItem[] = [];
  private lastFrameInfoAt = 0;
  private readonly events: SkyRendererEvents;
  private disposed = false;
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpV2 = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();

  constructor(container: HTMLElement, initialLayers: Layers, events: SkyRendererEvents = {}) {
    this.events = events;
    this.layers = initialLayers;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      throw new WebGLUnavailableError(e);
    }
    this.root = document.createElement('div');
    this.root.className = 'sky-root';
    this.renderer.domElement.className = 'sky-canvas';
    this.renderer.domElement.tabIndex = 0;
    this.root.append(this.renderer.domElement, this.labels.canvas);
    container.append(this.root);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.invalidate, false);

    this.cam = new SkyCamera(1);
    this.cam.reducedMotion =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls = new SkyControls(this.renderer.domElement, {
      isDragEnabled: () => this.viewMode === 'free',
      pan: (dx, dy) => {
        this.cam.panByPixels(dx, dy, this.height);
        this.invalidate();
      },
      fling: (vx, vy) => {
        const k = this.cam.degreesPerPixel(this.height);
        this.cam.fling(-vx * k, vy * k);
        this.invalidate();
      },
      stop: () => this.cam.stopMotion(),
      zoom: (f) => {
        this.cam.zoomBy(f);
        this.invalidate();
      },
      tap: (x, y) => this.events.onTap?.(x, y),
      interact: () => this.events.onUserInteract?.(),
    });
    this.sky.applyLayers(this.layers);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    document.addEventListener('visibilitychange', this.onVisibility);
    this.raf = requestAnimationFrame(this.loop);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /* ------------------------------------------------------------------ data */

  setCatalog(catalog: Catalog): void {
    this.catalog = catalog;
    this.sky.setCatalog(catalog);
    this.sky.applyLayers(this.layers);
    const starEqj = this.sky.stars!.eqj;
    const messierEqj = this.sky.deepSky!.eqj;
    this.labels.setCatalog(catalog, starEqj, messierEqj);
    this.picking.setCatalog(catalog, starEqj, messierEqj);
    this.invalidate();
  }

  setEqjToWorld(m: Mat3): void {
    this.sky.setEqjToWorld(m);
    this.refreshPracticalMasks();
    this.invalidate();
  }

  setSolarItems(items: SolarRenderItem[]): void {
    this.bodies = items;
    this.sky.setSolarItems(items, this.practical.enabled);
    this.labels.setBodies(items);
    this.picking.setBodies(items);
    this.invalidate();
  }

  /** Meteor shower radiants (drawn on the overlay when the "meteors" layer is on). */
  setMeteorRadiants(items: RadiantRenderItem[]): void {
    this.labels.radiants.setItems(items);
    this.picking.setRadiants(items);
    if (this.layers.meteors) this.invalidate();
  }

  setLabelTexts(texts: LabelTexts): void {
    this.labels.setTexts(texts);
    this.invalidate();
  }

  setLayers(layers: Layers): void {
    this.layers = layers;
    this.sky.applyLayers(layers);
    this.invalidate();
  }

  /** "Visible now": keep only objects practically visible to the naked eye. */
  setPracticalFilter(enabled: boolean, sunAltitude: number): void {
    const skyLimit = skyLimitingMagnitude(sunAltitude);
    this.practical = {
      enabled,
      sunAltitude,
      skyLimit,
      messierHidden: null,
      constellationsHidden: enabled && skyLimit < 2,
    };
    this.sky.stars?.setPracticalFilter(enabled, skyLimit);
    this.sky.constellationsHiddenByFilter = this.practical.constellationsHidden;
    this.sky.setSolarItems(this.bodies, enabled);
    this.refreshPracticalMasks();
    this.invalidate();
  }

  private refreshPracticalMasks(): void {
    const deep = this.sky.deepSky;
    if (!deep || !this.catalog) return;
    this.practical.messierHidden = this.practical.enabled
      ? computeMessierHidden(
          this.catalog.messier,
          deep.eqj,
          this.sky.celestial.matrix,
          this.practical.sunAltitude,
        )
      : null;
    deep.setHidden(this.practical.messierHidden);
  }

  setShowLabels(on: boolean): void {
    this.showLabels = on;
    this.invalidate();
  }

  setDaylight(d: number): void {
    this.daylight = d;
    this.sky.horizon.setDaylight(d);
    this.invalidate();
  }

  setBrightness(b: number): void {
    this.brightness = b;
    this.invalidate();
  }

  /** Selection marker. `vec` is EQJ unless `world` is true. */
  setSelection(id: string | null, vec: Vec3 | null, world = false): void {
    this.selected = id && vec ? { id, vec: new THREE.Vector3(vec.x, vec.y, vec.z), world } : null;
    this.invalidate();
  }

  setNavigationTarget(id: string | null, vec: Vec3 | null, world = false): void {
    this.target = id && vec ? { id, vec: new THREE.Vector3(vec.x, vec.y, vec.z), world } : null;
    this.lastFrameInfoAt = 0;
    this.invalidate();
  }

  /* ---------------------------------------------------------------- camera */

  setViewMode(mode: ViewMode, source: OrientationSource | null): void {
    if (this.viewMode === 'sensor' && mode === 'free') this.cam.syncAltAzFromOrientation();
    this.viewMode = mode;
    this.orientationSource = mode === 'sensor' ? source : null;
    this.cam.stopMotion();
    this.invalidate();
  }

  resetView(latitude: number): void {
    this.cam.setFov(70);
    // Face the equator-side sky where most of the action is.
    this.cam.lookAt(30, latitude >= 0 ? 180 : 0, true);
    this.invalidate();
  }

  zoomBy(factor: number): void {
    this.cam.zoomBy(factor);
    this.invalidate();
  }

  /** Points the free-mode camera at an object. */
  lookAtVector(vec: Vec3, world: boolean): void {
    this.tmpV.set(vec.x, vec.y, vec.z);
    if (!world) this.tmpV.applyMatrix4(this.sky.celestial.matrix);
    const h = vectorToHorizontal(this.tmpV);
    this.cam.lookAt(h.altitude, h.azimuth, true);
    this.invalidate();
  }

  getCenter(): { altitude: number; azimuth: number; fov: number } {
    return { ...this.cam.getCenter(), fov: this.cam.fov };
  }

  /* --------------------------------------------------------------- picking */

  pick(x: number, y: number): string | null {
    return this.picking.pick(x, y, this.pickContext());
  }

  /** World-frame direction under a screen point, converted to J2000 RA (h) / Dec (deg). */
  screenToEquatorial(x: number, y: number): { ra: number; dec: number } {
    const w = this.picking.screenToWorld(x, y, this.pickContext(), this.tmpV);
    const inv = this.tmpV2;
    inv.copy(w).applyMatrix4(new THREE.Matrix4().copy(this.sky.celestial.matrix).transpose());
    const dec = Math.asin(Math.max(-1, Math.min(1, inv.z))) * (180 / Math.PI);
    let ra = Math.atan2(inv.y, inv.x) * (180 / Math.PI);
    if (ra < 0) ra += 360;
    return { ra: ra / 15, dec };
  }

  private pickContext() {
    return {
      camera: this.cam.camera,
      celestial: this.sky.celestial.matrix,
      width: this.width,
      height: this.height,
      layers: this.layers,
      starMagLimit: StarLayer.magnitudeLimit(this.cam.fov, this.daylight),
      practical: this.practical,
    };
  }

  /* ------------------------------------------------------------ rendering */

  invalidate = (): void => {
    this.dirty = true;
  };

  private resize(): void {
    const rect = this.root.parentElement?.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect?.width ?? window.innerWidth));
    const h = Math.max(1, Math.round(rect?.height ?? window.innerHeight));
    this.width = w;
    this.height = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.labels.resize(w, h, this.dpr);
    this.cam.setAspect(w / h);
    this.invalidate();
  }

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.raf && !this.disposed) {
      this.lastT = 0;
      this.invalidate();
      this.raf = requestAnimationFrame(this.loop);
    }
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.events.onContextLost?.();
  };

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.lastT ? Math.min(100, t - this.lastT) : 16;
    this.lastT = t;
    let changed = this.dirty;
    if (this.viewMode === 'sensor' && this.orientationSource) {
      if (this.orientationSource(dt, this.sensorQuat)) {
        const q = this.sensorQuat;
        this.cam.setQuaternion(q.x, q.y, q.z, q.w);
        changed = true;
      }
    } else if (this.cam.update(dt)) {
      changed = true;
    }
    if (this.target && t - this.lastFrameInfoAt > 100) changed = true;
    if (!changed) return;
    this.dirty = false;
    this.renderFrame(t);
  };

  private renderFrame(t: number): void {
    const fov = this.cam.fov;
    const pxPerDeg = this.height / fov;
    const sky = this.sky;
    const bg = NIGHT_SKY.clone().lerp(TWILIGHT_SKY, Math.min(1, this.daylight * 2));
    if (this.daylight > 0.5) bg.lerp(DAY_SKY, (this.daylight - 0.5) * 2);
    this.renderer.setClearColor(bg, 1);

    sky.stars?.update(fov, this.dpr, this.daylight, this.brightness);
    sky.deepSky?.update(fov, this.dpr, this.daylight);
    sky.constellations?.setDim(1 - 0.6 * this.daylight);
    sky.planets.update(pxPerDeg, this.dpr);
    const sunDir = this.moonToSunScreenDirection();
    sky.sunMoon.update(pxPerDeg, this.dpr, sunDir.x, sunDir.y);

    this.renderer.render(sky.scene, this.cam.camera);
    this.labels.draw({
      camera: this.cam.camera,
      celestial: sky.celestial.matrix,
      width: this.width,
      height: this.height,
      dpr: this.dpr,
      layers: this.layers,
      showLabels: this.showLabels,
      daylight: this.daylight,
      selectedEqj: this.selected?.vec ?? null,
      selectedIsWorld: this.selected?.world ?? false,
      practical: this.practical,
    });

    if (t - this.lastFrameInfoAt > 100) {
      this.lastFrameInfoAt = t;
      this.events.onFrameInfo?.(this.computeFrameInfo());
    }
  }

  /** Screen-space direction from the Moon toward the Sun, for the phase terminator. */
  private moonToSunScreenDirection(): { x: number; y: number } {
    const sun = this.bodies.find((b) => b.id === 'sun');
    const moon = this.bodies.find((b) => b.id === 'moon');
    if (!sun || !moon) return { x: 0, y: 0 };
    const cam = this.cam.camera;
    const m = sky3(this.sky.celestial.matrix, cam);
    const s = this.tmpV.set(sun.eqj.x, sun.eqj.y, sun.eqj.z).applyMatrix4(m);
    const mo = this.tmpV2.set(moon.eqj.x, moon.eqj.y, moon.eqj.z).applyMatrix4(m);
    if (mo.z >= -1e-6) return { x: 0, y: 0 }; // Moon behind the camera: not drawn anyway
    // Great-circle tangent at the Moon pointing toward the Sun (camera space, x right, y up)…
    const d = s.dot(mo);
    const tx = s.x - mo.x * d;
    const ty = s.y - mo.y * d;
    const tz = s.z - mo.z * d;
    // …mapped through the derivative of the perspective projection at the Moon's position.
    const dx = tx - (mo.x * tz) / mo.z;
    const dy = ty - (mo.y * tz) / mo.z;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  private computeFrameInfo(): FrameInfo {
    const center = this.cam.getCenter();
    let target: TargetScreenInfo | null = null;
    if (this.target) {
      const world = this.tmpV.copy(this.target.vec);
      if (!this.target.world) world.applyMatrix4(this.sky.celestial.matrix);
      const th = vectorToHorizontal(world);
      this.fwd.set(0, 0, -1).applyQuaternion(this.cam.camera.quaternion);
      const separation = angularSeparation(this.fwd, world);
      const camSpace = this.tmpV2.copy(world).applyMatrix4(this.cam.camera.matrixWorldInverse);
      const ndc = world.clone().project(this.cam.camera);
      const onScreen = camSpace.z < 0 && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
      const sx = camSpace.x;
      let sy = camSpace.y;
      if (camSpace.z >= 0 && Math.hypot(sx, sy) < 1e-6) sy = 1;
      target = {
        id: this.target.id,
        onScreen,
        x: ((ndc.x + 1) / 2) * this.width,
        y: ((1 - ndc.y) / 2) * this.height,
        separation,
        screenAngle: Math.atan2(sy, sx),
        deltaAz: angleDelta(center.azimuth, th.azimuth),
        deltaAlt: th.altitude - center.altitude,
        targetAltitude: th.altitude,
      };
    }
    return { centerAltitude: center.altitude, centerAzimuth: center.azimuth, fov: this.cam.fov, target };
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.sky.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.invalidate);
    this.renderer.dispose();
    this.root.remove();
  }
}

const scratchM = new THREE.Matrix4();
/** view · celestial matrix (EQJ → camera space). */
function sky3(celestial: THREE.Matrix4, cam: THREE.PerspectiveCamera): THREE.Matrix4 {
  return scratchM.multiplyMatrices(cam.matrixWorldInverse, celestial);
}
