// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { explainAdminError, readAdminKey, writeAdminKey } from "../../../client/admin/adminKey";
import { formatWorldSyncCounts, normalizeProductionOrigin } from "../../../client/admin/worldSyncUrl";

const rootId = "solcraft-world-sync";
const AUTH_KEY = "solcraft:auth";
const PROD_ORIGIN_KEY = "solcraft:prod-origin";
const PLAYER_FILTER_KEY = "solcraft:world-sync:player-filter";

let mounted = false;
let adminKey = "";
let prodUrl = "";
let scope = "world";
let playerFilter = "";
let busy = false;
let msg = "";
let err = "";
let data: any = { players: [], counts: {} };
let exportPreview: any = null;

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
  try {
    await fn();
  } catch (e: any) {
    err = explainAdminError(e);
  } finally {
    busy = false;
    paint();
  }
}

async function load() {
  await run(async () => {
    data = await jsonFetch(`/api/admin/world-sync?${qs().toString()}`);
    msg = `Local world loaded: ${formatWorldSyncCounts(data.counts)}.`;
  });
}

function normalizedOriginOrThrow() {
  const normalized = normalizeProductionOrigin(prodUrl);
  if (!normalized.ok) throw new Error(normalized.msg);
  if (normalized.origin !== prodUrl.trim()) {
    prodUrl = normalized.origin;
    try { localStorage.setItem(PROD_ORIGIN_KEY, prodUrl); } catch {}
  }
  return normalized.origin;
}

async function requestProductionExport() {
  const origin = normalizedOriginOrThrow();
  const j = await jsonFetch("/api/admin/world-sync", {
    method: "POST",
    body: JSON.stringify({ action: "exportRemote", origin, scope }),
  });
  return j.snapshot || j;
}

async function previewProd() {
  await run(async () => {
    const j = await requestProductionExport();
    exportPreview = j;
    const warning = previewWarning(j);
    if (warning) err = warning;
    msg = `Production export ready: ${formatWorldSyncCounts(j.counts)}.`;
  });
}

async function importProd() {
  await run(async () => {
    let snap = exportPreview;
    if (!snap) {
      snap = await requestProductionExport();
      exportPreview = snap;
    }
    if (!snap) throw new Error("No export to import.");
    const ok = confirm(`Replace local ${scope} data with the previewed production snapshot?\n\n${formatWorldSyncCounts(snap.counts)}`);
    if (!ok) {
      msg = "Import cancelled.";
      return;
    }
    const j = await jsonFetch("/api/admin/world-sync", {
      method: "POST",
      body: JSON.stringify({ action: "import", scope, replace: true, snapshot: snap }),
    });
    data = j;
    msg = `Imported production ${scope} snapshot into local DB.`;
  });
}

async function loginAs(id: number) {
  await run(async () => {
    const j = await jsonFetch("/api/admin/world-sync", {
      method: "POST",
      body: JSON.stringify({ action: "impersonate", playerId: id }),
    });
    const a = j.auth;
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      pid: a.pid,
      secret: a.secret,
      wallet: a.wallet || "",
      body: a.body || 0,
      hat: a.hat || 0,
      spectator: false,
    }));
    msg = `Local session switched to ${a.name}. Opening game…`;
    paint();
    setTimeout(() => { location.href = "/"; }, 450);
  });
}

function fmt(n: any) { return Math.floor(Number(n || 0)).toLocaleString(); }
function previewWarning(snapshot: any) {
  const c = snapshot?.counts || {};
  const players = Number(c.players ?? snapshot?.players?.length ?? 0) || 0;
  const tables = snapshot?.tables && typeof snapshot.tables === "object" ? Object.keys(snapshot.tables).length : 0;
  if (!snapshot) return "";
  if (!tables && !players) return "Export has no tables and no players. Check the production origin, admin key, and that /api/admin/world-sync is deployed on production.";
  if (!players) return "Export returned zero players. If production has players, the admin key/scope/origin is probably wrong or production is serving an old route.";
  return "";
}
function shortWallet(w: any) {
  const s = String(w || "");
  return s ? `${s.slice(0, 6)}…${s.slice(-4)}` : "no wallet";
}
function filteredPlayers() {
  const q = playerFilter.trim().toLowerCase();
  const rows = data.players || [];
  if (!q) return rows;
  return rows.filter((p: any) => [p.id, p.name, p.wallet, p.x, p.z].some((v) => String(v || "").toLowerCase().includes(q)));
}

function CountGrid({ counts }: any) {
  const c = counts || {};
  return <div className="ws-count-grid">{[
    "players", "tiles", "buildings", "doodads", "loot", "chat", "offers", "events", "meta", "redemptions",
  ].filter((k) => k in c).map((k) => <div className="ws-stat" key={k}><span>{k}</span><b>{fmt(c[k])}</b></div>)}</div>;
}

