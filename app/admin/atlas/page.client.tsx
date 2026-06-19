// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";

type Rect = { x: number; y: number; w: number; h: number };
type AtlasDef = { id: string; label: string; cols: number; rows: number; slots: string[]; cell: number };
type Fit = "cover" | "contain" | "stretch";
type Placement = {
  sourceUrl: string;
  sourceName: string;
  rect: Rect;
  fit: Fit;
  pad: number;
};

type SelectionGrid = {
  slots: number[];
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
  cols: number;
  rows: number;
};

const rootId = "solcraft-atlas-forge";
const KEY_STORE = "solcraft:adminKey";
const CELL = 128;

const ATLASES: AtlasDef[] = [
  { id: "terrain", label: "Terrain", cols: 4, rows: 4, cell: CELL, slots: ["grass", "forest", "dirt", "path", "sand", "cobble", "rocky", "soil", "farm", "water", "moss", "deck", "claimed", "mint", "purple", "plain"] },
  { id: "building", label: "Building", cols: 4, rows: 4, cell: CELL, slots: ["wood", "darkwood", "stone", "marble", "cobble", "plaster", "roof", "slate", "thatch", "cloth", "purplecloth", "canvas", "metal", "rune", "banner", "carved"] },
  { id: "fx", label: "FX", cols: 4, rows: 4, cell: CELL, slots: ["smallShadow", "bigShadow", "sparkle", "coin", "dust", "smoke", "woodchips", "stonechips", "harvest", "warn", "twinkle", "rune", "bank", "market", "lootbag", "impact"] },
  { id: "ui", label: "UI", cols: 4, rows: 4, cell: CELL, slots: ["wood", "stone", "wheat", "fish", "gold", "gem", "energy", "heart", "shield", "sword", "backpack", "hammer", "food", "cottage", "market", "bank"] },
  { id: "doll", label: "Doll", cols: 8, rows: 6, cell: CELL, slots: ["skin0", "skin1", "skin2", "skin3", "skin4", "skin5", "skin6", "skin7", "hair0", "hair1", "hair2", "hair3", "hair4", "hair5", "hair6", "hair7", "hat0", "hat1", "hat2", "hat3", "hat4", "hat5", "hat6", "hat7", "torso0", "torso1", "torso2", "torso3", "torso4", "torso5", "torso6", "torso7", "legs0", "legs1", "legs2", "legs3", "legs4", "legs5", "legs6", "legs7", "back0", "back1", "back2", "back3", "back4", "back5", "back6", "back7"] },
];

let mounted = false;
let sourceDrawSeq = 0;
let sheetDrawSeq = 0;
const imageCache = new Map<string, Promise<HTMLImageElement>>();

const st: any = {
  adminKey: "",
  busy: false,
  status: "Sprite Sheet Forge ready.",
  err: "",
  publishedByAtlas: {},
  debug: null,

  sourceUrl: "",
  sourceName: "",
  sourceW: 0,
  sourceH: 0,
  sourceView: null,
  sheetView: null,
  cut: { x: 0, y: 0, cellW: CELL, cellH: CELL },
  dragCut: null,

  atlasId: "terrain",
  selectedSlots: [0],
  anchorSlot: 0,
  replacementsByAtlas: {},
  fit: "contain" as Fit,
  pad: 0,
  publishAfterUpload: true,
};

function root() { return document.getElementById(rootId); }
function atlas(id = st.atlasId) { return ATLASES.find((a) => a.id === id) || ATLASES[0]; }
function sheetW(a = atlas()) { return a.cols * a.cell; }
function sheetH(a = atlas()) { return a.rows * a.cell; }
function round(n: any) { return Math.round(Number(n) || 0); }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, Number(n) || 0)); }
function safeJson(v: any) { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
function slotCol(i: number, a = atlas()) { return i % a.cols; }
function slotRow(i: number, a = atlas()) { return Math.floor(i / a.cols); }
function authHeaders(json = false) { return { ...(json ? { "Content-Type": "application/json" } : {}), ...(st.adminKey ? { "x-solcraft-admin-key": st.adminKey } : {}) }; }
function saveKey() { try { localStorage.setItem(KEY_STORE, st.adminKey || ""); } catch {} }
function loadKey() { try { st.adminKey = localStorage.getItem(KEY_STORE) || ""; } catch {} }
function setStatus(msg: string, bad = false) { st.status = msg; st.err = bad ? msg : ""; paint("status"); }

function measureFn<T>(name: string, fn: () => T, warnMs = 18): T {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  try { return fn(); }
  finally {
    const dt = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    if (dt > warnMs) try { console.info(`[atlas] ${name} ${dt.toFixed(1)}ms`); } catch {}
  }
}
async function measureFnAsync<T>(name: string, fn: () => Promise<T>, warnMs = 40): Promise<T> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  try { return await fn(); }
  finally {
    const dt = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    if (dt > warnMs) try { console.info(`[atlas] ${name} ${dt.toFixed(1)}ms`); } catch {}
  }
}

