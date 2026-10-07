import * as THREE from 'three';
import { SKY_RADIUS, type SolarRenderItem } from './types';

const pointVertex = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixelRatio;
  }
`;

const sunFragment = /* glsl */ `
  uniform float uDiscFrac;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float disc = 1.0 - smoothstep(uDiscFrac * 0.92, uDiscFrac, d);
    float glow = pow(max(0.0, 1.0 - d), 2.5) * 0.7;
    vec3 col = mix(vec3(1.0, 0.75, 0.4), vec3(1.0, 0.97, 0.88), disc);
    gl_FragColor = vec4(col, clamp(disc + glow, 0.0, 1.0));
  }
`;

// Moon disc with a phase terminator. uSunDir is the 2D screen direction toward the Sun.
const moonFragment = /* glsl */ `
  uniform float uIllum;
  uniform vec2 uSunDir;
  uniform float uDiscFrac;
  void main() {
    vec2 p = vec2(gl_PointCoord.x - 0.5, 0.5 - gl_PointCoord.y) * 2.0 / uDiscFrac;
    float r = length(p);
    float glow = pow(max(0.0, 1.0 - length(gl_PointCoord - 0.5) * 2.0), 3.0) * 0.25 * uIllum;
    if (r > 1.0) {
      if (glow <= 0.01) discard;
      gl_FragColor = vec4(0.85, 0.87, 0.9, glow);
      return;
    }
    vec2 s = normalize(uSunDir);
    float x = dot(p, s);
    float y = dot(p, vec2(-s.y, s.x));
    float limb = sqrt(max(0.0, 1.0 - y * y));
    float lit = smoothstep(-0.04, 0.04, x - (1.0 - 2.0 * uIllum) * limb);
    float edge = 1.0 - smoothstep(0.94, 1.0, r);
    vec3 dark = vec3(0.10, 0.11, 0.14);
    vec3 bright = vec3(0.93, 0.92, 0.86);
    gl_FragColor = vec4(mix(dark, bright, lit), edge * mix(0.55, 1.0, lit));
  }
`;

function singlePoint(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SKY_RADIUS * 1.01);
  return g;
}

export class SunMoonLayer {
  readonly sun: THREE.Points;
  readonly moon: THREE.Points;
  private readonly sunMat: THREE.ShaderMaterial;
  private readonly moonMat: THREE.ShaderMaterial;
  private sunDiam = 0.53;
  private moonDiam = 0.52;

  constructor() {
    this.sunMat = new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: sunFragment,
      uniforms: { uSize: { value: 40 }, uPixelRatio: { value: 1 }, uDiscFrac: { value: 0.4 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.moonMat = new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: moonFragment,
      uniforms: {
        uSize: { value: 20 },
        uPixelRatio: { value: 1 },
        uIllum: { value: 0.5 },
        uSunDir: { value: new THREE.Vector2(1, 0) },
        uDiscFrac: { value: 0.8 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.sun = new THREE.Points(singlePoint(), this.sunMat);
    this.moon = new THREE.Points(singlePoint(), this.moonMat);
    for (const o of [this.sun, this.moon]) {
      o.frustumCulled = false;
      o.renderOrder = 5;
    }
  }

  setItems(items: SolarRenderItem[]): void {
    const r = SKY_RADIUS * 0.985;
    for (const it of items) {
      const target = it.id === 'sun' ? this.sun : it.id === 'moon' ? this.moon : null;
      if (!target) continue;
      const pos = target.geometry.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, it.eqj.x * r, it.eqj.y * r, it.eqj.z * r);
      pos.needsUpdate = true;
      if (it.id === 'sun') this.sunDiam = it.angularDiameterDeg;
      else {
        this.moonDiam = it.angularDiameterDeg;
        this.moonMat.uniforms.uIllum.value = it.illuminatedFraction ?? 0.5;
      }
    }
  }

  /** Called per frame: sizes depend on zoom; the Moon's terminator faces the Sun on screen. */
  update(pxPerDeg: number, pixelRatio: number, sunDirX: number, sunDirY: number): void {
    const sunDisc = this.sunDiam * pxPerDeg;
    const sunSize = Math.max(34, sunDisc * 2.6);
    this.sunMat.uniforms.uSize.value = sunSize;
    this.sunMat.uniforms.uDiscFrac.value = Math.max(0.28, Math.min(0.9, sunDisc / sunSize));
    this.sunMat.uniforms.uPixelRatio.value = pixelRatio;

    const moonDisc = Math.max(14, this.moonDiam * pxPerDeg);
    const moonSize = moonDisc * 1.5;
    this.moonMat.uniforms.uSize.value = moonSize;
    this.moonMat.uniforms.uDiscFrac.value = moonDisc / moonSize;
    this.moonMat.uniforms.uPixelRatio.value = pixelRatio;
    if (Math.abs(sunDirX) + Math.abs(sunDirY) > 1e-6) {
      (this.moonMat.uniforms.uSunDir.value as THREE.Vector2).set(sunDirX, sunDirY);
    }
  }

  dispose(): void {
    for (const o of [this.sun, this.moon]) o.geometry.dispose();
    this.sunMat.dispose();
    this.moonMat.dispose();
  }
}