function SyncPanel() {
  const originState = normalizeProductionOrigin(prodUrl);
  return <section className="ws-panel ws-sync-panel">
    <div className="ws-panel-head">
      <div><p className="ws-kicker">Production mirror</p><h2>Production → local sync</h2></div>
      <span className={`ws-badge ${scope === "all" ? "warn" : "ok"}`}>{scope}</span>
    </div>
    <p className="ws-copy">Production export is fetched through the local server, so CORS cannot block it. Import stays local-only by default.</p>
    <div className="ws-field"><label>Admin key</label><input type="password" value={adminKey} onInput={(e: any) => { adminKey = e.currentTarget.value; writeAdminKey(adminKey); }} placeholder="SOLCRAFT_ADMIN_KEY / ADMIN_KEY" /></div>
    <div className="ws-field"><label>Production origin</label><input value={prodUrl} onInput={(e: any) => { prodUrl = e.currentTarget.value; exportPreview = null; try { localStorage.setItem(PROD_ORIGIN_KEY, prodUrl); } catch {} paint(); }} placeholder="https://your-production-domain.com" />{prodUrl ? <small className={originState.ok ? "ws-hint ok" : "ws-hint bad"}>{originState.ok ? `Will request ${originState.origin}` : originState.msg}</small> : null}</div>
    <div className="ws-field"><label>Scope</label><select value={scope} onInput={(e: any) => { scope = e.currentTarget.value; exportPreview = null; load(); }}><option value="world">World only: players, map, buildings, chat, meta</option><option value="all">All: includes wallet challenges + token queues</option></select></div>
    <div className="ws-actions"><button className="ws-btn" disabled={busy} onClick={load}>Reload local</button><button className="ws-btn warn" disabled={busy} onClick={previewProd}>Preview production export</button><button className="ws-btn primary" disabled={busy || !exportPreview} onClick={importProd}>Import preview into local DB</button></div>
    {exportPreview ? <div className="ws-preview"><p className="ws-kicker">Preview payload</p>{previewWarning(exportPreview) ? <p className="ws-warning">{previewWarning(exportPreview)}</p> : null}<CountGrid counts={exportPreview.counts} /><pre className="ws-mono">{JSON.stringify({ scope: exportPreview.scope, generatedAt: exportPreview.generatedAt, counts: exportPreview.counts, players: (exportPreview.players || []).slice(0, 6) }, null, 2)}</pre></div> : null}
  </section>;
}

function Stats() {
  return <section className="ws-panel"><div className="ws-panel-head"><div><p className="ws-kicker">Local SQLite</p><h2>Current snapshot</h2></div><span className="ws-badge">local</span></div><CountGrid counts={data.counts} /></section>;
}

function Players() {
  const rows = filteredPlayers();
  return <section className="ws-panel ws-player-panel">
    <div className="ws-panel-head"><div><p className="ws-kicker">Impersonation</p><h2>Open as local player</h2></div><button className="ws-btn" disabled={busy} onClick={load}>Reload</button></div>
    <p className="ws-copy">Writes that player’s local pid/secret into this browser only. Use after importing production to inspect their city exactly as they see it.</p>
    <div className="ws-field"><label>Search players</label><input value={playerFilter} onInput={(e: any) => { playerFilter = e.currentTarget.value; try { localStorage.setItem(PLAYER_FILTER_KEY, playerFilter); } catch {} paint(); }} placeholder="name, id, wallet, coordinate" /></div>
    <div className="ws-players">{rows.map((p: any) => <article className="ws-player" key={p.id}>
      <div><b>#{p.id} {p.name || "Unnamed"}</b><span>{shortWallet(p.wallet)} · {p.x},{p.z}</span></div>
      <div className="ws-player-stats"><span>tiles {fmt(p.tiles)}</span><span>builds {fmt(p.buildings)}</span><span>🪙 {fmt(p.coins)}</span><span>🔬 {fmt(p.science)}</span></div>
      <div className="ws-actions"><button className="ws-btn primary" disabled={busy || !p.hasSecret} onClick={() => loginAs(p.id)}>Open game as this player</button><a className="ws-btn" href={`/?x=${p.x}&z=${p.z}`}>Open map area</a></div>
    </article>)}</div>
    {!rows.length ? <p className="ws-copy">No matching players loaded.</p> : null}
  </section>;
}

function Checklist() {
  return <section className="ws-panel ws-checklist"><div className="ws-panel-head"><div><p className="ws-kicker">Deploy ritual</p><h2>Before production changes</h2></div><span className="ws-badge warn">manual</span></div><ol><li>Preview production export and compare counts.</li><li>Import locally and open three real player bases.</li><li>Verify Atlas Studio runtime sheets after art changes.</li><li>Force client refresh only after deploy is live.</li></ol></section>;
}

function App() {
  return <main className="ws"><section className="ws-hero"><nav className="ws-nav"><a className="ws-btn" href="/admin">← Admin</a><a className="ws-btn" href="/admin/atlas">Atlas</a><a className="ws-btn" href="/admin/player-resources">Player resources</a><a className="ws-btn" href="/">Open game</a></nav><p className="ws-kicker">SolCraft operator</p><h1>World Sync + Player View</h1><p>Mirror production into local SQLite, then play as real imported players to verify migration, atlas, and gameplay changes before deploy.</p>{busy ? <p className="ws-status">Working…</p> : null}{err ? <p className="ws-status bad">{err}</p> : null}{msg ? <p className="ws-status good">{msg}</p> : null}</section><section className="ws-layout"><div><SyncPanel /><Stats /></div><div><Players /><Checklist /></div></section></main>;
}

function paint() {
  const root = document.getElementById(rootId);
  if (root) render(<App />, root);
}

export default function mount() {
  const root = document.getElementById(rootId);
  if (!root || mounted) return;
  mounted = true;
  adminKey = readAdminKey();
  try { prodUrl = localStorage.getItem(PROD_ORIGIN_KEY) || ""; } catch {}
  try { playerFilter = localStorage.getItem(PLAYER_FILTER_KEY) || ""; } catch {}
  paint();
  load();
}