function selectedSlots(): number[] {
  const a = atlas();
  const clean = Array.from(new Set((st.selectedSlots || []).map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x) && x >= 0 && x < a.slots.length))).sort((a, b) => a - b);
  if (clean.length) return clean;
  st.selectedSlots = [0];
  st.anchorSlot = 0;
  return [0];
}
function selectionGrid(a = atlas()): SelectionGrid {
  const slots = selectedSlots();
  const cols = slots.map((i) => slotCol(i, a));
  const rows = slots.map((i) => slotRow(i, a));
  const minCol = Math.min(...cols), maxCol = Math.max(...cols), minRow = Math.min(...rows), maxRow = Math.max(...rows);
  return { slots, minCol, maxCol, minRow, maxRow, cols: maxCol - minCol + 1, rows: maxRow - minRow + 1 };
}
function cutW() { return selectionGrid().cols * Math.max(1, round(st.cut.cellW)); }
function cutH() { return selectionGrid().rows * Math.max(1, round(st.cut.cellH)); }
function replacements(atlasId = st.atlasId): Record<string, Placement> {
  if (!st.replacementsByAtlas[atlasId]) st.replacementsByAtlas[atlasId] = {};
  return st.replacementsByAtlas[atlasId];
}
function dirtyAtlasIds() { return ATLASES.map((a) => a.id).filter((id) => Object.keys(replacements(id)).length > 0); }
function runtimeUrlForAtlas(id: string) {
  const pub = st.publishedByAtlas?.[id];
  return pub?.url || `/api/atlas-runtime/${encodeURIComponent(id)}?v=${encodeURIComponent(pub?.createdAt || Date.now())}`;
}

function loadImage(src: string) {
  if (!src) return Promise.reject(new Error("no image source"));
  if (!imageCache.has(src)) {
    imageCache.set(src, new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not load image: ${src}`));
      img.src = src;
    }));
  }
  return imageCache.get(src)!;
}
async function readJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let j: any = {};
  try { j = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 700)}`); }
  st.debug = { url, status: r.status, response: j };
  if (!r.ok || j?.ok === false) throw new Error(String(j?.msg || j?.error || r.statusText || "request failed"));
  return j;
}

async function load() {
  saveKey();
  st.busy = true; st.err = ""; st.status = "Loading atlas runtime…"; paint("load-start");
  try {
    const j = await readJson("/api/admin/atlas", { cache: "no-store", headers: authHeaders() });
    st.publishedByAtlas = j.publishedByAtlas || {};
    st.status = "Loaded sprite sheets. Select cells in the preview or target grid, move the source sample area, then apply.";
  } catch (e: any) {
    st.err = String(e?.message || e); st.status = st.err;
  }
  st.busy = false; paint("load-done");
}

function clampCut() {
  if (!st.sourceW || !st.sourceH) return;
  const w = cutW(), h = cutH();
  st.cut.cellW = Math.max(1, round(st.cut.cellW || CELL));
  st.cut.cellH = Math.max(1, round(st.cut.cellH || CELL));
  st.cut.x = clamp(round(st.cut.x), 0, Math.max(0, st.sourceW - w));
  st.cut.y = clamp(round(st.cut.y), 0, Math.max(0, st.sourceH - h));
}
function setCut(k: string, val: any) {
  st.cut[k] = round(val);
  clampCut();
  paint(`cut-${k}`);
}
function fitCutToSource() {
  if (!st.sourceUrl) return setStatus("Upload a source image first.", true);
  const g = selectionGrid();
  st.cut.x = 0;
  st.cut.y = 0;
  st.cut.cellW = Math.max(1, Math.floor(st.sourceW / Math.max(1, g.cols)));
  st.cut.cellH = Math.max(1, Math.floor(st.sourceH / Math.max(1, g.rows)));
  clampCut();
  setStatus(`Sample grid fitted to source image as ${g.cols}×${g.rows}.`);
}
function resetCutCellSize() {
  st.cut.cellW = CELL;
  st.cut.cellH = CELL;
  clampCut();
  setStatus("Source crop reset to 128×128 per selected target cell.");
}
function adjustCutSize(dw = 0, dh = 0) {
  if (!st.sourceUrl) return setStatus("Upload a source image first.", true);
  const beforeW = cutW();
  const beforeH = cutH();
  st.cut.cellW = Math.max(1, round(st.cut.cellW + dw));
  st.cut.cellH = Math.max(1, round(st.cut.cellH + dh));
  const afterW = cutW();
  const afterH = cutH();
  st.cut.x = round(st.cut.x - (afterW - beforeW) / 2);
  st.cut.y = round(st.cut.y - (afterH - beforeH) / 2);
  clampCut();
  setStatus(`Source crop is now ${round(st.cut.cellW)}×${round(st.cut.cellH)} per target cell.`);
}

