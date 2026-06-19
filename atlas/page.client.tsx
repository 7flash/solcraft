// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";

type Rect = { x: number; y: number; w: number; h: number };
type AtlasDef = {
  id: string;
  label: string;
  cols: number;
  rows: number;
  slots: string[];
  cell: number;
};
type Version = {
  id: string;
  atlasId: string;
  label?: string;
  url: string;
  fileName?: string;
  createdAt?: number;
  published?: boolean;
  w?: number;
  h?: number;
};
type Clip = {
  id: string;
  name: string;
  sourceUrl: string;
  sourceName: string;
  sourceW: number;
  sourceH: number;
  rect: Rect;
  createdAt: number;
};
type Placement = {
  clipId: string;
  sourceUrl: string;
  sourceName: string;
  sourceW: number;
  sourceH: number;
  rect: Rect;
  fit: "cover" | "contain" | "stretch";
  pad: number;
  dx: number;
  dy: number;
  scale: number;
};

const rootId = "solcraft-atlas-forge";
const KEY_STORE = "solcraft:adminKey";
const CELL = 128;

// Keep this inline too: the TradJS-mounted atlas page may not load route CSS in every build path.
// atlas/styles.css is still shipped in this patch with the same rules, but this guarantees the page is styled.
const CSS = String.raw`
/* atlas/styles.css
   Independent TradJS Sprite Sheet Forge skin.
   Intentionally scoped under .af4 so globals.css and other admin pages do not leak in. */

#solcraft-atlas-forge {
  min-height: 100vh;
  background: #05070c;
}

.af4 {
  --af-bg: #05070c;
  --af-panel: rgba(8, 13, 22, .92);
  --af-panel-2: rgba(14, 22, 35, .94);
  --af-paper: #f7efe1;
  --af-muted: #afa895;
  --af-line: rgba(247, 239, 225, .14);
  --af-line-strong: rgba(247, 239, 225, .28);
  --af-mint: #14f195;
  --af-mint-soft: rgba(20, 241, 149, .12);
  --af-gold: #ffd76e;
  --af-gold-soft: rgba(255, 215, 110, .13);
  --af-red: #ff8f7a;
  --af-red-soft: rgba(255, 112, 92, .13);
  --af-blue: #79d8ff;
  --af-shadow: 0 20px 54px rgba(0, 0, 0, .34);
  --af-radius-lg: 22px;
  --af-radius-md: 15px;
  --af-radius-sm: 10px;

  min-height: 100vh;
  isolation: isolate;
  contain: layout paint style;
  box-sizing: border-box;
  padding: 12px;
  color: var(--af-paper);
  background:
    radial-gradient(circle at 12% -12%, rgba(20, 241, 149, .15), transparent 32rem),
    radial-gradient(circle at 90% 0%, rgba(121, 216, 255, .10), transparent 28rem),
    linear-gradient(180deg, #08101a 0%, #05070c 60%, #030407 100%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.35;
}

.af4,
.af4 *,
.af4 *::before,
.af4 *::after { box-sizing: border-box; }

.af4 a { color: inherit; }
.af4 button,
.af4 input,
.af4 select,
.af4 textarea { font: inherit; color: inherit; }
.af4 button { appearance: none; }

.af4 h1,
.af4 h2,
.af4 p { margin-block-start: 0; }

.af4 h1 {
  margin: .05em 0 .08em;
  color: var(--af-paper);
  font-family: Fraunces, Georgia, ui-serif, serif;
  font-size: clamp(36px, 4.7vw, 62px);
  line-height: .88;
  letter-spacing: -.055em;
  text-wrap: balance;
}

.af4 h2 {
  margin: 0;
  color: var(--af-paper);
  font-family: Fraunces, Georgia, ui-serif, serif;
  font-size: clamp(20px, 1.8vw, 27px);
  line-height: 1;
  letter-spacing: -.035em;
}

.af4 code { color: #fff4bd; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

.af4 .hero,
.af4 .panel {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--af-line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, .035), transparent 42%),
    linear-gradient(180deg, var(--af-panel-2), var(--af-panel));
  box-shadow: var(--af-shadow), inset 0 1px 0 rgba(255, 255, 255, .045);
  backdrop-filter: blur(12px);
}

.af4 .hero::before,
.af4 .panel::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(20, 241, 149, .055), transparent 28%, transparent 72%, rgba(121, 216, 255, .055)),
    repeating-linear-gradient(0deg, rgba(255,255,255,.014) 0 1px, transparent 1px 36px);
  opacity: .62;
}

.af4 .hero > *,
.af4 .panel > * { position: relative; z-index: 1; }

.af4 .hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  margin-bottom: 10px;
  padding: 14px 16px;
  border-radius: 24px;
}

.af4 .heroCopy { min-width: 0; }
.af4 .heroCopy .tiny { max-width: 980px; margin-bottom: 8px; }
.af4 .heroActions { display: grid; gap: 8px; justify-items: end; }

.af4 .layout {
  display: grid;
  grid-template-columns: minmax(520px, 1.1fr) minmax(470px, .9fr);
  grid-template-areas:
    "source target"
    "preview target"
    "preview clips"
    "versions debug";
  gap: 10px;
  align-items: start;
}

.af4 .panel {
  min-width: 0;
  padding: 12px;
  border-radius: var(--af-radius-lg);
}

.af4 .sourcePanel { grid-area: source; }
.af4 .targetPanel { grid-area: target; }
.af4 .previewPanel { grid-area: preview; }
.af4 .clipsPanel { grid-area: clips; }
.af4 .versionsPanel { grid-area: versions; }
.af4 .debugPanel { grid-area: debug; }

.af4 .panelHead {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
}

.af4 .panelHead .tiny { margin: 4px 0 0; }

.af4 .step {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid rgba(20, 241, 149, .42);
  border-radius: 999px;
  background: rgba(20, 241, 149, .12);
  color: #baffdf;
  font: 950 12px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.af4 .savedStep { border-color: rgba(255, 215, 110, .38); background: rgba(255, 215, 110, .12); color: #ffe6aa; }

.af4 .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.af4 .split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.af4 .coords { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.af4 .compactCoords { margin-top: 8px; }
.af4 .tools { display: grid; grid-template-columns: 1.25fr repeat(4, minmax(64px, .9fr)); gap: 8px; }
.af4 .panelFoot { margin-top: 10px; }

.af4 .kicker {
  margin: 0;
  width: max-content;
  max-width: 100%;
  color: var(--af-gold);
  font: 950 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.af4 .tiny {
  margin: 0 0 8px;
  color: var(--af-muted);
  font-size: 12px;
  line-height: 1.42;
}

.af4 .emptyText {
  margin: 0;
  min-height: 92px;
  display: grid;
  place-items: center;
  border: 1px dashed rgba(247, 239, 225, .18);
  border-radius: 14px;
  background: rgba(0, 0, 0, .16);
  color: var(--af-muted);
  text-align: center;
  font-size: 12px;
}

.af4 .ok,
.af4 .bad { margin: 0; font-weight: 950; }
.af4 .ok { color: var(--af-mint); }
.af4 .bad { color: var(--af-red); }

.af4 .btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 1px solid var(--af-line);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.015)), #111b2a;
  color: var(--af-paper);
  padding: 7px 12px;
  font-weight: 950;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  transition: transform .12s ease, border-color .12s ease, background .12s ease, opacity .12s ease;
}

.af4 .btn:hover:not(:disabled) { transform: translateY(-1px); border-color: rgba(20, 241, 149, .55); }
.af4 .btn:disabled { opacity: .42; cursor: not-allowed; }
.af4 .btn.on,
.af4 .btn.primary {
  border-color: var(--af-mint);
  background: linear-gradient(180deg, #5cffbd, var(--af-mint));
  color: #05100b;
  box-shadow: 0 0 0 1px rgba(20, 241, 149, .18), 0 10px 24px rgba(20, 241, 149, .12);
}
.af4 .btn.warn { border-color: rgba(255, 215, 110, .36); background: var(--af-gold-soft); color: #ffe7a3; }
.af4 .btn.danger { border-color: rgba(255, 143, 122, .34); background: var(--af-red-soft); color: #ffd4cc; }

.af4 .pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  max-width: 100%;
  min-height: 24px;
  border: 1px solid rgba(20, 241, 149, .25);
  border-radius: 999px;
  background: var(--af-mint-soft);
  color: #bcf7d6;
  padding: 4px 8px;
  font: 950 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.af4 label.pill { cursor: pointer; }
.af4 .pill.warn { border-color: rgba(255, 215, 110, .32); background: var(--af-gold-soft); color: #ffe6aa; }
.af4 .pill input { margin: 0; accent-color: var(--af-mint); }

.af4 .field { display: grid; gap: 5px; min-width: 0; margin: 0; }
.af4 .field label {
  color: #9bffd9;
  font: 950 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.af4 .field input,
.af4 .field select,
.af4 .field textarea {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  border: 1px solid var(--af-line);
  border-radius: var(--af-radius-sm);
  outline: none;
  background: rgba(0, 0, 0, .24);
  color: var(--af-paper);
  padding: 8px 9px;
}
.af4 .field input:focus,
.af4 .field select:focus,
.af4 .field textarea:focus { border-color: rgba(20, 241, 149, .62); box-shadow: 0 0 0 3px rgba(20, 241, 149, .10); }
.af4 .field input[type="file"] { border-style: dashed; background: rgba(20, 241, 149, .045); }
.af4 .field input[type="checkbox"] { width: auto; min-height: 0; }

.af4 .canvasWrap {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(20, 241, 149, .20);
  border-radius: 18px;
  background:
    repeating-conic-gradient(rgba(255,255,255,.035) 0% 25%, rgba(0,0,0,.08) 0% 50%) 50% / 32px 32px,
    radial-gradient(circle at 50% 48%, rgba(20, 241, 149, .07), transparent 60%),
    #07101a;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
}
.af4 .canvasWrap canvas { display: block; width: 100%; height: auto; touch-action: none; }
.af4 .sourceWrap canvas { min-height: 320px; cursor: crosshair; }
.af4 .sheetWrap canvas { min-height: 420px; }

.af4 .clips,
.af4 .versions { display: grid; gap: 8px; max-height: 240px; overflow: auto; padding-right: 3px; }

.af4 .clip,
.af4 .version {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  border: 1px solid var(--af-line);
  border-radius: var(--af-radius-md);
  background: rgba(255, 255, 255, .045);
  color: var(--af-paper);
  padding: 9px;
  text-align: left;
  cursor: pointer;
}
.af4 .clip:hover,
.af4 .version:hover { border-color: rgba(20, 241, 149, .44); }
.af4 .clip.on,
.af4 .version.on { border-color: rgba(20, 241, 149, .62); background: rgba(20, 241, 149, .09); }
.af4 .clip b,
.af4 .version b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.af4 .clip small,
.af4 .version small { display: block; overflow: hidden; color: var(--af-muted); font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }

.af4 .atlasTabs,
.af4 .sheetStats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 8px; }

.af4 .slotgrid {
  display: grid;
  gap: 8px;
  max-height: none;
  overflow: visible;
  margin: 8px 0 10px;
}
.af4 .slotgrid.cols4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.af4 .slotgrid.cols8 { grid-template-columns: repeat(8, minmax(60px, 1fr)); gap: 6px; }

.af4 .slot {
  display: grid;
  gap: 4px;
  min-height: 64px;
  border: 1px solid var(--af-line);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015)),
    rgba(255, 255, 255, .035);
  color: var(--af-paper);
  padding: 8px;
  text-align: left;
  cursor: pointer;
}
.af4 .slot:hover { border-color: rgba(20, 241, 149, .42); }
.af4 .slot.on { border-color: var(--af-mint); background: rgba(20, 241, 149, .105); box-shadow: inset 0 0 0 1px rgba(20, 241, 149, .45); }
.af4 .slot.dirty { border-color: rgba(255, 215, 110, .58); background: rgba(255, 215, 110, .08); }
.af4 .slot.on.dirty { border-color: var(--af-mint); background: linear-gradient(180deg, rgba(20, 241, 149, .14), rgba(255, 215, 110, .08)); }
.af4 .slot b { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12px; }
.af4 .slot b span { display: grid; place-items: center; min-width: 20px; height: 20px; border-radius: 7px; background: rgba(0,0,0,.24); color: #fff0c8; font: 950 10px/1 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.af4 .slot small { overflow: hidden; color: var(--af-muted); font: 10px/1.25 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-overflow: ellipsis; }
.af4 .slotgrid.cols8 .slot { min-height: 56px; padding: 6px; }
.af4 .slotgrid.cols8 .slot b { font-size: 10px; gap: 4px; }
.af4 .slotgrid.cols8 .slot b span { min-width: 18px; height: 18px; }
.af4 .slotgrid.cols8 .slot small { font-size: 9px; }

.af4 .debugPanel { padding: 0; }
.af4 .debugPanel summary {
  list-style: none;
  cursor: pointer;
  padding: 12px;
  color: var(--af-paper);
  font-family: Fraunces, Georgia, ui-serif, serif;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -.03em;
}
.af4 .debugPanel summary::-webkit-details-marker { display: none; }
.af4 .debugPanel summary::after { content: "open"; float: right; color: var(--af-muted); font: 950 10px/22px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; text-transform: uppercase; letter-spacing: .12em; }
.af4 .debugPanel[open] summary::after { content: "close"; }
.af4 .debug {
  max-height: 230px;
  overflow: auto;
  margin: 0 12px 12px;
  border: 1px solid var(--af-line);
  border-radius: 14px;
  background: rgba(0, 0, 0, .30);
  color: #d8fff0;
  padding: 10px;
  white-space: pre-wrap;
  font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 1180px) {
  .af4 .layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      "source"
      "target"
      "preview"
      "clips"
      "versions"
      "debug";
  }
  .af4 .hero { grid-template-columns: 1fr; }
  .af4 .heroActions { justify-items: start; }
}

@media (max-width: 760px) {
  .af4 { padding: 9px; }
  .af4 .split,
  .af4 .coords,
  .af4 .tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .af4 .slotgrid.cols4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .af4 .slotgrid.cols8 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .af4 .btn,
  .af4 .pill { width: 100%; }
}

`;

