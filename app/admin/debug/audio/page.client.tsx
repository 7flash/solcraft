// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import { createMeasure } from "measure-fn";
import { makeSfx } from "../../../../client/meshes";

const audioMeasure = createMeasure("admin.audio", { maxResultLength: 140 });
const rootId = "audio-debug-root";
let mounted = false;
let sfx: any = null;
let status = "Load settings, then click a preview button to unlock browser audio.";
let last = "";
let saving = false;
let audio = { theme: "classic", uiVolume: 1, musicVolume: 1, backgroundUrl: "", updatedAt: 0 };
let uiMuted = false;
let musicMuted = true;

const CSS = String.raw`
.adbg{min-height:100vh;padding:18px;background:radial-gradient(circle at 18% 0%,rgba(20,241,149,.10),transparent 28rem),linear-gradient(180deg,#07101a,#03060b);color:#f3ead7;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.adbg *{box-sizing:border-box}.panel{border:1px solid rgba(243,234,215,.16);border-radius:22px;background:linear-gradient(180deg,rgba(12,22,34,.96),rgba(5,10,18,.96));box-shadow:0 18px 50px rgba(0,0,0,.34);padding:16px;margin:12px 0}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.btn{border:1px solid rgba(243,234,215,.18);border-radius:999px;background:#111c2b;color:#f3ead7;padding:9px 13px;font-weight:900;cursor:pointer;text-decoration:none}.btn:hover{border-color:rgba(20,241,149,.45)}.btn.on,.btn.primary{background:#14f195;color:#06120d;border-color:#14f195}.btn.warn{background:rgba(255,215,110,.14);border-color:rgba(255,215,110,.32);color:#ffe6aa}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}.card{display:grid;gap:7px;border:1px solid rgba(243,234,215,.14);border-radius:16px;background:rgba(243,234,215,.05);padding:12px}.sound-card{cursor:pointer;text-align:left;color:#f3ead7}.tiny{color:#b9af9d;font-size:12px;line-height:1.35}.ok{color:#14f195;font-weight:900}.warntext{color:#ffd76e;font-weight:900}h1{font-family:Georgia,serif;font-size:clamp(36px,5vw,60px);line-height:.9;margin:.2em 0}h2{margin:.2em 0}.badge{display:inline-flex;width:max-content;padding:4px 8px;border-radius:999px;background:rgba(20,241,149,.12);border:1px solid rgba(20,241,149,.25);color:#bcf7d6;font:900 11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.settings{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:grid;gap:6px}.field label{font-weight:900;color:#ffe8ba}.field input,.field select{width:100%;border:1px solid rgba(243,234,215,.18);border-radius:12px;background:rgba(0,0,0,.22);color:#f3ead7;padding:9px}.field input[type=range]{padding:0}.meter{font:900 12px ui-monospace,monospace;color:#baffdf}.theme-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}@media(max-width:760px){.settings,.theme-row{grid-template-columns:1fr}.adbg{padding:12px}}`;

const tests = [
  ["hop", "Movement hop"], ["claim", "Claim land"], ["build", "Build complete"], ["demolish", "Demolish / heavy hit"], ["err", "Error / blocked"], ["coin", "Token pickup"], ["pickup", "Resource pickup"], ["equip", "Select tool"], ["chop", "Chop tree"], ["mine", "Mine stone"], ["use", "Use supply"], ["saw", "Use building"], ["hit", "Hit"], ["raid", "Raid alert"], ["milestone", "Guide/achievement"],
];
const themes = [
  ["classic", "Classic", "Balanced SolCraft tones."],
  ["bright", "Bright", "More sparkle and presence."],
  ["soft", "Soft", "Quieter, rounder sounds."],
  ["retro", "Retro", "Crunchier arcade tones."],
];

