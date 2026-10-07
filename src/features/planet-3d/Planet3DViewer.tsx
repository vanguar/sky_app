import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SolarBodyId } from '../../astronomy/types';
import { Icon } from '../../components/Icon';
import { BODY_DATA, LANDMARKS } from '../../catalog/planets/planet-data';
import { assetUrl } from '../../utils/asset-url';
import { createProceduralTexture, createRingTexture } from './procedural-textures';
import { latLonToSphere } from './globe-math';

/** Bodies with a bundled public-domain map (see docs/DATA_SOURCES.md). */
const PHOTO_MAPS: Partial<Record<SolarBodyId, string>> = {
  moon: 'moon',
  mars: 'mars',
  jupiter: 'jupiter',
};

/** Axial tilt (degrees) for a natural-looking globe. */
const AXIAL_TILT: Partial<Record<SolarBodyId, number>> = {
  mars: 25.2,
  jupiter: 3.1,
  saturn: 26.7,
  uranus: 97.8,
  neptune: 28.3,
  moon: 6.7,
};

function preferSmallTextures(): boolean {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const px = Math.max(window.screen.width, window.screen.height) * (window.devicePixelRatio || 1);
  return (mem !== undefined && mem < 4) || px < 1400;
}

interface Props {
  body: SolarBodyId;
  name: string;
  onClose(): void;
}

/** Reusable 3D globe viewer: rotate, pinch-zoom, reset, optional auto-rotation and landmarks. */
export default function Planet3DViewer({ body, name, onClose }: Props) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading');
  const textureKind = PHOTO_MAPS[body] ? 'photo' : 'procedural';
  const landmarks = LANDMARKS[body] ?? [];
  const showLandmarksRef = useRef(showLandmarks);
  showLandmarksRef.current = showLandmarks;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, body === 'saturn' ? 2.4 : 0.4, body === 'saturn' ? 6.2 : 3.4);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(5, 2, 4);
    scene.add(sunLight);

    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = -((AXIAL_TILT[body] ?? 0) * Math.PI) / 180;
    scene.add(tiltGroup);
    const spinGroup = new THREE.Group();
    tiltGroup.add(spinGroup);

    const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
    spinGroup.add(globe);

    const disposables: { dispose(): void }[] = [globe.geometry, material];
    const applyProceduralTexture = () => {
      const tex = new THREE.CanvasTexture(createProceduralTexture(body));
      tex.colorSpace = THREE.SRGBColorSpace;
      material.map = tex;
      material.needsUpdate = true;
      disposables.push(tex);
    };

    const photo = PHOTO_MAPS[body];
    if (photo) {
      const size = preferSmallTextures() ? '1k' : '2k';
      new THREE.TextureLoader().load(
        assetUrl(`textures/planets/${photo}-${size}.jpg`),
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          material.map = tex;
          material.needsUpdate = true;
          disposables.push(tex);
          setStatus('ready');
        },
        undefined,
        () => {
          applyProceduralTexture();
          setStatus('fallback');
        },
      );
    } else {
      applyProceduralTexture();
      setStatus('ready');
    }

    if (body === 'saturn') {
      // Rings as a separate mesh: radial UVs (u = 0 inner edge, 1 outer edge).
      const inner = 1.24;
      const outer = 2.27;
      const ringGeo = new THREE.RingGeometry(inner, outer, 128, 1);
      const pos = ringGeo.attributes.position;
      const uv = ringGeo.attributes.uv;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
      }
      const ringTex = new THREE.CanvasTexture(createRingTexture());
      ringTex.colorSpace = THREE.SRGBColorSpace;
      const ringMat = new THREE.MeshStandardMaterial({
        map: ringTex,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 1,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      tiltGroup.add(ring);
      disposables.push(ringGeo, ringMat, ringTex);
    }

    // Landmark markers.
    const markers = landmarks.map((lm) => {
      const p = latLonToSphere(lm.lat, lm.lon, 1.002);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x8ea0ff }),
      );
      dot.position.copy(p);
      spinGroup.add(dot);
      disposables.push(dot.geometry, dot.material as THREE.Material);
      return { lm, p };
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = body === 'saturn' ? 3 : 1.4;
    controls.maxDistance = body === 'saturn' ? 12 : 8;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.saveState();
    controlsRef.current = controls;

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!fitted) {
        // Fit the globe (or Saturn's rings) into the narrower screen dimension.
        const vfov = (camera.fov * Math.PI) / 180;
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
        const radius = body === 'saturn' ? 2.35 : 1;
        camera.position.setLength((radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.12);
        controls.maxDistance = Math.max(controls.maxDistance, camera.position.length() * 1.6);
        controls.saveState();
        fitted = w > 1 && h > 1;
      }
    };
    let fitted = false;
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const world = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
      const labels = labelsRef.current;
      if (labels) {
        const w = host.clientWidth;
        const h = host.clientHeight;
        camDir.copy(camera.position).normalize();
        markers.forEach(({ p }, i) => {
          const el = labels.children[i] as HTMLElement | undefined;
          if (!el) return;
          world.copy(p).applyMatrix4(spinGroup.matrixWorld);
          const facing = world.clone().normalize().dot(camDir) > 0.15;
          world.project(camera);
          el.style.display = facing && showLandmarksRef.current ? 'block' : 'none';
          el.style.transform = `translate(${((world.x + 1) / 2) * w}px, ${((1 - world.y) / 2) * h}px)`;
        });
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      controlsRef.current = null;
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Re-create only when the body changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!BODY_DATA[body].globe) return null;

  return (
    <div
      className="viewer3d"
      role="dialog"
      aria-modal="true"
      aria-label={t('planet3d.title', { name })}
      data-testid="planet-3d"
    >
      <div className="viewer3d-canvas" ref={hostRef} />
      <div className="viewer3d-labels" ref={labelsRef} aria-hidden="true">
        {landmarks.map((lm) => (
          <span key={lm.name} className="landmark-label">
            {lm.name}
          </span>
        ))}
      </div>
      <header className="viewer3d-top">
        <h2>{t('planet3d.title', { name })}</h2>
        <button
          type="button"
          className="icon-btn glass"
          onClick={onClose}
          aria-label={t('planet3d.close')}
          data-testid="close-3d"
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="viewer3d-status" aria-live="polite">
        {status === 'loading' && <span>{t('planet3d.loading')}</span>}
        {status === 'fallback' && <span className="warn">{t('planet3d.textureError')}</span>}
        {status === 'error' && <span className="warn">{t('errors.webgl')}</span>}
      </div>
      <footer className="viewer3d-bottom">
        <p className="muted small">
          {t('planet3d.hint')} ·{' '}
          {textureKind === 'photo' && status !== 'fallback' ? t('planet3d.photo') : t('planet3d.procedural')}
        </p>
        <div className="row-buttons">
          <button type="button" className="btn btn-small" onClick={() => controlsRef.current?.reset()}>
            <Icon name="rotate" size={16} /> {t('planet3d.reset')}
          </button>
          <button
            type="button"
            className={`btn btn-small ${autoRotate ? 'btn-accent' : ''}`}
            aria-pressed={autoRotate}
            onClick={() => setAutoRotate((v) => !v)}
          >
            {t('planet3d.autoRotate')}
          </button>
          {landmarks.length > 0 && (
            <button
              type="button"
              className={`btn btn-small ${showLandmarks ? 'btn-accent' : ''}`}
              aria-pressed={showLandmarks}
              onClick={() => setShowLandmarks((v) => !v)}
            >
              {t('planet3d.landmarks')}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
