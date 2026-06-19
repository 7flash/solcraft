// @ts-nocheck
/** @jsxImportSource tradjs/client */
/* ============================================================
   SOLCRAFT client — tradjs mount script.
   One shared map for everyone. The server (game/engine.ts) is
   authoritative; this file renders, predicts, and asks.

   RENDERING MODEL (the fix for dead buttons + perf):
   The HUD is split into independent REGIONS, each with its own
   DOM root, its own vdom view, and a SIGNATURE. paint() only
   re-renders regions whose signature changed — clicking a
   button never tears down unrelated DOM, so clicks always land.
   High-frequency values (energy bar, producer bins, cooldowns,
   chat lines, toasts) bypass the vdom entirely and mutate the
   DOM directly, exactly like the FairFun gravity simulator.
   ============================================================ */
import { render } from "tradjs/client";
import * as THREE from "three";
import {
  BODY_COLORS, COLOR_CHOICES, COSTI, ECONOMY, FINAL_TEXT, GEAR_BY_ID, HAT_COLORS,
  LIBRARY, LIB_BY_ID, MAX_HP, MAX_LEVEL, MILESTONES, N4, N8, NPC_TRADES, PACK_SIZE,
  RECIPES, REDEEM_MIN_GOLD, RES_KEYS, RES_NAMES, SKILLS, SLOTS, SLOT_LABEL,
  cheb, gearStat, harvestMs, hrand, key, lvlMul, naturalDoodad, repairCost,
  skillLvl, upgradeCost, xpForLevel,
} from "../game/shared";
import {
  M, ME, buildBanner, buildRig, buildRock, buildTree, lootMesh,
  makeBuildingGroup, makeLabel, makeSfx,
} from "../client/meshes";

