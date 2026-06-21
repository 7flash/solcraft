// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { explainAdminError, readAdminKey, writeAdminKey } from "../../../client/admin/adminKey";
import { normalizeProductionOrigin } from "../../../client/admin/worldSyncImport";

const rootId = "solcraft-world-sync";
const AUTH_KEY = "solcraft:auth";
const ORIGIN_KEY = "solcraft:prod-origin";

let mounted = false;
let adminKey = "";
let prodUrl = "";
let scope = "world";
let busy = false;
let msg = "";
let err = "";
let tab = "remote";
let confirmText = "";
let filter = "";
let data: any = { players: [], counts: {} };
let exportPreview: any = null;
let compatReport: any = null;
let pasteJson = "";
let pasteName = "";

function qs() {
  const q = new URLSearchParams({ scope });
  if (adminKey) q.set("adminKey", adminKey);
  return q;
}
async function jsonFetch(url: string, opts: any = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      "content-type": "application/json",
      "x-solcraft-admin-key": adminKey,
      ...(opts.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({ ok: false, msg: `HTTP ${r.status}` }));
  if (!r.ok || j.ok === false) {
    throw Object.assign(new Error(j.msg || `HTTP ${r.status}`), { data: j, status: r.status });
  }
  return j;
}
async function run(fn: any) {
  busy = true;
  err = "";
  msg = "";
  paint();
  try { await fn(); }
  catch (e: any) { err = explainAdminError(e); }
  finally { busy = false; paint(); }
}
function fmt(n: any) { return Math.floor(Number(n || 0)).toLocaleString(); }
function shortWallet(v: any) {
  const s = String(v || "");
  return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "no wallet";
}
function saveOrigin(v: string) { try { localStorage.setItem(ORIGIN_KEY, v); } catch {} }
function readOrigin() { try { return localStorage.getItem(ORIGIN_KEY) || ""; } catch { return ""; } }
function previewCounts(snapshot: any) {
  const c = snapshot?.counts || {};
  return `${fmt(c.players)} players · ${fmt(c.tiles)} tiles · ${fmt(c.buildings)} buildings`;
}
function parsePastedSnapshot() {
  const raw = String(pasteJson || "").trim();
  if (!raw) throw new Error("Paste or choose a world export JSON first.");
  try { return JSON.parse(raw); }
  catch (e: any) { throw new Error(`Could not parse JSON${e?.message ? `: ${e.message}` : "."}`); }
}
async function load() {
  await run(async () => {
    data = await jsonFetch(`/api/admin/world-sync?${qs().toString()}`);
    msg = "Local world loaded.";
  });
}
async function requestProductionExport() {
  const origin = normalizeProductionOrigin(prodUrl);
  const j = await jsonFetch(`/api/admin/world-sync`, {
    method: "POST",
    body: JSON.stringify({ action: "exportRemote", origin, scope, adminKey }),
  });
  compatReport = j.compat || null;
  return j.snapshot || j;
}
async function previewProd() {
  await run(async () => {
    const j = await requestProductionExport();
    exportPreview = j;
    pasteName = "remote production export";
    msg = `Production export ready: ${previewCounts(j)}.`;
  });
}
async function validatePaste() {
  await run(async () => {
    const raw = parsePastedSnapshot();
    const j = await jsonFetch(`/api/admin/world-sync`, {
      method: "POST",
      body: JSON.stringify({ action: "validateSnapshot", scope, source: tab === "file" ? "file" : "paste", snapshot: raw }),
    });
    exportPreview = j.snapshot;
    compatReport = j.report || j.compat || null;
    msg = `World export validated: ${previewCounts(exportPreview)}.`;
  });
}
async function importPreview() {
  await run(async () => {
    let snap = exportPreview;
    if (!snap && tab === "remote") snap = await requestProductionExport();
    if (!snap && (tab === "paste" || tab === "file")) {
      const raw = parsePastedSnapshot();
      const j = await jsonFetch(`/api/admin/world-sync`, {
        method: "POST",
        body: JSON.stringify({ action: "validateSnapshot", scope, source: tab, snapshot: raw }),
      });
      snap = j.snapshot;
      compatReport = j.report || j.compat || null;
    }
    if (!snap) throw new Error("No compatible export to import.");
    if (confirmText.trim().toUpperCase() !== "IMPORT") throw new Error('Type IMPORT in the confirmation box before replacing the local DB snapshot.');
    const j = await jsonFetch(`/api/admin/world-sync`, {
      method: "POST",
      body: JSON.stringify({ action: "import", scope, replace: true, source: tab, snapshot: snap }),
    });
    data = j;
    compatReport = j.compat || compatReport;
    confirmText = "";
    msg = `Imported ${scope} snapshot into local DB. Open a player below to test gameplay locally.`;
  });
}
async function readFile(e: any) {
  const file = e.currentTarget.files?.[0];
  if (!file) return;
  pasteName = file.name || "world-export.json";
  pasteJson = await file.text();
  tab = "file";
  exportPreview = null;
  compatReport = null;
  paint();
}
async function loginAs(id: number) {
  await run(async () => {
    const j = await jsonFetch(`/api/admin/world-sync`, {
      method: "POST",
      body: JSON.stringify({ action: "impersonate", playerId: id }),
    });
    const a = j.auth;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ pid: a.pid, secret: a.secret, wallet: a.wallet || "", body: a.body || 0, hat: a.hat || 0, spectator: false }));
    msg = `Local session switched to ${a.name}. Opening game…`;
    paint();
    setTimeout(() => { location.href = "/"; }, 450);
  });
}
function TabButton({ id, label }: any) {
  return <button className={`btn ${tab === id ? "primary" : ""}`} disabled={busy} onClick={() => { tab = id; msg = ""; err = ""; paint(); }}>{label}</button>;
}
function Stats() {
  const c = data.counts || {};
  const keys = ["players", "tiles", "buildings", "doodads", "loot", "chat", "offers", "events", "meta", "redemptions"].filter((k) => k in c);
  return <section className="panel"><h2>Local DB snapshot</h2><div className="grid stats-grid">{keys.map((k) => <div className="stat"><span>{k}</span><b>{fmt(c[k])}</b></div>)}</div></section>;
}
function CompatReport() {
  if (!compatReport) return null;
  const warnings = compatReport.warnings || [];
  return <section className="compat"><div className="row"><b>Compatibility report</b><span className="pill">{compatReport.scope || scope}</span><span className="pill">{fmt(compatReport.players)} players</span></div><pre className="mono compact">{JSON.stringify({ counts: compatReport.counts, tables: compatReport.tableKeys, droppedTables: compatReport.droppedTables, filledTables: compatReport.filledTables }, null, 2)}</pre>{warnings.length ? <ul className="warn-list">{warnings.map((w: string) => <li>{w}</li>)}</ul> : null}</section>;
}
function RemotePanel() {
  return <section className="panel"><h2>Remote route import</h2><p className="tiny">Use this only when production already has a compatible <code>/api/admin/world-sync</code>. If production is older, use JSON import instead.</p><div className="field"><label>Production origin</label><input value={prodUrl} onInput={(e: any) => { prodUrl = e.currentTarget.value; saveOrigin(prodUrl); }} placeholder="https://your-production-domain.com" /></div><div className="row"><button className="btn warn" disabled={busy} onClick={previewProd}>Preview remote export</button></div></section>;
}
function JsonPanel() {
  return <section className="panel"><h2>Manual JSON import</h2><p className="tiny">Use this to test the current local build against production data before the newest sync route is deployed. Paste an export JSON or choose a saved JSON file.</p><div className="field"><label>Choose JSON file</label><input type="file" accept="application/json,.json" disabled={busy} onInput={readFile} /></div>{pasteName ? <p className="good">Loaded {pasteName}</p> : null}<div className="field"><label>World export JSON</label><textarea value={pasteJson} onInput={(e: any) => { pasteJson = e.currentTarget.value; exportPreview = null; compatReport = null; }} placeholder='{"kind":"solcraft-world-export","tables":{"players":[...]}}' /></div><div className="row"><button className="btn warn" disabled={busy || !pasteJson.trim()} onClick={validatePaste}>Validate JSON</button></div></section>;
}
function ImportPanel() {
  return <section className="panel danger-zone"><h2>Import into local DB</h2><p className="tiny">This replaces the selected local world tables. It is intended for localhost gameplay testing only.</p>{exportPreview ? <pre className="mono compact">{JSON.stringify({ scope: exportPreview.scope, generatedAt: exportPreview.generatedAt, counts: exportPreview.counts, players: (exportPreview.players || []).slice(0, 8) }, null, 2)}</pre> : <p className="tiny">No compatible export preview yet.</p>}<CompatReport /><div className="field"><label>Type IMPORT to confirm local replacement</label><input value={confirmText} onInput={(e: any) => { confirmText = e.currentTarget.value; }} placeholder="IMPORT" /></div><button className="btn danger" disabled={busy || !exportPreview || confirmText.trim().toUpperCase() !== "IMPORT"} onClick={importPreview}>Replace local DB world tables</button></section>;
}
function SyncPanel() {
  return <section className="stack"><section className="panel"><h2>Production → local gameplay test</h2><p className="tiny">Correct flow: get production data into local, run the current unreleased code locally, then impersonate real players and test gameplay before deploying.</p><div className="field"><label>Admin key</label><input value={adminKey} onInput={(e: any) => { adminKey = e.currentTarget.value; writeAdminKey(adminKey); }} placeholder="SOLCRAFT_ADMIN_KEY / ADMIN_KEY" /></div><div className="field"><label>Scope</label><select value={scope} onInput={(e: any) => { scope = e.currentTarget.value; exportPreview = null; compatReport = null; load(); }}><option value="world">World only: players, map, buildings, chat, meta</option><option value="all">All: includes wallet challenges + token queues</option></select></div><div className="row tabs"><TabButton id="remote" label="Remote route" /><TabButton id="paste" label="Paste JSON" /><TabButton id="file" label="File import" /><button className="btn" disabled={busy} onClick={load}>Reload local</button></div></section>{tab === "remote" ? <RemotePanel /> : <JsonPanel />}<ImportPanel /><Stats /></section>;
}
function Players() {
  const q = filter.trim().toLowerCase();
  const players = (data.players || []).filter((p: any) => !q || String(p.name || "").toLowerCase().includes(q) || String(p.wallet || "").toLowerCase().includes(q) || String(p.id || "") === q);
  return <section className="panel players-panel"><div className="row spread"><h2>Open game as local player</h2><button className="btn" disabled={busy} onClick={load}>Reload</button></div><p className="tiny">After import, this writes that player’s local pid/secret into this browser only.</p><div className="field"><label>Search players</label><input value={filter} onInput={(e: any) => { filter = e.currentTarget.value; paint(); }} placeholder="name, wallet, or id" /></div><div className="players">{players.map((p: any) => <div className="player"><b>#{p.id} {p.name || "Unnamed"}</b><span className="tiny">{shortWallet(p.wallet)} · {p.x},{p.z} · tiles {fmt(p.tiles)} · builds {fmt(p.buildings)} · 🪙 {fmt(p.coins)} · 🔬 {fmt(p.science)}</span><div className="row"><button className="btn primary" disabled={busy || !p.hasSecret} onClick={() => loginAs(p.id)}>Open game as this player</button><a className="btn" href={`/?x=${p.x}&z=${p.z}`}>Open map area</a></div></div>)}</div>{!players.length ? <p className="tiny">No matching players loaded.</p> : null}</section>;
}
function Checklist() {
  return <section className="panel"><h2>Gameplay checklist</h2><ul className="check"><li>Open three real players from different settlements.</li><li>Move, gather, claim, build, inspect, and demolish locally.</li><li>Share a keep rally card in chat and walk to it.</li><li>Attack a keep with food available for health recovery.</li><li>Verify fallback atlases and procedural terrain still look readable.</li></ul></section>;
}
function App() {
  return <main className="ws"><section className="hero"><div className="row"><a className="btn" href="/admin">← Admin</a><a className="btn" href="/admin/player-resources">Player resources</a><a className="btn" href="/">Open game</a></div><p className="k">SolCraft operator</p><h1>World Sync + Player View</h1><p>Import production data into local, then test the unreleased gameplay build as real players before deploying.</p>{busy ? <p className="tiny">Working…</p> : null}{err ? <p className="bad">{err}</p> : null}{msg ? <p className="good">{msg}</p> : null}</section><section className="layout"><div><SyncPanel /></div><div><Players /><Checklist /></div></section></main>;
}
function paint() { const root = document.getElementById(rootId); if (root) render(<App />, root); }
export default function mount() {
  const root = document.getElementById(rootId);
  if (!root || mounted) return;
  mounted = true;
  adminKey = readAdminKey();
  prodUrl = readOrigin();
  paint();
  load();
}