const STYLE_ID = "solcraft-atlas-forge-inline-style";
function ensureStyle() {
  try {
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      el.setAttribute("data-owner", "solcraft-atlas-forge");
      document.head.appendChild(el);
    }
    if (el.textContent !== CSS) el.textContent = CSS;
  } catch {}
}

const ATLASES: AtlasDef[] = [
  {
    id: "terrain",
    label: "Terrain",
    cols: 4,
    rows: 4,
    cell: CELL,
    slots: [
      "grass",
      "forest",
      "dirt",
      "path",
      "sand",
      "cobble",
      "rocky",
      "soil",
      "farm",
      "water",
      "moss",
      "deck",
      "claimed",
      "mint",
      "purple",
      "plain",
    ],
  },
  {
    id: "building",
    label: "Building",
    cols: 4,
    rows: 4,
    cell: CELL,
    slots: [
      "wood",
      "darkwood",
      "stone",
      "marble",
      "cobble",
      "plaster",
      "roof",
      "slate",
      "thatch",
      "cloth",
      "purplecloth",
      "canvas",
      "metal",
      "rune",
      "banner",
      "carved",
    ],
  },
  {
    id: "fx",
    label: "FX",
    cols: 4,
    rows: 4,
    cell: CELL,
    slots: [
      "smallShadow",
      "bigShadow",
      "sparkle",
      "coin",
      "dust",
      "smoke",
      "woodchips",
      "stonechips",
      "harvest",
      "warn",
      "twinkle",
      "rune",
      "bank",
      "market",
      "lootbag",
      "impact",
    ],
  },
  {
    id: "ui",
    label: "UI",
    cols: 4,
    rows: 4,
    cell: CELL,
    slots: [
      "wood",
      "stone",
      "wheat",
      "fish",
      "gold",
      "gem",
      "energy",
      "heart",
      "shield",
      "sword",
      "backpack",
      "hammer",
      "food",
      "cottage",
      "market",
      "bank",
    ],
  },
  {
    id: "doll",
    label: "Doll",
    cols: 8,
    rows: 6,
    cell: CELL,
    slots: [
      "skin0",
      "skin1",
      "skin2",
      "skin3",
      "skin4",
      "skin5",
      "skin6",
      "skin7",
      "hair0",
      "hair1",
      "hair2",
      "hair3",
      "hair4",
      "hair5",
      "hair6",
      "hair7",
      "hat0",
      "hat1",
      "hat2",
      "hat3",
      "hat4",
      "hat5",
      "hat6",
      "hat7",
      "torso0",
      "torso1",
      "torso2",
      "torso3",
      "torso4",
      "torso5",
      "torso6",
      "torso7",
      "legs0",
      "legs1",
      "legs2",
      "legs3",
      "legs4",
      "legs5",
      "legs6",
      "legs7",
      "back0",
      "back1",
      "back2",
      "back3",
      "back4",
      "back5",
      "back6",
      "back7",
    ],
  },
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
  versions: [],
  publishedByAtlas: {},
  debug: null,

  sourceUrl: "",
  sourceName: "",
  sourceW: 0,
  sourceH: 0,
  sourceRect: null,
  drag: null,
  sourceView: null,

  clips: [],
  selectedClipId: "",

  atlasId: "terrain",
  selectedSlot: 0,
  replacementsByAtlas: {},
  fit: "cover",
  pad: 0,
  dx: 0,
  dy: 0,
  scale: 1,
  publishAfterUpload: true,
};

