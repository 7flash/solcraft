// @ts-nocheck
import * as THREE from "three";
import { makeWonderGroup } from "../../../client/wonderMeshes";

const rootId = "solcraft-ai-building-lab";
const KEY_STORE = "solcraft:adminKey";

let mounted = false;
let scene: any = null;
let camera: any = null;
let renderer: any = null;
let stageEl: HTMLElement | null = null;
let current: any = null;
let raf = 0;
let spin = true;
let resizeObserver: any = null;

const st: any = {
  prompt: "sky crystal lighthouse with golden arches",
  name: "",
  footprint: 9,
  mode: "district",
  paletteId: "solar",
  adminKey: "",
  provider: "checking",
  source: "none",
  status: "Booting AI Building Lab…",
  err: "",
  busy: false,
  recipe: null,
  raw: "",
  logs: [],
};

const CSS = String.raw`
.ailab{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(400px,.65fr);gap:12px;padding:12px;background:radial-gradient(circle at 16% 0%,rgba(20,241,149,.10),transparent 32rem),radial-gradient(circle at 84% 8%,rgba(153,69,255,.10),transparent 28rem),#05080e;color:#f3ead7;font-family:Outfit,Geist,system-ui,sans-serif}.ailab *{box-sizing:border-box}.scene,.panel{border:1px solid rgba(243,234,215,.15);border-radius:22px;background:linear-gradient(180deg,rgba(12,22,34,.96),rgba(5,10,18,.96));box-shadow:0 22px 60px rgba(0,0,0,.38)}.scene{position:relative;height:calc(100vh - 24px);min-height:640px;overflow:hidden}.stage{position:absolute;inset:0;width:100%;height:100%;min-height:420px}.stage canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}.panel{padding:14px;max-height:calc(100vh - 24px);overflow:auto}.kicker{margin:0 0 7px;color:#ffd76e;font:900 10px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase}h1,h2,h3{margin:0;color:#f3ead7;letter-spacing:-.04em}h1{font-size:clamp(34px,5vw,58px);line-height:.92}h2{font-size:24px}p{color:#b9af9d;line-height:1.45}.field{display:grid;gap:6px;margin:10px 0}.field label{font:900 11px/1 ui-monospace,monospace;color:#9bffd9;text-transform:uppercase;letter-spacing:.12em}.field input,.field textarea{width:100%;border:1px solid rgba(243,234,215,.16);border-radius:13px;background:rgba(255,255,255,.07);color:#f3ead7;padding:9px 10px;font:inherit;outline:none}.field textarea{min-height:112px;font-family:ui-monospace,Menlo,monospace;font-size:12px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.btn{border:1px solid rgba(243,234,215,.16);border-radius:999px;background:#111c2b;color:#f3ead7;padding:9px 13px;font-weight:900;cursor:pointer;text-decoration:none}.btn.primary{background:#14f195;color:#06120d;border-color:#14f195}.btn.warn{background:rgba(255,215,110,.13);border-color:rgba(255,215,110,.32);color:#ffe6aa}.btn:disabled{opacity:.48;cursor:not-allowed}.status{margin:10px 0;padding:9px 10px;border-radius:13px;border:1px solid rgba(20,241,149,.18);background:rgba(20,241,149,.08);font:800 12px/1.35 ui-monospace,monospace;color:#baffdf}.status.bad{border-color:rgba(255,122,102,.25);background:rgba(255,122,102,.10);color:#ffc9c0}.hero{position:absolute;z-index:4;left:16px;top:16px;max-width:560px;padding:13px 14px;border-radius:18px;border:1px solid rgba(255,255,255,.13);background:rgba(5,8,14,.70);backdrop-filter:blur(12px);pointer-events:none}.mono{white-space:pre-wrap;font:11px/1.35 ui-monospace,monospace;color:#fff0c8}.logbox{margin-top:10px;max-height:180px;overflow:auto;border-radius:14px;border:1px solid rgba(243,234,215,.13);background:rgba(0,0,0,.25);padding:10px}.pill{display:inline-flex;gap:4px;align-items:center;border-radius:999px;padding:4px 7px;background:rgba(20,241,149,.11);border:1px solid rgba(20,241,149,.24);color:#baffdf;font:900 10px/1 ui-monospace,monospace}.pill.bad{background:rgba(255,122,102,.12);border-color:rgba(255,122,102,.28);color:#ffc9c0}.empty-scene{position:absolute;z-index:3;left:50%;top:52%;translate:-50% -50%;text-align:center;max-width:400px;padding:14px;border:1px dashed rgba(243,234,215,.24);border-radius:18px;background:rgba(5,8,14,.62);pointer-events:none}.empty-scene b{display:block;color:#f3ead7}.empty-scene span{display:block;margin-top:6px;color:#b9af9d;font:800 12px/1.35 ui-monospace,monospace}.scene-error{position:absolute;left:16px;bottom:16px;right:16px;z-index:5;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,122,102,.25);background:rgba(255,122,102,.12);color:#ffc9c0;font:800 12px/1.35 ui-monospace,monospace}.split-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px}.metric{border:1px solid rgba(243,234,215,.12);border-radius:14px;background:rgba(255,255,255,.05);padding:8px}.metric b{display:block;color:#f3ead7}.metric span{color:#b9af9d;font:800 11px/1.35 ui-monospace,monospace}@media(max-width:1050px){.ailab{grid-template-columns:1fr}.scene{height:58vh;min-height:520px}.panel{max-height:none}.split-mini{grid-template-columns:1fr}}
`;


