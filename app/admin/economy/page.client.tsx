// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from 'tradjs/client';
import { createMeasure } from 'measure-fn';

const rootId = 'solcraft-admin-economy';
const m = createMeasure('admin.economy', { maxResultLength: 180 });
let data:any = null;
let busy = false;
let err = '';
let saved = '';

const CSS = String.raw`
.econ-studio{min-height:100vh;padding:18px;background:radial-gradient(circle at 12% 0%,rgba(20,241,149,.10),transparent 32rem),linear-gradient(180deg,#07101a,#03060b);display:grid;gap:14px}.hero,.panel{border:1px solid rgba(243,234,215,.15);border-radius:22px;background:linear-gradient(180deg,rgba(12,22,34,.96),rgba(5,10,18,.96));box-shadow:0 22px 60px rgba(0,0,0,.34)}.hero{padding:18px 20px;display:flex;gap:14px;align-items:flex-start;justify-content:space-between}.kicker{margin:0 0 7px;color:#c79337;font:900 10px/1 ui-monospace,monospace;letter-spacing:.15em;text-transform:uppercase}h1,h2,h3{margin:0;color:#f3ead7;font-family:Georgia,serif;letter-spacing:-.04em}h1{font-size:clamp(34px,5vw,62px);line-height:.92}.hero p,.hint{color:#b9af9d;line-height:1.4}.panel{padding:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.stat{border:1px solid rgba(255,255,255,.10);border-radius:15px;padding:10px;background:rgba(255,255,255,.045)}.stat span{display:block;color:#b9af9d;font:800 11px/1.2 ui-monospace,monospace;text-transform:uppercase}.stat b{display:block;margin-top:4px;color:#14f195;font-size:22px}.field{display:grid;gap:6px}.field label{font:900 11px/1.1 ui-monospace,monospace;color:#c79337;text-transform:uppercase;letter-spacing:.08em}.field input{width:100%;box-sizing:border-box;border:1px solid rgba(243,234,215,.18);border-radius:12px;background:#07101a;color:#f3ead7;padding:9px;font:800 14px Inter}.field small{color:#b9af9d;line-height:1.35}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.btn{border:1px solid rgba(243,234,215,.17);border-radius:999px;background:#111c2b;color:#f3ead7;padding:8px 12px;font-weight:900;cursor:pointer;text-decoration:none}.btn.primary{background:#14f195;color:#06120d;border-color:#14f195}.btn.warn{background:rgba(199,147,55,.16);border-color:rgba(199,147,55,.35);color:#ffe8ad}.bad{color:#ffb2a1}.good{color:#bdf8d9}.building-table{display:grid;gap:8px}.building-row{display:grid;grid-template-columns:160px repeat(5,minmax(90px,1fr));gap:8px;align-items:end;padding:10px;border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.035)}.building-row b{font-size:14px}.building-row .glyph{font-size:22px}.split{display:grid;grid-template-columns:1.05fr .95fr;gap:14px}.mono{white-space:pre-wrap;overflow:auto;max-height:360px;font-size:12px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:10px}@media(max-width:980px){.split{grid-template-columns:1fr}.building-row{grid-template-columns:1fr 1fr}.hero{display:grid}.econ-studio{padding:10px}}`;