function root() {
  return document.getElementById(rootId);
}
function atlas(id = st.atlasId) {
  return ATLASES.find((a) => a.id === id) || ATLASES[0];
}
function sheetW(a = atlas()) {
  return a.cols * a.cell;
}
function sheetH(a = atlas()) {
  return a.rows * a.cell;
}
function round(n: any) {
  return Math.round(Number(n) || 0);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}
function safeJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function when(t?: number) {
  try {
    return t ? new Date(t).toLocaleString() : "";
  } catch {
    return "";
  }
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function copyRect(r: Rect): Rect {
  return {
    x: round(r.x),
    y: round(r.y),
    w: Math.max(1, round(r.w)),
    h: Math.max(1, round(r.h)),
  };
}
function authHeaders(json = false) {
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(st.adminKey ? { "x-solcraft-admin-key": st.adminKey } : {}),
  };
}
function saveKey() {
  try {
    localStorage.setItem(KEY_STORE, st.adminKey || "");
  } catch {}
}
function loadKey() {
  try {
    st.adminKey = localStorage.getItem(KEY_STORE) || "";
  } catch {}
}
function setStatus(msg: string, bad = false) {
  st.status = msg;
  st.err = bad ? msg : "";
  paint();
}

function selectedClip(): Clip | null {
  return st.clips.find((c: Clip) => c.id === st.selectedClipId) || null;
}
function replacements(atlasId = st.atlasId): Record<string, Placement> {
  if (!st.replacementsByAtlas[atlasId]) st.replacementsByAtlas[atlasId] = {};
  return st.replacementsByAtlas[atlasId];
}
function currentPlacement(): Placement | null {
  return replacements(st.atlasId)[String(st.selectedSlot)] || null;
}
function dirtyAtlasIds() {
  return ATLASES.map((a) => a.id).filter(
    (id) => Object.keys(replacements(id)).length > 0,
  );
}
function versionsForAtlas(id = st.atlasId) {
  return (st.versions || [])
    .filter((v: Version) => v.atlasId === id)
    .slice()
    .sort(
      (a, b) =>
        Number(b.published) - Number(a.published) ||
        Number(b.createdAt || 0) - Number(a.createdAt || 0),
    );
}
function runtimeUrlForAtlas(id: string) {
  const pub = st.publishedByAtlas?.[id];
  return (
    pub?.url ||
    `/api/atlas-runtime/${encodeURIComponent(id)}?v=${encodeURIComponent(pub?.createdAt || Date.now())}`
  );
}

