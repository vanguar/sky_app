import * as THREE from 'three';
import { horizontalToVector } from '../astronomy/coordinate-transform';
import { SKY_RADIUS } from './types';

const NIGHT_GROUND = new THREE.Color('#05080d');
const DAY_GROUND = new THREE.Color('#1a2430');

/** Ground (dims everything below the horizon), horizon line and optional alt/az grid — world frame. */
export class HorizonLayer {
  readonly group = new THREE.Group();
  private readonly groundMat: THREE.MeshBasicMaterial;
  private readonly grid: THREE.LineSegments;

  constructor() {
    const groundGeo = new THREE.SphereGeometry(
      SKY_RADIUS * 0.9,
      48,
      16,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2,
    );
    this.groundMat = new THREE.MeshBasicMaterial({
      color: NIGHT_GROUND,
      transparent: true,
      opacity: 0.86,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.renderOrder = 10;
    ground.frustumCulled = false;

    const ring: number[] = [];
    const v = { x: 0, y: 0, z: 0 };
    for (let az = 0; az < 360; az += 1) {
      horizontalToVector(0, az, v);
      ring.push(v.x * SKY_RADIUS * 0.9, v.y, v.z * SKY_RADIUS * 0.9);
    }
    const horizonGeo = new THREE.BufferGeometry();
    horizonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3));
    const horizon = new THREE.LineLoop(
      horizonGeo,
      new THREE.LineBasicMaterial({ color: '#6f80d0', transparent: true, opacity: 0.75, depthTest: false }),
    );
    horizon.renderOrder = 11;
    horizon.frustumCulled = false;

    const g: number[] = [];
    const push = (alt: number, az: number) => {
      horizontalToVector(alt, az, v);
      g.push(v.x * SKY_RADIUS * 0.97, v.y * SKY_RADIUS * 0.97, v.z * SKY_RADIUS * 0.97);
    };
    for (let alt = 15; alt < 90; alt += 15) {
      for (let az = 0; az < 360; az += 3) {
        push(alt, az);
        push(alt, az + 3);
      }
    }
    for (let az = 0; az < 360; az += 30) {
      for (let alt = 0; alt < 88; alt += 3) {
        push(alt, az);
        push(alt + 3, az);
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(g, 3));
    this.grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: '#3a4a86', transparent: true, opacity: 0.35, depthTest: false }),
    );
    this.grid.renderOrder = 0;
    this.grid.frustumCulled = false;
    this.grid.visible = false;

    this.group.add(this.grid, ground, horizon);
  }

  setGridVisible(on: boolean): void {
    this.grid.visible = on;
  }

  setDaylight(daylight: number): void {
    this.groundMat.color.copy(NIGHT_GROUND).lerp(DAY_GROUND, daylight);
  }

  dispose(): void {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
  }
}
