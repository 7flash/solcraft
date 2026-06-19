// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { coinLootRows, fetchGameState, gameAction, invCount, keepRows, readSavedGameAuth, stateMe, stateWorld } from "../../../client/admin/gameSession";

const rootId = "solcraft-keep-coin-test";
let mounted = false;
let auth: any = null;
let snap: any = null;
let busy = false;
let status = "Load your current game session, then spawn or siege a nearby neutral Keep.";
let err = "";
let selectedUid = 0;
let log: string[] = [];

const CSS = String.raw`
.kct{min-height:100vh;padding:16px;background:radial-gradient(circle at 18% 0%,rgba(20,241,149,.10),transparent 30rem),linear-gradient(180deg,#07101a,#03060b);color:#f3ead7;font-family:Outfit,Geist,system-ui,sans-serif}.kct *{box-sizing:border-box}.top{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.panel{margin:12px 0;padding:14px;border:1px solid rgba(243,234,215,.15);border-radius:18px;background:rgba(8,14,23,.92);box-shadow:0 18px 48px rgba(0,0,0,.28)}h1{font-family:Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:.92;margin:10px 0}h2{margin:0 0 8px}.tiny{color:#b9af9d;font-size:12px;line-height:1.4}.ok{color:#14f195;font-weight:900}.bad{color:#ff8d78;font-weight:900}.warn{color:#ffd76e;font-weight:900}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.btn{border:1px solid rgba(243,234,215,.18);border-radius:999px;background:#111c2b;color:#f3ead7;padding:8px 12px;font-weight:900;cursor:pointer;text-decoration:none}.btn:hover{border-color:rgba(20,241,149,.45)}.btn.primary{background:#14f195;border-color:#14f195;color:#06120d}.btn.warn{background:rgba(255,215,110,.15);border-color:rgba(255,215,110,.35);color:#ffe6aa}.btn.danger{background:rgba(255,122,102,.15);border-color:rgba(255,122,102,.35);color:#ffd4ce}.btn:disabled{opacity:.45;cursor:not-allowed}.card{border:1px solid rgba(255,255,255,.10);border-radius:15px;background:rgba(255,255,255,.045);padding:10px}.card.on{border-color:rgba(20,241,149,.55);background:rgba(20,241,149,.08)}.mono{white-space:pre-wrap;font:800 11px/1.35 ui-monospace,Menlo,monospace;color:#fff0c8}.coin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.atlas-cell{width:112px;height:112px;border-radius:16px;overflow:hidden;background:#05080e;border:1px solid rgba(255,255,255,.16);position:relative;box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)}.atlas-cell img{position:absolute;left:0;top:0;width:400%;height:400%;max-width:none;image-rendering:auto;user-select:none;pointer-events:none}.coin-bounce{width:112px;height:112px;border-radius:16px;display:grid;place-items:center;border:1px solid rgba(255,215,110,.35);background:radial-gradient(circle at 50% 42%,rgba(255,215,110,.22),transparent 56%),rgba(255,255,255,.045);font-size:54px}.coin-bounce span{display:block;animation:kcoin 1.15s ease-in-out infinite}@keyframes kcoin{0%,100%{transform:translateY(0) rotateY(0deg)}45%{transform:translateY(-13px) rotateY(180deg)}70%{transform:translateY(-5px) rotateY(260deg)}}`;

