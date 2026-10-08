import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Icon } from '../../components/Icon';
import { LANDMARKS, SATELLITES, hasGlobe, isMoonId, type GlobeId } from '../../catalog/planets/planet-data';
import { formatNumber } from '../../utils/format';
import { assetUrl } from '../../utils/asset-url';
import { createProceduralTexture, createRingTexture } from './procedural-textures';
import { latLonToSphere } from './globe-math';

/** Bodies with a bundled public-domain map (see docs/DATA_SOURCES.md). */
const PHOTO_MAPS: Partial<Record<GlobeId, string>> = {
  io: 'io',
  europa: 'europa',
  ganymede: 'ganymede',
  callisto: 'callisto',
  titan: 'titan',
  mercury: 'mercury',
  venus: 'venus',
  moon: 'moon',
  mars: 'mars',
  jupiter: 'jupiter',
};

/** Relief (elevation) maps available as bump maps. */
const BUMP_MAPS = new Set<GlobeId>(['moon']);
const BUMP_SCALE = 2.5;
/** Load 4K maps once the camera is this much closer than the initial framing. */
const HD_ZOOM_FACTOR = 0.7;

/** One revolution in ~30 s — clearly visible, still calm. */
const AUTO_ROTATE_RAD_PER_SEC = (2 * Math.PI) / 30;

/** Axial tilt (degrees) for a natural-looking globe. */
const AXIAL_TILT: Partial<Record<GlobeId, number>> = {
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
  body: GlobeId;
  name: string;
  onClose(): void;
}

