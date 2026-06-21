// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { explainAdminError, readAdminKey, writeAdminKey } from "../../../client/admin/adminKey";

const rootId = "solcraft-world-migration";
let mounted = false;
let adminKey = "";
let busy = false;
let err = "";
let msg = "";
let confirmText = "";
let data: any = null;
let plan: any = null;
let options: any = { unsupportedBuildingMode: "drop", keepsPerArm: 4 };

async function api(body:any = {}, method = "POST") {
  const r = await fetch("/api/admin/world-migration", {
    method,
    headers: { "content-type": "application/json", "x-solcraft-admin-key": adminKey },
    body: method === "GET" ? undefined : JSON.stringify({ ...body, adminKey }),
  });
  const j = await r.json().catch(() => ({ ok:false, msg:`HTTP ${r.status}` }));
  if (!r.ok || j.ok === false) throw Object.assign(new Error(j.msg || `HTTP ${r.status}`), { data:j, status:r.status });
  return j;
}
async function run(fn:any) { busy = true; err = ""; msg = ""; paint(); try { await fn(); } catch(e:any) { err = explainAdminError(e); } finally { busy = false; paint(); } }
async function load() { await run(async () => { data = await api({}, "GET"); msg = "Local world loaded."; }); }
async function makePlan() { await run(async () => { const j = await api({ action:"plan", options }); plan = j.plan; msg = "Migration plan generated. Review before applying."; }); }
async function preview() { await run(async () => { const j = await api({ action:"preview", options }); plan = j.plan; data = { ...(data || {}), preview: j.migrated }; msg = "Preview generated. This has not changed the DB."; }); }
async function apply() { await run(async () => { const j = await api({ action:"apply", options, confirm: confirmText }); plan = j.plan; data = { ...(data || {}), result: j.result }; msg = "Migration applied locally. Open game and test as imported players."; }); }
function fmt(v:any){return Math.floor(Number(v||0)).toLocaleString()}
function setOpt(k:string, v:any){ options = { ...options, [k]: v }; }
function Stat({k,v}:any){return <div className="wm-stat"><span>{k}</span><b>{fmt(v)}</b></div>}
function App(){
  const counts = data?.counts || {};
  const report = plan?.report || {};
  return <main className="wm">
    <section className="wm-hero">
      <div className="wm-row"><a className="wm-btn" href="/admin">← Admin</a><a className="wm-btn" href="/admin/world-sync">World Sync</a><a className="wm-btn" href="/">Open game</a></div>
      <p className="wm-k">SolCraft operator</p>
      <h1>Capital migration planner</h1>
      <p>Rebuild the chaotic production map into an ordered capital world: capital at 0,0, player settlements on a spiral, and neutral Keeps on a cross outward from the city.</p>
      {busy ? <p className="wm-note">Working…</p> : null}{err ? <p className="wm-bad">{err}</p> : null}{msg ? <p className="wm-good">{msg}</p> : null}
    </section>
    <section className="wm-layout">
      <div className="wm-panel">
        <h2>1. Load and plan locally</h2>
        <div className="wm-field"><label>Admin key</label><input value={adminKey} onInput={(e:any)=>{adminKey=e.currentTarget.value;writeAdminKey(adminKey)}} placeholder="SOLCRAFT_ADMIN_KEY / ADMIN_KEY" /></div>
        <div className="wm-grid">{Object.keys(counts).slice(0,8).map((k)=><Stat k={k} v={counts[k]} />)}</div>
        <div className="wm-actions"><button className="wm-btn" disabled={busy} onClick={load}>Reload local</button><button className="wm-btn primary" disabled={busy} onClick={makePlan}>Generate plan</button><button className="wm-btn" disabled={busy} onClick={preview}>Preview output</button></div>
      </div>
      <div className="wm-panel">
        <h2>2. Migration rules</h2>
        <div className="wm-field"><label>Keeps per cross arm</label><input value={options.keepsPerArm} onInput={(e:any)=>setOpt("keepsPerArm", Number(e.currentTarget.value || 4))} /></div>
        <div className="wm-field"><label>Unsupported old buildings</label><select value={options.unsupportedBuildingMode} onInput={(e:any)=>setOpt("unsupportedBuildingMode", e.currentTarget.value)}><option value="drop">Remove from ordered map</option><option value="foundation">Convert to foundation</option></select></div>
        <p className="wm-note">Recommended for first production migration: drop unsupported buildings and compensate later if needed. Foundation conversion should wait until foundation-first building is fully live.</p>
      </div>
      <div className="wm-panel">
        <h2>3. Plan report</h2>
        {plan ? <><div className="wm-grid"><Stat k="players" v={report.players}/><Stat k="tiles moved" v={report.tilesMoved}/><Stat k="buildings moved" v={report.buildingsMoved}/><Stat k="buildings dropped" v={report.buildingsDropped}/><Stat k="converted" v={report.buildingsConverted}/><Stat k="neutral keeps" v={report.neutralKeeps}/></div><pre className="wm-mono">{JSON.stringify({ capital: plan.capital, firstPlayers: plan.playerAnchors.slice(0,8), keepAnchors: plan.keepAnchors.slice(0,8), unsupportedKinds: report.unsupportedKinds, warnings: report.warnings }, null, 2)}</pre></> : <p className="wm-note">Generate a plan first.</p>}
      </div>
      <div className="wm-panel danger">
        <h2>4. Apply only after local review</h2>
        <p>This replaces local world tables with the migrated layout. For production, deploy the same code, take a DB backup, enter maintenance, then run this once with the same rules.</p>
        <div className="wm-field"><label>Type MIGRATE</label><input value={confirmText} onInput={(e:any)=>confirmText=e.currentTarget.value} placeholder="MIGRATE" /></div>
        <button className="wm-btn danger" disabled={busy || confirmText !== "MIGRATE"} onClick={apply}>Apply migration to local DB</button>
      </div>
    </section>
  </main>
}
function paint(){ const root = document.getElementById(rootId); if(root) render(<App/>, root); }
export default function mount(){ if(mounted) return; mounted = true; adminKey = readAdminKey(); paint(); load(); }