function isWorldWonderStudio() {
  try { return String(location.pathname || "").includes("/admin/wonders"); } catch { return false; }
}
function labTitle() { return isWorldWonderStudio() ? "World Wonders Studio" : "AI Building Lab"; }
function labKicker() { return isWorldWonderStudio() ? "SolCraft admin · World Wonders" : "SolCraft admin"; }
function labDescription() {
  return isWorldWonderStudio()
    ? "Generate one real AI World Wonder mesh recipe, inspect it, copy the JSON, then use the in-game World Wonder build card to spend coins and place it. No fallback meshes."
    : "Generate one real AI mesh recipe in isolation. This is a first-principles renderer: no fallback mesh, no silent fake success.";
}
function labKind() { return isWorldWonderStudio() ? "World Wonder" : "test building"; }
function promptPlaceholder() {
  return isWorldWonderStudio()
    ? "example: floating moon academy with brass telescope and blue crystals"
    : "example: cozy frontier house with teal roof and warm windows";
}

function addLog(message: string, payload?: any) {
  const stamp = new Date().toLocaleTimeString();
  const line = `[${stamp}] ${message}${payload === undefined ? "" : ` ${safeJson(payload)}`}`;
  st.logs.unshift(line);
  st.logs = st.logs.slice(0, 80);
  try { console.info(`[AI Building Lab] ${message}`, payload ?? ""); } catch {}
  sync();
}
function safeJson(v: any) { try { return JSON.stringify(v).slice(0, 1200); } catch { return String(v); } }
function saveKey() { try { localStorage.setItem(KEY_STORE, st.adminKey || ""); } catch {} }
function loadKey() { try { st.adminKey = localStorage.getItem(KEY_STORE) || ""; } catch {} }
function headers() { return { "Content-Type": "application/json", ...(st.adminKey ? { "x-solcraft-admin-key": st.adminKey } : {}) }; }
function root() { return document.getElementById(rootId); }
function q(sel: string) { return root()?.querySelector(sel) as any; }
function setText(sel: string, value: any) { const el = q(sel); if (el) el.textContent = String(value ?? ""); }
function setVal(sel: string, value: any) { const el = q(sel); if (el && document.activeElement !== el) el.value = String(value ?? ""); }
function setDisabled(sel: string, v: boolean) { const el = q(sel); if (el) el.disabled = !!v; }

