// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import {
  explainAdminError,
  readAdminKey,
  writeAdminKey,
} from "../../../client/admin/adminKey";

const rootId = "solcraft-world-sync";
const AUTH_KEY = "solcraft:auth";
let mounted = false;
let adminKey = "";
let prodUrl = "";
let scope = "world";
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
  const j = await r
    .json()
    .catch(() => ({ ok: false, msg: `HTTP ${r.status}` }));
  if (!r.ok || j.ok === false)
    throw Object.assign(new Error(j.msg || `HTTP ${r.status}`), {
      data: j,
      status: r.status,
    });
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
    msg = "Local world loaded.";
  });
}
async function requestProductionExport() {
  const origin = prodUrl.replace(/+$/, "");
  if (!origin) throw new Error("Enter production origin first.");
  const j = await jsonFetch(`/api/admin/world-sync`, {
    method: "POST",
    body: JSON.stringify({ action: "exportRemote", origin, scope }),
  });
  return j.snapshot || j;
}
async function previewProd() {
  await run(async () => {
    const j = await requestProductionExport();
    exportPreview = j;
    msg = `Production export ready: ${j.counts?.players || 0} players, ${j.counts?.tiles || 0} tiles, ${j.counts?.buildings || 0} buildings.`;
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
    const j = await jsonFetch(`/api/admin/world-sync`, {
      method: "POST",
      body: JSON.stringify({
        action: "import",
        scope,
        replace: true,
        snapshot: snap,
      }),
    });
    data = j;
    msg = `Imported production ${scope} snapshot into local DB.`;
  });
}
async function loginAs(id: number) {
  await run(async () => {
    const j = await jsonFetch(`/api/admin/world-sync`, {
      method: "POST",
      body: JSON.stringify({ action: "impersonate", playerId: id }),
    });
    const a = j.auth;
    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        pid: a.pid,
        secret: a.secret,
        wallet: a.wallet || "",
        body: a.body || 0,
        hat: a.hat || 0,
        spectator: false,
      }),
    );
    msg = `Local session switched to ${a.name}. Opening game…`;
    paint();
    setTimeout(() => {
      location.href = "/";
    }, 450);
  });
}
function fmt(n: any) {
  return Math.floor(Number(n || 0)).toLocaleString();
}
function Stats() {
  const c = data.counts || {};
  return (
    <section className="panel">
      <h2>Local DB snapshot</h2>
      <div className="grid">
        {[
          "players",
          "tiles",
          "buildings",
          "doodads",
          "loot",
          "chat",
          "offers",
          "events",
          "meta",
          "redemptions",
        ]
          .filter((k) => k in c)
          .map((k) => (
            <div className="stat">
              <span>{k}</span>
              <b>{fmt(c[k])}</b>
            </div>
          ))}
      </div>
    </section>
  );
}
function SyncPanel() {
  return (
    <section className="panel">
      <h2>Production → local sync</h2>
      <p className="tiny">
        Production export is fetched through your local server, not directly by
        the browser, so CORS cannot block it. Production still must have the
        export route deployed first. Import is local-only by default.
      </p>
      <div className="field">
        <label>Admin key</label>
        <input
          value={adminKey}
          onInput={(e: any) => {
            adminKey = e.currentTarget.value;
            writeAdminKey(adminKey);
          }}
          placeholder="SOLCRAFT_ADMIN_KEY / ADMIN_KEY"
        />
      </div>
      <div className="field">
        <label>Production origin</label>
        <input
          value={prodUrl}
          onInput={(e: any) => {
            prodUrl = e.currentTarget.value;
            try {
              localStorage.setItem("solcraft:prod-origin", prodUrl);
            } catch {}
          }}
          placeholder="https://your-production-domain.com"
        />
      </div>
      <div className="field">
        <label>Scope</label>
        <select
          value={scope}
          onInput={(e: any) => {
            scope = e.currentTarget.value;
            load();
          }}
        >
          <option value="world">
            World only: players, map, buildings, chat, meta
          </option>
          <option value="all">
            All: includes wallet challenges + token queues
          </option>
        </select>
      </div>
      <div className="row">
        <button className="btn" disabled={busy} onClick={load}>
          Reload local
        </button>
        <button className="btn warn" disabled={busy} onClick={previewProd}>
          Preview production export
        </button>
        <button
          className="btn primary"
          disabled={busy || !exportPreview}
          onClick={importProd}
        >
          Import into local DB
        </button>
      </div>
      {exportPreview ? (
        <pre className="mono">
          {JSON.stringify(
            {
              scope: exportPreview.scope,
              generatedAt: exportPreview.generatedAt,
              counts: exportPreview.counts,
              players: (exportPreview.players || []).slice(0, 6),
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </section>
  );
}
function Players() {
  return (
    <section className="panel">
      <div className="row">
        <h2>Admin login as local player</h2>
        <button className="btn" disabled={busy} onClick={load}>
          Reload
        </button>
      </div>
      <p className="tiny">
        This writes that player’s local pid/secret into this browser only. Use
        after importing production into your local DB to inspect their world
        exactly as they see it.
      </p>
      <div className="players">
        {(data.players || []).map((p: any) => (
          <div className="player">
            <b>
              #{p.id} {p.name || "Unnamed"}
            </b>
            <span className="tiny">
              {p.wallet
                ? `${String(p.wallet).slice(0, 6)}…${String(p.wallet).slice(-4)}`
                : "no wallet"}{" "}
              · {p.x},{p.z} · tiles {fmt(p.tiles)} · builds {fmt(p.buildings)} ·
              🪙 {fmt(p.coins)} · 🔬 {fmt(p.science)}
            </span>
            <div className="row">
              <button
                className="btn primary"
                disabled={busy || !p.hasSecret}
                onClick={() => loginAs(p.id)}
              >
                Open game as this player
              </button>
              <a className="btn" href={`/?x=${p.x}&z=${p.z}`}>
                Open map area
              </a>
            </div>
          </div>
        ))}
      </div>
      {!(data.players || []).length ? (
        <p className="tiny">No players loaded.</p>
      ) : null}
    </section>
  );
}
function PlanningNotes() {
  return (
    <section className="panel">
      <h2>Next city-planning decision</h2>
      <p>
        Once local mirrors production, inspect three real player bases before
        changing Wonder mechanics. Then decide whether Wonders should be:
      </p>
      <pre className="mono">{`A) civic anchor: buffs nearby city tiles/buildings
B) district project: reserves 5×5/7×7/9×9 and unlocks city bonuses
C) prestige landmark: mostly cosmetic + coins/ranking

Recommended first rule:
World Wonder = district anchor.
It reserves a footprint, takes construction time, and gives bonuses to completed buildings inside its district radius.`}</pre>
    </section>
  );
}
function App() {
  return (
    <main className="ws">
      <section className="hero">
        <div className="row">
          <a className="btn" href="/admin">
            ← Admin
          </a>
          <a className="btn" href="/admin/player-resources">
            Player resources
          </a>
          <a className="btn" href="/">
            Open game
          </a>
        </div>
        <p className="k">SolCraft operator</p>
        <h1>World Sync + Player View</h1>
        <p>
          Mirror the production world into your local SQLite DB, then open the
          game as any local player to inspect their city, territory, and Wonder
          placement.
        </p>
        {busy ? <p className="tiny">Working…</p> : null}
        {err ? <p className="bad">{err}</p> : null}
        {msg ? <p className="good">{msg}</p> : null}
      </section>
      <section className="layout">
        <div>
          <SyncPanel />
          <Stats />
        </div>
        <div>
          <Players />
          <PlanningNotes />
        </div>
      </section>
    </main>
  );
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
  try {
    prodUrl = localStorage.getItem("solcraft:prod-origin") || "";
  } catch {}
  paint();
  load();
}
