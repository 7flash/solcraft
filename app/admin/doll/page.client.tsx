// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { measure } from "measure-fn";
import { clearDollTextureCache, composeDollCanvas, loadSavedDollParts, normalizeDollParts, saveDollParts, type DollParts } from "../../../client/dolls";

type RuntimeDoll = { url: string; bounds: { x0: number; y0: number; x1: number; y1: number }; pad: number; cells: number; cols: number; rows: number; version: string };

const rootId = "solcraft-doll-creator";
let mounted = false;

const ROWS = [
  { key: "head", label: "Head", row: 0, note: "complete face/head" },
  { key: "hair", label: "Hair", row: 1, note: "optional; no hats" },
  { key: "torso", label: "Torso", row: 2, note: "upper outfit" },
  { key: "legs", label: "Legs", row: 3, note: "lower outfit" },
  { key: "back", label: "Back", row: 4, note: "optional back item" },
  { key: "tool", label: "Tool", row: 5, note: "optional hand item" },
];

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchRuntimeDoll(): Promise<RuntimeDoll | null> {
  const res = await fetch("/api/atlas-runtime", { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  const raw = json?.atlases?.doll || json?.runtime?.doll || json?.doll;
  if (!raw?.url) return null;
  const b = raw.bounds || { x0: 0, y0: 0, x1: 1024, y1: 768 };
  return {
    url: String(raw.url),
    bounds: { x0: Number(b.x0 || 0), y0: Number(b.y0 || 0), x1: Number(b.x1 || 1024), y1: Number(b.y1 || 768) },
    pad: Number(raw.pad || 0) || 0,
    cells: Number(raw.cells || raw.cols || 8) || 8,
    cols: Number(raw.cols || raw.cells || 8) || 8,
    rows: Number(raw.rows || 6) || 6,
    version: String(raw.version || raw.versionId || raw.url || ""),
  };
}

function cellStyle(rt: RuntimeDoll, row: number, col: number) {
  const b = rt.bounds;
  const cols = rt.cols || rt.cells || 8;
  const rows = rt.rows || 6;
  const w = Math.max(1, b.x1 - b.x0);
  const h = Math.max(1, b.y1 - b.y0);
  const cw = w / cols;
  const ch = h / rows;
  return `left:${b.x0 + col * cw}px;top:${b.y0 + row * ch}px;width:${cw}px;height:${ch}px;`;
}

function rowLabelStyle(rt: RuntimeDoll, row: number) {
  const b = rt.bounds;
  const ch = Math.max(1, b.y1 - b.y0) / (rt.rows || 6);
  return `top:${b.y0 + row * ch + 4}px;`;
}

export default function mount() {
  const root = byId(rootId);
  if (!root || mounted) return;
  mounted = true;

  const st: {
    parts: DollParts;
    runtime: RuntimeDoll | null;
    status: string;
    err: string;
    selectedRow: string;
    cacheBust: number;
  } = {
    parts: loadSavedDollParts(),
    runtime: null,
    status: "Loading Doll runtime atlas…",
    err: "",
    selectedRow: "head",
    cacheBust: Date.now(),
  };

  function queuePreview() {
    requestAnimationFrame(() => {
      const canvas = byId<HTMLCanvasElement>("doll-preview-canvas");
      if (!canvas) return;
      composeDollCanvas(canvas, { dollParts: st.parts }, 512).then(() => {}).catch(() => {});
    });
  }

  async function load() {
    await measure("solcraft.admin.dollCreator.load", async () => {
      try {
        st.cacheBust = Date.now();
        clearDollTextureCache();
        st.runtime = await fetchRuntimeDoll();
        st.status = st.runtime ? "Loaded published Doll atlas" : "No published Doll atlas found";
        st.err = "";
      } catch (e: any) {
        st.err = String(e?.message || e || "runtime load failed");
        st.status = "Load failed";
      }
      paint();
    });
  }

  function setPart(key: string, value: number) {
    st.parts = normalizeDollParts({ ...st.parts, [key]: clamp(value, 0, 7) });
    st.selectedRow = key;
    saveDollParts(st.parts);
    st.status = "Saved locally. The live character updates in game after the next profile save.";
    paint();
  }

  function setFlag(key: "showHat" | "showBack" | "showTool", value: boolean) {
    st.parts = normalizeDollParts({ ...st.parts, [key]: value });
    saveDollParts(st.parts);
    st.status = "Saved locally. The live character updates in game after the next profile save.";
    paint();
  }

  function randomize() {
    const pick = () => Math.floor(Math.random() * 8);
    st.parts = normalizeDollParts({
      head: pick(),
      hair: pick(),
      torso: pick(),
      legs: pick(),
      back: pick(),
      tool: pick(),
      showBack: Math.random() > 0.55,
      showTool: Math.random() > 0.5,
    });
    saveDollParts(st.parts);
    st.status = "Randomized and saved locally.";
    paint();
  }

  function reset() {
    st.parts = normalizeDollParts({
      head: 0, hair: 0, torso: 0, legs: 0, back: 0, tool: 0,
      showBack: false, showTool: false,
    });
    saveDollParts(st.parts);
    st.status = "Reset and saved locally.";
    paint();
  }

  function onDelegatedClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement | null)?.closest?.("[data-doll-action]") as HTMLElement | null;
    if (!el || !root.contains(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = el.dataset.dollAction || "";
    if (action === "randomize") return randomize();
    if (action === "reset") return reset();
    if (action === "copy-json") return navigator.clipboard?.writeText(JSON.stringify(st.parts, null, 2));
    if (action === "reload") return load();
    if (action === "open-atlas") return window.open("/admin/atlas?atlas=doll", "_blank");
    if (action === "set-part") return setPart(String(el.dataset.key || "head"), Number(el.dataset.col || 0));
  }

  function runtimeImageSrc(rt: RuntimeDoll) {
    const sep = String(rt.url).includes("?") ? "&" : "?";
    return `${rt.url}${sep}dollStudio=${st.cacheBust}`;
  }

  function onDelegatedDollInput(ev: Event) {
    const input = (ev.target as HTMLElement | null)?.closest?.("[data-doll-input]") as HTMLInputElement | null;
    if (!input || !root.contains(input)) return;
    const kind = String(input.dataset.dollInput || "");
    if (kind === "part") return setPart(String(input.dataset.key || "head"), Number(input.value));
  }

  function onDelegatedDollChange(ev: Event) {
    const input = (ev.target as HTMLElement | null)?.closest?.("[data-doll-input]") as HTMLInputElement | null;
    if (!input || !root.contains(input)) return;
    const kind = String(input.dataset.dollInput || "");
    if (kind === "show-back") return setFlag("showBack", !!input.checked);
    if (kind === "show-tool") return setFlag("showTool", !!input.checked);
  }

  function onDelegatedDollLoad(ev: Event) {
    const img = (ev.target as HTMLElement | null)?.closest?.("[data-doll-load='runtime']") as HTMLImageElement | null;
    if (!img || !root.contains(img)) return;
    queuePreview();
  }

  root.addEventListener("click", onDelegatedClick, true);
  root.addEventListener("input", onDelegatedDollInput, true);
  root.addEventListener("change", onDelegatedDollChange, true);
  root.addEventListener("load", onDelegatedDollLoad, true);

  function ControlsView() {
    return <aside className="panel story-panel preview-panel">
      <div>
        <p className="kicker">Character creator</p>
        <h2>Preview</h2>
      </div>
      <div className="preview">
        <canvas id="doll-preview-canvas" width="512" height="512"></canvas>
      </div>
      <div className="actions">
        <button className="primary" data-doll-action="randomize">Randomize</button>
        <button data-doll-action="reset">Reset</button>
        <button data-doll-action="copy-json">Copy JSON</button>
      </div>
      <section className="controls">
        {ROWS.map((r) => <div className="control-row">
          <label>{r.label}</label>
          <input type="range" min="0" max="7" value={st.parts[r.key]} data-doll-input="part" data-key={r.key} />
          <output>{st.parts[r.key]}</output>
        </div>)}
        <div className="checks">
          <label><input type="checkbox" checked={!!st.parts.showBack} data-doll-input="show-back" /> show back item</label>
          <label><input type="checkbox" checked={!!st.parts.showTool} data-doll-input="show-tool" /> show tool</label>
        </div>
      </section>
      <div className="meta">{st.status}{st.err ? ` · ${st.err}` : ""}</div>
    </aside>;
  }

  function SheetView() {
    const rt = st.runtime;
    return <section className="panel story-panel sheet-panel">
      <div className="toolbar">
        <div>
          <p className="kicker">Doll atlas slots</p>
          <h2>Pick parts</h2>
          <div className="meta">Click a runtime slot, or use sliders. This editor only shows the six rows the game actually uses.</div>
        </div>
        <div className="actions">
          <button data-doll-action="reload">Reload atlas</button>
          <button data-doll-action="open-atlas">Open Atlas Studio</button>
        </div>
      </div>
      {!rt ? <div className="help"><pre>No published Doll atlas detected. Publish Doll atlas in Atlas Studio first.</pre></div> : <div className="sheet-scroll">
        <div className="sheet-stage" style={`width:${rt.bounds.x1}px;height:${rt.bounds.y1}px;`}>
          <img src={runtimeImageSrc(rt)} alt="Doll atlas" data-doll-load="runtime" />
          {ROWS.map((r) => <div className="row-label" style={rowLabelStyle(rt, r.row)}>{r.label}</div>)}
          {ROWS.flatMap((r) => Array.from({ length: 8 }, (_, col) => {
            const on = st.parts[r.key] === col;
            return <button className={on ? "cell-button on" : "cell-button"} style={cellStyle(rt, r.row, col)} data-doll-action="set-part" data-key={r.key} data-col={String(col)} aria-label={`${r.label} ${col}`}></button>;
          }))}
        </div>
      </div>}
    </section>;
  }

  function HelpView() {
    return <aside className="panel story-panel help">
      <div>
        <p className="kicker">Runtime rule</p>
        <h2>How this works</h2>
      </div>
      <pre>{`Doll atlas v3 is a functional parts sheet.

Runtime rows:
0 head0..head7 — complete readable heads/faces. Humans, aliens, creatures, robots, plants are fine.
1 hair0..hair7 — optional hair/crest/frill overlays only. No hats and nothing over the eyes.
2 torso0..torso7 — outfits / upper body.
3 legs0..legs7 — lower body.
4 back0..back7 — optional capes, packs, wings/back items.
5 tool0..tool7 — optional held item/tool silhouettes.

Use an 8×6 atlas image/crop: 8 columns, 6 runtime rows. Recommended target is 1024×768 with 128×128 cells.

There are no reserved rows and no concept rows in the runtime contract. Do not include separate skin, face-overlay, hat, helmet, mask, or concept-reference rows. Heads already include face/skin/alien shape, so extra overlays cannot cover the face.`}</pre>
    </aside>;
  }

  function App() {
    return <main className="doll-creator">
      <section className="hero story-panel">
        <p className="kicker">SolCraft admin</p>
        <h1>Doll Creator</h1>
        <p>Compose one playable character from the published Doll v3 atlas. The game uses only Head, Hair, Torso, Legs, Back, and Tool rows.</p>
      </section>
      <section className="layout">
        {ControlsView()}
        {SheetView()}
        {HelpView()}
      </section>
    </main>;
  }

  function paint() {
    render(App(), root);
    queuePreview();
  }

  paint();
  load();
}