function push(msg: string) { log = [`${new Date().toLocaleTimeString()} · ${msg}`, ...log].slice(0, 28); }
function me() { return stateMe(snap); }
function world() { return stateWorld(snap); }
function keeps() { return keepRows(snap); }
function coins() { return coinLootRows(snap); }
function selectedKeep() { return keeps().find((k: any) => Number(k.uid || k.id) === Number(selectedUid)) || keeps()[0] || null; }
function tiles() { const w = world(); return w?.tiles || w?.t || []; }
function buildings() { const w = world(); return w?.buildings || w?.b || []; }
function visibleOwnedEmptyTiles() {
  const m = me(); if (!m) return [];
  const occupied = new Set(buildings().map((b: any) => `${b.x},${b.z}`));
  const looted = new Set((world()?.loot || world()?.l || []).map((l: any) => `${l.x},${l.z}`));
  return tiles().filter((t: any) => Number(t.owner) === Number(m.id) && !occupied.has(`${t.x},${t.z}`) && !looted.has(`${t.x},${t.z}`));
}
function myPosText() { const m = me(); return m ? `${m.x}, ${m.z}` : "unknown"; }
async function act(type: string, payload: any = {}) {
  const data = await gameAction(auth, type, payload);
  push(`${type}: ${data.note || data.msg || "ok"}`);
  return data;
}
async function refresh() {
  auth = readSavedGameAuth();
  if (!auth?.pid || !auth?.secret) { status = "No saved session. Open the game, join, then return."; err = ""; paint(); return; }
  busy = true; err = ""; paint();
  try {
    snap = await fetchGameState(auth, { rev: 0, mapRev: -1 });
    if (!selectedUid && keeps()[0]) selectedUid = Number(keeps()[0].uid || keeps()[0].id || 0);
    status = `Loaded player ${auth.pid}. Nearby Keeps: ${keeps().length}. Loose coins: ${coins().length}. Visible owned empty slots: ${visibleOwnedEmptyTiles().length}.`;
  } catch (e: any) { err = e?.message || String(e); status = "State load failed."; }
  busy = false; paint();
}
async function run(label: string, fn: () => Promise<any>) {
  busy = true; err = ""; status = label; paint();
  try { const r = await fn(); status = r?.note || `${label} complete.`; }
  catch (e: any) { err = e?.message || String(e); status = err; }
  busy = false; await refresh();
}
function adjacentSpot(k: any) {
  const m = me(); if (!m || !k) return null;
  const dx = Math.sign(Number(k.x) - Number(m.x));
  const dz = Math.sign(Number(k.z) - Number(m.z));
  if (Math.abs(Number(k.x) - Number(m.x)) >= Math.abs(Number(k.z) - Number(m.z))) return { x: Number(k.x) - (dx || 1), z: Number(k.z) };
  return { x: Number(k.x), z: Number(k.z) - (dz || 1) };
}
async function spawnNear() { const m = me(); if (!m) throw new Error("Refresh state first."); return act("adminSpawnKeep", { mode: "here", x: Number(m.x) + 2, z: Number(m.z), hp: 45, gold: Math.max(60, visibleOwnedEmptyTiles().length || 80), name: "Test Coin Vault" }); }
async function spawnRing() { const m = me(); if (!m) throw new Error("Refresh state first."); return act("adminSpawnKeep", { mode: "ring", x: Number(m.x), z: Number(m.z), radius: 7, hp: 90, gold: 120, name: "Ring Vault" }); }
async function moveAdjacent() { const k = selectedKeep(); const s = adjacentSpot(k); if (!k || !s) throw new Error("No Keep selected."); return act("move", s); }
async function raidOnce() { const k = selectedKeep(); if (!k) throw new Error("No Keep selected."); return act("raid", { uid: Number(k.uid || k.id) }); }
async function raidUntilBreak() { for (let i = 0; i < 25; i++) { const k = selectedKeep(); if (!k) break; await raidOnce(); await refresh(); if (!selectedKeep() || Number(selectedKeep()?.uid || selectedKeep()?.id) !== Number(k.uid || k.id)) break; } return { note: "Raid loop complete. Check coin slots and next Keep." }; }
async function craftPopper() { return act("makeBomb", { variant: "popper" }); }
async function deployPopperNearKeep() { const k = selectedKeep(); const s = adjacentSpot(k); if (!k || !s) throw new Error("No Keep selected."); return act("spawnBomb", { variant: "popper", x: s.x, z: s.z }); }
function atlasCell(atlas: string, slot: number, label: string) {
  const col = slot % 4, row = Math.floor(slot / 4);
  return <div className="card"><b>{label}</b><p className="tiny">{atlas} atlas slot {slot} · col {col}, row {row}</p><div className="atlas-cell"><img src={`/api/atlas-runtime/${atlas}?test=coin`} style={{ transform: `translate(${-col * 25}%, ${-row * 25}%)` }} /></div></div>;
}
function App() {
  const m = me(); const ks = keeps(); const coinRows = coins(); const k = selectedKeep(); const emptySlots = visibleOwnedEmptyTiles();
  return <main className="kct"><style>{CSS}</style>
    <div className="top"><a className="btn" href="/admin">← Admin</a><a className="btn" href="/admin/mechanics">Mechanics hub</a><a className="btn" href="/">Open game</a><a className="btn" href="/admin/atlas?atlas=fx">Edit FX atlas</a><button className="btn primary" disabled={busy} onClick={refresh}>{busy ? "Working…" : "Reload state"}</button></div>
    <h1>Keep Vault + Coin Test Lab</h1>
    <p className="tiny">Tests the new desired loop: neutral Keep has visible stored coins → break it → coins spawn across empty owned territory slots → another Keep appears.</p>
    <section className="panel"><div className="row"><span className={err ? "bad" : "ok"}>{status}</span>{err ? <span className="bad">{err}</span> : null}</div><p className="tiny">Auth: {auth?.pid ? `player ${auth.pid}` : "missing"} · position: {myPosText()} · name: {m?.name || "?"} · purse coins: {invCount(m, "g")} · science: {invCount(m, "sc")}</p></section>
    <section className="panel"><h2>Keep flow</h2><div className="row"><button className="btn primary" disabled={busy || !m} onClick={() => run("Spawning test Keep…", spawnNear)}>Spawn coin-vault Keep 2 east</button><button className="btn" disabled={busy || !m} onClick={() => run("Spawning Keep ring…", spawnRing)}>Spawn 4-Keep ring</button><button className="btn" disabled={busy || !k} onClick={() => run("Moving next to Keep…", moveAdjacent)}>Move next to selected Keep</button><button className="btn danger" disabled={busy || !k} onClick={() => run("Raiding selected Keep…", raidOnce)}>Raid once</button><button className="btn danger" disabled={busy || !k} onClick={() => run("Raiding until break…", raidUntilBreak)}>Raid until break</button></div><p className="tiny">The server still decides if you are admin, adjacent, and have enough energy. This page only sends normal actions.</p></section>
    <section className="panel"><h2>Bomb path</h2><div className="row"><button className="btn" disabled={busy} onClick={() => run("Crafting popper…", craftPopper)}>Craft popper</button><button className="btn warn" disabled={busy || !k} onClick={() => run("Deploying popper near Keep…", deployPopperNearKeep)}>Deploy popper near Keep</button></div><p className="tiny">Academy → science → bombs → Keep vault should be the main siege path.</p></section>
    <section className="panel"><h2>Nearby Keeps</h2><div className="grid">{ks.map((row: any) => <button className={"card" + (Number(row.uid || row.id) === Number(selectedUid) ? " on" : "")} onClick={() => { selectedUid = Number(row.uid || row.id); paint(); }}><b>♜ {row.nm || row.name || "Keep"}</b><p className="tiny">uid {row.uid || row.id} · {row.x}, {row.z}</p><p className="mono">owner {row.owner}\nHP {Math.ceil(Number(row.hp || 0))}/{Math.ceil(Number(row.maxHp || 0))}\nstored coins {Math.floor(Number(row.stored || 0))}</p></button>)}{!ks.length ? <p className="tiny">No nearby Keeps in current state. Spawn one or walk near procedural Keeps.</p> : null}</div></section>
    <section className="panel"><h2>Owned coin landing slots visible in current payload</h2><p className="tiny">The server can use more owned tiles than the snapshot shows; this list is just the local view.</p><div className="grid">{emptySlots.slice(0, 30).map((t: any) => <div className="card"><b>empty owned slot</b><p className="tiny">{t.x}, {t.z}</p></div>)}{!emptySlots.length ? <p className="tiny">No empty owned slots visible. Claim/build less densely or stand near your territory.</p> : null}</div></section>
    <section className="panel"><h2>Coin visuals / atlas</h2><div className="coin-grid">{atlasCell("fx", 3, "FX coin source")}{atlasCell("ui", 4, "UI purse coin icon")}<div className="card"><b>Runtime pickup animation</b><p className="tiny">The in-world coin can bounce/spin procedurally while using atlas art for FX/HUD polish.</p><div className="coin-bounce"><span>🪙</span></div></div></div></section>
    <section className="panel"><h2>Nearby loose coin loot</h2><div className="grid">{coinRows.map((l: any) => <div className="card"><b>🪙 {l.gid || "1"} coins</b><p className="tiny">{l.x}, {l.z} · kind {l.kind}</p></div>)}{!coinRows.length ? <p className="tiny">No nearby loose coins in this payload. Breach a Keep or wait for territory coin spawning.</p> : null}</div></section>
    <section className="panel"><h2>Action log</h2><pre className="mono">{log.join("\n") || "No actions yet."}</pre></section>
  </main>;
}
function paint() { const root = document.getElementById(rootId); if (root) render(<App />, root); }
export default function mount() { const root = document.getElementById(rootId); if (!root || mounted) return; mounted = true; auth = readSavedGameAuth(); paint(); refresh(); }