function shell() {
  const r = root();
  if (!r) return;
  r.innerHTML = `
    <main class="ailab">
      <style>${CSS}</style>
      <section class="scene">
        <div class="stage" id="ai-building-stage"></div>
        <div class="hero">
          <p class="kicker">${labKicker()}</p>
          <h1>${labTitle()}</h1>
          <p>${labDescription()}</p>
          <div class="row">
            <span data-ref="provider-pill" class="pill">provider: checking</span>
            <span class="pill">source: <span data-ref="source">none</span></span>
            <span class="pill">parts: <span data-ref="parts">0</span></span>
          </div>
        </div>
        <div class="empty-scene" data-ref="empty">
          <b>No mesh rendered yet</b>
          <span>Generate, then this stage should show the exact JSON recipe. Rendering errors appear in the right-side log.</span>
        </div>
        <div class="scene-error" data-ref="scene-error" style="display:none"></div>
      </section>
      <aside class="panel">
        <p class="kicker">Prompt to real mesh recipe</p>
        <h2>${isWorldWonderStudio() ? "Real Wonder recipe" : "One-off test"}</h2>
        <p>This page calls the real server AI endpoint and logs every step. If the provider is missing, unauthorized, returns bad JSON, or the renderer fails, you see it here.</p>
        <div data-ref="status" class="status">Booting…</div>
        <div class="split-mini">
          <div class="metric"><b data-ref="provider">checking</b><span>provider</span></div>
          <div class="metric"><b data-ref="sourceMetric">none</b><span>source</span></div>
        </div>
        <div class="field"><label>Admin key</label><input data-k="adminKey" placeholder="Required only if ADMIN_KEY/SOLCRAFT_ADMIN_KEY is set" /></div>
        <div class="row"><button class="btn" data-action="status">Check AI status</button><button class="btn warn" data-action="forget-key">Forget key</button><button class="btn" data-action="reset-camera">Reset camera</button></div>
        <div class="field"><label>${isWorldWonderStudio() ? "World Wonder prompt" : "Building prompt"}</label><textarea data-k="prompt" placeholder="${promptPlaceholder()}"></textarea></div>
        <div class="field"><label>Map label / recipe name</label><input data-k="name" placeholder="Crystal Sun Archive" /></div>
        <div class="split-mini">
          <div class="field"><label>Footprint</label><select data-k="footprint"><option value="3">3x3 / 9 tiles</option><option value="5">5x5 / 25 tiles</option><option value="7">7x7 / 49 tiles</option><option value="9">9x9 / 81 tiles</option></select></div>
          <div class="field"><label>Mode</label><select data-k="mode"><option value="district">district / many meshes</option><option value="single">single big landmark</option></select></div>
        </div>
        <div class="field"><label>Color scheme</label><select data-k="paletteId"><option value="solar">Solar gold</option><option value="arcane">Arcane violet</option><option value="emerald">Emerald mint</option><option value="ember">Ember red</option><option value="frost">Frost blue</option><option value="royal">Royal prism</option></select></div>
        <div class="row"><button class="btn primary" data-action="generate">Generate with real AI</button><button class="btn" data-action="spin">Toggle spin</button><button class="btn" data-action="copy-json">Copy JSON</button></div>
        <div class="field"><label>Recipe JSON</label><textarea data-k="raw" placeholder="A real AI recipe will appear here." style="min-height:320px"></textarea></div>
        <div class="row"><button class="btn primary" data-action="rerender">Render edited JSON</button><a class="btn" href="/admin">Admin</a><a class="btn" href="/admin/wonders">Wonders</a><a class="btn" href="/admin/ai-building-lab">AI Lab</a><a class="btn" href="/admin/atlas">Atlas</a></div>
        <div class="logbox"><pre class="mono" data-ref="logs">No logs yet.</pre></div>
        <p class="mono">Server env required:\nOPENAI_API_KEY=sk-...\nSOLCRAFT_WONDER_OPENAI_MODEL=gpt-4.1-mini\n\nAlternative custom provider:\nSOLCRAFT_WONDER_AI_URL=https://...\nSOLCRAFT_WONDER_AI_KEY=optional</p>
      </aside>
    </main>`;
}

function sync() {
  const status = q('[data-ref="status"]');
  if (status) {
    status.textContent = st.status || "";
    status.className = `status${st.err ? " bad" : ""}`;
  }
  const providerPill = q('[data-ref="provider-pill"]');
  if (providerPill) {
    const bad = st.provider === "none" || st.provider === "blocked" || !!st.err;
    providerPill.className = bad ? "pill bad" : "pill";
    providerPill.textContent = `provider: ${st.provider || "none"}`;
  }
  setText('[data-ref="provider"]', st.provider || "none");
  setText('[data-ref="source"]', st.source || "none");
  setText('[data-ref="sourceMetric"]', st.source || "none");
  setText('[data-ref="parts"]', Array.isArray(st.recipe?.parts) ? st.recipe.parts.length : 0);
  setVal('[data-k="adminKey"]', st.adminKey || "");
  setVal('[data-k="prompt"]', st.prompt || "");
  setVal('[data-k="raw"]', st.raw || "");
  setVal('[data-k="name"]', st.name || "");
  setVal('[data-k="footprint"]', st.footprint || 9);
  setVal('[data-k="mode"]', st.mode || "district");
  setVal('[data-k="paletteId"]', st.paletteId || "solar");
  setDisabled('[data-action="generate"]', !!st.busy);
  setDisabled('[data-action="rerender"]', !!st.busy || !String(st.raw || "").trim());
  setText('[data-action="generate"]', st.busy ? "Generating…" : "Generate with real AI");
  const empty = q('[data-ref="empty"]');
  if (empty) empty.style.display = st.recipe ? "none" : "block";
  const sceneErr = q('[data-ref="scene-error"]');
  if (sceneErr) {
    sceneErr.style.display = st.err ? "block" : "none";
    sceneErr.textContent = st.err || "";
  }
  setText('[data-ref="logs"]', st.logs.join("\n") || "No logs yet.");
}