const AUTH_KEY = "solcraft:auth";
const RENDER_R = 12;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=Outfit:wght@400;600;800&display=swap');
:root{--mint:#14f195;--violet:#9945ff;--ink:#070d16;--paper:#f3ead7;--glass:rgba(8,13,23,.78);--line:rgba(255,255,255,.13);--line2:rgba(20,241,149,.28);}
.sc-root{position:relative;width:100%;height:100vh;min-height:560px;overflow:hidden;background:var(--ink);color:var(--paper);font-family:Outfit,ui-sans-serif,system-ui,sans-serif;}
.sc-world{position:absolute;inset:0;}
.sc-hud{position:absolute;inset:0;pointer-events:none;}
.sc-hud>*{pointer-events:none;}
.sc-hud>*>*{pointer-events:auto;}
.sc-top{position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
.panel,.modal,.menu-card{background:var(--glass);border:1px solid var(--line);box-shadow:0 18px 48px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(14px);border-radius:18px;}
.hud{padding:10px 12px;min-width:300px;}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.stat{display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.08);font-weight:700;font-size:13px;}
.stat.good{background:rgba(20,241,149,.14);color:#baffdf;box-shadow:inset 0 0 0 1px var(--line2);}
.tiny{font-size:12px;color:#aebfc9;}
.ebar{position:relative;height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:7px;}
.ebar i{position:absolute;inset:0 auto 0 0;width:50%;border-radius:99px;background:linear-gradient(90deg,#2e9bb0,var(--mint));transition:width .3s;}
.objective{margin-top:8px;font-size:13px;color:#dffbed;display:flex;gap:6px;align-items:flex-start;}
.objective b{color:var(--mint);}
.top-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.btn{border:0;border-radius:999px;padding:8px 13px;background:#17243a;color:var(--paper);font-weight:800;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 2px 8px rgba(0,0,0,.3);font-family:inherit;font-size:13px;transition:transform .08s,filter .12s;}
.btn:hover{filter:brightness(1.18);}
.btn:active{transform:translateY(1px) scale(.98);}
.btn.primary{background:linear-gradient(135deg,var(--mint),#2e9bb0);color:#04221a;}
.btn.warn{background:linear-gradient(135deg,var(--violet),#5d2bd0);color:#fff;}
.btn.danger{background:linear-gradient(135deg,#e0604c,#a8342a);color:#fff;}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.minimap{position:absolute;right:14px;bottom:14px;width:150px;height:150px;border-radius:18px;border:1px solid var(--line2);background:#0b1420;box-shadow:0 12px 34px rgba(0,0,0,.4);pointer-events:auto;}
.toast{position:absolute;left:50%;top:78px;transform:translateX(-50%) translateY(-14px);opacity:0;padding:10px 16px;border-radius:999px;background:linear-gradient(135deg,var(--mint),#39d3a8);color:#04241b;font-weight:900;box-shadow:0 16px 36px rgba(0,0,0,.4);max-width:86vw;text-align:center;z-index:30;transition:opacity .18s,transform .18s;pointer-events:none;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.menu{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(1100px 700px at 50% 18%,rgba(20,241,149,.12),transparent 55%),radial-gradient(900px 700px at 80% 90%,rgba(153,69,255,.14),transparent 55%),rgba(4,8,14,.84);padding:18px;z-index:40;}
.menu-card{width:min(820px,94vw);padding:26px;max-height:92vh;overflow:auto;}
.title{font-family:'Chakra Petch',Outfit,sans-serif;font-size:46px;line-height:1;margin:0 0 6px;font-weight:700;letter-spacing:-.02em;}
.title em{font-style:normal;background:linear-gradient(90deg,var(--mint),var(--violet));-webkit-background-clip:text;background-clip:text;color:transparent;}
.subtitle{color:#c8d7db;margin:0 0 18px;font-size:15px;}
.field{display:grid;gap:6px;margin:12px 0;}
.field label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8fd9bb;font-weight:900;}
input,textarea,select{background:rgba(255,255,255,.08);border:1px solid var(--line);border-radius:12px;color:var(--paper);padding:10px 12px;font:inherit;outline:none;}
input:focus,select:focus{border-color:var(--line2);box-shadow:0 0 0 3px rgba(20,241,149,.12);}
.swatch{width:30px;height:30px;border-radius:999px;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0;}
.swatch.on{outline:3px solid var(--mint);}
.modal-wrap{position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,6,10,.46);padding:18px;z-index:20;}
.modal{width:min(920px,94vw);max-height:84vh;overflow:auto;padding:18px;animation:pop .16s ease-out;}
@keyframes pop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
.modal h2{margin:0 0 6px;font-size:23px;font-family:'Chakra Petch',sans-serif;}
.modal h3{margin:14px 0 4px;color:#bfeeda;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-top:12px;}
.card{background:rgba(255,255,255,.07);border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;}
.card.locked{opacity:.5;filter:grayscale(.5);}
.glyph{font-size:28px;}
.card-title{font-weight:900;}
.cost{font-size:12px;color:#ffe6aa;}
.usetag{font-size:12px;color:#9bffd9;background:rgba(20,241,149,.1);border-radius:8px;padding:4px 7px;align-self:flex-start;}
.bottom-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 190px);}
.chat{position:absolute;left:14px;bottom:58px;width:min(360px,calc(100vw - 28px));max-height:280px;display:flex;flex-direction:column;overflow:hidden;}
.chat-log{padding:10px;overflow:auto;display:flex;flex-direction:column;gap:6px;font-size:13px;max-height:190px;}
.chat-line.sys{color:#9bffd9;}
.chat-form{display:flex;border-top:1px solid rgba(255,255,255,.1);}
.chat-form input{border:0;border-radius:0;flex:1;background:rgba(255,255,255,.07);}
.tabs{display:flex;gap:8px;margin:10px 0;}
.slot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);}
.packgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;margin-top:10px;}
.packslot{aspect-ratio:1;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font-size:10px;color:#cdd9de;padding:4px;text-align:center;position:relative;}
.packslot:hover{background:rgba(20,241,149,.1);border-color:var(--line2);}
.packslot.empty{cursor:default;opacity:.45;}
.packslot .pg{font-size:22px;line-height:1;}
.packslot .pd{position:absolute;top:2px;right:5px;opacity:.5;font-size:11px;cursor:pointer;}
.packslot .pd:hover{opacity:1;color:#ff9a8a;}
.kbd{font-family:ui-monospace,Menlo,monospace;background:rgba(255,255,255,.11);border-radius:6px;padding:2px 5px;font-size:12px;}
.hpbar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;flex:1;min-width:80px;}
.hpbar i{display:block;height:100%;background:linear-gradient(90deg,#ff7a5c,#ffd76e);border-radius:99px;}
.xpbar{position:relative;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:5px;}
.xpbar i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,var(--violet),#c79bff);}
.lvlchip{display:inline-flex;align-items:center;gap:4px;padding:5px 9px;border-radius:999px;background:linear-gradient(135deg,var(--violet),#6a2bd0);color:#fff;font-weight:900;font-size:13px;}
.ctx{position:absolute;z-index:50;min-width:170px;padding:6px;border-radius:14px;background:var(--glass);border:1px solid var(--line2);box-shadow:0 18px 44px rgba(0,0,0,.5);backdrop-filter:blur(14px);pointer-events:auto;}
.ctx .ctx-h{font-size:12px;font-weight:900;color:#bfeeda;padding:6px 8px 4px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:4px;}
.ctx button{display:flex;width:100%;justify-content:space-between;gap:10px;align-items:center;border:0;background:transparent;color:var(--paper);font:inherit;font-weight:700;font-size:13px;padding:8px 8px;border-radius:9px;cursor:pointer;text-align:left;}
.ctx button:hover{background:rgba(20,241,149,.14);}
.ctx button.danger:hover{background:rgba(224,96,76,.2);}
.ctx button small{opacity:.6;font-weight:600;}
.channel{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);width:min(320px,70vw);padding:8px 12px;border-radius:14px;background:var(--glass);border:1px solid var(--line2);text-align:center;font-weight:800;font-size:13px;pointer-events:none;z-index:25;display:none;}
.channel.on{display:block;}
.channel .cbar{height:8px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:6px;}
.channel .cbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--mint),#39d3a8);border-radius:99px;}
.draggable{cursor:grab;}
.packslot.dragging{opacity:.4;}
.slot.drop-ok{outline:2px dashed var(--mint);outline-offset:2px;border-radius:10px;}
.recipe-req{font-size:11px;color:#ffb38a;}
@media (max-width:720px){.title{font-size:34px}.sc-top{flex-direction:column}.top-actions{justify-content:flex-start}.minimap{width:112px;height:112px}.bottom-bar{max-width:100%;left:10px;right:10px;transform:none}.chat{bottom:110px}.hud{min-width:0;width:calc(100vw - 48px)}}
`;

async function api(path, body) {
  try {
    const res = body
      ? await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(path);
    return await res.json();
  } catch (e) {
    return { ok: false, msg: "network" };
  }
}

export default function mount() {
  const root = document.getElementById("solcraft-root");
  if (!root) return;
  root.className = "sc-root";

  const styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  const worldEl = document.createElement("div");
  worldEl.className = "sc-world";
  const hudEl = document.createElement("div");
  hudEl.className = "sc-hud";
  root.append(styleEl, worldEl, hudEl);

  /* region roots — each its own tradjs render target */
  const mk = (cls) => { const d = document.createElement("div"); if (cls) d.className = cls; hudEl.appendChild(d); return d; };
  const topEl = mk("sc-top");
  const hudRoot = document.createElement("div"); topEl.appendChild(hudRoot);
  const actionsRoot = document.createElement("div"); topEl.appendChild(actionsRoot);
  const minimapEl = document.createElement("canvas");
  minimapEl.id = "sc-minimap"; minimapEl.className = "minimap"; minimapEl.width = 150; minimapEl.height = 150;
  hudEl.appendChild(minimapEl);
  const chatEl = mk("");
  const bottomRoot = mk("");
  const toastEl = document.createElement("div"); toastEl.className = "toast"; hudEl.appendChild(toastEl);
  const channelEl = document.createElement("div"); channelEl.className = "channel";
  channelEl.innerHTML = `<div id="sc-ch-label">Chopping…</div><div class="cbar"><i id="sc-ch-fill"></i></div>`;
  hudEl.appendChild(channelEl);
  const ctxEl = document.createElement("div"); ctxEl.className = "ctx"; ctxEl.style.display = "none"; hudEl.appendChild(ctxEl);
  const modalRoot = mk("");
  const menuRoot = mk("");

  const sfx = makeSfx();

  const ST = {
    screen: "menu", auth: null,
    profile: { name: "", body: BODY_COLORS[0], hat: HAT_COLORS[0] },
    me: null, rev: 0, ax: 1e6, az: 1e6, chatId: 0,
    players: [], offers: [],
    mode: "explore", placing: null,
    near: { i: null, g: null, r: null, m: false },
    modal: null, tradeTab: "market", inspect: null,
    muted: false, joining: false,
    channel: null, // {x,z,until,ms,kind} active chop/mine
    drag: null,    // backpack idx being dragged
    inspectPlayer: null,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (saved && saved.pid && saved.secret) {
      ST.auth = { pid: saved.pid, secret: saved.secret };
      ST.profile = { name: saved.name || "", body: saved.body != null ? saved.body : BODY_COLORS[0], hat: saved.hat != null ? saved.hat : HAT_COLORS[0] };
    }
  } catch (e) {}

  /* imperative toast — zero vdom */
  let toastT = null;
  const say = (msg, ms = 2400) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), ms);
  };

  /* imperative chat — input never re-renders */
  chatEl.className = "panel chat";
  chatEl.style.display = "none";
  const chatLogEl = document.createElement("div"); chatLogEl.className = "chat-log";
  const chatForm = document.createElement("div"); chatForm.className = "chat-form";
  const chatInput = document.createElement("input");
  chatInput.maxLength = 120; chatInput.placeholder = "Say something… (Enter)";
  chatInput.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    const msg = chatInput.value.trim();
    if (!msg) return;
    chatInput.value = "";
    act("chat", { msg });
  });
  chatForm.appendChild(chatInput);
  chatEl.append(chatLogEl, chatForm);
  function appendChat(line) {
    const d = document.createElement("div");
    d.className = "chat-line" + (line.sys ? " sys" : "");
    if (line.sys) d.textContent = line.m;
    else { const b = document.createElement("b"); b.textContent = line.n + ": "; d.append(b, document.createTextNode(line.m)); }
    chatLogEl.appendChild(d);
    while (chatLogEl.children.length > 60) chatLogEl.removeChild(chatLogEl.firstChild);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }

  /* ---------- NET: anchor/rev protocol ---------- */
  let pollT = null, pollBusy = false, pollSoonT = null;
  async function poll(force = false) {
    if (!ST.auth || pollBusy || (!force && ST.screen !== "playing")) return false;
    const a = { ...ST.auth };
    pollBusy = true;
    const r = await api(`/api/state?pid=${a.pid}&secret=${encodeURIComponent(a.secret)}&rev=${ST.rev}&ax=${ST.ax}&az=${ST.az}&chat=${ST.chatId}`);
    pollBusy = false;
    if (!r || !r.ok) {
      if (r && r.msg === "auth") {
        localStorage.removeItem(AUTH_KEY);
        ST.auth = null; ST.screen = "menu"; ST.me = null;
        ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0;
        paint(true);
      }
      return false;
    }
    if (!ST.auth || ST.auth.pid !== a.pid || ST.auth.secret !== a.secret) return false;
    applySnap(r.snap);
    return true;
  }
  const pollSoon = () => { clearTimeout(pollSoonT); pollSoonT = setTimeout(() => poll(), 120); };

  function applySnap(snap) {
    const forceMe = !ST.me || ST.me.id !== snap.me.id;
    ST.me = { ...snap.me, energyAt: performance.now() };
    ST.players = snap.players || [];
    for (const c of snap.chat || []) {
      if (c.id > ST.chatId) ST.chatId = c.id;
      appendChat({ sys: !c.name, n: c.name, m: c.msg });
    }
    for (const e of snap.events || []) {
      say(e.msg, 3200);
      appendChat({ sys: true, n: "", m: e.msg });
      if (e.kind === "hit") sfx.hit();
      else if (e.kind === "raid") sfx.raid();
      else if (e.kind === "milestone") sfx.milestone();
    }
    if (snap.world) {
      ST.rev = snap.world.rev; ST.ax = snap.world.ax; ST.az = snap.world.az;
      ST.offers = snap.world.offers;
      world.applyWorld(snap.world);
    }
    world.applyMe(forceMe);
    world.applyPlayers(ST.players);
    refreshNear();
    paint();
  }

  async function act(type, payload = {}) {
    if (!ST.auth) return { ok: false };
    const r = await api("/api/action", { pid: ST.auth.pid, secret: ST.auth.secret, type, ...payload });
    if (r && r.note) say(r.note, 2600);
    else if (r && !r.ok && r.msg) { sfx.err(); say(r.msg, 2400); }
    if (r && r.ok && type !== "move") pollSoon();
    return r;
  }

  async function joinGame() {
    if (ST.joining) return;
    if (ST.auth) { startPlaying(); return; }
    ST.joining = true; paint(true);
    const nameInput = document.getElementById("sc-name");
    const name = ((nameInput && nameInput.value) || ST.profile.name || "Wanderer").trim().slice(0, 18) || "Wanderer";
    ST.profile.name = name;
    const r = await api("/api/join", { name, body: ST.profile.body, hat: ST.profile.hat });
    ST.joining = false;
    if (!r || !r.ok) { say((r && r.msg) || "Could not join.", 2600); paint(true); return; }
    ST.auth = { pid: r.id, secret: r.secret };
    ST.me = null; ST.players = []; ST.offers = [];
    ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ pid: r.id, secret: r.secret, name, body: ST.profile.body, hat: ST.profile.hat }));
    startPlaying();
  }
  function forgetLocalSettler() {
    localStorage.removeItem(AUTH_KEY);
    ST.auth = null; ST.screen = "menu"; ST.me = null;
    ST.players = []; ST.offers = [];
    ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0;
    ST.modal = null; ST.inspect = null; ST.mode = "explore"; ST.placing = null;
    world.walkQueueClear();
    paint(true);
  }
  async function startPlaying() {
    if (!ST.auth) { joinGame(); return; }
    const ae = document.activeElement; if (ae && ae.blur) ae.blur();
    ST.screen = "playing";
    ST.modal = null; ST.inspect = null; ST.mode = "explore"; ST.placing = null;
    ST.rev = 0; ST.ax = 1e6; ST.az = 1e6;
    world.walkQueueClear();
    sfx.resume();
    paint(true);
    const loaded = await poll(true);
    if (loaded) say("Welcome to SolCraft. Your camp starts as a 3x3 claim. Expand from connected tiles, build on full 3x3 pads, and defend your border.", 5200);
  }

  /* ============================================================
     THREE WORLD
     ============================================================ */
  const world = (() => {
    const W = () => worldEl.clientWidth || 1, H = () => worldEl.clientHeight || 1;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    worldEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    {
      const cv = document.createElement("canvas");
      cv.width = 2; cv.height = 512;
      const c = cv.getContext("2d");
      const gr = c.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, "#2b2070"); gr.addColorStop(0.5, "#2f6a9e"); gr.addColorStop(1, "#46b8a8");
      c.fillStyle = gr; c.fillRect(0, 0, 2, 512);
      scene.background = new THREE.CanvasTexture(cv);
    }
    scene.fog = new THREE.Fog(0x3a8ba0, 26, 64);

    let view = 9.5;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const setFrustum = () => {
      const a = W() / H();
      camera.left = -view * a; camera.right = view * a;
      camera.top = view; camera.bottom = -view;
      camera.updateProjectionMatrix();
    };
    setFrustum();
    const CAM_OFFSETS = [
      new THREE.Vector3(13, 14, 13), new THREE.Vector3(13, 14, -13),
      new THREE.Vector3(-13, 14, -13), new THREE.Vector3(-13, 14, 13),
    ];
    let camIdx = 0;
    const camOffset = CAM_OFFSETS[0].clone();
    const camTarget = new THREE.Vector3(0, 0.22, 0);
    camera.position.copy(camOffset); camera.lookAt(camTarget);

    scene.add(new THREE.HemisphereLight(0xd8ecff, 0x5a7a52, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
    sun.position.set(8, 14, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 60 });
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xb9a0ff, 0.3);
    fill.position.set(-8, 6, -6); scene.add(fill);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M(0x176a78, { roughness: 1 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.38; scene.add(sea);

    { const n = 200, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i*3]=(Math.random()-0.5)*60; pos[i*3+1]=6+Math.random()*15; pos[i*3+2]=(Math.random()-0.5)*60; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xfff6dd, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false }); m.fog = false;
      scene.add(new THREE.Points(g, m)); }
    { const pos = new Float32Array(54 * 3);
      for (let i = 0; i < 54; i++) { pos[i*3]=(Math.random()-0.5)*28; pos[i*3+1]=Math.random()*4.5; pos[i*3+2]=(Math.random()-0.5)*28; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x14f195, size: 0.08, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }))); }
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Group();
      const cm = M(0xffffff, { transparent: true, opacity: 0.75, roughness: 1 });
      for (let j = 0; j < 3; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 8, 6), cm); s.position.set(j*0.7-0.7, Math.random()*0.2, Math.random()*0.4); s.scale.y = 0.5; c.add(s); }
      c.position.set((Math.random()-0.5)*44, 7+Math.random()*3, (Math.random()-0.5)*44);
      c.userData.v = 0.2 + Math.random() * 0.25; scene.add(c); clouds.push(c);
    }

    const tileGeo = new THREE.BoxGeometry(0.96, 1, 0.96);
    const SAND_TOP = M(0xe0c98f, { roughness: 1 });
    const SIDE_SAND = M(0xb09468, { roughness: 1 });
    const matsFor = (top, side) => [side, side, top, side, side, side];
    const sandMats = matsFor(SAND_TOP, SIDE_SAND);
    const ownerMatCache = new Map();
    function ownerMats(color, mine) {
      const ck = `${color}:${mine ? 1 : 0}`;
      if (ownerMatCache.has(ck)) return ownerMatCache.get(ck);
      const grass = new THREE.Color(0x6ec24f), oc = new THREE.Color(color);
      const top = M(grass.clone().lerp(oc, mine ? 0.18 : 0.45).getHex(), { roughness: 1 });
      const side = M(new THREE.Color(0x8a5e3a).lerp(oc, mine ? 0.12 : 0.3).getHex(), { roughness: 1 });
      const arr = matsFor(top, side); ownerMatCache.set(ck, arr); return arr;
    }

    const cells = new Map(), doodadPool = new Map(), buildPool = new Map();
    const lootPool = new Map(), rigPool = new Map(), exceptions = new Map(), tileOwner = new Map();
    const anims = [], bursts = [], waves = [], walkQueue = [];
    let walking = false;
    const spinners = [], spinsY = [], wavers = [], bobbers = [], flickers = [];
    const partGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    function burst(x, y, z, color, n = 14, spread = 0.5) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const items = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(partGeo, mat);
        m.position.set(x + (Math.random()-0.5)*spread, y, z + (Math.random()-0.5)*spread);
        m.rotation.set(Math.random()*3, Math.random()*3, 0);
        scene.add(m); items.push({ m, v: new THREE.Vector3((Math.random()-0.5)*2.2, 2.2+Math.random()*2, (Math.random()-0.5)*2.2) });
      }
      bursts.push({ mat, items, life: 0.75, max: 0.75 });
    }
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 32);
    function shockwave(x, z, color = 0x14f195) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.24, z); scene.add(m);
      waves.push({ m, t: 0, dur: 0.55 });
    }
    function decorateBuilding(g, b) {
      const lv = b.level || 1;
      for (let i = 0; i < lv - 1; i++) {
        const pip = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), ME(0xffd76e, 0xffb43d, 1));
        pip.position.set(-0.36 + i * 0.12, 0.07, 0.43); g.add(pip);
      }
      const pct = b.maxHp ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 1;
      if (pct < 0.98) {
        const bg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.05), new THREE.MeshBasicMaterial({ color: 0x33140e }));
        bg.position.set(0, 1.2, 0); g.add(bg);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7 * pct, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: pct < 0.35 ? 0xff5b45 : 0xffd76e }));
        bar.position.set(-0.35 * (1 - pct), 1.2, 0); g.add(bar);
      }
    }

    const me = { x: 0, z: 0 };
    const player = new THREE.Group();
    let rig = null, rigSig = "";
    player.position.set(0, 0.22, 0); scene.add(player);
    const aura = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), new THREE.MeshBasicMaterial({ color: 0x14f195, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.008; player.add(aura);
    const plight = new THREE.PointLight(0xb9a6ff, 0.35, 4.5); plight.position.y = 0.9; player.add(plight);
    function ensureRig() {
      if (!ST.me) return;
      const sig = JSON.stringify([ST.me.body, ST.me.hat, ST.me.equip]);
      if (sig === rigSig) return;
      rigSig = sig;
      if (rig) player.remove(rig);
      rig = buildRig(ST.me.body, ST.me.hat, ST.me.equip || {}, { lit: true });
      player.add(rig);
    }
    const homeBanner = new THREE.Group(); let bannerOwner = 0; scene.add(homeBanner);
    const hoverMarker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x14f195, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    hoverMarker.rotation.x = -Math.PI / 2; hoverMarker.position.y = 0.233; hoverMarker.visible = false; scene.add(hoverMarker);

    const doodadVisible = (x, z) => {
      const ex = exceptions.get(key(x, z));
      if (ex) return ex === "gone" ? null : "tree";
      return naturalDoodad(x, z);
    };
    function ensureDoodad(x, z) {
      const k = key(x, z), want = doodadVisible(x, z), have = doodadPool.get(k);
      if (have && have.type === want) return;
      if (have) { scene.remove(have.group); doodadPool.delete(k); }
      if (!want || buildPoolAt(x, z)) return;
      const g = new THREE.Group();
      if (want === "tree") buildTree(g, 0, 0, 0.9 + hrand(x, z, 11) * 0.5); else buildRock(g);
      g.position.set(x + (hrand(x, z, 5) - 0.5) * 0.3, 0.14, z + (hrand(x, z, 6) - 0.5) * 0.3);
      g.rotation.y = hrand(x, z, 7) * Math.PI * 2; scene.add(g);
      doodadPool.set(k, { group: g, type: want });
    }
    function buildPoolAt(x, z) { for (const b of buildPool.values()) if (b.x === x && b.z === z) return b; return null; }
    function refreshCell(x, z) {
      const k = key(x, z), t = tileOwner.get(k);
      let cell = cells.get(k);
      const wantMats = t ? ownerMats(t.body, ST.me && t.owner === ST.me.id) : sandMats;
      const wantH = t ? 0.22 : 0.14;
      if (!cell) {
        const mesh = new THREE.Mesh(tileGeo, wantMats);
        mesh.scale.y = wantH; mesh.position.set(x, wantH / 2, z);
        mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData = { x, z };
        scene.add(mesh); cell = { mesh, owner: (t && t.owner) || 0 }; cells.set(k, cell);
      } else if (cell.owner !== ((t && t.owner) || 0)) {
        cell.mesh.material = wantMats; cell.mesh.scale.y = wantH; cell.mesh.position.y = wantH / 2;
        cell.owner = (t && t.owner) || 0;
      }
      ensureDoodad(x, z);
    }
    let winX = 1e9, winZ = 1e9;
    function refreshWindow(force = false) {
      const px = Math.round(me.x), pz = Math.round(me.z);
      if (!force && px === winX && pz === winZ) return;
      winX = px; winZ = pz;
      for (const [k, c] of cells) {
        const [cx, cz] = k.split(",").map(Number);
        if (cheb(cx, cz, px, pz) > RENDER_R + 2) {
          scene.remove(c.mesh); cells.delete(k);
          const d = doodadPool.get(k); if (d) { scene.remove(d.group); doodadPool.delete(k); }
        }
      }
      for (let x = px - RENDER_R; x <= px + RENDER_R; x++)
        for (let z = pz - RENDER_R; z <= pz + RENDER_R; z++) refreshCell(x, z);
    }
    function hardSnapMe(x, z) {
      walkQueue.length = 0; walking = false;
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].kind === "hop") anims.splice(i, 1);
      me.x = x; me.z = z; player.position.set(x, 0.22, z); camTarget.set(x, 0.22, z);
      refreshWindow(true);
    }

    function applyWorld(w) {
      tileOwner.clear();
      for (const t of w.tiles) tileOwner.set(key(t.x, t.z), { owner: t.owner, body: t.ownerBody });
      exceptions.clear();
      for (const d of w.doodads) exceptions.set(key(d.x, d.z), d.type);
      const seen = new Set();
      for (const b of w.buildings) {
        seen.add(b.uid);
        const sig = [b.kind, b.nm || "", b.cl || "", b.ownerBody, b.level, Math.ceil(b.hp), b.maxHp].join("|");
        let have = buildPool.get(b.uid);
        if (have && have.sig !== sig) { removeBuild(b.uid); have = null; }
        if (!have) {
          const { group, parts } = makeBuildingGroup(b.kind, { nm: b.nm, cl: b.cl, plinth: b.ownerBody });
          decorateBuilding(group, b);
          group.position.set(b.x, 0.22, b.z); scene.add(group);
          spinners.push(...parts.spinners); spinsY.push(...parts.spinsY);
          wavers.push(...parts.wavers); bobbers.push(...parts.bobbers); flickers.push(...parts.flickers);
          have = { group, parts, sig, x: b.x, z: b.z, kind: b.kind, owner: b.owner };
          buildPool.set(b.uid, have);
          const dd = doodadPool.get(key(b.x, b.z));
          if (dd) { scene.remove(dd.group); doodadPool.delete(key(b.x, b.z)); }
        }
        Object.assign(have, { acc: b.acc, accAt: b.accAt, cdUntil: b.cdUntil, ownerName: b.ownerName, nm: b.nm, cl: b.cl, level: b.level, hp: b.hp, maxHp: b.maxHp });
      }
      for (const uid of [...buildPool.keys()]) if (!seen.has(uid)) removeBuild(uid, true);
      const lootSeen = new Set();
      for (const l of w.loot) {
        lootSeen.add(l.id);
        if (lootPool.has(l.id)) continue;
        const g = new THREE.Group(); g.add(lootMesh(l.kind, l.gid));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 20), new THREE.MeshBasicMaterial({ color: 0xf5d76e, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = -0.1; g.add(ring);
        g.position.set(l.x, 0.52, l.z); g.scale.setScalar(0.01); scene.add(g);
        anims.push({ kind: "in", obj: g, t: 0, dur: 0.35 });
        lootPool.set(l.id, { group: g, x: l.x, z: l.z });
      }
      for (const [id, l] of [...lootPool]) {
        if (lootSeen.has(id)) continue;
        anims.push({ kind: "up", obj: l.group, t: 0, dur: 0.3, done: () => scene.remove(l.group) });
        lootPool.delete(id);
      }
      refreshWindow(true);
    }
    function applyPlayers(players) {
      const pSeen = new Set();
      for (const q of players) {
        pSeen.add(q.id);
        const sig = JSON.stringify([q.body, q.hat, q.equip, q.name]);
        let r = rigPool.get(q.id);
        if (r && r.sig !== sig) { scene.remove(r.group); rigPool.delete(q.id); r = null; }
        if (!r) {
          const group = new THREE.Group();
          group.add(buildRig(q.body, q.hat, q.equip || {}, {}));
          group.add(makeLabel(q.name, "#cfe8ff"));
          group.position.set(q.x, 0.22, q.z); scene.add(group);
          r = { group, sig, tx: q.x, tz: q.z }; rigPool.set(q.id, r);
        }
        r.tx = q.x; r.tz = q.z;
      }
      for (const [id, r] of [...rigPool]) { if (pSeen.has(id)) continue; scene.remove(r.group); rigPool.delete(id); }
    }
    function applyMe(forceMe = false) {
      if (!ST.me) return;
      if (forceMe || cheb(ST.me.x, ST.me.z, me.x, me.z) > 4) hardSnapMe(ST.me.x, ST.me.z);
      ensureRig();
      if (bannerOwner !== ST.me.id) {
        bannerOwner = ST.me.id; homeBanner.clear();
        buildBanner(homeBanner, ST.me.body, { wavers });
        homeBanner.add(makeLabel(`${ST.me.name} ⌂`, "#9bffd9"));
      }
      homeBanner.position.set(ST.me.x, 0.22, ST.me.z - 0.45);
      refreshWindow();
    }
    function removeBuild(uid, boom = false) {
      const b = buildPool.get(uid); if (!b) return;
      if (boom) { burst(b.x, 0.5, b.z, 0xd6604f, 16, 0.6); shockwave(b.x, b.z, 0xff8a5e); }
      scene.remove(b.group); buildPool.delete(uid);
    }

    const blocked = (x, z) => !!buildPoolAt(x, z);
    function stepTo(x, z) {
      if (blocked(x, z)) return false;
      walking = true;
      const from = { x: me.x, z: me.z };
      me.x = x; me.z = z;
      anims.push({ kind: "hop", t: 0, dur: 0.16, from, to: { x, z }, done: () => {
        walking = false; sfx.hop(); act("move", { x, z }); refreshWindow(); refreshNear();
        const next = walkQueue.shift(); if (next) stepTo(next[0], next[1]);
      } });
      return true;
    }
    function tryMoveDelta(dx, dz) {
      if (walking || ST.modal || ST.screen !== "playing") return;
      const rot = [[1,0,0,1],[0,-1,1,0],[-1,0,0,-1],[0,1,-1,0]][camIdx];
      const rx = dx*rot[0] + dz*rot[1], rz = dx*rot[2] + dz*rot[3];
      walkQueue.length = 0; stepTo(me.x + rx, me.z + rz);
    }
    function pathTo(tx, tz) {
      if (blocked(tx, tz) || (tx === me.x && tz === me.z)) return;
      if (cheb(tx, tz, me.x, me.z) > RENDER_R) return;
      const start = key(me.x, me.z);
      const prev = new Map([[start, null]]); const q = [[me.x, me.z]]; let found = false;
      while (q.length && prev.size < 1600) {
        const [cx, cz] = q.shift();
        if (cx === tx && cz === tz) { found = true; break; }
        for (const [dx, dz] of N4) {
          const nx = cx + dx, nz = cz + dz, nk = key(nx, nz);
          if (prev.has(nk) || blocked(nx, nz) || cheb(nx, nz, me.x, me.z) > RENDER_R + 2) continue;
          prev.set(nk, [cx, cz]); q.push([nx, nz]);
        }
      }
      if (!found) return;
      const path = []; let cur = [tx, tz];
      while (cur && key(cur[0], cur[1]) !== start) { path.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
      walkQueue.length = 0; walkQueue.push(...path.slice(1));
      if (path[0] && !walking) stepTo(path[0][0], path[0][1]);
    }

    const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    function cellFromEvent(ev) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        const x = Math.round(hit.x), z = Math.round(hit.z);
        if (cells.has(key(x, z))) return { x, z };
      }
      const hits = raycaster.intersectObjects([...cells.values()].map((c) => c.mesh), false);
      if (!hits.length) return null;
      const u = hits[0].object.userData; return { x: u.x, z: u.z };
    }
    function buildingFromEvent(ev) {
      const c = cellFromEvent(ev); if (!c) return null;
      for (const [uid, b] of buildPool) if (b.x === c.x && b.z === c.z) return { uid, b };
      return null;
    }

    const clock = new THREE.Clock(); let mmT = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur);
        if (a.kind === "hop") {
          const x = a.from.x + (a.to.x - a.from.x) * k, z = a.from.z + (a.to.z - a.from.z) * k;
          player.position.set(x, 0.22 + Math.sin(k * Math.PI) * 0.24, z);
        } else if (a.kind === "in") { if (a.obj) a.obj.scale.setScalar(0.01 + 0.99 * k); }
        else if (a.kind === "up") { if (a.obj) { a.obj.position.y = 0.52 + k * 0.7; a.obj.scale.setScalar(1 - k * 0.9); } }
        if (k >= 1) { anims.splice(i, 1); a.done && a.done(); }
      }
      if (!anims.some((a) => a.kind === "hop")) player.position.set(me.x, 0.22, me.z);
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.life -= dt;
        for (const it of b.items) { it.v.y -= 7 * dt; it.m.position.addScaledVector(it.v, dt); it.m.rotation.x += dt * 4; it.m.rotation.y += dt * 5; }
        b.mat.opacity = Math.max(0, b.life / b.max);
        if (b.life <= 0) { for (const it of b.items) scene.remove(it.m); b.mat.dispose(); bursts.splice(i, 1); }
      }
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i]; w.t += dt; const k = w.t / w.dur;
        w.m.scale.setScalar(1 + k * 2.4); w.m.material.opacity = Math.max(0, 0.55 * (1 - k));
        if (k >= 1) { scene.remove(w.m); w.m.material.dispose(); waves.splice(i, 1); }
      }
      for (const s of spinners) s.rotation.z -= dt * 2.4;
      for (const s of spinsY) s.rotation.y += dt * 1.6;
      for (const wv of wavers) wv.rotation.y = Math.sin(t * 3 + wv.position.y) * 0.18;
      for (const b of bobbers) b.position.y = (b.userData.baseY != null ? b.userData.baseY : b.position.y) + Math.sin(t * 2.2 + b.position.x) * 0.04;
      for (const f of flickers) f.material.emissiveIntensity = 0.9 + Math.sin(t * 9 + f.position.x * 7) * 0.35;
      for (const l of lootPool.values()) { l.group.position.y = 0.52 + Math.sin(t * 2.4 + l.x) * 0.06; l.group.rotation.y += dt * 1.2; }
      for (const r of rigPool.values()) { r.group.position.x += (r.tx - r.group.position.x) * 0.08; r.group.position.z += (r.tz - r.group.position.z) * 0.08; }
      for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > me.x + 30) c.position.x = me.x - 30; }
      camTarget.x += (player.position.x - camTarget.x) * 0.06;
      camTarget.z += (player.position.z - camTarget.z) * 0.06;
      camOffset.lerp(CAM_OFFSETS[camIdx], 0.08);
      camera.position.copy(camTarget).add(camOffset); camera.lookAt(camTarget);
      sun.position.set(camTarget.x + 8, 14, camTarget.z + 5); sun.target.position.copy(camTarget);
      mmT += dt; if (mmT > 0.6) { mmT = 0; drawMinimap(); }
      renderer.render(scene, camera);
    });

    function drawMinimap() {
      if (!ST.me || ST.screen !== "playing") return;
      const c = minimapEl.getContext("2d");
      const Wm = minimapEl.width, Hm = minimapEl.height, R = RENDER_R;
      c.fillStyle = "#0b1420"; c.fillRect(0, 0, Wm, Hm);
      const sx = Wm / (R * 2 + 1), sz = Hm / (R * 2 + 1);
      for (const [k, tv] of tileOwner) {
        const [x, z] = k.split(",").map(Number);
        if (cheb(x, z, me.x, me.z) > R) continue;
        c.fillStyle = "#" + new THREE.Color(tv.body).getHexString();
        c.globalAlpha = tv.owner === ST.me.id ? 0.95 : 0.55;
        c.fillRect((x - me.x + R) * sx, (z - me.z + R) * sz, sx, sz);
      }
      c.globalAlpha = 1;
      for (const b of buildPool.values()) { if (cheb(b.x, b.z, me.x, me.z) > R) continue; c.fillStyle = "#1b2a3f"; c.fillRect((b.x - me.x + R) * sx, (b.z - me.z + R) * sz, sx, sz); }
      for (const l of lootPool.values()) { if (cheb(l.x, l.z, me.x, me.z) > R) continue; c.fillStyle = "#f5d76e"; c.fillRect((l.x - me.x + R) * sx + sx * 0.25, (l.z - me.z + R) * sz + sz * 0.25, sx * 0.5, sz * 0.5); }
      for (const r of rigPool.values()) { c.fillStyle = "#ff7b6b"; c.fillRect((r.tx - me.x + R) * sx, (r.tz - me.z + R) * sz, sx, sz); }
      c.fillStyle = "#f3ead7"; c.fillRect(R * sx, R * sz, sx, sz);
    }

    function onResize() { renderer.setSize(W(), H()); setFrustum(); }
    window.addEventListener("resize", onResize);

    return {
      applyWorld, applyPlayers, applyMe, me, cellFromEvent, buildingFromEvent, pathTo, tryMoveDelta,
      blocked, buildPoolAt, doodadVisible, burst, shockwave, hoverMarker,
      tileOwner, buildPool, lootPool, rigPool,
      rotateCam: () => { camIdx = (camIdx + 1) % 4; },
      zoom: (d) => { view = Math.min(15, Math.max(5, view + d)); setFrustum(); },
      walkQueueClear: () => { walkQueue.length = 0; },
      dispose: () => { renderer.setAnimationLoop(null); window.removeEventListener("resize", onResize); renderer.dispose(); worldEl.removeChild(renderer.domElement); },
    };
  })();

  /* ============================================================
     INTERACTION PROBE
     ============================================================ */
  function estAcc(b) {
    const def = LIB_BY_ID[b.kind];
    if (!def || !def.prod) return 0;
    const rate = (Object.values(def.prod)[0] || 0) * lvlMul(b.level || 1);
    return Math.min(60, (b.acc || 0) + rate * Math.max(0, Date.now() - (b.accAt || Date.now())) / 1000);
  }
  function probeInteract() {
    if (!ST.me) return null;
    const px = world.me.x, pz = world.me.z;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = world.buildPoolAt(px + dx, pz + dz);
      if (!b || b.owner !== ST.me.id) continue;
      const uid = [...world.buildPool.entries()].find(([, v]) => v === b)?.[0];
      const def = LIB_BY_ID[b.kind];
      if (def && def.prod && estAcc(b) >= 1) return { t: "use", uid, label: `Collect ${b.nm || def.name} (+${Math.floor(estAcc(b))})` };
      if (def && def.use) {
        const cdLeft = Math.max(0, Math.ceil(((b.cdUntil || 0) - Date.now()) / 1000));
        if (def.use.k === "trade") return { t: "trade", uid, label: "Trade (T)" };
        return { t: "use", uid, label: def.use.label + (cdLeft ? ` · ${cdLeft}s` : "") };
      }
    }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const d = world.doodadVisible(px + dx, pz + dz);
      if (!d || world.buildPoolAt(px + dx, pz + dz)) continue;
      return d === "tree"
        ? { t: "harvest", x: px + dx, z: pz + dz, label: "Chop tree +3🪵" }
        : { t: "harvest", x: px + dx, z: pz + dz, label: "Mine rock +3🪨" };
    }
    return null;
  }
  function refreshNear() {
    if (!ST.me) return;
    const px = world.me.x, pz = world.me.z;
    ST.near.i = probeInteract();
    let g = null, best = 99;
    for (const q of ST.players) { const d = cheb(q.x, q.z, px, pz); if (d <= 2 && d < best) { best = d; g = q; } }
    ST.near.g = g;
    ST.near.r = null;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = world.buildPoolAt(px + dx, pz + dz);
      if (b && ST.me && b.owner !== ST.me.id) {
        const uid = [...world.buildPool.entries()].find(([, v]) => v === b)?.[0];
        ST.near.r = { uid, name: b.nm || LIB_BY_ID[b.kind]?.name || b.kind, owner: b.ownerName };
      }
    }
    ST.near.m = false;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = world.buildPoolAt(px + dx, pz + dz);
      if (b && LIB_BY_ID[b.kind]?.use?.k === "trade") ST.near.m = true;
    }
  }
  const nearT = setInterval(() => { if (ST.screen !== "playing") return; refreshNear(); paint(); }, 450);

  function doInteract() {
    const i = ST.near.i; if (!i) return;
    if (i.t === "harvest") startChop(i.x, i.z);
    else if (i.t === "trade") { ST.modal = "trade"; ST.tradeTab = "market"; paint(); }
    else if (i.t === "use") act("use", { uid: i.uid }).then((r) => { if (!r || !r.ok) return; if (r.openTrade) { ST.modal = "trade"; ST.tradeTab = "market"; paint(); return; } sfx.saw(); });
  }

  /* ---------- channelled harvest: progress bar, energy spent on start ---------- */
  function startChop(x, z) {
    if (ST.channel) return; // already busy
    const d = world.doodadVisible(x, z);
    if (!d) return;
    act("harvestStart", { x, z }).then((r) => {
      if (!r || !r.ok) return;
      sfx.chop();
      ST.channel = { x, z, until: performance.now() + r.ms, ms: r.ms, kind: r.kind || d };
      channelEl.classList.add("on");
      const lbl = document.getElementById("sc-ch-label");
      if (lbl) lbl.textContent = (ST.channel.kind === "tree" ? "Chopping…" : "Mining…");
    });
  }
  function cancelChop(silent = false) {
    if (!ST.channel) return;
    ST.channel = null;
    channelEl.classList.remove("on");
    if (!silent) act("harvestCancel", {});
  }
  /* drives the bar + completion; also cancels if the player walked off */
  const channelT = setInterval(() => {
    if (!ST.channel) return;
    const ch = ST.channel;
    if (!ST.me || cheb(world.me.x, world.me.z, ch.x, ch.z) > 1) { cancelChop(); return; }
    const now = performance.now();
    const k = Math.min(1, 1 - (ch.until - now) / ch.ms);
    const fill = document.getElementById("sc-ch-fill");
    if (fill) fill.style.width = `${(k * 100).toFixed(0)}%`;
    if (now >= ch.until) {
      const { x, z, kind } = ch;
      ST.channel = null;
      channelEl.classList.remove("on");
      act("harvestFinish", { x, z }).then((r) => {
        if (r && r.ok) world.burst(x, 0.4, z, kind === "tree" ? 0x52ad58 : 0xaaa69a, 12, 0.45);
      });
    }
  }, 60);

  /* ============================================================
     RIGHT-CLICK CONTEXT MENU — imperative floating menu
     ============================================================ */
  function hideCtx() { ctxEl.style.display = "none"; ctxEl.replaceChildren(); }
  function showCtx(clientX, clientY, header, items) {
    ctxEl.replaceChildren();
    if (header) { const h = document.createElement("div"); h.className = "ctx-h"; h.textContent = header; ctxEl.appendChild(h); }
    for (const it of items) {
      const b = document.createElement("button");
      if (it.danger) b.className = "danger";
      const span = document.createElement("span"); span.textContent = it.label; b.appendChild(span);
      if (it.hint) { const s = document.createElement("small"); s.textContent = it.hint; b.appendChild(s); }
      b.disabled = !!it.disabled;
      b.addEventListener("click", () => { hideCtx(); it.run && it.run(); });
      ctxEl.appendChild(b);
    }
    ctxEl.style.display = "block";
    const r = ctxEl.getBoundingClientRect();
    const hr = hudEl.getBoundingClientRect();
    let x = clientX - hr.left, y = clientY - hr.top;
    if (x + r.width > hr.width) x = hr.width - r.width - 6;
    if (y + r.height > hr.height) y = hr.height - r.height - 6;
    ctxEl.style.left = Math.max(6, x) + "px";
    ctxEl.style.top = Math.max(6, y) + "px";
  }
  function onContext(ev) {
    if (ST.screen !== "playing") return;
    ev.preventDefault();
    if (ST.modal) return;
    const hitB = world.buildingFromEvent(ev);
    const c = world.cellFromEvent(ev);
    const me = ST.me;
    /* a building under the cursor */
    if (hitB && me) {
      const def = LIB_BY_ID[hitB.b.kind];
      const adj = cheb(hitB.b.x, hitB.b.z, world.me.x, world.me.z) <= 1;
      if (hitB.b.owner === me.id) {
        const items = [{ label: "Inspect / manage", run: () => { ST.inspect = hitB.uid; ST.modal = "inspect"; paint(); } }];
        if (adj && (def?.use || def?.prod)) items.push({ label: "Use (E)", run: () => act("use", { uid: hitB.uid }).then((r) => { if (r?.openTrade) { ST.modal = "trade"; paint(); } }) });
        if (adj) items.push({ label: "Upgrade", hint: `Lv ${hitB.b.level}`, run: () => act("upgrade", { uid: hitB.uid }) });
        if (adj && hitB.b.hp < hitB.b.maxHp) items.push({ label: "Repair", run: () => act("repair", { uid: hitB.uid }) });
        items.push({ label: "Demolish", danger: true, run: () => act("demolish", { uid: hitB.uid }).then((r) => r?.ok && sfx.demolish()) });
        showCtx(ev.clientX, ev.clientY, `${def?.glyph || ""} ${hitB.b.nm || def?.name || hitB.b.kind}`, items);
      } else {
        showCtx(ev.clientX, ev.clientY, `${def?.name || hitB.b.kind} — ${hitB.b.ownerName}'s`, [
          { label: "Raid (G)", danger: true, disabled: !adj, hint: adj ? "" : "walk closer", run: () => doRaid(hitB.uid) },
          { label: "Walk here", run: () => world.pathTo(hitB.b.x, hitB.b.z) },
        ]);
      }
      return;
    }
    /* a player under the cursor */
    if (c) {
      const q = ST.players.find((p) => p.x === c.x && p.z === c.z);
      if (q) {
        const adj = cheb(q.x, q.z, world.me.x, world.me.z) <= 2;
        showCtx(ev.clientX, ev.clientY, q.name, [
          { label: "Inspect settler", run: () => { ST.inspectPlayer = q; ST.modal = "player"; paint(); } },
          { label: "Fight (F)", danger: true, disabled: !adj, hint: adj ? "" : "too far", run: () => act("fight", { target: q.id }).then((r) => r?.ok && sfx.hit()) },
          { label: "Walk toward", run: () => world.pathTo(q.x, q.z) },
        ]);
        return;
      }
    }
    /* a tree / rock doodad */
    if (c) {
      const d = world.doodadVisible(c.x, c.z);
      if (d) {
        const adj = cheb(c.x, c.z, world.me.x, world.me.z) <= 1;
        showCtx(ev.clientX, ev.clientY, d === "tree" ? "🌳 Tree" : "🪨 Rock", [
          { label: d === "tree" ? "Chop (+3🪵)" : "Mine (+3🪨)", disabled: !adj, hint: adj ? `${(harvestMs(me?.skills) / 1000).toFixed(1)}s` : "walk closer", run: () => startChop(c.x, c.z) },
          { label: "Inspect", run: () => say(d === "tree" ? "A tree. Chop it for wood — Gathering skill yields more." : "A rock. Mine it for stone.") },
          { label: "Walk here", run: () => world.pathTo(c.x, c.z) },
        ]);
        return;
      }
      /* empty tile */
      const t = world.tileOwner.get(key(c.x, c.z));
      const onTile = world.me.x === c.x && world.me.z === c.z;
      const items = [{ label: "Walk here", run: () => world.pathTo(c.x, c.z) }];
      if (me && t && t.owner === me.id) items.push({ label: "Build here (B)", run: () => { ST.modal = "build"; paint(); } });
      if (me && onTile) items.unshift({ label: "Claim / capture (C)", run: doClaim });
      showCtx(ev.clientX, ev.clientY, t ? (t.owner === me?.id ? "Your land" : "Claimed land") : "Frontier", items);
    }
  }
  worldEl.addEventListener("contextmenu", onContext);
  window.addEventListener("pointerdown", (ev) => { if (!ctxEl.contains(ev.target)) hideCtx(); }, true);

  function doClaim() { act("claim", { x: world.me.x, z: world.me.z }).then((r) => { if (r && r.ok) { sfx.claim(); world.shockwave(world.me.x, world.me.z); } }); }
  function doFight() { if (!ST.near.g) return; act("fight", { target: ST.near.g.id }).then((r) => { if (r && r.ok) sfx.hit(); }); }
  function doRaid(uid) { const target = uid != null ? uid : (ST.near.r && ST.near.r.uid); if (target == null) return; act("raid", { uid: target }).then((r) => { if (r && r.ok) sfx.raid(); }); }

  function canPlaceAt(x, z) {
    const t = world.tileOwner.get(key(x, z));
    if (!t || !ST.me || t.owner !== ST.me.id) return "Build on YOUR claimed land.";
    for (const [dx, dz] of N8) { const nt = world.tileOwner.get(key(x + dx, z + dz)); if (!nt || nt.owner !== ST.me.id) return "Needs a full 3x3 owned plot around the building."; }
    if (world.buildPoolAt(x, z)) return "Occupied.";
    if (world.me.x === x && world.me.z === z) return "Step aside first.";
    for (const [dx, dz] of N8) if (world.buildPoolAt(x + dx, z + dz)) return "Needs a 1-tile street gap on every side.";
    return null;
  }

  /* ---------- input ---------- */
  function onPointerMove(ev) {
    if (ST.screen !== "playing") return;
    const c = world.cellFromEvent(ev);
    if (!c) { world.hoverMarker.visible = false; return; }
    world.hoverMarker.visible = true; world.hoverMarker.position.x = c.x; world.hoverMarker.position.z = c.z;
    const mat = world.hoverMarker.material;
    if (ST.mode === "place") mat.color.set(canPlaceAt(c.x, c.z) ? 0xd6604f : 0x14f195);
    else if (ST.mode === "demolish") mat.color.set(0xd6604f);
    else mat.color.set(0x14f195);
  }
  function onPointerDown(ev) {
    if (ST.screen !== "playing" || ST.modal) return;
    sfx.resume();
    const hitB = world.buildingFromEvent(ev), c = world.cellFromEvent(ev);
    if (ST.mode === "place" && ST.placing && c) {
      const bad = canPlaceAt(c.x, c.z);
      if (bad) { sfx.err(); say(bad); return; }
      act("place", { kind: ST.placing, x: c.x, z: c.z }).then((r) => { if (r && r.ok) { sfx.build(); world.shockwave(c.x, c.z, 0xffe2a8); } });
      return;
    }
    if (ST.mode === "demolish" && hitB) {
      if (ST.me && hitB.b.owner === ST.me.id) act("demolish", { uid: hitB.uid }).then((r) => { if (r && r.ok) sfx.demolish(); });
      else { sfx.err(); say("Not your building."); }
      return;
    }
    if (hitB) {
      if (ST.me && hitB.b.owner === ST.me.id) { ST.inspect = hitB.uid; ST.modal = "inspect"; paint(); }
      else if (cheb(hitB.b.x, hitB.b.z, world.me.x, world.me.z) <= 1) doRaid(hitB.uid);
      else say(`${hitB.b.nm || LIB_BY_ID[hitB.b.kind]?.name} — ${hitB.b.ownerName}'s. Walk beside it to raid (G).`);
      return;
    }
    if (c) world.pathTo(c.x, c.z);
  }
  function onWheel(ev) { if (ST.screen !== "playing") return; ev.preventDefault(); world.zoom(ev.deltaY > 0 ? 0.8 : -0.8); }
  function onKey(ev) {
    if (ST.screen !== "playing") return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const k = ev.key.toLowerCase();
    if (k === "w" || ev.key === "ArrowUp") world.tryMoveDelta(0, -1);
    else if (k === "s" || ev.key === "ArrowDown") world.tryMoveDelta(0, 1);
    else if (k === "a" || ev.key === "ArrowLeft") world.tryMoveDelta(-1, 0);
    else if (k === "d" || ev.key === "ArrowRight") world.tryMoveDelta(1, 0);
    else if (k === "e") doInteract();
    else if (k === "c" || k === " ") doClaim();
    else if (k === "b") { ST.modal = ST.modal === "build" ? null : "build"; paint(); }
    else if (k === "i") { ST.modal = ST.modal === "inv" ? null : "inv"; paint(); }
    else if (k === "r") { ST.modal = ST.modal === "craft" ? null : "craft"; paint(); }
    else if (k === "k") { ST.modal = ST.modal === "skills" ? null : "skills"; paint(); }
    else if (k === "t") { if (ST.near.m) { ST.modal = "trade"; paint(); } else say("Stand beside a Market to trade."); }
    else if (k === "f") doFight();
    else if (k === "g") doRaid();
    else if (k === "x") { ST.mode = ST.mode === "demolish" ? "explore" : "demolish"; ST.placing = null; paint(); }
    else if (k === "q") world.rotateCam();
    else if (k === "h" || k === "?") { ST.modal = ST.modal === "help" ? null : "help"; paint(); }
    else if (ev.key === "Escape") { cancelChop(); ST.modal = null; ST.inspect = null; ST.inspectPlayer = null; ST.mode = "explore"; ST.placing = null; world.walkQueueClear(); paint(); }
  }
  worldEl.addEventListener("pointermove", onPointerMove);
  worldEl.addEventListener("pointerdown", onPointerDown);
  worldEl.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);

  /* ============================================================
     UI VIEWS — region-scoped vdom
     ============================================================ */
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  const costStr = (cost) => Object.entries(cost || {}).filter(([, v]) => v).map(([k, v]) => `${v}${COSTI[k]}`).join(" ");
  const liveE = () => {
    const m = ST.me; if (!m) return 0;
    return Math.min(m.maxE, m.energy + m.regen * (performance.now() - m.energyAt) / 1000);
  };
  const nearForge = () => {
    if (!ST.me) return false;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = world.buildPoolAt(world.me.x + dx, world.me.z + dz);
      if (b && b.kind === "forge") return true;
    }
    return false;
  };

  function Menu() {
    if (ST.screen !== "menu") return <div />;
    return (
      <div className="menu">
        <div className="menu-card">
          <h1 className="title">SOL<em>CRAFT</em></h1>
          <p className="subtitle">A shared multiplayer frontier. Every settler starts with a private 3x3 camp, grows one connected hold, builds an economy — and the gold loop pays out in $CRAFTS.</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 14 }}>
            <div className="card"><div className="card-title">1 · Start with 3x3 land</div><div className="tiny">{ECONOMY.land}</div></div>
            <div className="card"><div className="card-title">2 · Spend energy to act</div><div className="tiny">{ECONOMY.energy}</div></div>
            <div className="card"><div className="card-title">3 · Gather, sell, earn</div><div className="tiny">{ECONOMY.resources} {ECONOMY.gold}</div></div>
            <div className="card"><div className="card-title">4 · Hold $CRAFTS</div><div className="tiny">{ECONOMY.crafts}</div></div>
          </div>
          <div className="card" style={{ marginBottom: 14 }}><div className="card-title">Cash out</div><div className="tiny">{ECONOMY.redeem}</div></div>
          <p className="tiny" style={{ margin: "0 0 12px" }}>Controls: click to walk · WASD step · C claim/capture · B build · E interact · I inventory · T trade near market · F fight · G raid · X demolish · Q rotate camera · ? help</p>
          <div className="field"><label>Settler name</label><input id="sc-name" maxLength={18} placeholder="Wanderer" defaultValue={ST.profile.name} /></div>
          <div className="field"><label>Body</label><div className="row">
            {BODY_COLORS.map((c) => <button className={"swatch" + (ST.profile.body === c ? " on" : "")} style={{ background: hex(c) }} onClick={() => { ST.profile.body = c; paint(true); }} />)}
          </div></div>
          <div className="field"><label>Hat</label><div className="row">
            {HAT_COLORS.map((c) => <button className={"swatch" + (ST.profile.hat === c ? " on" : "")} style={{ background: hex(c) }} onClick={() => { ST.profile.hat = c; paint(true); }} />)}
          </div></div>
          <div className="row" style={{ marginTop: 14 }}>
            {ST.auth
              ? <><button className="btn primary" onClick={startPlaying} disabled={ST.joining}>▶ Enter frontier as {ST.profile.name || "settler"}</button><button className="btn" onClick={forgetLocalSettler} disabled={ST.joining}>Switch settler</button></>
              : <button className="btn primary" onClick={joinGame} disabled={ST.joining}>{ST.joining ? "Settling…" : "▶ Settle the frontier"}</button>}
          </div>
          <p className="tiny" style={{ marginTop: 12 }}>Everyone shares one map. “Switch settler” only clears this browser session; it does not move or reset the shared world.</p>
        </div>
      </div>
    );
  }

  function Hud() {
    const m = ST.me;
    if (ST.screen !== "playing" || !m) return <div />;
    const obj = m.msIndex < MILESTONES.length ? MILESTONES[m.msIndex].text : FINAL_TEXT;
    const atk = 2 + gearStat(m.equip, "atk"), def = gearStat(m.equip, "def");
    const packCount = (m.pack || []).filter(Boolean).length;
    const xpNext = xpForLevel((m.level || 1) + 1);
    const xpPct = Math.min(100, 100 * (m.xp || 0) / xpNext);
    return (
      <div className="panel hud">
        <div className="row">
          <span className="lvlchip">Lv {m.level || 1}{m.skillPts ? ` · ${m.skillPts}★` : ""}</span>
          <span className="stat good">⚡ <span id="sc-e-now">{Math.floor(liveE())}</span>/{m.maxE}</span>
          <span className="stat">+{m.regen.toFixed(2)}/s</span>
          <span className="stat">♥ {Math.ceil(m.hp)}/{MAX_HP}</span>
          <span className="stat">▦ {m.territory}</span>
          <span className="stat">⌂ {m.built}</span>
        </div>
        <div className="ebar"><i id="sc-e-fill" style={{ width: `${(100 * liveE() / m.maxE).toFixed(1)}%` }} /></div>
        <div className="xpbar"><i style={{ width: `${xpPct.toFixed(1)}%` }} /></div>
        <div className="row" style={{ marginTop: 6 }}>{RES_KEYS.map((r) => <span className="stat">{COSTI[r]} {m.inv[r] || 0}</span>)}</div>
        <div className="row" style={{ marginTop: 6 }}><span className="stat">⚔ {atk}</span><span className="stat">🛡 {def}</span><span className="stat">🎒 {packCount}/{PACK_SIZE}</span></div>
        <div className="objective"><b>◆</b><span>{obj}</span></div>
        <div className="tiny" style={{ marginTop: 4 }}>
          {ST.mode === "place" ? `Placing ${LIB_BY_ID[ST.placing]?.name} — click a highlighted cell · Esc cancels`
            : ST.mode === "demolish" ? "Demolish mode — click one of YOUR buildings · Esc cancels"
            : ST.near.i ? `E — ${ST.near.i.label}` : "Click to walk · C claim · B build · E interact"}
        </div>
      </div>
    );
  }

  function TopActions() {
    if (ST.screen !== "playing") return <div />;
    return (
      <div className="top-actions">
        <button className="btn primary" onClick={() => { ST.modal = "build"; paint(); }}>⌂ Build (B)</button>
        <button className="btn" onClick={() => { ST.modal = "inv"; paint(); }}>🎒 Items (I)</button>
        <button className="btn" onClick={() => { ST.modal = "craft"; paint(); }}>⚒ Craft (R)</button>
        <button className="btn" onClick={() => { ST.modal = "skills"; paint(); }}>★ Skills (K){ST.me && ST.me.skillPts ? ` ·${ST.me.skillPts}` : ""}</button>
        <button className="btn" disabled={!ST.near.m} onClick={() => { ST.modal = "trade"; paint(); }}>᯼ Trade (T)</button>
        <button className="btn" onClick={() => { ST.muted = !ST.muted; sfx.setMuted(ST.muted); paint(true); }}>{ST.muted ? "🔇" : "🔊"}</button>
        <button className="btn" onClick={() => { ST.modal = "help"; paint(); }}>?</button>
        <button className="btn warn" onClick={forgetLocalSettler}>Log out</button>
      </div>
    );
  }

  function BottomBar() {
    if (ST.screen !== "playing") return <div />;
    return (
      <div className="bottom-bar">
        <button className="btn" onClick={doClaim}>C Claim (4⚡)</button>
        <button className="btn primary" disabled={!ST.near.i} onClick={doInteract}>E {ST.near.i ? ST.near.i.label : "Interact"}</button>
        <button className="btn" disabled={!ST.near.g} onClick={doFight}>F Fight{ST.near.g ? ` ${ST.near.g.name}` : ""}</button>
        <button className="btn danger" disabled={!ST.near.r} onClick={() => doRaid()}>G Raid{ST.near.r ? ` ${ST.near.r.name}` : ""}</button>
        <button className={"btn" + (ST.mode === "demolish" ? " danger" : "")} onClick={() => { ST.mode = ST.mode === "demolish" ? "explore" : "demolish"; ST.placing = null; paint(); }}>X Demolish</button>
        <button className="btn" onClick={() => world.rotateCam()}>Q Cam</button>
      </div>
    );
  }

  function BuildModal() {
    const m = ST.me;
    return (
      <div className="modal">
        <h2>Build — every building is 1×1 with a street gap</h2>
        <p className="tiny">The gap rule applies across ALL players, so the shared city stays walkable. A structure really costs 9 tiles of territory.</p>
        <div className="grid">
          {LIBRARY.map((b) => {
            const locked = (m?.territory || 0) < (b.unlock || 0);
            const miss = Object.entries(b.cost).filter(([res, amt]) => (res === "e" ? liveE() : (m.inv[res] || 0)) < amt);
            return (
              <div className={"card" + (locked ? " locked" : "")}>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="glyph">{b.glyph}</span><span className="cost">{costStr(b.cost)}</span></div>
                <div className="card-title">{b.name}</div>
                <div className="tiny">{b.blurb}</div>
                {b.use ? <span className="usetag">E: {b.use.label}</span> : null}
                {b.prod ? <span className="usetag">⏳ produces {Object.keys(b.prod).map((k) => COSTI[k]).join("")}</span> : null}
                <div className="tiny">+{b.regen}/s{b.maxE ? ` · +${b.maxE} cap` : ""}</div>
                {locked
                  ? <div className="tiny">Unlocks at {b.unlock} tiles</div>
                  : <button className="btn primary" disabled={miss.length > 0} onClick={() => { ST.placing = b.id; ST.mode = "place"; ST.modal = null; paint(); }}>{miss.length ? "Missing " + miss.map(([r]) => COSTI[r]).join(" ") : "Place"}</button>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function InvModal() {
    const m = ST.me;
    const equipFromDrag = (slot) => {
      const idx = ST.drag;
      ST.drag = null;
      if (idx == null) return;
      const item = (m.pack || [])[idx];
      if (!item || item.t !== "gear") { say("Only gear can be equipped."); return; }
      const g = GEAR_BY_ID[item.id];
      if (g && g.slot !== slot) { sfx.err(); say(`${g.name} goes in the ${SLOT_LABEL[g.slot]} slot.`); return; }
      act("equip", { idx }).then((r) => r && r.ok && sfx.equip());
    };
    return (
      <div className="modal">
        <h2>🎒 Inventory <span className="tiny">— drag gear onto a slot, or tap to equip</span></h2>
        <h3>Equipment</h3>
        {SLOTS.map((s) => {
          const id = m.equip?.[s], g = id ? GEAR_BY_ID[id] : null;
          return (
            <div className="slot" id={"slot-" + s}
              onDragOver={(ev) => { ev.preventDefault(); ev.currentTarget.classList.add("drop-ok"); }}
              onDragLeave={(ev) => ev.currentTarget.classList.remove("drop-ok")}
              onDrop={(ev) => { ev.preventDefault(); ev.currentTarget.classList.remove("drop-ok"); equipFromDrag(s); }}>
              <span><b>{SLOT_LABEL[s]}</b> — {g ? `${g.glyph} ${g.name}` : <span className="tiny">empty · drop here</span>}
                {g ? <span className="tiny">{g.atk ? ` ⚔+${g.atk}` : ""}{g.def ? ` 🛡+${g.def}` : ""}{g.spd ? ` 👟+${g.spd}` : ""}</span> : null}</span>
              {g ? <button className="btn" onClick={() => act("unequip", { slot: s }).then((r) => r && r.ok && sfx.equip())}>Unequip</button> : null}
            </div>
          );
        })}
        <h3>Backpack — drag a piece onto its slot above</h3>
        <div className="packgrid">
          {(m.pack || []).map((item, i) => {
            if (!item) return <div className="packslot empty">·</div>;
            if (item.t === "relic") return (
              <div className="packslot" onClick={() => say(`${item.n} — a trophy of the frontier.`)}>
                <span className="pg">🏺</span><span>{item.n}</span>
                <span className="pd" onClick={(ev) => { ev.stopPropagation(); act("drop", { idx: i }); }}>✕</span>
              </div>);
            const g = GEAR_BY_ID[item.id];
            return (
              <div className="packslot draggable" draggable={true}
                onDragStart={(ev) => { ST.drag = i; if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", String(i)); } }}
                onDragEnd={() => { ST.drag = null; }}
                onClick={() => act("equip", { idx: i }).then((r) => r && r.ok && sfx.equip())}>
                <span className="pg">{g?.glyph}</span><span>{g?.name}</span>
                <span className="pd" onClick={(ev) => { ev.stopPropagation(); act("drop", { idx: i }); }}>✕</span>
              </div>);
          })}
        </div>
      </div>
    );
  }

  function CraftModal() {
    const m = ST.me;
    return (
      <div className="modal">
        <h2>⚒ Crafting</h2>
        <p className="tiny">Turn gathered resources into gear and goods. Basic recipes work anywhere; advanced ones need a Forge beside you and sometimes a skill. Each craft grants XP.</p>
        <div className="grid">
          {RECIPES.map((r) => {
            const miss = Object.entries(r.cost).filter(([res, amt]) => (res === "e" ? liveE() : (m.inv[res] || 0)) < amt);
            const needForge = r.needForge && !ST.near.m && !nearForge();
            const skillShort = r.reqSkill && skillLvl(m.skills, r.reqSkill.id) < r.reqSkill.lvl;
            const blocked = miss.length > 0 || needForge || skillShort;
            const out = r.out.t === "gear" ? GEAR_BY_ID[r.out.id] : null;
            return (
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="glyph">{r.glyph}</span>
                  <span className="cost">{costStr(r.cost)}</span>
                </div>
                <div className="card-title">{r.name}</div>
                <div className="tiny">{r.blurb}</div>
                {out ? <span className="usetag">{out.atk ? `⚔+${out.atk} ` : ""}{out.def ? `🛡+${out.def} ` : ""}{out.spd ? `👟+${out.spd}` : ""}</span> : null}
                {r.needForge ? <div className="recipe-req">⚒ Needs a Forge nearby</div> : null}
                {r.reqSkill ? <div className="recipe-req">★ {SKILLS.find((s) => s.id === r.reqSkill.id)?.name} {r.reqSkill.lvl}</div> : null}
                <button className="btn primary" disabled={blocked}
                  onClick={() => act("craft", { recipe: r.id }).then((res) => { if (res && res.ok) sfx.equip(); })}>
                  {miss.length ? "Missing " + miss.map(([res]) => COSTI[res]).join(" ") : needForge ? "Forge needed" : skillShort ? "Skill needed" : "Craft"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function SkillsModal() {
    const m = ST.me;
    return (
      <div className="modal" style={{ width: "min(620px,94vw)" }}>
        <h2>★ Skills <span className="tiny">— {m.skillPts || 0} point{m.skillPts === 1 ? "" : "s"} to spend</span></h2>
        <p className="tiny">Earn XP from chopping, mining, building, crafting, trading and combat. Each level grants a skill point.</p>
        <div className="grid">
          {SKILLS.map((s) => {
            const lvl = skillLvl(m.skills, s.id);
            const maxed = lvl >= s.max;
            return (
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="glyph">{s.glyph}</span>
                  <span className="lvl" style={{ color: "#ffd76e", fontWeight: 900 }}>{lvl}/{s.max}</span>
                </div>
                <div className="card-title">{s.name}</div>
                <div className="tiny">{s.blurb}</div>
                <button className="btn primary" disabled={maxed || (m.skillPts || 0) < 1}
                  onClick={() => act("learn", { skill: s.id })}>{maxed ? "Maxed" : "Level up (1★)"}</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function PlayerModal() {
    const q = ST.inspectPlayer;
    if (!q) { ST.modal = null; return <div />; }
    const atk = 2 + gearStat(q.equip || {}, "atk");
    const def = gearStat(q.equip || {}, "def");
    const adj = ST.me && cheb(q.x, q.z, world.me.x, world.me.z) <= 2;
    return (
      <div className="modal" style={{ width: "min(440px,94vw)" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 16, height: 16, borderRadius: 99, background: hex(q.body), display: "inline-block", border: "2px solid #fff" }} />
          {q.name}
        </h2>
        <div className="row" style={{ margin: "8px 0" }}>
          <span className="stat">♥ {Math.ceil(q.hp)}/{MAX_HP}</span>
          <span className="stat">⚔ {atk}</span>
          <span className="stat">🛡 {def}</span>
        </div>
        <h3>Worn gear</h3>
        {SLOTS.map((s) => { const id = q.equip?.[s]; const g = id ? GEAR_BY_ID[id] : null; return <div className="slot"><span><b>{SLOT_LABEL[s]}</b> — {g ? `${g.glyph} ${g.name}` : <span className="tiny">—</span>}</span></div>; })}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn danger" disabled={!adj} onClick={() => { ST.modal = null; paint(); act("fight", { target: q.id }).then((r) => r && r.ok && sfx.hit()); }}>{adj ? "⚔ Fight" : "Too far to fight"}</button>
          <button className="btn" onClick={() => { ST.modal = null; ST.inspectPlayer = null; paint(); world.pathTo(q.x, q.z); }}>Walk toward</button>
          <button className="btn" onClick={() => { ST.modal = null; ST.inspectPlayer = null; paint(); }}>Close</button>
        </div>
      </div>
    );
  }

  function TradeModal() {
    const m = ST.me;
    return (
      <div className="modal">
        <h2>᯼ Market & Bank</h2>
        <div className="tabs">
          <button className={"btn" + (ST.tradeTab === "market" ? " primary" : "")} onClick={() => { ST.tradeTab = "market"; paint(); }}>Merchant</button>
          <button className={"btn" + (ST.tradeTab === "players" ? " primary" : "")} onClick={() => { ST.tradeTab = "players"; paint(); }}>Player offers</button>
          <button className={"btn" + (ST.tradeTab === "bank" ? " primary" : "")} onClick={() => { ST.tradeTab = "bank"; paint(); }}>Bank · $CRAFTS</button>
        </div>
        {ST.tradeTab === "market" ? (
          <div className="grid">
            {NPC_TRADES.map((tr, i) => {
              const canDo = (m.inv[tr.give[0]] || 0) >= tr.give[1];
              return <div className="card"><div className="card-title">{tr.label}</div><button className="btn primary" disabled={!canDo} onClick={() => act("trade", { idx: i }).then((r) => r && r.ok && sfx.coin())}>Trade</button></div>;
            })}
          </div>
        ) : ST.tradeTab === "players" ? (
          <div>
            <h3>Post an offer (goods are escrowed)</h3>
            <div className="row">
              <span className="tiny">Give</span>
              <select id="sc-o-gres">{RES_KEYS.map((r) => <option value={r}>{RES_NAMES[r]}</option>)}</select>
              <input id="sc-o-gamt" type="number" min={1} max={99} defaultValue={5} style={{ width: 70 }} />
              <span className="tiny">for</span>
              <select id="sc-o-wres">{RES_KEYS.map((r) => <option value={r} selected={r === "s"}>{RES_NAMES[r]}</option>)}</select>
              <input id="sc-o-wamt" type="number" min={1} max={99} defaultValue={5} style={{ width: 70 }} />
              <button className="btn primary" onClick={() => {
                const v = (id) => (document.getElementById(id) || {}).value;
                act("postOffer", { gRes: v("sc-o-gres"), gAmt: Number(v("sc-o-gamt")), wRes: v("sc-o-wres"), wAmt: Number(v("sc-o-wamt")) });
              }}>Post</button>
            </div>
            <h3>Open offers</h3>
            {ST.offers.length === 0 ? <p className="tiny">No open offers — be the first.</p> : null}
            {ST.offers.map((o) => (
              <div className="slot">
                <span><b>{o.byName}</b> gives {o.gAmt}{COSTI[o.gRes]} for {o.wAmt}{COSTI[o.wRes]}</span>
                {o.byId === m.id
                  ? <button className="btn" onClick={() => act("cancelOffer", { id: o.id })}>Cancel</button>
                  : <button className="btn primary" disabled={(m.inv[o.wRes] || 0) < o.wAmt} onClick={() => act("acceptOffer", { id: o.id }).then((r) => r && r.ok && sfx.coin())}>Accept</button>}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <h3>Link your Solana wallet</h3>
            <p className="tiny">Gold you redeem is paid out as $CRAFTS directly to this address. The payout pool is funded by PumpFun creator fees, so rewards depend on the funded balance and are not guaranteed.</p>
            <div className="row">
              <input id="sc-wallet" placeholder="Your Solana address" defaultValue={m.wallet || ""} style={{ flex: 1, minWidth: 220 }} />
              <button className="btn" onClick={() => act("wallet", { addr: (document.getElementById("sc-wallet") || {}).value || "" }).then(() => pollSoon())}>Save</button>
            </div>
            <h3 style={{ marginTop: 14 }}>Redeem gold</h3>
            <p className="tiny">You hold {m.inv.g || 0}🪙. Minimum redemption is {REDEEM_MIN_GOLD}🪙.</p>
            <div className="row">
              <input id="sc-redeem" type="number" min={REDEEM_MIN_GOLD} step={10} defaultValue={Math.max(REDEEM_MIN_GOLD, Math.floor((m.inv.g || 0) / 10) * 10)} style={{ width: 120 }} />
              <button className="btn primary" disabled={!m.wallet || (m.inv.g || 0) < REDEEM_MIN_GOLD} onClick={() => act("redeem", { gold: Number((document.getElementById("sc-redeem") || {}).value) }).then((r) => r && r.ok && sfx.coin())}>Redeem → $CRAFTS</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function InspectModal() {
    const b = (world.buildPool.get(ST.inspect)) || null;
    if (!b || !ST.me || b.owner !== ST.me.id) { ST.modal = null; ST.inspect = null; return <div />; }
    const def = LIB_BY_ID[b.kind];
    const cdLeft = Math.max(0, Math.ceil(((b.cdUntil || 0) - Date.now()) / 1000));
    const level = b.level || 1, maxLvl = level >= MAX_LEVEL;
    const upCost = maxLvl ? {} : upgradeCost(def, level);
    const missingHp = (b.maxHp || 0) - (b.hp || 0);
    const repCost = repairCost(missingHp);
    const hpPct = b.maxHp ? Math.max(0, Math.min(1, b.hp / b.maxHp)) : 1;
    return (
      <div className="modal" style={{ width: "min(560px,94vw)" }}>
        <h2>{def?.glyph} {b.nm || def?.name} <span className="tiny" style={{ color: "#ffd76e" }}>· Lv {level}</span></h2>
        <p className="tiny">{def?.blurb}</p>
        <div className="row" style={{ margin: "8px 0", gap: 8 }}>
          <span className="tiny">HP {Math.ceil(b.hp)}/{b.maxHp}</span>
          <span className="hpbar"><i style={{ width: `${(hpPct * 100).toFixed(0)}%` }} /></span>
        </div>
        <div className="field"><label>Name your building</label><div className="row">
          <input id="sc-rename" maxLength={16} placeholder={def?.name} defaultValue={b.nm || ""} style={{ flex: 1 }} />
          <button className="btn" onClick={() => act("customize", { uid: ST.inspect, nm: (document.getElementById("sc-rename") || {}).value || "" })}>Rename</button>
        </div></div>
        <div className="field"><label>Color & design</label><div className="row">
          {COLOR_CHOICES.map((c) => <button className={"swatch" + ((b.cl || null) === c ? " on" : "")} style={{ background: c || hex(def?.baseC ?? 0x999999), opacity: c ? 1 : 0.6 }} title={c || "default"} onClick={() => act("customize", { uid: ST.inspect, cl: c })} />)}
        </div></div>
        <div className="row tiny" style={{ margin: "8px 0" }}>
          <span className="stat">+{(def?.regen * lvlMul(level)).toFixed(2)}/s</span>
          {def?.maxE ? <span className="stat">+{def.maxE} cap</span> : null}
          {def?.prod ? <span className="stat">bin {Math.floor(estAcc(b))}/60</span> : null}
          {cdLeft ? <span className="stat">⏳ {cdLeft}s</span> : null}
        </div>
        <div className="row">
          {(def?.use || def?.prod) ? <button className="btn primary" onClick={() => act("use", { uid: ST.inspect }).then((r) => { if (r && r.openTrade) { ST.modal = "trade"; paint(); } })}>E Use</button> : null}
          <button className="btn" disabled={maxLvl} onClick={() => act("upgrade", { uid: ST.inspect })}>{maxLvl ? "Max level" : `⬆ Upgrade (${costStr(upCost)})`}</button>
          <button className="btn" disabled={missingHp <= 0} onClick={() => act("repair", { uid: ST.inspect })}>{missingHp <= 0 ? "Full HP" : `🔧 Repair (${costStr(repCost)})`}</button>
          <button className="btn danger" onClick={() => act("demolish", { uid: ST.inspect }).then((r) => { if (r && r.ok) { sfx.demolish(); ST.modal = null; ST.inspect = null; paint(); } })}>Demolish (½ refund)</button>
          <button className="btn" onClick={() => { ST.modal = null; ST.inspect = null; paint(); }}>Close</button>
        </div>
      </div>
    );
  }

  function HelpModal() {
    return (
      <div className="modal" style={{ width: "min(820px,94vw)" }}>
        <h2>How SolCraft works</h2>
        <p className="tiny">{ECONOMY.intro}</p>
        <p><span className="kbd">click</span> walk · <span className="kbd">right-click</span> actions menu · <span className="kbd">WASD</span> step · <span className="kbd">C</span> claim/capture · <span className="kbd">B</span> build · <span className="kbd">E</span> interact · <span className="kbd">I</span> items · <span className="kbd">R</span> craft · <span className="kbd">K</span> skills · <span className="kbd">T</span> trade · <span className="kbd">F</span> fight · <span className="kbd">G</span> raid · <span className="kbd">X</span> demolish · <span className="kbd">Q</span> camera · <span className="kbd">Esc</span> cancel</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <div className="card"><div className="card-title">Gather & progress</div><div className="tiny">Right-click a tree or rock (or press E beside it) to start chopping — a progress bar fills, and the resource drops when it completes. Walking away cancels it, but the energy is already spent. Every harvest grants XP toward your next level.</div></div>
          <div className="card"><div className="card-title">Skills & XP</div><div className="tiny">Chopping, building, crafting, trading and combat all give XP. Each level grants a skill point — spend it (K) on Gathering, Efficiency, Vigor, Masonry or Warfare for permanent bonuses.</div></div>
          <div className="card"><div className="card-title">Crafting & gear</div><div className="tiny">Open Craft (R) to turn resources into gear and planks; advanced recipes need a Forge beside you. Drag gear from your backpack onto the matching equipment slot (I), or tap to equip.</div></div>
          <div className="card"><div className="card-title">Territory</div><div className="tiny">{ECONOMY.land}</div></div>
          <div className="card"><div className="card-title">Energy</div><div className="tiny">{ECONOMY.energy}</div></div>
          <div className="card"><div className="card-title">$CRAFTS refills energy</div><div className="tiny">{ECONOMY.crafts}</div></div>
          <div className="card"><div className="card-title">Resources & Gold</div><div className="tiny">{ECONOMY.resources} {ECONOMY.gold}</div></div>
          <div className="card"><div className="card-title">Buildings, upgrades, repair</div><div className="tiny">Each building takes one cell on a full 3x3 owned pad. Source buildings spawn wood/stone/food over time; converters turn wood into planks; markets sell for gold; watchtowers protect; others decorate. Upgrade for more output and HP, customize the color, and repair after raids.</div></div>
          <div className="card"><div className="card-title">Combat & capture</div><div className="tiny">Fight nearby players (F). Raid enemy buildings (G) to chip their HP — defenders can repair mid-siege. Once a building is razed, stand on that connected border tile and press C to capture the land.</div></div>
          <div className="card"><div className="card-title">Cash out</div><div className="tiny">{ECONOMY.redeem}</div></div>
        </div>
      </div>
    );
  }

  function ModalLayer() {
    if (ST.screen !== "playing" || !ST.modal) return <div />;
    return (
      <div className="modal-wrap" onClick={(ev) => { if (ev.target === ev.currentTarget) { ST.modal = null; ST.inspect = null; ST.inspectPlayer = null; paint(); } }}>
        {ST.modal === "build" ? <BuildModal /> :
          ST.modal === "inv" ? <InvModal /> :
          ST.modal === "craft" ? <CraftModal /> :
          ST.modal === "skills" ? <SkillsModal /> :
          ST.modal === "player" ? <PlayerModal /> :
          ST.modal === "trade" ? <TradeModal /> :
          ST.modal === "inspect" ? <InspectModal /> :
          <HelpModal />}
      </div>
    );
  }

  /* ============================================================
     PAINT — per-region, signature-gated rendering.
     A region only re-renders when its OWN signature changes, so
     pressing a button in one region never tears down the DOM the
     pointer is interacting with — clicks always complete.
     tradjs render() is called against the region root only.
     ============================================================ */
  const regions = [
    { root: hudRoot, view: Hud, sig: "" },
    { root: actionsRoot, view: TopActions, sig: "" },
    { root: bottomRoot, view: BottomBar, sig: "" },
    { root: modalRoot, view: ModalLayer, sig: "" },
    { root: menuRoot, view: Menu, sig: "" },
  ];
  function hudSig() {
    const m = ST.me;
    if (ST.screen !== "playing" || !m) return "x";
    /* energy/hp deliberately EXCLUDED — the ticker mutates them in place */
    return [m.territory, m.built, m.maxE, m.msIndex, JSON.stringify(m.inv), JSON.stringify(m.equip),
      (m.pack || []).filter(Boolean).length, ST.mode, ST.placing, ST.near.i && ST.near.i.label].join("|");
  }
  function actionsSig() { return ST.screen !== "playing" ? "x" : [ST.near.m ? 1 : 0, ST.muted ? 1 : 0].join("|"); }
  function bottomSig() {
    if (ST.screen !== "playing") return "x";
    return [ST.near.i && ST.near.i.label, ST.near.g && ST.near.g.id, ST.near.r && ST.near.r.uid, ST.mode].join("|");
  }
  function modalSig() {
    if (ST.screen !== "playing" || !ST.modal) return "none";
    const m = ST.me;
    const b = ST.modal === "inspect" ? world.buildPool.get(ST.inspect) : null;
    return [ST.modal, ST.tradeTab, ST.inspect, ST.inspectPlayer && ST.inspectPlayer.id,
      JSON.stringify(m && m.inv), m && m.maxE, m && m.wallet, m && m.skillPts, JSON.stringify(m && m.skills),
      JSON.stringify(m && m.equip), JSON.stringify(m && m.pack), m && m.territory,
      ST.near.m ? 1 : 0, ST.offers.length, b && [b.level, Math.ceil(b.hp), b.maxHp, b.nm, b.cl].join(":")].join("|");
  }
  function menuSig() { return ST.screen !== "menu" ? "x" : [ST.auth ? 1 : 0, ST.joining ? 1 : 0, ST.profile.body, ST.profile.hat].join("|"); }
  const sigFns = [hudSig, actionsSig, bottomSig, modalSig, menuSig];

  function paint(force = false) {
    /* chat panel visibility is imperative */
    chatEl.style.display = ST.screen === "playing" ? "flex" : "none";
    minimapEl.style.display = ST.screen === "playing" ? "block" : "none";
    if (ST.screen !== "playing" || ST.modal) hideCtx();
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      const s = sigFns[i]();
      if (!force && s === r.sig) continue;
      r.sig = s;
      render(r.view(), r.root);
    }
  }

  /* ---------- imperative energy/bin ticker: NO vdom ---------- */
  const tick = setInterval(() => {
    if (ST.screen !== "playing" || !ST.me) return;
    const m = ST.me, e = liveE();
    const nowEl = document.getElementById("sc-e-now");
    if (nowEl) nowEl.textContent = String(Math.floor(e));
    const fill = document.getElementById("sc-e-fill");
    if (fill) fill.style.width = `${(100 * e / m.maxE).toFixed(1)}%`;
  }, 250);

  /* ============================================================
     BOOT
     ============================================================ */
  pollT = setInterval(poll, 2000);
  paint(true);
  if (ST.auth) startPlaying();

  return () => {
    clearInterval(pollT);
    clearInterval(nearT);
    clearInterval(tick);
    clearInterval(channelT);
    clearTimeout(toastT);
    clearTimeout(pollSoonT);
    worldEl.removeEventListener("pointermove", onPointerMove);
    worldEl.removeEventListener("pointerdown", onPointerDown);
    worldEl.removeEventListener("wheel", onWheel);
    worldEl.removeEventListener("contextmenu", onContext);
    window.removeEventListener("keydown", onKey);
    world.dispose();
    for (const r of regions) render(null, r.root);
    root.replaceChildren();
  };
}