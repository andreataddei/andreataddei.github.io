// TERRA VISION main: scene, controls, WebXR, measurement, HUD wiring.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { createTerrain } from "./terrain.js";

const GRID_SIZE = 256;      // heightfield resolution
const CELLS = 8;            // base noise cells (before octaves)

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060607);
scene.fog = new THREE.Fog(0x060607, 260, 640);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(130, 110, 150);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 12, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 20;
controls.maxDistance = 480;
controls.enableDamping = true;

// ---------- lights ----------
scene.add(new THREE.AmbientLight(0x9aa4c4, 0.55));
const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
sun.position.set(160, 220, 90);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x4f6cff, 0.5);
fill.position.set(-140, 80, -120);
scene.add(fill);

// ---------- starfield ----------
{
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 500 + Math.random() * 300;
    const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(p) * Math.cos(t);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(p)) - 60;
    pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9aa4c4, size: 1.2, sizeAttenuation: false })));
}

// ---------- terrain ----------
let seed = 42;
let terrain = createTerrain(GRID_SIZE, CELLS, seed);
scene.add(terrain);

const slider = document.getElementById("time");
slider.addEventListener("input", () => {
  const t = parseInt(slider.value, 10) / 100;
  // epoch switch + dryness tint: T1 shows degraded vegetation,
  // like the same territory acquired at a later, drier date.
  const dry = t;
  terrain.material.map = t < 0.5 ? terrain.userData.t0 : terrain.userData.t1;
  terrain.material.color.setRGB(1, 1 - 0.28 * dry, 1 - 0.22 * dry);
  terrain.material.needsUpdate = true;
});

const seedLabel = document.getElementById("seed-label");
function rerollTerrain(newSeed) {
  seed = newSeed;
  scene.remove(terrain);
  terrain.geometry.dispose();
  terrain.userData.t0.dispose();
  terrain.userData.t1.dispose();
  terrain = createTerrain(GRID_SIZE, CELLS, seed);
  scene.add(terrain);
  clearMeasure();
  seedLabel.textContent = "seed " + seed;
}
document.getElementById("reroll").addEventListener("click", () => rerollTerrain((seed * 1103515245 + 12345) % 2147483647));

// ---------- measurement ----------
const measureLabel = document.getElementById("measure");
const markers = [];
const markerMat = new THREE.MeshBasicMaterial({ color: 0x6f8cff });
let line = null;

function addMarker(point) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 12), markerMat);
  m.position.copy(point);
  scene.add(m);
  markers.push(m);
}

function drawLine(a, b) {
  if (line) { scene.remove(line); line.geometry.dispose(); }
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x6f8cff }));
  scene.add(line);
}

function clearMeasure() {
  markers.forEach((m) => { scene.remove(m); m.geometry.dispose(); });
  markers.length = 0;
  if (line) { scene.remove(line); line.geometry.dispose(); line = null; }
  measureLabel.textContent = "click 2 pts";
}
document.getElementById("clear").addEventListener("click", clearMeasure);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("pointerup", (e) => {
  if (renderer.xr.isPresenting) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(terrain, false)[0];
  if (!hit) return;
  if (markers.length === 2) clearMeasure();
  addMarker(hit.point);
  if (markers.length === 2) {
    drawLine(markers[0].position, markers[1].position);
    const d = markers[0].position.distanceTo(markers[1].position);
    measureLabel.textContent = d.toFixed(1) + " u";
  }
});

// ---------- resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- loop ----------
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