async function onSourceUpload(file: File | null) {
  if (!file) return;
  try { if (st.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(st.sourceUrl); } catch {}
  const url = URL.createObjectURL(file);
  st.sourceUrl = url; st.sourceName = file.name; st.err = ""; st.status = `Loaded source image: ${file.name}`;
  try {
    const img = await loadImage(url);
    st.sourceW = img.naturalWidth || img.width || 0;
    st.sourceH = img.naturalHeight || img.height || 0;
    st.cut.x = 0; st.cut.y = 0;
    st.cut.cellW = Math.min(CELL, Math.max(1, st.sourceW));
    st.cut.cellH = Math.min(CELL, Math.max(1, st.sourceH));
    clampCut();
  } catch (e: any) { st.err = String(e?.message || e); st.status = st.err; }
  paint("source-upload");
}

function sourceCanvasPoint(ev: any) {
  const cv = ev.currentTarget as HTMLCanvasElement;
  const rect = cv.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (cv.width / Math.max(1, rect.width));
  const py = (ev.clientY - rect.top) * (cv.height / Math.max(1, rect.height));
  const v = st.sourceView;
  if (!v) return null;
  return { x: clamp((px - v.x) / v.scale, 0, st.sourceW), y: clamp((py - v.y) / v.scale, 0, st.sourceH) };
}
function pointInsideCut(p: any) {
  return p && p.x >= st.cut.x && p.y >= st.cut.y && p.x <= st.cut.x + cutW() && p.y <= st.cut.y + cutH();
}
function sourceDown(ev: any) {
  const p = sourceCanvasPoint(ev);
  if (!p || !st.sourceUrl) return;
  if (pointInsideCut(p)) st.dragCut = { dx: p.x - st.cut.x, dy: p.y - st.cut.y };
  else {
    st.cut.x = round(p.x - cutW() / 2);
    st.cut.y = round(p.y - cutH() / 2);
    clampCut();
    st.dragCut = { dx: cutW() / 2, dy: cutH() / 2 };
  }
  paint("source-down");
}
function sourceMove(ev: any) {
  if (!st.dragCut) return;
  const p = sourceCanvasPoint(ev);
  if (!p) return;
  st.cut.x = round(p.x - st.dragCut.dx);
  st.cut.y = round(p.y - st.dragCut.dy);
  clampCut();
  paint("source-drag");
}
function sourceUp() { st.dragCut = null; paint("source-up"); }

function selectAtlas(id: string) {
  const a = atlas(id);
  st.atlasId = a.id;
  st.anchorSlot = 0;
  st.selectedSlots = [0];
  clampCut();
  paint("atlas-select");
}
function selectOnlySlot(i: number) { st.anchorSlot = i; st.selectedSlots = [i]; clampCut(); paint("slot-single"); }
function selectRectTo(i: number) {
  const a = atlas();
  const a0 = Number.isFinite(Number(st.anchorSlot)) ? Number(st.anchorSlot) : i;
  const c0 = Math.min(slotCol(a0, a), slotCol(i, a)), c1 = Math.max(slotCol(a0, a), slotCol(i, a));
  const r0 = Math.min(slotRow(a0, a), slotRow(i, a)), r1 = Math.max(slotRow(a0, a), slotRow(i, a));
  const out: number[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push(r * a.cols + c);
  st.selectedSlots = out;
  clampCut();
  paint("slot-rect");
}
function toggleSlot(i: number) {
  const s = new Set(selectedSlots());
  if (s.has(i) && s.size > 1) s.delete(i); else s.add(i);
  st.anchorSlot = i;
  st.selectedSlots = Array.from(s).sort((a: number, b: number) => a - b);
  clampCut();
  paint("slot-toggle");
}
function onSlotClick(ev: any, i: number) {
  if (ev?.shiftKey) return selectRectTo(i);
  if (ev?.ctrlKey || ev?.metaKey) return toggleSlot(i);
  return selectOnlySlot(i);
}
function clearTargetSelection() { st.anchorSlot = selectedSlots()[0] || 0; st.selectedSlots = [st.anchorSlot]; clampCut(); paint("selection-clear"); }

function nudgeSourceSample(dx: number, dy: number, label = "source sample") {
  if (!st.sourceUrl) return setStatus("Upload a source image first.", true);
  st.cut.x = round(st.cut.x + dx);
  st.cut.y = round(st.cut.y + dy);
  clampCut();
  setStatus(`Moved ${label} to x${round(st.cut.x)} y${round(st.cut.y)}.`);
}
function moveTargetSelection(dc: number, dr: number, opts: any = {}) {
  const a = atlas();
  const slots = selectedSlots();
  const cols = slots.map((i) => slotCol(i, a));
  const rows = slots.map((i) => slotRow(i, a));
  if (Math.min(...cols) + dc < 0 || Math.max(...cols) + dc >= a.cols || Math.min(...rows) + dr < 0 || Math.max(...rows) + dr >= a.rows) {
    setStatus("Target selection is at the sheet edge.", true);
    return false;
  }
  const delta = dc + dr * a.cols;
  st.selectedSlots = slots.map((i) => i + delta).sort((x: number, y: number) => x - y);
  st.anchorSlot = clamp(round(st.anchorSlot + delta), 0, a.slots.length - 1);
  clampCut();
  if (!opts.silent) setStatus(`Moved target selection to ${st.selectedSlots.length} synced slot${st.selectedSlots.length === 1 ? "" : "s"}.`);
  return true;
}
function jumpTargetAndSource(dc: number, dr: number) {
  const moved = moveTargetSelection(dc, dr, { silent: true });
  if (!moved) return;
  if (st.sourceUrl) {
    st.cut.x = round(st.cut.x + dc * Math.max(1, round(st.cut.cellW)));
    st.cut.y = round(st.cut.y + dr * Math.max(1, round(st.cut.cellH)));
    clampCut();
  }
  setStatus(`Moved target selection and source sample by one cell.`);
}
function arrowDelta(key: string) {
  if (key === "ArrowLeft") return { x: -1, y: 0 };
  if (key === "ArrowRight") return { x: 1, y: 0 };
  if (key === "ArrowUp") return { x: 0, y: -1 };
  if (key === "ArrowDown") return { x: 0, y: 1 };
  return null;
}

function selectedSlotSet() { return new Set(selectedSlots()); }
function createPlacementForSlot(slot: number): Placement {
  const g = selectionGrid();
  const relCol = slotCol(slot) - g.minCol;
  const relRow = slotRow(slot) - g.minRow;
  return {
    sourceUrl: st.sourceUrl,
    sourceName: st.sourceName,
    rect: {
      x: round(st.cut.x + relCol * st.cut.cellW),
      y: round(st.cut.y + relRow * st.cut.cellH),
      w: Math.max(1, round(st.cut.cellW)),
      h: Math.max(1, round(st.cut.cellH)),
    },
    fit: st.fit || "contain",
    pad: Math.max(0, round(st.pad)),
  };
}
function applySourceArea() {
  if (!st.sourceUrl) return setStatus("Upload a source image first.", true);
  const slots = selectedSlots();
  if (!slots.length) return setStatus("Select at least one target slot.", true);
  clampCut();
  const map = replacements(st.atlasId);
  for (const slot of slots) map[String(slot)] = createPlacementForSlot(slot);
  const g = selectionGrid();
  setStatus(`Queued ${slots.length} ${atlas().label} replacement${slots.length === 1 ? "" : "s"} from ${g.cols}×${g.rows} source area.`);
}
function clearSelectedCells() {
  const map = replacements(st.atlasId);
  for (const slot of selectedSlots()) delete map[String(slot)];
  setStatus(`Cleared selected queued cell${selectedSlots().length === 1 ? "" : "s"}.`);
}
function clearSheetQueue() { st.replacementsByAtlas[st.atlasId] = {}; setStatus(`Cleared queued replacements for ${atlas().label}.`); }
function setFit(v: any) { st.fit = String(v || "contain"); paint("fit"); }
function setPad(v: any) { st.pad = Math.max(0, round(v)); paint("pad"); }

function drawPlacement(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: Placement, dx: number, dy: number, size: number) {
  const pad = Math.max(0, Number(p.pad) || 0);
  const aw = Math.max(1, size - pad * 2), ah = Math.max(1, size - pad * 2);
  const srcW = Math.max(1, p.rect.w), srcH = Math.max(1, p.rect.h);
  let dw = aw, dh = ah;
  if (p.fit !== "stretch") {
    const base = p.fit === "contain" ? Math.min(aw / srcW, ah / srcH) : Math.max(aw / srcW, ah / srcH);
    dw = srcW * base; dh = srcH * base;
  }
  const x = dx + pad + (aw - dw) / 2;
  const y = dy + pad + (ah - dh) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(dx, dy, size, size); ctx.clip();
  ctx.clearRect(dx, dy, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, p.rect.x, p.rect.y, p.rect.w, p.rect.h, x, y, dw, dh);
  ctx.restore();
}
async function composeSheetCanvas(a = atlas()) {
  return measureFnAsync(`compose:${a.id}`, async () => {
    const cv = document.createElement("canvas");
    cv.width = sheetW(a); cv.height = sheetH(a);
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    try { const base = await loadImage(runtimeUrlForAtlas(a.id)); ctx.drawImage(base, 0, 0, cv.width, cv.height); }
    catch { ctx.fillStyle = "rgba(16,32,24,.85)"; ctx.fillRect(0, 0, cv.width, cv.height); }
    const map = replacements(a.id);
    for (const key of Object.keys(map)) {
      const idx = Number(key);
      if (!Number.isFinite(idx) || idx < 0 || idx >= a.slots.length) continue;
      const img = await loadImage(map[key].sourceUrl);
      drawPlacement(ctx, img, map[key], (idx % a.cols) * a.cell, Math.floor(idx / a.cols) * a.cell, a.cell);
    }
    return cv;
  }, 80);
}

async function uploadComposed(atlasId = st.atlasId, publish = !!st.publishAfterUpload) {
  const a = atlas(atlasId);
  if (!Object.keys(replacements(a.id)).length) return setStatus(`No queued replacements for ${a.label}.`, true);
  st.busy = true; st.err = ""; st.status = `Composing ${a.label} sprite sheet…`; paint("upload-start");
  try {
    const cv = await composeSheetCanvas(a);
    const blob: Blob = await measureFnAsync(`png:${a.id}`, () => new Promise((res, rej) => cv.toBlob((b) => b ? res(b) : rej(new Error("could not create png")), "image/png")), 80);
    const file = new File([blob], `${a.id}_spritesheet_${Date.now()}.png`, { type: "image/png" });
    const form = new FormData();
    form.set("action", "upload"); form.set("atlas", a.id); form.set("file", file);
    const j = await readJson("/api/admin/atlas", { method: "POST", headers: authHeaders(false), body: form });
    if (publish && j.version?.id) {
      const p = await readJson("/api/admin/atlas", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ action: "publish", atlas: a.id, versionId: j.version.id, bounds: { x0: 0, y0: 0, x1: cv.width, y1: cv.height }, pad: 0 }) });
      st.publishedByAtlas = p.publishedByAtlas || st.publishedByAtlas;
    }
    st.replacementsByAtlas[a.id] = {};
    st.status = `${publish ? "Published" : "Uploaded"} ${a.label} sprite sheet (${cv.width}×${cv.height}).`;
  } catch (e: any) { st.err = String(e?.message || e); st.status = st.err; }
  st.busy = false; paint("upload-done");
}
async function uploadAllDirty() {
  const ids = dirtyAtlasIds();
  if (!ids.length) return setStatus("No queued replacements yet.", true);
  for (const id of ids) await uploadComposed(id, !!st.publishAfterUpload);
  setStatus(`Finished ${ids.length} sprite sheet${ids.length === 1 ? "" : "s"}.`);
}

