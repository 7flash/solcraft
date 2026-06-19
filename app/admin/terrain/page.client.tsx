// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import * as THREE from "three";
import {
  loadAtlasRuntimeConfig,
  setTerrainVisualPrefs,
  terrainMats,
  tickVisualTextures,
} from "../../../client/textures";

const rootId = "solcraft-terrain-lab";
let mounted = false;

const PREF_KEY = "solcraft:visual.v1";
const TILE_KINDS = ["grass", "forest", "sand", "rocky", "soil", "farm", "water", "moss", "claimed", "path", "cobble", "deck"];

function clamp01(v: any, fallback = 0.5) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
    return {
      warmth: clamp01(raw.warmth, 0.62),
      texture: clamp01(raw.texture, 0.38),
      shadows: raw.shadows === false ? false : true,
    };
  } catch {
    return { warmth: 0.62, texture: 0.38, shadows: true };
  }
}

function savePrefs(p: any) {
  const next = {
    warmth: clamp01(p.warmth, 0.62),
    texture: clamp01(p.texture, 0.38),
    shadows: p.shadows === false ? false : true,
  };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch {}
  try { window.dispatchEvent(new CustomEvent("solcraft:visual-changed", { detail: next })); } catch {}
  return next;
}

export default function mount() {
  const root = document.getElementById(rootId);
  if (!root || mounted) return;
  mounted = true;

  root.className = "terrain-lab";
  root.replaceChildren();

  const worldEl = document.createElement("div");
  worldEl.className = "terrain-world";
  const uiEl = document.createElement("div");
  uiEl.className = "terrain-ui";
  root.append(worldEl, uiEl);

  const st = {
    prefs: loadPrefs(),
    status: "Procedural terrain lab ready.",
    selected: "grass",
    swatches: TILE_KINDS.slice(),
  };

  setTerrainVisualPrefs(st.prefs);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f13);
  const camera = new THREE.OrthographicCamera(-6, 6, 4.2, -4.2, 0.1, 100);
  camera.position.set(6.4, 6.2, 6.4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = false;
  worldEl.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xfff4d9, 0x24311f, 1.65));
  const sun = new THREE.DirectionalLight(0xffe5bd, 1.0);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const tileGeo = new THREE.BoxGeometry(0.96, 0.16, 0.96);
  const labelSprites: THREE.Object3D[] = [];
  const tileMeshes: THREE.Mesh[] = [];

  function label(text: string) {
    const cv = document.createElement("canvas");
    cv.width = 256; cv.height = 56;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "rgba(14,18,18,.64)";
    ctx.beginPath();
    ctx.roundRect?.(14, 8, 228, 40, 12);
    if (!ctx.roundRect) ctx.fillRect(14, 8, 228, 40); else ctx.fill();
    ctx.fillStyle = "#fff1d3";
    ctx.font = "800 22px Outfit, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 29);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(1.35, 0.3, 1);
    return sp;
  }

  function buildGrid() {
    for (const m of tileMeshes) {
      scene.remove(m);
      (m.material as any)?.forEach?.((mat: any) => mat?.dispose?.());
      if (!Array.isArray(m.material)) (m.material as any)?.dispose?.();
    }
    for (const sp of labelSprites) scene.remove(sp);
    tileMeshes.length = 0;
    labelSprites.length = 0;

    const cols = 4;
    st.swatches.forEach((kind, i) => {
      const x = (i % cols) - 1.5;
      const z = Math.floor(i / cols) - 1.35;
      const tint = kind === "claimed" ? 0x68d6a1 : undefined;
      const mesh = new THREE.Mesh(tileGeo, terrainMats(kind, tint));
      mesh.position.set(x * 1.25, 0, z * 1.25);
      mesh.userData.kind = kind;
      scene.add(mesh); tileMeshes.push(mesh);
      const sp = label(kind);
      sp.position.set(mesh.position.x, 0.42, mesh.position.z + 0.08);
      scene.add(sp); labelSprites.push(sp);
    });
  }

  function resize() {
    const w = worldEl.clientWidth || window.innerWidth;
    const h = worldEl.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    const view = 4.2;
    camera.left = -view * aspect;
    camera.right = view * aspect;
    camera.top = view;
    camera.bottom = -view;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  function apply(next: any, msg = "Terrain feel saved.") {
    st.prefs = savePrefs({ ...st.prefs, ...next });
    setTerrainVisualPrefs(st.prefs);
    buildGrid();
    st.status = msg;
    paint();
  }

  function preset(name: string) {
    if (name === "comfort") apply({ warmth: 0.66, texture: 0.28 }, "Comfort preset: soft, readable, warm.");
    else if (name === "crisp") apply({ warmth: 0.48, texture: 0.52 }, "Crisp preset: stronger procedural detail.");
    else if (name === "calm") apply({ warmth: 0.76, texture: 0.18 }, "Calm preset: lampy low-noise terrain.");
  }

  async function reloadAtlas() {
    st.status = "Reloading published atlas runtime…";
    paint();
    await loadAtlasRuntimeConfig(true).catch(() => null);
    setTerrainVisualPrefs(st.prefs);
    buildGrid();
    st.status = "Atlas runtime reloaded.";
    paint();
  }

  function onDelegatedClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement | null)?.closest?.("[data-terrain-action]") as HTMLElement | null;
    if (!el || !uiEl.contains(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = el.dataset.terrainAction || "";
    if (action === "preset") return preset(String(el.dataset.name || "comfort"));
    if (action === "reload") return reloadAtlas();
    if (action === "atlas") return window.open("/admin/atlas", "_blank");
    if (action === "character") return window.open("/character", "_blank");
  }

  function onDelegatedInput(ev: Event) {
    const input = (ev.target as HTMLElement | null)?.closest?.("[data-terrain-input]") as HTMLInputElement | null;
    if (!input || !uiEl.contains(input)) return;
    const kind = String(input.dataset.terrainInput || "");
    if (kind === "warmth") return apply({ warmth: Number(input.value) }, "Warmth saved.");
    if (kind === "texture") return apply({ texture: Number(input.value) }, "Texture detail saved.");
  }

  uiEl.addEventListener("click", onDelegatedClick, true);
  uiEl.addEventListener("input", onDelegatedInput, true);

  function Controls() {
    return <section>
      <p className="kicker">SolCraft admin</p>
      <h1>Terrain Lab</h1>
      <p>Adjust the procedural terrain before committing the feeling to the live game. The game Options modal uses the same saved visual profile.</p>

      <div className="card">
        <h2>Procedural feel</h2>
        <label>Warmth <b>{Math.round(st.prefs.warmth * 100)}%</b><input type="range" min="0" max="1" step="0.02" value={st.prefs.warmth} data-terrain-input="warmth" /></label>
        <label>Texture detail <b>{Math.round(st.prefs.texture * 100)}%</b><input type="range" min="0" max="1" step="0.02" value={st.prefs.texture} data-terrain-input="texture" /></label>
        <div className="buttons">
          <button className="primary" data-terrain-action="preset" data-name="comfort">Comfort</button>
          <button data-terrain-action="preset" data-name="calm">Lampy calm</button>
          <button data-terrain-action="preset" data-name="crisp">Crisp</button>
        </div>
      </div>

      <div className="card">
        <h2>Runtime</h2>
        <p className="tiny">Terrain can still switch between procedural and published atlas in Atlas Studio. This editor tunes the procedural fallback used while we iterate.</p>
        <div className="buttons">
          <button data-terrain-action="reload">Reload atlases</button>
          <button data-terrain-action="atlas">Atlas Studio</button>
          <button data-terrain-action="character">Character Lab</button>
        </div>
      </div>

      <div className="status">{st.status}</div>
    </section>;
  }

  function paint() { render(<Controls />, uiEl); }

  function loop(t: number) {
    tickVisualTextures(t * 0.001);
    for (const m of tileMeshes) {
      if (m.userData.kind === st.selected) m.position.y = 0.04 + Math.sin(t * 0.003) * 0.015;
      else m.position.y += (0 - m.position.y) * 0.08;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  buildGrid();
  resize();
  paint();
  requestAnimationFrame(loop);
}