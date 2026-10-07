import type { SolarBodyId } from '../../astronomy/types';

/**
 * Original, procedurally generated illustrative textures for bodies without a bundled
 * public-domain map (no third-party imagery involved). Deterministic via a seeded PRNG.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RGB = [number, number, number];

const PALETTES: Partial<Record<SolarBodyId, { bands: RGB[]; turbulence: number; seed: number }>> = {
  saturn: {
    bands: [
      [222, 196, 148],
      [206, 178, 128],
      [232, 210, 166],
      [196, 166, 118],
      [226, 202, 156],
    ],
    turbulence: 0.12,
    seed: 6,
  },
  uranus: {
    bands: [
      [168, 222, 228],
      [158, 214, 222],
      [176, 228, 232],
    ],
    turbulence: 0.06,
    seed: 7,
  },
  neptune: {
    bands: [
      [72, 108, 214],
      [62, 96, 200],
      [88, 126, 226],
      [58, 90, 190],
    ],
    turbulence: 0.15,
    seed: 8,
  },
  venus: {
    bands: [
      [232, 214, 170],
      [222, 200, 150],
      [238, 222, 182],
    ],
    turbulence: 0.5,
    seed: 2,
  },
  jupiter: {
    bands: [
      [216, 196, 168],
      [176, 130, 96],
      [232, 220, 196],
      [160, 116, 84],
      [220, 204, 176],
    ],
    turbulence: 0.35,
    seed: 5,
  },
};

function bandedTexture(ctx: CanvasRenderingContext2D, w: number, h: number, body: SolarBodyId) {
  const p = PALETTES[body]!;
  const rnd = mulberry32(p.seed);
  const nBands = 28;
  const bandColors = Array.from({ length: nBands }, () => p.bands[Math.floor(rnd() * p.bands.length)]);
  const phase = Array.from({ length: 6 }, () => rnd() * Math.PI * 2);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const lat = y / h;
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      const wobble =
        p.turbulence *
        0.02 *
        (Math.sin(lon * 3 + phase[0] + lat * 20) + 0.5 * Math.sin(lon * 7 + phase[1] + lat * 41));
      const f = Math.min(0.9999, Math.max(0, lat + wobble)) * nBands;
      const i = Math.floor(f);
      const tt = f - i;
      const a = bandColors[i];
      const b = bandColors[Math.min(nBands - 1, i + 1)];
      const s = tt * tt * (3 - 2 * tt);
      const shade =
        1 - 0.12 * Math.pow(Math.abs(lat - 0.5) * 2, 3) + 0.03 * Math.sin(lon * 11 + phase[2] + lat * 60);
      const o = (y * w + x) * 4;
      img.data[o] = (a[0] + (b[0] - a[0]) * s) * shade;
      img.data[o + 1] = (a[1] + (b[1] - a[1]) * s) * shade;
      img.data[o + 2] = (a[2] + (b[2] - a[2]) * s) * shade;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function crateredTexture(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, base: RGB) {
  const rnd = mulberry32(seed);
  ctx.fillStyle = `rgb(${base.join(',')})`;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w;
    const y = h * (0.05 + 0.9 * rnd());
    const r = Math.pow(rnd(), 3) * 26 + 1.5;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    const d = 0.75 + rnd() * 0.2;
    g.addColorStop(0, `rgba(${base.map((c) => Math.round(c * d)).join(',')},0.9)`);
    g.addColorStop(0.8, `rgba(${base.map((c) => Math.round(c * 0.85)).join(',')},0.5)`);
    g.addColorStop(1, `rgba(${base.map((c) => Math.min(255, Math.round(c * 1.12))).join(',')},0.35)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createProceduralTexture(body: SolarBodyId, width = 2048): HTMLCanvasElement {
  const w = width;
  const h = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (PALETTES[body]) bandedTexture(ctx, w, h, body);
  else if (body === 'mercury') crateredTexture(ctx, w, h, 3, [150, 142, 134]);
  else if (body === 'moon') crateredTexture(ctx, w, h, 9, [160, 160, 156]);
  else if (body === 'mars') crateredTexture(ctx, w, h, 4, [186, 104, 66]);
  else crateredTexture(ctx, w, h, 1, [140, 140, 140]);
  return canvas;
}

/** Radial ring texture (u = radius) with Saturn's main ring structure incl. the Cassini Division. */
export function createRingTexture(): HTMLCanvasElement {
  const w = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = 4;
  const ctx = canvas.getContext('2d')!;
  const rnd = mulberry32(11);
  const img = ctx.createImageData(w, 4);
  for (let x = 0; x < w; x++) {
    const r = x / w; // 0 = inner edge (C ring), 1 = outer edge (A ring)
    let alpha: number;
    if (r < 0.2)
      alpha = 0.18 + r * 0.6; // C ring (faint)
    else if (r < 0.62)
      alpha = 0.8 + 0.15 * Math.sin(r * 90); // B ring (bright)
    else if (r < 0.68)
      alpha = 0.06; // Cassini Division
    else if (r < 0.93)
      alpha = 0.6 + 0.1 * Math.sin(r * 120); // A ring
    else if (r < 0.945)
      alpha = 0.12; // Encke gap region
    else alpha = 0.5;
    alpha *= 0.85 + 0.15 * rnd();
    const c = r < 0.62 ? [228, 212, 178] : [206, 190, 160];
    for (let y = 0; y < 4; y++) {
      const o = (y * w + x) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