async function drawSourceCanvas() {
  return measureFnAsync("draw-source", async () => {
    const seq = ++sourceDrawSeq;
    const cv = root()?.querySelector("#source-canvas") as HTMLCanvasElement | null;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const cssW = Math.max(360, cv.parentElement?.clientWidth || 720);
    cv.width = cssW;
    cv.height = clamp(Math.round(cssW * 0.42), 300, 460);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#07101a"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!st.sourceUrl) {
      ctx.fillStyle = "#b9af9d"; ctx.font = "14px ui-monospace,monospace";
      ctx.fillText("Upload a source image. The selected target grid appears here as a movable sample area.", 22, 38);
      st.sourceView = null; return;
    }
    try {
      const img = await loadImage(st.sourceUrl);
      if (seq !== sourceDrawSeq) return;
      st.sourceW = img.naturalWidth || img.width || st.sourceW;
      st.sourceH = img.naturalHeight || img.height || st.sourceH;
      clampCut();
      const fit = Math.min(cv.width / Math.max(1, st.sourceW), cv.height / Math.max(1, st.sourceH)) * 0.94;
      const w = st.sourceW * fit, h = st.sourceH * fit, x = (cv.width - w) / 2, y = (cv.height - h) / 2;
      st.sourceView = { x, y, w, h, scale: fit };
      ctx.imageSmoothingEnabled = true; ctx.drawImage(img, x, y, w, h);
      ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
      const g = selectionGrid();
      const rx = x + st.cut.x * fit, ry = y + st.cut.y * fit, rw = cutW() * fit, rh = cutH() * fit;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.44)";
      ctx.fillRect(x, y, w, Math.max(0, ry - y));
      ctx.fillRect(x, ry + rh, w, Math.max(0, y + h - ry - rh));
      ctx.fillRect(x, ry, Math.max(0, rx - x), rh);
      ctx.fillRect(rx + rw, ry, Math.max(0, x + w - rx - rw), rh);
      ctx.restore();
      ctx.fillStyle = "rgba(20,241,149,.08)"; ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "#14f195"; ctx.lineWidth = 3; ctx.strokeRect(rx, ry, rw, rh);
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(20,241,149,.68)";
      for (let c = 1; c < g.cols; c++) { ctx.beginPath(); ctx.moveTo(rx + (rw * c) / g.cols, ry); ctx.lineTo(rx + (rw * c) / g.cols, ry + rh); ctx.stroke(); }
      for (let r = 1; r < g.rows; r++) { ctx.beginPath(); ctx.moveTo(rx, ry + (rh * r) / g.rows); ctx.lineTo(rx + rw, ry + (rh * r) / g.rows); ctx.stroke(); }
      ctx.fillStyle = "#fff0c8"; ctx.font = "11px ui-monospace,monospace";
      ctx.fillText(`sample ${g.cols}×${g.rows} · x${round(st.cut.x)} y${round(st.cut.y)} · ${cutW()}×${cutH()}`, rx + 6, Math.max(14, ry + 16));
    } catch (e: any) { ctx.fillStyle = "#ff9a88"; ctx.font = "13px ui-monospace,monospace"; ctx.fillText(String(e?.message || e), 22, 38); }
  }, 60);
}