function setupScene() {
  stageEl = document.getElementById("ai-building-stage");
  if (!stageEl) throw new Error("Renderer stage #ai-building-stage was not found.");
  stageEl.innerHTML = "";
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101a);
  camera = new THREE.OrthographicCamera(-5, 5, 4, -3.2, 0.1, 300);
  resetCamera();
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.domElement.setAttribute("data-ai-lab-canvas", "1");
  stageEl.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b2a16, 1.18));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
  sun.position.set(5, 8, 4);
  sun.castShadow = true;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7dcfe8, 0.35);
  fill.position.set(-5, 4, -5);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x152217, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(10, 10, 0x14f195, 0x2a3b34);
  grid.position.y = 0.008;
  scene.add(grid);
  const axes = new THREE.AxesHelper(1.25);
  axes.position.set(-3.8, 0.05, -3.8);
  scene.add(axes);

  if (resizeObserver) resizeObserver.disconnect();
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stageEl);
  window.addEventListener("resize", resize, { passive: true });
  resize();
  loop(0);
  addLog("Three.js renderer mounted", { width: stageEl.clientWidth, height: stageEl.clientHeight });
}

function resetCamera() {
  if (!camera) return;
  camera.position.set(6, 5.7, 7);
  camera.lookAt(0, 1.35, 0);
  camera.updateProjectionMatrix?.();
}

function resize() {
  if (!renderer || !stageEl || !camera) return;
  const rect = stageEl.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width || stageEl.clientWidth || 900));
  const h = Math.max(320, Math.floor(rect.height || stageEl.clientHeight || 620));
  renderer.setSize(w, h, false);
  const aspect = w / Math.max(1, h);
  const view = 4.4;
  camera.left = -view * aspect;
  camera.right = view * aspect;
  camera.top = view;
  camera.bottom = -view * 0.72;
  camera.updateProjectionMatrix();
}

function loop(t: number) {
  if (!renderer || !scene || !camera) return;
  if (current && spin) current.rotation.y = t * 0.00028;
  renderer.render(scene, camera);
  raf = requestAnimationFrame(loop);
}

function normalizeRecipe(recipe: any) {
  if (!recipe || typeof recipe !== "object") throw new Error("Recipe is not an object.");
  if (!Array.isArray(recipe.parts) || !recipe.parts.length) throw new Error("Recipe has no parts array.");
  recipe.parts = recipe.parts.map((p: any) => ({
    ...p,
    primitive: String(p?.primitive || "box"),
    pos: Array.isArray(p?.pos) ? p.pos : Array.isArray(p?.position) ? p.position : [0, 0.5, 0],
    scale: Array.isArray(p?.scale) ? p.scale : [1, 1, 1],
    rot: Array.isArray(p?.rot) ? p.rot : Array.isArray(p?.rotation) ? p.rotation : [0, 0, 0],
    color: p?.color || "#fff0a8",
    emissive: p?.emissive || "#000000",
    metalness: Number.isFinite(Number(p?.metalness)) ? Number(p.metalness) : 0.05,
    roughness: Number.isFinite(Number(p?.roughness)) ? Number(p.roughness) : 0.82,
  }));
  return recipe;
}

function renderRecipe(recipe: any) {
  if (!scene) throw new Error("Three.js scene is not ready yet.");
  const normalized = normalizeRecipe(typeof structuredClone === "function" ? structuredClone(recipe) : JSON.parse(JSON.stringify(recipe)));
  if (current) {
    scene.remove(current);
    current.traverse?.((o: any) => { try { o.geometry?.dispose?.(); o.material?.dispose?.(); } catch {} });
  }
  current = makeWonderGroup(normalized);
  current.position.set(0, 0.02, 0);
  scene.add(current);
  st.recipe = normalized;
  st.raw = JSON.stringify(normalized, null, 2);
  st.err = "";
  resize();
  addLog("Rendered recipe in Three.js", { name: normalized.name, parts: normalized.parts.length, aura: normalized.aura });
}

