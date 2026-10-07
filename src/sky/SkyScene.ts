import * as THREE from 'three';
import type { Catalog } from '../catalog/types';
import type { Layers } from '../store/sky-store';
import { ConstellationLayer } from './ConstellationLayer';
import { DeepSkyLayer } from './DeepSkyLayer';
import { HorizonLayer } from './HorizonLayer';
import { PlanetLayer } from './PlanetLayer';
import { StarLayer } from './StarLayer';
import { SunMoonLayer } from './SunMoonLayer';
import type { SolarRenderItem } from './types';

/**
 * Scene graph:
 *   scene
 *    ├─ celestial (matrix = J2000 equatorial → local horizon, updated ~1 Hz)
 *    │    ├─ constellations, deep sky, stars, planets, sun & moon
 *    └─ horizon (world frame: ground, horizon line, alt/az grid)
 */
export class SkyScene {
  readonly scene = new THREE.Scene();
  readonly celestial = new THREE.Group();
  readonly horizon = new HorizonLayer();
  readonly planets = new PlanetLayer();
  readonly sunMoon = new SunMoonLayer();
  stars: StarLayer | null = null;
  constellations: ConstellationLayer | null = null;
  deepSky: DeepSkyLayer | null = null;

  constructor() {
    this.celestial.matrixAutoUpdate = false;
    this.celestial.add(this.planets.object, this.sunMoon.sun, this.sunMoon.moon);
    this.scene.add(this.celestial, this.horizon.group);
  }

  setCatalog(catalog: Catalog): void {
    this.disposeCatalogLayers();
    this.stars = new StarLayer(catalog.stars);
    this.constellations = new ConstellationLayer(catalog.constellations);
    this.deepSky = new DeepSkyLayer(catalog.messier);
    this.celestial.add(this.constellations.group, this.deepSky.object, this.stars.object);
  }

  setEqjToWorld(m: readonly number[]): void {
    this.celestial.matrix.set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
    this.celestial.matrixWorldNeedsUpdate = true;
    this.celestial.updateMatrixWorld(true);
  }

  private practicalOnly = false;
  private lastLayers: Layers | null = null;

  setSolarItems(items: SolarRenderItem[], practicalOnly = this.practicalOnly): void {
    this.practicalOnly = practicalOnly;
    this.planets.setItems(items, practicalOnly);
    this.sunMoon.setItems(items, practicalOnly);
    if (this.lastLayers) this.applyLayers(this.lastLayers);
  }

  /** Constellation figures are hidden when the sky is too bright to trace them. */
  constellationsHiddenByFilter = false;

  applyLayers(layers: Layers): void {
    this.lastLayers = layers;
    if (this.stars) this.stars.object.visible = layers.stars;
    this.planets.object.visible = layers.planets;
    this.sunMoon.sun.visible = layers.sun && !this.sunMoon.filteredSun;
    this.sunMoon.moon.visible = layers.moon && !this.sunMoon.filteredMoon;
    this.constellations?.applyLayers(layers);
    if (this.constellations && this.constellationsHiddenByFilter) this.constellations.group.visible = false;
    else if (this.constellations) this.constellations.group.visible = true;
    this.deepSky?.applyLayers(layers);
    this.horizon.setGridVisible(layers.grid);
  }

  private disposeCatalogLayers(): void {
    for (const l of [this.stars, this.constellations, this.deepSky]) l?.dispose();
    if (this.stars) this.celestial.remove(this.stars.object);
    if (this.constellations) this.celestial.remove(this.constellations.group);
    if (this.deepSky) this.celestial.remove(this.deepSky.object);
  }

  dispose(): void {
    this.disposeCatalogLayers();
    this.planets.dispose();
    this.sunMoon.dispose();
    this.horizon.dispose();
  }
}