function previewSlotFromEvent(ev: any) {
  const cv = ev.currentTarget as HTMLCanvasElement;
  const rect = cv.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (cv.width / Math.max(1, rect.width));
  const py = (ev.clientY - rect.top) * (cv.height / Math.max(1, rect.height));
  const v = st.sheetView;
  if (!v) return null;
  if (px < v.x || py < v.y || px > v.x + v.w || py > v.y + v.h) return null;
  const col = clamp(Math.floor((px - v.x) / Math.max(1, v.cw)), 0, v.cols - 1);
  const row = clamp(Math.floor((py - v.y) / Math.max(1, v.ch)), 0, v.rows - 1);
  const idx = row * v.cols + col;
  return Number.isFinite(idx) && idx >= 0 && idx < atlas().slots.length ? idx : null;
}
function onPreviewClick(ev: any) {
  const idx = previewSlotFromEvent(ev);
  if (idx === null || idx === undefined) return;
  onSlotClick(ev, idx);
}

async function drawSheetCanvas() {
  return measureFnAsync("draw-sheet", async () => {
    const seq = ++sheetDrawSeq;
    const cv = root()?.querySelector("#sheet-canvas") as HTMLCanvasElement | null;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const a = atlas();
    const cssW = Math.max(360, cv.parentElement?.clientWidth || 720);
    cv.width = cssW;
    cv.height = clamp(Math.round(cssW * 0.66), 420, 690);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#07101a"; ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      const sheet = await composeSheetCanvas(a);
      if (seq !== sheetDrawSeq) return;
      const fit = Math.min(cv.width / sheet.width, cv.height / sheet.height) * 0.94;
      const w = sheet.width * fit, h = sheet.height * fit, x = (cv.width - w) / 2, y = (cv.height - h) / 2;
      ctx.drawImage(sheet, x, y, w, h);
      const cw = w / a.cols, ch = h / a.rows;
      st.sheetView = { x, y, w, h, cw, ch, cols: a.cols, rows: a.rows };
      const selected = selectedSlotSet();
      for (let i = 0; i < a.slots.length; i++) {
        const sx = x + (i % a.cols) * cw, sy = y + Math.floor(i / a.cols) * ch;
        const dirty = !!replacements(a.id)[String(i)];
        ctx.strokeStyle = selected.has(i) ? "#14f195" : dirty ? "#ffd76e" : "rgba(255,255,255,.16)";
        ctx.lineWidth = selected.has(i) ? 3 : dirty ? 2 : 1;
        ctx.strokeRect(sx, sy, cw, ch);
        if (dirty) { ctx.fillStyle = "rgba(255,215,110,.20)"; ctx.fillRect(sx + 2, sy + 2, Math.max(8, cw - 4), 11); }
      }
    } catch (e: any) { ctx.fillStyle = "#ff9a88"; ctx.font = "13px ui-monospace,monospace"; ctx.fillText(String(e?.message || e), 22, 38); }
  }, 80);
}

