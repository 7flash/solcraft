
// @ts-nocheck
import * as THREE from "three";
import { makeBuildingGroup } from "../meshes";
import { miniPreviewKey, miniPreviewLabel, normalizePreviewAccent } from "./miniPreviewModel";
import { disposeObject3D } from "./sceneMemoryAssetManager";

export type MiniPreviewKind = "building" | "tree" | "rock" | "food" | "trade" | "npc" | "tile" | "foundation";

type PreviewState = {
  el: HTMLElement;
  key: string;
  img: HTMLImageElement;
};

type PreviewImage = { key: string; url: string; usedAt: number };

const byEl = new WeakMap<HTMLElement, PreviewState>();
const active = new Set<PreviewState>();
const imageCache = new Map<string, PreviewImage>();
const MAX_PREVIEW_IMAGES = 96;
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedRendererFailed = false;

export { miniPreviewKey, miniPreviewLabel, normalizePreviewAccent } from "./miniPreviewModel";

function touchImage(key: string, url: string) {
  imageCache.set(key, { key, url, usedAt: performance.now() });
  if (imageCache.size <= MAX_PREVIEW_IMAGES) return url;
  const victims = [...imageCache.values()].sort((a, b) => a.usedAt - b.usedAt).slice(0, imageCache.size - MAX_PREVIEW_IMAGES);
  for (const v of victims) imageCache.delete(v.key);
  return url;
}
function cachedImage(key: string) {
  const hit = imageCache.get(key);
  if (!hit) return "";
  hit.usedAt = performance.now();
  return hit.url;
}
function rendererForPreview() {
  if (sharedRenderer) return sharedRenderer;
  if (sharedRendererFailed) return null;
  try {
    sharedRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.autoClear = true;
    sharedRenderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    return sharedRenderer;
  } catch {
    sharedRendererFailed = true;
    return null;
  }
}
function mat(color: number, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}
function em(color: number, intensity = 0.45) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.62 });
}
function box(g: THREE.Group, sx: number, sy: number, sz: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function cyl(g: THREE.Group, r1: number, r2: number, h: number, color: number, x = 0, y = 0, z = 0, n = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function parseAccent(value: any, fallback = 0x14f195) {
  const s = normalizePreviewAccent(value);
  if (/^#[0-9a-f]{6}$/i.test(s)) return parseInt(s.slice(1), 16);
  return fallback;
}
function buildBuildingPreview(kind: string, accent: number) {
  const g = new THREE.Group();
  const base = accent || 0x14f195;
  box(g, 1.28, 0.12, 1.28, 0x2d3340, 0, 0.02, 0);
  if (kind === "farm") {
    box(g, 1.1, 0.06, 1.1, 0x4f7a3a, 0, 0.12, 0);
    for (let i = -2; i <= 2; i++) box(g, 0.08, 0.34, 0.08, 0xffd76e, i * 0.18, 0.32, -0.18 + Math.abs(i) * 0.04);
    box(g, 0.42, 0.26, 0.32, 0xb8783c, 0.36, 0.24, 0.28);
  } else if (kind === "mine" || kind === "quarry") {
    cyl(g, 0.46, 0.55, 0.38, 0x737b84, 0, 0.28, 0, 7);
    box(g, 0.9, 0.08, 0.16, 0x6a4124, 0, 0.62, 0, 0);
    box(g, 0.16, 0.55, 0.16, 0x6a4124, -0.35, 0.42, 0);
    box(g, 0.16, 0.55, 0.16, 0x6a4124, 0.35, 0.42, 0);
  } else if (kind === "lumber" || kind === "lumberyard") {
    box(g, 0.8, 0.44, 0.58, 0xb8783c, 0, 0.34, 0);
    box(g, 0.96, 0.16, 0.66, 0x4f2e19, 0, 0.68, 0);
    for (let i = -1; i <= 1; i++) cyl(g, 0.06, 0.06, 0.82, 0x7d4b24, 0.42, 0.22, i * 0.22, 12).rotation.z = Math.PI / 2;
  } else if (kind === "keep" || kind === "tower") {
    cyl(g, 0.34, 0.42, 1.02, 0x8b8b95, 0, 0.58, 0, 10);
    cyl(g, 0.42, 0.34, 0.22, base, 0, 1.18, 0, 10);
    box(g, 0.22, 0.18, 0.08, 0xffd76e, 0, 0.62, -0.35);
  } else if (kind === "foundation") {
    box(g, 1.18, 0.08, 1.18, 0x6b6257, 0, 0.12, 0);
    for (const x of [-0.48, 0.48]) for (const z of [-0.48, 0.48]) cyl(g, 0.045, 0.045, 0.52, 0x7b5a36, x, 0.38, z, 8);
    box(g, 1.04, 0.045, 0.08, base, 0, 0.62, -0.5);
    box(g, 1.04, 0.045, 0.08, base, 0, 0.62, 0.5);
  } else {
    box(g, 0.86, 0.62, 0.72, base, 0, 0.42, 0);
    box(g, 1.0, 0.2, 0.84, 0x233a66, 0, 0.84, 0);
    box(g, 0.22, 0.3, 0.04, 0xffd76e, 0, 0.42, -0.38);
  }
  return g;
}
function buildObjectPreview(kind: string, buildingKind: string, accent: number) {
  if (kind === "building") {
    try {
      const built = makeBuildingGroup(buildingKind || "house", { cl: `#${Math.max(0, Math.min(0xffffff, accent || 0x14f195)).toString(16).padStart(6, "0")}` });
      const g = built?.group || null;
      if (g) { g.scale.setScalar(0.92); g.rotation.y = Math.PI * 0.12; return g; }
    } catch {}
    return buildBuildingPreview(buildingKind || "house", accent);
  }
  const g = new THREE.Group();
  box(g, 1.18, 0.06, 1.18, 0x26313b, 0, 0.02, 0);
  if (kind === "tree") {
    cyl(g, 0.09, 0.12, 0.58, 0x6a4124, 0, 0.34, 0, 10);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.9, 8), mat(0x3fae67)); crown.position.y = 0.98; crown.castShadow = true; g.add(crown);
  } else if (kind === "rock") {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48, 0), mat(0x9aa3ad)); r.scale.set(1.15, 0.72, 0.9); r.position.y = 0.36; r.rotation.set(0.4, 0.7, 0.2); r.castShadow = true; g.add(r);
  } else if (kind === "food") {
    box(g, 1.02, 0.05, 1.02, 0x4f7a3a, 0, 0.08, 0);
    for (let i = 0; i < 13; i++) { const x = ((i % 5) - 2) * 0.16; const z = (Math.floor(i / 5) - 1) * 0.18; cyl(g, 0.018, 0.012, 0.34 + (i % 3) * 0.05, 0xffd76e, x, 0.28, z, 5); }
  } else if (kind === "trade") {
    box(g, 0.9, 0.24, 0.5, 0x7b5a36, 0, 0.24, 0); box(g, 0.72, 0.1, 0.12, 0xffd76e, 0, 0.48, -0.22); cyl(g, 0.05, 0.05, 0.7, 0x14f195, -0.34, 0.58, 0, 8); cyl(g, 0.05, 0.05, 0.7, 0x9945ff, 0.34, 0.58, 0, 8);
  } else if (kind === "npc") {
    cyl(g, 0.18, 0.22, 0.56, 0x31507d, 0, 0.38, 0, 16); const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat(0xf0b887)); head.position.y = 0.86; head.castShadow = true; g.add(head); box(g, 0.45, 0.08, 0.08, 0xffd76e, 0, 0.62, -0.12);
  } else {
    box(g, 0.86, 0.035, 0.86, 0x31507d, 0, 0.1, 0); const marker = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 24), em(0x14f195, 0.4)); marker.rotation.x = -Math.PI / 2; marker.position.y = 0.14; g.add(marker);
  }
  return g;
}
function fitCamera(camera: THREE.PerspectiveCamera, group: THREE.Group) {
  const box3 = new THREE.Box3().setFromObject(group);
  const size = box3.getSize(new THREE.Vector3());
  const center = box3.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  camera.position.set(center.x + maxDim * 1.25, center.y + maxDim * 1.12, center.z + maxDim * 1.65);
  camera.lookAt(center.x, center.y + maxDim * 0.16, center.z);
}
function renderPreviewImage(key: string, kind: string, buildingKind: string, accent: number) {
  const hit = cachedImage(key);
  if (hit) return hit;
  const renderer = rendererForPreview();
  if (!renderer) return "";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 40);
  const group = buildObjectPreview(kind, buildingKind, accent);
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xf3ead7, 0x101822, 2.0));
  const keyLight = new THREE.DirectionalLight(0xfff0c8, 2.8); keyLight.position.set(2.6, 4, 3.2); scene.add(keyLight);
  fitCamera(camera, group);
  try {
    renderer.setSize(240, 180, false);
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL("image/png");
    disposeObject3D(scene, { detach: false });
    return touchImage(key, url);
  } catch {
    disposeObject3D(scene, { detach: false });
    return "";
  }
}
function createPreview(el: HTMLElement): PreviewState | null {
  const kind = String(el.dataset.previewKind || "tile");
  const buildingKind = String(el.dataset.buildingKind || "");
  const rawAccent = normalizePreviewAccent(el.dataset.previewAccent || "");
  const accent = parseAccent(rawAccent);
  const key = miniPreviewKey(kind, buildingKind, rawAccent);
  const url = renderPreviewImage(key, kind, buildingKind, accent);
  if (!url) { el.classList.add("mini3d-preview-failed"); return null; }
  el.classList.remove("mini3d-preview-failed");
  const img = document.createElement("img");
  img.src = url;
  img.alt = miniPreviewLabel(kind, buildingKind);
  img.loading = "lazy";
  img.decoding = "async";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
  img.draggable = false;
  el.replaceChildren(img);
  el.setAttribute("aria-label", miniPreviewLabel(kind, buildingKind));
  const state: PreviewState = { el, key, img };
  byEl.set(el, state); active.add(state);
  return state;
}
export function disposeMiniPreview(state: PreviewState | null | undefined) {
  if (!state) return;
  try { state.img.remove(); } catch {}
  active.delete(state);
}
export function disposeMiniPreviews() {
  Array.from(active).forEach(disposeMiniPreview);
  active.clear();
  try { sharedRenderer?.dispose?.(); } catch {}
  try { sharedRenderer?.domElement?.remove?.(); } catch {}
  sharedRenderer = null;
}
export function syncMiniPreviewPanels(root: ParentNode = document) {
  for (const state of Array.from(active)) {
    const nextKey = miniPreviewKey(state.el.dataset.previewKind, state.el.dataset.buildingKind, state.el.dataset.previewAccent);
    if (!state.el.isConnected || nextKey !== state.key) disposeMiniPreview(state);
  }
  const nodes = Array.from(root.querySelectorAll?.("[data-mini3d-preview]") || []) as HTMLElement[];
  for (const el of nodes) {
    if (!el.isConnected) continue;
    const state = byEl.get(el);
    if (!state || !active.has(state)) createPreview(el);
  }
}