async function load() {
  return m.measure.root({ start: () => 'load economy studio', end: (j:any) => ({ ok:j?.ok, players:j?.economy?.counts?.players, tuning:!!j?.economy?.tuning }) }, async () => {
    busy = true; err = ''; saved = ''; paint();
    try {
      const r = await fetch('/api/admin/debug/summary', { cache: 'no-store' });
      data = await r.json();
      if (!data?.ok) throw new Error(data?.msg || 'load failed');
    } catch (e:any) { err = String(e?.message || e); }
    busy = false; paint();
  });
}
function num(id:string) { return Number((document.getElementById(id) as HTMLInputElement | null)?.value); }
function buildingPatch(ids:string[]) {
  const out:any = {};
  for (const id of ids) out[id] = {
    regen: num(`b-${id}-regen`), maxE: num(`b-${id}-maxE`), storageBonus: num(`b-${id}-storage`),
    foodStorageBonus: num(`b-${id}-food`), tileCapBonus: num(`b-${id}-tile`),
  };
  return out;
}
async function save() {
  return m.measure.root({ start: () => 'save economy studio', end: (j:any) => ({ ok:j?.ok, keys:Object.keys(j?.tuning||{}).length }) }, async () => {
    const keyBuildingIds = ['well','tavern','warehouse','granary','academy','workshop','townhall','keep','worldwonder'];
    const patch:any = {
      coinIntervalMs: num('coinIntervalMs'), coinBaseIntervalMs: num('coinIntervalMs'), coinSoloIntervalMs: num('coinIntervalMs'), coinLowPopIntervalMs: num('coinIntervalMs'),
      coinTaxPct: num('coinTaxPct'), coinMaxWorld: num('coinMaxWorld'), coinTerritoryDivisor: num('coinTerritoryDivisor'),
      energyRegenMultiplier: num('energyRegenMultiplier'), wildEnergyRegenMultiplier: num('wildEnergyRegenMultiplier'),
      moveEnergy: num('moveEnergy'), claimEnergy: num('claimEnergy'),
      tileBaseCapacity: num('tileBaseCapacity'), tileCapacityPerBuilding: num('tileCapacityPerBuilding'),
      buildings: buildingPatch(keyBuildingIds),
    };
    busy = true; err = ''; saved = ''; paint();
    try {
      const r = await fetch('/api/admin/debug/summary', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'setTuning', patch }) });
      data = await r.json();
      if (!data?.ok) throw new Error(data?.msg || 'save failed');
      saved = 'Saved live economy tuning. Game clients will receive the new version on next poll.';
    } catch(e:any) { err = String(e?.message || e); }
    busy = false; paint();
  });
}
function stat(k:string,v:any){return <div className="stat"><span>{k}</span><b>{String(v ?? '—')}</b></div>}
function input(id:string,label:string,value:any,step='1',hint=''){return <div className="field"><label>{label}</label><input id={id} type="number" step={step} defaultValue={value}/>{hint?<small>{hint}</small>:null}</div>}
function Section({title,children,sub=''}:any){return <section className="panel"><h2>{title}</h2>{sub?<p className="hint">{sub}</p>:null}{children}</section>}
function BuildingEditor({t}:any){
  const defs = data?.economy?.buildingDefs || [];
  const names:any = { well:'Well', tavern:'Tavern', warehouse:'Warehouse', granary:'Granary', academy:'Academy', workshop:'Workshop', townhall:'Town Hall', keep:'Stone Keep', worldwonder:'World Wonder' };
  const ids = ['well','tavern','warehouse','granary','academy','workshop','townhall','keep','worldwonder'];
  return <div className="building-table">{ids.map((id)=>{const d=defs.find((x:any)=>x.id===id)||{};const b=t?.buildings?.[id]||{};return <div className="building-row">
    <div><div className="glyph">{d.glyph || (id === 'keep' ? '♜' : '▣')}</div><b>{d.name || names[id] || id}</b><div className="hint">{id === 'keep' ? 'neutral coin siege target tuning' : id === 'worldwonder' ? 'AI monument / prestige tuning' : id === 'academy' ? 'science generation + cap economy' : id === 'workshop' ? 'bomb crafting gate' : 'energy/storage/cap role'}</div></div>
    {input(`b-${id}-regen`,'regen',b.regen??0,'0.1')}
    {input(`b-${id}-maxE`,'max energy',b.maxE??0,'1')}
    {input(`b-${id}-storage`,'storage',b.storageBonus??0,'10')}
    {input(`b-${id}-food`,'food cap',b.foodStorageBonus??0,'10')}
    {input(`b-${id}-tile`,'tile cap',b.tileCapBonus??0,'1')}
  </div>})}</div>;
}
function App(){const e=data?.economy||{};const t=e.tuning||{};const c=e.counts||{};const circ=e.circulation||{};return <main className="econ-studio"><style>{CSS}</style><section className="hero"><div><p className="kicker">SolCraft admin</p><h1>Economy Studio</h1><p>Tune the live economy values that players feel immediately: energy regen, action costs, coins, science, tile capacity, storage buildings, and rest buildings.</p></div><div className="row"><a className="btn" href="/admin">← Admin</a><a className="btn" href="/admin/debug/economy">Raw debug</a><button className="btn" data-action="reload">Reload</button><button className="btn primary" data-action="save">Save tuning</button></div></section>{busy?<p>Loading…</p>:null}{err?<p className="bad">{err}</p>:null}{saved?<p className="good">{saved}</p>:null}<div className="split"><div className="panel"><h2>Live world</h2><div className="grid">{stat('players',c.players)}{stat('active',c.activePlayers)}{stat('tiles',c.tiles)}{stat('buildings',c.buildings)}{stat('loose coins',c.loot)}{stat('mints',c.activeGoldMines)}{Object.entries(circ).slice(0,4).map(([k,v])=>stat(k,v))}</div></div><Section title="Design rule" sub="Coins are the player-facing currency. Loose coins enter the in-game bank/purse, then redemption moves $CRAFTS to the wallet. Elixirs and deployables are crafted from Craft, not bought in a separate market."><ul className="hint"><li>Supported land should feel fast and safe.</li><li>Wilderness should recover slowly, not trap players.</li><li>Buildings should explain why they matter: storage, energy, tile capacity, or token flow.</li></ul></Section></div><Section title="Energy and action costs" sub="Wild regen is a fraction of supported territory regen. Set it above zero so stranded players can recover without making territory meaningless."><div className="grid">{input('energyRegenMultiplier','Supported regen ×',t.energyRegenMultiplier??1,'0.05','own land, starter camp, and rest support')}{input('wildEnergyRegenMultiplier','Wild regen fraction',t.wildEnergyRegenMultiplier??0.25,'0.05','0.25 = 25% of supported')}{input('moveEnergy','Move cost',t.moveEnergy??1,'0.1')}{input('claimEnergy','Claim cost',t.claimEnergy??8,'0.5')}</div></Section><Section title="Coin spawning" sub="One current spawn interval is used. Older low/high population values are updated for migration compatibility only."><div className="grid">{input('coinIntervalMs','Coin spawn interval ms',t.coinIntervalMs??5000,'1000')}{input('coinTaxPct','Visitor tax',t.coinTaxPct??0.2,'0.01')}{input('coinMaxWorld','Max loose tokens',t.coinMaxWorld??80,'1')}{input('coinTerritoryDivisor','Tiles per token target',t.coinTerritoryDivisor??10,'1')}</div></Section><Section title="Territory capacity" sub="Claiming should fail clearly at cap, never delete tiles later."><div className="grid">{input('tileBaseCapacity','Base tile cap',t.tileBaseCapacity??100,'1')}{input('tileCapacityPerBuilding','Tile cap per building',t.tileCapacityPerBuilding??12,'1')}</div></Section><Section title="Building economy roles" sub="These are live tuning overrides for key buildings, including neutral Keeps and World Wonders. Save applies immediately to server memory and persisted metadata."><BuildingEditor t={t}/></Section><Section title="Raw recent events"><pre className="mono">{JSON.stringify((e.eventLog||[]).slice(0,40),null,2)}</pre></Section></main>}
function paint(){const root=document.getElementById(rootId);if(root)render(<App/>,root)}
export default function mount(){const root=document.getElementById(rootId);if(!root)return;root.addEventListener('click',(ev)=>{const el=(ev.target as any)?.closest?.('[data-action]');if(!el||!root.contains(el))return;const a=el.dataset.action;if(a==='reload')load();else if(a==='save')save();});paint();load();}