function drawCanvases() { setTimeout(() => { drawSourceCanvas(); drawSheetCanvas(); }, 0); }
function paint(reason = "state") { measureFn(`paint:${reason}`, () => { const r = root(); if (!r) return; render(<App />, r); drawCanvases(); }, 24); }

function Header() {
  const dirty = dirtyAtlasIds();
  return <section className="forgeHero">
    <div>
      <p className="kicker">SolCraft Admin · fixed-grid sprite sheets</p>
      <h1>Sprite Sheet Forge</h1>
      <p className="heroCopy">Select target cells in the preview or target grid. That selection becomes a movable source sample grid. Apply it directly; no saved clips, no version picker, no admin key in the main flow.</p>
      <p className={st.err ? "bad" : "ok"}>{st.status}</p>
    </div>
    <div className="heroActions">
      <a className="btn" href="/admin">← Admin</a>
      <a className="btn" href="/">Open game</a>
      <button className="btn" onClick={load} disabled={st.busy}>Reload runtime</button>
      <div className="heroPills"><span className="pill">selected {selectedSlots().length}</span><span className="pill warn">dirty {dirty.length ? dirty.join(", ") : "none"}</span></div>
    </div>
  </section>;
}
function SourcePanel() {
  const g = selectionGrid();
  return <section className="panel sourcePanel">
    <div className="panelHead"><span className="step">1</span><div><h2>Source image + movable sample grid</h2><p className="tiny">The sample grid follows the target selection: {g.cols}×{g.rows}. Drag it over the source image. Increase crop size when art needs more room.</p></div></div>
    <div className="sourceControls sourceControlsSingle">
      <div className="field"><label>Upload source PNG/JPG/WebP</label><input type="file" accept="image/*,.png,.jpg,.jpeg,.webp" onChange={(e: any) => onSourceUpload(e.currentTarget.files?.[0] || null)} /></div>
    </div>
    <div className="canvasWrap sourceWrap"><canvas id="source-canvas" onMouseDown={sourceDown} onMouseMove={sourceMove} onMouseUp={sourceUp} onMouseLeave={sourceUp}></canvas></div>
    <div className="coords cutCoords">
      <div className="field"><label>sample x</label><input type="number" value={round(st.cut.x)} onInput={(e: any) => setCut("x", e.currentTarget.value)} /></div>
      <div className="field"><label>sample y</label><input type="number" value={round(st.cut.y)} onInput={(e: any) => setCut("y", e.currentTarget.value)} /></div>
      <div className="field"><label>sample w</label><input type="number" value={round(st.cut.cellW)} onInput={(e: any) => setCut("cellW", e.currentTarget.value)} /></div>
      <div className="field"><label>sample h</label><input type="number" value={round(st.cut.cellH)} onInput={(e: any) => setCut("cellH", e.currentTarget.value)} /></div>
    </div>
    <div className="row panelFoot"><button className="btn" onClick={resetCutCellSize}>Reset 128×128</button><button className="btn" onClick={() => adjustCutSize(16, 16)}>Bigger crop</button><button className="btn" onClick={() => adjustCutSize(0, 16)}>Taller crop</button><button className="btn" onClick={() => adjustCutSize(16, 0)}>Wider crop</button><button className="btn" onClick={() => adjustCutSize(-16, -16)}>Smaller crop</button><button className="btn" onClick={fitCutToSource}>Fit to source</button><button className="btn primary" onClick={applySourceArea}>Apply source area to selected slots</button><span className="pill">source {st.sourceName || "none"}</span><span className="pill">{st.sourceW || "?"}×{st.sourceH || "?"}</span></div>
  </section>;
}
function PreviewPanel() {
  const dirty = dirtyAtlasIds();
  return <section className="panel previewPanel">
    <div className="panelHead"><span className="step">2</span><div><h2>Preview, compose, publish</h2><p className="tiny">Preview is clickable and stays synced with the target grid. Runtime sheet is the base; queued replacements draw on top.</p></div></div>
    <div className="canvasWrap sheetWrap"><canvas id="sheet-canvas" onClick={onPreviewClick}></canvas></div>
    <div className="row panelFoot"><label className="pill"><input type="checkbox" checked={!!st.publishAfterUpload} onInput={(e: any) => { st.publishAfterUpload = !!e.currentTarget.checked; paint("publish-toggle"); }} /> publish after upload</label><button className="btn primary" onClick={() => uploadComposed(st.atlasId, !!st.publishAfterUpload)} disabled={st.busy || !Object.keys(replacements(st.atlasId)).length}>Compose current sheet</button><button className="btn warn" onClick={uploadAllDirty} disabled={st.busy || !dirty.length}>Compose all dirty sheets</button></div>
  </section>;
}

