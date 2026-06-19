// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";

const rootId = "tradjs-debug-root";
let mounted = false;

const CSS = `.tdbg{min-height:100vh;padding:16px;background:#05080e;color:#f3ead7;font-family:Inter,system-ui,sans-serif}.tdbg *{box-sizing:border-box}.panel{border:1px solid rgba(243,234,215,.16);border-radius:18px;background:#0b1420;padding:14px;margin:12px 0}.tabs,.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.btn{border:1px solid rgba(243,234,215,.18);border-radius:999px;background:#111c2b;color:#f3ead7;padding:8px 12px;font-weight:900;cursor:pointer;text-decoration:none}.btn.on,.ok{background:#14f195;color:#06120d}.bad{background:#ff705c;color:#150806}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{border:1px solid rgba(243,234,215,.14);border-radius:14px;background:rgba(243,234,215,.05);padding:10px}.log{white-space:pre-wrap;font:12px/1.35 ui-monospace,monospace;background:#02050a;border-radius:12px;padding:10px;max-height:260px;overflow:auto}@media(max-width:800px){.grid{grid-template-columns:1fr}}`;

const rows = [
  { id: "open-character", cat: "actions", title: "Open Character" },
  { id: "open-guide", cat: "actions", title: "Open Guide" },
  { id: "build-house", cat: "buildings", title: "Build House" },
  { id: "build-warehouse", cat: "buildings", title: "Build Warehouse" },
  { id: "earn-coins", cat: "economy", title: "Earn Coins" },
];

let tab = "actions";
let claimed: any = {};
let mode = "close";
let closureValue = "alpha";
let asyncPending = "";
let log: string[] = [];

function add(s: string) { log.unshift(`${new Date().toLocaleTimeString()} ${s}`); log = log.slice(0, 40); }
function visible() { return rows.filter((r) => r.cat === tab); }

function check() {
  const stale = [...document.querySelectorAll("#tradjs-debug-root [data-click]")]
    .map((e: any) => e.outerHTML)
    .filter((h) => h.includes("data-tab") || h.includes("data-guide-claim"));
  const visibleIds = [...document.querySelectorAll("#tradjs-debug-root [data-row-id]")].map((e: any) => e.getAttribute("data-row-id"));
  const claimIds = [...document.querySelectorAll("#tradjs-debug-root [data-guide-claim]")].map((e: any) => e.getAttribute("data-guide-claim"));
  const closureActual = document.querySelector("#tradjs-debug-root [data-closure-value]")?.textContent || "";
  const sameNodeStale = mode === "tab" && !!document.getElementById("same-node")?.getAttribute("data-click");
  return {
    tab,
    closureValue,
    closureActual,
    closurePass: !closureActual || closureActual === closureValue,
    visibleIds,
    claimIds,
    staleClickOnGuideNodes: stale,
    sameNodeStale,
    pass: !sameNodeStale && stale.length === 0 && visibleIds.every((id) => rows.find((r) => r.id === id)?.cat === tab) && (!closureActual || closureActual === closureValue),
  };
}

function ClosureProbe() {
  return <strong data-closure-value={closureValue}>{closureValue}</strong>;
}

function App() {
  const result = check();
  return <main className="tdbg">
    <style>{CSS}</style>
    <a className="btn" href="/admin">← Admin</a>
    <h1>TradJS reliability debug</h1>
    <p>This page exercises the real patterns that broke Guide tabs and Claim buttons: closure state, normal JSX event handlers, filtered cards, conditional claim buttons, async updates, and same-position node reuse.</p>

    <section className="panel">
      <h2>0. Closure-state rerender test</h2>
      <p>The old bug was component memoization before reconciliation: props were unchanged, so components that read closure/global state did not rerender. This must update immediately.</p>
      <div className="row">
        <button className="btn" onClick={() => { closureValue = closureValue === "alpha" ? "beta" : "alpha"; add(`closure -> ${closureValue}`); paint(); }}>Toggle closure value</button>
        <ClosureProbe />
        <span className={result.closurePass ? "ok" : "bad"}>{result.closurePass ? "PASS" : "FAIL"}</span>
      </div>
    </section>

    <section className="panel">
      <h2>1. Prop removal / same-position reuse</h2>
      <div className="row"><button className="btn" onClick={() => { mode = mode === "close" ? "tab" : "close"; add(`mode -> ${mode}`); paint(); }}>Toggle close/tab node</button></div>
      {mode === "close" ? <button id="same-node" className="btn" data-click="panel-close">Close-like button</button> : <button id="same-node" className="btn" data-tab="buildings">Buildings-like tab</button>}
      <p className={result.sameNodeStale ? "bad" : "ok"}>{result.sameNodeStale ? "FAIL: old data-click survived" : "PASS/ready: no stale close attribute detected"}</p>
    </section>

    <section className="panel">
      <h2>2. Guide-shaped tabs and claim buttons with normal JSX events</h2>
      <div className="tabs">{["actions", "buildings", "economy"].map((t) => <button className={tab === t ? "btn on" : "btn"} onClick={() => { tab = t; add(`tab -> ${tab}`); paint(); }}>{t}</button>)}</div>
      <div className="grid">{visible().map((row) => <div className="card" data-row-id={row.id}>
        <b>{row.title}</b>
        <p>{claimed[row.id] ? "claimed" : "ready"}</p>
        {claimed[row.id] ? <em>✓ reward claimed</em> : <button className="btn" onClick={() => { claimed[row.id] = true; add(`claim ${row.id}`); paint(); }}>Claim</button>}
      </div>)}</div>
    </section>

    <section className="panel">
      <h2>3. Async claim simulation</h2>
      <div className="row"><button className="btn" onClick={() => { asyncPending = "build-house"; add(`async start ${asyncPending}`); paint(); setTimeout(() => { claimed[asyncPending] = true; add(`async complete ${asyncPending}`); asyncPending = ""; paint(); }, 350); }}>Fake delayed claim: build-house</button><span>{asyncPending ? `pending ${asyncPending}` : "idle"}</span></div>
    </section>

    <section className="panel"><h2>Current check</h2><pre className="log">{JSON.stringify(result, null, 2)}</pre></section>
    <section className="panel"><h2>Event log</h2><pre className="log">{log.join("\n")}</pre></section>
  </main>;
}

function paint() { render(<App />, document.getElementById(rootId)!); }

export default function mount() {
  const root = document.getElementById(rootId);
  if (!root || mounted) return;
  mounted = true;
  paint();
}