function ensure() {
  if (!sfx) sfx = makeSfx();
  sfx.setUiMuted?.(uiMuted);
  sfx.setMusicMuted?.(musicMuted);
  sfx.setAudioConfig?.(audio);
  if (audio.backgroundUrl) sfx.setMusicUrl?.(audio.backgroundUrl + (audio.backgroundUrl.includes("?") ? "&" : "?") + "v=" + String(audio.updatedAt || Date.now()));
  else sfx.setMusicUrl?.("");
  return sfx;
}
function applyLocal() { ensure(); paint(); }
function play(name: string) {
  return audioMeasure.measureSync.root({ start: () => `preview ${name}`, end: () => ({ theme: audio.theme, uiVolume: audio.uiVolume, musicVolume: audio.musicVolume, uiMuted, musicMuted }), budget: 16 }, () => {
    const sx = ensure(); sx.resume?.(); sx[name]?.();
    last = name; status = uiMuted ? `UI sound is muted; ${name} preview was not audible.` : `Previewed ${name}.`;
    paint();
  });
}
async function loadAudio() {
  await audioMeasure.measure.root({ start: () => "load audio settings", end: (r:any) => ({ ok: r?.ok, theme: r?.audio?.theme }), budget: 120 }, async () => {
    try {
      const r = await fetch("/api/admin/audio", { cache: "no-store" }).then((x) => x.json());
      if (r?.ok) { audio = { ...audio, ...r.audio }; status = "Loaded admin audio settings."; applyLocal(); }
      else status = r?.msg || "Audio settings load failed.";
    } catch (e:any) { status = String(e?.message || e || "Audio settings load failed."); }
  });
}
async function saveAudio() {
  saving = true; paint();
  await audioMeasure.measure.root({ start: () => "save audio settings", end: (r:any) => ({ ok: r?.ok, theme: r?.audio?.theme }), budget: 160 }, async () => {
    try {
      const r = await fetch("/api/admin/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", audio }) }).then((x) => x.json());
      if (r?.ok) { audio = { ...audio, ...r.audio }; status = "Saved. Game clients load this runtime audio config on refresh/session restore."; applyLocal(); }
      else status = r?.msg || "Audio settings save failed.";
    } catch (e:any) { status = String(e?.message || e || "Audio settings save failed."); }
    saving = false; paint();
  });
}
async function resetAudio() {
  saving = true; paint();
  try {
    const r = await fetch("/api/admin/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset" }) }).then((x) => x.json());
    if (r?.ok) { audio = { ...audio, ...r.audio }; status = "Reset to classic defaults."; applyLocal(); }
    else status = r?.msg || "Reset failed.";
  } catch (e:any) { status = String(e?.message || e || "Reset failed."); }
  saving = false; paint();
}
function setTheme(theme: string) { audio = { ...audio, theme }; applyLocal(); play("milestone"); }
function setNum(key: string, value: any) { audio = { ...audio, [key]: Math.max(0, Math.min(1, Number(value) || 0)) }; applyLocal(); }
function toggleUiMute() { uiMuted = !uiMuted; ensure(); status = uiMuted ? "UI sounds muted locally." : "UI sounds on locally."; if (!uiMuted) setTimeout(() => play("milestone"), 20); paint(); }
function toggleMusic() { musicMuted = !musicMuted; ensure(); status = musicMuted ? "Music muted locally." : "Music on locally."; paint(); }
function App(){return <main className="adbg"><style>{CSS}</style><div className="row"><a className="btn" href="/admin">← Admin</a><a className="btn" href="/">Open game</a></div><h1>Audio Studio</h1><p className="tiny">Tune SolCraft UI sounds and background music. This replaces the old one-button debug page: pick a theme, set volumes, preview each action, then save the runtime config.</p><section className="panel"><div className="row"><span className="badge">Runtime settings</span><button className="btn" onClick={loadAudio}>Reload</button><button className="btn primary" disabled={saving} onClick={saveAudio}>{saving?"Saving…":"Save runtime audio"}</button><button className="btn warn" onClick={resetAudio}>Reset classic</button><button className={uiMuted?"btn warn":"btn on"} onClick={toggleUiMute}>{uiMuted?"UI muted locally":"UI on locally"}</button><button className={musicMuted?"btn warn":"btn on"} onClick={toggleMusic}>{musicMuted?"Music muted locally":"Music on locally"}</button><button className="btn" onClick={() => play("milestone")}>Resume + test chime</button></div><p className={uiMuted?"warntext":"ok"}>{status}</p><p className="tiny">Last preview: {last || "none"} · Saved config updates <code>/api/audio-runtime</code>. Already-open players may need refresh unless you add a live audio-config poll later.</p></section><section className="panel"><h2>Sound theme</h2><div className="theme-row">{themes.map(([id,label,body])=><button className={audio.theme===id?"card sound-card btn on":"card sound-card"} onClick={() => setTheme(id)}><b>{label}</b><span className="tiny">{body}</span></button>)}</div></section><section className="panel settings"><div className="field"><label>UI sound volume <span className="meter">{Math.round(audio.uiVolume*100)}%</span></label><input type="range" min="0" max="1" step="0.01" value={audio.uiVolume} onInput={(e:any)=>setNum("uiVolume", e.currentTarget.value)} /><div className="row"><button className="btn" onClick={()=>play("coin")}>Test token</button><button className="btn" onClick={()=>play("chop")}>Test chop</button><button className="btn" onClick={()=>play("mine")}>Test mine</button></div></div><div className="field"><label>Music volume <span className="meter">{Math.round(audio.musicVolume*100)}%</span></label><input type="range" min="0" max="1" step="0.01" value={audio.musicVolume} onInput={(e:any)=>setNum("musicVolume", e.currentTarget.value)} /><label>Background music URL</label><input value={audio.backgroundUrl || ""} placeholder="Optional /music/solcraft-loop.mp3 or https://..." onInput={(e:any)=>{audio={...audio,backgroundUrl:e.currentTarget.value}; applyLocal();}} /><p className="tiny">Leave blank to use the built-in synth ambience.</p></div></section><section className="panel"><h2>Action sound previews</h2><div className="grid">{tests.map(([id,label])=><button className="card sound-card" onClick={() => play(id)}><b>{label}</b><span className="tiny">sfx.{id}()</span></button>)}</div></section></main>}
function paint(){render(<App/>, document.getElementById(rootId)!)}
export default function mount(){const root=document.getElementById(rootId); if(!root||mounted)return; mounted=true; ensure(); paint(); loadAudio();}
