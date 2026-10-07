import * as THREE from 'three';
import { raDecToVector } from '../astronomy/coordinate-transform';
import { bvToRgb } from '../catalog/stars/stars';
import type { StarCatalog } from '../catalog/types';
import { SKY_RADIUS } from './types';

const vertexShader = /* glsl */ `
  attribute float aMag;
  attribute vec3 aColor;
  uniform float uPixelRatio;
  uniform float uMagLimit;
  uniform float uSizeScale;
  uniform float uFade;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float rel = uMagLimit - aMag;
    float size = clamp(2.3 + rel * 1.2, 2.0, 15.0) * uSizeScale;
    vAlpha = clamp(rel * 0.6 + 0.45, 0.0, 1.0) * uFade;
    vColor = aColor;
    gl_PointSize = rel < -0.5 ? 0.0 : size * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0 || vAlpha <= 0.0) discard;
    float core = 1.0 - smoothstep(0.0, 1.0, d);
    float a = clamp(core * 1.35, 0.0, 1.0) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

/** All catalog stars in one THREE.Points draw call; size/brightness from magnitude, colour from B−V. */
export class StarLayer {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  /** EQJ unit vectors (x, y, z per star), shared with picking & labels. */
  readonly eqj: Float32Array;
  readonly mags: Float32Array;

  constructor(catalog: StarCatalog) {
    const n = catalog.stars.length;
    const positions = new Float32Array(n * 3);
    this.eqj = new Float32Array(n * 3);
    this.mags = new Float32Array(n);
    const colors = new Float32Array(n * 3);
    const v = { x: 0, y: 0, z: 0 };
    catalog.stars.forEach((s, i) => {
      raDecToVector(s.raDeg, s.decDeg, v);
      this.eqj[i * 3] = v.x;
      this.eqj[i * 3 + 1] = v.y;
      this.eqj[i * 3 + 2] = v.z;
      positions[i * 3] = v.x * SKY_RADIUS;
      positions[i * 3 + 1] = v.y * SKY_RADIUS;
      positions[i * 3 + 2] = v.z * SKY_RADIUS;
      this.mags[i] = s.mag;
      const [r, g, b] = bvToRgb(s.bv);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(this.mags, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.01);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uPixelRatio: { value: 1 },
        uMagLimit: { value: 5.5 },
        uSizeScale: { value: 1 },
        uFade: { value: 1 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 3;
  }

  /** Faintest magnitude drawn for a field of view and daylight level. */
  static magnitudeLimit(fov: number, daylight: number): number {
    const base = 5.4 + 2.2 * Math.log10(60 / fov);
    return Math.min(7.2, Math.max(4.3, base)) - daylight * 6.5;
  }

  update(fov: number, pixelRatio: number, daylight: number, brightness: number): void {
    const u = this.material.uniforms;
    u.uPixelRatio.value = pixelRatio;
    u.uMagLimit.value = StarLayer.magnitudeLimit(fov, daylight);
    u.uSizeScale.value = Math.min(1.6, Math.max(0.85, Math.pow(60 / fov, 0.25)));
    u.uFade.value = (1 - 0.85 * daylight) * (0.55 + 0.45 * brightness);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
  }
}
