import * as THREE from 'three';
import { eclipticToEquatorialVector, raDecToVector } from '../astronomy/coordinate-transform';
import type { ConstellationRecord } from '../catalog/types';
import type { Layers } from '../store/sky-store';
import { SKY_RADIUS } from './types';

const LINE_R = SKY_RADIUS * 0.995;
const COLOR_NORMAL = new THREE.Color('#5b6cc8');
const COLOR_ZODIAC = new THREE.Color('#d6b25e');

function pushPoint(arr: number[], raDeg: number, decDeg: number, r = LINE_R) {
  const v = raDecToVector(raDeg, decDeg);
  arr.push(v.x * r, v.y * r, v.z * r);
}

function segmentsGeometry(points: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.01);
  return g;
}

function lineMaterial(color: THREE.Color, opacity: number) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
}

/** Constellation stick figures (normal + zodiac subsets), IAU boundaries and the ecliptic. */
export class ConstellationLayer {
  readonly group = new THREE.Group();
  private readonly normalLines: THREE.LineSegments;
  private readonly zodiacLines: THREE.LineSegments;
  private readonly boundaries: THREE.LineSegments;
  private readonly ecliptic: THREE.LineLoop;
  private readonly zodiacMaterial: THREE.LineBasicMaterial;

  constructor(constellations: ConstellationRecord[]) {
    const normal: number[] = [];
    const zodiac: number[] = [];
    const bounds: number[] = [];
    for (const c of constellations) {
      const target = c.zodiac ? zodiac : normal;
      for (const line of c.lines) {
        for (let i = 0; i < line.length - 1; i++) {
          pushPoint(target, line[i][0], line[i][1]);
          pushPoint(target, line[i + 1][0], line[i + 1][1]);
        }
      }
      for (const ring of c.bounds) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i];
          const b = ring[(i + 1) % ring.length];
          // Boundaries run along constant declination arcs: interpolate them in RA.
          let dRa = b[0] - a[0];
          if (dRa > 180) dRa -= 360;
          if (dRa < -180) dRa += 360;
          const steps = Math.abs(a[1] - b[1]) < 1e-6 ? Math.max(1, Math.ceil(Math.abs(dRa) / 2)) : 1;
          for (let s = 0; s < steps; s++) {
            const t0 = s / steps;
            const t1 = (s + 1) / steps;
            pushPoint(bounds, a[0] + dRa * t0, a[1] + (b[1] - a[1]) * t0, SKY_RADIUS * 0.996);
            pushPoint(bounds, a[0] + dRa * t1, a[1] + (b[1] - a[1]) * t1, SKY_RADIUS * 0.996);
          }
        }
      }
    }
    this.normalLines = new THREE.LineSegments(segmentsGeometry(normal), lineMaterial(COLOR_NORMAL, 0.42));
    this.zodiacMaterial = lineMaterial(COLOR_NORMAL.clone(), 0.42);
    this.zodiacLines = new THREE.LineSegments(segmentsGeometry(zodiac), this.zodiacMaterial);
    this.boundaries = new THREE.LineSegments(
      segmentsGeometry(bounds),
      lineMaterial(new THREE.Color('#3b4a8c'), 0.32),
    );

    const ecl: number[] = [];
    for (let lon = 0; lon < 360; lon += 2) {
      const v = eclipticToEquatorialVector(lon, 0);
      ecl.push(v.x * LINE_R, v.y * LINE_R, v.z * LINE_R);
    }
    this.ecliptic = new THREE.LineLoop(segmentsGeometry(ecl), lineMaterial(COLOR_ZODIAC, 0.35));

    for (const o of [this.boundaries, this.ecliptic, this.normalLines, this.zodiacLines]) {
      o.frustumCulled = false;
      o.renderOrder = 1;
      this.group.add(o);
    }
  }

  applyLayers(layers: Layers): void {
    this.normalLines.visible = layers.constellationLines;
    this.zodiacLines.visible = layers.constellationLines || layers.zodiac;
    this.zodiacMaterial.color.copy(layers.zodiac ? COLOR_ZODIAC : COLOR_NORMAL);
    this.zodiacMaterial.opacity = layers.zodiac ? 0.6 : 0.42;
    this.boundaries.visible = layers.constellationBoundaries;
    this.ecliptic.visible = layers.zodiac;
  }

  setDim(factor: number): void {
    for (const o of [this.normalLines, this.boundaries, this.ecliptic]) {
      const m = o.material as THREE.LineBasicMaterial;
      m.userData.base ??= m.opacity;
      m.opacity = (m.userData.base as number) * factor;
    }
  }

  dispose(): void {
    for (const o of [this.normalLines, this.zodiacLines, this.boundaries, this.ecliptic]) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  }
}
