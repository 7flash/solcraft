const CSS = String.raw`
:root{--ink:#05080e;--paper:#f3ead7;--muted:#b9af9d;--line:rgba(243,234,215,.16);--mint:#14f195;--gold:#ffd76e;--bad:#ff8d78}html,body{margin:0;min-height:100%;background:var(--ink);color:var(--paper)}.rf{min-height:100vh;padding:18px;background:radial-gradient(circle at 14% 0%,rgba(20,241,149,.11),transparent 30rem),linear-gradient(180deg,#07101a,#03060b);font-family:Outfit,Geist,system-ui,sans-serif}.hero,.panel,.card{border:1px solid var(--line);border-radius:22px;background:linear-gradient(180deg,rgba(12,22,34,.96),rgba(5,10,18,.96));box-shadow:0 22px 60px rgba(0,0,0,.34)}.hero,.panel{padding:18px;margin-bottom:12px}.k{color:var(--gold);font:900 11px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}h1{font-family:Georgia,serif;font-size:clamp(38px,6vw,72px);line-height:.9;margin:8px 0}h2,h3{margin:0 0 8px}p,li{color:#d8cfb7;line-height:1.45}.row{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);border-radius:999px;background:#111c2b;color:var(--paper);padding:8px 12px;text-decoration:none;font-weight:900}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.card{padding:14px}.ok{color:#baffdf}.warn{color:#ffe6aa}.bad{color:#ffb7aa}.mono{white-space:pre-wrap;font:800 12px/1.45 ui-monospace,Menlo,monospace;color:#fff0c8;background:rgba(0,0,0,.22);border-radius:14px;padding:12px;overflow:auto}.pill{display:inline-flex;width:max-content;border-radius:999px;padding:4px 8px;background:rgba(20,241,149,.11);border:1px solid rgba(20,241,149,.24);color:#baffdf;font:900 10px/1 ui-monospace,monospace}`;
const backend = [
  ["game/mechanics/keepVault.ts", "done", "Keep vault payout, owned-slot coin landing, and respawn helpers."],
  ["game/mechanics/playerResources.ts", "done", "Admin resource grants, bomb insertion, presets, and player resource display."],
  ["game/wonderRecipe.ts", "done", "Safe prompt-to-mesh schema, validation, and fallback recipes."],
  ["game/wonderAi.ts", "done", "AI provider routing for Wonder/Lab recipes."],
  ["game/mechanics/science.ts", "done", "Academy science caps, storage cap reads, and science status helpers."],
  ["game/mechanics/destroyTools.ts", "done", "Science-only destroy-tool specs and pack crafting logic."],
  ["game/mechanics/bombs.ts", "next", "Deploy validation and explosion effects should move after placement behavior stabilizes."],
  ["game/mechanics/buildings.ts", "next", "Wood-only cost normalization, placement validation, and protected-base rules."],
  ["game/mechanics/worldEvents.ts", "planned", "Living Frontier events near active players."],
];
const frontend = [
  ["client/admin/gameSession.ts", "done", "Shared auth/state/action helper for mechanics labs."],
  ["client/admin/adminKey.ts", "done", "Shared admin key storage/header/query handling."],
  ["client/admin/playerResourcesClient.ts", "done", "Shared Player Resources API client and constants."],
  ["client/wonderMeshes.ts", "done", "Safe mesh recipe renderer for AI buildings/Wonders."],
  ["client/ui/hud.ts", "next", "Extract the top-left HUD/resource card from app/page.client.tsx."],
  ["client/ui/actionDock.ts", "next", "Extract bottom action/build/deploy/use dock."],
  ["client/world/minimap.ts", "next", "Extract current-player minimap render rules."],
  ["client/world/buildingVisuals.ts", "next", "Move building visuals out of client/meshes.ts."],
];
function badge(status:string){const cls=status==="done"?"ok":status==="next"?"warn":"bad";return <span className={`pill ${cls}`}>{status}</span>}
function Cards({rows}:{rows:string[][]}){return <div className="grid">{rows.map(([name,status,body])=><div className="card">{badge(status)}<h3>{name}</h3><p>{body}</p></div>)}</div>}
export default function RefactorMapPage(){return <><style dangerouslySetInnerHTML={{__html:CSS}}/><main className="rf"><section className="hero"><div className="row"><a className="btn" href="/admin/mechanics">← Mechanics</a><a className="btn" href="/admin">Admin</a><a className="btn" href="/">Open game</a></div><p className="k">SolCraft refactor map</p><h1>Modularization status</h1><p>This page tracks the safe breakup of the old monoliths. The rule is: extract one mechanic, keep the public action/API contract stable, then add a small admin lab that proves the mechanic works before moving on.</p></section><section className="panel"><h2>Backend extraction</h2><Cards rows={backend}/></section><section className="panel"><h2>Frontend extraction</h2><Cards rows={frontend}/></section><section className="panel"><h2>Current dependency direction</h2><pre className="mono">{`app/api/* route -> game/mechanics/* -> game/db + game/shared
admin lab page -> client/admin/* helpers -> /api/state + /api/action or /api/admin/*
main game page -> still large; next safe split is HUD/action dock/minimap, not gameplay logic
science/crafting lab -> /api/action makeBomb/craft -> game/mechanics/destroyTools.ts + science.ts`}</pre></section></main></>}