function loadImage(src: string) {
  if (!src) return Promise.reject(new Error("no image source"));
  if (!imageCache.has(src))
    imageCache.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`could not load image: ${src}`));
        img.src = src;
      }),
    );
  return imageCache.get(src)!;
}

async function readJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  let j: any = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 700)}`);
  }
  st.debug = { url, status: r.status, response: j };
  if (!r.ok || j?.ok === false)
    throw new Error(
      String(j?.msg || j?.error || r.statusText || "request failed"),
    );
  return j;
}

async function load() {
  saveKey();
  st.busy = true;
  st.err = "";
  st.status = "Loading atlas runtime…";
  paint();
  try {
    const j = await readJson("/api/admin/atlas", {
      cache: "no-store",
      headers: authHeaders(),
    });
    st.versions = j.versions || j.images || [];
    st.publishedByAtlas = j.publishedByAtlas || {};
    st.status = "Loaded sprite sheets. Upload a source image and select clips.";
  } catch (e: any) {
    st.err = String(e?.message || e);
    st.status = st.err;
  }
  st.busy = false;
  paint();
}

async function onSourceUpload(file: File | null) {
  if (!file) return;
  try {
    if (st.sourceUrl?.startsWith("blob:")) URL.revokeObjectURL(st.sourceUrl);
  } catch {}
  const url = URL.createObjectURL(file);
  st.sourceUrl = url;
  st.sourceName = file.name;
  st.sourceRect = null;
  st.drag = null;
  st.status = `Loaded source image: ${file.name}`;
  st.err = "";
  try {
    const img = await loadImage(url);
    st.sourceW = img.naturalWidth || img.width || 0;
    st.sourceH = img.naturalHeight || img.height || 0;
    st.sourceRect = { x: 0, y: 0, w: st.sourceW, h: st.sourceH };
  } catch (e: any) {
    st.err = String(e?.message || e);
    st.status = st.err;
  }
  paint();
}

function sourceCanvasPoint(ev: any) {
  const cv = ev.currentTarget as HTMLCanvasElement;
  const rect = cv.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (cv.width / Math.max(1, rect.width));
  const py = (ev.clientY - rect.top) * (cv.height / Math.max(1, rect.height));
  const v = st.sourceView;
  if (!v) return null;
  const x = clamp((px - v.x) / v.scale, 0, st.sourceW);
  const y = clamp((py - v.y) / v.scale, 0, st.sourceH);
  return { x, y };
}
function sourceDown(ev: any) {
  const p = sourceCanvasPoint(ev);
  if (!p) return;
  st.drag = { x: p.x, y: p.y };
  st.sourceRect = { x: p.x, y: p.y, w: 1, h: 1 };
  paint();
}
function sourceMove(ev: any) {
  if (!st.drag) return;
  const p = sourceCanvasPoint(ev);
  if (!p) return;
  const x0 = Math.min(st.drag.x, p.x),
    y0 = Math.min(st.drag.y, p.y),
    x1 = Math.max(st.drag.x, p.x),
    y1 = Math.max(st.drag.y, p.y);
  st.sourceRect = {
    x: x0,
    y: y0,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
  };
  paint();
}
function sourceUp() {
  st.drag = null;
  if (st.sourceRect) st.sourceRect = copyRect(st.sourceRect);
  paint();
}
function useFullSource() {
  if (!st.sourceUrl) return setStatus("Upload a source image first.", true);
  st.sourceRect = { x: 0, y: 0, w: st.sourceW, h: st.sourceH };
  paint();
}
function adjustSourceRect(k: string, val: any) {
  if (!st.sourceRect)
    st.sourceRect = {
      x: 0,
      y: 0,
      w: Math.max(1, st.sourceW),
      h: Math.max(1, st.sourceH),
    };
  const r = st.sourceRect;
  r[k] = round(val);
  r.x = clamp(r.x, 0, Math.max(0, st.sourceW - 1));
  r.y = clamp(r.y, 0, Math.max(0, st.sourceH - 1));
  r.w = clamp(r.w, 1, Math.max(1, st.sourceW - r.x));
  r.h = clamp(r.h, 1, Math.max(1, st.sourceH - r.y));
  paint();
}

function addClipFromSelection() {
  if (!st.sourceUrl || !st.sourceRect)
    return setStatus("Upload a source image and drag a selection first.", true);
  const r = copyRect(st.sourceRect);
  const clip: Clip = {
    id: uid("clip"),
    name: `${st.sourceName || "source"} · ${r.w}×${r.h}`,
    sourceUrl: st.sourceUrl,
    sourceName: st.sourceName,
    sourceW: st.sourceW,
    sourceH: st.sourceH,
    rect: r,
    createdAt: Date.now(),
  };
  st.clips.unshift(clip);
  st.selectedClipId = clip.id;
  setStatus(
    `Added clip ${r.w}×${r.h}. Choose any sprite sheet cell to replace.`,
  );
}
function deleteClip(id: string) {
  st.clips = st.clips.filter((c: Clip) => c.id !== id);
  if (st.selectedClipId === id) st.selectedClipId = st.clips[0]?.id || "";
  // Keep existing placements intact; they carry their own source URL and rect snapshot.
  paint();
}
function selectClip(id: string) {
  st.selectedClipId = id;
  paint();
}

function ensureClip(): Clip | null {
  let c = selectedClip();
  if (c) return c;
  if (st.sourceUrl && st.sourceRect) {
    addClipFromSelection();
    return selectedClip();
  }
  setStatus("Select or add a source clip first.", true);
  return null;
}
function syncPlacementControls(p: Placement | null) {
  if (!p) return;
  st.fit = p.fit;
  st.pad = p.pad;
  st.dx = p.dx;
  st.dy = p.dy;
  st.scale = p.scale;
}
function selectAtlas(id: string) {
  st.atlasId = atlas(id).id;
  st.selectedSlot = 0;
  syncPlacementControls(currentPlacement());
  paint();
}
function selectSlot(i: number) {
  st.selectedSlot = i;
  syncPlacementControls(currentPlacement());
  paint();
}
function assignClipToSlot() {
  const c = ensureClip();
  if (!c) return;
  replacements(st.atlasId)[String(st.selectedSlot)] = {
    clipId: c.id,
    sourceUrl: c.sourceUrl,
    sourceName: c.sourceName,
    sourceW: c.sourceW,
    sourceH: c.sourceH,
    rect: copyRect(c.rect),
    fit: st.fit || "cover",
    pad: Math.max(0, round(st.pad)),
    dx: round(st.dx),
    dy: round(st.dy),
    scale: Math.max(0.05, Number(st.scale) || 1),
  };
  setStatus(
    `Queued replacement: ${atlas().label} / ${st.selectedSlot}. ${atlas().slots[st.selectedSlot]}`,
  );
}
function clearSlot() {
  delete replacements(st.atlasId)[String(st.selectedSlot)];
  setStatus(`Cleared replacement for ${atlas().label} / ${st.selectedSlot}.`);
}
function clearSheet() {
  st.replacementsByAtlas[st.atlasId] = {};
  setStatus(`Cleared queued replacements for ${atlas().label}.`);
}
function tweak(k: string, val: any) {
  if (k === "fit") st.fit = String(val || "cover");
  else if (k === "scale") st.scale = Math.max(0.05, Number(val) || 1);
  else st[k] = round(val);
  const p = currentPlacement();
  if (p) {
    p.fit = st.fit;
    p.pad = Math.max(0, round(st.pad));
    p.dx = round(st.dx);
    p.dy = round(st.dy);
    p.scale = Math.max(0.05, Number(st.scale) || 1);
  }
  paint();
}

function drawPlacement(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  p: Placement,
  dx: number,
  dy: number,
  size: number,
) {
  const pad = Math.max(0, Number(p.pad) || 0);
  const aw = Math.max(1, size - pad * 2),
    ah = Math.max(1, size - pad * 2);
  const srcW = Math.max(1, p.rect.w),
    srcH = Math.max(1, p.rect.h);
  let dw = aw,
    dh = ah;
  if (p.fit !== "stretch") {
    const base =
      p.fit === "contain"
        ? Math.min(aw / srcW, ah / srcH)
        : Math.max(aw / srcW, ah / srcH);
    const scale = base * Math.max(0.05, Number(p.scale) || 1);
    dw = srcW * scale;
    dh = srcH * scale;
  }
  const x = dx + pad + (aw - dw) / 2 + (Number(p.dx) || 0);
  const y = dy + pad + (ah - dh) / 2 + (Number(p.dy) || 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, size, size);
  ctx.clip();
  ctx.clearRect(dx, dy, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, p.rect.x, p.rect.y, p.rect.w, p.rect.h, x, y, dw, dh);
  ctx.restore();
}

async function composeSheetCanvas(a = atlas()) {
  const cv = document.createElement("canvas");
  cv.width = sheetW(a);
  cv.height = sheetH(a);
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, cv.width, cv.height);
  try {
    const base = await loadImage(runtimeUrlForAtlas(a.id));
    ctx.drawImage(base, 0, 0, cv.width, cv.height);
  } catch {
    ctx.fillStyle = "rgba(16,32,24,.85)";
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  const map = replacements(a.id);
  for (const key of Object.keys(map)) {
    const idx = Number(key);
    if (!Number.isFinite(idx) || idx < 0 || idx >= a.slots.length) continue;
    const img = await loadImage(map[key].sourceUrl);
    const x = (idx % a.cols) * a.cell,
      y = Math.floor(idx / a.cols) * a.cell;
    drawPlacement(ctx, img, map[key], x, y, a.cell);
  }
  return cv;
}

async function uploadComposed(
  atlasId = st.atlasId,
  publish = !!st.publishAfterUpload,
) {
  const a = atlas(atlasId);
  if (!Object.keys(replacements(a.id)).length)
    return setStatus(`No queued replacements for ${a.label}.`, true);
  st.busy = true;
  st.err = "";
  st.status = `Composing ${a.label} sprite sheet…`;
  paint();
  try {
    const cv = await composeSheetCanvas(a);
    const blob: Blob = await new Promise((res, rej) =>
      cv.toBlob(
        (b) => (b ? res(b) : rej(new Error("could not create png"))),
        "image/png",
      ),
    );
    const file = new File([blob], `${a.id}_spritesheet_${Date.now()}.png`, {
      type: "image/png",
    });
    const form = new FormData();
    form.set("action", "upload");
    form.set("atlas", a.id);
    form.set("file", file);
    const j = await readJson("/api/admin/atlas", {
      method: "POST",
      headers: authHeaders(false),
      body: form,
    });
    st.versions =
      j.versions || j.images || [j.version, ...st.versions].filter(Boolean);
    if (publish && j.version?.id) {
      const p = await readJson("/api/admin/atlas", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          action: "publish",
          atlas: a.id,
          versionId: j.version.id,
          bounds: { x0: 0, y0: 0, x1: cv.width, y1: cv.height },
          pad: 0,
        }),
      });
      st.versions = p.versions || p.images || st.versions;
      st.publishedByAtlas = p.publishedByAtlas || st.publishedByAtlas;
    }
    st.replacementsByAtlas[a.id] = {};
    st.status = `${publish ? "Published" : "Uploaded"} ${a.label} sprite sheet (${cv.width}×${cv.height}).`;
  } catch (e: any) {
    st.err = String(e?.message || e);
    st.status = st.err;
  }
  st.busy = false;
  paint();
}

async function uploadAllDirty() {
  const ids = dirtyAtlasIds();
  if (!ids.length) return setStatus("No queued replacements yet.", true);
  for (const id of ids) await uploadComposed(id, !!st.publishAfterUpload);
  setStatus(
    `Finished ${ids.length} sprite sheet${ids.length === 1 ? "" : "s"}.`,
  );
}

async function publishVersion(v: Version) {
  const a = atlas(v.atlasId);
  st.busy = true;
  st.err = "";
  st.status = `Publishing ${a.label} version…`;
  paint();
  try {
    const p = await readJson("/api/admin/atlas", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({
        action: "publish",
        atlas: a.id,
        versionId: v.id,
        bounds: { x0: 0, y0: 0, x1: v.w || sheetW(a), y1: v.h || sheetH(a) },
        pad: 0,
      }),
    });
    st.versions = p.versions || p.images || st.versions;
    st.publishedByAtlas = p.publishedByAtlas || st.publishedByAtlas;
    st.status = `Published ${a.label}.`;
  } catch (e: any) {
    st.err = String(e?.message || e);
    st.status = st.err;
  }
  st.busy = false;
  paint();
}

async function drawSourceCanvas() {
  const seq = ++sourceDrawSeq;
  const cv = root()?.querySelector(
    "#source-canvas",
  ) as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  const cssW = Math.max(360, cv.parentElement?.clientWidth || 720);
  cv.width = cssW;
  cv.height = clamp(Math.round(cssW * 0.44), 320, 460);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#07101a";
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (!st.sourceUrl) {
    ctx.fillStyle = "#b9af9d";
    ctx.font = "14px ui-monospace,monospace";
    ctx.fillText(
      "Upload any image. Drag boxes on it to create reusable clips.",
      22,
      38,
    );
    st.sourceView = null;
    return;
  }
  try {
    const img = await loadImage(st.sourceUrl);
    if (seq !== sourceDrawSeq) return;
    st.sourceW = img.naturalWidth || img.width || st.sourceW;
    st.sourceH = img.naturalHeight || img.height || st.sourceH;
    const fit =
      Math.min(
        cv.width / Math.max(1, st.sourceW),
        cv.height / Math.max(1, st.sourceH),
      ) * 0.94;
    const w = st.sourceW * fit,
      h = st.sourceH * fit,
      x = (cv.width - w) / 2,
      y = (cv.height - h) / 2;
    st.sourceView = { x, y, w, h, scale: fit };
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    const r = st.sourceRect;
    if (r) {
      const rx = x + r.x * fit,
        ry = y + r.y * fit,
        rw = r.w * fit,
        rh = r.h * fit;
      ctx.fillStyle = "rgba(20,241,149,.10)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "#14f195";
      ctx.lineWidth = 3;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = "#fff0c8";
      ctx.font = "11px ui-monospace,monospace";
      ctx.fillText(
        `${round(r.x)},${round(r.y)} · ${round(r.w)}×${round(r.h)}`,
        rx + 6,
        ry + 16,
      );
    }
  } catch (e: any) {
    ctx.fillStyle = "#ff9a88";
    ctx.font = "13px ui-monospace,monospace";
    ctx.fillText(String(e?.message || e), 22, 38);
  }
}

async function drawSheetCanvas() {
  const seq = ++sheetDrawSeq;
  const cv = root()?.querySelector("#sheet-canvas") as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext("2d")!;
  const a = atlas();
  const cssW = Math.max(360, cv.parentElement?.clientWidth || 720);
  cv.width = cssW;
  cv.height = clamp(Math.round(cssW * 0.62), 420, 620);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#07101a";
  ctx.fillRect(0, 0, cv.width, cv.height);
  try {
    const sheet = await composeSheetCanvas(a);
    if (seq !== sheetDrawSeq) return;
    const fit =
      Math.min(cv.width / sheet.width, cv.height / sheet.height) * 0.94;
    const w = sheet.width * fit,
      h = sheet.height * fit,
      x = (cv.width - w) / 2,
      y = (cv.height - h) / 2;
    ctx.drawImage(sheet, x, y, w, h);
    const cw = w / a.cols,
      ch = h / a.rows;
    for (let i = 0; i < a.slots.length; i++) {
      const sx = x + (i % a.cols) * cw,
        sy = y + Math.floor(i / a.cols) * ch;
      const dirty = !!replacements(a.id)[String(i)];
      ctx.strokeStyle =
        i === st.selectedSlot
          ? "#14f195"
          : dirty
            ? "rgba(255,215,110,.80)"
            : "rgba(255,255,255,.18)";
      ctx.lineWidth = i === st.selectedSlot ? 3 : dirty ? 2 : 1;
      ctx.strokeRect(sx, sy, cw, ch);
      if (dirty) {
        ctx.fillStyle = "rgba(255,215,110,.88)";
        ctx.font = "10px ui-monospace,monospace";
        ctx.fillText("queued", sx + 5, sy + 13);
      }
    }
  } catch (e: any) {
    ctx.fillStyle = "#ff9a88";
    ctx.font = "13px ui-monospace,monospace";
    ctx.fillText(String(e?.message || e), 22, 38);
  }
}

function drawCanvases() {
  setTimeout(() => {
    drawSourceCanvas();
    drawSheetCanvas();
  }, 0);
}

function normalizeClassNames(scope?: Element | Document | null) {
  try {
    const rootEl: any = scope || document;
    const nodes = rootEl.querySelectorAll?.('[className]') || [];
    nodes.forEach?.((el: any) => {
      const v = el.getAttribute?.('className');
      if (v && el.getAttribute?.('class') !== v) el.setAttribute?.('class', v);
    });
  } catch {}
}

function paint() {
  ensureStyle();
  const r = root();
  if (!r) return;
  render(<App />, r);
  normalizeClassNames(r);
  drawCanvases();
}

function Header() {
  const dirty = dirtyAtlasIds();
  return (
    <section className="hero forgeHero">
      <div className="heroCopy">
        <p className="kicker">SolCraft Admin · fixed-grid sprite sheets</p>
        <h1>Sprite Sheet Forge</h1>
        <p className="tiny">
          Upload one source image, cut reusable clips, assign them to cells
          across Terrain, Building, FX, UI, or Doll, then compose only the
          sheets you changed.
        </p>
        {st.err ? (
          <p className="bad">{st.err}</p>
        ) : (
          <p className="ok">{st.status}</p>
        )}
      </div>
      <div className="heroActions">
        <div className="row">
          <a className="btn" href="/admin">
            ← Admin
          </a>
          <a className="btn" href="/">
            Open game
          </a>
          <button className="btn" onClick={load} disabled={st.busy}>
            Reload runtime
          </button>
        </div>
        <div className="row">
          <span className="pill">clips {st.clips.length}</span>
          <span className="pill warn">dirty {dirty.join(", ") || "none"}</span>
        </div>
      </div>
    </section>
  );
}
function SourcePanel() {
  const r = st.sourceRect || { x: 0, y: 0, w: 0, h: 0 };
  return (
    <section className="panel sourcePanel">
      <div className="panelHead">
        <span className="step">1</span>
        <div>
          <h2>Source image</h2>
          <p className="tiny">
            Drag rectangles on the source. Each saved rectangle becomes a
            reusable clip.
          </p>
        </div>
      </div>
      <div className="split">
        <div className="field">
          <label>Admin key</label>
          <input
            value={st.adminKey || ""}
            placeholder="Only needed if admin key is enabled"
            onInput={(e: any) => {
              st.adminKey = e.currentTarget.value;
              saveKey();
            }}
          />
        </div>
        <div className="field">
          <label>Upload source PNG/JPG/WebP</label>
          <input
            type="file"
            accept="image/*,.png,.jpg,.jpeg,.webp"
            onChange={(e: any) =>
              onSourceUpload(e.currentTarget.files?.[0] || null)
            }
          />
        </div>
      </div>
      <div className="canvasWrap sourceWrap">
        <canvas
          id="source-canvas"
          onMouseDown={sourceDown}
          onMouseMove={sourceMove}
          onMouseUp={sourceUp}
          onMouseLeave={sourceUp}
        ></canvas>
      </div>
      <div className="coords compactCoords">
        {["x", "y", "w", "h"].map((k) => (
          <div className="field">
            <label>{k}</label>
            <input
              type="number"
              value={r[k] || 0}
              onInput={(e: any) => adjustSourceRect(k, e.currentTarget.value)}
            />
          </div>
        ))}
      </div>
      <div className="row panelFoot">
        <button className="btn" onClick={useFullSource}>
          Use full image
        </button>
        <button className="btn primary" onClick={addClipFromSelection}>
          Add clip
        </button>
        <span className="pill">source {st.sourceName || "none"}</span>
        <span className="pill">
          {st.sourceW || "?"}×{st.sourceH || "?"}
        </span>
      </div>
    </section>
  );
}
function ClipsPanel() {
  return (
    <section className="panel clipsPanel">
      <div className="panelHead">
        <span className="step">2</span>
        <div>
          <h2>Clips</h2>
          <p className="tiny">
            Reusable source rectangles. Select one, then choose a target cell.
          </p>
        </div>
      </div>
      {!st.clips.length ? (
        <p className="emptyText">
          No clips yet. Drag a source rectangle and add it here.
        </p>
      ) : (
        <div className="clips">
          {st.clips.map((c: Clip) => (
            <button
              className={`clip ${c.id === st.selectedClipId ? "on" : ""}`}
              onClick={() => selectClip(c.id)}
            >
              <span>
                <b>{c.name}</b>
                <small>
                  {c.sourceName} · x{c.rect.x} y{c.rect.y} · {c.rect.w}×
                  {c.rect.h}
                </small>
              </span>
              <span
                className="btn danger"
                onClick={(ev: any) => {
                  ev.stopPropagation();
                  deleteClip(c.id);
                }}
              >
                Delete
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function AtlasTools() {
  const a = atlas();
  const map = replacements(a.id);
  const p = currentPlacement();
  return (
    <section className="panel targetPanel">
      <div className="panelHead">
        <span className="step">3</span>
        <div>
          <h2>Target sprite sheet</h2>
          <p className="tiny">
            Pick a sheet and a cell. The cell grid mirrors the actual sprite
            sheet grid.
          </p>
        </div>
      </div>
      <div className="atlasTabs">
        {ATLASES.map((x) => (
          <button
            className={`btn ${x.id === st.atlasId ? "on" : ""}`}
            onClick={() => selectAtlas(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="sheetStats">
        <span className="pill">
          {a.cols}×{a.rows}
        </span>
        <span className="pill">{a.slots.length} cells</span>
        <span className="pill">
          output {sheetW(a)}×{sheetH(a)}
        </span>
        <span className="pill warn">queued {Object.keys(map).length}</span>
      </div>
      <div className={`slotgrid cols${a.cols}`}>
        {a.slots.map((s, i) => (
          <button
            className={`slot ${i === st.selectedSlot ? "on" : ""} ${map[String(i)] ? "dirty" : ""}`}
            onClick={() => selectSlot(i)}
          >
            <b>
              <span>{i}</span>
              {s}
            </b>
            <small>
              {map[String(i)]
                ? `queued from ${map[String(i)].sourceName}`
                : "runtime"}
            </small>
          </button>
        ))}
      </div>
      <div className="tools">
        <div className="field">
          <label>fit</label>
          <select
            value={st.fit}
            onInput={(e: any) => tweak("fit", e.currentTarget.value)}
          >
            <option value="cover">cover cell</option>
            <option value="contain">contain</option>
            <option value="stretch">stretch</option>
          </select>
        </div>
        <div className="field">
          <label>pad</label>
          <input
            type="number"
            value={st.pad}
            onInput={(e: any) => tweak("pad", e.currentTarget.value)}
          />
        </div>
        <div className="field">
          <label>dx</label>
          <input
            type="number"
            value={st.dx}
            onInput={(e: any) => tweak("dx", e.currentTarget.value)}
          />
        </div>
        <div className="field">
          <label>dy</label>
          <input
            type="number"
            value={st.dy}
            onInput={(e: any) => tweak("dy", e.currentTarget.value)}
          />
        </div>
        <div className="field">
          <label>scale</label>
          <input
            type="number"
            step="0.05"
            value={st.scale}
            onInput={(e: any) => tweak("scale", e.currentTarget.value)}
          />
        </div>
      </div>
      <div className="row panelFoot">
        <button className="btn primary" onClick={assignClipToSlot}>
          Use selected clip → selected cell
        </button>
        <button className="btn danger" onClick={clearSlot} disabled={!p}>
          Clear cell
        </button>
        <button
          className="btn danger"
          onClick={clearSheet}
          disabled={!Object.keys(map).length}
        >
          Clear sheet queue
        </button>
      </div>
    </section>
  );
}
function PreviewPanel() {
  const dirty = dirtyAtlasIds();
  return (
    <section className="panel previewPanel">
      <div className="panelHead">
        <span className="step">4</span>
        <div>
          <h2>Preview, compose, publish</h2>
          <p className="tiny">
            Preview uses runtime sheet as the base and draws queued cells on
            top.
          </p>
        </div>
      </div>
      <div className="canvasWrap sheetWrap">
        <canvas id="sheet-canvas"></canvas>
      </div>
      <div className="row panelFoot">
        <label className="pill">
          <input
            type="checkbox"
            checked={!!st.publishAfterUpload}
            onInput={(e: any) => {
              st.publishAfterUpload = !!e.currentTarget.checked;
              paint();
            }}
          />{" "}
          publish after upload
        </label>
        <button
          className="btn primary"
          onClick={() => uploadComposed(st.atlasId, !!st.publishAfterUpload)}
          disabled={st.busy || !Object.keys(replacements(st.atlasId)).length}
        >
          Compose current sheet
        </button>
        <button
          className="btn warn"
          onClick={uploadAllDirty}
          disabled={st.busy || !dirty.length}
        >
          Compose all dirty sheets
        </button>
      </div>
    </section>
  );
}
function Versions() {
  const list = versionsForAtlas();
  return (
    <section className="panel versionsPanel">
      <div className="panelHead">
        <span className="step savedStep">V</span>
        <div>
          <h2>Saved versions</h2>
          <p className="tiny">
            Publish a previous generated sheet for the selected atlas.
          </p>
        </div>
      </div>
      {!list.length ? (
        <p className="emptyText">No saved versions for {atlas().label} yet.</p>
      ) : (
        <div className="versions">
          {list.map((v: Version) => (
            <button
              className={`version ${v.published ? "on" : ""}`}
              onClick={() => publishVersion(v)}
              disabled={st.busy}
            >
              <span>
                <b>{v.label || v.fileName || v.id}</b>
                <small>
                  {v.id} · {v.w || "?"}×{v.h || "?"} · {when(v.createdAt)}
                </small>
              </span>
              <span className="pill">{v.published ? "live" : "publish"}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function Debug() {
  return (
    <details className="panel debugPanel">
      <summary>Debug</summary>
      <pre className="debug">
        {safeJson({
          atlas: st.atlasId,
          selectedSlot: st.selectedSlot,
          selectedClipId: st.selectedClipId,
          dirtyAtlasIds: dirtyAtlasIds(),
          currentPlacement: currentPlacement(),
          lastApi: st.debug,
        })}
      </pre>
    </details>
  );
}
function App() {
  return (
    <main className="af4">
      <style>{CSS}</style>
      <Header />
      <div className="layout">
        <SourcePanel />
        <AtlasTools />
        <PreviewPanel />
        <ClipsPanel />
        <Versions />
        <Debug />
      </div>
    </main>
  );
}

function onKey(ev: any) {
  if (ev.target && ["INPUT", "TEXTAREA", "SELECT"].includes(ev.target.tagName))
    return;
  const a = atlas();
  if (ev.key === "[") selectSlot(Math.max(0, st.selectedSlot - 1));
  if (ev.key === "]")
    selectSlot(Math.min(a.slots.length - 1, st.selectedSlot + 1));
  if (ev.key.toLowerCase() === "a") assignClipToSlot();
}
export default function mount() {
  const r = root();
  if (!r || mounted) return;
  mounted = true;
  ensureStyle();
  loadKey();
  r.addEventListener("keydown", onKey, true);
  paint();
  load();
}
