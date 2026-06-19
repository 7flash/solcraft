// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { readAdminKey, writeAdminKey, adminKeyHeaders, explainAdminError } from "../../../../client/admin/adminKey";

const rootId = "solcraft-admin-bombs";
let mounted = false;
let key = readAdminKey();
let data:any = null;
let err = "";
let msg = "";
let busy = false;
const CSS = String.raw`
.bomb-admin{min-height:100vh;padding:16px;background:#05080e;color:#f3ead7;font-family:Inter,system-ui,sans-serif}.panel{border:1px solid rgba(243,234,215,.16);border-radius:18px;background:#0b1420;padding:14px;margin:12px 0}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.btn{border:1px solid rgba(243,234,215,.18);border-radius:999px;background:#111c2b;color:#f3ead7;padding:8px 12px;font-weight:900;cursor:pointer;text-decoration:none}.btn.primary{background:#14f195;color:#06120d;border-color:#14f195}.bad{color:#ff9c8f}.ok{color:#14f195}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.card{border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.045);padding:11px}.mono{font:12px/1.35 ui-monospace,monospace;white-space:pre-wrap}input{border:1px solid rgba(243,234,215,.18);border-radius:12px;background:#07101a;color:#f3ead7;padding:9px;min-width:300px}.expired{border-color:rgba(255,215,110,.42);background:rgba(255,215,110,.08)}.live{border-color:rgba(20,241,149,.28)}`;
async function api(action="status"){
  busy=true; err=""; msg=""; paint();
  try{
    writeAdminKey(key);
    const res = action === "status"
      ? await fetch(`/api/admin/bombs?key=${encodeURIComponent(key)}`, { cache:"no-store", headers: adminKeyHeaders(key) })
      : await fetch('/api/admin/bombs', { method:'POST', headers:{'Content-Type':'application/json', ...adminKeyHeaders(key)}, body:JSON.stringify({ action, adminKey:key }) });
    const j = await res.json().catch(()=>({}));
    if(!res.ok || j?.ok===false) throw new Error(j?.msg || res.statusText);
    data=j; msg = action === "resolve" ? `Resolved ${j.resolved||0} expired tool(s).` : "Loaded.";
  }catch(e:any){ err=explainAdminError(e); }
  busy=false; paint();
}
function fmt(ms:number){ if(!ms) return "expired"; return `${Math.ceil(ms/1000)}s`; }
function App(){const bombs=data?.bombs||[];return <main className="bomb-admin"><style>{CSS}</style><div className="row"><a className="btn" href="/admin/mechanics">← Mechanics</a><a className="btn" href="/">Open game</a><button className="btn" onClick={()=>api('status')}>Reload</button><button className="btn primary" onClick={()=>api('resolve')}>Force resolve expired/all due</button></div><h1>Bomb / Destroy Tool Debug</h1><p>Use this when a placed siege tool appears stuck. The server also repairs legacy tools that were created without a valid fuse.</p><section className="panel"><label>Admin key<br/><input value={key} onInput={(e:any)=>{key=e.currentTarget.value; writeAdminKey(key)}} placeholder="admin key if configured"/></label>{busy?<p>Working…</p>:null}{err?<p className="bad">{err}</p>:null}{msg?<p className="ok">{msg}</p>:null}<p className="mono">count: {data?.count??0} · expired: {data?.expired??0}</p></section><section className="grid">{bombs.map((b:any)=><div className={"card "+(b.expired?"expired":"live")}><b>{b.variant}</b><p className="mono">id {b.id}\nowner {b.ownerName}\npos {b.x},{b.z}\nhp {b.hp}/{b.maxHp}\nfuse {fmt(b.fuseLeftMs)}\ncdUntil {b.cdUntil}</p></div>)}{!bombs.length?<div className="card">No active destroy tools.</div>:null}</section></main>}
function paint(){const root=document.getElementById(rootId); if(root) render(<App/>, root)}
export default function mount(){const root=document.getElementById(rootId); if(!root||mounted)return; mounted=true; paint(); api('status');}