function clearAdminKey() { st.adminKey = ""; saveKey(); setStatus("Cleared optional production admin key."); }

function ProductionKeyPanel() {
  return <details className="panel prodKeyPanel">
    <summary><span className="step mini">P</span><span><b>Production key</b><small>Optional. Local admin is already behind Caddy basic auth.</small></span><span className="pill">{st.adminKey ? "stored" : "empty"}</span></summary>
    <div className="prodKeyBody">
      <p className="tiny">Leave this empty for normal local atlas work. Fill it only when an admin API also requires <code>x-solcraft-admin-key</code>, for example production sync or a remote protected runtime.</p>
      <div className="field"><label>Production / remote admin key</label><input type="password" value={st.adminKey || ""} placeholder="Optional production key" onInput={(e: any) => { st.adminKey = e.currentTarget.value; saveKey(); paint("prod-key"); }} /></div>
      <div className="row panelFoot"><button className="btn danger" onClick={clearAdminKey} disabled={!st.adminKey}>Clear stored key</button></div>
    </div>
  </details>;
}

function TargetPanel() {
  const a = atlas();
  const map = replacements(a.id);
  const selected = selectedSlotSet();
  const g = selectionGrid();
  return <section className="panel targetPanel">
    <div className="panelHead"><span className="step">3</span><div><h2>Target sprite sheet</h2><p className="tiny">This mirrors the preview selection. Click here or on the preview. Shift-click selects a rectangle; Ctrl/Cmd-click toggles cells.</p></div></div>
    <div className="atlasTabs">{ATLASES.map((x) => <button className={`btn ${x.id === st.atlasId ? "on" : ""}`} onClick={() => selectAtlas(x.id)}>{x.label}</button>)}</div>
    <div className="sheetStats"><span className="pill">{a.cols}×{a.rows}</span><span className="pill">{a.slots.length} cells</span><span className="pill">output {sheetW(a)}×{sheetH(a)}</span><span className="pill">selected {selected.size}</span><span className="pill warn">queued {Object.keys(map).length}</span></div>
    <div className={`slotgrid cols${a.cols}`}>{a.slots.map((s, i) => <button className={`slot ${selected.has(i) ? "on" : ""} ${map[String(i)] ? "dirty" : ""}`} onClick={(ev: any) => onSlotClick(ev, i)}><b><span>{i}</span>{s}</b><small>{map[String(i)] ? "queued" : "runtime"}</small></button>)}</div>
    <div className="targetSummary"><b>Sample map:</b> target {g.cols}×{g.rows} cells → source {cutW()}×{cutH()} px. Source crop is {round(st.cut.cellW)}×{round(st.cut.cellH)} per target cell. <b>Target inset</b> shrinks art inside the final cell; it does not include more source pixels.</div>
    <div className="tools"><div className="field"><label>how source fits target</label><select value={st.fit} onInput={(e: any) => setFit(e.currentTarget.value)}><option value="contain">contain</option><option value="cover">cover cell</option><option value="stretch">stretch</option></select></div><div className="field"><label>target inset</label><input type="number" value={st.pad} onInput={(e: any) => setPad(e.currentTarget.value)} /></div></div>
    <div className="row panelFoot"><button className="btn primary" onClick={applySourceArea}>Apply source area</button><button className="btn" onClick={clearTargetSelection}>Single selected</button><button className="btn danger" onClick={clearSelectedCells} disabled={!selectedSlots().some((i) => map[String(i)])}>Clear selected queue</button><button className="btn danger" onClick={clearSheetQueue} disabled={!Object.keys(map).length}>Clear sheet queue</button></div>
  </section>;
}
function QueuePanel() {
  const a = atlas();
  const entries = Object.keys(replacements(a.id)).map((k) => ({ slot: Number(k), p: replacements(a.id)[k] })).sort((a, b) => a.slot - b.slot);
  return <section className="panel queuePanel"><div className="panelHead"><span className="step">Q</span><div><h2>Current queue</h2><p className="tiny">Only queued replacements for the selected sheet. Compose uploads a full sheet and clears this queue.</p></div></div>{!entries.length ? <p className="emptyText">No queued cells for {a.label}.</p> : <div className="queueList">{entries.map(({ slot, p }) => <button className="queueItem" onClick={() => selectOnlySlot(slot)}><span><b>{slot}. {a.slots[slot]}</b><small>x{p.rect.x} y{p.rect.y} · {p.rect.w}×{p.rect.h} · {p.fit}</small></span><span className="pill warn">queued</span></button>)}</div>}</section>;
}
function HotkeysPanel() {
  return <section className="panel hotkeyPanel">
    <div className="panelHead"><span className="step">⌨</span><div><h2>Hotkeys</h2><p className="tiny">Keyboard edits use the same state as the preview and target grid, so both stay synced.</p></div></div>
    <div className="hotkeyGrid">
      <span><kbd>← ↑ ↓ →</kbd><small>move source sample 1px</small></span>
      <span><kbd>Shift</kbd> + <kbd>← ↑ ↓ →</kbd><small>move source sample by one sample cell</small></span>
      <span><kbd>Alt</kbd> + <kbd>← ↑ ↓ →</kbd><small>move source sample 10px</small></span>
      <span><kbd>Ctrl/Cmd</kbd> + <kbd>← ↑ ↓ →</kbd><small>move target selection and source sample together by one cell</small></span>
      <span><kbd>[</kbd> / <kbd>]</kbd><small>previous / next single slot</small></span>
      <span><kbd>Enter</kbd><small>apply source area to selected slots</small></span>
    </div>
  </section>;
}
function Debug() {
  return <details className="panel debugPanel"><summary>Debug</summary><pre className="debug">{safeJson({ atlas: st.atlasId, selectedSlots: selectedSlots(), selectionGrid: selectionGrid(), cut: st.cut, dirtyAtlasIds: dirtyAtlasIds(), currentQueue: replacements(st.atlasId), lastApi: st.debug })}</pre></details>;
}
function App() {
  return <main className="af4"><Header /><div className="sourceRow"><SourcePanel /></div><div className="previewTargetLayout"><div className="previewStack"><PreviewPanel /><QueuePanel /></div><div className="targetStack"><TargetPanel /><HotkeysPanel /><ProductionKeyPanel /><Debug /></div></div></main>;
}

