// @ts-nocheck
import { buildingRecipeFor, recipeVisibleParts, type PrismRecipePart } from "./buildingRecipes";
import { resourceRecipeFor, type ResourcePrismPart } from "./resourceRecipes";
import { createPickDebugOverlay, type CanvasWorldApi } from "./canvasWorldApi";
import { visualPerfFor } from "../game/clientSettings";

/*
  Canvas-first rendering decision
  -------------------------------
  The world remains Canvas 2D because it keeps the 2.5D prism renderer simple,
  debuggable, and cheap to ship on mobile. We are deliberately not moving core
  terrain/buildings/selection to WebGL in this phase; a second renderer would
  introduce depth-order and input-mapping bugs. If WebGL is added later, keep it
  as a narrow overlay above the canvas (for example additive Wonder bloom, rain
  distortion, or post-process light cones) that never owns collision, picking,
  authoritative coordinates, or the painter's algorithm.
*/

type Pt = { x: number; y: number };
type CanvasWorldOptions = {
  host: HTMLElement;
  state: any;
  sendAction?: (type: string, payload?: any) => Promise<any>;
  say?: (msg: string, ms?: number) => void;
  pollSoon?: () => void;
  key?: (x: number, z: number) => string;
  cheb?: (ax: number, az: number, bx: number, bz: number) => number;
  n8?: Array<[number, number]>;
  currentTileLoadRadius?: () => number;
  capitalBuildingsInView?: (ax: number, az: number, r: number) => any[];
  tradePostAt?: (x: number, z: number) => any;
  proceduralNpcAt?: (x: number, z: number) => any;
  biomeTerrainAt?: (x: number, z: number) => string;
  naturalDoodad?: (x: number, z: number) => string | null;
  hrand?: (x: number, z: number, s?: number) => number;
  onHop?: () => void;
  onError?: () => void;
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function cssHex(value: any, fallback = "#d6604f") {
  const s = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
}
function hexToRgb(hex: string) {
  const h = cssHex(hex, "#000000").slice(1);
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgbToCss(c: number[], a = 1) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function shadeHex(hex: string, amount: number) {
  const c = hexToRgb(hex); const target = amount >= 0 ? 255 : 0; const a = Math.abs(amount);
  const out = c.map((v) => Math.round(v + (target - v) * a));
  return `#${out.map(v=>Math.round(clamp(v,0,255)).toString(16).padStart(2,"0")).join("")}`;
}
function mixRgb(a: number[], b: number[], t: number) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function tint(hex: string, f = 1, tintRgb: number[] | null = null) {
  const c = hexToRgb(hex).map(v => v * f);
  const t = tintRgb || [1,1,1];
  return rgbToCss([clamp(c[0] * t[0],0,255), clamp(c[1] * t[1],0,255), clamp(c[2] * t[2],0,255)]);
}
function keyOf(x: number, z: number) { return `${Math.trunc(x)},${Math.trunc(z)}`; }
function stableRand(x: number, z: number, s = 0) {
  let n = (Math.imul(Math.trunc(x) + 1013, 374761393) ^ Math.imul(Math.trunc(z) + 9176, 668265263) ^ Math.imul(s + 1447, 2246822519)) >>> 0;
  n ^= n >> 13; n = Math.imul(n, 1274126177) >>> 0; n ^= n >> 16;
  return (n >>> 0) / 4294967295;
}
function numColorToHex(v: any, fallback = "#14f195") {
  if (typeof v === "number" && Number.isFinite(v)) return `#${(v >>> 0).toString(16).slice(-6).padStart(6,"0")}`;
  return cssHex(v, fallback);
}

export function createCanvasPrismWorld(opts: CanvasWorldOptions): CanvasWorldApi {
  const host = opts.host;
  const ST = opts.state || {};
  const kfn = opts.key || keyOf;
  const cheb = opts.cheb || ((ax:number,az:number,bx:number,bz:number)=>Math.max(Math.abs(ax-bx),Math.abs(az-bz)));
  const n8 = opts.n8 || [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

  host.classList.add("sc-canvas-world-host");
  host.querySelectorAll("canvas").forEach((n) => { try { n.remove(); } catch {} });
  const canvas = document.createElement("canvas");
  canvas.className = "sc-canvas-world";
  canvas.setAttribute("aria-label", "SolCraft canvas prism world");
  host.appendChild(canvas);
  const screenCtx = canvas.getContext("2d", { alpha: false })!;
  // Static terrain/roads/grid are rendered into this offscreen canvas and then
  // blitted with one drawImage per frame. Canvas path construction is the hot
  // CPU cost, so caching static pixels matters more than micro-optimizing each
  // ctx.fill() call. The cache key below uses coarse buckets to avoid thrashing
  // while the camera eases sub-pixel between tiles.
  const staticCanvas = document.createElement("canvas");
  const staticCtx = staticCanvas.getContext("2d", { alpha: true })!;
  // Completed buildings and common resources are also static *shapes* even
  // though they live on the dynamic depth-sorted pass. Cache their prism body
  // into tiny offscreen sprites keyed by quality/zoom/time band. The main
  // frame can then depth-sort the object normally but draw one image instead
  // of reconstructing many prism paths. Construction, Wonder auras, hover
  // affordances, damage, particles, and labels stay live so gameplay feedback
  // never gets baked into a stale sprite.
  const buildingSpriteCache = new Map<string, any>();
  const resourceSpriteCache = new Map<string, any>();
  const MAX_BUILDING_SPRITES = 96;
  const MAX_RESOURCE_SPRITES = 24;
  let spriteCacheSerial = 0;
  let ctx: CanvasRenderingContext2D = screenCtx;

  let dpr = 1, width = 1, height = 1;
  let tileW = 54, tileH = 27, heightScale = 46;
  let cameraX = 0, cameraY = 0;
  let targetCameraX = 0, targetCameraY = 0;
  let zoomValue = 1;
  let disposed = false;
  let raf = 0;
  let lastFrame = performance.now();
  let renderDtMs = 16;
  let lastStepAt = 0;
  let moveSeq = 0, ackSeq = 0, inFlight = 0;
  const maxInFlight = 4;

  const me = {
    id: 0,
    x: 0,
    z: 0,
    // Render-only position. Logical x/z stays tile-accurate for ECS authority,
    // while vx/vz eases toward it so walking reads as continuous motion.
    vx: 0,
    vz: 0,
    velX: 0,
    velZ: 0,
    inputX: 0,
    inputZ: 0,
    renderSpeed: 0,
    name: "",
    body: 0x14f195,
    hat: 0x7dcfe8,
    walking: false,
    walkPhase: 0,
    facingX: 0,
    facingZ: 1,
  };
  let lastAuthoritative = { x: 0, z: 0 };
  const remotes: any[] = [];
  const playersById = new Map<any, any>();
  const tileOwner = new Map<string, any>();
  const buildPool = new Map<any, any>();
  const buildAt = new Map<string, any>();
  const lootPool = new Map<any, any>();
  const rigPool = new Map<any, any>();
  const tradePostPool = new Map<any, any>();
  const npcPool = new Map<any, any>();
  const cells = new Map<string, any>();
  const doodads = new Map<string, any>();
  const exceptions = new Map<string, any>();
  let hintCells: any[] = [];
  let ghost: any = null;
  let lastPickTarget: any = null;
  let lastPickAt = 0;
  const pickDebug = createPickDebugOverlay(host);
  let pendingPath: Array<{x:number,z:number}> = [];
  const floaters: any[] = [];
  const bursts: any[] = [];
  const dustPuffs: any[] = [];
  let lastDustAt = 0;
  const staticGroundMarks: any[] = [];
  const minGroundMarks = 240;
  const cityGridStep = 4;
  const visualCityFootprint = 4;
  const skyStars = Array.from({ length: 92 }, (_, i) => ({
    x: stableRand(i, 19, 2), y: stableRand(i, 23, 3) * 0.72, s: stableRand(i, 29, 4) > 0.82 ? 2 : 1, ph: stableRand(i, 31, 5) * Math.PI * 2,
  }));
  const skyClouds = Array.from({ length: 7 }, (_, i) => ({
    x: stableRand(i, 37, 6), y: 0.06 + stableRand(i, 41, 7) * 0.25, s: 22 + stableRand(i, 43, 8) * 34, spd: 0.010 + stableRand(i, 47, 9) * 0.018,
  }));
  const ambientBirds = Array.from({ length: 4 }, (_, i) => ({
    lane: i, phase: stableRand(i, 71, 4) * Math.PI * 2, speed: 0.055 + stableRand(i, 73, 5) * 0.035, scale: 0.65 + stableRand(i, 79, 6) * 0.55,
  }));
  const citySparkles: any[] = [];
  let lastCitySparkleAt = 0;
  const actionBursts: any[] = [];
  const actionRings: any[] = [];
  const rainStreaks: any[] = [];
  const groundRipples: any[] = [];
  const windLeaves: any[] = [];
  let lastWeatherSpawnAt = 0;
  const ambientCitizens = Array.from({ length: 18 }, (_, i) => ({
    id: `citizen:${i}`,
    lane: i % 6,
    seed: i * 37 + 11,
    speed: 0.035 + stableRand(i, 97, 2) * 0.045,
    offset: stableRand(i, 101, 3) * 1024,
    body: stableRand(i, 107, 4) > 0.5 ? 0x2980b9 : stableRand(i, 109, 5) > 0.5 ? 0xc0392b : 0x27ae60,
    hat: stableRand(i, 113, 6) > 0.5 ? 0xf6b73c : 0x7dcfe8,
  }));
  const ambientCarts = Array.from({ length: 5 }, (_, i) => ({
    id: `cart:${i}`,
    seed: i * 53 + 7,
    speed: 0.022 + stableRand(i, 127, 2) * 0.025,
    offset: stableRand(i, 131, 3) * 2048,
  }));
  let lastVisibleCenter = { x: 1e9, z: 1e9, r: 0 };
  let renderQuality = visualPerfFor(ST.visual || {}, false);
  let staticDirty = true;
  let staticCacheKey = "";
  let lastStaticRebuildReason = "boot";
  const renderCounters = {
    terrainTilesDrawn: 0, entitiesSorted: 0, entitiesDrawn: 0, weatherDrawn: 0, staticSkipped: 0,
    staticRebuildMs: 0, dynamicDrawMs: 0, staticCacheHits: 0, staticCacheMisses: 0,
    prismPartsDrawn: 0, shadowsDrawn: 0, labelsDrawn: 0, particlesDrawn: 0,
    influenceAuras: 0, constructionVisuals: 0, perfWarnings: 0,
    spriteCacheHits: 0, spriteCacheMisses: 0, spriteDraws: 0, spriteEvictions: 0,
    reset() {
      this.terrainTilesDrawn = 0; this.entitiesSorted = 0; this.entitiesDrawn = 0; this.weatherDrawn = 0; this.staticSkipped = 0;
      this.staticRebuildMs = 0; this.dynamicDrawMs = 0; this.staticCacheHits = 0; this.staticCacheMisses = 0;
      this.prismPartsDrawn = 0; this.shadowsDrawn = 0; this.labelsDrawn = 0; this.particlesDrawn = 0;
      this.influenceAuras = 0; this.constructionVisuals = 0; this.perfWarnings = 0;
      this.spriteCacheHits = 0; this.spriteCacheMisses = 0; this.spriteDraws = 0; this.spriteEvictions = 0;
    },
  };
  function qualityName() { return String(renderQuality?.quality || ST.visual?.quality || "fast").toLowerCase(); }
  function qualityBudget(name: string, fallback: number) {
    const n = Number(renderQuality?.[name]);
    return Number.isFinite(n) ? n : fallback;
  }
  function invalidateStatic(reason = "world") {
    staticDirty = true;
    lastStaticRebuildReason = String(reason || "world");
  }
  function qualityStride(name: string, fallback = 1) {
    return Math.max(1, Math.trunc(qualityBudget(name, fallback)));
  }
  function shouldSkipDecor(x: number, z: number, strideName: string, seed = 0) {
    const stride = qualityStride(strideName, 1);
    if (stride <= 1) return false;
    return Math.abs(Math.trunc(x) * 31 + Math.trunc(z) * 17 + seed) % stride !== 0;
  }
  function clearSpriteCaches(reason = "visual") {
    if (buildingSpriteCache.size || resourceSpriteCache.size) {
      renderCounters.spriteEvictions += buildingSpriteCache.size + resourceSpriteCache.size;
      buildingSpriteCache.clear(); resourceSpriteCache.clear();
    }
    spriteCacheSerial++;
  }
  function evictOldestSprite(cache: Map<string, any>, max: number) {
    if (cache.size <= max) return;
    let oldestKey = "", oldestAt = Infinity;
    for (const [k, v] of cache) {
      const at = Number(v?.lastUsed || 0);
      if (at < oldestAt) { oldestAt = at; oldestKey = k; }
    }
    if (oldestKey) { cache.delete(oldestKey); renderCounters.spriteEvictions++; }
  }
  function spriteTimeBand() { return Math.floor(currentHour() / 2); }
  function spriteZoomBucket() { return Math.round(visualZoom() * 8) / 8; }
  function spriteDprBucket() { return Math.round(dpr * 4) / 4; }
  function weatherDensity() { return clamp(qualityBudget("weatherDensity", 1), 0, 1); }
  function sparkleDensity() { return clamp(qualityBudget("sparkleDensity", 1), 0, 1); }
  function applyVisualQuality(nextVisual: any = ST.visual) {
    ST.visual = nextVisual || ST.visual || {};
    renderQuality = visualPerfFor(ST.visual || {}, false);
    const q = qualityName();
    if (q === "fast") {
      rainStreaks.splice(0); groundRipples.splice(0); windLeaves.splice(0); citySparkles.splice(0);
    } else {
      const weatherCap = q === "balanced" ? 130 : 260;
      if (rainStreaks.length > weatherCap) rainStreaks.splice(0, rainStreaks.length - weatherCap);
      if (groundRipples.length > Math.round(weatherCap * 0.42)) groundRipples.splice(0, groundRipples.length - Math.round(weatherCap * 0.42));
      if (windLeaves.length > Math.round(weatherCap * 0.28)) windLeaves.splice(0, windLeaves.length - Math.round(weatherCap * 0.28));
    }
    invalidateStatic("quality");
    clearSpriteCaches("quality");
    resize(); updateProjection(); rebuildCells(true);
  }

  const hoverMarker = {
    visible: false,
    position: { x: 0, z: 0 },
    material: { color: { _hex: "#14f195", set(v: any) { this._hex = numColorToHex(v, "#14f195"); } } },
  } as any;

  function resize() {
    const dprCap = clamp(Number(renderQuality?.pixelRatioCap || 1.25), 0.75, 2);
    const nextDpr = Math.min(dprCap, window.devicePixelRatio || 1);
    const w = Math.max(1, host.clientWidth || window.innerWidth || 1);
    const h = Math.max(1, host.clientHeight || window.innerHeight || 1);
    if (w === width && h === height && nextDpr === dpr) return;
    dpr = nextDpr; width = w; height = h;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    staticCanvas.width = canvas.width;
    staticCanvas.height = canvas.height;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx = screenCtx;
    clearSpriteCaches("resize");
    invalidateStatic("resize");
  }

  function visualZoom() { return clamp(Number(ST.visual?.cameraZoom || 1) || 1, 0.72, 1.55) * zoomValue; }
  function updateProjection() {
    const z = visualZoom();
    // Slightly smaller diamonds plus larger prism recipes give the reference
    // city-builder read: large buildings on an intentional build grid.
    tileW = 46 * z; tileH = 23 * z; heightScale = 44 * z;
  }
  function proj(wx: number, wy = 0, wz: number): Pt {
    return { x: cameraX + (wx - wz) * tileW, y: cameraY + (wx + wz) * tileH - wy * heightScale };
  }
  function screenToWorld(sx: number, sy: number) {
    const dx = (sx - cameraX) / tileW, dy = (sy - cameraY) / tileH;
    return { wx: (dx + dy) / 2, wz: (dy - dx) / 2 };
  }
  function smoothAmount(dtMs: number, stiffness = 18) {
    return 1 - Math.exp(-Math.max(0, dtMs) / 1000 * stiffness);
  }
  function snapVisualToLogical() {
    me.vx = Number(me.x || 0);
    me.vz = Number(me.z || 0);
    me.velX = 0;
    me.velZ = 0;
    me.renderSpeed = 0;
  }
  function visualX(p: any) { return p === me ? Number(me.vx || me.x || 0) : Number(p?.x || 0); }
  function visualZ(p: any) { return p === me ? Number(me.vz || me.z || 0) : Number(p?.z || 0); }
  function remoteVisualX(p: any) { return Number.isFinite(Number(p?.__vx)) ? Number(p.__vx) : Number(p?.x || 0); }
  function remoteVisualZ(p: any) { return Number.isFinite(Number(p?.__vz)) ? Number(p.__vz) : Number(p?.z || 0); }
  function nudgeVisualToward(x: number, z: number, strength: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const a = clamp(Number(strength || 0), 0, 1);
    me.vx += (x - me.vx) * a;
    me.vz += (z - me.vz) * a;
  }
  function spawnStepDust(nowMs: number) {
    if (nowMs - lastDustAt < 95 || me.renderSpeed < 0.18) return;
    lastDustAt = nowMs;
    const side = stableRand(Math.trunc(me.x), Math.trunc(me.z), Math.floor(nowMs / 100)) - 0.5;
    dustPuffs.push({
      x: me.vx - me.velX * 0.035 + side * 0.18,
      z: me.vz - me.velZ * 0.035 - side * 0.18,
      y: 0.045,
      life: 0.55,
      maxLife: 0.55,
      r: 0.10 + me.renderSpeed * 0.06,
    });
    if (dustPuffs.length > 40) dustPuffs.splice(0, dustPuffs.length - 40);
  }
  function reconcileAuthoritative(serverX: number, serverZ: number, opts: { hard?: boolean } = {}) {
    const tx = Math.trunc(Number(serverX));
    const tz = Math.trunc(Number(serverZ));
    if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
    lastAuthoritative = { x: tx, z: tz };
    const visualDrift = Math.hypot(tx - me.vx, tz - me.vz);
    const logicalDrift = Math.hypot(tx - me.x, tz - me.z);
    if (opts.hard || visualDrift > 2.5 || logicalDrift > 3.25) {
      hardSnapMe(tx, tz);
      return;
    }
    me.x = tx;
    me.z = tz;
    if (ST.me) { ST.me.x = tx; ST.me.z = tz; }
    // Pop suppression: tiny corrections are absorbed naturally by the next
    // interpolation frame, not applied as visible one-frame jumps.
    if (visualDrift >= 0.12) {
      const strength = Math.min(0.35, Math.max(0.08, (visualDrift / 1.8) * 0.22));
      nudgeVisualToward(tx, tz, strength);
    }
  }
  function updateVisualMotion(dtMs: number, nowMs = performance.now()) {
    const prevX = Number(me.vx || me.x || 0);
    const prevZ = Number(me.vz || me.z || 0);
    const dx = Number(me.x || 0) - prevX;
    const dz = Number(me.z || 0) - prevZ;
    const euclid = Math.hypot(dx, dz);
    const chebDrift = Math.max(Math.abs(dx), Math.abs(dz));
    if (chebDrift > 8) {
      snapVisualToLogical();
      return;
    }
    const inputSpeed = Math.min(1.4, Math.hypot(Number(me.inputX || 0), Number(me.inputZ || 0)));
    const moving = me.walking || inputSpeed > 0.05 || pendingPath.length > 0 || inFlight > 0 || euclid > 0.02;
    const a = smoothAmount(dtMs, moving ? 14.5 : 10.5);
    me.vx += dx * a;
    me.vz += dz * a;
    const dt = Math.max(0.001, dtMs / 1000);
    me.velX = (me.vx - prevX) / dt;
    me.velZ = (me.vz - prevZ) / dt;
    me.renderSpeed = Math.max(inputSpeed * 0.55, Math.min(1.8, Math.hypot(me.velX, me.velZ) / 7.2));
    if (moving) spawnStepDust(nowMs);
    if (Math.max(Math.abs(me.x - me.vx), Math.abs(me.z - me.vz)) < 0.012 && !hasPendingMove()) snapVisualToLogical();
  }
  function updateRemoteVisuals(dtMs: number) {
    const a = smoothAmount(dtMs, 11.5);
    const dt = Math.max(0.001, dtMs / 1000);
    for (const p of remotes) {
      if (!p) continue;
      const tx = Number(p.x || 0), tz = Number(p.z || 0);
      if (!Number.isFinite(Number(p.__vx)) || !Number.isFinite(Number(p.__vz))) {
        p.__vx = tx; p.__vz = tz; p.__velX = 0; p.__velZ = 0; p.__renderSpeed = 0; p.__walkPhase = 0;
        continue;
      }
      const prevX = Number(p.__vx || tx), prevZ = Number(p.__vz || tz);
      const drift = Math.hypot(tx - prevX, tz - prevZ);
      if (drift > 8) {
        p.__vx = tx; p.__vz = tz; p.__velX = 0; p.__velZ = 0; p.__renderSpeed = 0;
        continue;
      }
      p.__vx += (tx - p.__vx) * a;
      p.__vz += (tz - p.__vz) * a;
      p.__velX = (p.__vx - prevX) / dt;
      p.__velZ = (p.__vz - prevZ) / dt;
      p.__renderSpeed = Math.min(1.2, Math.hypot(p.__velX, p.__velZ) / 7.2);
      if (p.__renderSpeed > 0.04) p.__walkPhase = Number(p.__walkPhase || 0) + dtMs * (0.006 + p.__renderSpeed * 0.010);
    }
  }
  function maybeSpawnCitySparkle(nowMs: number) {
    const density = sparkleDensity();
    if (density <= 0.02) return;
    const L = lightForTime();
    if (L.night < 0.32 && !L.dusk) return;
    const maxSparkles = Math.max(8, Math.round(54 * density));
    const interval = Math.round(95 / Math.max(0.18, density));
    if (nowMs - lastCitySparkleAt < interval || citySparkles.length > maxSparkles) return;
    if (stableRand(Math.floor(nowMs / 113), Math.trunc(me.x), 996) > density) return;
    lastCitySparkleAt = nowMs;
    const r = opts.currentTileLoadRadius?.() || 36;
    const x = Math.round(me.vx || me.x) + Math.floor((stableRand(Math.floor(nowMs/97), 3, 91) - 0.5) * r * 1.55);
    const z = Math.round(me.vz || me.z) + Math.floor((stableRand(Math.floor(nowMs/113), 7, 92) - 0.5) * r * 1.55);
    citySparkles.push({ x, z, y: 0.45 + stableRand(x,z,33) * 2.2, life: 1.0, phase: stableRand(x,z,44) * Math.PI * 2 });
  }
  function roadStep() { return cityGridStep * 4; }
  function cityLoopPos(seed: number, offset: number, speed: number, nowMs = performance.now()) {
    const step = roadStep();
    const cx = Math.floor(Number(me.vx || me.x || 0) / step) * step;
    const cz = Math.floor(Number(me.vz || me.z || 0) / step) * step;
    const span = step * 6;
    const raw = ((nowMs / 1000) * speed * step + offset) % (span * 2);
    const horizontal = seed % 2 === 0;
    const laneShift = ((seed % 5) - 2) * 0.18;
    const roadBand = (Math.floor(seed / 3) % 5 - 2) * step;
    if (horizontal) return { x: cx - span / 2 + raw, z: cz + roadBand + laneShift, dx: 1, dz: 0 };
    return { x: cx + roadBand + laneShift, z: cz - span / 2 + raw, dx: 0, dz: 1 };
  }
  function drawTinyCitizen(citizen: any, x: number, z: number, phase: number) {
    const p = proj(x, 0.04, z);
    const L = lightForTime();
    const sc = visualZoom() * 0.72;
    const bob = Math.abs(Math.sin(phase)) * 1.6 * sc;
    ctx.save();
    ctx.translate(p.x, p.y - 10 * sc - bob);
    ctx.scale(sc, sc);
    ctx.fillStyle = tint(numColorToHex(citizen.body, '#2980b9'), 0.86 + L.elev * 0.25, L.tint);
    ctx.beginPath(); ctx.roundRect(-4, -13, 8, 12, 3); ctx.fill();
    ctx.fillStyle = tint('#f1c27d', 0.82 + L.elev * 0.28, L.tint);
    ctx.beginPath(); ctx.arc(0, -17, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tint(numColorToHex(citizen.hat, '#f6b73c'), 0.86 + L.elev * 0.25, L.tint);
    ctx.fillRect(-5, -20, 10, 3);
    ctx.fillStyle = 'rgba(24,20,18,0.78)';
    const leg = Math.sin(phase * 1.35) * 1.5;
    ctx.fillRect(-3 + leg, -1, 3, 5); ctx.fillRect(1 - leg, -1, 3, 5);
    ctx.restore();
  }
  function drawTinyCart(cart: any, x: number, z: number, horizontal: boolean) {
    const L = lightForTime();
    const yaw = horizontal ? 0 : 1;
    const w = horizontal ? 0.92 : 0.48;
    const d = horizontal ? 0.48 : 0.92;
    drawShadow(x, z, 0.36, 0.15, 0.10);
    drawPrismMin(x - w/2, z - d/2, 0.05, w, d, 0.28, '#8a5e34', '#5d3a21', '#3d2515', 0.95);
    const lamp = proj(x + (yaw ? 0.22 : 0.42), 0.36, z + (yaw ? 0.42 : 0.22));
    ctx.fillStyle = `rgba(255,210,110,${0.25 + L.night * 0.55})`;
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, Math.max(2, 3.2 * visualZoom()), 0, Math.PI * 2); ctx.fill();
  }

  function drawStreetLamp(x: number, z: number, seed = 0) {
    const L = lightForTime();
    const glow = clamp(0.12 + L.night * 0.78 + (L.dusk ? 0.18 : 0), 0, 0.92);
    drawPrismMin(x - 0.035, z - 0.035, 0.04, 0.07, 0.07, 0.72, '#2c3645', '#1d2530', '#121820', 0.94);
    drawPrismMin(x - 0.105, z - 0.105, 0.73, 0.21, 0.21, 0.12, '#ffd76e', '#a98728', '#755d1a', 0.98);
    const p = proj(x, 0.90, z);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,212,110,${glow * 0.20})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(8, 18 * visualZoom()), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,236,170,${glow * (0.55 + 0.18 * Math.sin(performance.now()/420 + seed))})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, 3.8 * visualZoom()), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCrosswalk(cx: number, cz: number, horizontal: boolean) {
    ctx.save();
    ctx.globalAlpha = 0.20 + lightForTime().elev * 0.16;
    for (let i = -2; i <= 2; i++) {
      const off = i * 0.28;
      const x = horizontal ? cx + off : cx;
      const z = horizontal ? cz : cz + off;
      const a = proj(x - (horizontal ? 0.035 : 0.46), 0.031, z - (horizontal ? 0.46 : 0.035));
      const b = proj(x + (horizontal ? 0.035 : 0.46), 0.031, z - (horizontal ? 0.46 : 0.035));
      const c = proj(x + (horizontal ? 0.035 : 0.46), 0.031, z + (horizontal ? 0.46 : 0.035));
      const d = proj(x - (horizontal ? 0.035 : 0.46), 0.031, z + (horizontal ? 0.46 : 0.035));
      poly([a,b,c,d], 'rgba(245,236,208,0.64)');
    }
    ctx.restore();
  }

  function drawCityFurniture() {
    if (qualityName() === "fast") { renderCounters.staticSkipped++; return; }
    const step = roadStep();
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.floor(Number(me.vx || me.x || 0) / step) * step;
    const cz = Math.floor(Number(me.vz || me.z || 0) / step) * step;
    const minX = cx - r - step, maxX = cx + r + step;
    const minZ = cz - r - step, maxZ = cz + r + step;
    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
      for (let z = Math.floor(minZ / step) * step; z <= maxZ; z += step) {
        const seed = Math.trunc(x * 17 + z * 31);
        if (shouldSkipDecor(x, z, "cityDecorStride", seed)) { renderCounters.staticSkipped++; continue; }
        drawCrosswalk(x, z, true);
        drawCrosswalk(x, z, false);
        if (stableRand(x, z, 501) > 0.18) drawStreetLamp(x + 1.35, z - 1.35, seed);
        if (qualityName() === "crisp" && stableRand(x, z, 502) > 0.34) drawStreetLamp(x - 1.35, z + 1.35, seed + 13);
        if (stableRand(x, z, 503) > 0.78) {
          drawPrismMin(x + 2.05, z + 0.36, 0.04, 0.16, 0.16, 0.44, '#c94a34', '#8f2d24', '#5e1d18', 0.92);
          drawPrismMin(x + 2.05, z + 0.36, 0.48, 0.34, 0.08, 0.14, '#ffd76e', '#a98728', '#755d1a', 0.95);
        }
      }
    }
  }

  function pushActionBurst(x: number, y: number, z: number, color = '#ffd76e', count = 10, power = 1) {
    const base = cssHex(color, '#ffd76e');
    for (let i = 0; i < count; i++) {
      const a = stableRand(Math.floor(performance.now()), i, 811) * Math.PI * 2;
      const sp = (0.55 + stableRand(i, Math.floor(x * 100), 812) * 1.55) * power;
      actionBursts.push({
        x, y, z,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp,
        vy: 0.90 + stableRand(i, Math.floor(z * 100), 813) * 1.85,
        life: 0.52 + stableRand(i, 17, 814) * 0.36,
        maxLife: 0.88,
        color: base,
        r: 0.018 + stableRand(i, 23, 815) * 0.035,
      });
    }
    if (actionBursts.length > 140) actionBursts.splice(0, actionBursts.length - 140);
  }

  function drawActionEffects() {
    const dt = Math.max(0.012, renderDtMs / 1000);
    renderCounters.particlesDrawn += actionRings.length + actionBursts.length;
    for (let i = actionRings.length - 1; i >= 0; i--) {
      const r = actionRings[i];
      r.life -= dt * 1.05; r.radius += dt * (1.7 + Number(r.power || 1) * 0.8);
      if (r.life <= 0) { actionRings.splice(i, 1); continue; }
      const p = proj(r.x, 0.082, r.z);
      ctx.save();
      ctx.strokeStyle = `${cssHex(r.color, '#ffd76e')}${Math.round(255 * clamp(r.life / r.maxLife, 0, 1) * 0.72).toString(16).padStart(2,'0')}`;
      ctx.lineWidth = Math.max(1.2, 2.0 * visualZoom());
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r.radius * tileW * 0.44, r.radius * tileH * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (let i = actionBursts.length - 1; i >= 0; i--) {
      const b = actionBursts[i];
      b.life -= dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt; b.vy -= 4.4 * dt;
      if (b.life <= 0) { actionBursts.splice(i, 1); continue; }
      const p = proj(b.x, b.y, b.z);
      const a = clamp(b.life / Math.max(0.001, b.maxLife), 0, 1);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = cssHex(b.color, '#ffd76e');
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.1, b.r * tileW), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  function poly(pts: Pt[], fill: string, stroke = "") {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(0.5, visualZoom() * 0.62); ctx.stroke(); }
  }

  function updateAmbientWeather(dtMs: number, nowMs: number) {
    const dt = Math.max(0.012, dtMs / 1000);
    const W = weatherForTime(nowMs);
    const density = weatherDensity();
    const spawnEvery = Math.round(42 / Math.max(0.12, density));
    if (density > 0.02 && nowMs - lastWeatherSpawnAt > spawnEvery) {
      lastWeatherSpawnAt = nowMs;
      const r = opts.currentTileLoadRadius?.() || 36;
      const baseX = Number(me.vx || me.x || 0);
      const baseZ = Number(me.vz || me.z || 0);
      if (W.rain > 0.02) {
        const count = Math.min(18, Math.max(1, Math.round((3 + W.rain * 13) * density)));
        for (let i = 0; i < count; i++) {
          const seed = Math.floor(nowMs / 43) + i * 31;
          rainStreaks.push({
            x: baseX + (stableRand(seed, 1, 930) - 0.5) * r * 1.8,
            z: baseZ + (stableRand(seed, 2, 931) - 0.5) * r * 1.8,
            y: 3.4 + stableRand(seed, 3, 932) * 2.8,
            life: 0.42 + stableRand(seed, 4, 933) * 0.18,
            maxLife: 0.58,
            windX: W.windX,
            windZ: W.windZ,
            rain: W.rain,
          });
          if (stableRand(seed, 5, 934) < W.rain * 0.32 * density) {
            groundRipples.push({
              x: baseX + (stableRand(seed, 6, 935) - 0.5) * r * 1.5,
              z: baseZ + (stableRand(seed, 7, 936) - 0.5) * r * 1.5,
              life: 0.52,
              maxLife: 0.52,
              radius: 0.06,
            });
          }
        }
      }
      if (stableRand(Math.floor(nowMs / 500), Math.trunc(baseX), 940) < W.leafRate * 0.42 * density) {
        const seed = Math.floor(nowMs / 67);
        windLeaves.push({
          x: baseX + (stableRand(seed, 8, 941) - 0.5) * r * 1.5,
          z: baseZ + (stableRand(seed, 9, 942) - 0.5) * r * 1.5,
          y: 0.55 + stableRand(seed, 10, 943) * 1.8,
          life: 2.2 + stableRand(seed, 11, 944) * 1.7,
          maxLife: 3.9,
          windX: W.windX,
          windZ: W.windZ,
          phase: stableRand(seed, 12, 945) * Math.PI * 2,
          color: stableRand(seed, 13, 946) > 0.55 ? 'rgba(223,168,78,0.78)' : 'rgba(151,205,112,0.64)',
        });
      }
    }
    for (let i = rainStreaks.length - 1; i >= 0; i--) {
      const p = rainStreaks[i];
      p.life -= dt; p.y -= dt * (6.8 + p.rain * 4.2); p.x += p.windX * dt * 1.2; p.z += p.windZ * dt * 1.2;
      if (p.life <= 0 || p.y <= 0.03) { rainStreaks.splice(i, 1); continue; }
    }
    for (let i = groundRipples.length - 1; i >= 0; i--) {
      const p = groundRipples[i]; p.life -= dt; p.radius += dt * 0.46;
      if (p.life <= 0) groundRipples.splice(i, 1);
    }
    for (let i = windLeaves.length - 1; i >= 0; i--) {
      const p = windLeaves[i];
      p.life -= dt; p.x += p.windX * dt * 1.6; p.z += p.windZ * dt * 1.6; p.y += Math.sin(nowMs / 380 + p.phase) * dt * 0.09;
      if (p.life <= 0) windLeaves.splice(i, 1);
    }
    const weatherCap = Math.max(20, Math.round(260 * Math.max(0.08, density)));
    if (rainStreaks.length > weatherCap) rainStreaks.splice(0, rainStreaks.length - weatherCap);
    if (groundRipples.length > Math.round(weatherCap * 0.42)) groundRipples.splice(0, groundRipples.length - Math.round(weatherCap * 0.42));
    if (windLeaves.length > Math.round(weatherCap * 0.28)) windLeaves.splice(0, windLeaves.length - Math.round(weatherCap * 0.28));
  }
  function drawAmbientWeatherGround() {
    const density = weatherDensity();
    if (density <= 0.20) return;
    const W = weatherForTime();
    if (W.puddle > 0.04) {
      const step = roadStep();
      const r = opts.currentTileLoadRadius?.() || 36;
      const cx = Math.floor(Number(me.vx || me.x || 0) / step) * step;
      const cz = Math.floor(Number(me.vz || me.z || 0) / step) * step;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let x = cx - r; x <= cx + r; x += step) for (let z = cz - r; z <= cz + r; z += step) {
        if (stableRand(x, z, 955) < 0.46) continue;
        const p = proj(x + (stableRand(x,z,956)-0.5) * 3.4, 0.045, z + (stableRand(x,z,957)-0.5) * 3.4);
        const a = W.puddle * (0.045 + stableRand(x,z,958) * 0.055);
        ctx.fillStyle = `rgba(147,196,214,${a})`;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, tileW * (0.26 + stableRand(x,z,959)*0.24), tileH * (0.10 + stableRand(x,z,960)*0.12), 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    for (let i = groundRipples.length - 1; i >= 0; i--) {
      const p = groundRipples[i];
      const a = clamp(p.life / p.maxLife, 0, 1) * 0.30;
      const c = proj(p.x, 0.072, p.z);
      ctx.strokeStyle = `rgba(188,222,236,${a})`;
      ctx.lineWidth = Math.max(0.8, visualZoom());
      ctx.beginPath(); ctx.ellipse(c.x, c.y, p.radius * tileW, p.radius * tileH * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  function drawWeatherOverlay() {
    const density = weatherDensity();
    if (density <= 0.02) return;
    const W = weatherForTime();
    if (W.mist > 0.04) {
      const g = ctx.createLinearGradient(0, height * 0.18, 0, height);
      g.addColorStop(0, `rgba(188,209,218,${W.mist * 0.05})`);
      g.addColorStop(1, `rgba(188,209,218,${W.mist * 0.18})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
    }
    if (windLeaves.length) {
      renderCounters.weatherDrawn += windLeaves.length;
      ctx.save();
      for (const leaf of windLeaves) {
        const p = proj(leaf.x, leaf.y, leaf.z);
        const a = clamp(leaf.life / leaf.maxLife, 0, 1);
        ctx.translate(p.x, p.y); ctx.rotate(Math.sin(performance.now()/260 + leaf.phase) * 0.9);
        ctx.fillStyle = leaf.color.replace(/,0.[0-9]+)$/, `,${0.50 * a})`);
        ctx.fillRect(-2.8 * visualZoom(), -1.1 * visualZoom(), 5.6 * visualZoom(), 2.2 * visualZoom());
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.restore();
    }
    if (rainStreaks.length) {
      renderCounters.weatherDrawn += rainStreaks.length;
      ctx.save(); ctx.lineWidth = Math.max(0.8, 1.1 * visualZoom()); ctx.strokeStyle = `rgba(188,220,236,${0.22 + W.rain * 0.36})`;
      for (const drop of rainStreaks) {
        const a = proj(drop.x, drop.y, drop.z);
        const b = proj(drop.x - drop.windX * 0.10, drop.y - 0.52, drop.z - drop.windZ * 0.10);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function colorWithAlpha(color: string, alpha = 1) {
    const a = clamp(Number(alpha), 0, 1);
    const s = String(color || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) {
      const [r,g,b] = hexToRgb(s);
      return `rgba(${r|0},${g|0},${b|0},${a})`;
    }
    if (/^rgba(/i.test(s)) return s.replace(/,\s*[0-9.]+\)$/, `,${a})`);
    if (/^rgb(/i.test(s)) return s.replace(/^rgb(/i, "rgba(").replace(/)$/, `,${a})`);
    return s || `rgba(255,215,110,${a})`;
  }
  function drawDiamond(cx: number, z: number, color: string, alpha = 1, lift = 0.01, scale = 1) {
    const half = scale * 0.5;
    const a = proj(cx - half, lift, z), b = proj(cx, lift, z - half), c = proj(cx + half, lift, z), d = proj(cx, lift, z + half);
    poly([a,b,c,d], colorWithAlpha(color, alpha));
  }
  function diamondPath(cx: number, z: number, half = 0.5, lift = 0.04) {
    return [proj(cx - half, lift, z), proj(cx, lift, z - half), proj(cx + half, lift, z), proj(cx, lift, z + half)];
  }
  function strokeDiamond(cx: number, z: number, half = 0.5, lift = 0.04) {
    const [a,b,c,d] = diamondPath(cx, z, half, lift);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.stroke();
  }
  function faceGradient(a: Pt, b: Pt, c: Pt, d: Pt, top: string, bottom: string) {
    const g = ctx.createLinearGradient((a.x+b.x)/2, (a.y+b.y)/2, (c.x+d.x)/2, (c.y+d.y)/2);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    return g;
  }
  function currentDayT() {
    const h = currentHour();
    return (h % 24) / 24;
  }
  function lightForTime() {
    const t = currentDayT();
    const sunUp = t > 0.22 && t < 0.80;
    const dayT = clamp((t - 0.22) / 0.58, 0, 1);
    const elev = sunUp ? Math.sin(dayT * Math.PI) : 0;
    const warmEdge = Math.max(0, 1 - elev / 0.42);
    const night = 1 - Math.min(1, elev * 1.7 + (sunUp ? 0.18 : 0));
    const tintRgb = sunUp ? mixRgb([1.02, 0.98, 0.90], [1.12, 0.78, 0.54], warmEdge) : [0.55, 0.64, 0.96];
    return {
      tint: tintRgb,
      top: 0.70 + 0.58 * elev,
      left: 0.50 + 0.34 * elev,
      right: 0.42 + 0.28 * elev,
      shadow: 0.10 + 0.22 * Math.max(0.35, elev),
      night,
      elev,
      dusk: warmEdge > 0.42 || night > 0.28,
      t,
    };
  }
  function currentHour() {
    try {
      const controls = ST.timeControls || { auto: true, hour: 12 };
      if (controls.auto === false) return Math.max(0, Math.min(23, Math.floor(Number(controls.hour ?? 12))));
      const dayMs = 20 * 60 * 1000;
      return Math.floor((((Date.now() % dayMs) + dayMs) % dayMs) / dayMs * 24);
    } catch { return 12; }
  }
  function weatherForTime(nowMs = performance.now()) {
    // Deterministic local weather cells: every area gets its own rolling
    // atmosphere, but it is render-only and never affects ECS movement/collision.
    const cx = Math.floor(Number(me.vx || me.x || 0) / 24);
    const cz = Math.floor(Number(me.vz || me.z || 0) / 24);
    const cell = Math.floor(nowMs / 90_000);
    const roll = stableRand(cx + cell * 7, cz - cell * 5, 911);
    const hour = currentHour();
    const night = hour < 5 || hour > 20;
    const rain = roll > 0.74 ? clamp((roll - 0.74) / 0.26, 0, 1) : 0;
    const breeze = 0.28 + stableRand(cx, cz, cell + 913) * 0.62;
    const windA = stableRand(cx, cz, cell + 914) * Math.PI * 2;
    return {
      rain,
      mist: clamp(rain * 0.55 + (night ? 0.10 : 0), 0, 0.72),
      windX: Math.cos(windA) * breeze,
      windZ: Math.sin(windA) * breeze,
      leafRate: rain > 0.45 ? 0.15 : 0.55 + breeze * 0.35,
      puddle: clamp(rain * 0.70 + (roll > 0.68 ? 0.16 : 0), 0, 0.80),
    };
  }
  function skyGradientStops() {
    const L = lightForTime();
    const t = L.t;
    if (L.night > 0.65) return { top: [8, 12, 28], mid: [18, 25, 52], bot: [24, 34, 56] };
    if (t < 0.30) return { top: [86, 108, 162], mid: [216, 142, 104], bot: [222, 192, 142] };
    if (t > 0.70) return { top: [76, 94, 156], mid: [236, 150, 94], bot: [226, 178, 116] };
    return { top: [108, 175, 228], mid: [166, 214, 220], bot: [207, 226, 184] };
  }
  function drawSkyBackdrop() {
    const L = lightForTime();
    const s = skyGradientStops();
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, rgbToCss(s.top));
    g.addColorStop(0.60, rgbToCss(s.mid));
    g.addColorStop(1, rgbToCss(s.bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    if (L.night > 0.08) {
      for (const st of skyStars) {
        const a = L.night * (0.38 + 0.62 * Math.abs(Math.sin(performance.now() / 900 + st.ph)));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(st.x * width, st.y * height, st.s, st.s);
      }
    }

    const sunT = clamp((L.t - 0.20) / 0.60, 0, 1);
    const sx = width * (0.08 + 0.84 * sunT);
    const sy = height * (0.82 - 0.62 * Math.max(0, L.elev));
    if (L.elev > 0.02) {
      const sun = mixRgb([255, 242, 178], [255, 151, 88], Math.max(0, 1 - L.elev / 0.50));
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 86 * visualZoom());
      rg.addColorStop(0, rgbToCss(sun, 0.82));
      rg.addColorStop(1, rgbToCss(sun, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(sx, sy, 86 * visualZoom(), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgbToCss(sun, 0.96); ctx.beginPath(); ctx.arc(sx, sy, 18 * visualZoom(), 0, Math.PI * 2); ctx.fill();
    } else {
      const mx = width * (0.20 + 0.58 * ((L.t + 0.20) % 1));
      const my = height * 0.18;
      ctx.fillStyle = "rgba(231,235,246,0.88)"; ctx.beginPath(); ctx.arc(mx, my, 15 * visualZoom(), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(19,25,50,0.88)"; ctx.beginPath(); ctx.arc(mx + 6 * visualZoom(), my - 4 * visualZoom(), 13 * visualZoom(), 0, Math.PI * 2); ctx.fill();
    }

    const cloudA = 0.18 + 0.46 * Math.max(0, L.elev);
    for (const c of skyClouds) {
      const t = (c.x + performance.now() / 100000 * c.spd) % 1.25;
      const cx = t * (width + 220) - 110;
      const cy = c.y * height;
      const cs = c.s * visualZoom();
      ctx.fillStyle = `rgba(255,255,255,${cloudA})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cs * 1.7, cs * 0.60, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + cs * 1.1, cy + cs * 0.08, cs * 1.0, cs * 0.48, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - cs * 1.1, cy + cs * 0.10, cs * 0.95, cs * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function roadFillForTime() {
    const L = lightForTime();
    return L.night > 0.45 ? "rgba(31,39,52,0.58)" : "rgba(70,82,70,0.34)";
  }
  function drawRoadStripX(x: number, z0: number, z1: number, widthCells: number) {
    const hw = widthCells / 2;
    const a = proj(x - hw, 0.026, z0), b = proj(x + hw, 0.026, z0), c = proj(x + hw, 0.026, z1), d = proj(x - hw, 0.026, z1);
    poly([a,b,c,d], roadFillForTime(), "rgba(255,255,255,0.030)");
    const mid0 = proj(x, 0.031, z0), mid1 = proj(x, 0.031, z1);
    ctx.strokeStyle = "rgba(255,231,165,0.12)";
    ctx.lineWidth = Math.max(0.6, visualZoom() * 0.75);
    ctx.setLineDash([Math.max(5, 7 * visualZoom()), Math.max(7, 9 * visualZoom())]);
    ctx.beginPath(); ctx.moveTo(mid0.x, mid0.y); ctx.lineTo(mid1.x, mid1.y); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawRoadStripZ(z: number, x0: number, x1: number, widthCells: number) {
    const hw = widthCells / 2;
    const a = proj(x0, 0.026, z - hw), b = proj(x1, 0.026, z - hw), c = proj(x1, 0.026, z + hw), d = proj(x0, 0.026, z + hw);
    poly([a,b,c,d], roadFillForTime(), "rgba(255,255,255,0.030)");
    const mid0 = proj(x0, 0.031, z), mid1 = proj(x1, 0.031, z);
    ctx.strokeStyle = "rgba(255,231,165,0.12)";
    ctx.lineWidth = Math.max(0.6, visualZoom() * 0.75);
    ctx.setLineDash([Math.max(5, 7 * visualZoom()), Math.max(7, 9 * visualZoom())]);
    ctx.beginPath(); ctx.moveTo(mid0.x, mid0.y); ctx.lineTo(mid1.x, mid1.y); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawCityRoads() {
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.round(me.vx || me.x), cz = Math.round(me.vz || me.z);
    const step = roadStep();
    const minX = Math.floor((cx - r - step) / step) * step;
    const maxX = Math.ceil((cx + r + step) / step) * step;
    const minZ = Math.floor((cz - r - step) / step) * step;
    const maxZ = Math.ceil((cz + r + step) / step) * step;
    ctx.save();
    for (let x = minX; x <= maxX; x += step) drawRoadStripX(x, minZ, maxZ, 1.35);
    for (let z = minZ; z <= maxZ; z += step) drawRoadStripZ(z, minX, maxX, 1.35);
    // Plaza diamonds at intersections give the grid an intentional city-plan feel.
    for (let x = minX; x <= maxX; x += step) for (let z = minZ; z <= maxZ; z += step) {
      const a = proj(x - 0.82, 0.033, z), b = proj(x, 0.033, z - 0.82), c = proj(x + 0.82, 0.033, z), d = proj(x, 0.033, z + 0.82);
      poly([a,b,c,d], lightForTime().night > 0.45 ? 'rgba(50,58,72,0.50)' : 'rgba(118,108,82,0.25)', 'rgba(255,255,255,0.035)');
    }
    ctx.restore();
  }
  function drawCityGrid() {
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.round(me.vx || me.x), cz = Math.round(me.vz || me.z);
    const step = cityGridStep;
    const half = step / 2;
    const baseX = Math.floor(cx / step) * step;
    const baseZ = Math.floor(cz / step) * step;
    const L = lightForTime();
    const lotAlpha = 0.040 + 0.038 * Math.max(0, L.elev);
    const majorAlpha = 0.110 + 0.070 * Math.max(0, L.elev);
    ctx.save();
    ctx.lineWidth = Math.max(0.65, 0.95 * visualZoom());
    // City planning grid decision: draw isometric diamond lots, not screen-space
    // rectangular lattice lines. Buildings and build ghosts reserve the same
    // 4x4 diamond footprint, so the grid now shares their ground plane and no
    // longer feels like a flat UI rectangle pasted under prism bases.
    for (let x = baseX - r - step; x <= baseX + r + step; x += step) {
      for (let z = baseZ - r - step; z <= baseZ + r + step; z += step) {
        if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > r + step) continue;
        const major = Math.abs(x % (step * 4)) === 0 && Math.abs(z % (step * 4)) === 0;
        ctx.strokeStyle = major ? `rgba(255,244,207,${majorAlpha})` : `rgba(255,255,255,${lotAlpha})`;
        strokeDiamond(x, z, half, 0.037);
        if (major && qualityName() !== "fast") {
          const p = proj(x, 0.041, z);
          ctx.fillStyle = `rgba(255,231,165,${majorAlpha * 0.34})`;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(1.2, tileW * 0.035), Math.max(0.8, tileH * 0.035), 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  function drawFaceWindows(f00: Pt, f10: Pt, f11: Pt, f01: Pt, cols: number, rows: number, seed: number, glow = true) {
    const bil = (u: number, v: number) => {
      const ax = f00.x + (f10.x - f00.x) * u, ay = f00.y + (f10.y - f00.y) * u;
      const bx = f01.x + (f11.x - f01.x) * u, by = f01.y + (f11.y - f01.y) * u;
      return { x: ax + (bx - ax) * v, y: ay + (by - ay) * v };
    };
    const L = lightForTime();
    const mu = 0.18, mv = 0.13;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const u0 = mu + (c + 0.22) * (1 - 2 * mu) / cols, u1 = mu + (c + 0.76) * (1 - 2 * mu) / cols;
      const v0 = mv + (r + 0.22) * (1 - 2 * mv) / rows, v1 = mv + (r + 0.72) * (1 - 2 * mv) / rows;
      const lit = glow && (L.night > 0.25 || L.dusk) && stableRand(seed + c, seed + r, 19) > 0.22;
      const col = lit ? `rgba(255,205,105,${0.70 + 0.22 * Math.sin(performance.now()/500 + seed + r + c)})` : `rgba(22,36,58,${0.28 + 0.18 * Math.max(0, L.elev)})`;
      poly([bil(u0, v0), bil(u1, v0), bil(u1, v1), bil(u0, v1)], col, lit ? "rgba(255,236,165,0.12)" : "");
    }
  }
  function drawPrismMin(x: number, z: number, y: number, w: number, d: number, h: number, top: string, left?: string, right?: string, alpha = 1, windows: any = null, seed = 0) {
    renderCounters.prismPartsDrawn++;
    const L = lightForTime();
    const x0 = x, z0 = z, y0 = y, x1 = x + w, z1 = z + d, y1 = y + h;
    const at = proj(x0,y1,z0), bt = proj(x1,y1,z0), ct = proj(x1,y1,z1), dt = proj(x0,y1,z1);
    const b0 = proj(x1,y0,z0), c0 = proj(x1,y0,z1), d0 = proj(x0,y0,z1);
    const topHex = cssHex(top, "#c79a45");
    const leftHex = cssHex(left || shadeHex(topHex, -0.22), shadeHex(topHex, -0.22));
    const rightHex = cssHex(right || shadeHex(topHex, -0.34), shadeHex(topHex, -0.34));
    const l1 = tint(leftHex, L.left * 1.10, L.tint), l2 = tint(leftHex, L.left * 0.72, L.tint);
    const r1 = tint(rightHex, L.right * 1.10, L.tint), r2 = tint(rightHex, L.right * 0.72, L.tint);
    poly([d0,c0,ct,dt], faceGradient(d0,c0,ct,dt,l1,l2) as any, `rgba(16,22,18,${0.20 * alpha})`);
    poly([c0,b0,bt,ct], faceGradient(c0,b0,bt,ct,r1,r2) as any, `rgba(10,15,13,${0.22 * alpha})`);
    poly([at,bt,ct,dt], tint(topHex, L.top, L.tint), `rgba(20,18,12,${0.18 * alpha})`);
    if (windows && h > 0.42) {
      const cols = Math.max(1, Math.min(8, Math.floor(Number(windows.cols || 2))));
      const rows = Math.max(1, Math.min(10, Math.floor(Number(windows.rows || Math.max(1, h * 2)))));
      const face = String(windows.face || "both");
      if (face === "both" || face === "left") drawFaceWindows(d0, c0, ct, dt, cols, rows, seed + 11, windows.glow !== false);
      if (face === "both" || face === "right") drawFaceWindows(c0, b0, bt, ct, cols, rows, seed + 29, windows.glow !== false);
    }
  }
  function drawRecipePart(originX: number, originZ: number, part: PrismRecipePart, scale: number, alpha = 1) {
    const w = part.w * scale, d = part.d * scale;
    const x = originX + part.x * scale - w / 2;
    const z = originZ + part.z * scale - d / 2;
    drawPrismMin(x, z, part.y * scale, w, d, part.h * scale, part.top, part.left, part.right, alpha, (part as any).windows, stableRand(originX, originZ, part.id.length) * 10000);
  }
  function drawResourcePart(originX: number, originZ: number, part: ResourcePrismPart, scale: number) {
    const w = part.w * scale, d = part.d * scale;
    const x = originX + part.ox * scale - w / 2;
    const z = originZ + part.oz * scale - d / 2;
    drawPrismMin(x, z, part.y * scale, w, d, part.h * scale, part.top, part.left, part.right);
  }
  function drawShadow(cx: number, z: number, rx = 0.8, ry = 0.42, alpha = 0.18) {
    renderCounters.shadowsDrawn++;
    const p = proj(cx + 0.13, 0.02, z + 0.10);
    const a = alpha * clamp(qualityBudget("shadowAlphaMul", 1), 0.35, 1.15);
    ctx.fillStyle = `rgba(6,12,10,${a})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * tileW, ry * tileH, 0, 0, Math.PI * 2); ctx.fill();
  }
  function terrainColor(x: number, z: number) {
    const owner = tileOwner.get(kfn(x,z));
    const biome = opts.biomeTerrainAt?.(x,z) || "grass";
    let base = biome === "sand" ? [116,96,54] : biome === "water" ? [38,80,82] : [43,82,62];
    if (owner) base = mixRgb(base, hexToRgb(numColorToHex(owner.body || owner.ownerBody || "#14f195", "#14f195")), 0.20);
    const r = stableRand(x,z,17) - 0.5;
    return rgbToCss([base[0] + r*5, base[1] + r*5, base[2] + r*5]);
  }
  function drawTerrain() {
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.round(me.x), cz = Math.round(me.z);
    const minX = cx - r, maxX = cx + r, minZ = cz - r, maxZ = cz + r;
    const detailStride = qualityStride("terrainDetailStride", 1);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      if (Math.max(Math.abs(x-cx), Math.abs(z-cz)) > r) continue;
      const skipFineDetail = detailStride > 1 && Math.abs(x * 31 + z * 17) % detailStride !== 0;
      const edge = 0.515;
      const a = proj(x - edge, 0, z), b = proj(x, 0, z - edge), c = proj(x + edge, 0, z), d = proj(x, 0, z + edge);
      poly([a,b,c,d], terrainColor(x,z), "");
      if (!skipFineDetail && stableRand(x,z,101) > 0.86) {
        const p = proj(x + (stableRand(x,z,4)-0.5)*0.42, 0.016, z + (stableRand(x,z,5)-0.5)*0.42);
        const w = (0.12 + stableRand(x,z,6)*0.22) * tileW;
        const h = (0.018 + stableRand(x,z,7)*0.030) * tileW;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate((stableRand(x,z,8)-0.5)*1.3); ctx.fillStyle = stableRand(x,z,9)>0.55 ? "rgba(177,156,104,0.10)" : "rgba(189,218,187,0.08)"; ctx.fillRect(-w/2,-h/2,w,h); ctx.restore();
      }
      renderCounters.terrainTilesDrawn++;
    }
    // Larger authored scuff sheets, deterministic around the player. These are
    // visible enough to kill the green void but quiet enough to avoid the old debug grid.
    const markStride = qualityStride("terrainDetailStride", 1);
    for (let i = 0; i < staticGroundMarks.length; i += markStride) {
      const m = staticGroundMarks[i];
      if (Math.max(Math.abs(m.x-cx), Math.abs(m.z-cz)) > r + 4) continue;
      const p = proj(m.x, 0.02, m.z);
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(m.a); ctx.fillStyle = m.c; ctx.fillRect(-m.w*tileW/2, -m.h*tileH/2, m.w*tileW, m.h*tileH); ctx.restore();
    }
  }
  function ensureGroundMarks() {
    if (staticGroundMarks.length >= minGroundMarks) return;
    for (let i = staticGroundMarks.length; i < minGroundMarks; i++) {
      const x = Math.floor((stableRand(i,7,2)-0.5)*140);
      const z = Math.floor((stableRand(i,11,3)-0.5)*140);
      staticGroundMarks.push({ x: x + stableRand(i,1,4)-0.5, z: z + stableRand(i,2,5)-0.5, w: 0.14 + stableRand(i,3,6)*0.42, h: 0.06 + stableRand(i,4,7)*0.18, a: (stableRand(i,5,8)-0.5)*1.4, c: stableRand(i,6,9)>0.55 ? "rgba(193,174,119,0.075)" : "rgba(173,212,185,0.055)" });
    }
  }
  function drawGroundWash() {
    const cx = Math.round(me.x), cz = Math.round(me.z);
    const r = opts.currentTileLoadRadius?.() || 36;
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    for (let i = 0; i < 46; i++) {
      const ox = Math.floor((stableRand(cx, cz, i + 400) - 0.5) * r * 2);
      const oz = Math.floor((stableRand(cx, cz, i + 700) - 0.5) * r * 2);
      const wx = cx + ox + stableRand(i, cx, 11) - 0.5;
      const wz = cz + oz + stableRand(i, cz, 12) - 0.5;
      const p = proj(wx, 0.018, wz);
      const rx = tileW * (1.8 + stableRand(i, 4, 8) * 3.2);
      const ry = tileH * (1.1 + stableRand(i, 5, 9) * 2.0);
      ctx.fillStyle = stableRand(i, 9, 3) > 0.5 ? "rgba(122,166,112,0.035)" : "rgba(202,176,112,0.030)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, ry, (stableRand(i, 6, 2) - 0.5) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }
  function visualFootprintForKind(kind: any) {
    const k = String(kind || "building").toLowerCase();
    if (k === "worldwonder") return 7.5;
    if (k === "keep" || k.includes("gate") || k === "watchtower" || k === "tower") return 5.8;
    if (k === "townhall" || k === "academy" || k === "bank" || k === "vault" || k === "warehouse") return 4.8;
    return 4.1;
  }
  function visualScaleForKind(kind: any) {
    const k = String(kind || "building").toLowerCase();
    if (k === "worldwonder") return 4.90;
    if (k === "keep" || k.includes("gate") || k === "watchtower") return 4.25;
    if (k === "tower" || k === "skyscraper" || k === "highrise") return 4.15;
    if (k === "townhall" || k === "academy" || k === "bank" || k === "vault" || k === "warehouse") return 3.75;
    if (k === "garden" || k === "flowerbed" || k === "bench" || k === "campfire") return 2.75;
    return 3.28;
  }
  function constructionStateFor(b: any) {
    const end = Number(b?.constructUntil || b?.cdUntil || b?.buildUntil || b?.finishAt || 0);
    const start = Number(b?.constructAt || b?.accAt || b?.buildAt || b?.startedAt || 0);
    if (!end || end <= Date.now()) return null;
    const safeStart = start && start < end ? start : Date.now() - Math.max(1, Number(b?.buildProgress || 0)) * (end - Date.now());
    const total = Math.max(1, end - safeStart);
    const progress = clamp((Date.now() - safeStart) / total, 0.03, 0.98);
    return { start: safeStart, end, total, left: Math.max(0, end - Date.now()), progress };
  }
  function visualProgressForBuilding(b: any) {
    const c = constructionStateFor(b);
    if (c) return c.progress;
    if (b?.buildProgress != null) return clamp(Number(b.buildProgress) || 1, 0.05, 1);
    return 1;
  }
  function buildingDistanceFromPlayer(b: any) {
    return Math.max(Math.abs(Number(b?.x || 0) - Number(me.vx || me.x || 0)), Math.abs(Number(b?.z || 0) - Number(me.vz || me.z || 0)));
  }
  function maxRecipePartsForBuilding(kind: string, dist: number, recipeLen: number) {
    const base = Math.max(4, Math.trunc(qualityBudget("maxPrismPartsPerBuilding", recipeLen)));
    const q = qualityName();
    if (String(kind).toLowerCase() === "worldwonder") return Math.max(base, q === "fast" ? 32 : q === "balanced" ? 54 : 96);
    if (dist > 32) return Math.max(6, Math.min(base, 12));
    if (dist > 22) return Math.max(10, Math.min(base, 20));
    return base;
  }
  function drawConstructionOverlay(b: any, c: any, fp: number, scale: number) {
    if (!c) return;
    const fx = clamp(qualityBudget("constructionFx", 1), 0, 1);
    if (fx <= 0.05) return;
    renderCounters.constructionVisuals++;
    const x = Number(b.x || 0), z = Number(b.z || 0);
    const color = String(b.kind || "") === "worldwonder" ? "#9945ff" : "#ffd76e";
    const half = Math.max(0.75, fp * 0.20);
    const t = performance.now() / 1000;
    const pulse = 0.78 + Math.sin(t * 3.2 + x + z) * 0.18;
    drawTargetRing(x, z, color, Math.max(0.92, fp * 0.18 + c.progress * 0.18), 0.10, 0.40 * fx * pulse);
    ctx.save();
    ctx.lineWidth = Math.max(1, 1.3 * visualZoom());
    ctx.strokeStyle = `rgba(255,231,165,${0.26 * fx})`;
    const posts = [
      [x - half, z - half], [x + half, z - half], [x + half, z + half], [x - half, z + half]
    ];
    for (const [px, pz] of posts) {
      const a = proj(px, 0.12, pz), b2 = proj(px, 1.25 + c.progress * scale * 0.30, pz);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
    }
    for (let i = 0; i < posts.length; i++) {
      const a = posts[i], b2 = posts[(i + 1) % posts.length];
      const p0 = proj(a[0], 0.82 + c.progress * 0.35, a[1]);
      const p1 = proj(b2[0], 0.82 + c.progress * 0.35, b2[1]);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    const p = proj(x, 2.12 + c.progress * Math.min(2.0, scale * 0.20), z);
    const bw = Math.max(42, 58 * visualZoom()), bh = Math.max(4, 5 * visualZoom());
    ctx.fillStyle = "rgba(8,12,18,0.72)"; ctx.fillRect(p.x - bw/2, p.y, bw, bh);
    ctx.fillStyle = color; ctx.fillRect(p.x - bw/2, p.y, bw * c.progress, bh);
    ctx.font = `900 ${Math.max(9, 10 * visualZoom())}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.lineWidth = Math.max(2, 3 * visualZoom());
    ctx.strokeStyle = "rgba(9,12,18,0.72)"; ctx.fillStyle = "rgba(255,240,184,0.94)";
    const label = `${Math.round(c.progress * 100)}% building`;
    ctx.strokeText(label, p.x, p.y - 6 * visualZoom()); ctx.fillText(label, p.x, p.y - 6 * visualZoom());
    renderCounters.labelsDrawn++;
    ctx.restore();
  }
  function drawWonderAura(b: any, c: any) {
    if (String(b?.kind || b?.type || "").toLowerCase() !== "worldwonder") return;
    const density = clamp(qualityBudget("wonderAuraDensity", 1), 0, 1);
    if (density <= 0.03) return;
    renderCounters.influenceAuras++;
    const x = Number(b.x || 0), z = Number(b.z || 0);
    const progress = c ? c.progress : 1;
    const t = performance.now() / 1000;
    const r = (2.2 + 2.1 * progress) * (0.92 + 0.04 * Math.sin(t * 1.5));
    const p = proj(x, 0.055, z);
    ctx.save();
    const aura = ctx.createRadialGradient(p.x, p.y, tileW * 0.22, p.x, p.y, tileW * r);
    const alpha = clamp(qualityBudget("influenceTintAlpha", 0.08), 0.02, 0.16) * density * (c ? 0.68 : 1);
    aura.addColorStop(0, `rgba(153,69,255,${alpha * 1.15})`);
    aura.addColorStop(0.55, `rgba(20,241,149,${alpha * 0.62})`);
    aura.addColorStop(1, "rgba(20,241,149,0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, tileW * r, tileH * r * 0.66, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,215,110,${(0.18 + 0.12 * Math.sin(t * 2.2)) * density})`;
    ctx.lineWidth = Math.max(1, 1.2 * visualZoom());
    ctx.beginPath(); ctx.ellipse(p.x, p.y, tileW * (r * 0.72), tileH * (r * 0.45), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawBuildFootprint(x: number, z: number, color = "#ffd76e", alpha = 0.22) {
    const half = visualCityFootprint / 2;
    ctx.save();
    ctx.fillStyle = `${color}${Math.round(255 * alpha).toString(16).padStart(2, "0")}`;
    ctx.strokeStyle = `${color}${Math.round(255 * (alpha + 0.30)).toString(16).padStart(2, "0")}`;
    ctx.lineWidth = Math.max(1.1, 1.4 * visualZoom());
    const a = proj(x - half, 0.060, z);
    const b = proj(x, 0.060, z - half);
    const c = proj(x + half, 0.060, z);
    const d = proj(x, 0.060, z + half);
    poly([a,b,c,d], ctx.fillStyle as any, ctx.strokeStyle as any);

    // Interior 4x4 lot tiles make placement read as an intentional city-builder
    // footprint without tying the character animation to grid snapping.
    const startX = Math.floor(x - half + 0.5);
    const startZ = Math.floor(z - half + 0.5);
    ctx.strokeStyle = `${color}${Math.round(255 * Math.min(0.72, alpha + 0.20)).toString(16).padStart(2, "0")}`;
    ctx.lineWidth = Math.max(0.55, 0.75 * visualZoom());
    for (let ix = 0; ix < visualCityFootprint; ix++) for (let iz = 0; iz < visualCityFootprint; iz++) {
      const tx = startX + ix, tz = startZ + iz;
      const da = proj(tx - 0.48, 0.066, tz), db = proj(tx, 0.066, tz - 0.48), dc = proj(tx + 0.48, 0.066, tz), dd = proj(tx, 0.066, tz + 0.48);
      ctx.beginPath(); ctx.moveTo(da.x, da.y); ctx.lineTo(db.x, db.y); ctx.lineTo(dc.x, dc.y); ctx.lineTo(dd.x, dd.y); ctx.closePath(); ctx.stroke();
    }
    const label = proj(x, 0.18, z - 2.55);
    ctx.font = `900 ${Math.max(10, 11 * visualZoom())}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(2, 3 * visualZoom());
    ctx.strokeStyle = 'rgba(18,22,30,0.72)';
    ctx.fillStyle = `${color}${Math.round(255 * Math.min(0.95, alpha + 0.38)).toString(16).padStart(2,'0')}`;
    ctx.strokeText('4×4 CITY LOT', label.x, label.y);
    ctx.fillText('4×4 CITY LOT', label.x, label.y);
    ctx.restore();
  }
  function cachedSpriteCanvas(cssW: number, cssH: number) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(cssW * dpr));
    c.height = Math.max(1, Math.ceil(cssH * dpr));
    const cctx = c.getContext("2d", { alpha: true })!;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { canvas: c, ctx: cctx, cssW, cssH };
  }
  function withSpriteProjection<T>(sctx: CanvasRenderingContext2D, anchorX: number, anchorY: number, fn: () => T): T {
    const prevCtx = ctx, prevX = cameraX, prevY = cameraY;
    ctx = sctx; cameraX = anchorX; cameraY = anchorY;
    try { return fn(); } finally { ctx = prevCtx; cameraX = prevX; cameraY = prevY; }
  }
  function buildingSpriteKey(kind: string, color: string, scale: number, fp: number, maxParts: number) {
    return ["b", kind, color, qualityName(), spriteTimeBand(), spriteZoomBucket(), spriteDprBucket(), Math.round(scale * 20), Math.round(fp * 20), maxParts, spriteCacheSerial].join("|");
  }
  function resourceSpriteKey(kind: string, scale: number) {
    return ["r", kind, qualityName(), spriteTimeBand(), spriteZoomBucket(), spriteDprBucket(), Math.round(scale * 20), spriteCacheSerial].join("|");
  }
  function canSpriteBuilding(kind: string, b: any, construction: any) {
    if (construction) return false;
    if (kind === "worldwonder") return false;
    // Keep active/conflict objects live so future damage/raid overlays can layer
    // with exact depth and timing. Normal completed buildings are the hot path.
    if (kind === "keep" || kind === "bomb" || kind.includes("gate")) return false;
    if (b?.hp != null && b?.maxHp != null && Number(b.hp) < Number(b.maxHp)) return false;
    return true;
  }
  function getBuildingSprite(kind: string, color: string, recipe: any[], scale: number, fp: number, maxParts: number) {
    const key = buildingSpriteKey(kind, color, scale, fp, maxParts);
    const hit = buildingSpriteCache.get(key);
    if (hit) { hit.lastUsed = performance.now(); renderCounters.spriteCacheHits++; return hit; }
    renderCounters.spriteCacheMisses++;
    const cssW = Math.max(96, tileW * (fp + scale * 2.4 + 3.5));
    const cssH = Math.max(96, tileH * (fp + 4) + heightScale * (scale + 2.2));
    const anchorX = cssW / 2;
    const anchorY = cssH * 0.66;
    const spr = cachedSpriteCanvas(cssW, cssH);
    withSpriteProjection(spr.ctx, anchorX, anchorY, () => {
      spr.ctx.clearRect(0, 0, cssW, cssH);
      drawShadow(0, 0, 0.36 * fp, 0.17 * fp, lightForTime().shadow * 0.95);
      for (const part of recipe) drawRecipePart(0, 0, part, scale);
    });
    const out = { ...spr, anchorX, anchorY, lastUsed: performance.now() };
    buildingSpriteCache.set(key, out);
    evictOldestSprite(buildingSpriteCache, MAX_BUILDING_SPRITES);
    return out;
  }
  function drawBuildingSprite(kind: string, b: any, color: string, recipe: any[], scale: number, fp: number, maxParts: number) {
    const spr = getBuildingSprite(kind, color, recipe, scale, fp, maxParts);
    const p = proj(Number(b.x || 0), 0, Number(b.z || 0));
    ctx.drawImage(spr.canvas, p.x - spr.anchorX, p.y - spr.anchorY, spr.cssW, spr.cssH);
    spr.lastUsed = performance.now();
    renderCounters.spriteDraws++;
  }
  function getResourceSprite(kind: string, scale: number) {
    const key = resourceSpriteKey(kind, scale);
    const hit = resourceSpriteCache.get(key);
    if (hit) { hit.lastUsed = performance.now(); renderCounters.spriteCacheHits++; return hit; }
    renderCounters.spriteCacheMisses++;
    const cssW = Math.max(72, tileW * (scale + 2.9));
    const cssH = Math.max(78, tileH * 4 + heightScale * (scale + 1.6));
    const anchorX = cssW / 2;
    const anchorY = cssH * 0.68;
    const spr = cachedSpriteCanvas(cssW, cssH);
    withSpriteProjection(spr.ctx, anchorX, anchorY, () => {
      spr.ctx.clearRect(0, 0, cssW, cssH);
      drawShadow(0, 0, 0.52 * scale, 0.24 * scale, 0.16);
      for (const part of resourceRecipeFor(kind, 0)) drawResourcePart(0, 0, part, scale);
    });
    const out = { ...spr, anchorX, anchorY, lastUsed: performance.now() };
    resourceSpriteCache.set(key, out);
    evictOldestSprite(resourceSpriteCache, MAX_RESOURCE_SPRITES);
    return out;
  }
  function drawResourceSprite(kind: string, x: number, z: number, scale: number) {
    const spr = getResourceSprite(kind, scale);
    const p = proj(x, 0, z);
    ctx.drawImage(spr.canvas, p.x - spr.anchorX, p.y - spr.anchorY, spr.cssW, spr.cssH);
    spr.lastUsed = performance.now();
    renderCounters.spriteDraws++;
  }

  function drawBuilding(b: any) {
    const kind = String(b.kind || b.type || "building").toLowerCase();
    const progress = visualProgressForBuilding(b);
    const construction = constructionStateFor(b);
    let recipe = recipeVisibleParts(buildingRecipeFor(kind, { color: cssHex(b.cl || b.color || "#d6604f"), plinth: "#8f7b53", name: b.nm || b.name, buildProgress: progress }), progress);
    const scale = visualScaleForKind(kind);
    const ox = Number(b.x || 0), oz = Number(b.z || 0);
    const fp = visualFootprintForKind(kind);
    const dist = buildingDistanceFromPlayer(b);
    const maxParts = maxRecipePartsForBuilding(kind, dist, recipe.length);
    if (recipe.length > maxParts) recipe = recipe.slice(0, maxParts);
    drawWonderAura(b, construction);
    drawShadow(ox, oz, 0.36 * fp, 0.17 * fp, lightForTime().shadow * 0.95);
    if (construction) {
      ctx.save();
      ctx.globalAlpha = 0.38 + 0.52 * progress;
      for (const part of recipe) drawRecipePart(ox, oz, part, scale);
      ctx.globalAlpha = 1;
      ctx.restore();
      drawConstructionOverlay(b, construction, fp, scale);
    } else {
      if (canSpriteBuilding(kind, b, construction)) drawBuildingSprite(kind, b, cssHex(b.cl || b.color || "#d6604f"), recipe, scale, fp, maxParts);
      else for (const part of recipe) drawRecipePart(ox, oz, part, scale);
      if (kind === "worldwonder") {
        const p = proj(ox, 3.65, oz);
        const name = String(b.nm || b.name || "Wonder").slice(0, 28);
        ctx.save();
        ctx.font = `900 ${Math.max(10, 11 * visualZoom())}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = Math.max(2, 3 * visualZoom());
        ctx.strokeStyle = "rgba(8,10,18,0.72)"; ctx.fillStyle = "#fff0a8";
        ctx.strokeText(name, p.x, p.y); ctx.fillText(name, p.x, p.y);
        renderCounters.labelsDrawn++;
        ctx.restore();
      }
    }
  }
  function drawDoodad(d: any) {
    const kind = String(d.type || d.kind || "tree").toLowerCase();
    const scale = kind === "rock" ? 2.05 : kind === "food" ? 1.70 : 2.10;
    // Resource bodies are identical by kind at a given quality/time/zoom. Cache
    // them as sprites but keep harvest pulses, loot, and target rings live.
    drawResourceSprite(kind, Number(d.x||0), Number(d.z||0), scale);
  }
  function drawPlayerSprite(ply: any, isMe = false) {
    const x = isMe ? visualX(me) : remoteVisualX(ply);
    const z = isMe ? visualZ(me) : remoteVisualZ(ply);
    drawShadow(x, z, isMe ? 0.44 : 0.34, isMe ? 0.23 : 0.18, isMe ? 0.22 : 0.16);
    const speed = isMe ? Math.min(1.4, Number(me.renderSpeed || 0)) : Math.min(1.15, Number(ply.__renderSpeed || 0));
    const phase = isMe ? Number(me.walkPhase || 0) : Number(ply.__walkPhase || 0);
    const bob = speed > 0.05 ? Math.sin(phase) * (1.1 + speed * 2.0) * visualZoom() : 0;
    const p = proj(x, 0, z);
    const sc = visualZoom() * (isMe ? 1.42 : 1.12);
    ctx.save(); ctx.translate(p.x, p.y - 24*sc + bob); ctx.scale(sc, sc);
    const body = numColorToHex(ply.body || ply.color || 0x14f195, "#14f195");
    const hat = numColorToHex(ply.hat || 0x7dcfe8, "#7dcfe8");
    const sway = speed > 0.05 ? Math.sin(phase * 1.25) * (0.8 + speed * 1.8) : 0;
    ctx.fillStyle = "#f4d7b5"; ctx.beginPath(); ctx.arc(0,-16,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = hat; ctx.beginPath(); ctx.arc(0,-20,9,Math.PI,Math.PI*2); ctx.fill(); ctx.fillRect(-9,-20,18,4);
    ctx.fillStyle = tint(body, 1.04, [1,1,1]) as string; ctx.beginPath(); ctx.roundRect(-8,-8,16,22,5); ctx.fill();
    ctx.fillStyle = "#f4d7b5"; ctx.fillRect(-13 - sway,-5,5,16); ctx.fillRect(8 + sway,-5,5,16);
    ctx.fillStyle = "#38251b";
    const leg = isMe && speed > 0.05 ? Math.sin(me.walkPhase * 1.4) * (1.2 + speed * 2.2) : 0;
    ctx.fillRect(-6 + leg,14,5,6); ctx.fillRect(2 - leg,14,5,6);
    ctx.fillStyle = "#2b211d"; ctx.beginPath(); ctx.arc(-3,-16,1.2,0,Math.PI*2); ctx.arc(4,-16,1.2,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#7a4135"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(1,-13,3,0.15,Math.PI-0.15); ctx.stroke();
    if (isMe) drawHeldToolOverlay(sc);
    ctx.restore();
    const label = String(ply.name || (isMe ? 'You' : '') || '').slice(0, 18);
    if (label && (isMe || visualZoom() > 0.82)) {
      const lp = proj(x, isMe ? 1.34 : 1.20, z);
      ctx.save();
      ctx.font = `900 ${Math.max(9, 10 * visualZoom())}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(2, 3 * visualZoom());
      ctx.strokeStyle = 'rgba(7,10,14,0.72)';
      ctx.fillStyle = isMe ? '#fff0a8' : 'rgba(225,236,247,0.92)';
      ctx.strokeText(label, lp.x, lp.y);
      ctx.fillText(label, lp.x, lp.y);
      renderCounters.labelsDrawn++;
      ctx.restore();
    }
  }
  function drawHeldToolOverlay(sc: number) {
    const tool = String(ST?.tool || ST?.mode || "").toLowerCase();
    if (!tool || tool === "none" || tool === "explore") return;
    ctx.save();
    ctx.lineWidth = Math.max(1.2, 1.7 * sc);
    ctx.lineCap = "round";
    if (/axe|chop|tree/.test(tool)) {
      ctx.strokeStyle = "rgba(92,56,32,0.96)"; ctx.beginPath(); ctx.moveTo(8*sc,-18*sc); ctx.lineTo(15*sc,-33*sc); ctx.stroke();
      ctx.fillStyle = "rgba(205,216,218,0.96)"; ctx.beginPath(); ctx.ellipse(16*sc,-34*sc,4*sc,2.4*sc,-0.5,0,Math.PI*2); ctx.fill();
    } else if (/pick|mine|rock/.test(tool)) {
      ctx.strokeStyle = "rgba(92,56,32,0.96)"; ctx.beginPath(); ctx.moveTo(8*sc,-18*sc); ctx.lineTo(17*sc,-31*sc); ctx.stroke();
      ctx.strokeStyle = "rgba(205,216,218,0.96)"; ctx.beginPath(); ctx.moveTo(10*sc,-34*sc); ctx.lineTo(22*sc,-29*sc); ctx.stroke();
    } else if (/build|hammer/.test(tool)) {
      ctx.strokeStyle = "rgba(92,56,32,0.96)"; ctx.beginPath(); ctx.moveTo(8*sc,-18*sc); ctx.lineTo(14*sc,-29*sc); ctx.stroke();
      ctx.fillStyle = "rgba(180,164,138,0.98)"; ctx.fillRect(11*sc, -32*sc, 9*sc, 4*sc);
    } else if (/capture/.test(tool)) {
      ctx.strokeStyle = "rgba(215,223,207,0.96)"; ctx.beginPath(); ctx.moveTo(9*sc,-14*sc); ctx.lineTo(9*sc,-34*sc); ctx.stroke();
      ctx.fillStyle = "rgba(20,241,149,0.92)"; ctx.beginPath(); ctx.moveTo(10*sc,-34*sc); ctx.lineTo(23*sc,-30*sc); ctx.lineTo(10*sc,-26*sc); ctx.closePath(); ctx.fill();
    } else if (/sword|combat|attack/.test(tool)) {
      ctx.strokeStyle = "rgba(220,230,236,0.98)"; ctx.beginPath(); ctx.moveTo(8*sc,-15*sc); ctx.lineTo(19*sc,-31*sc); ctx.stroke();
      ctx.strokeStyle = "rgba(255,215,110,0.98)"; ctx.beginPath(); ctx.moveTo(11*sc,-19*sc); ctx.lineTo(16*sc,-16*sc); ctx.stroke();
    }
    ctx.restore();
  }

  function drawLoot(l: any) {
    const x = Number(l.x || 0), z = Number(l.z || 0);
    drawShadow(x, z, 0.20, 0.10, 0.14);
    drawPrismMin(x-0.12,z-0.12,0.02,0.24,0.24,0.12,"#ffd76e","#a77a22","#705018");
  }
  function drawTradePost(t: any) {
    const x = Number(t.x || 0), z = Number(t.z || 0);
    drawShadow(x, z, 0.92, 0.42, 0.16);
    drawPrismMin(x - 0.58, z - 0.58, 0.02, 1.16, 1.16, 0.16, "#7c6742", "#4d3e2a", "#372b1f");
    drawPrismMin(x - 0.46, z - 0.42, 0.18, 0.92, 0.74, 0.72, "#c9a27d", "#8f6952", "#6b4b3f");
    drawPrismMin(x - 0.62, z - 0.54, 0.86, 1.24, 1.08, 0.18, "#d9aa4f", "#9b7438", "#74512c");
    drawPrismMin(x - 0.08, z - 0.74, 0.20, 0.16, 0.22, 0.82, "#22405f", "#1a2c40", "#132131");
    const p = proj(x, 1.18, z - 0.92);
    ctx.fillStyle = "rgba(255,215,110,0.88)";
    ctx.font = `900 ${Math.max(9, 10 * visualZoom())}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("trade", p.x, p.y);
    renderCounters.labelsDrawn++;
  }
  function drawNpc(n: any) {
    const row = {
      id: n.id || `npc:${n.x},${n.z}`,
      x: Number(n.x || 0),
      z: Number(n.z || 0),
      body: n.body || n.color || 0xceb443,
      hat: n.hat || 0x7dcfe8,
      name: n.name || n.nm || "Wanderer",
    };
    drawPlayerSprite(row, false);
    const p = proj(row.x, 1.26, row.z);
    ctx.fillStyle = "rgba(255,240,180,0.90)";
    ctx.font = `900 ${Math.max(10, 11 * visualZoom())}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("?", p.x, p.y);
    renderCounters.labelsDrawn++;
  }
  function drawTargetRing(x: number, z: number, color = "#ffd76e", radius = 0.72, y = 0.07, alpha = 0.78) {
    const p = proj(Number(x), Number(y), Number(z));
    ctx.save();
    ctx.strokeStyle = `${color}${Math.round(255 * alpha).toString(16).padStart(2,"0")}`;
    ctx.lineWidth = Math.max(1.6, 2.2 * visualZoom());
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius * tileW, radius * tileH * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  function drawHoverTargetAffordance() {
    if (!lastPickTarget || performance.now() - lastPickAt > 1800) return;
    const p = lastPickTarget;
    if (p.primary === "terrain" || !p.cell) return;
    const color = p.primary === "building" ? "#ffd76e" : p.primary === "doodad" ? "#8ee68d" : p.primary === "player" ? "#7dcfe8" : p.primary === "npc" ? "#ceb443" : "#d7dfcf";
    const radius = p.primary === "building" ? 1.22 : p.primary === "doodad" ? 0.86 : 0.62;
    drawTargetRing(p.cell.x, p.cell.z, color, radius, 0.09, 0.62);
  }
  function drawInteractionTooltip() {
    if (!lastPickTarget || performance.now() - lastPickAt > 1400 || !lastPickTarget.cell) return;
    const p = lastPickTarget;
    if (p.primary === 'terrain') return;
    const label = p.primary === 'building' ? 'Inspect / use' : p.primary === 'doodad' ? 'E harvest' : p.primary === 'trade' ? 'Trade' : p.primary === 'npc' ? 'Talk' : p.primary === 'player' ? 'Player' : '';
    if (!label) return;
    const sp = proj(Number(p.cell.x || 0), p.primary === 'building' ? 2.25 : 1.25, Number(p.cell.z || 0));
    const padX = 7 * visualZoom();
    ctx.save();
    ctx.font = `900 ${Math.max(10, 11 * visualZoom())}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(label).width + padX * 2;
    const h = 18 * visualZoom();
    ctx.fillStyle = 'rgba(18,26,38,0.78)';
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = Math.max(1, visualZoom());
    ctx.beginPath(); ctx.roundRect(sp.x - w/2, sp.y - h/2, w, h, 8 * visualZoom()); ctx.fill(); ctx.stroke();
    ctx.fillStyle = p.primary === 'doodad' ? '#9df38f' : p.primary === 'building' ? '#ffd76e' : '#d7dfcf';
    ctx.fillText(label, sp.x, sp.y + 0.5);
    renderCounters.labelsDrawn++;
    ctx.restore();
  }
  function drawGhostBuildingPreview() {
    if (!ghost) return false;
    const placing = String(ST?.placing || ST?.tool || "cottage").toLowerCase();
    const valid = ghost.valid !== false;
    const color = valid ? "#ffd76e" : "#d6604f";
    const kind = placing && placing !== "build" && placing !== "none" ? placing : "cottage";
    const scale = visualScaleForKind(kind) * 0.94;
    const recipe = recipeVisibleParts(buildingRecipeFor(kind, { color, plinth: valid ? "#9a855a" : "#6f3a32", buildProgress: 1 }), 1);
    ctx.save();
    ctx.globalAlpha = valid ? 0.48 : 0.36;
    drawBuildFootprint(ghost.x, ghost.z, color, valid ? 0.20 : 0.28);
    drawShadow(ghost.x, ghost.z, 0.60 * scale, 0.30 * scale, valid ? 0.12 : 0.18);
    for (const part of recipe) drawRecipePart(ghost.x, ghost.z, part, scale, valid ? 0.54 : 0.42);
    ctx.globalAlpha = 1;
    drawTargetRing(ghost.x, ghost.z, color, 0.88, 0.12, valid ? 0.72 : 0.88);
    ctx.restore();
    return true;
  }
  function drawOverlayCells() {
    for (const h of hintCells || []) {
      const color = numColorToHex(h.color, "#14f195");
      const a = proj(h.x - 0.5, 0.035, h.z), b = proj(h.x, 0.035, h.z - 0.5), c = proj(h.x + 0.5, 0.035, h.z), d = proj(h.x, 0.035, h.z + 0.5);
      poly([a,b,c,d], `${color}${Math.round(255 * Number(h.opacity || 0.2)).toString(16).padStart(2,"0")}`, "rgba(255,255,255,0.18)");
    }
    if (hoverMarker.visible) {
      const color = hoverMarker.material?.color?._hex || "#14f195";
      const x = hoverMarker.position.x, z = hoverMarker.position.z;
      const a = proj(x - 0.5, 0.045, z), b = proj(x, 0.045, z - 0.5), c = proj(x + 0.5, 0.045, z), d = proj(x, 0.045, z + 0.5);
      poly([a,b,c,d], `${color}28`, `${color}aa`);
    }
    if (ghost && !drawGhostBuildingPreview()) {
      const color = ghost.valid ? "#ffd76e" : "#d6604f";
      const x = ghost.x, z = ghost.z;
      const a = proj(x - 0.55, 0.05, z), b = proj(x, 0.05, z - 0.55), c = proj(x + 0.55, 0.05, z), d = proj(x, 0.05, z + 0.55);
      poly([a,b,c,d], `${color}33`, `${color}cc`);
    }
    drawHoverTargetAffordance();
    drawInteractionTooltip();
  }
  function drawChannelHint() {
    const ch = ST?.channel;
    if (!ch) return;
    const x = Number(ch.x), z = Number(ch.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    const total = Math.max(1, Number(ch.ms || 1200));
    const left = Number(ch.until || 0) - performance.now();
    const pct = clamp(1 - left / total, 0, 1);
    const kind = String(ch.kind || "").toLowerCase();
    const color = kind === "tree" ? "#7bd66f" : kind === "rock" ? "#cbd5df" : kind === "food" ? "#ffd76e" : kind === "combat" ? "#d6604f" : "#ffd76e";
    const p = proj(x, 0.08, z);
    const rx = tileW * 0.62, ry = tileH * 0.42;
    ctx.save();
    ctx.lineWidth = Math.max(2, 2.4 * visualZoom());
    ctx.strokeStyle = `${color}66`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `${color}dd`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, -Math.PI/2, -Math.PI/2 + Math.PI * 2 * pct); ctx.stroke();
    const barW = Math.max(34, 48 * visualZoom()), barH = Math.max(4, 5 * visualZoom());
    const by = p.y - 30 * visualZoom();
    ctx.fillStyle = "rgba(8,12,18,0.70)"; ctx.fillRect(p.x - barW/2, by, barW, barH);
    ctx.fillStyle = color; ctx.fillRect(p.x - barW/2, by, barW * pct, barH);
    ctx.restore();
  }

  function drawPendingPathHints() {
    if (!pendingPath.length) return;
    const maxDots = Math.min(14, pendingPath.length);
    ctx.save();
    for (let i = 0; i < maxDots; i++) {
      const step = pendingPath[i];
      const p = proj(step.x, 0.075, step.z);
      const a = 0.42 * (1 - i / Math.max(2, maxDots + 1));
      ctx.fillStyle = `rgba(255,215,110,${a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, Math.max(2, tileW * 0.055), Math.max(1.2, tileH * 0.045), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function rebuildCells(force = false) {
    const r = opts.currentTileLoadRadius?.() || 36;
    const cx = Math.round(me.x), cz = Math.round(me.z);
    if (!force && lastVisibleCenter.r === r && Math.max(Math.abs(cx-lastVisibleCenter.x), Math.abs(cz-lastVisibleCenter.z)) <= 6) return;
    cells.clear();
    tradePostPool.clear();
    npcPool.clear();
    // Procedural resources are viewport-local cache entries. They are regenerated
    // from the shared deterministic naturalDoodad() rule on each window rebuild.
    for (const [kk, d] of Array.from(doodads.entries())) if (d?.natural) doodads.delete(kk);
    lastVisibleCenter = { x: cx, z: cz, r };
    for (let x = cx-r; x <= cx+r; x++) for (let z = cz-r; z <= cz+r; z++) {
      if (Math.max(Math.abs(x-cx), Math.abs(z-cz)) > r) continue;
      const kk = kfn(x,z);
      cells.set(kk, { cx: x, cz: z, owner: tileOwner.get(kk)?.owner || 0 });
      if (!doodads.has(kk) && !buildAt.has(kk) && exceptions.get(kk) !== "gone") {
        const nd = normalizeDoodadKind(opts.naturalDoodad?.(x, z));
        if (nd) doodads.set(kk, { x, z, type: nd, kind: nd, natural: true });
      }
      try {
        const trade = opts.tradePostAt?.(x, z);
        if (trade) tradePostPool.set(kk, { ...trade, x, z, kind: "tradepost", uid: `trade:${kk}` });
      } catch {}
      try {
        const npc = opts.proceduralNpcAt?.(x, z);
        if (npc) npcPool.set(kk, { ...npc, x, z, kind: "npc", uid: `npc:${kk}` });
      } catch {}
    }
    if (force) invalidateStatic("window");
  }
  function staticCameraSnapPx() {
    return Math.max(1, Math.trunc(qualityBudget("staticCameraSnapPx", 2)));
  }
  function staticLayerKey() {
    const snap = staticCameraSnapPx();
    // Coarse hour band is deliberate: lighting should change mood over time,
    // but not dirty the cached terrain every animation frame. Dynamic entities
    // still get current light each draw.
    const hourBand = Math.floor(currentHour() / 2);
    return [
      width, height, dpr.toFixed(2), qualityName(), hourBand,
      Math.round(cameraX / snap), Math.round(cameraY / snap),
      opts.currentTileLoadRadius?.() || 36,
      Number(ST.rev || 0), tileOwner.size, cells.size,
    ].join("|");
  }
  function renderStaticLayerToCache(nextKey: string) {
    const prev = ctx;
    const started = performance.now();
    ctx = staticCtx;
    staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    staticCtx.clearRect(0, 0, width, height);
    drawTerrain();
    drawGroundWash();
    drawCityRoads();
    drawCityGrid();
    drawCityFurniture();
    ctx = prev;
    staticCacheKey = nextKey;
    staticDirty = false;
    renderCounters.staticCacheMisses++;
    renderCounters.staticRebuildMs = performance.now() - started;
  }
  function drawStaticLayer() {
    const key = staticLayerKey();
    if (staticDirty || key !== staticCacheKey) renderStaticLayerToCache(key);
    else renderCounters.staticCacheHits++;
    ctx.drawImage(staticCanvas, 0, 0, width, height);
  }

  function draw() {
    renderCounters.reset();
    const dynamicStarted = performance.now();
    resize(); updateProjection(); ensureGroundMarks();
    ctx = screenCtx;
    const cx = Number(me.vx || me.x || 0), cz = Number(me.vz || me.z || 0);
    targetCameraX = width / 2 - (cx - cz) * tileW;
    targetCameraY = height * 0.55 - (cx + cz) * tileH;
    const cameraA = smoothAmount(renderDtMs, 7.5);
    cameraX += (targetCameraX - cameraX) * cameraA;
    cameraY += (targetCameraY - cameraY) * cameraA;
    screenCtx.clearRect(0,0,width,height);
    drawSkyBackdrop();
    const haze = ctx.createRadialGradient(width*0.45,height*0.35,0,width*0.50,height*0.56,Math.max(width,height)*0.78);
    haze.addColorStop(0,"rgba(80,124,92,0.18)"); haze.addColorStop(1,"rgba(5,12,18,0.24)"); ctx.fillStyle = haze; ctx.fillRect(0,0,width,height);
    drawStaticLayer();
    drawAmbientWeatherGround();
    drawOverlayCells();

    drawPendingPathHints();
    drawChannelHint();

    const ents: any[] = [];
    for (const b of buildPool.values()) {
      const fp = visualFootprintForKind(b.kind);
      ents.push({ kind:"building", x:Number(b.x||0)-fp/2, z:Number(b.z||0)-fp/2, y:0, h:visualScaleForKind(b.kind), data:b });
    }
    for (const d of doodads.values()) if (d && d.type !== "gone") ents.push({ kind:"doodad", x:Number(d.x||0)-0.8, z:Number(d.z||0)-0.8, y:0, h:1.6, data:d });
    for (const l of lootPool.values()) ents.push({ kind:"loot", x:Number(l.x||0), z:Number(l.z||0), y:0, h:0.4, data:l });
    for (const t of tradePostPool.values()) ents.push({ kind:"trade", x:Number(t.x||0)-0.6, z:Number(t.z||0)-0.6, y:0, h:1.4, data:t });
    for (const n of npcPool.values()) ents.push({ kind:"npc", x:Number(n.x||0), z:Number(n.z||0), y:0, h:1.7, data:n });
    for (const p of remotes) if (p && p.id !== me.id) ents.push({ kind:"remote", x:remoteVisualX(p), z:remoteVisualZ(p), y:0, h:1.6, data:p });
    const nowMs = performance.now();
    const citizenBudget = Math.max(0, Math.min(ambientCitizens.length, Math.trunc(qualityBudget("maxCitizens", ambientCitizens.length))));
    for (let i = 0; i < citizenBudget; i++) {
      const c = ambientCitizens[i];
      const pos = cityLoopPos(c.seed, c.offset, c.speed, nowMs);
      ents.push({ kind:'citizen', x:pos.x, z:pos.z, y:0, h:1.0, data:{...c, ...pos, phase: nowMs / 165 + c.seed} });
    }
    const cartBudget = Math.max(0, Math.min(ambientCarts.length, Math.trunc(qualityBudget("maxCarts", ambientCarts.length))));
    for (let i = 0; i < cartBudget; i++) {
      const c = ambientCarts[i];
      const pos = cityLoopPos(c.seed, c.offset, c.speed, nowMs);
      ents.push({ kind:'cart', x:pos.x, z:pos.z, y:0, h:0.7, data:{...c, ...pos, horizontal: Math.abs(pos.dx) > Math.abs(pos.dz)} });
    }
    ents.push({ kind:"me", x: visualX(me), z: visualZ(me), y:0, h:1.8, data:me });
    renderCounters.entitiesSorted = ents.length;
    ents.sort((a,b) => ((a.x + a.z + (a.y || 0) * 0.45 + a.h * 0.18) - (b.x + b.z + (b.y || 0) * 0.45 + b.h * 0.18)));
    for (const e of ents) {
      renderCounters.entitiesDrawn++;
      if (e.kind === "building") drawBuilding(e.data);
      else if (e.kind === "doodad") drawDoodad(e.data);
      else if (e.kind === "loot") drawLoot(e.data);
      else if (e.kind === "trade") drawTradePost(e.data);
      else if (e.kind === "npc") drawNpc(e.data);
      else if (e.kind === "remote") drawPlayerSprite(e.data, false);
      else if (e.kind === 'citizen') drawTinyCitizen(e.data, e.x, e.z, e.data.phase || 0);
      else if (e.kind === 'cart') drawTinyCart(e.data, e.x, e.z, !!e.data.horizontal);
      else if (e.kind === "me") drawPlayerSprite(me, true);
    }
    drawActionEffects();
    renderCounters.particlesDrawn += dustPuffs.length + citySparkles.length + floaters.length;
    for (let i = dustPuffs.length - 1; i >= 0; i--) {
      const d = dustPuffs[i]; d.life -= Math.max(0.012, renderDtMs / 1000); d.y += 0.008; d.r += 0.010;
      if (d.life <= 0) { dustPuffs.splice(i, 1); continue; }
      const p = proj(d.x, d.y, d.z);
      const a = Math.max(0, d.life / Math.max(0.001, d.maxLife)) * 0.24;
      ctx.fillStyle = `rgba(226,205,170,${a})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, d.r * tileW, d.r * tileH * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = citySparkles.length - 1; i >= 0; i--) {
      const f = citySparkles[i]; f.life -= Math.max(0.012, renderDtMs / 1000) * 0.72;
      if (f.life <= 0) { citySparkles.splice(i, 1); continue; }
      const p = proj(f.x + Math.sin(performance.now()/650 + f.phase)*0.06, f.y, f.z);
      const a = Math.max(0, Math.min(1, f.life)) * (0.32 + lightForTime().night * 0.48);
      ctx.fillStyle = `rgba(255,218,122,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.3, 2.0 * visualZoom()), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,231,160,${a * 0.25})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3.5, 5.0 * visualZoom()), 0, Math.PI * 2); ctx.fill();
    }
    const birdBudget = Math.max(0, Math.min(ambientBirds.length, Math.trunc(qualityBudget("birdCount", ambientBirds.length))));
    for (let bi = 0; bi < birdBudget; bi++) {
      const bird = ambientBirds[bi];
      const L = lightForTime();
      if (L.night > 0.54) continue;
      const t = ((performance.now() / 1000) * bird.speed + bird.phase) % 1.25;
      const bx = t * (width + 120) - 60;
      const by = height * (0.18 + 0.05 * bird.lane) + Math.sin(performance.now()/650 + bird.phase) * 8;
      const w = 7 * visualZoom() * bird.scale;
      ctx.strokeStyle = "rgba(34,42,56,0.48)";
      ctx.lineWidth = Math.max(1.2, 1.8 * visualZoom());
      ctx.beginPath(); ctx.moveTo(bx - w, by + Math.sin(performance.now()/140 + bird.phase)*3); ctx.lineTo(bx, by - 3); ctx.lineTo(bx + w, by + Math.cos(performance.now()/150 + bird.phase)*3); ctx.stroke();
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i]; f.life -= 0.018; f.y += 0.018;
      if (f.life <= 0) { floaters.splice(i,1); continue; }
      const p = proj(f.x, f.y, f.z); ctx.textAlign = "center"; ctx.font = `800 ${Math.max(12, 14*visualZoom())}px system-ui, sans-serif`; ctx.strokeStyle = `rgba(7,10,12,${f.life*0.6})`; ctx.lineWidth = 3; ctx.strokeText(f.text,p.x,p.y); ctx.fillStyle = f.color || "#ffd76e"; ctx.globalAlpha = Math.max(0, f.life); ctx.fillText(f.text,p.x,p.y); ctx.globalAlpha = 1;
    }
    drawWeatherOverlay();
    const L = lightForTime();
    if (L.night > 0.06) {
      const v = ctx.createRadialGradient(width/2, height/2, height*0.24, width/2, height/2, height*0.92);
      v.addColorStop(0, "rgba(8,12,28,0)");
      v.addColorStop(1, `rgba(6,10,24,${0.46 * L.night})`);
      ctx.fillStyle = v;
      ctx.fillRect(0,0,width,height);
    }
    renderCounters.dynamicDrawMs = performance.now() - dynamicStarted;
    if (renderCounters.dynamicDrawMs > Number(qualityBudget("perfBudgetWarnMs", 24))) renderCounters.perfWarnings++;
  }
  function normalizeDoodadKind(value: any) {
    const k = String(value?.type || value?.kind || value || "").toLowerCase();
    return k === "rock" || k === "tree" || k === "food" ? k : "";
  }
  function doodadAt(x: number, z: number, radius = 0.75, want?: string) {
    const tx = Math.trunc(Number(x)), tz = Math.trunc(Number(z));
    let best: any = null, bd = Infinity;
    const wantKind = normalizeDoodadKind(want);
    const scan = Math.max(0, Math.ceil(Number(radius || 0)));
    for (let dx = -scan; dx <= scan; dx++) for (let dz = -scan; dz <= scan; dz++) {
      const d = doodads.get(kfn(tx + dx, tz + dz));
      if (!d || d.type === "gone") continue;
      const kind = normalizeDoodadKind(d);
      if (wantKind && kind !== wantKind) continue;
      const dist = Math.max(Math.abs((tx + dx) - x), Math.abs((tz + dz) - z));
      if (dist <= radius && dist < bd) { best = d; bd = dist; }
    }
    return best;
  }
  function resolvedDoodad(d: any) {
    if (!d) return null;
    return { x: Math.trunc(Number(d.x)), z: Math.trunc(Number(d.z)), kind: normalizeDoodadKind(d) };
  }
  function doodadAtCell(x: number, z: number, want?: string) {
    const d = doodads.get(kfn(Math.trunc(Number(x)), Math.trunc(Number(z))));
    if (!d || d.type === "gone") return null;
    const kind = normalizeDoodadKind(d);
    const wantKind = normalizeDoodadKind(want);
    if (wantKind && kind !== wantKind) return null;
    return kind ? { x: Math.trunc(Number(d.x)), z: Math.trunc(Number(d.z)), kind } : null;
  }
  function resolveDoodadCell(x: number, z: number, want?: string) {
    // Resources are intentionally drawn larger than one server tile in the
    // canvas renderer. Pointer projection may land on a neighboring tile even
    // though the player clearly clicked the visual tree/rock. Resolve with a
    // generous visual radius, then return the authoritative server cell.
    return resolvedDoodad(doodadAt(x, z, 2.15, want));
  }
  function doodadFromEvent(ev: PointerEvent | MouseEvent, want?: string) {
    const w = eventWorld(ev);
    // Use the fractional pointer world coordinate here; rounding first is what
    // made large prism resources feel unclickable near their visible edges.
    return resolvedDoodad(doodadAt(w.wx, w.wz, 2.65, want));
  }
  function canIssueMoveNow() { return inFlight < maxInFlight; }
  function hasPendingMove() { return pendingPath.length > 0 || inFlight > 0; }

  function tick(now: number) {
    if (disposed) return;
    const dt = Math.min(50, now - lastFrame); lastFrame = now; renderDtMs = dt || 16;
    updateVisualMotion(dt, now);
    updateRemoteVisuals(dt);
    updateAmbientWeather(dt, now);
    maybeSpawnCitySparkle(now);
    if (me.walking || me.renderSpeed > 0.05) me.walkPhase += dt * (0.006 + Math.min(1.4, me.renderSpeed) * 0.010);
    if (pendingPath.length && now - lastStepAt >= 126 && canIssueMoveNow()) {
      const next = pendingPath[0];
      if (next && stepTo(next.x, next.z)) pendingPath.shift();
      else pendingPath.length = 0;
    }
    draw();
    raf = requestAnimationFrame(tick);
  }
  function blocked(x: number, z: number) {
    const kk = kfn(x,z);
    if (buildAt.has(kk)) return true;
    const d = doodads.get(kk); if (d && d.type !== "gone") return true;
    return false;
  }
  function nearestOpenNeighbor(tx: number, tz: number) {
    let best: any = null, bd = Infinity;
    for (const [dx,dz] of n8) {
      const x = tx + dx, z = tz + dz;
      if (blocked(x,z)) continue;
      const d = cheb(x,z,me.x,me.z);
      if (d < bd) { bd = d; best = { x,z }; }
    }
    return best;
  }
  function computePath(tx: number, tz: number, near = false) {
    const target = near ? nearestOpenNeighbor(tx,tz) : { x: tx, z: tz };
    if (!target || blocked(target.x,target.z)) return [];
    const start = kfn(me.x,me.z), goal = kfn(target.x,target.z);
    const prev = new Map([[start, null as any]]); const q = [{ x: me.x, z: me.z }];
    while (q.length && prev.size < 2400) {
      const cur = q.shift()!;
      if (kfn(cur.x,cur.z) === goal) break;
      for (const [dx,dz] of n8) {
        const nx = cur.x + dx, nz = cur.z + dz, kk = kfn(nx,nz);
        if (prev.has(kk) || blocked(nx,nz)) continue;
        if (cheb(nx,nz,me.x,me.z) > 90) continue;
        prev.set(kk, cur); q.push({ x:nx, z:nz });
      }
    }
    if (!prev.has(goal)) return [];
    const out:any[] = []; let cur:any = target;
    while (cur && kfn(cur.x,cur.z) !== start) { out.push({x:cur.x,z:cur.z}); cur = prev.get(kfn(cur.x,cur.z)); }
    return out.reverse();
  }
  function sendMove(x: number, z: number) {
    if (!opts.sendAction || !canIssueMoveNow()) return false;
    const seq = ++moveSeq; inFlight++;
    opts.sendAction("movePath", { baseSeq: ackSeq, moveSeq: seq, steps: [{ x, z, seq }] }).then((r:any) => {
      inFlight = Math.max(0, inFlight - 1);
      if (!r || !r.ok) {
        opts.onError?.();
        const rx = Number(r?.x), rz = Number(r?.z);
        // The Three renderer used authoritative mesh/raycast state, so a
        // rejected move naturally corrected on the next scene update. Canvas is
        // fully local between polls; roll back immediately to the last known
        // server position if the rejection did not include coordinates.
        hardSnapMe(Number.isFinite(rx) ? rx : lastAuthoritative.x, Number.isFinite(rz) ? rz : lastAuthoritative.z);
        opts.pollSoon?.();
        return;
      }
      ackSeq = Math.max(ackSeq, Number(r.ackSeq || r.acceptedSeq || seq) || seq);
      const serverX = Number(r.x ?? (Array.isArray(r.path) && r.path.length ? r.path[r.path.length - 1]?.x : NaN));
      const serverZ = Number(r.z ?? (Array.isArray(r.path) && r.path.length ? r.path[r.path.length - 1]?.z : NaN));
      if (Number.isFinite(serverX) && Number.isFinite(serverZ)) lastAuthoritative = { x: Math.trunc(serverX), z: Math.trunc(serverZ) };
      if (!pendingPath.length && inFlight === 0 && Number.isFinite(serverX) && Number.isFinite(serverZ)) {
        reconcileAuthoritative(serverX, serverZ);
      }
    }).catch(() => { inFlight = Math.max(0, inFlight - 1); hardSnapMe(lastAuthoritative.x, lastAuthoritative.z); });
    return true;
  }
  function stepTo(x: number, z: number) {
    x = Math.trunc(Number(x)); z = Math.trunc(Number(z));
    if (!opts.sendAction || !canIssueMoveNow()) return false;
    if (blocked(x,z)) return false;
    const prevX = me.x, prevZ = me.z;
    me.facingX = x - me.x; me.facingZ = z - me.z; me.walking = true; lastStepAt = performance.now();
    me.x = x; me.z = z;
    if (ST.me) { ST.me.x = x; ST.me.z = z; }
    const sent = sendMove(x,z);
    if (!sent) {
      me.x = prevX; me.z = prevZ;
      if (ST.me) { ST.me.x = prevX; ST.me.z = prevZ; }
      me.walking = false;
      return false;
    }
    opts.onHop?.();
    rebuildCells();
    setTimeout(() => { if (!pendingPath.length && inFlight === 0) me.walking = false; }, 180);
    return true;
  }
  function applyWorld(w: any = {}) {
    tileOwner.clear(); buildAt.clear(); buildPool.clear(); lootPool.clear(); doodads.clear(); tradePostPool.clear(); npcPool.clear();
    for (const t of w.tiles || []) tileOwner.set(kfn(t.x,t.z), { owner:t.owner, body:t.ownerBody, name:t.ownerName });
    for (const d of w.doodads || []) { if (!d) continue; const kk=kfn(d.x,d.z); if (exceptions.get(kk)==="gone") continue; doodads.set(kk, { ...d, x:Math.trunc(Number(d.x)), z:Math.trunc(Number(d.z)) }); }
    const worldBuildings = Array.isArray(w.buildings) ? w.buildings : [];
    let virtualCapital:any[] = [];
    try { virtualCapital = opts.capitalBuildingsInView?.(Number(w.ax || ST.ax || 0), Number(w.az || ST.az || 0), (opts.currentTileLoadRadius?.() || 36) + 12) || []; } catch {}
    const blockedCapital = new Set(worldBuildings.map((b:any) => kfn(b.x,b.z)));
    const renderBuildings = worldBuildings.concat(virtualCapital.filter((b:any)=>!blockedCapital.has(kfn(b.x,b.z))));
    for (const b of renderBuildings) {
      const uid = b.uid ?? `${b.kind || b.type}:${b.x},${b.z}`;
      const row = { ...b, uid, x:Math.trunc(Number(b.x||0)), z:Math.trunc(Number(b.z||0)), kind:String(b.kind || b.type || "building") };
      buildPool.set(uid,row); buildAt.set(kfn(row.x,row.z), row);
    }
    for (const l of w.loot || []) { const id = l.id ?? `${l.x},${l.z},${l.g || 0}`; lootPool.set(id, { ...l, id }); }
    invalidateStatic("world");
    rebuildCells(true);
  }
  function applyMe(p: any) {
    const src = p || ST.me || {};
    me.id = src.id ?? me.id; me.name = src.name || me.name; me.body = src.body ?? me.body; me.hat = src.hat ?? me.hat;
    const sx = Number(src.x), sz = Number(src.z);
    if (Number.isFinite(sx) && Number.isFinite(sz)) {
      const tx = Math.trunc(sx), tz = Math.trunc(sz);
      // Server snapshots can arrive behind the local optimistic canvas walk.
      // Do not yank the player back unless the drift is clearly impossible.
      lastAuthoritative = { x: tx, z: tz };
      const drift = Math.max(Math.abs(tx - me.x), Math.abs(tz - me.z));
      if (drift > 8) {
        hardSnapMe(tx, tz);
      } else if (!hasPendingMove()) {
        reconcileAuthoritative(tx, tz);
      } else if (!Number.isFinite(me.vx) || !Number.isFinite(me.vz)) {
        snapVisualToLogical();
      }
    }
    rebuildCells();
  }
  function applyPlayers(players: any[] = []) {
    const previous = new Map<any, any>();
    for (const p of remotes || []) if (p && p.id != null) previous.set(p.id, p);
    remotes.length = 0; playersById.clear();
    for (const p of players || []) {
      if (!p) continue;
      const prev = previous.get(p.id);
      const row = { ...p };
      if (prev) {
        row.__vx = Number.isFinite(Number(prev.__vx)) ? Number(prev.__vx) : Number(prev.x || row.x || 0);
        row.__vz = Number.isFinite(Number(prev.__vz)) ? Number(prev.__vz) : Number(prev.z || row.z || 0);
        row.__velX = Number(prev.__velX || 0); row.__velZ = Number(prev.__velZ || 0);
        row.__renderSpeed = Number(prev.__renderSpeed || 0); row.__walkPhase = Number(prev.__walkPhase || 0);
      } else {
        row.__vx = Number(row.x || 0); row.__vz = Number(row.z || 0); row.__velX = 0; row.__velZ = 0; row.__renderSpeed = 0; row.__walkPhase = 0;
      }
      playersById.set(row.id,row);
      if (row.id !== me.id) remotes.push(row);
    }
  }
  function eventWorld(ev: PointerEvent | MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const sx = (ev.clientX ?? 0) - rect.left;
    const sy = (ev.clientY ?? 0) - rect.top;
    const w = screenToWorld(sx, sy);
    return { ...w, sx, sy };
  }
  function cellFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    return { x: Math.round(w.wx), z: Math.round(w.wz) };
  }
  function buildingVisualRadius(kind: any) {
    return Math.max(2.75, visualFootprintForKind(kind) * 0.72);
  }
  function buildingFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    const c = { x: Math.round(w.wx), z: Math.round(w.wz) };
    const exact = buildAt.get(kfn(c.x,c.z));
    if (exact) return { uid: exact.uid, b: exact };

    // Canvas buildings are intentionally much bigger than the authoritative
    // one-cell server anchor. The old Three raycast hit the mesh itself; after
    // the canvas rewrite we need a visual hit test or clicks on roofs/caps land
    // on nearby terrain cells and tools/inspect feel broken.
    let best:any = null, bestScore = Infinity;
    for (const b of buildPool.values()) {
      const bx = Number(b.x || 0), bz = Number(b.z || 0);
      const r = buildingVisualRadius(b.kind);
      const dx = Math.abs(w.wx - bx), dz = Math.abs(w.wz - bz);
      if (Math.max(dx, dz) > r) continue;
      const base = proj(bx, 0, bz);
      const screenScore = Math.hypot(w.sx - base.x, w.sy - (base.y - r * heightScale * 0.34)) / Math.max(1, tileW);
      const worldScore = Math.max(dx, dz) * 0.45;
      const depthBias = -(bx + bz) * 0.001;
      const score = screenScore + worldScore + depthBias;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best ? { uid: best.uid, b: best } : null;
  }
  function buildPoolAt(x:number,z:number) { return buildAt.get(kfn(x,z)); }
  function doodadVisible(x:number,z:number) {
    const d = doodadAt(Number(x), Number(z), 1.35);
    return d ? normalizeDoodadKind(d) || true : false;
  }
  function refreshWindow(force = false) { if (force) invalidateStatic("refresh-window"); rebuildCells(!!force); }
  function pathTo(x:number,z:number) { const p = computePath(Math.trunc(x),Math.trunc(z),false); if (!p.length) return false; pendingPath = p; return true; }
  function pathToNear(x:number,z:number) { const p = computePath(Math.trunc(x),Math.trunc(z),true); if (!p.length) return false; pendingPath = p; return true; }
  function canIssueMove() { return canIssueMoveNow(); }
  function tryMoveDelta(dx:number,dz:number) { if (!canIssueMoveNow()) return false; pendingPath.length = 0; return stepTo(me.x + Math.trunc(dx), me.z + Math.trunc(dz)); }
  function hardSnapMe(x:number,z:number) {
    me.x=Math.trunc(Number(x)); me.z=Math.trunc(Number(z));
    snapVisualToLogical();
    if (ST.me) { ST.me.x=me.x; ST.me.z=me.z; }
    pendingPath.length=0; rebuildCells(true);
  }
  function setFacing(x:number,z:number) { me.facingX=x; me.facingZ=z; }
  function setWalking(v:boolean) { me.walking=!!v; if (!v) { me.inputX = 0; me.inputZ = 0; } }
  function setInputVelocity(x:number,z:number) { me.inputX = clamp(Number(x || 0), -1, 1); me.inputZ = clamp(Number(z || 0), -1, 1); }
  function setHintCells(c:any[]) { hintCells = Array.isArray(c) ? c.slice(0, 512) : []; }
  function showBuildGhost(x:number,z:number,valid=true) { ghost = { x,z,valid }; }
  function hideBuildGhost() { ghost = null; }
  function floatText(x:number,z:number,text:string,color="#ffd76e") { floaters.push({x,z,y:1.2,text,color,life:1}); }
  function burst(x:number,y:number,z:number,color=0xffd76e,count=8) {
    const c = numColorToHex(color,"#ffd76e");
    pushActionBurst(Number(x), Number(y || 0.65), Number(z), c, Math.max(5, Math.min(28, Number(count || 8))), 1);
    actionRings.push({ x:Number(x), z:Number(z), color:c, life:0.46, maxLife:0.46, radius:0.18, power:1 });
    floatText(x,z,"✦",c);
  }
  function shockwave(x:number,z:number,color=0xffd76e) {
    const c = numColorToHex(color,"#ffd76e");
    actionRings.push({ x:Number(x), z:Number(z), color:c, life:0.62, maxLife:0.62, radius:0.28, power:1.35 });
  }
  function markDoodadGone(x:number,z:number) { const kk=kfn(x,z); exceptions.set(kk,"gone"); doodads.delete(kk); invalidateStatic("doodad-gone"); }
  function removeBuild(uid:any) { const b=buildPool.get(uid); if (!b) return; buildPool.delete(uid); buildAt.delete(kfn(b.x,b.z)); invalidateStatic("build-remove"); }
  function removeLoot(id: any, x?: number, z?: number) {
    const candidates = [id, String(id), Number(id)].filter((v, i, a) => v != null && v === v && a.indexOf(v) === i);
    for (const k of candidates) {
      if (lootPool.has(k)) { lootPool.delete(k); return true; }
    }
    if (x != null && z != null) {
      const tx = Math.trunc(Number(x)), tz = Math.trunc(Number(z));
      for (const [k, row] of Array.from(lootPool.entries())) {
        if (Math.max(Math.abs(Math.trunc(Number(row.x || 0)) - tx), Math.abs(Math.trunc(Number(row.z || 0)) - tz)) <= 1) {
          lootPool.delete(k); return true;
        }
      }
    }
    return false;
  }

  function minimapSnapshot() {
    const nowSeen = Date.now();
    const resourceLoot = Array.from(doodads.values())
      .filter((d:any) => d && d.type !== "gone" && normalizeDoodadKind(d))
      .map((d:any) => ({ x: d.x, z: d.z, kind: normalizeDoodadKind(d), id: `res:${d.x},${d.z}` }));
    return {
      tiles: Array.from(cells.values()).map((c:any) => ({ x: c.cx ?? c.x, z: c.cz ?? c.z, owner: c.owner || 0, ownerBody: tileOwner.get(kfn(c.cx ?? c.x, c.cz ?? c.z))?.body })),
      buildings: [
        ...Array.from(buildPool.values()).map((b:any) => ({ x: b.x, z: b.z, kind: b.kind, owner: b.owner, uid: b.uid })),
        ...Array.from(tradePostPool.values()).map((t:any) => ({ x: t.x, z: t.z, kind: "tradepost", owner: 0, uid: t.uid || `trade:${t.x},${t.z}` })),
      ],
      loot: [
        ...Array.from(lootPool.values()).map((l:any) => ({ x: l.x, z: l.z, kind: l.kind, id: l.id })),
        ...resourceLoot,
      ],
      players: [
        ...[me, ...remotes].map((p:any) => ({ id: p.id, x: p.x, z: p.z, body: p.body, name: p.name, lastSeen: nowSeen })),
        ...Array.from(npcPool.values()).map((n:any) => ({ id: n.uid || `npc:${n.x},${n.z}`, x: n.x, z: n.z, body: 0xceb443, name: n.name || n.nm || "Wanderer", npc: true, lastSeen: nowSeen })),
      ],
    };
  }
  function pointEntityAt(pool: Map<any, any>, wx: number, wz: number, radius = 1.15) {
    let best:any = null, bd = Infinity;
    for (const row of pool.values()) {
      const x = Number(row.x || 0), z = Number(row.z || 0);
      const d = Math.max(Math.abs(wx - x), Math.abs(wz - z));
      if (d <= radius && d < bd) { best = row; bd = d; }
    }
    return best;
  }
  function npcFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    const n = pointEntityAt(npcPool, w.wx, w.wz, 1.05);
    return n ? { x: n.x, z: n.z, kind: "npc", npc: n } : null;
  }
  function tradePostFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    const t = pointEntityAt(tradePostPool, w.wx, w.wz, 1.35);
    return t ? { x: t.x, z: t.z, kind: "tradepost", trade: t } : null;
  }
  function playerFromEvent(ev: PointerEvent | MouseEvent) {
    const w = eventWorld(ev);
    let best:any = null, bd = Infinity;
    for (const p of remotes || []) {
      if (!p || p.id === me.id) continue;
      const x = Number(p.x || 0), z = Number(p.z || 0);
      const d = Math.max(Math.abs(w.wx - x), Math.abs(w.wz - z));
      if (d <= 1.22 && d < bd) { best = p; bd = d; }
    }
    return best ? { x: Math.trunc(Number(best.x || 0)), z: Math.trunc(Number(best.z || 0)), kind: "player", player: best } : null;
  }
  function pickFromEvent(ev: PointerEvent | MouseEvent) {
    const building = buildingFromEvent(ev);
    const doodad = doodadFromEvent(ev);
    const trade = tradePostFromEvent(ev);
    const npc = npcFromEvent(ev);
    const player = playerFromEvent(ev);
    const raw = cellFromEvent(ev);

    // Canvas buildings are deliberately large visual compositions. A broad
    // building radius is good for clicking roofs/plinths, but it must not
    // steal clicks from smaller foreground targets such as trees, rocks,
    // wanderers, trade posts, or remote players. The old Three raycaster
    // naturally returned the topmost mesh under the pointer; this explicit
    // primary target restores that behavior for canvas picking.
    let primary = "terrain";
    let cell = raw;
    if (player) { primary = "player"; cell = { x: player.x, z: player.z }; }
    else if (npc) { primary = "npc"; cell = { x: npc.x, z: npc.z }; }
    else if (trade) { primary = "trade"; cell = { x: trade.x, z: trade.z }; }
    else if (doodad) { primary = "doodad"; cell = { x: doodad.x, z: doodad.z }; }
    else if (building?.b) { primary = "building"; cell = { x: building.b.x, z: building.b.z }; }
    const result = { primary, cell, building, doodad, trade, npc, player, raw };
    lastPickTarget = result;
    lastPickAt = performance.now();
    pickDebug.update(result);
    return result;
  }
  function worldToScreen(x:number, z:number, y = 0) { return proj(Number(x), Number(y), Number(z)); }
  function screenToWorldPoint(sx:number, sy:number) { return screenToWorld(Number(sx), Number(sy)); }
  function visibleCells() { return Array.from(cells.values()).map((c:any) => ({ x: c.cx ?? c.x, z: c.cz ?? c.z, owner: c.owner || 0 })); }
  function movementState() { return { x: me.x, z: me.z, visualX: me.vx, visualZ: me.vz, visualSpeed: me.renderSpeed, authoritativeX: lastAuthoritative.x, authoritativeZ: lastAuthoritative.z, inFlight, maxInFlight, pending: pendingPath.length, ackSeq, moveSeq, canIssueMove: canIssueMoveNow(), renderDtMs, renderQuality: qualityName(), renderCounters: { ...renderCounters, staticReason: lastStaticRebuildReason } }; }
  function capitalBearing() {
    const ax = Number(ST.ax || 0), az = Number(ST.az || 0);
    const dx = ax - Number(me.x || 0), dz = az - Number(me.z || 0);
    const dist = Math.max(Math.abs(dx), Math.abs(dz));
    const dirX = dx < -1 ? "west" : dx > 1 ? "east" : "";
    const dirZ = dz < -1 ? "north" : dz > 1 ? "south" : "";
    return { dx, dz, dist, label: [dirZ, dirX].filter(Boolean).join("-") || "here" };
  }
  function updateMinimapInfo() { /* world map/minimap UI is still handled by existing canvas map code. */ }
  function dispose() { disposed = true; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); try { pickDebug.remove(); } catch {} try { canvas.remove(); } catch {} }

  window.addEventListener("resize", resize);
  applyVisualQuality(ST.visual); applyMe(ST.me); rebuildCells(true); raf = requestAnimationFrame(tick);

  return {
    get rev() { return Number(ST.rev || 0) || 0; },
    get ax() { return Number(ST.ax ?? me.x) || 0; },
    get az() { return Number(ST.az ?? me.z) || 0; },
    get map() { return minimapSnapshot(); },
    get offers() { return ST.offers || []; },
    applyWorld, applyPlayers, applyMe, me, cellFromEvent, buildingFromEvent, tradePostFromEvent, npcFromEvent, playerFromEvent, pickFromEvent, worldToScreen, screenToWorldPoint, visibleCells, movementState, capitalBearing, pathTo, pathToNear, tryMoveDelta,
    blocked, buildPoolAt, doodadVisible, doodadAt, doodadAtCell, resolveDoodadCell, doodadFromEvent, burst, floatText, shockwave, hoverMarker, hardSnapMe, markDoodadGone, removeBuild, removeLoot,
    setHintCells, hideBuildGhost, showBuildGhost, refreshWindow, rebuildBuilding: (uid:any) => {}, animateBuildingUse: (uid:any) => { const b=buildPool.get(uid); if (b) floatText(b.x,b.z,"used","#ffd76e"); }, refreshConstructionProgress: () => {},
    refreshOwnRig: () => {}, applyVisualQuality, hasPendingMove, canIssueMove, minimapSnapshot,
    tileOwner, buildPool, buildAt, lootPool, rigPool, tradePostPool, npcPool, cells, updateMinimapInfo,
    rotateCam: () => {}, refreshCameraRotation: () => {}, refreshCameraZoom: () => { updateProjection(); invalidateStatic("camera"); rebuildCells(true); }, refreshEnvironment: () => { rainStreaks.splice(0); groundRipples.splice(0); windLeaves.splice(0); citySparkles.splice(0); invalidateStatic("environment"); },
    zoom: (delta = 0) => { zoomValue = clamp(zoomValue + Number(delta || 0), 0.72, 1.55); updateProjection(); invalidateStatic("zoom"); },
    walkQueueClear: () => { pendingPath.length = 0; }, dispose, setFacing, setWalking, setInputVelocity,
  };
}