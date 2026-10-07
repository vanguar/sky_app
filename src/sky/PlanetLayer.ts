import * as THREE from 'three';
import { PLANET_IDS, type PlanetId } from '../astronomy/types';
import { BODY_COLORS } from '../catalog/planets/planet-data';
import { SKY_RADIUS, type SolarRenderItem } from './types';

const vertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aBaseSize;
  attribute float aAngDiam;
  attribute float aVisible;
  uniform float uPixelRatio;
  uniform float uPxPerDeg;
  varying vec3 vColor;
  varying float vDiscFrac;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float disc = aAngDiam * uPxPerDeg;
    float size = max(aBaseSize, disc * 1.6);
    vDiscFrac = clamp(disc / size, 0.0, 1.0);
    vColor = aColor;
    gl_PointSize = aVisible > 0.5 ? size * uPixelRatio : 0.0;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vDiscFrac;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(max(0.25, vDiscFrac) - 0.06, max(0.25, vDiscFrac), d);
    float halo = (1.0 - d) * 0.35;
    float a = clamp(core + halo, 0.0, 1.0);
    gl_FragColor = vec4(vColor, a);
  }
`;

/** Base marker size in px from apparent magnitude (planets always remain easy to tap/see). */
export function planetMarkerSize(mag: number | null): number {
  const m = mag ?? 5;
  return Math.min(16, Math.max(6, 11 - m * 1.4));
}

export class PlanetLayer {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private readonly geo: THREE.BufferGeometry;
  readonly ids: readonly PlanetId[] = PLANET_IDS;

  constructor() {
    const n = PLANET_IDS.length;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const colors = new Float32Array(n * 3);
    PLANET_IDS.forEach((id, i) => colors.set(BODY_COLORS[id], i * 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.geo.setAttribute('aBaseSize', new THREE.BufferAttribute(new Float32Array(n).fill(8), 1));
    this.geo.setAttribute('aAngDiam', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.setAttribute('aVisible', new THREE.BufferAttribute(new Float32Array(n), 1));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.01);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uPixelRatio: { value: 1 }, uPxPerDeg: { value: 10 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.object = new THREE.Points(this.geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 4;
  }

  setItems(items: SolarRenderItem[]): void {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const base = this.geo.getAttribute('aBaseSize') as THREE.BufferAttribute;
    const diam = this.geo.getAttribute('aAngDiam') as THREE.BufferAttribute;
    const vis = this.geo.getAttribute('aVisible') as THREE.BufferAttribute;
    PLANET_IDS.forEach((id, i) => {
      const it = items.find((x) => x.id === id);
      if (!it) {
        vis.setX(i, 0);
        return;
      }
      const r = SKY_RADIUS * 0.99;
      pos.setXYZ(i, it.eqj.x * r, it.eqj.y * r, it.eqj.z * r);
      base.setX(i, planetMarkerSize(it.magnitude));
      diam.setX(i, it.angularDiameterDeg);
      vis.setX(i, 1);
    });
    pos.needsUpdate = base.needsUpdate = diam.needsUpdate = vis.needsUpdate = true;
  }

  update(pxPerDeg: number, pixelRatio: number): void {
    this.material.uniforms.uPxPerDeg.value = pxPerDeg;
    this.material.uniforms.uPixelRatio.value = pixelRatio;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