async function loadStatus() {
  saveKey();
  st.status = "Checking real AI provider…";
  st.err = "";
  sync();
  addLog("GET /api/admin/wonder/lab");
  try {
    const res = await fetch("/api/admin/wonder/lab", { method: "GET", headers: headers(), cache: "no-store" });
    const text = await res.text();
    addLog(`Status response ${res.status}`, text.slice(0, 700));
    const data = text ? JSON.parse(text) : {};
    if (!res.ok || data?.ok === false) throw new Error(data?.msg || res.statusText || "AI status failed");
    st.provider = data.ai?.provider || "none";
    st.status = data.msg || (data.ai?.configured ? "Real AI provider ready." : "Real AI is not configured.");
    st.err = data.ai?.configured ? "" : st.status;
  } catch (e: any) {
    st.provider = "blocked";
    st.err = String(e?.message || e);
    st.status = st.err;
    addLog("Status failed", st.err);
  }
  sync();
}

async function generate() {
  saveKey();
  const prompt = String(st.prompt || "").trim();
  if (!prompt) {
    st.err = "Type a building prompt first.";
    st.status = st.err;
    sync();
    return;
  }
  st.busy = true;
  st.status = "Calling real AI provider…";
  st.err = "";
  sync();
  addLog("POST /api/admin/wonder/lab", { prompt, name: st.name, footprint: st.footprint, mode: st.mode, paletteId: st.paletteId });
  try {
    const started = Date.now();
    const res = await fetch("/api/admin/wonder/lab", {
      method: "POST",
      headers: headers(),
      cache: "no-store",
      body: JSON.stringify({ prompt, kind: labKind(), adminKey: st.adminKey, name: st.name, footprint: Number(st.footprint || 9), mode: st.mode || "district", paletteId: st.paletteId || "solar" }),
    });
    const text = await res.text();
    addLog(`Generate response ${res.status} in ${Date.now() - started}ms`, text.slice(0, 1000));
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch (e: any) { throw new Error(`Server returned non-JSON response: ${String(e?.message || e)}\n${text.slice(0, 800)}`); }
    if (!res.ok || data?.ok === false) throw new Error(data?.msg || res.statusText || "Real AI failed");
    if (!data.recipe) throw new Error("Server said ok but did not return data.recipe.");
    st.source = data.source || "real-ai";
    st.provider = data.source || st.provider || "real-ai";
    renderRecipe(data.recipe);
    st.status = `Rendered ${st.recipe?.name || "AI building"} from ${st.source}.`;
  } catch (e: any) {
    st.err = String(e?.message || e);
    st.status = st.err;
    addLog("Generate/render failed", st.err);
  }
  st.busy = false;
  sync();
}

function rerenderJson() {
  try {
    const parsed = JSON.parse(st.raw || "{}");
    renderRecipe(parsed);
    st.status = "Rendered edited recipe JSON.";
    st.err = "";
  } catch (e: any) {
    st.err = String(e?.message || e);
    st.status = st.err;
    addLog("Render edited JSON failed", st.err);
  }
  sync();
}

function onInput(ev: any) {
  const el = ev.target?.closest?.("[data-k]");
  if (!el) return;
  st[el.dataset.k] = el.value;
  if (el.dataset.k === "adminKey") saveKey();
  sync();
}
function onKey(ev: any) {
  if (ev.key === "Enter" && ev.target?.closest?.('[data-k="adminKey"]')) loadStatus();
}
async function onClick(ev: any) {
  const el = ev.target?.closest?.("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "generate") generate();
  else if (a === "rerender") rerenderJson();
  else if (a === "spin") { spin = !spin; addLog(`Spin ${spin ? "on" : "off"}`); }
  else if (a === "status") loadStatus();
  else if (a === "forget-key") { st.adminKey = ""; saveKey(); addLog("Forgot admin key"); loadStatus(); }
  else if (a === "reset-camera") { resetCamera(); resize(); addLog("Camera reset"); }
  else if (a === "copy-json") {
    try { await navigator.clipboard.writeText(st.raw || ""); addLog("Copied recipe JSON"); }
    catch (e: any) { addLog("Copy failed", String(e?.message || e)); }
  }
}

export default function mount() {
  const r = root();
  if (!r) return;
  if ((r as any).dataset?.aiLabMounted === "1") return;
  mounted = true;
  try { (r as any).dataset.aiLabMounted = "1"; } catch {}
  loadKey();
  shell();
  r.addEventListener("input", onInput, true);
  r.addEventListener("keydown", onKey, true);
  r.addEventListener("click", onClick, true);
  sync();
  try { setupScene(); }
  catch (e: any) { st.err = String(e?.message || e); st.status = st.err; addLog("Renderer setup failed", st.err); }
  loadStatus();
}
