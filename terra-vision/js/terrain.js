// Terrain: fractal heightfield + runtime-painted satellite-style textures.
import * as THREE from "three";

// ---- deterministic PRNG (mulberry32) ----
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- value-noise heightfield with octaves ----
export function buildHeightfield(size, cells, seed) {
  const rand = rng(seed);
  const grid = [];
  for (let y = 0; y <= cells; y++) {
    grid[y] = [];
    for (let x = 0; x <= cells; x++) grid[y][x] = rand();
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  function sampleNoise(nx, ny) {
    const gx = nx * cells, gy = ny * cells;
    const x0 = Math.min(cells - 1, Math.floor(gx)), y0 = Math.min(cells - 1, Math.floor(gy));
    const fx = smooth(gx - x0), fy = smooth(gy - y0);
    const a = grid[y0][x0], b = grid[y0][x0 + 1], c = grid[y0 + 1][x0], d = grid[y0 + 1][x0 + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  const hf = new Float32Array(size * size);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1), ny = y / (size - 1);
      let v = 0, amp = 1, total = 0, freq = 1;
      for (let o = 0; o < 5; o++) {
        v += sampleNoise((nx * freq) % 1, (ny * freq) % 1) * amp;
        total += amp; amp *= 0.5; freq *= 2.3;
      }
      v /= total;
      hf[y * size + x] = v;
      if (v < min) min = v; if (v > max) max = v;
    }
  }
  for (let i = 0; i < hf.length; i++) hf[i] = (hf[i] - min) / (max - min);
  return hf;
}

// ---- satellite-style false-color texture (NDVI-like), painted at runtime ----
function paintTexture(size, hf, epoch) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const h = hf[i];
    let r, g, b;
    if (h < 0.22) {                     // water
      r = 24; g = 52; b = 92;
    } else if (h < 0.4) {               // shore / barren
      r = 92; g = 84; b = 62;
    } else if (h < 0.72) {              // vegetation (false-color: brighter with NDVI)
      const lush = (0.72 - h) * 2.2;
      r = 40 + lush * 30;
      g = 90 + lush * 90;
      b = 44 + lush * 26;
    } else {                            // high ground / rock
      r = 128; g = 122; b = 112;
    }
    if (epoch === 1) {                  // T1: drier — vegetation degraded
      if (h >= 0.4 && h < 0.72) { g *= 0.62; r *= 1.35; }
    }
    img.data[i * 4] = r; img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export const TERRAIN_SIZE = 200;   // world units
export const HEIGHT_SCALE = 34;

export function createTerrain(size, cells, seed) {
  const hf = buildHeightfield(size, cells, seed);
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, size - 1, size - 1);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, hf[i] * HEIGHT_SCALE);
  }
  geometry.computeVertexNormals();

  const t0 = paintTexture(size, hf, 0);
  const t1 = paintTexture(size, hf, 1);
  const material = new THREE.MeshStandardMaterial({
    map: t0, roughness: 0.9, metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { hf, size, t0, t1 };
  return mesh;
}

export function heightAt(mesh, x, z) {
  const { hf, size } = mesh.userData;
  const nx = (x / TERRAIN_SIZE + 0.5) * (size - 1);
  const ny = (1 - (z / TERRAIN_SIZE + 0.5)) * (size - 1);
  const x0 = Math.max(0, Math.min(size - 1, Math.floor(nx)));
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(ny)));
  return hf[y0 * size + x0] * HEIGHT_SCALE;
}