/** Reusable 3D globe viewer: rotate, pinch-zoom, reset, optional auto-rotation and landmarks. */
export default function Planet3DViewer({ body, name, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [autoRotate, setAutoRotate] = useState(
    () => !(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches),
  );
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
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
    // Start with longitude 0° (for the Moon: the Earth-facing near side) toward the camera.
    spinGroup.rotation.y = -Math.PI / 2;
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
    const hasBump = BUMP_MAPS.has(body);
    const loader = new THREE.TextureLoader();
    const loadTexture = (file: string, color: boolean) =>
      new Promise<THREE.Texture>((resolve, reject) =>
        loader.load(
          assetUrl(`textures/planets/${file}`),
          (tex) => {
            if (color) tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            disposables.push(tex);
            resolve(tex);
          },
          undefined,
          reject,
        ),
      );
    /** Swaps in colour (and relief) maps of a given resolution. */
    const applyMaps = async (size: '1k' | '2k' | '4k') => {
      const [map, bump] = await Promise.all([
        loadTexture(`${photo}-${size}.jpg`, true),
        hasBump ? loadTexture(`${photo}-bump-${size === '1k' ? '2k' : size}.jpg`, false) : null,
      ]);
      const oldMap = material.map;
      const oldBump = material.bumpMap;
      material.map = map;
      if (bump) {
        material.bumpMap = bump;
        material.bumpScale = BUMP_SCALE;
      }
      material.needsUpdate = true;
      if (oldMap && oldMap !== map) oldMap.dispose();
      if (oldBump && oldBump !== bump) oldBump.dispose();
    };
    // High-resolution maps are fetched only when the user zooms in (and the GPU supports 4096 px).
    let hdState: 'none' | 'loading' | 'done' =
      photo && renderer.capabilities.maxTextureSize >= 4096 ? 'none' : 'done';

    if (photo) {
      applyMaps(preferSmallTextures() ? '1k' : '2k')
        .then(() => setStatus('ready'))
        .catch(() => {
          applyProceduralTexture();
          setStatus('fallback');
          hdState = 'done';
        });
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

    // Landmark markers (scaled each frame to keep a constant on-screen size).
    const dots: THREE.Mesh[] = [];
    const markers = landmarks.map((lm) => {
      const p = latLonToSphere(lm.lat, lm.lon, 1.002);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        new THREE.MeshBasicMaterial({ color: lm.kind === 'landing' ? 0xffc27a : 0x8ea0ff }),
      );
      dot.position.copy(p);
      spinGroup.add(dot);
      dots.push(dot);
      disposables.push(dot.geometry, dot.material as THREE.Material);
      return { lm, p };
    });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = body === 'saturn' ? 3 : 1.12;
    controls.maxDistance = body === 'saturn' ? 12 : 8;
    // Auto-rotation spins the globe about its own axis (see loop), not the camera.
    controls.autoRotate = false;
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
        fitDistance = camera.position.length();
        fitted = w > 1 && h > 1;
      }
    };
    let fitted = false;
    let fitDistance = camera.position.length();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const world = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const order: number[] = [];
    const facingDot = new Float32Array(markers.length);
    const labelWidth = new Float32Array(markers.length);
    let raf = 0;
    let lastT = performance.now();
    const loop = (now = performance.now()) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      if (autoRotateRef.current) spinGroup.rotation.y += AUTO_ROTATE_RAD_PER_SEC * dt;
      controls.update();
      const dotScale = Math.max(0.08, (camera.position.length() - 1) / Math.max(0.01, fitDistance - 1));
      for (const d of dots) d.scale.setScalar(dotScale);
      renderer.render(scene, camera);
      if (hdState === 'none' && camera.position.length() < fitDistance * HD_ZOOM_FACTOR) {
        hdState = 'loading';
        void applyMaps('4k')
          .then(() => (hdState = 'done'))
          .catch(() => (hdState = 'done'));
      }
      const labels = labelsRef.current;
      if (labels) {
        const w = host.clientWidth;
        const h = host.clientHeight;
        camDir.copy(camera.position).normalize();
        // Most camera-facing labels first; skip any that would overlap an already placed one.
        placed.length = 0;
        order.length = 0;
        markers.forEach(({ p }, i) => {
          world.copy(p).applyMatrix4(spinGroup.matrixWorld);
          facingDot[i] = world.normalize().dot(camDir);
          order.push(i);
        });
        order.sort((a, b) => facingDot[b] - facingDot[a]);
        for (const i of order) {
          const el = labels.children[i] as HTMLElement | undefined;
          if (!el) continue;
          let visible = showLandmarksRef.current && facingDot[i] > 0.2;
          let x = 0;
          let y = 0;
          if (visible) {
            world.copy(markers[i].p).applyMatrix4(spinGroup.matrixWorld).project(camera);
            x = ((world.x + 1) / 2) * w;
            y = ((1 - world.y) / 2) * h;
            const lw = (labelWidth[i] ||= el.offsetWidth || markers[i].lm.name.length * 6.5 + 12);
            const rect = { x: x + 4, y: y - 9, w: lw, h: 18 };
            visible = !placed.some(
              (r) =>
                rect.x < r.x + r.w && rect.x + rect.w > r.x && rect.y < r.y + r.h && rect.y + rect.h > r.y,
            );
            if (visible) placed.push(rect);
          }
          el.style.display = visible ? 'block' : 'none';
          if (visible) el.style.transform = `translate(${x}px, ${y}px)`;
        }
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!hasGlobe(body)) return null;
  const sat = isMoonId(body) ? SATELLITES[body] : null;

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
          <span key={lm.name} className={`landmark-label ${lm.kind}`}>
            {lm.name}
          </span>
        ))}
      </div>
      <header className="viewer3d-top">
        <div>
          <h2>{t('planet3d.title', { name })}</h2>
          {sat && (
            <p className="muted small viewer3d-facts" data-testid="moon-facts">
              {t('planet3d.moonFacts', {
                diameter: formatNumber(sat.diameterKm, i18n.language, 0),
                period: formatNumber(sat.orbitalPeriodDays, i18n.language, 2),
                discovery: sat.discovery,
              })}
            </p>
          )}
        </div>
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
          {t('planet3d.hint')} · {body === 'venus' && status !== 'fallback' && <>{t('planet3d.radar')} · </>}
          {body === 'titan' && status !== 'fallback' && <>{t('planet3d.titanHaze')} · </>}
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
