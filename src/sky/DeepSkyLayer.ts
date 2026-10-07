import * as THREE from 'three';
import { raDecToVector } from '../astronomy/coordinate-transform';
import { DEEP_SKY_CATEGORIES } from '../catalog/messier/messier';
import type { DeepSkyCategory, MessierRecord } from '../catalog/types';
import type { Layers } from '../store/sky-store';
import { SKY_RADIUS } from './types';

const vertexShader = /* glsl */ `
  attribute float aCat;
  attribute float aHidden;
  uniform float uPixelRatio;
  uniform float uVisible[6];
  uniform float uSize;
  varying float vCat;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    int idx = int(aCat + 0.5);
    float vis = 0.0;
    for (int i = 0; i < 6; i++) { if (i == idx) vis = uVisible[i]; }
    vCat = aCat;
    gl_PointSize = vis > 0.5 && aHidden < 0.5 ? uSize * uPixelRatio : 0.0;
  }
`;

// Marker shapes: galaxy = ellipse, nebula = square, planetary nebula = ring + dot,
// open cluster = dashed circle, globular cluster = circle + cross, other = diamond.
const fragmentShader = /* glsl */ `
  varying float vCat;
  uniform float uAlpha;
  void main() {
    vec2 c = (gl_PointCoord - 0.5) * 2.0;
    float w = 0.13;
    float a = 0.0;
    vec3 col = vec3(0.62, 0.85, 0.8);
    if (vCat < 0.5) {
      vec2 p = vec2(c.x, c.y * 2.0);
      float r = length(p);
      a = 1.0 - smoothstep(w * 0.6, w, abs(r - 0.75));
      col = vec3(0.98, 0.72, 0.62);
    } else if (vCat < 1.5) {
      float r = max(abs(c.x), abs(c.y));
      a = 1.0 - smoothstep(w * 0.6, w, abs(r - 0.7));
      col = vec3(0.55, 0.9, 0.7);
    } else if (vCat < 2.5) {
      float r = length(c);
      a = max(1.0 - smoothstep(w * 0.6, w, abs(r - 0.6)), 1.0 - smoothstep(0.12, 0.2, r));
      col = vec3(0.55, 0.9, 0.95);
    } else if (vCat < 3.5) {
      float r = length(c);
      float ang = atan(c.y, c.x);
      float dash = step(0.5, fract(ang * 1.909859));
      a = (1.0 - smoothstep(w * 0.6, w, abs(r - 0.75))) * dash;
      col = vec3(0.95, 0.9, 0.6);
    } else if (vCat < 4.5) {
      float r = length(c);
      float ring = 1.0 - smoothstep(w * 0.6, w, abs(r - 0.75));
      float cross = (1.0 - smoothstep(w * 0.4, w * 0.8, min(abs(c.x), abs(c.y)))) * step(r, 0.75);
      a = max(ring, cross);
      col = vec3(0.95, 0.85, 0.55);
    } else {
      float r = abs(c.x) + abs(c.y);
      a = 1.0 - smoothstep(w * 0.6, w, abs(r - 0.6));
      col = vec3(0.8, 0.8, 0.9);
    }
    if (a <= 0.01) discard;
    gl_FragColor = vec4(col, a * uAlpha);
  }
`;

export const CATEGORY_INDEX: Record<DeepSkyCategory, number> = {
  galaxy: 0,
  nebula: 1,
  planetaryNebula: 2,
  openCluster: 3,
  globularCluster: 4,
  other: 5,
};

/** Which layer toggle controls a deep-sky category. */
export function isCategoryVisible(cat: DeepSkyCategory, layers: Layers): boolean {
  switch (cat) {
    case 'galaxy':
      return layers.galaxies;
    case 'nebula':
    case 'planetaryNebula':
      return layers.nebulae;
    case 'openCluster':
    case 'globularCluster':
    case 'other':
      return layers.clusters;
  }
}

export class DeepSkyLayer {
  readonly object: THREE.Points;
  readonly eqj: Float32Array;
  private readonly material: THREE.ShaderMaterial;

  constructor(objects: MessierRecord[]) {
    const n = objects.length;
    const pos = new Float32Array(n * 3);
    const cat = new Float32Array(n);
    this.eqj = new Float32Array(n * 3);
    const v = { x: 0, y: 0, z: 0 };
    const r = SKY_RADIUS * 0.998;
    objects.forEach((m, i) => {
      raDecToVector(m.raDeg, m.decDeg, v);
      this.eqj.set([v.x, v.y, v.z], i * 3);
      pos.set([v.x * r, v.y * r, v.z * r], i * 3);
      cat[i] = CATEGORY_INDEX[m.category];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCat', new THREE.BufferAttribute(cat, 1));
    geo.setAttribute('aHidden', new THREE.BufferAttribute(new Float32Array(n), 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.01);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uPixelRatio: { value: 1 },
        uVisible: { value: DEEP_SKY_CATEGORIES.map(() => 1) },
        uSize: { value: 15 },
        uAlpha: { value: 0.8 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  applyLayers(layers: Layers): void {
    this.material.uniforms.uVisible.value = DEEP_SKY_CATEGORIES.map((c) =>
      isCategoryVisible(c, layers) ? 1 : 0,
    );
    this.object.visible = layers.galaxies || layers.nebulae || layers.clusters;
  }

  /** Per-object hide mask (1 = hidden), e.g. for the "Visible now" filter. */
  setHidden(mask: Uint8Array | null): void {
    const attr = this.object.geometry.getAttribute('aHidden') as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) attr.setX(i, mask && mask[i] ? 1 : 0);
    attr.needsUpdate = true;
  }

  update(fov: number, pixelRatio: number, daylight: number): void {
    this.material.uniforms.uPixelRatio.value = pixelRatio;
    this.material.uniforms.uSize.value = fov < 20 ? 22 : fov < 50 ? 17 : 13;
    this.material.uniforms.uAlpha.value = 0.85 * (1 - 0.8 * daylight);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
  }
}