function onKey(ev: any) {
  if (!root()) return;
  const tag = String(ev.target?.tagName || "").toUpperCase();
  const editable = !!ev.target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
  if (editable && !(ev.ctrlKey || ev.metaKey)) return;
  const a = atlas();
  const d = arrowDelta(ev.key);
  if (d) {
    ev.preventDefault?.();
    // Ctrl/Cmd is the synchronized cell jump: target selection and source sample move together.
    if (ev.ctrlKey || ev.metaKey) return jumpTargetAndSource(d.x, d.y);
    const stepX = ev.shiftKey ? Math.max(1, round(st.cut.cellW)) : ev.altKey ? 10 : 1;
    const stepY = ev.shiftKey ? Math.max(1, round(st.cut.cellH)) : ev.altKey ? 10 : 1;
    return nudgeSourceSample(d.x * stepX, d.y * stepY, ev.shiftKey ? "source sample by one cell" : ev.altKey ? "source sample by 10px" : "source sample by 1px");
  }
  const slots = selectedSlots();
  const current = slots[slots.length - 1] || 0;
  if (ev.key === "[") { ev.preventDefault?.(); return selectOnlySlot(Math.max(0, current - 1)); }
  if (ev.key === "]") { ev.preventDefault?.(); return selectOnlySlot(Math.min(a.slots.length - 1, current + 1)); }
  if (ev.key === "Enter") { ev.preventDefault?.(); return applySourceArea(); }
}
export default function mount() {
  const r = root();
  if (!r || mounted) return;
  mounted = true;
  loadKey();
  // Keyboard events often target <body> or focused controls instead of the mount node.
  // Listen once at document capture level; adding both document and window makes one key press run twice.
  try { document.addEventListener("keydown", onKey, true); } catch {}
  try { r.setAttribute("tabindex", "-1"); } catch {}
  paint("mount");
  load();
}
