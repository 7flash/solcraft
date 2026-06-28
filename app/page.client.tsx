// @ts-nocheck
/** @jsxImportSource tradjs/client */
/* ============================================================
   SOLCRAFT client — tradjs mount script.
   One shared map for everyone. The server ECS backend is
   authoritative; this file renders, predicts, and asks.

   RENDERING MODEL:
   The HUD is split into independent REGIONS, each with its own DOM root.
   Structural UI is reconciled by tradjs at the region level; high-frequency
   scalar values use direct bindings / micro-store helpers. Do not add JSON
   signature gates for settled state.
   ============================================================ */
import { render } from "tradjs/client";
import {
  BOMB_ITEM_COST, BODY_COLORS, COLOR_CHOICES, COSTI, DESTROY_BY_ID, DESTROY_TOOLS, ECONOMY, FINAL_TEXT, GEAR_BY_ID, HAT_COLORS, GOLD_MINE_KIND, GOLD_PER_CRAFTS_FIXED, WORLD_WONDER_COST, WORLD_WONDER_GLOBAL_COIN_BONUS_PCT, WORLD_WONDER_PLAZA_RADIUS, WORLD_WONDER_PLAZA_SIZE as SHARED_WONDER_PLAZA_SIZE, WORLD_WONDER_PLAZA_TILES as SHARED_WONDER_PLAZA_TILES, WORLD_WONDER_BUILD_MS, NORMAL_BUILDING_BUILD_MS, DECOR_BUILDING_BUILD_MS,
  LIBRARY, LIB_BY_ID, MAX_HP, MAX_LEVEL, MILESTONES, MOVE_COST, N4, N8, NPC_TRADES, PACK_SIZE,
  RECIPES, REDEEM_MIN_GOLD, RES_KEYS, RES_NAMES, SKILLS, SLOTS, SLOT_LABEL, USE_ITEMS,
  biomeAt, biomeTerrainAt, cheb, gearStat, harvestMs, hrand, key, lvlMul, naturalDoodad, proceduralNpcAt, repairCost,
  skillLvl, tradePostAt, upgradeCost, xpForLevel,
} from "@server/shared";
import { makeSfx } from "../client/game/sfx";
import { loadAtlasRuntimeConfig } from "../client/world/canvasAtlasRuntime";
import { capitalBuildingsInView } from "../client/world/capitalLayout";
import { capitalServiceForBuilding, capitalServiceAvailable } from "../client/world/capitalServices";
import { capitalBlocksNaturalResource, capitalBlocksPlayerTerritory } from "@server/capitalRules";
import { FOUNDATION_KIND, FOUNDATION_BUILD_KINDS, foundationChoiceLabel } from "@server/foundationRules";
import { loadCharacterProfile, saveCharacterProfile, type CharacterProfile } from "../client/dollProfile";
import { isMoveKey, movementVectorFromKeys, normalizeMoveKey } from "../client/game/directionalInput";
import { DEFAULT_KEYBOARD_STEP_MS } from "../client/game/keyboardStepper";
import { createMovementAccumulator } from "../client/game/movementAccumulator";
import { shouldEnterPerfMode } from "../client/game/renderBudget";
import { hopDurationForProjectedDistance, movementFeelBucket } from "../client/game/movementFeel";
import { createPerfOverlay, perfOverlayEnabledFromUrl } from "../client/game/perfOverlay";
import { CORE_ACTIONS } from "../client/ui/coreActions";
import { actionBarActive } from "../client/ui/actionBarState";
import { MORE_MENU_GROUPS } from "../client/ui/moreMenu";
import { ribbonModeForState } from "../client/ui/ribbonMode";
import { ActionRibbon } from "../client/ui/actionRibbons";
import { InspectPanelView } from "../client/ui/inspectPanel";
import { ObjectPreviewPanelView } from "../client/ui/objectPreviewPanel";
import { CharacterPanelView } from "../client/ui/characterPanel";
import { InventoryPanelView } from "../client/ui/inventoryPanel";
import { SkillsPanelView } from "../client/ui/skillsPanel";
import { QuestPanelView } from "../client/ui/questPanel";
import { UtilityShell } from "../client/ui/utilityShell";
import { MorePanelView } from "../client/ui/morePanel";
import { SettingsPanelView } from "../client/ui/settingsPanel";
import { OptionsModalView } from "../client/ui/optionsModal";
import { HelpModalView } from "../client/ui/helpModal";
import { actionSlotClass, actionStackClass } from "../client/ui/hudChromeModel";
import { toolCursorForState } from "../client/ui/toolCursor";
import { PlayerHudView } from "../client/ui/playerHud";
import { TopChromeView } from "../client/ui/topChrome";
import { disposeMiniPreviews, syncMiniPreviewPanels } from "../client/world/miniPreview";
import { WorldMapModalView } from "../client/ui/worldMapModal";
import { PlayerModalView } from "../client/ui/playerModal";
import { renderKnownWorldMap, tileFromCanvasEvent } from "../client/world/mapCanvas";
import { createCanvasPrismWorld } from "../client/world/canvasPrismWorld";
import { assertCanvasWorldApi } from "../client/world/canvasWorldApi";
import { guardCanvasWorld } from "../client/world/canvasWorldRuntimeGuards";
import { formatBuildingChatCard, formatKeepRallyChatCard, formatLocationChatCard } from "../client/ui/chatCards";
import { NotificationRailView } from "../client/ui/notificationRail";
import { GameChatView } from "../client/ui/gameChat";
import { CapitalServicePanelView } from "../client/ui/capitalServicePanel";
import { MicroStore } from "../client/ui/microStore";
import { t, tArray } from "../client/i18n";
import { createHudRoots } from "../client/ui/hudRoots";
import { npcTalkLine } from "../client/ui/npcDialogue";
import { api } from "../client/game/httpClient";
import { createFrameScheduler } from "../client/game/frameScheduler";
import { connectAndSignPhantom, loadLoginGateConfig, loginGateText, phantomProvider, shortWallet } from "../client/game/walletAuthClient";
import {
  CAMERA_ROTATION_STEP, CAMERA_ZOOM_MAX, CAMERA_ZOOM_MIN, CAMERA_ZOOM_STEP,
  UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_STEP,
  cameraYawDeg, cameraZoomPct, clampCameraZoom, clampUiScale,
  loadUiSettings, loadVisualSettings, normalizeCameraYaw,
  readAckedClientVersion, saveUiSettings, saveVisualSettings,
  uiScalePct, visualPerfFor, writeAckedClientVersion,
} from "../client/game/clientSettings";
import { UiIcon } from "../client/ui/proceduralIcon";
import {
  BUILDING_COLOR_PRESETS, CHARACTER_COLOR_KEYS, CHARACTER_COLOR_PRESETS,
  buildingPresetById, characterPresetActive, characterPresetById, presetHexToNumber,
} from "../client/ui/appearancePresets";
import {
  buildingBestNearLine, buildingProductionLine, buildingPurposeLine, buildingRequirementLine, captureLimitLine, costLine as polishCostLine, firstStepsGuideRows, missingCostLineDetailed,
} from "../client/ui/productionPolish";

const AUTH_KEY = "solcraft:auth";
const FACE_KEY = "solcraft:face.v1";
const RENDER_R = 34;
const TILE_LOAD_R = RENDER_R + 10;
const TILE_LOAD_R_MAX = 52;
const TILE_WINDOW_HYSTERESIS = 9;
const PATH_R = 112;
const MOVE_BATCH_MAX = 18;
const MOVE_FLUSH_MS = 65;
const MOVE_MAX_IN_FLIGHT = 4;
const MOVE_SOFT_CORRECT_TILES = 2;
const REMOTE_FULL_RIG_RADIUS = 16;
const REMOTE_FULL_RIG_BUDGET = 24;
const CLIENT_BOOT_AT = Date.now();
const WALKTHROUGH_KEY = "solcraft:firstGuide:v2";
const GUIDE_TABS = tArray("guide.tabs", [
  ["actions", "Actions"],
  ["buildings", "Buildings"],
  ["economy", "Economy"],
  ["skills", "Skills"],
  ["done", "Done"],
]);

const WONDER_PLAZA_SIZE = SHARED_WONDER_PLAZA_SIZE || 9;
const WONDER_PLAZA_RADIUS = WORLD_WONDER_PLAZA_RADIUS || 4;
const WONDER_PLAZA_TILES = SHARED_WONDER_PLAZA_TILES || 81;
const WONDER_AI_TIME_HINT = t("wonder.aiTimeHint", "usually 5–25s");
const WONDER_BUILD_TIME_HINT = t("wonder.buildTimeHint", "{seconds}s construction", { seconds: Math.max(1, Math.round((WORLD_WONDER_BUILD_MS || 45000) / 1000)) });
const WONDER_FOOTPRINT_CHOICES = [3, 5, 7, 9];
const WONDER_MODE_CHOICES = tArray("wonder.modeChoices", [
  { id: "district", name: "District / many tiles", text: "Multiple towers, halls, gardens, pylons, and accents spread across the plaza." },
  { id: "single", name: "Big single landmark", text: "One dominant monument centered on the plaza with support props." },
]);
const WONDER_PALETTES = tArray("wonder.palettes", [
  { id: "solar", name: "Solar gold", colors: ["#fff0a8", "#ffd76e", "#c79337", "#14f195"] },
  { id: "arcane", name: "Arcane violet", colors: ["#f3ead7", "#9945ff", "#5a2d91", "#7dcfe8"] },
  { id: "emerald", name: "Emerald mint", colors: ["#dfffee", "#14f195", "#0d7054", "#7dcfe8"] },
  { id: "ember", name: "Ember red", colors: ["#ffe3c2", "#ffb45e", "#d6604f", "#8e3d26"] },
  { id: "frost", name: "Frost blue", colors: ["#ecfbff", "#b8e9ff", "#7dcfe8", "#31507d"] },
  { id: "royal", name: "Royal prism", colors: ["#fff0a8", "#9945ff", "#4d287f", "#ffd76e"] },
]);
const WONDER_NAME_PRESETS = tArray("wonder.namePresets", [
  "Crystal Skyscraper",
  "Solar Citadel",
  "Arcane Observatory",
  "Emerald Garden District",
  "Royal Sky Bridge",
  "Frost Beacon",
  "Ember Forge Cathedral",
  "Moonlit Archive",
]);
function normalizeWonderFootprintClient(v) { const n = Math.trunc(Number(v || 9)); return WONDER_FOOTPRINT_CHOICES.includes(n) ? n : 9; }
function wonderRadiusClient(v) { return Math.max(1, Math.floor((normalizeWonderFootprintClient(v) - 1) / 2)); }
function wonderTilesClient(v) { const s = normalizeWonderFootprintClient(v); return s * s; }
function wonderBuildMsClient(size, mode) { size = normalizeWonderFootprintClient(size); const base = size === 3 ? 24000 : size === 5 ? 32000 : size === 7 ? 40000 : 48000; return mode === "single" ? Math.max(22000, base - 4000) : base; }





function shouldSuppressNotice(value: any) {
  const msg = String(value || "");
  return /(?:tool selected|selected —|packed away|cursor:|Capture selected|Sword selected|highlighted|Move mode|tutorial restarted|tutorial reset|Guide and rewards are moving)/i.test(msg);
}

function focusChatInputSoon() {
  setTimeout(() => {
    try { (document.querySelector('[data-chat-input="1"]') as HTMLInputElement | null)?.focus?.(); } catch {}
  }, 0);
}

function referralCodeFromIntro() {
  try {
    const input = document.querySelector('[data-referral-code-input="1"]') as HTMLInputElement | null;
    const value = String(input?.value || localStorage.getItem('solcraft.referralCode') || '').trim();
    if (value) localStorage.setItem('solcraft.referralCode', value);
    return value;
  } catch { return ''; }
}

function referralCodeFromEntry() {
  try {
    const input = document.querySelector('[data-entry-invite-code="1"]') as HTMLInputElement | null;
    const value = String(input?.value || localStorage.getItem('solcraft.referralCode') || '').trim().toUpperCase();
    if (value) localStorage.setItem('solcraft.referralCode', value);
    return value;
  } catch { return ''; }
}
function characterNameFromEntry() {
  try {
    const input = document.querySelector('[data-entry-character-name="1"]') as HTMLInputElement | null;
    const value = String(input?.value || localStorage.getItem('solcraft.characterName') || '').trim().slice(0, 18);
    if (value) localStorage.setItem('solcraft.characterName', value);
    return value;
  } catch { return ''; }
}
function referralCodeForCreate() {
  return referralCodeFromIntro() || referralCodeFromEntry();
}

function readStr(el: any, key: string, fallback = "") {
  try {
    const v = el?.dataset ? el.dataset[key] : null;
    return v == null || v === "" ? fallback : String(v);
  } catch { return fallback; }
}
function readNum(el: any, key: string, fallback = 0) {
  const n = Number(readStr(el, key, ""));
  return Number.isFinite(n) ? n : fallback;
}

function hslToNumber(h: number, s: number, l: number) {
  h = ((Number(h) || 0) % 1 + 1) % 1;
  s = Math.max(0, Math.min(1, Number(s) || 0));
  l = Math.max(0, Math.min(1, Number(l) || 0));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return (r << 16) | (g << 8) | b;
}

function spawnHarvestPulse(world: any, ch: any, progress: number) {
  try {
    if (!ch || !(ch.kind === "tree" || ch.kind === "rock" || ch.kind === "food")) return;
    const now = performance.now();
    if (Number(ch.nextFx || 0) > now) return;
    ch.nextFx = now + 240;
    const color = ch.kind === "tree" ? 0x2f952f : ch.kind === "food" ? 0xceb443 : 0x82979e;
    world?.burst?.(ch.x, 0.34 + progress * 0.22, ch.z, color, 3, 0.14 + progress * 0.14);
  } catch {}
}


function loadTimeControls() {
  try {
    const raw = JSON.parse(localStorage.getItem("solcraft:time.v1") || "{}");
    return {
      auto: raw.auto === false ? false : true,
      hour: Number.isFinite(Number(raw.hour)) ? Math.max(0, Math.min(23, Math.floor(Number(raw.hour)))) : 12,
    };
  } catch { return { auto: true, hour: 12 }; }
}
function saveTimeControls(next: any) {
  const out = { auto: next?.auto === true, hour: Math.max(0, Math.min(23, Math.floor(Number(next?.hour ?? 12)))) };
  try { localStorage.setItem("solcraft:time.v1", JSON.stringify(out)); } catch {}
  return out;
}
function currentWorldHour(ST: any, t = Date.now()) {
  const controls = ST?.timeControls || loadTimeControls();
  if (controls.auto === false) return Math.max(0, Math.min(23, Math.floor(Number(controls.hour ?? 12))));
  const dayMs = 20 * 60 * 1000;
  return Math.floor((((t % dayMs) + dayMs) % dayMs) / dayMs * 24);
}

function renderWorldStatusChips(ST: any) {
  try {
    if (!ST || ST.screen !== "playing" || !ST.me) return null;
    const t = Number(ST.now || Date.now());
    const hour = currentWorldHour(ST, t);
    const label = hour < 5 ? "Night" : hour < 8 ? "Dawn" : hour < 18 ? "Day" : hour < 21 ? "Dusk" : "Night";
    const hx = Number.isFinite(Number(ST.hoverCellX)) ? Math.trunc(Number(ST.hoverCellX)) : Math.trunc(Number(ST.me.x || 0));
    const hz = Number.isFinite(Number(ST.hoverCellZ)) ? Math.trunc(Number(ST.hoverCellZ)) : Math.trunc(Number(ST.me.z || 0));
    return <><div className="sc-time-chip">{label} · {String(hour).padStart(2, "0")}:00</div><div className="sc-coord-chip">You {Math.trunc(Number(ST.me.x || 0))}, {Math.trunc(Number(ST.me.z || 0))}</div><div className="sc-hover-cell-chip">Cell {hx}, {hz}</div></>;
  } catch { return null; }
}

export default function mount() {
  const root = document.getElementById("solcraft-root");
  if (!root) return;
  const {
    worldEl, hudEl, hudRoot, actionsRoot, utilityRoot, minimapEl, chatEl,
    bottomRoot, toastEl, noticeRoot, channelEl, ctxEl, tipEl, vignetteEl,
    guideRoot, modalRoot, menuRoot,
  } = createHudRoots(root, {
    onOpenMap: () => { if (ST.screen === "playing") { ST.modal = "worldmap"; paint(true); } },
  });

  const perfOverlayEnabled = perfOverlayEnabledFromUrl(window.location.search, window.localStorage);
  const perf = createPerfOverlay(root, {
    enabled: perfOverlayEnabled,
    label: "SolCraft client",
    consoleBudgetMs: 24,
  });

  const scheduler = createFrameScheduler();
  const liveHudStore = new MicroStore({
    energyNow: 0, energyPct: 0, hpNow: 0, hpPct: 0,
  });
  let liveHudUnsubs: Array<() => void> = [];
  let liveHudBindingKey = "";
  function bindLiveHudBindings() {
    const ids = ["sc-e-now", "sc-e-fill", "sc-hp-now", "sc-hp-fill"];
    const els = ids.map((id) => document.getElementById(id));
    const key = els.map((el) => el ? `${el.id}:${el.isConnected ? 1 : 0}` : "-").join("|");
    if (key === liveHudBindingKey) return;
    liveHudUnsubs.forEach((fn) => { try { fn(); } catch {} });
    liveHudUnsubs = []; liveHudBindingKey = key;
    liveHudUnsubs.push(liveHudStore.bindText("energyNow", els[0], (v) => String(Math.floor(Math.max(0, Number(v || 0))))));
    liveHudUnsubs.push(liveHudStore.bindStyle("energyPct", els[1], "width", (v) => `${Math.max(0, Math.min(100, Number(v || 0))).toFixed(1)}%`));
    liveHudUnsubs.push(liveHudStore.bindText("hpNow", els[2], (v) => String(Math.ceil(Math.max(0, Number(v || 0))))));
    liveHudUnsubs.push(liveHudStore.bindStyle("hpPct", els[3], "width", (v) => `${Math.max(0, Math.min(100, Number(v || 0))).toFixed(1)}%`));
  }

  const perfMini = (() => {
    const el = document.createElement("div");
    el.className = `sc-perf-mini${perfOverlayEnabled ? " is-debug-visible" : ""}`;
    el.hidden = !perfOverlayEnabled;
    el.setAttribute("aria-label", "Performance diagnostics");
    el.textContent = "perf starting…";
    root.appendChild(el);
    const data = { ping: 0, paint: 0, frame: 0, cells: 0, draws: 0, terrain: 0, entities: 0, weather: 0, quality: "", staticMs: 0, dynamicMs: 0, prisms: 0, particles: 0, sprites: 0, slices: 0, patches: 0, fillers: 0, organic: 0, snapped: 0, selftest: 0, cache: "", skipped: 0, last: 0 };
    function update(partial: any = {}) {
      if (!perfOverlayEnabled) return;
      Object.assign(data, partial || {});
      const now = performance.now();
      if (now - data.last < 180) return;
      data.last = now;
      const ping = data.ping ? `${Math.round(data.ping)}ms` : "—";
      const q = data.quality ? ` · q ${data.quality}` : "";
      const cache = data.cache ? ` · cache ${data.cache}` : "";
      el.textContent = `ping ${ping} · frame ${Math.round(data.frame || 0)}ms · ui ${Math.round(data.paint || 0)}ms · static ${Math.round(data.staticMs || 0)}ms · dyn ${Math.round(data.dynamicMs || 0)}ms · prism ${Math.round(data.prisms || 0)} · sprite ${Math.round(data.sprites || 0)} · slice ${Math.round(data.slices || 0)} · patch ${Math.round(data.patches || 0)} · fill ${Math.round(data.fillers || 0)} · org ${Math.round(data.organic || 0)} · snap ${Math.round(data.snapped || 0)} · self ${Math.round(data.selftest || 0)} · part ${Math.round(data.particles || 0)} · cells ${Math.round(data.cells || 0)}${q}${cache}`;
    }
    return { update };
  })();

  const sfx = makeSfx();

  const ST = {
    screen: "menu", auth: null, walletVerified: false, loginMsg: "", loginGate: null,
    profile: { name: "", body: BODY_COLORS[0], hat: HAT_COLORS[0], wallet: "" },
    characterProfile: loadCharacterProfile(),
    me: null, rev: 0, ax: 1e6, az: 1e6, chatId: 0, mapRev: -1,
    players: [], offers: [], leaderboard: [], map: { rev: -1, tiles: [], buildings: [], loot: [], players: [] },
    visual: loadVisualSettings(), ui: loadUiSettings(), timeControls: loadTimeControls(),
    mode: "explore", placing: null, tool: "none", destroying: DESTROY_TOOLS[0]?.id || "popper",
    near: { i: null, g: null, r: null, m: false },
    modal: null, panel: null, tradeTab: "market", inspect: null, objectPreview: null, capitalService: null, serviceAccess: "", hoverIntent: "walk",
    muted: false, uiMuted: false, musicMuted: false, joining: false, updateRequired: false, updateReason: "", updateVersion: "", chatOpen: false, needsProfile: false,
    channel: null, // {x,z,until,ms,kind} active chop/mine/teleport
    drag: null,    // backpack idx being dragged
    inspectPlayer: null,
    inspectDraft: null,
    wonderViewUid: null, wonderViewError: "",
    useAfterWalkUid: null,
    faceImage: null,
    spectator: false,
    questTab: "actions",
    bank: null, bankBusy: false, bankMsg: "",
    walkthrough: null, // { active, step: "char" | "quests" }
    inviteGift: null, inviteError: "", landmarkBonusPct: 0,
    wonderPrompt: "", wonderName: "", wonderFootprint: 9, wonderMode: "district", wonderPaletteId: "solar", wonderRecipe: null, wonderBusy: false, wonderPlacing: false, wonderMsg: "", wonderLastPlaceAt: 0, wonderLastPlaceKey: "",
    adminTool: "demolish", adminMsg: "", hoverCellX: 0, hoverCellZ: 0,
  };

  function currentTileLoadRadius() {
    // Canvas world still needs the old streaming/window radius contract.
    // The Three.js rewrite accidentally removed this helper while the new
    // renderer still receives it as an option, causing mount to fail before
    // the page could render. Keep the radius deterministic and bounded.
    let quality = "";
    try {
      const perf = visualPerfFor?.(ST.visual);
      quality = String(perf?.quality || ST.visual?.perf || ST.visual?.quality || "").toLowerCase();
    } catch { quality = ""; }
    const low = quality === "fast" || quality === "low" || quality === "lite" || quality === "battery";
    const crisp = quality === "crisp";
    const zoom = clampCameraZoom(Number(ST.visual?.cameraZoom || 1), 1);
    const zoomBoost = zoom < 0.9 ? 5 : zoom > 1.22 ? -5 : 0;
    const base = low ? Math.max(26, RENDER_R - 6) : crisp ? TILE_LOAD_R + 2 : TILE_LOAD_R;
    return Math.max(22, Math.min(TILE_LOAD_R_MAX, Math.round(base + zoomBoost)));
  }

  const capitalCompass = (() => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sc-capital-compass";
    el.setAttribute("aria-label", "Direction to capital");
    el.innerHTML = `<span class="sc-capital-compass-arrow">▲</span><span class="sc-capital-compass-copy"><b>Capital</b><em class="sc-capital-compass-direction">toward center</em><i class="sc-capital-compass-distance">0 tiles</i></span>`;
    el.addEventListener("click", () => {
      if (ST.screen !== "playing") return;
      ST.modal = "worldmap";
      paint(true);
    });
    root.appendChild(el);
    function update() {
      const playing = ST.screen === "playing" && !ST.modal && !!ST.me;
      const x = Math.trunc(Number(ST.me?.x || 0));
      const z = Math.trunc(Number(ST.me?.z || 0));
      const dist = Math.max(Math.abs(x), Math.abs(z));
      const show = playing && dist > 18;
      el.classList.toggle("on", !!show);
      if (!show) return;
      const dx = -x;
      const dz = -z;
      const angle = Math.atan2(dx, -dz) * 180 / Math.PI;
      const absX = Math.abs(dx), absZ = Math.abs(dz);
      const primary = absX > absZ * 1.35 ? (dx > 0 ? "east" : "west") : absZ > absX * 1.35 ? (dz > 0 ? "south" : "north") : `${dz > 0 ? "south" : "north"}-${dx > 0 ? "east" : "west"}`;
      el.style.setProperty("--capital-bearing", `${angle}deg`);
      const dir = el.querySelector(".sc-capital-compass-direction");
      if (dir) dir.textContent = primary;
      const d = el.querySelector(".sc-capital-compass-distance");
      if (d) d.textContent = `${Math.round(dist)} tiles`;
      el.setAttribute("aria-label", `Capital is ${Math.round(dist)} tiles ${primary}`);
    }
    return { update };
  })();

  function currentWonderSize() { return normalizeWonderFootprintClient(ST.wonderFootprint || ST.wonderRecipe?.footprint || 9); }
  function currentWonderMode() { return ["single", "district"].includes(String(ST.wonderMode || ST.wonderRecipe?.mode)) ? String(ST.wonderMode || ST.wonderRecipe?.mode) : "district"; }
  function currentWonderPalette() { return WONDER_PALETTES.find((p) => p.id === (ST.wonderPaletteId || ST.wonderRecipe?.paletteId)) || WONDER_PALETTES[0]; }
  function currentWonderNameFallback() { return cleanWonderPromptClient(ST.wonderName || ST.wonderPrompt || "Landmark").replace(/[^\w\s'’-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 42) || "Landmark"; }
  function wonderRecipeForWire(b: any) {
    if (!b || b.kind !== "worldwonder") return null;
    const existing = b.wonder || null;
    if (existing && (Array.isArray(existing.parts) && existing.parts.length || existing.name || existing.prompt)) return existing;
    const size = normalizeWonderFootprintClient(existing?.footprint || b.footprint || WONDER_PLAZA_SIZE);
    const accent = String(b.cl || "#ffd76e");
    return {
      name: b.nm || "Landmark",
      prompt: `${b.nm || "Landmark"} tower landmark`,
      footprint: size,
      mode: "single",
      paletteId: "solar",
      palette: [accent, "#ffd76e", "#14f195", "#7dcfe8"],
      aura: "gold",
      parts: [{ primitive: "box", pos: [0, 1.05, 0], scale: [0.9, 2.1, 0.9], color: accent }],
    };
  }
  function setWonderName(value) {
    ST.wonderName = String(value || "").replace(/[<>`{}]/g, " ").replace(/\s+/g, " ").slice(0, 42);
    invalidateWonderPlan(ST.wonderName ? `Wonder name set to ${ST.wonderName}. Click a valid map tile to generate and found it there.` : "Wonder name cleared. Type a prompt, then click a valid map tile to generate and found it.");
  }
  function setWonderFootprint(value) {
    ST.wonderFootprint = normalizeWonderFootprintClient(value);
    invalidateWonderPlan(`Footprint set to ${ST.wonderFootprint}×${ST.wonderFootprint} (${wonderTilesClient(ST.wonderFootprint)} tiles). Click a valid map tile to generate and found it there.`);
  }
  function setWonderMode(value) {
    ST.wonderMode = ["single", "district"].includes(String(value)) ? String(value) : "district";
    invalidateWonderPlan(`Mode set to ${currentWonderMode() === "single" ? "big single landmark" : "multi-tile district"}. Click a valid map tile to generate and found it there.`);
  }
  function setWonderPalette(value) {
    ST.wonderPaletteId = WONDER_PALETTES.some((p) => p.id === value) ? value : "solar";
    invalidateWonderPlan(`Color scheme set to ${currentWonderPalette().name}. Click a valid map tile to generate and found it there.`);
  }
  function openWonderPlanner(message = "") {
    // Dedicated Wonder prompt action: no browser prompt, no large modal, no Build strip dependency.
    ST.modal = null;
    ST.panel = null;
    ST.mode = "wonder";
    ST.tool = "wonder";
    ST.placing = "worldwonder";
    if (message) ST.wonderMsg = message;
    updateHints();
    paint(true);
    syncBuildScrollSoon();
  }
  function enterWonderPlacement() {
    if (!ST.wonderRecipe) {
      openWonderPlanner("Type a prompt, choose size/color if needed, then click a valid map tile. Coins spend only after AI and placement both pass.");
      return;
    }
    ST.modal = null;
    ST.panel = null;
    ST.placing = "worldwonder";
    ST.mode = "place";
    ST.tool = "build";
    ST.wonderMsg = `Click a valid ${currentWonderSize()}×${currentWonderSize()} plaza center to found ${currentWonderNameFallback()}.`;
    say(ST.wonderMsg, 3200);
    updateHints(); paint(true);
  }
  function normalBuildMsClient(def) {
    if (!def) return 0;
    if (def.id === "worldwonder") return wonderBuildMsClient(currentWonderSize(), currentWonderMode());
    if (def.decor) return DECOR_BUILDING_BUILD_MS || 10000;
    if (["townhall", "goldmine", "academy", "workshop", "vault"].includes(String(def.id))) return (NORMAL_BUILDING_BUILD_MS || 18000) + 8000;
    return NORMAL_BUILDING_BUILD_MS || 18000;
  }
  function constructionStateForBuilding(b) {
    const end = Number(b?.constructUntil || (b?.kind === "worldwonder" ? b?.cdUntil : 0) || 0);
    const start = Number(b?.constructAt || (b?.kind === "worldwonder" ? b?.accAt : 0) || 0);
    if (!end || end <= Date.now()) return null;
    const total = Math.max(1, end - (start || Date.now()));
    const progress = Math.max(0, Math.min(1, (Date.now() - (start || Date.now())) / total));
    return { start, end, left: Math.max(0, end - Date.now()), total, progress };
  }
  try {
    const snd = JSON.parse(localStorage.getItem("solcraft:sound:v1") || "{}");
    ST.uiMuted = !!snd.uiMuted;
    ST.musicMuted = !!snd.musicMuted;
    ST.muted = ST.uiMuted && ST.musicMuted;
    sfx.setUiMuted?.(ST.uiMuted);
    sfx.setMusicMuted?.(ST.musicMuted);
  } catch (e) {}
  function saveSoundPrefs() {
    ST.muted = ST.uiMuted && ST.musicMuted;
    try { localStorage.setItem("solcraft:sound:v1", JSON.stringify({ uiMuted: ST.uiMuted, musicMuted: ST.musicMuted })); } catch (e) {}
    sfx.setUiMuted?.(ST.uiMuted);
    sfx.setMusicMuted?.(ST.musicMuted);
    paint(true);
  }
  function applyUiSettings() {
    const ui = ST.ui || { uiScale: 1, menuScale: 1 };
    const uiScale = clampUiScale(ui.uiScale, 1);
    const menuScale = clampUiScale(ui.menuScale, 1);
    // Keep manual game UI scale scoped to the game root only.
    // Applying these vars to html/body leaked into admin tools and made Atlas/Doll
    // editing feel warped after users changed scale settings.
    root.style.setProperty("--ui-scale", String(uiScale));
    root.style.setProperty("--menu-scale", String(menuScale));
    root.dataset.uiScale = String(uiScale);
    root.dataset.menuScale = String(menuScale);
  }
  function saveUiPrefs(next = ST.ui) {
    ST.ui = saveUiSettings(next);
    applyUiSettings();
    if (ST.walkthrough?.active) requestAnimationFrame(() => paint(true));
    paint(true);
  }
  function setUiScale(kind, value, toast = false) {
    const key = kind === "menu" ? "menuScale" : "uiScale";
    ST.ui = { ...(ST.ui || { uiScale: 1, menuScale: 1 }), [key]: clampUiScale(value, 1) };
    saveUiPrefs(ST.ui);
    if (toast) say(t(kind === "menu" ? "toast.menuScale" : "toast.interfaceScale", kind === "menu" ? "Menu scale {value}" : "Interface scale {value}", { value: uiScalePct(ST.ui[key]) }), 900);
  }
  function stepUiScale(kind, delta) {
    const key = kind === "menu" ? "menuScale" : "uiScale";
    const cur = ST.ui?.[key] ?? 1;
    setUiScale(kind, cur + delta, true);
  }
  function resetUiScale(kind = "all") {
    if (kind === "menu") setUiScale("menu", 1, true);
    else if (kind === "ui") setUiScale("ui", 1, true);
    else { ST.ui = { uiScale: 1, menuScale: 1 }; saveUiPrefs(ST.ui); say(t("toast.interfaceMenuScaleReset", "Interface and menu scale reset."), 1000); }
  }
  applyUiSettings();
  loadLoginGateConfig().then((gate) => { if (gate) { ST.loginGate = gate; paint(true); } }).catch(() => {});
  let guideResizeRaf = 0;
  window.addEventListener("resize", () => {
    if (!ST.walkthrough?.active) return;
    if (guideResizeRaf) cancelAnimationFrame(guideResizeRaf);
    guideResizeRaf = requestAnimationFrame(() => { guideResizeRaf = 0; paint(true); });
  }, { passive: true });
  window.addEventListener("orientationchange", () => {
    if (ST.walkthrough?.active) setTimeout(() => paint(true), 80);
  }, { passive: true });

  function toggleUiSound() { ST.uiMuted = !ST.uiMuted; saveSoundPrefs(); }
  function toggleMusicSound() { ST.musicMuted = !ST.musicMuted; saveSoundPrefs(); if (!ST.musicMuted) { loadBackgroundMusicSetting().finally(() => { sfx.resume(); say(t("toast.musicOn", "Music on."), 1200); }); } }
  function startMusicNow() { ST.musicMuted = false; saveSoundPrefs(); loadBackgroundMusicSetting().finally(() => { sfx.resume(); say(t("toast.musicStarted", "Music started."), 1200); }); }

  function walkthroughStorageKey() {
    return `${WALKTHROUGH_KEY}:${ST.auth?.pid || ST.profile.wallet || "local"}`;
  }
  function walkthroughIsDone() {
    try { return localStorage.getItem(walkthroughStorageKey()) === "done"; } catch (e) { return false; }
  }
  function markWalkthroughDone() {
    try { localStorage.setItem(walkthroughStorageKey(), "done"); } catch (e) {}
    ST.walkthrough = null;
  }
  function maybeStartWalkthrough(force = false) {
    if (ST.spectator || ST.screen !== "playing" || !ST.me || ST.needsProfile || !ST.me.profileDone || ST.updateRequired) return false;
    if (!force && walkthroughIsDone()) return false;
    if (!ST.walkthrough) ST.walkthrough = { active: true, step: "chop" };
    return true;
  }
  function skipWalkthrough() {
    markWalkthroughDone();
    say(t("toast.tutorialSkipped", "Tutorial skipped. Capital NPCs will host deeper guidance later."), 1800);
    paint(true);
  }
  function restartWalkthrough() {
    try { localStorage.removeItem(walkthroughStorageKey()); } catch (e) {}
    ST.walkthrough = null;
    const started = maybeStartWalkthrough(true);
    if (started) {
      ST.panel = null;
      ST.modal = null;
      say(t("toast.tutorialRestarted", "Tutorial restarted."), 1800);
    } else {
      say(t("toast.tutorialReset", "Tutorial reset. It will start when you enter as a player."), 2200);
    }
    paint(true);
  }
  function markGuidePanelVisited(panel) {
    const id = panel === "char" ? "character" : panel === "quests" ? "quests" : panel === "bank" ? "bank" : "";
    if (!id || !ST.auth || ST.spectator) return;
    act("guideVisit", { id }).then((r) => r?.ok && pollSoon());
  }
  const WALK_STEPS = ["chop", "mine", "claim", "build"];
  function nextWalkStep(cur) { const i = WALK_STEPS.indexOf(cur); return i >= 0 && i < WALK_STEPS.length - 1 ? WALK_STEPS[i + 1] : "done"; }
  function advanceWalkthroughTo(next, msg = "") {
    if (next === "done") { markWalkthroughDone(); if (msg) say(msg, 2400); paint(true); return; }
    ST.walkthrough = { active: true, step: next };
    if (msg) say(msg, 2200);
    paint(true);
  }
  function advanceWalkthroughPanel(panel) {
    if (!ST.walkthrough?.active) return;
    // Capital-service panels no longer advance the first-run flow.
  }
  function advanceWalkthroughAction(kind) {
    if (!ST.walkthrough?.active) return;
    // Selection alone should not complete Chop/Mine/Capture. Those steps advance
    // only after the server confirms the actual completed action.
    if (ST.walkthrough.step === "build" && kind === "build") return advanceWalkthroughTo("done", t("toast.buildGuideDone", "Build cards explain cost, footprint, and construction time."));
  }
  function completeWalkthroughAction(kind) {
    if (!ST.walkthrough?.active) return;
    if (ST.walkthrough.step === "chop" && kind === "chop") return advanceWalkthroughTo("mine", t("toast.treeChoppedNext", "Tree chopped. Next mine stone, then build with wood and stone."));
    if (ST.walkthrough.step === "mine" && kind === "mine") return advanceWalkthroughTo("claim", t("toast.stoneMinedNext", "Stone mined. Next select Capture (4) to claim free nearby land within your $CRAFTS capacity."));
    if (ST.walkthrough.step === "claim" && kind === "claim") return advanceWalkthroughTo("build", t("toast.landCapturedNext", "Land captured. Build next to raise limits and make the camp useful."));
  }
  function syncWalkthroughFromGuideRows() {
    if (!ST.walkthrough?.active || !ST.me) return;
    const rows = Array.isArray(ST.me.guideQuests) ? ST.me.guideQuests : [];
    const done = (id) => rows.some((r) => String(r?.id) === id && !!r?.done);
    if (ST.walkthrough.step === "chop" && (done("action-chop") || Number(ST.me.treesChopped || 0) >= 1)) return completeWalkthroughAction("chop");
    if (ST.walkthrough.step === "mine" && done("action-mine")) return completeWalkthroughAction("mine");
    if (ST.walkthrough.step === "claim" && done("action-claim")) return completeWalkthroughAction("claim");
  }
  async function loadBackgroundMusicSetting() {
    try {
      const res = await fetch('/api/audio-runtime', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      const audio = json?.audio || {};
      sfx.setAudioConfig?.(audio);
      const bg = json?.background || { url: audio.backgroundUrl, updatedAt: audio.updatedAt };
      if (bg && bg.url) sfx.setMusicUrl?.(String(bg.url) + '?v=' + encodeURIComponent(String(bg.updatedAt || Date.now())));
      else sfx.setMusicUrl?.("");
    } catch (e) {}
  }
  loadBackgroundMusicSetting();
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (saved && saved.pid && saved.secret) {
      ST.auth = { pid: saved.pid, secret: saved.secret, wallet: saved.wallet || "" };
      ST.walletVerified = true;
      ST.spectator = !!saved.spectator || String(saved.secret || "").startsWith("spectator:");
      ST.profile = { name: saved.name || "", body: saved.body != null ? saved.body : BODY_COLORS[0], hat: saved.hat != null ? saved.hat : HAT_COLORS[0], wallet: saved.wallet || "" };
    }
  } catch (e) {}
  try { ST.faceImage = localStorage.getItem(FACE_KEY) || null; } catch (e) {}
  window.addEventListener("world-of-solcrafts:character-changed", (ev) => {
    ST.characterProfile = ev?.detail || loadCharacterProfile();
    world?.refreshOwnRig?.();
    paint(true);
  });

  let appearanceSaveT = null;
  let appearanceRigT = null;
  function refreshOwnRigSoon() {
    clearTimeout(appearanceRigT);
    appearanceRigT = setTimeout(() => world?.refreshOwnRig?.(), 90);
  }
  function pushAppearanceToServer() {
    if (!ST.auth) return;
    clearTimeout(appearanceSaveT);
    appearanceSaveT = setTimeout(() => act("profileAppearance", { appearance: ST.characterProfile }), 350);
  }
  function saveLiveCharacterProfile(msg = t("toast.characterUpdated", "Character updated.")) {
    ST.characterProfile = saveCharacterProfile(ST.characterProfile);
    refreshOwnRigSoon();
    pushAppearanceToServer();
    // Do not force a full HUD/modal repaint on every color-slider tick. The
    // native input updates itself, and the world rig is refreshed after a short
    // debounce so the character changes without blinking/disappearing.
    if (msg) say(msg, 900);
    paint();
  }
  function setCharacterPalette(key, value) {
    ST.characterProfile.palette = { ...(ST.characterProfile.palette || {}), [key]: value };
    saveLiveCharacterProfile("");
  }
  function applyCharacterPreset(id) {
    const preset = characterPresetById(id);
    if (!preset) return;
    const palette = {};
    for (const k of CHARACTER_COLOR_KEYS) palette[k] = preset[k];

    // Presets are color/style palettes only. Do not overwrite head/body/back/feet.
    const currentParts = { ...(ST.characterProfile.parts || {}) };
    ST.characterProfile.palette = { ...(ST.characterProfile.palette || {}), ...palette };
    ST.characterProfile.showHat = false;
    ST.characterProfile.parts = {
      ...currentParts,
      hair: 0,
      tool: 0,
      hat: 0,
      showHat: false,
      showBack: Number(currentParts.back || 0) > 0,
    };
    ST.characterProfile.showBack = Number(currentParts.back || 0) > 0;
    ST.characterProfile.outfit = {
      torso: Number(currentParts.torso || 0),
      legs: Number(currentParts.legs || 0),
      back: Number(currentParts.back || 0),
    };
    // Keep the older compact color fields in sync for any fallback/procedural paths.
    ST.profile.body = presetHexToNumber(preset.primaryCloth, ST.profile.body || BODY_COLORS[0]);
    ST.profile.hat = presetHexToNumber(preset.secondaryCloth, ST.profile.hat || HAT_COLORS[0]);
    ST.characterProfile.body = ST.profile.body;
    ST.characterProfile.hat = ST.profile.hat;
    ST.characterProfile.skinColor = preset.skin;
    saveLiveCharacterProfile(t("toast.colorsApplied", "{name} colors applied.", { name: preset.name }));
  }
  function setCharacterPart(key, value) {
    if (!["head", "torso", "legs", "back"].includes(String(key || ""))) return;
    const v = Math.max(0, Math.min(7, Math.trunc(Number(value) || 0)));
    const parts = { ...(ST.characterProfile.parts || {}), [key]: v, hair: 0, tool: 0, hat: 0, showHat: false };
    if (key === "back") parts.showBack = v > 0;
    ST.characterProfile.parts = parts;
    ST.characterProfile.showHat = false;
    if (key === "back") ST.characterProfile.showBack = v > 0;
    if (["torso", "legs", "back"].includes(key)) ST.characterProfile.outfit = { ...(ST.characterProfile.outfit || {}), [key]: v };
    saveLiveCharacterProfile("");
  }
  function setCharacterFlag(key, value) {
    if (key === "showHat") value = false;
    ST.characterProfile[key] = !!value;
    ST.characterProfile.parts = { ...(ST.characterProfile.parts || {}), [key]: !!value };
    saveLiveCharacterProfile("");
  }
  function setVisual(change) {
    ST.visual = saveVisualSettings({ ...ST.visual, ...change });
      world?.applyVisualQuality?.(ST.visual);
    loadAtlasRuntimeConfig(true).finally(() => { for (const [, c] of world.cells) c.owner = -1; world.refreshWindow?.(true); paint(); });
  }
  function setTimeControls(change) {
    ST.timeControls = saveTimeControls({ ...(ST.timeControls || loadTimeControls()), ...change });
    world?.refreshEnvironment?.();
    paint(true);
  }
  function toggleTimeAuto() { setTimeControls({ auto: !(ST.timeControls?.auto !== false) }); }
  function setFixedWorldHour(hour) { setTimeControls({ auto: false, hour }); }
  function setCameraZoom(value, toast = false) {
    const next = clampCameraZoom(value, ST.visual?.cameraZoom || 1);
    ST.visual = saveVisualSettings({ ...ST.visual, cameraZoom: next });
    world?.refreshCameraZoom?.();
    world?.refreshWindow?.(true);
    // Zoom is a continuous control; do not spam player-facing notifications.
    void toast;
    paint();
    return next;
  }
  function stepCameraZoom(delta) {
    return setCameraZoom((ST.visual?.cameraZoom || 1) + Number(delta || 0), true);
  }
  function setCameraYaw(value, toast = false) {
    const next = normalizeCameraYaw(value, ST.visual?.cameraYaw ?? Math.PI / 4);
    ST.visual = saveVisualSettings({ ...ST.visual, cameraYaw: next });
    world?.refreshCameraRotation?.();
    if (toast) say(t("toast.cameraRotated", "Camera rotated {degrees}°", { degrees: cameraYawDeg(next) }), 900);
    paint();
    return next;
  }
  function stepCameraYaw(delta = CAMERA_ROTATION_STEP) {
    return setCameraYaw((ST.visual?.cameraYaw ?? Math.PI / 4) + Number(delta || 0), true);
  }
  function resetCameraView() {
    ST.visual = saveVisualSettings({ ...ST.visual, cameraZoom: 1, cameraYaw: Math.PI / 4 });
    world?.refreshCameraZoom?.();
    world?.refreshCameraRotation?.();
    world?.refreshWindow?.(true);
    say(t("toast.cameraReset", "Camera reset."), 900);
    paint();
  }
  function setMapView() {
    setCameraZoom(2.05, true);
  }

  /* feedback rails render through JSX; no imperative DOM for UI rows */
  let toastT = null;
  let noticeSeq = 0;
  let notices: any[] = [];
  function renderNotices() {
    render(<NotificationRailView notices={notices} />, noticeRoot);
  }
  function pushNotice(msg, kind = "info") {
    const text = String(msg || "").trim();
    if (!text) return;
    const nowMs = Date.now();
    notices = notices.filter((n) => !(n.text === text && nowMs - Number(n.at || 0) < 1400));
    const id = ++noticeSeq;
    notices = [...notices, { id, text, kind, at: nowMs }].slice(-3);
    renderNotices();
    setTimeout(() => {
      notices = notices.map((n) => n.id === id ? { ...n, gone: true } : n);
      renderNotices();
    }, 4200);
    setTimeout(() => {
      notices = notices.filter((n) => n.id !== id);
      renderNotices();
    }, 4800);
  }
  const say = (msg, ms = 2400) => {
    if (shouldSuppressNotice(msg)) return;
    const text = String(msg || "").trim();
    if (!text) return;
    // Keep only important system messages in the rail. Small world rewards use floating text.
    toastEl.textContent = "";
    toastEl.classList.remove("show");
    clearTimeout(toastT);
    void ms;
    pushNotice(text, /full|need|not enough|blocked|failed|cannot|out of energy/i.test(text) ? "warn" : "info");
  };

  let tipT = null;
  function placeTip(clientX, clientY) {
    const r = tipEl.getBoundingClientRect();
    const vw = Math.max(1, window.innerWidth || 1024);
    const vh = Math.max(1, window.innerHeight || 768);
    const safe = 8;
    let x = clientX + 14, y = clientY + 16;
    if (x + r.width > vw - safe) x = clientX - r.width - 12;
    if (y + r.height > vh - safe) y = clientY - r.height - 12;
    tipEl.style.left = Math.max(safe, Math.min(vw - r.width - safe, x)) + "px";
    tipEl.style.top = Math.max(safe, Math.min(vh - r.height - safe, y)) + "px";
  }
  function showTip(html, ev) {
    if (!html) return hideTip();
    clearTimeout(tipT);
    tipEl.innerHTML = html;
    tipEl.style.display = "block";
    tipEl.classList.add("show");
    if (ev) placeTip(ev.clientX, ev.clientY);
  }
  function moveTip(ev) { if (tipEl.style.display !== "none") placeTip(ev.clientX, ev.clientY); }
  function hideTip() { clearTimeout(tipT); tipEl.classList.remove("show"); tipT = setTimeout(() => { if (!tipEl.classList.contains("show")) tipEl.style.display = "none"; }, 90); }
  function tipText(title, body = "") { return `<b>${title}</b>${body ? `<small>${body}</small>` : ""}`; }

  function setFaceImage(dataUrl) {
    ST.faceImage = dataUrl || null;
    try { dataUrl ? localStorage.setItem(FACE_KEY, dataUrl) : localStorage.removeItem(FACE_KEY); } catch (e) {}
    paint(true);
    if (ST.auth) {
      act("profileFace", { faceImage: ST.faceImage }).then((r) => {
        if (r && r.ok) { ST.faceImage = r.faceImage || null; try { ST.faceImage ? localStorage.setItem(FACE_KEY, ST.faceImage) : localStorage.removeItem(FACE_KEY); } catch (e) {} paint(true); pollSoon(); }
      });
    }
  }
  function readFaceFile(ev) {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) { sfx.err(); say(t("toast.notImage", "That is not an image file.")); return; }
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 256;
        const scale = Math.min(1, max / Math.max(img.width || max, img.height || max));
        const w = Math.max(1, Math.round((img.width || max) * scale));
        const h = Math.max(1, Math.round((img.height || max) * scale));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const ctx = cv.getContext("2d");
        if (!ctx) return setFaceImage(String(rd.result || ""));
        ctx.drawImage(img, 0, 0, w, h);
        setFaceImage(cv.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => { sfx.err(); say(t("toast.portraitLoadFailed", "Portrait could not be loaded. Try another image.")); };
      img.src = String(rd.result || "");
    };
    rd.readAsDataURL(file);
  }

  /* chat renders through JSX; input stays inside the chat component */
  let chatLines: any[] = [];
  function onlineChatPlayers() {
    const rows = [];
    if (ST.me) rows.push({ id: ST.me.id, name: ST.me.name || "You", x: ST.me.x, z: ST.me.z, self: true });
    for (const p of ST.players || []) rows.push({ id: p.id, name: p.name || "Player", x: p.x, z: p.z, spectator: p.spectator });
    const seen = new Set();
    return rows.filter((p) => { const id = String(p.id); if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 24);
  }
  function renderChat() {
    render(<GameChatView lines={chatLines} onlinePlayers={onlineChatPlayers()} onKeyDown={handleChatKeyDown} />, chatEl);
    const log = chatEl.querySelector('[data-chat-log="1"]') as any;
    if (log) log.scrollTop = log.scrollHeight;
  }
  function handleChatKeyDown(ev) {
    if (ev.key === "Escape") { ST.chatOpen = false; ev.currentTarget?.blur?.(); paint(true); return; }
    if (ev.key !== "Enter") return;
    let msg = String(ev.currentTarget?.value || "").trim();
    if (!msg) { ST.chatOpen = false; ev.currentTarget?.blur?.(); paint(true); return; }
    if (msg === "/here" || msg === "/loc") msg = chatShareHereMessage();
    ev.currentTarget.value = "";
    act("chat", { msg });
    ST.chatOpen = false; ev.currentTarget?.blur?.(); paint(true);
  }
  function appendChat(line) {
    chatLines = [...chatLines, line].slice(-36);
    renderChat();
  }
  renderChat();

  function chatShareHereMessage() {
    const x = Math.trunc(Number(world?.me?.x ?? ST.me?.x ?? 0));
    const z = Math.trunc(Number(world?.me?.z ?? ST.me?.z ?? 0));
    return formatLocationChatCard({ x, z, label: `${ST.me?.name || "Settler"} is here` });
  }
  function shareHereInChat() {
    const msg = chatShareHereMessage();
    act("chat", { msg });
    say(t("toast.sharedLocation", "Shared your location."), 1100);
  }
  function shareInspectedBuildingInChat() {
    const uid = ST.inspect || ST.wonderViewUid || 0;
    const b = uid ? world.buildPool.get(uid) : null;
    if (!b) return say(t("toast.selectBuildingFirst", "Select a building first."), 1200);
    const def = LIB_BY_ID[b.kind];
    const msg = b.kind === "keep"
      ? formatKeepRallyChatCard({ uid, x: b.x, z: b.z, label: b.nm || "Keep raid", hp: b.hp, maxHp: b.maxHp, coins: b.stored })
      : formatBuildingChatCard({ uid, x: b.x, z: b.z, kind: b.kind, label: b.nm || def?.name || b.kind });
    act("chat", { msg });
    say(b.kind === "keep" ? t("toast.rallyShared", "Rally shared in chat.") : t("toast.buildingLocationShared", "Shared building location."), 1200);
  }
  function openChatCardFromElement(el) {
    const x = readNum(el, "x", 0);
    const z = readNum(el, "z", 0);
    const uid = readNum(el, "uid", 0);
    const kind = readStr(el, "kind", "location");
    const label = readStr(el, "label", kind === "keep" ? "Shared keep" : kind === "building" ? "Shared building" : "Shared location");
    const hp = readNum(el, "hp", 0);
    const maxHp = readNum(el, "maxHp", 0);
    const coins = readNum(el, "coins", 0);
    const b = uid ? world.buildPool.get(uid) : null;
    if (b) { openBuildingInspect({ uid, b }); return; }
    ST.objectPreview = { kind: kind === "keep" ? "keep" : "shared", x, z, name: label, biome: biomeAt(x, z).name, hp, maxHp, coins };
    ST.inspect = null;
    ST.panel = "object";
    ST.modal = null;
    paint(true);
  }

  /* ---------- NET: anchor/rev protocol ----------
     We are intentionally keeping REST polling as the state transport for this
     release. It is easier to inspect in DevTools, replay from logs/curl, cache at
     the edge, and reason about during ECS debugging than a long-lived socket. The
     performance rule is: poll only when a snapshot can teach the client something
     new, send rev/mapRev/chat cursors so the server can return deltas, and force
     a short poll only after actions that mutate authoritative state. If we later
     add SSE/WebSocket, it should be an optional downstream push path that feeds
     this same applySnap/materializeWorldPayload code, not a second state model.
     ---------------------------------------------------------------------- */
  const POLL_HEARTBEAT_MS = 250;       // cheap scheduler tick; most ticks skip
  const POLL_ACTIVE_MS = 850;          // normal shared-world freshness
  const POLL_RECENT_ACTION_MS = 360;   // brief catch-up after build/claim/pickup
  const POLL_IDLE_MS = 1450;           // player is just watching
  const POLL_HIDDEN_MS = 4200;         // tab hidden: preserve server/battery
  const POLL_BACKOFF_MAX_MS = 5200;
  let pollT = null, pollBusy = false, pollSoonT = null;
  let lastPollAt = 0, lastActionAt = 0, consecutivePollFailures = 0;

  function desiredPollInterval(force = false) {
    if (force) return 0;
    if (!ST.auth || ST.screen !== "playing") return POLL_IDLE_MS;
    if (document.hidden) return POLL_HIDDEN_MS;
    const now = performance.now();
    const recentAction = now - lastActionAt < 2200;
    const localMotion = !!world?.hasPendingMove?.();
    const sharedActivity = Array.isArray(ST.players) && ST.players.length > 0;
    const base = recentAction || localMotion ? POLL_RECENT_ACTION_MS : POLL_ACTIVE_MS;
    const idle = (!sharedActivity && !recentAction && !localMotion && !ST.chatOpen && !ST.modal) ? Math.max(base, POLL_IDLE_MS) : base;
    const backoff = consecutivePollFailures ? Math.min(POLL_BACKOFF_MAX_MS, 600 * Math.pow(1.75, consecutivePollFailures - 1)) : 0;
    return Math.max(idle, backoff);
  }

  async function poll(force = false) {
    const now = performance.now();
    if (!ST.auth || pollBusy || (!force && ST.screen !== "playing")) return false;
    if (!force) {
      const interval = desiredPollInterval(false);
      if (now - lastPollAt < interval) return false;
    }
    lastPollAt = now;
    const a = { ...ST.auth };
    pollBusy = true;
    const pollStartedAt = performance.now();
    let r:any = null;
    try {
      r = await perf.measureAsync("net.state", () => api("/api/state", {
        pid: a.pid, secret: a.secret, rev: ST.rev, ax: ST.ax, az: ST.az, chat: ST.chatId, mapRev: ST.mapRev ?? -1,
      }), { rev: ST.rev, mapRev: ST.mapRev ?? -1, forced: !!force });
    } finally {
      perfMini.update({ ping: performance.now() - pollStartedAt });
      pollBusy = false;
    }
    if (!r || !r.ok) {
      consecutivePollFailures = Math.min(8, consecutivePollFailures + 1);
      if (r && r.msg === "auth") {
        localStorage.removeItem(AUTH_KEY);
        ST.auth = null; ST.walletVerified = false; ST.spectator = false; ST.profile.wallet = ""; ST.screen = "menu"; ST.me = null;
        ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0; ST.mapRev = -1;
        paint(true);
      }
      return false;
    }
    consecutivePollFailures = 0;
    if (!ST.auth || ST.auth.pid !== a.pid || ST.auth.secret !== a.secret) return false;
    perf.measure("snap.apply", () => applySnap(r.snap), { rev: r.snap?.rev, players: r.snap?.players?.length || 0, buildings: r.snap?.buildings?.length || 0 });
    return true;
  }
  const pollSoon = () => { clearTimeout(pollSoonT); pollSoonT = setTimeout(() => poll(true), 90); };

  const worldSnapshotCache = { tiles: [], buildings: [], doodads: [], loot: [], players: [] };
  function entityKeyForWorldList(name, item) {
    if (!item) return "";
    if (name === "buildings") return String(item.uid ?? item.id ?? "");
    if (name === "loot") return String(item.id ?? `${item.x},${item.z}:${item.kind || "loot"}`);
    if (name === "players") return String(item.id ?? "");
    return `${Number(item.x || 0)},${Number(item.z || 0)}`;
  }
  function removeKeyForWorldList(name, item) {
    if (item == null) return "";
    if (typeof item === "string" || typeof item === "number") return String(item);
    if (Array.isArray(item)) return `${Number(item[0] || 0)},${Number(item[1] || 0)}`;
    return entityKeyForWorldList(name, item);
  }
  function mergeWorldList(name, full, deltaList, flatUpsert, flatRemove) {
    const current = Array.isArray(worldSnapshotCache[name]) ? worldSnapshotCache[name] : [];
    if (Array.isArray(full)) {
      worldSnapshotCache[name] = full.slice();
      return worldSnapshotCache[name];
    }
    const upsert = deltaList?.upsert ?? flatUpsert;
    const remove = deltaList?.remove ?? deltaList?.removed ?? flatRemove;
    if (!Array.isArray(upsert) && !Array.isArray(remove)) return current;
    const byKey = new Map(current.map((item) => [entityKeyForWorldList(name, item), item]));
    if (Array.isArray(remove)) for (const item of remove) byKey.delete(removeKeyForWorldList(name, item));
    if (Array.isArray(upsert)) for (const item of upsert) {
      const k = entityKeyForWorldList(name, item);
      if (k) byKey.set(k, { ...(byKey.get(k) || {}), ...item });
    }
    worldSnapshotCache[name] = Array.from(byKey.values());
    return worldSnapshotCache[name];
  }
  function materializeWorldPayload(w) {
    if (!w) return w;
    const d = w.delta || w.changes || w;
    return {
      ...w,
      tiles: mergeWorldList("tiles", w.tiles, d.tiles, d.tilesUpsert, d.tilesRemove),
      buildings: mergeWorldList("buildings", w.buildings, d.buildings, d.buildingsUpsert, d.buildingsRemove),
      doodads: mergeWorldList("doodads", w.doodads, d.doodads, d.doodadsUpsert, d.doodadsRemove),
      loot: mergeWorldList("loot", w.loot, d.loot, d.lootUpsert, d.lootRemove),
      players: mergeWorldList("players", w.players, d.players, d.playersUpsert, d.playersRemove),
    };
  }

  function applySnap(snap) {
    const requiredRaw = String(snap.requiredVersion || snap.me?.requiredVersion || "");
    const required = Number(requiredRaw || 0) || 0;
    const acked = readAckedClientVersion();
    // Do not interrupt a first-time login with a stale deploy modal. The first
    // successful snapshot becomes the browser's baseline. Future version changes
    // still show the refresh gate once.
    if (requiredRaw && !acked) {
      writeAckedClientVersion(requiredRaw);
    } else if (requiredRaw && requiredRaw !== acked && (!required || required > CLIENT_BOOT_AT)) {
      ST.updateRequired = true;
      ST.updateVersion = requiredRaw;
      ST.updateReason = String(snap.updateReason || snap.me?.updateReason || "A game update landed. Refresh once so your client and the server agree.");
    }
    const forceMe = !ST.me || ST.me.id !== snap.me.id;
    const localMotion = !forceMe && world?.hasPendingMove?.();
    const localPos = localMotion ? { x: world.me.x, z: world.me.z } : null;
    const nextMe = { ...snap.me, energyAt: performance.now() };
    // Do not let a poll that is one server tick behind yank the local player
    // backwards while a click/path movement is already being confirmed.
    if (localPos && cheb(nextMe.x, nextMe.z, localPos.x, localPos.z) <= 14) {
      nextMe.x = localPos.x;
      nextMe.z = localPos.z;
    }
    ST.me = nextMe;
    ST.spectator = !!snap.me.spectator;
    ST.landmarkBonusPct = Math.max(0, Number(snap.landmarkBonusPct || snap.me?.landmarkBonusPct || 0) || 0);
    if (snap.me.appearance && !ST.modal && ST.panel !== "char") {
      ST.characterProfile = saveCharacterProfile({ ...ST.characterProfile, ...snap.me.appearance, palette: { ...(ST.characterProfile.palette || {}), ...(snap.me.appearance.palette || {}) }, parts: { ...(ST.characterProfile.parts || {}), ...(snap.me.appearance.parts || {}) } });
    }
    ST.needsProfile = !snap.me.profileDone;
    if (snap.me.bank) ST.bank = snap.me.bank;
    if ("faceImage" in snap.me) { ST.faceImage = snap.me.faceImage || null; try { ST.faceImage ? localStorage.setItem(FACE_KEY, ST.faceImage) : localStorage.removeItem(FACE_KEY); } catch (e) {} }
    ST.players = snap.players || [];
    ST.leaderboard = snap.leaderboard || ST.leaderboard || [];
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
      ST.offers = snap.world.offers || [];
      if (snap.world.map) { ST.map = { players: ST.map?.players || [], ...snap.world.map }; ST.mapRev = snap.world.map.rev ?? snap.world.rev ?? ST.mapRev; }
      const worldPayload = materializeWorldPayload(snap.world);
      world.applyWorld(worldPayload);
    }
    if (snap.mapPlayers) ST.map = { ...(ST.map || {}), players: mergeMinimapPlayers(snap.mapPlayers, ST.players, ST.me) };
    maybeStartWalkthrough(false);
    syncWalkthroughFromGuideRows();
    world.applyMe(forceMe);
    world.applyPlayers(ST.players);
    refreshNear();
    markSnapUiDirty();
    paint();
  }

  function mergeMinimapPlayers(...sources) {
    const byId = new Map();
    const push = (p) => {
      if (!p || p.id == null) return;
      const prev = byId.get(p.id) || {};
      byId.set(p.id, { ...prev, ...p, lastSeen: Number(p.lastSeen || p.ts || prev.lastSeen || prev.ts || Date.now()) });
    };
    for (const src of sources) {
      if (Array.isArray(src)) for (const p of src) push(p);
      else push(src);
    }
    return Array.from(byId.values());
  }

  function mergeRowsByCoord(...sources) {
    const byKey = new Map();
    const push = (row) => {
      if (!row || !Number.isFinite(Number(row.x)) || !Number.isFinite(Number(row.z))) return;
      const kk = `${Math.trunc(Number(row.x))},${Math.trunc(Number(row.z))}`;
      byKey.set(kk, { ...(byKey.get(kk) || {}), ...row, x: Math.trunc(Number(row.x)), z: Math.trunc(Number(row.z)) });
    };
    for (const src of sources) if (Array.isArray(src)) for (const row of src) push(row);
    return Array.from(byKey.values());
  }

  function mergeRowsByIdOrCoord(...sources) {
    const byKey = new Map();
    const push = (row) => {
      if (!row) return;
      const id = row.uid ?? row.id ?? row.key;
      const kk = id != null ? `id:${id}` : (Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.z)) ? `xz:${Math.trunc(Number(row.x))},${Math.trunc(Number(row.z))}` : "");
      if (!kk) return;
      byKey.set(kk, { ...(byKey.get(kk) || {}), ...row });
    };
    for (const src of sources) if (Array.isArray(src)) for (const row of src) push(row);
    return Array.from(byKey.values());
  }


  function worldMapData(expanded = false) {
    const canvasMini = world?.minimapSnapshot?.() || null;
    const fallbackTiles = Array.isArray(canvasMini?.tiles) && canvasMini.tiles.length ? canvasMini.tiles : (world?.visibleCells ? world.visibleCells() : (world?.cells ? Array.from(world.cells.values()).map((c) => ({ x: c.cx ?? c.x, z: c.cz ?? c.z, owner: c.owner || 0 })) : []));
    const fallbackBuildings = Array.isArray(canvasMini?.buildings) && canvasMini.buildings.length ? canvasMini.buildings : (world?.buildPool ? Array.from(world.buildPool.values()).map((b) => ({ x: b.x, z: b.z, kind: b.kind, owner: b.owner, uid: b.uid })) : []);
    const fallbackLoot = Array.isArray(canvasMini?.loot) && canvasMini.loot.length ? canvasMini.loot : (world?.lootPool ? Array.from(world.lootPool.values()).map((l) => ({ x: l.x, z: l.z, kind: l.kind, id: l.id })) : []);
    // After the Canvas renderer swap, ST.map can be a stale or sparse server
    // overview while the live canvas cache has the real local window. Merge
    // them instead of choosing one, so the pocket minimap, compass, and map
    // click logic stay in sync with what the player can actually see.
    const allTiles = mergeRowsByCoord(ST.map?.tiles || [], fallbackTiles);
    const allBuildings = mergeRowsByIdOrCoord(ST.map?.buildings || [], fallbackBuildings);
    const allLoot = mergeRowsByIdOrCoord(ST.map?.loot || [], fallbackLoot);
    const allPlayers = mergeMinimapPlayers(ST.map?.players || [], ST.players || [], ST.me).filter((p) => p && p.id != null && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.z)));
    const meX = Number(ST.me?.x || 0), meZ = Number(ST.me?.z || 0);
    const dist = (q) => Math.max(Math.abs(Number(q?.x || 0) - meX), Math.abs(Number(q?.z || 0) - meZ));
    // Small minimap must stay readable. A procedural Keep or old object thousands
    // of cells away should not collapse the local view into one pixel. The
    // expanded World Map still uses the whole known map for admin jump/cleanup.
    const localRadius = 96;
    const activeNow = Date.now();
    const activePlayer = (p) => p?.id === ST.me?.id || !p?.lastSeen || activeNow - Number(p.lastSeen || p.ts || 0) <= 120000;
    const tiles = expanded ? allTiles : allTiles.filter((t) => dist(t) <= localRadius);
    const buildings = expanded ? allBuildings : allBuildings.filter((b) => dist(b) <= localRadius || (Number(b.owner || 0) === Number(ST.me?.id || -1) && dist(b) <= localRadius * 1.35));
    const loot = expanded ? allLoot : allLoot.filter((l) => dist(l) <= localRadius);
    const players = expanded ? allPlayers : allPlayers.filter((p) => activePlayer(p) && dist(p) <= localRadius * 1.25);
    if (ST.me && !players.some((p) => p.id === ST.me.id)) players.unshift(ST.me);
    if (!expanded) {
      // The pocket minimap is a local instrument, not a world overview. Keeping
      // its bounds centered on the player prevents far-away bases/keeps from
      // collapsing local tiles into unreadable pixels. Use the expanded map for
      // global coordination and far travel.
      const r = 42;
      return { tiles, buildings, loot, players, minX: meX - r, maxX: meX + r, minZ: meZ - r, maxZ: meZ + r, totalBuildings: allBuildings.length, totalPlayers: allPlayers.length };
    }
    let minX = Number(ST.me?.x || 0), maxX = minX, minZ = Number(ST.me?.z || 0), maxZ = minZ;
    const add = (x, z) => { x = Number(x); z = Number(z); if (!Number.isFinite(x) || !Number.isFinite(z)) return; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
    for (const t of tiles) add(t.x, t.z);
    for (const b of buildings) add(b.x, b.z);
    for (const l of loot) add(l.x, l.z);
    for (const p of players) add(p.x, p.z);
    const span = Math.max(maxX - minX + 1, maxZ - minZ + 1, 12);
    const pad = Math.max(6, Math.min(30, Math.ceil(span * 0.08)));
    return { tiles, buildings, loot, players, minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad, totalBuildings: allBuildings.length, totalPlayers: allPlayers.length };
  }


  function wonderMapFootprint(b) { return normalizeWonderFootprintClient(b?.wonder?.footprint || b?.footprint || 5); }
  function wonderMapRadius(b) { return wonderRadiusClient(wonderMapFootprint(b)); }
  function wonderMapDistrictRadius(b) {
    const fp = wonderMapFootprint(b);
    return fp === 3 ? 8 : fp === 5 ? 12 : fp === 7 ? 16 : 20;
  }
  function wonderPromptKind(b) {
    const raw = String(b?.wonder?.prompt || b?.wonder?.name || b?.nm || "").toLowerCase();
    if (/school|academy|library|campus|learn|science/.test(raw)) return "school";
    if (/market|bank|trade|bazaar|shop|auction/.test(raw)) return "market";
    if (/temple|shrine|altar|church|cathedral/.test(raw)) return "temple";
    if (/forge|factory|workshop|industrial/.test(raw)) return "forge";
    if (/observatory|tower|star|moon|sky|map/.test(raw)) return "observatory";
    return "wonder";
  }
  function wonderDistrictColorHex(b) {
    const kind = wonderPromptKind(b);
    if (kind === "school") return "#7dcfe8";
    if (kind === "market") return "#ffd76e";
    if (kind === "temple") return "#f3ead7";
    if (kind === "forge") return "#ff8a5e";
    if (kind === "observatory") return "#9945ff";
    return "#14f195";
  }
  function cellInsideOwnedWonderDistrictClient(x, z) {
    if (!ST.me || !world?.buildPool) return false;
    for (const w of world.buildPool.values()) {
      if (!w || w.kind !== "worldwonder" || Number(w.owner) !== Number(ST.me.id)) continue;
      if (cheb(Number(w.x), Number(w.z), Number(x), Number(z)) <= wonderMapDistrictRadius(w)) return true;
    }
    return false;
  }
  function freeRoadTravelCellClient(x, z) {
    const b = world?.buildPoolAt?.(x, z);
    if (b && b.kind === "road" && ST.me && Number(b.owner) === Number(ST.me.id)) return true;
    return cellInsideOwnedWonderDistrictClient(x, z);
  }

  function nearestWonderForBuildingMap(b, wonders) {
    let best = null, bestD = Infinity;
    for (const w of wonders) {
      if (!w || w.uid === b.uid) continue;
      const d = cheb(Number(b.x), Number(b.z), Number(w.x), Number(w.z));
      const maxD = wonderMapDistrictRadius(w) + Math.max(3, Math.ceil(wonderMapFootprint(w) / 2));
      if (d <= maxD && d < bestD) { best = w; bestD = d; }
    }
    return best;
  }
  function roadPathToWonderMap(b, w, maxSteps = 80) {
    const out = [];
    let x = Math.round(Number(b.x)), z = Math.round(Number(b.z));
    const wr = wonderMapRadius(w);
    const wx = Math.round(Number(w.x)), wz = Math.round(Number(w.z));
    const tx = Math.max(wx - wr, Math.min(wx + wr, x));
    const tz = Math.max(wz - wr, Math.min(wz + wr, z));
    const push = () => { if (!(x === Math.round(Number(b.x)) && z === Math.round(Number(b.z)))) out.push({ x, z }); };
    let guard = 0;
    while (x !== tx && guard++ < maxSteps) { x += x < tx ? 1 : -1; push(); }
    while (z !== tz && guard++ < maxSteps) { z += z < tz ? 1 : -1; push(); }
    return out.slice(0, maxSteps);
  }
  function districtRoadsForMap(buildings) {
    const rows = Array.isArray(buildings) ? buildings : [];
    const wonders = rows.filter((b) => b && b.kind === "worldwonder" && Number.isFinite(Number(b.x)) && Number.isFinite(Number(b.z)));
    const roads = [];
    if (!wonders.length) return roads;
    for (const b of rows) {
      if (!b || b.kind !== "road" || !Number.isFinite(Number(b.x)) || !Number.isFinite(Number(b.z))) continue;
      roads.push({ x: Math.round(Number(b.x)), z: Math.round(Number(b.z)), color: "#d8b66e", owner: b.owner, built: true });
    }
    const candidates = rows.filter((b) => b && b.kind !== "worldwonder" && b.kind !== "keep" && b.kind !== "bomb" && b.kind !== "road" && Number.isFinite(Number(b.x)) && Number.isFinite(Number(b.z)));
    for (const b of candidates) {
      const w = nearestWonderForBuildingMap(b, wonders);
      if (!w) continue;
      const color = wonderDistrictColorHex(w);
      for (const step of roadPathToWonderMap(b, w)) roads.push({ ...step, color, wonderUid: w.uid, owner: b.owner });
      if (roads.length > 1200) break;
    }
    return roads;
  }

  function drawKnownWorldMap(canvas, expanded = false) {
    if (!canvas || !ST.me) return null;
    const data = worldMapData(expanded);
    const view = renderKnownWorldMap(canvas, data, {
      me: ST.me,
      expanded,
      nowMs: Date.now(),
      districtRoads: districtRoadsForMap(data.buildings),
      wonderDistrictRadius: (w) => wonderMapDistrictRadius(w),
      wonderDistrictColorHex: (w) => wonderDistrictColorHex(w),
    });
    if (view) {
      if (expanded) ST.worldMapView = view;
      else ST.minimapView = view;
    }
    return view;
  }

  function handleWorldMapClick(ev) {
    const view = ST.worldMapView;
    const cv = ev?.target?.closest?.("canvas");
    if (!view || !cv || !ST.me) return;
    const tile = tileFromCanvasEvent(view, cv, ev);
    if (!tile) return;
    const { x, z } = tile;
    if (isAdminPlayer()) {
      act("adminMapTeleport", { x, z }).then((res) => {
        if (res && res.ok) { ST.modal = null; world.hardSnapMe(res.x ?? x, res.z ?? z); world.refreshWindow?.(true); pollSoon(); paint(true); }
      });
      return;
    }
    ST.modal = null; paint(true);
    if (!world.pathTo(x, z)) say(t("toast.tooFarWalk", "That point is too far to walk from here. Try moving in smaller steps or use a discovered travel point."), 2600);
  }

  async function act(type, payload = {}) {
    if (ST.updateRequired) return { ok: false, msg: "refresh required" };
    if (!ST.auth) return { ok: false };
    lastActionAt = performance.now();
    if (ST.spectator && !["move", "movePath", "adminMapTeleport", "adminDemolishAt", "adminSpawnKeep", "profileAppearance", "setupProfile", "homeStart", "homeFinish", "homeCancel", "home"].includes(type)) {
      say(t("toast.spectatorReadonly", "Spectator mode is read-only. Connect Phantom to claim, craft, build, trade, or collect. Spectators are visible as ghosts but cannot pick up coins."), 2200);
      return { ok: false, msg: "spectator" };
    }
    const r = await api("/api/action", { pid: ST.auth.pid, secret: ST.auth.secret, type, ...payload });
    const quietWorldFeedback = type === "pickup" || type === "harvestFinish" || type === "harvestStart";
    if (r && r.note && !quietWorldFeedback) say(r.note, 2600);
    else if (r && !r.ok && r.msg) { sfx.err(); say(r.msg, 2400); }
    if (r && r.ok && type !== "move" && type !== "movePath") pollSoon();
    return r;
  }


  async function referralRequest(body = {}) {
    if (!ST.auth) return { ok: false, msg: "Connect first." };
    return await fetch("/api/referrals", {
      method: "POST",
      headers: { "content-type": "application/json", "x-solcraft-player": String(ST.auth.pid || 0), authorization: `Bearer ${ST.auth.secret || ""}` },
      body: JSON.stringify({ pid: ST.auth.pid, secret: ST.auth.secret, ...body }),
    }).then((r) => r.json()).catch((e) => ({ ok: false, msg: String(e?.message || e || "Referral request failed") }));
  }
  async function createReferralFromSettings() {
    const root = document.querySelector(".sc-referral-quick");
    const code = String((root?.querySelector?.('[name="refCode"]') as HTMLInputElement | null)?.value || "").trim();
    const rewardAmount = Number((root?.querySelector?.('[name="refReward"]') as HTMLInputElement | null)?.value || 500);
    const r = await referralRequest({ action: "create", code, rewardAmount, maxUses: 25 });
    if (r?.ok) { sfx.coin?.(); say(r.note || `Referral code ${r.code?.code || code} created.`, 3200); }
    else { sfx.err(); say(r?.msg || "Could not create referral code.", 2600); }
  }
  async function showReferralStatus() {
    const r = await referralRequest({ action: "status" });
    if (!r?.ok) { sfx.err(); say(r?.msg || "Could not load referrals.", 2200); return; }
    const active = Number(r.stats?.activeCodes || 0);
    const referred = Array.isArray(r.referred) ? r.referred.length : 0;
    const latest = Array.isArray(r.codes) && r.codes[0]?.code ? ` Latest: ${r.codes[0].code}` : "";
    say(`Referral codes: ${active}. Referred players: ${referred}.${latest}`, 3600);
  }

  function cleanWonderPromptClient(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
  }
  function wonderFactsLine() {
    const size = currentWonderSize();
    const mode = currentWonderMode();
    const ms = wonderBuildMsClient(size, mode);
    const modeName = mode === "single" ? "single landmark" : "multi-tile district";
    return `${size}×${size} plaza (${wonderTilesClient(size)} tiles) · ${modeName} · ${currentWonderPalette().name} · AI ${WONDER_AI_TIME_HINT} · ${Math.round(ms / 1000)}s construction`;
  }
  function invalidateWonderPlan(reason = "Wonder options changed. Click a valid map tile to generate and found it there.") {
    ST.wonderRecipe = null;
    ST.wonderMsg = reason;
  }
  async function prepareWonderRecipe() {
    const prompt = cleanWonderPromptClient(ST.wonderPrompt);
    if (!prompt) {
      sfx.err();
      openWonderPlanner("Describe the Wonder in the single prompt field first, for example: small brick school with bell tower and playground.");
      return null;
    }
    if (!ST.wonderName) ST.wonderName = currentWonderNameFallback();
    if (ST.wonderBusy) { say(t("toast.wonderAiBusy", "Landmark AI is already generating. The foundation will start after the plan is ready."), 1800); return null; }
    if (ST.wonderRecipe && ST.wonderRecipe.prompt === prompt && Number(ST.wonderRecipe.footprint || 9) === currentWonderSize() && String(ST.wonderRecipe.mode || "district") === currentWonderMode() && String(ST.wonderRecipe.paletteId || "solar") === currentWonderPalette().id) return ST.wonderRecipe;
    ST.wonderPrompt = prompt;
    ST.wonderBusy = true; ST.wonderMsg = `Generating real AI plan… ${wonderFactsLine()}. Coins are not spent yet.`; paint(true);
    let r = null;
    try {
      r = await api("/api/wonder/preview", {
        pid: ST.auth?.pid,
        secret: ST.auth?.secret,
        prompt,
        name: currentWonderNameFallback(),
        footprint: currentWonderSize(),
        mode: currentWonderMode(),
        paletteId: currentWonderPalette().id,
        palette: currentWonderPalette().colors,
      });
    } catch (e) {
      r = { ok: false, msg: e?.message || t("toast.wonderGeneratorFailed", "Wonder generator failed.") };
    }
    ST.wonderBusy = false;
    if (!r || !r.ok || !r.recipe) { sfx.err(); ST.wonderMsg = r?.msg || t("toast.wonderGeneratorFailed", "Wonder generator failed."); say(ST.wonderMsg, 2600); paint(true); return null; }
    ST.wonderRecipe = r.recipe;
    ST.wonderName = r.recipe?.name || ST.wonderName || currentWonderNameFallback();
    ST.wonderFootprint = r.recipe?.footprint || ST.wonderFootprint;
    ST.wonderMode = r.recipe?.mode || ST.wonderMode;
    ST.wonderPaletteId = r.recipe?.paletteId || ST.wonderPaletteId;
    ST.wonderMsg = `AI plan ready: ${r.recipe?.name || "Landmark"}. Founding starts when you click a valid ${r.recipe?.footprint || currentWonderSize()}×${r.recipe?.footprint || currentWonderSize()} plaza center.`;
    paint(true);
    return r.recipe;
  }
  async function placeWorldWonderAt(x, z) {
    if (ST.wonderPlacing) { say(t("toast.wonderPlacementBusy", "Landmark placement is already running. Wait for the current request."), 1800); return; }
    const promptBefore = cleanWonderPromptClient(ST.wonderPrompt);
    const placeKey = `${x},${z}:${promptBefore}`;
    if (Date.now() - Number(ST.wonderLastPlaceAt || 0) < 3500 && ST.wonderLastPlaceKey === placeKey) {
      say(t("toast.wonderAlreadyFounding", "Already founding that Wonder. Wait for the server response."), 1800);
      return;
    }
    ST.wonderPlacing = true;
    ST.wonderLastPlaceAt = Date.now();
    ST.wonderLastPlaceKey = placeKey;
    ST.wonderMsg = ST.wonderRecipe ? `Founding planned Wonder on a ${currentWonderSize()}×${currentWonderSize()} plaza… ${Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s construction.` : `Generating the Wonder, then placing the foundation on this ${currentWonderSize()}×${currentWonderSize()} plaza…`;
    paint(true);
    try {
      const recipe = await prepareWonderRecipe();
      if (!recipe) return;
      const prompt = cleanWonderPromptClient(ST.wonderPrompt || recipe.prompt);
      const r = await act("placeWonder", { x, z, prompt, recipe });
      if (r && r.ok) {
        sfx.milestone?.();
        world.shockwave(x, z, 0xffd76e);
        if (Number.isFinite(r.x) && Number.isFinite(r.z)) world.hardSnapMe(r.x, r.z);
        ST.wonderRecipe = null; ST.wonderPrompt = ""; ST.wonderMsg = "";
        updateHints(); pollSoon(); paint(true);
      }
    } finally {
      ST.wonderPlacing = false;
      paint(true);
    }
  }

  async function joinGame() {
    if (ST.joining) return;
    ST.loginMsg = "";
    ST.joining = true; paint(true);
    try {
      const walletAuth = await connectAndSignPhantom();
      if (walletAuth.loginGate) ST.loginGate = walletAuth.loginGate;
      const r = await api("/api/join", { name: "", referralCode: "", body: ST.profile.body, hat: ST.profile.hat, appearance: ST.characterProfile, walletAuth });
      if (!r || !r.ok) throw new Error((r && r.msg) || "Could not join.");
      ST.auth = { pid: r.id, secret: r.secret, wallet: r.wallet || walletAuth.wallet };
      ST.walletVerified = true;
      ST.needsProfile = !!r.needsProfile;
      ST.profile.wallet = r.wallet || walletAuth.wallet;
      ST.me = null; ST.players = []; ST.offers = [];
      ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0; ST.mapRev = -1;
      localStorage.setItem(AUTH_KEY, JSON.stringify({ pid: r.id, secret: r.secret, wallet: ST.profile.wallet, body: ST.profile.body, hat: ST.profile.hat, spectator: false }));
      startPlaying();
    } catch (e) {
      sfx.err();
      const msg = e?.message || "Phantom authorization was cancelled.";
      ST.loginMsg = msg;
      say(msg, 2800);
      ST.joining = false; paint(true);
    }
  }
  async function spectateGame() {
    if (ST.joining) return;
    ST.loginMsg = "";
    ST.joining = true; paint(true);
    try {
      const r = await api("/api/join", { spectator: true, name: "Spectator", appearance: ST.characterProfile });
      if (!r || !r.ok) throw new Error((r && r.msg) || "Could not enter spectator mode.");
      ST.auth = { pid: r.id, secret: r.secret, wallet: "" };
      ST.walletVerified = false;
      ST.spectator = true;
      ST.needsProfile = false;
      ST.profile.wallet = "";
      ST.me = null; ST.players = []; ST.offers = [];
      ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0; ST.mapRev = -1;
      localStorage.setItem(AUTH_KEY, JSON.stringify({ pid: r.id, secret: r.secret, wallet: "", spectator: true }));
      startPlaying();
    } catch (e) {
      sfx.err();
      say(e?.message || t("toast.spectatorModeFailed", "Spectator mode failed."), 2600);
      ST.joining = false; paint(true);
    }
  }
  function forgetLocalSettler() {
    localStorage.removeItem(AUTH_KEY);
    ST.auth = null; ST.walletVerified = false; ST.spectator = false; ST.profile.wallet = ""; ST.screen = "menu"; ST.me = null;
    ST.players = []; ST.offers = [];
    ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0; ST.mapRev = -1;
    ST.modal = null; ST.panel = null; ST.inspect = null; ST.mode = "explore"; ST.placing = null; ST.tool = "none";
    world.walkQueueClear(); world.hideBuildGhost(); world.setHintCells([]);
    paint(true);
  }
  async function startPlaying() {
    if (!ST.auth) { joinGame(); return; }
    const ae = document.activeElement; if (ae && ae.blur) ae.blur();
    ST.joining = false;
    ST.screen = "playing";
    ST.modal = null; ST.panel = null; ST.inspect = null; ST.mode = "explore"; ST.placing = null; ST.tool = "none";
    ST.rev = 0; ST.ax = 1e6; ST.az = 1e6;
    world.walkQueueClear(); world.hideBuildGhost(); world.setHintCells([]);
    sfx.resume();
    paint(true);
    const loaded = await poll(true);
    if (loaded) {
      if (ST.needsProfile || (ST.me && !ST.me.profileDone)) { ST.modal = "intro"; paint(true); }
      else say(t("toast.welcomeBack", "Welcome back. Your flag is ready."), 3200);
    }
  }

  /* ============================================================
     CANVAS PRISM WORLD
     ============================================================
     The live world renderer is now Canvas 2D.  Three.js is no longer used for
     map terrain, buildings, resources, players, previews, or visibility.
     The canvas renderer consumes the same authoritative snapshots and builds
     world objects from stacked prism recipes while keeping DOM HUD/UI separate.
     ============================================================ */
  const world = guardCanvasWorld(createCanvasPrismWorld({
    host: worldEl,
    state: ST,
    sendAction: act,
    say,
    pollSoon,
    key,
    cheb,
    n8: N8,
    currentTileLoadRadius,
    capitalBuildingsInView,
    tradePostAt,
    proceduralNpcAt,
    biomeTerrainAt,
    naturalDoodad,
    hrand,
    onHop: () => sfx.hop?.(),
    onError: () => sfx.err?.(),
  }), root);
  assertCanvasWorldApi(world);

  /* ============================================================
     INTERACTION PROBE
     ============================================================ */
  function estAcc(b) {
    const def = LIB_BY_ID[b.kind];
    if (!def || !def.prod) return 0;
    const constructing = constructionStateForBuilding(b);
    if (constructing) return 0;
    const rate = (Object.values(def.prod)[0] || 0) * lvlMul(b.level || 1);
    const readyAt = Math.max(Number(b.constructUntil || 0), Number(b.accAt || 0), 0) || Date.now();
    return Math.min(60, (b.acc || 0) + rate * Math.max(0, Date.now() - readyAt) / 1000);
  }
  function probeInteract() {
    if (!ST.me) return null;
    const px = world.me.x, pz = world.me.z;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (tradePostAt(px + dx, pz + dz)) return { t: "trade", uid: 0, label: "Trade Post" };
      const b = world.buildPoolAt(px + dx, pz + dz);
      if (!b || b.owner !== ST.me.id) continue;
      const uid = b.uid;
      const def = LIB_BY_ID[b.kind];
      const constructing = constructionStateForBuilding(b);
      if (constructing) return { t: "use", uid, label: `Building ${Math.max(1, Math.round(constructing.progress * 100))}% · ${Math.ceil(constructing.left / 1000)}s` };
      if (def && def.prod && estAcc(b) >= 1) return { t: "use", uid, label: `Collect ${b.nm || def.name} (+${Math.floor(estAcc(b))})` };
      if (def && def.use) {
        const cdLeft = Math.max(0, Math.ceil(((b.cdUntil || 0) - Date.now()) / 1000));
        if (def.use.k === "trade") return { t: "trade", uid, label: "Trade" };
        if (def.use.k === "bomb") return { t: "use", uid, label: b.cdUntil ? (cdLeft ? `Tool fuse ${cdLeft}s` : "Trigger tool") : "Arm tool" };
        return { t: "use", uid, label: def.use.label + (cdLeft ? ` · ${cdLeft}s` : "") };
      }
    }
    // Harvesting lives on slots 1 and 2 now, so slot 6 never duplicates "Chop tree" or "Mine rock".
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
      if (b && ST.me && b.owner !== ST.me.id && (b.kind === "bomb" || b.kind === "keep")) {
        const uid = b.uid;
        ST.near.r = { uid, kind: b.kind, name: b.nm || LIB_BY_ID[b.kind]?.name || b.kind, owner: b.ownerName };
      }
    }
    ST.near.m = false;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (tradePostAt(px + dx, pz + dz)) ST.near.m = true;
      const b = world.buildPoolAt(px + dx, pz + dz);
      if (b && LIB_BY_ID[b.kind]?.use?.k === "trade") ST.near.m = true;
    }
  }
  function maybeStartQueuedHarvest() {
    const q = ST.harvestAfterWalk;
    if (!q || ST.channel || !ST.me) return;
    const d = world.doodadVisible(q.x, q.z);
    const want = q.tool === "stone" ? "rock" : "tree";
    if (!d) { ST.harvestAfterWalk = null; world.markDoodadGone?.(q.x, q.z); return; }
    if (d !== want) { ST.harvestAfterWalk = null; return; }
    if (cheb(q.x, q.z, world.me.x, world.me.z) <= 1) {
      ST.harvestAfterWalk = null;
      startChop(q.x, q.z);
    }
  }
  const nearT = scheduler.every("ui.near", 250, () => { if (ST.screen !== "playing") return; perf.measure("ui.near", () => { refreshNear(); updateHints(); tryPickupAt(); maybeStartQueuedHarvest(); paint(); }); });
  const keyboardMoveT = scheduler.every("movement.keyboard", 0, (now) => {
    if (!updateKeyboardMoveIntent()) {
      try { world.setInputVelocity?.(0, 0); } catch {}
      return;
    }
    keyboardMoveAccumulator.tick(now, () => ST.screen === "playing" && !ST.updateRequired && !!world?.tryMoveDelta && (world.canIssueMove?.() !== false), (intent) => world.tryMoveDelta(intent.x, intent.z));
    try {
      const v = keyboardMoveAccumulator.getVelocity?.();
      world.setInputVelocity?.(v?.x || 0, v?.z || 0);
    } catch {}
  });

  function useBuildingClient(uid) {
    if (uid == null) return;
    act("use", { uid }).then((r) => {
      if (!r || !r.ok) return;
      world.animateBuildingUse?.(uid);
      if (r.openTrade || r.service === "bank") { openBankFromInspect(); return; }
      if (r.service === "customizer") { openCustomizerFromInspect(uid); return; }
      sfx.saw();
    });
  }
  function doInteract() {
    const i = ST.near.i; if (!i) return;
    if (i.t === "trade") { ST.panel = "bank"; ST.tradeTab = "bank"; paint(true); }
    else if (i.t === "use") useBuildingClient(i.uid);
  }

  /* ---------- channelled actions: harvest + teleport + withdrawal casts ---------- */
  function showChannel(label) {
    channelEl.classList.add("on");
    const lbl = document.getElementById("sc-ch-label");
    const fill = document.getElementById("sc-ch-fill");
    if (lbl) lbl.textContent = label;
    if (fill) fill.style.width = "0%";
  }
  function harvestErrorText(r) {
    const code = String(r?.reasonCode || "");
    if (code === "TOO_FAR") return "Move closer";
    if (code === "NO_HARVEST_TARGET" || code === "HARVEST_GONE") return "Already gathered";
    if (code === "NO_HARVEST_ENERGY") return "Rest a moment";
    return String(r?.msg || "Can't harvest that");
  }
  function startChop(x, z) {
    const desired = ST.tool === "stone" ? "rock" : ST.tool === "wood" ? "tree" : undefined;
    const resolved = world.resolveDoodadCell?.(x, z, desired) || { x, z, kind: world.doodadVisible(x, z) };
    x = Math.trunc(Number(resolved.x ?? x));
    z = Math.trunc(Number(resolved.z ?? z));
    const d = resolved.kind || world.doodadVisible(x, z);
    if (!d) { world.markDoodadGone?.(x, z); world.floatText?.(x, z, "Already gathered", "#d7dde7"); return; }
    if (ST.channel) {
      if (ST.channel.kind === d && Math.trunc(ST.channel.x) === Math.trunc(x) && Math.trunc(ST.channel.z) === Math.trunc(z)) return;
      world.floatText?.(x, z, "Busy", "#ffd76e");
      return;
    }
    if (cheb(x, z, world.me.x, world.me.z) > 1) {
      ST.harvestAfterWalk = { x, z, tool: d === "rock" ? "stone" : "wood" };
      world.pathToNear(x, z);
      world.floatText?.(x, z, "Moving closer", "#d7dde7");
      return;
    }
    act("harvestStart", { x, z, clientX: world.me.x, clientZ: world.me.z }).then((r) => {
      if (!r || !r.ok) {
        if (r?.reasonCode === "TOO_FAR") { ST.harvestAfterWalk = { x, z, tool: d === "rock" ? "stone" : "wood" }; world.pathToNear(x, z); }
        if (r?.reasonCode === "NO_HARVEST_TARGET" || r?.reasonCode === "HARVEST_GONE") world.markDoodadGone?.(x, z);
        world.floatText?.(x, z, harvestErrorText(r), "#ffd76e");
        return;
      }
      sfx.chop();
      const ms = Math.max(450, Number(r.ms || (d === "food" ? 900 : 1450)) || 1200);
      ST.channel = { x, z, until: performance.now() + ms, ms, kind: r.kind || d, nextFx: 0 };
      showChannel(ST.channel.kind === "tree" ? "Chopping…" : ST.channel.kind === "food" ? "Harvesting…" : "Mining…");
      paint(true);
    });
  }
  function startHomeCast() {
    if (ST.channel) return;
    const x = world.me.x, z = world.me.z;
    act("homeStart", {}).then((r) => {
      if (!r || !r.ok) return;
      ST.channel = { x, z, until: performance.now() + r.ms, ms: r.ms, kind: "home" };
      showChannel("Returning to flag…");
    });
  }
  function startWonderCast(uid) {
    if (ST.channel) return;
    const x = world.me.x, z = world.me.z;
    act("wonderStart", { uid }).then((r) => {
      if (!r || !r.ok) return;
      ST.channel = { x, z, until: performance.now() + r.ms, ms: r.ms, kind: "wonder", uid };
      showChannel("Travelling to Landmark…");
    });
  }
  function startHouseCast(uid) {
    if (ST.channel) return;
    const x = world.me.x, z = world.me.z;
    act("houseStart", { uid }).then((r) => {
      if (!r || !r.ok) return;
      ST.channel = { x, z, until: performance.now() + r.ms, ms: r.ms, kind: "house", uid };
      showChannel("Travelling to House…");
    });
  }
  function spawnWonderHere() {
    if (!ST.me) return;
    const x = Math.round(world.me.x), z = Math.round(world.me.z);
    return placeWorldWonderAt(x, z);
  }
  function adminSpawnKeep(mode = "here", at = null) {
    if (!ST.me || !isAdminPlayer()) return;
    const x = Math.round(at?.x ?? world.me.x), z = Math.round(at?.z ?? world.me.z);
    act("adminSpawnKeep", { mode, x, z, gold: mode === "ring" ? 180 : 150, hp: mode === "ring" ? 170 : 140, radius: 8 }).then((r) => {
      if (r && r.ok) {
        sfx.milestone?.();
        world.shockwave(x, z, 0xffd76e);
        ST.adminMsg = r.note || "Keep spawned.";
        say(ST.adminMsg, 1800);
        pollSoon();
        paint(true);
      }
    });
  }
  function selectAdminTool(tool = "demolish") {
    if (!isAdminPlayer()) { sfx.err(); say(t("toast.adminOnly", "Admin tools are only available to the world admin."), 1800); return; }
    const same = ST.mode === "admin" && ST.tool === "admin" && ST.adminTool === tool;
    if (same) { closeTools(); ST.adminTool = "demolish"; ST.adminMsg = ""; }
    else {
      ST.modal = null; ST.panel = null; ST.mode = "admin"; ST.tool = "admin"; ST.placing = null; ST.adminTool = tool || "demolish";
      ST.adminMsg = ST.adminTool === "spawnKeep" ? "Admin: click an empty neutral tile to spawn a Keep." : "Admin: click any object to remove it. Use Clear tile only when you intentionally want to remove land.";
      say(ST.adminMsg, 2600);
    }
    updateHints(); paint(true);
  }
  function adminDemolishAt(x = world.me.x, z = world.me.z, uid = 0, clearTile = false) {
    if (!ST.me || !isAdminPlayer()) return;
    x = Math.round(Number(x)); z = Math.round(Number(z)); uid = Math.trunc(Number(uid || 0));
    act("adminDemolishAt", { x, z, uid, clearTile: !!clearTile }).then((r) => {
      if (r && r.ok) {
        sfx.demolish?.();
        world.shockwave(r.x ?? x, r.z ?? z, 0xff705c);
        ST.adminMsg = r.note || "Admin cleanup complete.";
        say(ST.adminMsg, 1800);
        pollSoon(); paint(true);
      } else if (r) { sfx.err(); say(r.msg || t("toast.nothingToRemove", "Nothing to remove there."), 2200); }
    });
  }

  function startRedeemCast(gold) {
    if (ST.channel) return;
    const x = world.me.x, z = world.me.z;
    act("redeemStart", { gold }).then((r) => {
      if (!r || !r.ok) return;
      ST.channel = { x, z, until: performance.now() + r.ms, ms: r.ms, kind: "redeem", gold };
      showChannel("Withdrawing $CRAFTS…");
      ST.modal = null;
      paint(true);
    });
  }
  function cancelChop(silent = false) {
    if (!ST.channel) return;
    const kind = ST.channel.kind;
    ST.channel = null;
    channelEl.classList.remove("on");
    if (!silent) act(kind === "home" ? "homeCancel" : kind === "house" ? "houseCancel" : kind === "wonder" ? "wonderCancel" : kind === "redeem" ? "redeemCancel" : "harvestCancel", {});
  }
  /* drives the bar + completion; cancels if the player walks off */
  const channelT = scheduler.every("channel", 60, () => {
    if (!ST.channel) return;
    const ch = ST.channel;
    const moved = (ch.kind === "home" || ch.kind === "house" || ch.kind === "wonder" || ch.kind === "redeem" || ch.kind === "combat")
      ? (!ST.me || world.me.x !== ch.x || world.me.z !== ch.z)
      : (!ST.me || cheb(world.me.x, world.me.z, ch.x, ch.z) > 2);
    if (moved) { cancelChop(); return; }
    const now = performance.now();
    const totalMs = Math.max(1, Number(ch.ms || 1200));
    const k = Math.min(1, 1 - (ch.until - now) / totalMs);
    const fill = document.getElementById("sc-ch-fill");
    if (fill) fill.style.width = `${(k * 100).toFixed(0)}%`;
    spawnHarvestPulse(world, ch, k);
    if (now >= ch.until) {
      const { x, z, kind } = ch;
      ST.channel = null;
      channelEl.classList.remove("on");
      if (kind === "combat") {
        try { ch.run?.(); } catch {}
      } else if (kind === "home") {
        act("homeFinish", {}).then((r) => {
          if (r && r.ok && Number.isFinite(r.x) && Number.isFinite(r.z)) {
            world.hardSnapMe(r.x, r.z);
            world.shockwave(r.x, r.z, 0x14f195);
          }
        });
      } else if (kind === "house") {
        act("houseFinish", {}).then((r) => {
          if (r && r.ok && Number.isFinite(r.x) && Number.isFinite(r.z)) {
            world.hardSnapMe(r.x, r.z);
            world.shockwave(r.x, r.z, 0x14f195);
          }
        });
      } else if (kind === "wonder") {
        act("wonderFinish", {}).then((r) => {
          if (r && r.ok && Number.isFinite(r.x) && Number.isFinite(r.z)) {
            world.hardSnapMe(r.x, r.z);
            world.shockwave(r.x, r.z, 0xffd76e);
          }
        });
      } else if (kind === "redeem") {
        act("redeemFinish", {}).then((r) => { if (r && r.ok) sfx.coin(); });
      } else {
        act("harvestFinish", { x, z }).then((r) => {
          if (r && r.ok) {
            world.markDoodadGone?.(x, z);
            world.burst(x, 0.4, z, kind === "tree" ? 0x52ad58 : kind === "food" ? 0xffd76e : 0xaaa69a, 12, 0.45);
            const m = String(r.note || "").match(/\+?\s*(\d+)\s*(wood|stone|food|gold|coins?)\b/i);
            const gainText = m ? `+${m[1]} ${String(m[2]).toLowerCase()}` : (kind === "tree" ? "+wood dropped" : kind === "rock" ? "+stone dropped" : "+food");
            world.floatText?.(x, z, gainText, kind === "tree" ? "#14f195" : kind === "food" ? "#ffd76e" : "#d7dde7");
            if (r.inv && ST.me) ST.me.inv = { ...(ST.me.inv || {}), ...r.inv };
            completeWalkthroughAction(kind === "tree" ? "chop" : kind === "food" ? "farm" : "mine");
            paint(true);
            pollSoon();
          }
        });
      }
    }
  }, 60);

  /* ============================================================
     RIGHT-CLICK CONTEXT MENU — imperative floating menu
     ============================================================ */
  const ctxRuns = new Map();
  let ctxSeq = 0;
  function hideCtx() { ctxEl.style.display = "none"; ctxEl.replaceChildren(); ctxRuns.clear(); }
  function showCtx(clientX, clientY, header, items) {
    ctxEl.replaceChildren();
    ctxRuns.clear();
    if (header) { const h = document.createElement("div"); h.className = "ctx-h"; h.textContent = header; ctxEl.appendChild(h); }
    for (const it of items) {
      const b = document.createElement("button");
      if (it.danger) b.className = "danger";
      const span = document.createElement("span"); span.textContent = it.label; b.appendChild(span);
      if (it.hint) { const s = document.createElement("small"); s.textContent = it.hint; b.appendChild(s); }
      b.disabled = !!it.disabled;
      const runId = String(++ctxSeq);
      if (it.run) ctxRuns.set(runId, it.run);
      b.dataset.ctxRun = runId;
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
    // Stage 26: right-click no longer opens a second interaction system.
    // The game now has one interaction language: selected tool + left click,
    // or neutral inspect/move mode. Keep native menu suppressed on the canvas
    // but route right-click to the same top-right inspection affordance.
    if (ST.screen !== "playing") return;
    ev.preventDefault();
    hideCtx();
    if (ST.modal) return;
    const pick = world.pickFromEvent?.(ev) || { building: world.buildingFromEvent?.(ev), doodad: world.doodadFromEvent?.(ev), raw: world.cellFromEvent(ev) };
    const hitB = pick.building;
    const c = pick.cell || pick.raw || world.cellFromEvent(ev);
    if (hitB) { openBuildingInspect(hitB); return; }
    if (c) {
      const found = world.resolveDoodadCell?.(c.x, c.z);
      if (tradePostAt(c.x, c.z) || proceduralNpcAt(c.x, c.z) || found || world.doodadVisible(c.x, c.z)) openObjectPreview(worldObjectPreviewForCell(found || c));
      else world.pathTo(c.x, c.z);
    }
  }
  worldEl.addEventListener("contextmenu", onContext);
  window.addEventListener("pointerdown", (ev) => { if (!ctxEl.contains(ev.target)) hideCtx(); }, true);

  function findNearbyDoodad(kind) {
    if (!ST.me) return null;
    const px = world.me.x, pz = world.me.z;
    for (let r = 0; r <= 1; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (cheb(dx, dz, 0, 0) !== r) continue;
        const x = px + dx, z = pz + dz;
        const d = world.doodadVisible(x, z);
        if (d === kind && !world.buildPoolAt(x, z)) return { x, z };
      }
    }
    return null;
  }
  function resourceOnExactTile(x, z) {
    // Canvas resources are drawn larger than one authoritative tile. For build
    // validation, use the exact server tile only; otherwise a visually large
    // tree blocks neighboring empty cells and makes placement feel broken.
    return world.doodadAtCell?.(x, z)?.kind || false;
  }
  function setTool(t) { ST.tool = t; updateHints(); paint(); }
  function doGather(kind) {
    const next = kind === "stone" ? "stone" : "wood";
    if (ST.tool === next) { closeTools(); say(next === "wood" ? t("toast.woodToolPacked", "Wood axe packed away.") : t("toast.stoneToolPacked", "Stone pick packed away."), 1100); paint(); return; }
    selectGatherTool(next, true);
  }
  function selectGatherTool(kind, announce = false) {
    const next = kind === "stone" ? "stone" : "wood";
    ST.tool = next;
    ST.mode = "explore"; ST.placing = null;
    updateHints();
    if (announce) say(next === "wood" ? t("toast.woodToolSelected", "Wood tool selected — trees are highlighted.") : t("toast.stoneToolSelected", "Stone tool selected — rocks are highlighted."), 1400);
    paint();
  }
  function gatherDoodadFromContext(x, z, doodad) {
    const tool = doodad === "rock" ? "stone" : "wood";
    selectGatherTool(tool, false);
    if (cheb(x, z, world.me.x, world.me.z) <= 1) startChop(x, z);
    else world.pathToNear(x, z);
  }
  function claimTile(x = world.me.x, z = world.me.z) {
    act("claim", { x, z }).then((r) => { if (r && r.ok) { sfx.claim(); world.shockwave(x, z); completeWalkthroughAction("claim"); pollSoon(); } updateHints(); paint(); });
  }
  let pickupBusy = false;
  let lastPickupAt = 0;
  function localLootAt(x = world?.me?.x, z = world?.me?.z) {
    if (!world?.lootPool) return null;
    const tx = Math.trunc(Number(x));
    const tz = Math.trunc(Number(z));
    let nearest = null;
    let best = 99;
    for (const l of world.lootPool.values()) {
      const lx = Math.trunc(Number(l.x));
      const lz = Math.trunc(Number(l.z));
      const d = Math.max(Math.abs(lx - tx), Math.abs(lz - tz));
      if (d < best && d <= 1) { nearest = l; best = d; }
    }
    return nearest;
  }
  function tryPickupAt(x = world?.me?.x, z = world?.me?.z) {
    if (pickupBusy || ST.spectator || !ST.auth) return;
    const l = localLootAt(x, z);
    if (!l) return;
    const now = performance.now();
    if (now - lastPickupAt < 70) return;
    lastPickupAt = now;
    pickupBusy = true;
    act("pickup", { id: l.id, x: l.x, z: l.z }).then((r) => {
      if (r?.ok) {
        sfx.coin?.();
        if (r.lootGone || l?.id != null) {
          world.removeLoot?.(r.lootGone ?? l.id, l.x, l.z);
        }
        const note = String(r.note || "Picked up.").replace(/^Picked up\s*/i, "").replace(/[.!]$/, "").trim();
        world.floatText?.(l.x, l.z, note || "+loot", String(l.kind || "") === "gold" ? "#ffd76e" : "#14f195");
        if (r.inv && ST.me) ST.me.inv = { ...(ST.me.inv || {}), ...r.inv };
        paint(true);
        pollSoon();
      }
    }).finally(() => { pickupBusy = false; });
  }
  function selectCaptureTool() {
    if (ST.tool === "claim") { closeTools(); say(t("toast.capturePacked", "Capture flag tucked away."), 1100); paint(); return; }
    ST.tool = "claim"; ST.mode = "explore"; ST.placing = null; ST.modal = null; ST.panel = null;
    updateHints();
    say(t("toast.captureSelected", "Capture selected — click any free non-capital tile. Claiming is free; your $CRAFTS holder capacity sets the limit."), 1500);
    paint();
  }
  function doClaim() { return selectCaptureTool(); }
  function doHome() { ST.tool = "home"; updateHints(); paint(); startHomeCast(); }
  function startCombatAction(label, ms, run) {
    if (ST.channel) return;
    const x = world.me.x, z = world.me.z;
    const total = Math.max(350, Number(ms || 650));
    ST.channel = { x, z, until: performance.now() + total, ms: total, kind: "combat", nextFx: 0, run };
    showChannel(label || "Attacking…");
    paint(true);
  }
  function doFight() { if (!ST.near.g) return; const target = ST.near.g.id; startCombatAction("Attacking settler…", 520, () => act("fight", { target }).then((r) => { if (r && r.ok) sfx.hit(); })); }
  function doRaid(uid) { const target = uid != null ? uid : (ST.near.r && ST.near.r.uid); if (target == null) return; startCombatAction("Raiding Keep…", 760, () => act("raid", { uid: target }).then((r) => { if (r && r.ok) sfx.raid(); })); }
  function doDonateKeep(uid, amount = 10) { const target = uid != null ? uid : (ST.near.r && ST.near.r.uid); if (target == null) return; act("donateKeep", { uid: target, amount }).then((r) => { if (r && r.ok) { sfx.coin(); pollSoon(); paint(true); } }); }
  function doUseOrDestroy() { if (ST.near.i) return doInteract(); if (ST.near.r) return doRaid(ST.near.r.uid); }

  function buildingTooCloseClient(x, z) {
    for (const b of world.buildPool.values()) {
      if (b.kind !== "bomb" && b.kind !== "road" && cheb(b.x, b.z, x, z) <= 1) return true;
    }
    return false;
  }
  function touchesOwnLand(x, z) {
    return N4.some(([dx, dz]) => world.tileOwner.get(key(x + dx, z + dz))?.owner === ST.me?.id);
  }
  function padRadiusForDef(def) { return def?.id === "worldwonder" ? wonderRadiusClient(currentWonderSize()) : 0; }
  function padNameForDef(def) { return def?.id === "worldwonder" ? `${currentWonderSize()}×${currentWonderSize()} Wonder plaza` : "direct construction site"; }
  function padOffsetsForDef(def) {
    const r = padRadiusForDef(def);
    const out = [];
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx || dz) out.push([dx, dz]);
    }
    return out;
  }
  function padRequirementLine(def) {
    if (def?.id === "worldwonder") return `Costs ${polishCostLine(WORLD_WONDER_COST)}. Needs a clear ${currentWonderSize()}×${currentWonderSize()} plaza (${wonderTilesClient(currentWonderSize())} tiles): center plus ${wonderTilesClient(currentWonderSize()) - 1} surrounding cells. ${wonderFactsLine()}.`;
    return "Needs one empty captured tile. Step aside and clear any tree or rock on the tile first.";
  }
  function canPlaceAt(x, z) {
    const t = world.tileOwner.get(key(x, z));
    const def = LIB_BY_ID[ST.placing || ""];
    const padName = padNameForDef(def);
    if (def?.id === "worldwonder") {
      if (!ST.me) return "No settler loaded.";
      if (!cleanWonderPromptClient(ST.wonderPrompt)) return "Type one Wonder prompt first.";
      const size = currentWonderSize();
      const r = wonderRadiusClient(size);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const sx = x + dx, sz = z + dz;
        const st = world.tileOwner.get(key(sx, sz));
        if (st && st.owner !== ST.me.id) return `The ${size}×${size} Wonder plaza cannot overlap another player's land.`;
        if (world.buildPoolAt(sx, sz)) return `The ${size}×${size} Wonder plaza is blocked by another building.`;
        if (tradePostAt(sx, sz)) return "A public trade post sits in that Wonder plaza.";
      }
      return null;
    }
    if (!t || !ST.me || t.owner !== ST.me.id) return "Build on an empty tile you captured.";
    if (def?.id === "road") return "Road building is disabled in this build.";
    if (tradePostAt(x, z)) return "A trade post occupies this tile.";
    if (world.buildPoolAt(x, z)) return "Occupied.";
    if (resourceOnExactTile(x, z)) return "Clear the tree or rock on the center tile first.";
    if (world.me.x === x && world.me.z === z) return "Step aside first.";
    for (const [dx, dz] of padOffsetsForDef(def)) {
      const sx = x + dx, sz = z + dz;
      const st = world.tileOwner.get(key(sx, sz));
      if (!st || st.owner !== ST.me.id) return `Claim the full ${padName} first.`;
      if (world.buildPoolAt(sx, sz)) return `The ${padName} is blocked by another building.`;
      if (resourceOnExactTile(sx, sz)) return `Clear trees and rocks from the ${padName} first.`;
      if (tradePostAt(sx, sz)) return `A public trade post sits in that ${padName}.`;
    }
    return null;
  }

  function neutralKeepNear(x, z) {
    for (const b of world.buildPool.values()) {
      if (b && b.kind === "keep" && Number(b.owner || 0) === 0 && cheb(b.x, b.z, x, z) <= 1) return b;
    }
    return null;
  }
  function isNeutralKeepSiegeTile(x, z) {
    const t = world.tileOwner.get(key(x, z));
    return !!t && Number(t.owner || 0) === 0 && !!neutralKeepNear(x, z);
  }
  function canCastBombAt(x, z, includeResources = true) {
    const spec = destroySpec();
    if (!ST.me) return "No settler loaded.";
    const tile = world.tileOwner.get(key(x, z));
    const ownTile = !!tile && tile.owner === ST.me.id;
    const keepPad = isNeutralKeepSiegeTile(x, z);
    if (!tile || (!ownTile && !keepPad)) return "Deploy tools on your territory or the neutral 3×3 siege yard around a Keep.";
    if (world.buildPoolAt(x, z)) return "Something is already standing here.";
    if (resourceOnExactTile(x, z)) return "Clear trees and rocks before placing a tool.";
    if (tradePostAt(x, z)) return "Merchant says no boom on the welcome mat.";
    if (includeResources && craftedToolCount(spec.id) <= 0) return `Craft a ${spec.name} first.`;
    return null;
  }
  function mapOwnerInfo(ownerId) {
    return (ST.map?.players || []).find((p) => p.id === ownerId) || null;
  }
  function ownerMainIslandHasFromMap(ownerId, x, z) {
    const mp = mapOwnerInfo(ownerId);
    if (!mp || !ST.map?.tiles?.length) return true; // Unknown means do not promise a recapture.
    const ownerTiles = new Map();
    for (const t of ST.map.tiles) if (t.owner === ownerId) ownerTiles.set(key(t.x, t.z), t);
    const startK = key(mp.spawnX, mp.spawnZ), goalK = key(x, z);
    if (!ownerTiles.has(startK)) return false;
    const q = [[mp.spawnX, mp.spawnZ]], seen = new Set([startK]);
    while (q.length && seen.size < 20000) {
      const [cx, cz] = q.shift();
      if (key(cx, cz) === goalK) return true;
      for (const [dx, dz] of N4) {
        const nk = key(cx + dx, cz + dz);
        if (seen.has(nk) || !ownerTiles.has(nk)) continue;
        seen.add(nk); q.push([cx + dx, cz + dz]);
      }
    }
    return false;
  }

  function buildTilePreviewForCell(c) {
    if (!c || !ST.me) return null;
    return { kind: "buildTile", x: c.x, z: c.z, name: "Build site", biome: biomeAt(c.x, c.z).name };
  }
  function buildTileProblem(c) {
    if (!c || !ST.me) return "No tile selected";
    const t = world.tileOwner.get(key(c.x, c.z));
    if (!t || Number(t.owner || 0) !== Number(ST.me.id)) return "Need a captured tile";
    if (capitalBlocksPlayerTerritory(c.x, c.z)) return "Capital reserve";
    if (world.buildPoolAt(c.x, c.z)) return "Tile occupied";
    if (resourceOnExactTile(c.x, c.z)) return "Clear the resource first";
    return "";
  }
  function canOpenBuildTile(c) { return !buildTileProblem(c); }
  function claimableHere(x, z) {
    const t = world.tileOwner.get(key(x, z));
    if (!ST.me || t) return false;
    if (capitalBlocksPlayerTerritory(x, z)) return false;
    const b = world.buildPoolAt(x, z);
    return !b;
  }
  function captureTargetHere(x, z) {
    if (!ST.me) return false;
    const t = world.tileOwner.get(key(x, z));
    if (!t) return claimableHere(x, z);
    return false; // player-owned territory is protected; expansion happens into open frontier.
  }
  function eachVisibleCell(fn) {
    for (const [, c] of world.cells) fn(c.cx, c.cz);
  }
  function updateHints() {
    if (ST.screen !== "playing" || !ST.me || ST.modal) { world.setHintCells([]); world.hideBuildGhost(); return; }
    const tool = ST.tool, mode = ST.mode;
    const wantsScan = tool === "wood" || tool === "stone" || tool === "claim"
      || tool === "spawn" || tool === "siege" || tool === "use"
      || mode === "build" || mode === "place" || tool === "build";
    if (!wantsScan) { world.setHintCells([]); if (mode !== "place") world.hideBuildGhost(); return; }
    const cells = [];
    const push = (x, z, color, opacity = 0.20) => cells.push({ x, z, color, opacity });
    if (ST.tool === "wood" || ST.tool === "stone") {
      const want = ST.tool === "wood" ? "tree" : "rock";
      eachVisibleCell((x, z) => {
        const d = world.doodadVisible(x, z);
        if (d === want && !world.buildPoolAt(x, z)) push(x, z, d === "tree" ? 0x14f195 : 0x7dcfe8, 0.24);
      });
    } else if (ST.tool === "build") {
      eachVisibleCell((x, z) => {
        const problem = buildTileProblem({ x, z });
        if (!problem) push(x, z, 0x14f195, 0.20);
        else if (problem === "Need a captured tile" || problem === "Tile occupied") push(x, z, 0xd6604f, 0.10);
      });
    } else if (ST.tool === "claim") {
      eachVisibleCell((x, z) => {
        if (claimableHere(x, z)) push(x, z, 0xffe2a8, 0.22);
        else if (captureTargetHere(x, z)) push(x, z, 0xffb36c, 0.18);
      });
    } else if (ST.tool === "spawn") {
      eachVisibleCell((x, z) => { if (!canCastBombAt(x, z, false)) push(x, z, 0xffd76e, 0.24); });
    } else if (ST.tool === "siege") {
      eachVisibleCell((x, z) => { const b = world.buildPoolAt(x, z); if (b && ST.me && b.owner !== ST.me.id) push(x, z, b.kind === "bomb" ? 0xffd76e : 0xff7b6b, 0.26); });
    } else if (ST.tool === "use") {
      eachVisibleCell((x, z) => {
        const b = world.buildPoolAt(x, z), def = b && LIB_BY_ID[b.kind];
        if (b && b.kind === GOLD_MINE_KIND) push(x, z, 0xffd76e, 0.24);
        if (b && b.owner === ST.me.id && def?.use?.k === "trade") push(x, z, 0xffd76e, 0.20);
      });
    } else if (ST.mode === "build" || ST.mode === "place") {
      const placingWonder = ST.placing === "worldwonder";
      eachVisibleCell((x, z) => {
        if (!placingWonder) {
          const t = world.tileOwner.get(key(x, z));
          if (!t || t.owner !== ST.me.id) return;
        }
        const bad = canPlaceAt(x, z);
        if (!bad) push(x, z, placingWonder ? 0xffd76e : 0x14f195, placingWonder ? 0.24 : 0.18);
      });
    }
    if (ST.mode !== "place") world.hideBuildGhost();
    world.setHintCells(cells);
  }

  /* ---------- inspect / preview intent ---------- */
  function worldObjectPreviewForCell(c) {
    if (!c) return null;
    const resolvedDoodad = world.resolveDoodadCell?.(c.x, c.z);
    const d = resolvedDoodad?.kind || world.doodadVisible(c.x, c.z);
    if (d) {
      const rx = resolvedDoodad?.x ?? c.x, rz = resolvedDoodad?.z ?? c.z;
      return { kind: d === "food" ? "food" : d === "rock" ? "rock" : "tree", x: rx, z: rz, biome: biomeAt(rx, rz).name };
    }
    if (tradePostAt(c.x, c.z)) return { kind: "trade", x: c.x, z: c.z, name: "Trade Post", biome: biomeAt(c.x, c.z).name };
    const npc = proceduralNpcAt(c.x, c.z);
    if (npc) return { kind: "npc", x: c.x, z: c.z, name: npc.name, title: npc.title, role: npc.role, hp: npc.hp, maxHp: npc.hp, coins: npc.coins, attack: npc.attack, resource: npc.resource, resourceAmount: npc.resourceAmount, biome: biomeAt(c.x, c.z).name };
    return { kind: "tile", x: c.x, z: c.z, biome: biomeAt(c.x, c.z).name };
  }
  function openObjectPreview(preview) {
    if (!preview) return;
    ST.objectPreview = preview;
    ST.inspect = null;
    ST.modal = null;
    ST.panel = "object";
    paint(true);
  }
  function openCapitalService(building) {
    const info = capitalServiceForBuilding(building);
    if (!info) return false;
    ST.capitalService = { service: info.id, uid: building.uid, name: building.nm || info.title, x: building.x, z: building.z };
    ST.objectPreview = null;
    ST.inspect = null;
    ST.panel = "capital";
    ST.modal = null;
    ST.inspectDraft = null;
    ST.serviceAccess = "";
    paint(true);
    return true;
  }
  function openBuildingInspect(hitB) {
    if (!hitB) return;
    if (hitB.b?.capital && openCapitalService(hitB.b)) return;
    ST.inspect = hitB.uid;
    ST.objectPreview = null;
    ST.capitalService = null;
    ST.panel = "inspect";
    ST.modal = null;
    ST.inspectDraft = null;
    paint(true);
  }
  function hoverIntentForCell(c) {
    if (!c) return "walk";
    const b = world.buildPoolAt(c.x, c.z);
    if (b) return "building";
    const d = world.doodadVisible(c.x, c.z);
    if (d) return d;
    if (tradePostAt(c.x, c.z)) return "trade";
    if (proceduralNpcAt(c.x, c.z)) return "npc";
    return "tile";
  }

  function tileHoverInfo(c) {
    if (!c) return "";
    const b = world.buildPoolAt(c.x, c.z);
    const q = ST.players.find((p) => p.x === c.x && p.z === c.z);
    if (ST.tool === "spawn") {
      const spec = destroySpec();
      const bad = canCastBombAt(c.x, c.z, false);
      return bad ? tipText(`${spec.name} target?`, bad) : tipText(`${spec.name}-ready target`, `Click here to deploy it. Deployables can be placed on your territory or neutral Keep siege tiles if the tile is not occupied.`);
    }
    if (ST.tool === "siege") {
      if (b && ST.me && b.owner !== ST.me.id) return tipText(`Siege ${LIB_BY_ID[b.kind]?.name || b.kind}`, cheb(b.x, b.z, world.me.x, world.me.z) <= 1 ? "In siege range. Manual siege now does 1 structure damage; deploy tools for serious damage." : "Click to walk beside it first.");
      return "";
    }
    if (ST.tool === "build") {
      const bad = buildTileProblem(c);
      return bad ? tipText("Can't build here", bad) : tipText("Build site", "Click to choose a building for this captured tile.");
    }
    if (ST.mode === "place") {
      const def = ST.placing ? LIB_BY_ID[ST.placing] : null;
      const bad = canPlaceAt(c.x, c.z);
      return bad ? tipText(`Can't place ${def?.name || "building"}`, bad) : tipText(`Place ${def?.name || "building"}`, padRequirementLine(def));
    }
    if (b) {
      const def = LIB_BY_ID[b.kind];
      let extra = def?.id === "worldwonder" ? " · Landmark resists manual siege" : "";
      if (b.kind === "keep") extra += ` · vault ${Math.floor(Number(b.stored || 0))} coins`;
      const ownerName = b.owner === 0 && b.kind === "keep" ? "Neutral" : (b.owner === ST.me?.id ? "Your" : `${b.ownerName || "Unknown"}'s`);
      return tipText(`${ownerName} ${def?.name || b.kind}`, `Level ${b.level || 1} · ${Math.ceil(b.hp || 0)}/${b.maxHp || 0} HP${extra}`);
    }
    const d = world.doodadVisible(c.x, c.z);
    if (d === "tree") return tipText("Tree", "Click to inspect. Select axe to chop for wood.");
    if (d === "rock") return tipText("Rock", "Click to inspect. Select pickaxe to mine for stone.");
    if (d === "food") return tipText("Crop patch", "Click to inspect or harvest. Food restores health over time.");
    if (q) return tipText(q.name || "Settler", `Level ${q.level || "?"} · click to inspect or walk toward.`);
    if (tradePostAt(c.x, c.z)) return tipText("Trade Post", "Stand beside it to withdraw coins into $CRAFTS or open player offers.");
    const npc = proceduralNpcAt(c.x, c.z);
    if (npc) return tipText(npc.name, `${npc.title || "Wanderer"} · carries ${npc.coins || 0} coins · sword or donate when nearby.`);
    if (ST.tool === "claim") {
      if (capitalBlocksPlayerTerritory(c.x, c.z)) return tipText("Capital reserve", "The capital plaza is public land. Build settlements outside the service ring.");
      if (claimableHere(c.x, c.z)) return tipText("Claimable tile", "Click it, walk there, and capture it.");
      if (captureTargetHere(c.x, c.z)) return tipText("Claimable frontier", "Stand on this open tile to claim it.");
    }
    if (ST.tool === "use" && b && b.kind === GOLD_MINE_KIND) return tipText("Coin Mint", "Click to walk beside it and exchange purse coins at fixed rate.");
    // Empty terrain hover tooltips were noisy; keep the hover marker, but only
    // show tooltips for actionable/contextual cells.
    return "";
  }

  function onPointerMove(ev) {
    if (ST.screen !== "playing") return;
    const pick = world.pickFromEvent?.(ev) || { primary: "terrain", building: world.buildingFromEvent?.(ev), doodad: world.doodadFromEvent?.(ev), raw: world.cellFromEvent(ev) };
    const primary = String(pick.primary || (pick.player ? "player" : pick.npc ? "npc" : pick.trade ? "trade" : pick.doodad ? "doodad" : pick.building ? "building" : "terrain"));
    const hitB = primary === "building" ? pick.building : null;
    const hitD = primary === "doodad" ? pick.doodad : null;
    const hitP = primary === "player" ? pick.player : null;
    const rawCell = pick.raw || world.cellFromEvent(ev);
    const c = pick.cell || (hitB?.b ? { x: hitB.b.x, z: hitB.b.z } : hitD ? { x: hitD.x, z: hitD.z } : rawCell);
    if (c) { ST.hoverCellX = c.x; ST.hoverCellZ = c.z; }
    if (!c) { ST.hoverIntent = "walk"; syncToolCursor(); world.hoverMarker.visible = false; world.hideBuildGhost(); hideTip(); return; }
    ST.hoverIntent = hitB ? "building" : (hitD?.kind || hoverIntentForCell(c));
    syncToolCursor();
    world.hoverMarker.visible = true; world.hoverMarker.position.x = c.x; world.hoverMarker.position.z = c.z;
    const mat = world.hoverMarker.material;
    if (ST.tool === "build") {
      const bad = buildTileProblem(c);
      mat.color.set(bad ? 0xd6604f : 0x14f195);
      world.hideBuildGhost();
    } else if (ST.mode === "place" || (ST.placing === "worldwonder" && ST.tool === "wonder")) {
      const bad = canPlaceAt(c.x, c.z);
      mat.color.set(bad ? 0xd6604f : 0x14f195);
      world.showBuildGhost(c.x, c.z, !bad);
    } else {
      world.hideBuildGhost();
      if (ST.mode === "admin") mat.color.set(ST.adminTool === "spawnKeep" ? 0xffd76e : 0xd6604f);
      else if (ST.mode === "demolish") mat.color.set(0xd6604f);
      else if (ST.tool === "claim") mat.color.set(claimableHere(c.x, c.z) ? 0x14f195 : 0xffe2a8);
      else mat.color.set(0x14f195);
    }
    if (ST.panel === "inspect" || ST.panel === "object") hideTip();
    else showTip(tileHoverInfo(c), ev);
  }
  function onPointerDown(ev) {
    if (ev.button === 2) { ev.preventDefault(); return; }
    if (ST.screen !== "playing" || ST.modal || ST.updateRequired) return;
    sfx.resume();
    const pick = world.pickFromEvent?.(ev) || { primary: "terrain", building: world.buildingFromEvent?.(ev), doodad: world.doodadFromEvent?.(ev), raw: world.cellFromEvent(ev) };
    const primary = String(pick.primary || (pick.player ? "player" : pick.npc ? "npc" : pick.trade ? "trade" : pick.doodad ? "doodad" : pick.building ? "building" : "terrain"));
    const hitB = primary === "building" ? pick.building : null;
    const hitD = primary === "doodad" ? pick.doodad : null;
    const hitP = primary === "player" ? pick.player : null;
    const rawCell = pick.raw || world.cellFromEvent(ev);
    const c = pick.cell || (hitB?.b ? { x: hitB.b.x, z: hitB.b.z } : hitD ? { x: hitD.x, z: hitD.z } : rawCell);
    if (hitB?.b?.capital) { openCapitalService(hitB.b); return; }
    if (ST.mode === "admin" && ST.tool === "admin" && isAdminPlayer() && c) {
      if (ST.adminTool === "spawnKeep") adminSpawnKeep("here", c);
      else adminDemolishAt(c.x, c.z, hitB?.uid || 0, false);
      return;
    }
    if (ST.tool === "sword") {
      if (hitB) {
        if (cheb(hitB.b.x, hitB.b.z, world.me.x, world.me.z) <= 1) doRaid(hitB.uid);
        else world.pathToNear(hitB.b.x, hitB.b.z);
        return;
      }
      if (c) {
        const targetPlayer = hitP?.player || (ST.players || []).find((q) => q && q.id !== ST.me?.id && Math.trunc(Number(q.x)) === Math.trunc(Number(c.x)) && Math.trunc(Number(q.z)) === Math.trunc(Number(c.z)));
        if (targetPlayer) {
          const tx = Math.trunc(Number(targetPlayer.x ?? c.x)), tz = Math.trunc(Number(targetPlayer.z ?? c.z));
          if (cheb(tx, tz, world.me.x, world.me.z) <= 1) act("fight", { targetId: targetPlayer.id }).then((r) => { if (r?.ok) { sfx.hit(); pollSoon(); } });
          else world.pathToNear(tx, tz);
          return;
        }
        sfx.err(); say(t("toast.swordSelected", "Sword selected — click a Keep, building, or nearby settler."), 1500);
        return;
      }
    }
    if (ST.tool === "build" && c) {
      const problem = buildTileProblem(c);
      if (problem) { sfx.err(); world.floatText?.(c.x, c.z, problem, "#ff8a5e"); showTip(tipText("Can't build here", problem), ev); return; }
      openObjectPreview(buildTilePreviewForCell(c));
      return;
    }
    if (((ST.mode === "place" && ST.placing) || (ST.placing === "worldwonder" && ST.tool === "wonder")) && c) {
      const bad = canPlaceAt(c.x, c.z);
      if (bad) { sfx.err(); say(bad); return; }
      if (ST.placing === "worldwonder") { placeWorldWonderAt(c.x, c.z); return; }
      act("place", { kind: ST.placing, x: c.x, z: c.z }).then((r) => { if (r && r.ok) { sfx.build(); world.shockwave(c.x, c.z, 0xffe2a8); updateHints(); } });
      return;
    }
    if ((ST.tool === "wood" || ST.tool === "stone") && c) {
      const want = ST.tool === "wood" ? "tree" : "rock";
      const found = (hitD && (!want || hitD.kind === want) ? hitD : null) || world.resolveDoodadCell?.(c.x, c.z, want);
      const d = found?.kind || world.doodadVisible(c.x, c.z);
      if (d && d !== want) { sfx.err(); say(ST.tool === "wood" ? t("toast.useStonePick", "Use the stone pick for rocks.") : t("toast.useWoodAxe", "Use the wood axe for trees.")); return; }
      if ((found || d === want) && !world.buildPoolAt(found?.x ?? c.x, found?.z ?? c.z)) {
        startChop(found?.x ?? c.x, found?.z ?? c.z);
        return;
      }
    }
    if (ST.tool === "none" && c) {
      if (hitB) { openBuildingInspect(hitB); return; }
      if (hitP?.player) { ST.inspectPlayer = hitP.player; ST.modal = "player"; paint(true); return; }
      const found = hitD || world.resolveDoodadCell?.(c.x, c.z);
      const d = found?.kind || world.doodadVisible(c.x, c.z);
      if (d && !world.buildPoolAt(found?.x ?? c.x, found?.z ?? c.z)) { openObjectPreview(worldObjectPreviewForCell(found || c)); return; }
      if (tradePostAt(c.x, c.z) || proceduralNpcAt(c.x, c.z)) { openObjectPreview(worldObjectPreviewForCell(c)); return; }
    }
    if (hitB?.b?.capital && ST.tool !== "none") { openBuildingInspect(hitB); return; }
    if (ST.tool === "spawn" && c) {
      const bad = canCastBombAt(c.x, c.z, false);
      if (bad) { sfx.err(); say(bad); return; }
      plantDestroy(c.x, c.z);
      return;
    }
    if ((ST.tool === "siege" || ST.tool === "sword") && c) {
      const target = hitB?.b || world.buildPoolAt(c.x, c.z);
      if (!target || !ST.me || target.owner === ST.me.id) { sfx.err(); say(t("toast.swordTargets", "Sword targets Keeps, buildings, and settlers.")); return; }
      if (cheb(target.x, target.z, world.me.x, world.me.z) <= 1) doRaid(target.uid);
      else world.pathToNear(target.x, target.z);
      return;
    }
    if (ST.tool === "use" && hitB) {
      if (cheb(hitB.b.x, hitB.b.z, world.me.x, world.me.z) <= 1) useBuildingClient(hitB.uid);
      else { ST.useAfterWalkUid = hitB.uid; world.pathToNear(hitB.b.x, hitB.b.z); }
      return;
    }
    if (ST.tool === "use" && c) {
      if (tradePostAt(c.x, c.z)) {
        if (cheb(c.x, c.z, world.me.x, world.me.z) <= 1) openTrade();
        else world.pathToNear(c.x, c.z);
        return;
      }
    }
    if (ST.tool === "claim" && c && captureTargetHere(c.x, c.z)) {
      if (world.me.x === c.x && world.me.z === c.z) claimTile(c.x, c.z);
      else world.pathTo(c.x, c.z);
      return;
    }
    if (ST.mode === "demolish" && hitB) {
      if (ST.me && hitB.b.owner === ST.me.id) act("demolish", { uid: hitB.uid }).then((r) => { if (r && r.ok) { sfx.demolish(); world.removeBuild?.(hitB.uid, true); ST.inspect = null; ST.objectPreview = null; pollSoon(); paint(true); } else if (r) { sfx.err(); world.floatText?.(hitB.b.x, hitB.b.z, r.msg || "Can't demolish", "#ff8a5e"); } });
      else { sfx.err(); world.floatText?.(hitB.b.x, hitB.b.z, t("toast.notYourBuilding", "Not your building."), "#ff8a5e"); }
      return;
    }
    if (hitB) { openBuildingInspect(hitB); return; }
    if (c) {
      const found = world.resolveDoodadCell?.(c.x, c.z);
      if (tradePostAt(c.x, c.z) || proceduralNpcAt(c.x, c.z) || found || world.doodadVisible(c.x, c.z)) openObjectPreview(worldObjectPreviewForCell(found || c));
      else world.pathTo(c.x, c.z);
    }
  }
  function onWheel(ev) {
    if (ST.screen !== "playing") return;
    const blockedByUi = ev.target?.closest?.(".scv-hud,.chrome-actions,.utility-pop,.modal,.settings-panel,.action-stack,.bottom-bar,.chat,.minimap");
    if (blockedByUi) return;
    ev.preventDefault();
    world.zoom(ev.deltaY > 0 ? CAMERA_ZOOM_STEP : -CAMERA_ZOOM_STEP);
  }

  const heldMoveKeys = new Set();
  const keyboardMoveAccumulator = createMovementAccumulator({ stepMs: DEFAULT_KEYBOARD_STEP_MS, directionBoostRatio: 0.4, maxStepsPerTick: 1 });
  function clearHeldMoveKeys() { heldMoveKeys.clear(); keyboardMoveAccumulator.stop(performance.now()); }
  function keyboardMovementAllowed() {
    if (ST.screen !== "playing" || ST.updateRequired || ST.modal) return false;
    const tag = document.activeElement?.tagName;
    return !(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");
  }
  function updateKeyboardMoveIntent() {
    const v = keyboardMovementAllowed() ? movementVectorFromKeys(heldMoveKeys) : { x: 0, z: 0 };
    keyboardMoveAccumulator.setIntent(v);
    // Facing/animation intent should be immediate; the grid step remains rate-limited.
    try { world.setFacing?.(v.x, v.z); world.setWalking?.(!!(v.x || v.z)); } catch {}
    return !!(v.x || v.z);
  }
  function tryKeyboardMove(ev) {
    return updateKeyboardMoveIntent();
  }
  function onKeyUp(ev) {
    if (!isMoveKey(ev.key)) return;
    const k = normalizeMoveKey(ev.key);
    if (k) heldMoveKeys.delete(k);
    updateKeyboardMoveIntent();
  }
  function onKey(ev) {
    if (ST.screen !== "playing" || ST.updateRequired) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (ev.key === "F8") { ev.preventDefault(); const on = perf.toggle(); say(on ? t("toast.perfOn", "Performance overlay on") : t("toast.perfOff", "Performance overlay off"), 900); return; }
    const k = ev.key.toLowerCase();
    if (isMoveKey(ev.key)) {
      const mk = normalizeMoveKey(ev.key);
      if (mk) heldMoveKeys.add(mk);
      ev.preventDefault();
      tryKeyboardMove(ev);
      return;
    }
    if (k === "-" || k === "_") stepCameraZoom(CAMERA_ZOOM_STEP);
    else if (k === "+" || k === "=") stepCameraZoom(-CAMERA_ZOOM_STEP);
    else if (k === "0") resetCameraView();
    else if (k === "1") doGather("wood");
    else if (k === "2") doGather("stone");
    else if (k === "3" || k === "b") selectBuildTool();
    else if (k === "4") selectDemolishTool();
    else if (k === "5" || k === "c" || k === " ") selectCaptureTool();
    else if (k === "6" || k === "x") doAttackTool();
    else if (k === "e" || k === "t") doUseTool();
    else if (k === "i") togglePanel("bank");
    else if (k === "r") doUseTool();
    else if (ev.key === "Enter") { ST.chatOpen = true; paint(true); focusChatInputSoon(); }
    else if (k === "j") openQuests();
    else if (k === "o") openOptions();
    else if (k === "k") togglePanel("skills");
    else if (k === "h" || k === "?") openOptions();
    else if (ev.key === "Escape") {
      cancelChop();
      const hadOverlay = !!(ST.modal || ST.panel || ST.inspect || ST.inspectPlayer || ST.wonderViewUid);
      ST.modal = null; ST.inspect = null; ST.inspectPlayer = null; ST.wonderViewUid = null;
      ST.panel = hadOverlay ? null : "settings";
      ST.mode = "explore"; ST.placing = null; ST.tool = "none";
      world.walkQueueClear(); clearHeldMoveKeys(); world.hideBuildGhost(); updateHints(); paint(true);
    }
  }
  worldEl.addEventListener("pointermove", onPointerMove);
  worldEl.addEventListener("pointerleave", () => { ST.hoverIntent = "walk"; syncToolCursor(); hideTip(); world.hoverMarker.visible = false; world.hideBuildGhost(); });
  worldEl.addEventListener("pointerdown", onPointerDown);
  worldEl.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearHeldMoveKeys);

  function handleDelegatedUiClick(action, el, ev) {
    switch (action) {
      case "join-game": return joinGame();
      case "spectate-game": return spectateGame();
      case "forget-session": return forgetLocalSettler();
      case "toggle-panel": return togglePanel(readStr(el, "panel"));
      case "explore-mode": closeTools(); clearHeldMoveKeys(); ST.panel = null; ST.modal = null; say("Move mode — click the map, use WASD/arrows, or hold two directions for diagonal movement.", 1800); paint(true); return;
      case "open-options":
      case "open-more": return openOptions();
      case "open-bank": advanceWalkthroughAction("bank"); return openBankPanel(false);
      case "select-wonder": advanceWalkthroughAction("wonder"); return selectWonderTool();
      case "select-craft": return selectCraftTool();
      case "tools-toggle": return toggleToolsRibbon();
      case "gather-wood": return doGather("wood");
      case "gather-stone": return doGather("stone");
      case "claim":
      case "capture-tool": return selectCaptureTool();
      case "select-build": advanceWalkthroughAction("build"); return selectBuildTool();
      case "demolish-tool": return selectDemolishTool();
      case "teleport-toggle": return toggleTeleportRibbon();
      case "siege-tool": return doAttackTool();
      case "select-spawn-tool": return selectDeployTool();
      case "use-tool": advanceWalkthroughAction("use"); return doUseTool();
      case "select-building": return selectBuilding(readStr(el, "id"));
      case "make-bomb": return say("Bombs are unavailable. Use Attack or Raid pressure instead.", 2400);
      case "craft-recipe": return say("Crafting is unavailable. Gather, capture tiles, and build from the Hammer menu.", 2200);
      case "select-spawn": return selectDeploy(readStr(el, "id"));
      case "home-cast": return startHomeCast();
      case "use-pack-slot": return say("Packs are unavailable. Use the main toolbelt actions instead.", 2200);
      case "place-building": {
        const id = readStr(el, "id");
        if (id === "worldwonder") {
          if (!ST.wonderRecipe) return openWonderPlanner("Generate the AI plan first, then found the Wonder in a valid wild location.");
          enterWonderPlacement();
          return;
        }
        if (!ST.objectPreview || ST.objectPreview.kind !== "buildTile") { sfx.err(); say("Click a captured tile first, then choose what to build from the right panel.", 2400); return; }
        const target = ST.objectPreview;
        return act("place", { kind: id, x: target.x, z: target.z }).then((r) => {
          if (r?.ok) { sfx.build(); world.shockwave(target.x, target.z, 0xffe2a8); ST.objectPreview = null; ST.panel = null; closeTools(); pollSoon(); paint(true); say(r.note || "Construction started.", 1800); }
        });
      }
      case "foundation-build": return say("Select Hammer, click an empty captured tile, then choose a building from the right panel.", 2600);
      case "build-tile-choice": {
        const kind = readStr(el, "id");
        const target = ST.objectPreview || {};
        if (target.kind !== "buildTile") { sfx.err(); return say("Select an empty owned tile with the Hammer first.", 2200); }
        return act("place", { kind, x: target.x, z: target.z }).then((r) => {
          if (r?.ok) { sfx.build(); world.shockwave(target.x, target.z, 0xffe2a8); ST.objectPreview = null; ST.panel = null; closeTools(); pollSoon(); paint(true); say(r.note || "Construction started.", 1800); }
        });
      }
      case "unequip": return say("Equipment is unavailable right now.", 2200);
      case "pack-trophy": return say(`${readStr(el, "name", "Trophy")} — a trophy of the frontier.`);
      case "pack-drop": return say("Packs are unavailable. Use the main toolbelt actions instead.", 2200);
      case "pack-spawn-select": ST.destroying = readStr(el, "id"); return selectDeployTool();
      case "pack-equip": return say("Equipment is unavailable right now.", 2200);
      case "learn-skill": return say("Skills are unavailable right now.", 2200);
      case "player-walk": if (ST.inspectPlayer) { const q = ST.inspectPlayer; ST.modal = null; ST.inspectPlayer = null; paint(); world.pathTo(q.x, q.z); } return;
      case "player-close": ST.modal = null; ST.inspectPlayer = null; paint(); return;
      case "trade-tab": if (!ST.serviceAccess) return directServiceHint("market"); ST.tradeTab = readStr(el, "tab", "market"); if (ST.tradeTab === "bank") loadBankStatus(); paint(); return;
      case "post-offer": return say("Player escrow trading is unavailable right now.", 2200);
      case "cancel-offer": return say("Player escrow trading is unavailable right now.", 2200);
      case "accept-offer": return say("Player escrow trading is unavailable right now.", 2200);
      case "withdraw-safe": return say("Use the Bank building or Capital Bank for withdrawals.", 2200);
      case "redeem-main": return say("Use the Bank building for token services.", 2200);
      case "inspect-close": return closeInspectPanel();
      case "inspect-rename": return customizeInspect({ nm: (document.getElementById("sc-rename") || {}).value || "" });
      case "inspect-wonder-view": { ST.wonderViewUid = ST.inspect; ST.wonderViewError = ""; ST.modal = "wonder-view"; ST.panel = null; paint(true); mountWonderViewerSoon(); return; }
      case "inspect-share": return shareInspectedBuildingInChat();
      case "inspect-use": return useBuildingClient(ST.inspect);
      case "inspect-bank-open": return openBankFromInspect();
      case "inspect-customizer-open": return openCustomizerFromInspect(ST.inspect);
      case "inspect-bank-deposit-disabled": return say("Open the bank screen to prepare and copy your deposit address.", 2200);
      case "inspect-bank-withdraw-disabled": return say("Open the bank screen to review amount, wallet, and withdrawal status.", 2200);
      case "inspect-raid": return doRaid(ST.inspect);
      case "inspect-donate-keep": return doDonateKeep(ST.inspect, 10);
      case "inspect-upgrade": return act("upgrade", { uid: ST.inspect });
      case "inspect-repair": return act("repair", { uid: ST.inspect });
      case "inspect-demolish": return act("demolish", { uid: ST.inspect }).then((r) => { if (r && r.ok) { sfx.demolish(); closeInspectPanel(); } });
      case "inspect-walk-near": { const uid = ST.inspect || ST.wonderViewUid; const b = uid ? world.buildPool.get(uid) : null; closeInspectPanel(); ST.modal = null; ST.wonderViewUid = null; if (b) world.pathToNear(b.x, b.z); return; }
      case "intro-submit": return submitIntroName();
      case "invite-gift-accept": ST.modal = null; ST.inviteGift = null; maybeStartWalkthrough(true); world.refreshOwnRig?.(); paint(true); return;
      case "modal-close": ST.modal = null; ST.wonderViewUid = null; ST.wonderViewError = ""; stopWonderViewer(); paint(true); return;
      case "panel-close": ST.panel = null; ST.serviceAccess = ""; paint(true); return;
      case "char-sync": world.refreshOwnRig?.(); say(t("toast.characterSynced", "Character synced."), 900); return;
      case "bank-refresh": return loadBankStatus();
      case "bank-deposit": return bankAction("deposit");
      case "bank-scan": return bankAction("scan");
      case "bank-withdraw-request": return bankAction("withdraw", { amountUi: Number((document.getElementById("sc-bank-withdraw-ui") || {}).value) });
      case "toggle-music": return toggleMusicSound();
      case "start-music": return startMusicNow();
      case "toggle-ui-sound": return toggleUiSound();
      case "ui-scale-step": return stepUiScale(readStr(el, "kind", "ui"), readNum(el, "delta", 0));
      case "ui-scale-set": return setUiScale(readStr(el, "kind", "ui"), readNum(el, "value", 1), true);
      case "ui-scale-reset": return resetUiScale(readStr(el, "kind", "all"));
      case "camera-zoom-out": return stepCameraZoom(CAMERA_ZOOM_STEP);
      case "camera-zoom-in": return stepCameraZoom(-CAMERA_ZOOM_STEP);
      case "camera-zoom-reset": return resetCameraView();
      case "camera-map-view": return setCameraZoom(2.05, true);
      case "open-world-map": ST.modal = "worldmap"; paint(true); return;
      case "worldmap-click": return handleWorldMapClick(ev);
      case "camera-zoom-set": return setCameraZoom(readNum(el, "value", 1), true);
      case "camera-rotate-left": return stepCameraYaw(-CAMERA_ROTATION_STEP);
      case "camera-rotate-right": return stepCameraYaw(CAMERA_ROTATION_STEP);
      case "camera-rotation-set": return setCameraYaw(readNum(el, "value", Math.PI / 4) * Math.PI / 180, true);
      case "visual-comfort": return setVisual({ warmth: 0.66, texture: 0.18, quality: "balanced", motion: "smooth" });
      case "time-auto-toggle": return toggleTimeAuto();
      case "time-set-noon": return setFixedWorldHour(12);
      case "time-set-dusk": return setFixedWorldHour(18);
      case "referral-create": return createReferralFromSettings();
      case "referral-status": return showReferralStatus();
      case "wonder-preview": return prepareWonderRecipe();
      case "wonder-open-planner": return openWonderPlanner("Type the Wonder prompt here, then click the map where it should be founded.");
      case "wonder-plan-place": return enterWonderPlacement();
      case "wonder-footprint": setWonderFootprint(readNum(el, "size", 9)); paint(true); return;
      case "wonder-mode": setWonderMode(readStr(el, "mode")); paint(true); return;
      case "wonder-palette": setWonderPalette(readStr(el, "palette", "solar")); paint(true); return;
      case "spawn-wonder": return spawnWonderHere();
      case "admin-toggle": return selectAdminTool(ST.adminTool || "demolish");
      case "admin-tool": return selectAdminTool(readStr(el, "tool", "demolish"));
      case "admin-demolish-here": return adminDemolishAt(world.me.x, world.me.z, 0, false);
      case "admin-clear-tile-here": return adminDemolishAt(world.me.x, world.me.z, 0, true);
      case "admin-spawn-keep": return adminSpawnKeep(readStr(el, "mode", "here"));
      case "house-teleport": return startHouseCast(readNum(el, "uid", 0));
      case "wonder-teleport": return startWonderCast(readNum(el, "uid", 0));
      case "reload-atlases-silent": return reloadArtRuntime(false);
      case "reload-art": return reloadArtRuntime(true);
      case "open-character-panel": return directServiceHint("tailor");
      case "open-help": ST.modal = "help"; paint(true); return;
      case "guide-skip": return skipWalkthrough();
      case "tutorial-restart": return restartWalkthrough();
      case "copy-text": return copyTextToClipboard(readStr(el, "copy"), readStr(el, "label", "Value"));
      case "reload-page": writeAckedClientVersion(ST.updateVersion); return location.reload();
      case "chat-share-here": return shareHereInChat();
      case "chat-card-open": return openChatCardFromElement(el);
      case "capital-service-close": return closeCapitalService();
      case "capital-service-walk": return walkToCapitalService();
      case "capital-service-action": return useCapitalService(readStr(el, "service", ""));
      case "object-preview-close": ST.objectPreview = null; if (ST.panel === "object") ST.panel = null; paint(true); return;
      case "object-preview-walk-near": if (ST.objectPreview) { const p = ST.objectPreview; ST.panel = null; ST.objectPreview = null; world.pathToNear(p.x, p.z); paint(true); } return;
      case "object-preview-share": {
        const p = ST.objectPreview;
        if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.z))) return;
        act("chat", { msg: formatLocationChatCard(p.x, p.z, p.title || p.name || "Shared location") });
        say(t("toast.sharedLocation", "Shared your location."), 900);
        return;
      }
      case "object-preview-action": {
        const p = ST.objectPreview;
        const action = readStr(el, "objectAction", "");
        if (!p) return;
        if (action === "walk" || action === "walk-near") { ST.panel = null; ST.objectPreview = null; world.pathToNear ? world.pathToNear(p.x, p.z) : world.pathTo(p.x, p.z); paint(true); return; }
        if (action === "talk-npc") { if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) say(npcTalkLine(p), 4200); else { say(t("toast.walkCloserToTalk", "Walk closer to talk."), 1400); world.pathToNear(p.x, p.z); } return; }
        if (action === "donate-npc") { if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) act("donateNpc", { x: p.x, z: p.z }).then((r) => { if (r?.ok) { sfx.coin(); pollSoon(); paint(true); } }); else world.pathToNear(p.x, p.z); return; }
        if (action === "attack-npc") { if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) startCombatAction("Attacking wanderer…", 560, () => act("attackNpc", { x: p.x, z: p.z }).then((r) => { if (r?.ok) { sfx.hit(); ST.objectPreview = null; if (ST.panel === "object") ST.panel = null; pollSoon(); paint(true); } })); else world.pathToNear(p.x, p.z); return; }
        if (action === "donate-keep") return doDonateKeep(p.uid || p.id, 10);
        if (action === "raid-keep") return doRaid(p.uid || p.id);
        return;
      }
      case "object-preview-primary": {
        const p = ST.objectPreview;
        const action = readStr(el, "objectAction", "");
        if (!p) return;
        if (action === "select-axe") { doGather("wood"); if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) startChop(p.x, p.z); else world.pathToNear(p.x, p.z); return; }
        if (action === "select-pickaxe") { doGather("stone"); if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) startChop(p.x, p.z); else world.pathToNear(p.x, p.z); return; }
        if (action === "harvest-food") { ST.tool = "none"; ST.mode = "explore"; if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) startChop(p.x, p.z); else world.pathToNear(p.x, p.z); paint(true); return; }
        if (action === "open-trade") { if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) openTrade(); else world.pathToNear(p.x, p.z); return; }
        if (action === "talk-npc") {
          if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) say(npcTalkLine(p), 4200);
          else { say(t("toast.walkCloserToTalk", "Walk closer to talk."), 1400); world.pathToNear(p.x, p.z); }
          return;
        }
        if (action === "attack-npc") {
          if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) startCombatAction("Attacking wanderer…", 560, () => act("attackNpc", { x: p.x, z: p.z }).then((r) => { if (r?.ok) { sfx.hit(); ST.objectPreview = null; if (ST.panel === "object") ST.panel = null; pollSoon(); paint(true); } }));
          else world.pathToNear(p.x, p.z);
          return;
        }
        if (action === "donate-npc") {
          if (cheb(p.x, p.z, world.me.x, world.me.z) <= 1) act("donateNpc", { x: p.x, z: p.z }).then((r) => { if (r?.ok) { sfx.coin(); pollSoon(); paint(true); } });
          else world.pathToNear(p.x, p.z);
          return;
        }
        ST.panel = null; ST.objectPreview = null; world.pathTo(p.x, p.z); paint(true); return;
      }
      case "modal-backdrop": if (ev.target === el) { ST.modal = null; ST.inspect = null; ST.inspectPlayer = null; ST.wonderViewUid = null; ST.wonderViewError = ""; stopWonderViewer(); paint(); } return;
    }
  }
  function onDelegatedHudClick(ev) {
    const target = ev.target;
    const ctxBtn = target?.closest?.("[data-ctx-run]");
    if (ctxBtn && hudEl.contains(ctxBtn)) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      const run = ctxRuns.get(ctxBtn.getAttribute("data-ctx-run"));
      hideCtx(); if (run) run(); return;
    }
    const charPresetEl = target?.closest?.("[data-char-preset-id]");
    if (charPresetEl && hudEl.contains(charPresetEl)) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      return applyCharacterPreset(charPresetEl.getAttribute("data-char-preset-id"));
    }
    const charPartStepEl = target?.closest?.("[data-char-part-step]");
    if (charPartStepEl && hudEl.contains(charPartStepEl)) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      const k = charPartStepEl.getAttribute("data-key");
      const delta = Math.trunc(Number(charPartStepEl.getAttribute("data-delta")) || 0);
      const cur = Number(ST.characterProfile?.parts?.[k] || 0);
      return setCharacterPart(k, cur + delta);
    }
    const buildingPresetEl = target?.closest?.("[data-inspect-preset-id]");
    if (buildingPresetEl && hudEl.contains(buildingPresetEl)) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      return setInspectBuildingPreset(buildingPresetEl.getAttribute("data-inspect-preset-id"));
    }
    let actionEl = target?.closest?.("[data-click]");
    if (actionEl?.getAttribute?.("data-click") === "modal-backdrop" && ev.target !== actionEl) actionEl = null;
    if (actionEl && hudEl.contains(actionEl)) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      return handleDelegatedUiClick(actionEl.getAttribute("data-click"), actionEl, ev);
    }
    const colorEl = target?.closest?.("[data-inspect-color-idx]");
    if (colorEl && hudEl.contains(colorEl)) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation?.();
      const idx = Math.max(0, Math.min(COLOR_CHOICES.length - 1, Math.trunc(Number(colorEl.getAttribute("data-inspect-color-idx")) || 0)));
      customizeInspect({ cl: COLOR_CHOICES[idx] ?? null });
    }
  }

  function onDelegatedHudInput(ev) {
    const input = ev.target?.closest?.("[data-input]");
    if (!input || !hudEl.contains(input)) return;
    const kind = input.getAttribute("data-input");
    if (kind === "visual-warmth") return setVisual({ warmth: Number(input.value) });
    if (kind === "visual-texture") return setVisual({ texture: Number(input.value) });
    if (kind === "visual-quality") return setVisual({ quality: input.value });
    if (kind === "motion-feel") return setVisual({ motion: input.value });
    if (kind === "ui-scale") return setUiScale(input.getAttribute("data-kind") || "ui", Number(input.value));
    if (kind === "camera-zoom") return setCameraZoom(Number(input.value));
    if (kind === "camera-rotation") return setCameraYaw(Number(input.value) * Math.PI / 180);
    if (kind === "wonder-name") {
      setWonderName(input.value || "");
      paint(true, ["bottom", "modal", "utility"]);
      return;
    }
    if (kind === "wonder-prompt") {
      ST.wonderPrompt = cleanWonderPromptClient(input.value);
      invalidateWonderPlan(ST.wonderPrompt ? `Prompt set. Click a valid map tile to generate and found it. ${wonderFactsLine()}.` : "");
      paint(true, ["bottom", "modal", "utility"]);
      return;
    }
    if (kind === "char-color") return setCharacterPalette(input.getAttribute("data-key"), input.value);
    if (kind === "char-part") return setCharacterPart(input.getAttribute("data-key"), Number(input.value));
  }
  function onDelegatedHudChange(ev) {
    const input = ev.target?.closest?.("[data-input]");
    if (!input || !hudEl.contains(input)) return;
    const kind = input.getAttribute("data-input");
    if (kind === "visual-quality") return setVisual({ quality: input.value });
    if (kind === "motion-feel") return setVisual({ motion: input.value });
    if (kind === "camera-zoom") return setCameraZoom(Number(input.value), true);
    if (kind === "camera-rotation") return setCameraYaw(Number(input.value) * Math.PI / 180, true);
    if (kind === "wonder-name-select") { setWonderName(input.value || ""); return paint(true, ["bottom", "modal", "utility"]); }
    if (kind === "wonder-footprint-select") { setWonderFootprint(input.value); return paint(true, ["bottom", "modal", "utility"]); }
    if (kind === "wonder-mode-select") { setWonderMode(input.value); return paint(true, ["bottom", "modal", "utility"]); }
    if (kind === "wonder-palette-select") { setWonderPalette(input.value); return paint(true, ["bottom", "modal", "utility"]); }
    if (kind === "char-show-back") return setCharacterFlag("showBack", !!input.checked);
  }
  function onDelegatedHudKeyDown(ev) {
    const input = ev.target?.closest?.("[data-keydown]");
    if (!input || !hudEl.contains(input)) return;
    const kind = input.getAttribute("data-keydown");
    if (kind === "intro-submit" && ev.key === "Enter") {
      ev.preventDefault();
      submitIntroName();
    }
  }
  function onDelegatedHudPointerDown(ev) {
    const stopEl = ev.target?.closest?.("[data-stop-pointerdown]");
    if (stopEl && hudEl.contains(stopEl)) ev.stopPropagation();
  }
  function stripNativeTooltipAttrs(start) {
    let el = start;
    while (el && el !== hudEl && el.nodeType === 1) {
      if (el.getAttribute?.("title")) {
        el.setAttribute("data-native-title-disabled", el.getAttribute("title") || "");
        el.removeAttribute("title");
      }
      el = el.parentElement;
    }
  }
  function onDelegatedHudPointerOver(ev) {
    stripNativeTooltipAttrs(ev.target);
    const tipTarget = ev.target?.closest?.("[data-tip-title]");
    if (!tipTarget || !hudEl.contains(tipTarget)) return;
    showTip(tipText(tipTarget.getAttribute("data-tip-title") || "", tipTarget.getAttribute("data-tip-body") || ""), ev);
  }
  function onDelegatedHudPointerMove(ev) {
    const tipTarget = ev.target?.closest?.("[data-tip-title]");
    if (tipTarget && hudEl.contains(tipTarget)) moveTip(ev);
  }
  function onDelegatedHudPointerOut(ev) {
    const tipTarget = ev.target?.closest?.("[data-tip-title]");
    if (!tipTarget || !hudEl.contains(tipTarget)) return;
    const next = ev.relatedTarget;
    if (!next || !tipTarget.contains(next)) hideTip();
  }
  function onDelegatedHudWheel(ev) {
    const strip = ev.target?.closest?.("[data-build-strip]");
    if (strip && hudEl.contains(strip)) scrollBuildWheelTarget(strip, ev);
  }
  function onDelegatedHudScroll(ev) {
    const strip = ev.target?.closest?.("[data-build-strip]");
    if (strip && hudEl.contains(strip)) syncBuildScroll(strip);
  }
  function onDelegatedHudDragStart(ev) {
    const el = ev.target?.closest?.("[data-drag-pack-idx]");
    if (!el || !hudEl.contains(el)) return;
    ST.drag = Math.max(0, Math.trunc(Number(el.getAttribute("data-drag-pack-idx")) || 0));
    el.classList.add("dragging");
    if (ev.dataTransfer) { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", String(ST.drag)); }
  }
  function onDelegatedHudDragEnd(ev) {
    const el = ev.target?.closest?.("[data-drag-pack-idx]");
    if (el) el.classList.remove("dragging");
    ST.drag = null;
  }
  function onDelegatedHudDragOver(ev) {
    const slot = ev.target?.closest?.("[data-equip-slot]");
    if (!slot || !hudEl.contains(slot)) return;
    ev.preventDefault();
    slot.classList.add("drop-ok");
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
  }
  function onDelegatedHudDragLeave(ev) {
    const slot = ev.target?.closest?.("[data-equip-slot]");
    if (!slot || !hudEl.contains(slot)) return;
    const next = ev.relatedTarget;
    if (!next || !slot.contains(next)) slot.classList.remove("drop-ok");
  }
  function onDelegatedHudDrop(ev) {
    const slot = ev.target?.closest?.("[data-equip-slot]");
    if (!slot || !hudEl.contains(slot)) return;
    ev.preventDefault();
    slot.classList.remove("drop-ok");
    equipFromDrag(slot.getAttribute("data-equip-slot"));
  }

  hudEl.addEventListener("click", onDelegatedHudClick, true);
  hudEl.addEventListener("input", onDelegatedHudInput, true);
  hudEl.addEventListener("change", onDelegatedHudChange, true);
  hudEl.addEventListener("keydown", onDelegatedHudKeyDown, true);
  hudEl.addEventListener("pointerdown", onDelegatedHudPointerDown, true);
  hudEl.addEventListener("pointerover", onDelegatedHudPointerOver, true);
  hudEl.addEventListener("pointermove", onDelegatedHudPointerMove, true);
  hudEl.addEventListener("pointerout", onDelegatedHudPointerOut, true);
  hudEl.addEventListener("wheel", onDelegatedHudWheel, true);
  hudEl.addEventListener("scroll", onDelegatedHudScroll, true);
  hudEl.addEventListener("dragstart", onDelegatedHudDragStart, true);
  hudEl.addEventListener("dragend", onDelegatedHudDragEnd, true);
  hudEl.addEventListener("dragover", onDelegatedHudDragOver, true);
  hudEl.addEventListener("dragleave", onDelegatedHudDragLeave, true);
  hudEl.addEventListener("drop", onDelegatedHudDrop, true);


  /* ============================================================
     UI VIEWS — region-scoped vdom
     ============================================================ */
  const hex = (c) => "#" + c.toString(16).padStart(6, "0");
  const safeHex = (c, fallback = "#999999") => {
    const v = String(c || "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
  };
  const hexToRgb = (c) => {
    const v = safeHex(c).slice(1);
    return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
  };
  const rgba = (c, a = 1) => { const x = hexToRgb(c); return `rgba(${x.r},${x.g},${x.b},${a})`; };
  const buildingAccent = (b, def) => safeHex((b && b.cl) || hex(def?.baseC ?? 0x999999));
  const inspectAccent = (b, def) => {
    if (ST.inspectDraft && ST.inspectDraft.uid === ST.inspect && Object.prototype.hasOwnProperty.call(ST.inspectDraft, "cl")) {
      return safeHex(ST.inspectDraft.cl || hex(def?.baseC ?? 0x999999));
    }
    return buildingAccent(b, def);
  };
  const costStr = (cost) => Object.entries(cost || {}).filter(([, v]) => v).map(([k, v]) => `${v}${COSTI[k]}`).join(" ");
  const liveE = () => {
    const m = ST.me; if (!m) return 0;
    const max = Math.max(1, Number(m.maxE || BASE_MAX || 100));
    const base = Math.max(0, Number(m.energy ?? max));
    const regen = Math.max(0, Number(m.regen || 0));
    const at = Number(m.energyAt || performance.now());
    const dt = Math.max(0, Math.min(10, (performance.now() - at) / 1000));
    return Math.max(0, Math.min(max, base + regen * dt));
  };
  const nearForge = () => {
    if (!ST.me) return false;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const b = world.buildPoolAt(world.me.x + dx, world.me.z + dz);
      if (b && b.kind === "forge") return true;
    }
    return false;
  };
  const hasWorkshop = () => !!(ST.me?.buildKinds || []).includes("workshop");
  const hasAlchemy = () => !!(ST.me?.buildKinds || []).includes("alchemy");
  const isAdminPlayer = () => {
    const n = String(ST.me?.name || ST.me?.nickname || ST.me?.handle || "").trim().toLowerCase();
    return n === "second";
  };


  function landmarkLabel(value = "") {
    return String(value || "Landmark").replace(/Landmark/gi, "Landmark").replace(/Wonder/gi, "Landmark");
  }

  function stopWonderViewer() {
    try {
      const holder = document.querySelector('[data-landmark-viewer="1"]');
      if (holder) holder.innerHTML = "";
    } catch {}
  }

  function mountWonderViewerSoon() {
    if (ST.screen !== "playing" || ST.modal !== "wonder-view" || !ST.wonderViewUid) return;
    setTimeout(() => {
      try {
        const holder = document.querySelector('[data-landmark-viewer="1"]');
        if (!holder) return;
        const b = world?.buildPool?.get?.(ST.wonderViewUid) || null;
        const recipe = wonderRecipeForWire(b) || b?.wonder || {};
        const palette = Array.isArray(recipe.palette) && recipe.palette.length ? recipe.palette : ["#ffd76e", "#14f195", "#7dcfe8", "#9945ff"];
        holder.innerHTML = `<div class="landmark-viewer__halo"></div><div class="landmark-viewer__model" style="--landmark-a:${palette[0]};--landmark-b:${palette[1] || palette[0]};--landmark-c:${palette[2] || palette[0]}"><i></i><b></b><em></em></div>`;
      } catch {}
    }, 0);
  }

  function WonderViewModal() {
    const b = world?.buildPool?.get?.(ST.wonderViewUid || ST.inspect) || null;
    const recipe = wonderRecipeForWire(b) || b?.wonder || {};
    const name = landmarkLabel(recipe.name || b?.nm || "Landmark");
    const size = normalizeWonderFootprintClient(recipe.footprint || b?.footprint || WONDER_PLAZA_SIZE);
    const bonus = Number(WORLD_WONDER_GLOBAL_COIN_BONUS_PCT || 0) || 0;
    return <div className="modal landmark-view-modal">
      <div className="modal-title-row"><div><p className="eyebrow">Public Landmark</p><h2>{name}</h2></div><button className="btn mini" data-click="modal-close">×</button></div>
      <div className="landmark-viewer" data-landmark-viewer="1" />
      <p className="tiny">Built from wood and stone. Landmarks do not require personal tiles and increase coin production for everyone.</p>
      <div className="recipe-req"><b>Benefit:</b> +{bonus}% global coin production · <b>Footprint:</b> {size}×{size}</div>
      {ST.wonderViewError ? <div className="recipe-req bad">{ST.wonderViewError}</div> : null}
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary" data-click="modal-close">Close</button></div>
    </div>;
  }

  function LoginIso() {
    const owned = new Set([18,19,20,26,27,28,34,35,36,11,12,21]);
    const builds = { 19: "", 27: "violet", 35: "", 12: "" };
    const trees = new Set([5,7,40,55,58,2]);
    return <div className="login-iso"><div className="login-iso-grid">
      {Array.from({ length: 64 }, (_, i) => {
        let cls = "login-tile" + (owned.has(i) ? " owned" : "");
        if (Object.prototype.hasOwnProperty.call(builds, i)) cls += " build" + (builds[i] ? " " + builds[i] : "");
        else if (trees.has(i)) cls += " tree";
        return <div className={cls} style={`animation-delay:${(i % 9) * 0.25}s`} />;
      })}
    </div></div>;
  }
  function LoginMotes() {
    return <div>{Array.from({ length: 22 }, (_, i) => {
      const left = ((i * 37) % 100);
      const dur = 9 + ((i * 7) % 10);
      const delay = -((i * 11) % 12);
      const violet = i % 3 === 0;
      return <div className="login-mote" style={`left:${left}vw;bottom:-2vh;animation-duration:${dur}s;animation-delay:${delay}s;${violet ? "background:var(--violet);box-shadow:0 0 8px var(--violet);" : ""}`} />;
    })}</div>;
  }
  function Menu() {
    if (ST.screen !== "menu") return <div />;
    const hasPhantom = !!phantomProvider();
    const gate = ST.loginGate;
    const gateProblem = gate?.enabled && !gate?.configured;
    const canJoin = hasPhantom && !gateProblem && !ST.joining;
    const features = tArray("login.features", [
      ["🌍", "Open World"],
      ["🪓", "Gather & Build"],
      ["⚔️", "Fight Keeps"],
      ["👥", "Live Multiplayer"],
    ]);
    return (
      <div className="menu landing-page">
        <div className="landing-backdrop" aria-hidden="true">
          <div className="landing-sky" />
          <div className="landing-cloud cloud-a" /><div className="landing-cloud cloud-b" /><div className="landing-cloud cloud-c" />
          <div className="landing-hill hill-a" /><div className="landing-hill hill-b" />
          <div className="landing-river" />
          <div className="landing-house"><i /><b /><em /></div>
          <div className="landing-tree tree-a" /><div className="landing-tree tree-b" /><div className="landing-tree tree-c" />
          <div className="landing-token token-a">✦</div><div className="landing-token token-b">◆</div>
          <div className="landing-vignette" />
        </div>
        <main className="landing-shell">
          <section className="landing-card">
            <p className="landing-kicker"><span>⌁</span>{t("login.kicker", "Craft Your Life, Own Your World.")}</p>
            <h1><span className="landing-logo-main">SolCrafts</span></h1>
            <p className="landing-copy">{t("login.copy", "Explore a living world, gather resources, fight wandering NPCs and Keeps, build Landmarks, and adventure together with players online — right now.")}</p>
            <div className="landing-loop" aria-label={t("login.coreLoopAria", "Core loop")}>{features.map((f) => <div><b>{f[0]}</b><span>{f[1]}</span></div>)}</div>
            <button className="landing-primary" data-click="join-game" disabled={!canJoin}>{ST.joining ? t("login.checking", "Checking…") : !hasPhantom ? t("login.installPhantom", "Install Phantom") : t("login.connectWallet", "🎮 Connect Wallet to Play")}</button>
            <div className="landing-actions">
              <button className="landing-secondary" data-click="spectate-game" disabled={ST.joining}>{t("login.spectate", "Spectate")}</button>
              {ST.auth ? <button className="landing-secondary" data-click="forget-session" disabled={ST.joining}>{t("login.forgetSession", "Forget session")}</button> : null}
            </div>
            <p className="landing-after-wallet">{t("login.afterWallet", "New players choose character name and invite code after Phantom connects.")}</p>
            <div className={"landing-status" + (!hasPhantom || gateProblem ? " bad" : "") }>
              <b>{!hasPhantom ? t("login.phantomRequiredTitle", "Phantom wallet required") : gate?.enabled ? t("login.walletCheckedTitle", "Wallet checked by server") : t("login.walletLoginTitle", "Wallet login")}</b>
              <span>{!hasPhantom ? t("login.phantomRequiredBody", "Install or enable Phantom to play. Spectate remains available without a wallet.") : loginGateText(gate)}</span>
            </div>
            {ST.loginMsg ? <div className="landing-message">{ST.loginMsg}</div> : null}
          </section>
        </main>
      </div>
    );
  }


  function territoryCoinStatusText() {
    const tiles = ST.me?.territory || 0;
    const coins = world?.lootPool ? Array.from(world.lootPool.values()).filter((l) => l && l.x != null).length : 0;
    return `${tiles} claimed tiles · territory coins spawn over time and are picked up by walking over them`;
  }
  function territoryCoinNextStep() {
    return "Claim free land within your $CRAFTS capacity, build resource sources, and use the capital bank for coin/SOL services.";
  }

  function capRatio(value, cap) {
    const c = Number(cap || 0);
    if (!Number.isFinite(c) || c <= 0) return 0;
    return Math.max(0, Math.min(1, Number(value || 0) / c));
  }
  function limitAdviceRows(m) {
    if (!m) return [];
    const rows = [];
    const inv = m.inv || {};
    const caps = m.storageCap || {};
    const tileCap = Number(m.tileCap || 0);
    const tileRatio = capRatio(m.territory || 0, tileCap);
    if (tileCap && (tileRatio >= 0.80 || tileCap - Number(m.territory || 0) <= 8)) {
      rows.push({
        key: "tiles", glyph: "◇", cls: tileRatio >= 0.96 ? "bad" : "warn",
        title: `Tile limit ${m.territory || 0}/${tileCap}`,
        short: tileRatio >= 0.96 ? "Tile limit full" : "Near tile limit",
        body: "Hold more $CRAFTS to raise land capacity. Houses are travel points; they do not increase the tile limit.",
      });
    }
    const resourceRows = [
      ["w", "Wood", "🪵", "Storage is limited. Lumber Camp helps create more tree nodes."],
      ["s", "Stone", "🪨", "Storage is limited. Mine helps create more rock nodes."],
      ["f", "Food", "🌾", "Food restores health after raids and dangerous fights."],
      ["g", "Coins", "🪙", "Coins come from pickups, markets, and Keep raids."],
    ];
    for (const [key, name, glyph, body] of resourceRows) {
      const cap = Number(caps[key] || 0);
      const have = Number(inv[key] || 0);
      const ratio = capRatio(have, cap);
      if (cap && (ratio >= 0.85 || cap - have <= 12)) rows.push({
        key, glyph, cls: ratio >= 0.96 ? "bad" : "warn",
        title: `${name} cap ${have}/${cap}`,
        short: ratio >= 0.96 ? `${name} storage full` : `${name} near cap`,
        body,
      });
    }
    return rows.slice(0, 4);
  }
  function limitAdviceSummary(m) {
    const rows = limitAdviceRows(m);
    if (!rows.length) return "Limits are healthy. Claim outward, build producers, and keep collecting loose tokens.";
    return rows.map((r) => `${r.title}: ${r.body}`).join(" ");
  }
  function openQuests() { togglePanel("quests"); }
  function openOptions() { togglePanel("settings"); }
  function openCoinGuide() { togglePanel("bank"); }
  function Hud() {
    const m = ST.me;
    if (ST.screen !== "playing" || !m) return <div />;
    const visiblePlayers = Array.isArray(ST.players) ? ST.players.length : 0;
    const activePlayers = Array.isArray(ST.map?.players) ? ST.map.players.length : visiblePlayers;
    const hint = ST.channel ? (ST.channel.kind === "home" ? "Returning to flag" : ST.channel.kind === "house" ? "Travelling to House" : ST.channel.kind === "wonder" ? "Travelling to Landmark" : ST.channel.kind === "redeem" ? "Withdrawing coins" : ST.channel.kind === "combat" ? "Attacking" : ST.channel.kind === "tree" ? "Chopping wood" : ST.channel.kind === "food" ? "Harvesting food" : "Mining stone") : "";
    const wondersBuilt = (ST.map?.buildings || []).filter((b) => b && b.kind === "worldwonder" && Number(b.owner || 0) === Number(m.id || 0)).length;
    return <><PlayerHudView
      player={m}
      panel={ST.panel}
      liveEnergy={liveE()}
      maxHp={MAX_HP}
      xpNeeded={xpForLevel(m.level || 1)}
      visiblePlayers={visiblePlayers}
      activePlayers={activePlayers}
      gameplayHint={hint}
      wondersBuilt={wondersBuilt}
      Icon={UiIcon}
    />
      {renderWorldStatusChips(ST)}
    </>;
  }

  function TopActions() {
    return <TopChromeView
      playing={ST.screen === "playing"}
      panel={ST.panel}
      muted={!!(ST.uiMuted && ST.musicMuted)}
      Icon={UiIcon}
    />;
  }


  const FOUNDATION_CHOICES = [];
  const CLEAN_BUILDABLE_IDS = new Set(["cottage", "lumber", "quarry", "farm", "warehouse", "worldwonder"]);
  const BUILDABLES = LIBRARY.filter((b) => CLEAN_BUILDABLE_IDS.has(String(b.id || "")));
  const ADMIN_KEEP_BUILDING = {
    id: "admin_keep",
    name: "Admin Keep",
    glyph: "♜",
    cost: {},
    hp: 140,
    blurb: "Admin event tool. Visible here so the admin can spawn neutral coin Keeps for players to attack.",
    effect: "Only nickname second can spawn it on the server.",
  };
  function territoryUpgradeHint(kind, level = 1) {
    const lv = Math.max(1, Number(level || 1));
    const stacks = Math.max(0, lv - 1);
    if (kind === "lumber") return `Upgrade effect: +25% wood from every tree on your owned territory per level above 1${stacks ? ` · this building contributes +${stacks * 25}%` : ""}.`;
    if (kind === "quarry") return `Upgrade effect: +25% stone from every rock on your owned territory per level above 1${stacks ? ` · this building contributes +${stacks * 25}%` : ""}.`;
    if (kind === GOLD_MINE_KIND) return `Upgrade effect: +20% coins from owned-territory pickups and territory taxes per level above 1${stacks ? ` · this mint contributes +${stacks * 20}%` : ""}.`;
    return "";
  }
  function buildingRoleLine(b) {
    return buildingPurposeLine(b);
  }
  function buildingStatsLine(b) {
    const cost = polishCostLine(b.cost) || "Free";
    return `Cost: ${cost} · Requires: ${buildingRequirementLine(b)} · Produces: ${buildingProductionLine(b)} · Best near: ${buildingBestNearLine(b)}`;
  }
  function missingCostLine(cost, m = ST.me) {
    const line = missingCostLineDetailed(cost, m?.inv || {}, liveE());
    return line === "Ready to build" ? "" : line;
  }
  function buildingUnavailableReason(id) {
    const b = LIB_BY_ID[id];
    const m = ST.me;
    if (!b || !m) return "No settler loaded.";
    if ((m.territory || 0) < (b.unlock || 0)) return `${b.name} unlocks at ${b.unlock} claimed tiles. You have ${m.territory || 0}. Capture more tiles as your $CRAFTS holder capacity allows.`;
    const missing = missingCostLine(b.cost, m);
    if (missing) return `${b.name}: ${missing}.`;
    return "";
  }
  const destroySpec = () => DESTROY_BY_ID[ST.destroying] || DESTROY_TOOLS[0];
  const craftedToolCount = (id) => ((ST.me?.pack || []).filter((it) => it && it.t === "bomb" && it.id === id).length);
  function syncBuildScroll(el) {
    if (!el) el = document.getElementById("sc-build-strip");
    const thumb = document.getElementById("sc-build-scroll-thumb");
    if (!el || !thumb || !thumb.parentElement) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const trackW = thumb.parentElement.clientWidth || 1;
    if (max <= 2) { thumb.style.width = "100%"; thumb.style.transform = "translateX(0px)"; return; }
    const thumbW = Math.max(42, Math.round(trackW * el.clientWidth / el.scrollWidth));
    const x = Math.round((trackW - thumbW) * (el.scrollLeft / max));
    thumb.style.width = thumbW + "px";
    thumb.style.transform = `translateX(${x}px)`;
  }
  function syncBuildScrollSoon() { requestAnimationFrame(() => syncBuildScroll()); }
  function closeTools() { ST.mode = "explore"; ST.placing = null; ST.tool = "none"; ST.useAfterWalkUid = null; world.hideBuildGhost(); updateHints(); }
  function selectBuildTool() {
    if (ST.mode === "build" || ST.mode === "place") closeTools();
    else {
      ST.mode = "build"; ST.placing = null; ST.tool = "build";
    }
    updateHints(); paint(); syncBuildScrollSoon();
  }
  function selectWonderTool() {
    if (ST.mode === "wonder" || ST.tool === "wonder") { ST.wonderMsg = ""; closeTools(); }
    else openWonderPlanner("Describe a Landmark, generate the AI plan, then found it on a clear frontier site.");
  }
  function selectBuilding(id) {
    const reason = buildingUnavailableReason(id);
    if (reason) { sfx.err(); say(reason, 3200); return; }
    if (id === "worldwonder") {
      openWonderPlanner("Type one Wonder prompt, choose size/style if needed, then click a valid map tile. No separate plan/place step.");
      return;
    }
    if (!ST.objectPreview || ST.objectPreview.kind !== "buildTile") { sfx.err(); say("Select a captured tile first, then choose a building in the right panel.", 2400); return; }
    const target = ST.objectPreview;
    act("place", { kind: id, x: target.x, z: target.z }).then((r) => {
      if (r?.ok) { sfx.build(); world.shockwave(target.x, target.z, 0xffe2a8); ST.objectPreview = null; ST.panel = null; closeTools(); pollSoon(); paint(true); say(r.note || "Construction started.", 1800); }
    });
  }
  function selectCraftTool() {
    if (ST.mode === "craft" || ST.tool === "craft") closeTools();
    else { ST.mode = "craft"; ST.tool = "craft"; ST.placing = null; }
    updateHints(); paint(); syncBuildScrollSoon();
  }
  function selectDeployTool() {
    if (ST.mode === "spawn" || ST.mode === "spawnPlace" || ST.tool === "spawn") closeTools();
    else { ST.mode = "spawn"; ST.tool = "spawn"; ST.placing = null; ST.destroying = ST.destroying || DESTROY_TOOLS[0]?.id || "popper"; }
    updateHints(); paint(); syncBuildScrollSoon();
  }
  function toggleToolsRibbon() {
    if (ST.mode === "tools" || ST.tool === "wood" || ST.tool === "stone" || ST.tool === "use") closeTools();
    else { ST.mode = "tools"; ST.tool = "none"; ST.placing = null; ST.modal = null; ST.panel = null; }
    updateHints(); paint(true); syncBuildScrollSoon();
  }
  function selectDemolishTool() {
    if (ST.mode === "demolish" || ST.tool === "demolish") closeTools();
    else { ST.mode = "demolish"; ST.tool = "demolish"; ST.placing = null; ST.modal = null; ST.panel = null; say("Demolish selected — click one of your own buildings, or use Inspect for details.", 1800); }
    updateHints(); paint(true);
  }
  function toggleTeleportRibbon() {
    if (ST.mode === "teleport" || ST.tool === "teleport") closeTools();
    else { ST.mode = "teleport"; ST.tool = "teleport"; ST.placing = null; ST.modal = null; ST.panel = null; }
    updateHints(); paint(true); syncBuildScrollSoon();
  }
  function selectDeploy(id) {
    const spec = DESTROY_BY_ID[id];
    if (spec && craftedToolCount(id) <= 0) { sfx.err(); say(`Craft a ${spec.name} first, then place it from Siege.`, 2600); return; }
    ST.destroying = id; ST.mode = "spawnPlace"; ST.tool = "spawn"; ST.placing = null; updateHints(); paint(); syncBuildScrollSoon();
  }
  function scrollBuildWheelTarget(el, ev) {
    if (!el) return;
    if (Math.abs(ev.deltaY) >= Math.abs(ev.deltaX)) {
      ev.preventDefault();
      el.scrollLeft += ev.deltaY;
    }
    syncBuildScroll(el);
  }

  function closeCapitalService() {
    ST.capitalService = null;
    ST.serviceAccess = "";
    if (["capital", "bank", "char", "quests"].includes(String(ST.panel))) ST.panel = null;
    paint(true);
  }
  function capitalServiceDistance() {
    const s = ST.capitalService;
    if (!s || !ST.me) return 99;
    return cheb(Number(s.x || 0), Number(s.z || 0), Number(ST.me.x || 0), Number(ST.me.z || 0));
  }
  function walkToCapitalService() {
    const s = ST.capitalService;
    if (!s) return;
    ST.panel = null;
    world.pathToNear(Number(s.x || 0), Number(s.z || 0));
    paint(true);
  }
  function useCapitalService(serviceId = "") {
    const s = ST.capitalService;
    const info = capitalServiceForBuilding({ ...(s || {}), capital: true, service: serviceId || s?.service });
    if (!s || !info) return;
    const dist = capitalServiceDistance();
    if (!capitalServiceAvailable(dist, info)) { say(`Walk beside ${s.name || info.title} first.`, 1600); walkToCapitalService(); return; }
    ST.serviceAccess = info.id;
    ST.objectPreview = null;
    ST.inspect = null;
    if (info.action === "bank") { openBankPanel(true); return; }
    if (info.action === "market") { openTrade(true); return; }
    if (info.action === "tailor") { ST.panel = "char"; markGuidePanelVisited("char"); advanceWalkthroughPanel("char"); paint(true); return; }
    if (info.action === "guide") { ST.panel = "quests"; markGuidePanelVisited("quests"); advanceWalkthroughPanel("quests"); paint(true); return; }
    if (info.action === "charter") { say("Town Hall charter: build outside the capital reserve and expand your settlement outward.", 3200); paint(true); return; }
    walkToCapitalService();
  }
  function directServiceHint(service) {
    const where = service === "bank" ? "Capital Bank" : service === "tailor" ? "Mirror Tailor" : service === "guide" ? "Guide Hall" : "Market Square";
    say(`Visit the ${where} in the capital to use this service.`, 2200);
  }
  function togglePanel(name) {
    if (name === "inv" || name === "inventory") name = "bank";
    if (["bank", "char", "quests", "skills", "inventory"].includes(String(name)) && !ST.serviceAccess) {
      return directServiceHint(name === "char" ? "tailor" : name === "quests" ? "guide" : name === "bank" ? "bank" : "market");
    }
    const next = ST.panel === name ? null : name;
    ST.panel = next;
    ST.modal = null;
    closeTools();
    if (!next) ST.serviceAccess = "";
    if (next) { markGuidePanelVisited(next); advanceWalkthroughPanel(next); }
    paint(true);
  }
  function openCharacter() { directServiceHint("tailor"); }
  async function loadBankStatus() {
    if (!ST.auth || ST.spectator) return null;
    ST.bankBusy = true; ST.bankMsg = ""; paint(true);
    const r = await api("/api/bank", { pid: ST.auth.pid, secret: ST.auth.secret, action: "exchange" });
    ST.bankBusy = false;
    if (r?.ok) ST.bank = r;
    else ST.bankMsg = r?.msg || "Bank status unavailable.";
    paint(true);
    return r;
  }
  async function bankAction(action, extra = {}) {
    if (!ST.auth || ST.spectator) return null;
    ST.bankBusy = true; ST.bankMsg = ""; paint(true);
    const r = await api("/api/bank", { pid: ST.auth.pid, secret: ST.auth.secret, action, ...extra });
    ST.bankBusy = false;
    if (r?.status) ST.bank = r.status;
    else if (r?.ok) ST.bank = r;
    const pausedWithdraw = action === "withdraw" && (r?.dryRun || String(r?.status || "").toLowerCase() === "pending");
    ST.bankMsg = r?.msg || (r?.ok ? (action === "deposit" ? "Deposit address ready." : action === "scan" ? "Deposit scan complete." : pausedWithdraw ? "Withdrawal request created." : "Exchange updated.") : r?.msg || "Bank action failed.");
    if (r?.ok) { sfx.coin(); pollSoon(); } else sfx.err();
    paint(true);
    return r;
  }
  function openBankPanel(fromCapital = false) {
    if (!fromCapital && !ST.serviceAccess) { directServiceHint("bank"); return; }
    ST.tradeTab = "bank";
    ST.serviceAccess = ST.serviceAccess || "bank";
    ST.panel = "bank";
    ST.modal = null;
    closeTools();
    loadBankStatus();
    paint(true);
  }
  function openBankFromInspect() {
    ST.tradeTab = "bank";
    ST.serviceAccess = "bank";
    ST.panel = "bank";
    ST.modal = null;
    closeTools();
    loadBankStatus();
    paint(true);
  }
  function openCustomizerFromInspect(uid = ST.inspect) {
    if (!uid) return;
    act("customizerAccess", { uid }).then((r) => {
      if (!r?.ok) { sfx.err(); say(r?.msg || "Customizer unavailable.", 2400); return; }
      if (r.inv && ST.me) ST.me.inv = r.inv;
      ST.serviceAccess = "tailor";
      ST.panel = "char";
      ST.modal = null;
      ST.inspect = null;
      markGuidePanelVisited("char");
      advanceWalkthroughPanel("char");
      sfx.coin();
      say(r.note || "Customizer unlocked.", 1600);
      pollSoon();
      paint(true);
    });
  }

  function openTrade(fromCapital = false) {
    if (!fromCapital && !ST.serviceAccess) { directServiceHint("market"); return; }
    ST.tradeTab = "market";
    ST.serviceAccess = ST.serviceAccess || "market";
    ST.panel = "bank";
    ST.modal = null;
    closeTools();
    loadBankStatus();
    paint(true);
  }
  function doUseTool() {
    if (ST.channel?.kind === "home") return;
    if (ST.tool !== "use") {
      ST.tool = "use"; ST.mode = "explore"; ST.placing = null; updateHints(); say("Use selected — choose Return Scroll, a crafted item, or click a building.", 1800); paint(); syncBuildScrollSoon(); return;
    }
    if (ST.near.i) return doInteract();
    startHomeCast();
  }
  function doAttackTool() {
    if (ST.tool === "sword") return closeTools(), paint();
    ST.tool = "sword"; ST.mode = "explore"; ST.placing = null; ST.modal = null;
    updateHints(); say("Sword selected — click Keeps, buildings, or settlers to attack. Energy limits attacks, not walking.", 1800); paint();
  }
  function plantDestroy(x = world.me.x, z = world.me.z) {
    const spec = destroySpec();
    const bad = canCastBombAt(x, z, true);
    if (bad) { sfx.err(); say(bad); return; }
    if (craftedToolCount(spec.id) <= 0) { sfx.err(); say(`Craft a ${spec.name} first.`); return; }
    act("removedDeployTool", { variant: spec.id, x, z }).then((r) => { if (r && r.ok) { sfx.raid(); world.shockwave(x, z, 0xffd76e); updateHints(); paint(true); } });
  }
  function BottomBar() {
    if (ST.screen !== "playing") return <div />;
    const m = ST.me;
    const action = (num, ico, lbl, run, opts = {}) => {
      const info = opts.info || `${num}: ${lbl}`;
      return (
        <button className={actionSlotClass({ primary: opts.primary, on: opts.on, danger: opts.danger, disabled: opts.disabled }) + " ui2-toolbelt-slot"} disabled={!!opts.disabled} aria-label={info} data-tip-title={`${num} · ${lbl}`} data-tip-body={info} data-click={run} data-core-action={run} data-tool-cursor={opts.cursor || String(lbl).toLowerCase()}>
          <span className="num">{num}</span><span className="ico"><UiIcon name={opts.iconName || String(lbl).toLowerCase()} fallback={ico} /></span><span className="lbl">{lbl}</span>{opts.cd ? <span className="cd" style={`--cd:${opts.cd}%`} /> : null}
        </button>
      );
    };
    const admin = isAdminPlayer();
    const ribbonMode = ribbonModeForState({ mode: ST.mode, tool: ST.tool, placing: ST.placing });
    const ribbon = <ActionRibbon
      mode={ribbonMode}
      admin={admin}
      m={m}
      state={ST}
      buildables={BUILDABLES}
      liveE={liveE}
      costStr={costStr}
      craftedToolCount={craftedToolCount}
      currentWonderSize={currentWonderSize}
      currentWonderMode={currentWonderMode}
      currentWonderPalette={currentWonderPalette}
      currentWonderNameFallback={currentWonderNameFallback}
      wonderBuildMsClient={wonderBuildMsClient}
      wonderTilesClient={wonderTilesClient}
      cleanWonderPromptClient={cleanWonderPromptClient}
      normalBuildMsClient={normalBuildMsClient}
      buildingStatsLine={buildingStatsLine}
      padRequirementLine={padRequirementLine}
      buildingRoleLine={buildingRoleLine}
      missingCostLine={missingCostLine}
      wonderFootprintChoices={WONDER_FOOTPRINT_CHOICES}
      wonderModeChoices={WONDER_MODE_CHOICES}
      wonderPalettes={WONDER_PALETTES}
    />;
    const actions = (() => {
      const active = actionBarActive({ mode: ST.mode, tool: ST.tool, panel: ST.panel });
      return CORE_ACTIONS.map((a) => action(a.key, a.icon, a.label, a.click, {
        on: !!active[a.click],
        info: a.help,
        iconName: a.atlas || String(a.label).toLowerCase(),
        cursor: a.cursor,
      }));
    })();
    return (
      <div className="ui2-action-layer ui2-toolbelt-layer">
        {ribbonMode ? <div className="ui2-top-ribbon-host" data-ribbon-mode={ribbonMode}>{ribbon}</div> : null}
        <div className={actionStackClass({ hasRibbon: !!ribbonMode }) + " ui2-toolbelt-stack"}>
          <div className="action-bar ui2-toolbelt-bar">
            {actions}
          </div>
        </div>
      </div>
    );
  }



  function WonderPlannerModal() {
    const m = ST.me || {};
    const size = currentWonderSize();
    const mode = currentWonderMode();
    const palette = currentWonderPalette();
    const buildMs = wonderBuildMsClient(size, mode);
    const planReady = !!ST.wonderRecipe;
    const promptReady = !!cleanWonderPromptClient(ST.wonderPrompt);
    const status = ST.wonderPlacing ? "Founding on map…" : ST.wonderBusy ? "Generating real AI plan…" : planReady ? "Plan ready — choose placement" : "Needs AI plan";
    return <div className="modal" style={{ width: "min(760px,96vw)", maxHeight: "92vh", overflow: "auto" }}>
      <h2>★ Landmark Planner</h2>
      <p className="tiny">No browser popups. Pick the name, prompt, footprint, layout mode, and color scheme here. Wood and stone spend only after the server validates the AI recipe and open space.</p>
      <div className="recipe-req"><b>Status:</b> {status}</div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
        <div className="card">
          <div className="card-title">Identity</div>
          <div className="field"><label>Name preset</label><select data-input="wonder-name-select" value={ST.wonderName || ""}>
            <option value="">Custom / use prompt</option>
            {WONDER_NAME_PRESETS.map((n) => <option value={n}>{n}</option>)}
          </select></div>
          <div className="field"><label>Map label / Wonder name</label><input maxlength="42" placeholder="Crystal Skyscraper" value={ST.wonderName || ""} data-input="wonder-name" /></div>
          <div className="field"><label>Prompt description for real AI</label><textarea style={{ width: "100%", minHeight: 116, resize: "vertical" }} maxlength="180" placeholder="Example: a tall golden skyscraper observatory with sky bridges, side gardens, crystal antennae, and solar glass towers" value={ST.wonderPrompt || ""} data-input="wonder-prompt" /></div>
        </div>
        <div className="card">
          <div className="card-title">Space + build behavior</div>
          <div className="field"><label>Footprint / reserved tiles</label><select data-input="wonder-footprint-select" value={String(size)}>
            {WONDER_FOOTPRINT_CHOICES.map((sz) => <option value={String(sz)}>{sz}×{sz} — {sz * sz} tiles</option>)}
          </select></div>
          <div className="field"><label>Composition mode</label><select data-input="wonder-mode-select" value={mode}>
            {WONDER_MODE_CHOICES.map((mo) => <option value={mo.id}>{mo.name}</option>)}
          </select></div>
          <div className="field"><label>Color scheme</label><select data-input="wonder-palette-select" value={palette.id}>
            {WONDER_PALETTES.map((pal) => <option value={pal.id}>{pal.name}</option>)}
          </select></div>
          <div className="recipe-req">
            <b>Selected:</b> {size}×{size} plaza · {wonderTilesClient(size)} tiles · {mode === "single" ? "big single landmark" : "multi-tile district"} · {palette.name}.
            <br/><b>Timing:</b> AI plan {WONDER_AI_TIME_HINT}; construction about {Math.round(buildMs / 1000)}s after placement.
            <br/><b>Cost:</b> {polishCostLine(WORLD_WONDER_COST)}, spent only when founding succeeds. Benefit: +{WORLD_WONDER_GLOBAL_COIN_BONUS_PCT}% global coin production.
          </div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {palette.colors.map((c) => <i title={c} style={{ width: 26, height: 26, borderRadius: 999, display: "inline-block", background: c, border: "1px solid rgba(255,255,255,.4)", boxShadow: "0 2px 10px rgba(0,0,0,.28)" }} />)}
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 10 }}>
        <div className="card-title">Plan + placement</div>
        <div className="tiny">Generate the AI plan first. Then the map ghost shows the exact {size}×{size} footprint; click a valid center tile to spawn the foundation instantly and watch construction progress.</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <div className="tiny"><b>Flow:</b> close this and click the map. The server generates the AI design, spends wood and stone, places the landmark, and starts construction in one step.</div>
          <button className="btn" data-click="modal-close">Close</button>
        </div>
        {planReady ? <div className="recipe-req" style={{ marginTop: 8 }}>Plan ready: <b>{ST.wonderRecipe.name || currentWonderNameFallback()}</b> · {ST.wonderRecipe.footprint || size}×{ST.wonderRecipe.footprint || size} · {ST.wonderRecipe.mode || mode} · {ST.wonderRecipe.paletteId || palette.id}</div> : null}
        {ST.wonderMsg ? <div className="tiny" style={{ marginTop: 8 }}>{ST.wonderMsg}</div> : null}
      </div>
    </div>;
  }


  function BuildModal() {
    const m = ST.me;
    const wonders = m?.wonders || [];
    const houses = m?.houses || [];
    return (
      <div className="modal">
        <h2>⌂ Build</h2>
        <p className="tiny">Capture 3 nearby tiles for free, gather resources, then place your first House on an empty captured tile.</p>
        <div className="recipe-req">{captureLimitLine(m)}. Claiming is free; $CRAFTS holder capacity raises your tile limit.</div>
        {houses.length ? <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-title">House travel</div>
          <div className="tiny">Houses are your normal settlement travel points. Cast briefly, then jump between them.</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {houses.map((h) => <button className="btn" data-click="house-teleport" data-uid={h.uid}>House · {h.x},{h.z}</button>)}
          </div>
        </div> : null}
        {wonders.length ? <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-title">Landmark scrolls</div>
          <div className="tiny">Landmarks are shared wood-and-stone landmarks that increase coin production for everyone.</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {wonders.map((w) => <button className="btn" data-click="wonder-teleport" data-uid={w.uid}>Wonder · {w.name || `${w.x},${w.z}`}</button>)}
          </div>
        </div> : null}
        <div className="grid">
          {((isAdminPlayer() ? [ADMIN_KEEP_BUILDING, ...BUILDABLES] : BUILDABLES)).map((b) => {
            const isWonder = b.id === "worldwonder";
            const isAdminKeep = b.id === "admin_keep";
            const locked = !isWonder && !isAdminKeep && (m?.territory || 0) < (b.unlock || 0);
            const miss = isAdminKeep ? [] : Object.entries(b.cost || {}).filter(([res, amt]) => (res === "e" ? liveE() : (m?.inv?.[res] || 0)) < amt);
            const disabled = locked || miss.length > 0;
            const costLabel = isAdminKeep ? "admin" : (polishCostLine(b.cost) || "Free");
            return (
              <div className={"card" + (locked ? " locked" : "") }>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="glyph">{b.glyph}</span><span className="cost">{costLabel}</span></div>
                <div className="card-title">{b.name}</div>
                <div className="tiny">{buildingPurposeLine(b)}</div>
                <span className="usetag">Cost: {costLabel}</span>
                <div className="building-clarity-list">
                  <div><b>Requires</b><span>{isAdminKeep ? "Admin permission" : buildingRequirementLine(b)}</span></div>
                  <div><b>Produces</b><span>{isAdminKeep ? "Neutral event target" : buildingProductionLine(b)}</span></div>
                  <div><b>Best near</b><span>{isAdminKeep ? "Event area" : buildingBestNearLine(b)}</span></div>
                </div>
                <div className="tiny">HP {b.hp || 220}{isAdminKeep ? " · event target" : ` · ${padNameForDef(b)} · ${isWonder ? Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000) : Math.round(normalBuildMsClient(b) / 1000)}s construction`}</div>
                {isWonder ? <div className="space-req wonder-quick-plan">
                  <div className="recipe-req"><b>Landmark:</b> one prompt → real AI plan → visible construction → completion progress.</div>
                  <input className="wonder-prompt-line" maxlength="180" placeholder="Describe the landmark: school, dish, observatory, market..." value={ST.wonderPrompt || ""} data-input="wonder-prompt" />
                  <div className="tiny">Auto name: <b>{currentWonderNameFallback()}</b> · Cost {polishCostLine(WORLD_WONDER_COST)} · +{WORLD_WONDER_GLOBAL_COIN_BONUS_PCT}% global coin production · Plan {WONDER_AI_TIME_HINT} · Build ~{Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s</div>
                  <div className="row wonder-mini-controls" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <span className="usetag">Size</span>{WONDER_FOOTPRINT_CHOICES.map((sz) => <button className={"btn mini" + (currentWonderSize() === sz ? " primary" : "")} data-click="wonder-footprint" data-size={sz}>{sz}×{sz}</button>)}
                    <span className="usetag">Mode</span>{WONDER_MODE_CHOICES.map((mo) => <button className={"btn mini" + (currentWonderMode() === mo.id ? " primary" : "")} data-click="wonder-mode" data-mode={mo.id}>{mo.id === "single" ? "Single" : "District"}</button>)}
                  </div>
                  <div className="row wonder-mini-controls" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <span className="usetag">Colors</span>{WONDER_PALETTES.map((pal) => <button className={"btn mini swatch-btn" + (currentWonderPalette().id === pal.id ? " primary" : "")} data-click="wonder-palette" data-palette={pal.id} title={pal.name}>
                      <span style={{ display: "inline-flex", gap: 2, verticalAlign: "middle" }}>{pal.colors.slice(0,4).map((c) => <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: c, border: "1px solid rgba(255,255,255,.35)" }} />)}</span> {pal.name.replace(/ .*/, "")}
                    </button>)}
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <span className={"wonder-live-status" + (ST.wonderBusy || ST.wonderPlacing ? " busy" : "")}>{ST.wonderPlacing ? "Founding…" : ST.wonderBusy ? "Generating…" : cleanWonderPromptClient(ST.wonderPrompt) ? "Click map to found" : "Type prompt first"}</span>
                    {ST.wonderRecipe ? <span className="usetag">Ready · {ST.wonderRecipe.footprint || currentWonderSize()}×{ST.wonderRecipe.footprint || currentWonderSize()} · {ST.wonderRecipe.mode || currentWonderMode()}</span> : <span className="usetag">No plan yet</span>}
                  </div>
                  {ST.wonderMsg ? <div className="tiny">{ST.wonderMsg}</div> : null}
                </div> : null}
                {locked ? <div className="recipe-req">Unlocks at {b.unlock} claimed tiles. Capture more territory as your $CRAFTS holder capacity allows.</div> : null}
                {miss.length ? <div className="recipe-req">{missingCostLine(b.cost, m)}</div> : null}
                {isAdminKeep ? <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="btn primary" data-click="admin-spawn-keep" data-mode="here">Spawn here</button>
                  <button className="btn" data-click="admin-spawn-keep" data-mode="ring">4 around me</button>
                  <button className="btn" data-click="admin-spawn-keep" data-mode="line">3 east</button>
                </div> : <button className="btn primary" disabled={disabled || (isWonder && (ST.wonderBusy || ST.wonderPlacing))} data-click="place-building" data-id={b.id}>
                  {locked ? "Locked" : miss.length ? "Missing resources" : isWonder ? (ST.wonderPlacing ? "Founding…" : ST.wonderBusy ? "Generating…" : ST.wonderRecipe ? "Place planned Wonder" : "Plan / place Wonder") : "Place on click"}
                </button>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function InvModal() {
    const m = ST.me;
    return (
      <div className="modal">
        <h2>🎒 Inventory <span className="tiny">— drag gear onto a slot, or tap to equip</span></h2>
        <h3>Equipment</h3>
        {SLOTS.map((s) => {
          const id = m.equip?.[s], g = id ? GEAR_BY_ID[id] : null;
          return (
            <div className="slot" id={"slot-" + s} data-equip-slot={s}>
              <span><b>{SLOT_LABEL[s]}</b> — {g ? `${g.glyph} ${g.name}` : <span className="tiny">empty · drop here</span>}
                {g ? <span className="tiny">{g.atk ? ` 💥+${g.atk}` : ""}{g.def ? ` 🛡+${g.def}` : ""}{g.spd ? ` 👟+${g.spd}` : ""}</span> : null}</span>
              {g ? <button className="btn" data-click="unequip" data-slot={s}>Unequip</button> : null}
            </div>
          );
        })}
        <h3>Backpack — drag a piece onto its slot above</h3>
        <div className="packgrid">
          {(m.pack || []).map((item, i) => {
            if (!item) return <div className="packslot empty">·</div>;
            if (item.t === "relic") return (
              <div className="packslot" data-click="pack-trophy" data-name={item.n}>
                <span className="pg">🏺</span><span>{item.n}</span>
                <span className="pd" data-click="pack-drop" data-idx={i}>✕</span>
              </div>);
            if (item.t === "bomb") {
              const b = DESTROY_BY_ID[item.id];
              return <div className="packslot" data-click="pack-spawn-select" data-id={item.id}>
                <span className="pg">{b?.glyph || "✹"}</span><span>{b?.name || item.id}</span>
                <span className="pd" data-click="pack-drop" data-idx={i}>✕</span>
              </div>;
            }
            if (item.t === "use") {
              const u = USE_ITEMS[item.id];
              return <div className="packslot" aria-label={u?.blurb || "Usable supply"} data-click="use-pack-slot" data-idx={i}>
                <span className="pg">{u?.glyph || "✦"}</span><span>{u?.name || item.id}</span>
                <span className="pd" data-click="pack-drop" data-idx={i}>✕</span>
              </div>;
            }
            const g = GEAR_BY_ID[item.id];
            return (
              <div className="packslot draggable" draggable={true} data-drag-pack-idx={i}
                data-click="pack-equip" data-idx={i}>
                <span className="pg">{g?.glyph}</span><span>{g?.name}</span>
                <span className="pd" data-click="pack-drop" data-idx={i}>✕</span>
              </div>);
          })}
        </div>
      </div>
    );
  }

  function CraftModal() {
    return <div className="modal"><h2>Unavailable</h2><p className="tiny">Crafting, bombs, packs, and deployables are unavailable. Gather, capture free tiles within your $CRAFTS capacity, build starter buildings, raid carefully, and fund Landmarks with wood and stone.</p><div className="row" style={{ marginTop: 12 }}><button className="btn" data-click="modal-close">Close</button></div></div>;
  }

  function submitIntroName() {
    const input = document.getElementById("sc-intro-name") as HTMLInputElement | null;
    const name = String(input?.value || "").trim().slice(0, 18);
    if (!name) { ST.inviteError = "Choose a character name first."; sfx.err(); paint(true); return; }
    try { localStorage.setItem("solcraft.characterName", name); } catch {}
    ST.profile.name = name;
    ST.inviteError = "";
    const code = referralCodeFromIntro();
    const randomHue = Math.floor(Math.random() * 360);
    const randomBody = hslToNumber(randomHue / 360, 0.62, 0.58);
    act("setupProfile", { name, referralCode: code, body: randomBody, hat: ST.profile.hat, appearance: ST.characterProfile }).then((r) => {
      if (!r || !r.ok) {
        ST.inviteError = code
          ? (String(r?.reasonCode || "").startsWith("REFERRAL") ? (r?.msg || "That invite code is not valid or has already been used.") : "That invite code could not be applied. Check the code or leave it empty.")
          : (r?.msg || "Could not create your character yet.");
        sfx.err();
        paint(true);
        return;
      }
      ST.needsProfile = false;
      if (ST.me) { ST.me.name = name; ST.me.body = Number(r.body || r.referral?.body || randomBody) || randomBody; ST.me.hat = Number(r.hat || r.referral?.hat || ST.me.hat || ST.profile.hat) || ST.profile.hat; ST.me.profileDone = true; }
      if (r.referral?.appearance) ST.characterProfile = saveCharacterProfile({ ...ST.characterProfile, ...r.referral.appearance });
      world.refreshOwnRig();
      ST.panel = null;
      if (r.referral?.invite) {
        ST.inviteGift = r.referral;
        ST.modal = "invite-gift";
        say("Invite gift unlocked. Accept it to reveal your unique character.", 2200);
      } else {
        ST.modal = null;
        maybeStartWalkthrough(true);
        say(`${name} joined the world. Capture 3 tiles, then build your first House.`, 3600);
      }
      pollSoon(); paint(true);
    });
  }


  function InviteGiftModal() {
    const gift = ST.inviteGift || {};
    const design = String(gift.characterDesignId || gift.atlas?.id || "Founder character");
    return <div className="modal invite-gift-modal" style={{ width: "min(460px,94vw)" }}>
      <div className="invite-gift-hero"><span>🎁</span><b>Invite gift unlocked</b></div>
      <h2>Unique character design</h2>
      <p className="tiny">Your invite code grants a one-of-one doll appearance from the character atlas. Accept the gift to reveal it, then the tutorial will begin.</p>
      <div className="invite-gift-card"><b>{design}</b><span>{gift.note || "Special founder appearance ready."}</span></div>
      <button className="btn primary" data-click="invite-gift-accept">Accept gift</button>
    </div>;
  }

  function IntroModal() {
    const m = ST.me;
    return <div className="modal" style={{ width: "min(420px,94vw)" }}>
      <h2>Choose your character</h2>
      <p className="tiny">Name your character and optionally enter an invite code. Alpha invite codes may assign a one-of-one doll design from the atlas.</p>
      <div className="field"><label>Character name</label><input id="sc-intro-name" maxLength={18} placeholder="Wanderer" defaultValue={ST.profile.name || localStorage.getItem("solcraft.characterName") || (m?.name === "Wanderer" ? "" : m?.name || "")} data-keydown="intro-submit" /></div>
      <div className="field"><label>Invite code <em>optional</em></label><input data-referral-code-input="1" className="profile-referral-input" maxLength={32} placeholder="Enter invite code" defaultValue={localStorage.getItem("solcraft.referralCode") || ""} onInput={(e:any)=>{ ST.inviteError = ""; try{ localStorage.setItem("solcraft.referralCode", String(e.currentTarget.value||"").toUpperCase()); }catch{} }} /></div>
      {ST.inviteError ? <div className="invite-error" role="alert">{ST.inviteError}</div> : null}
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary" style={{ width: "100%" }} data-click="intro-submit">Enter the frontier</button></div>
    </div>;
  }

  function guideFallbackRows() {
    const firstRows = firstStepsGuideRows(ST.me);
    const oldRows = (ST.me?.quests && ST.me.quests.length ? ST.me.quests : MILESTONES.map((m, i) => ({ id: `q${i + 1}`, text: m.text, enabled: true })));
    const actionRows = oldRows.filter((q) => q.enabled !== false).map((q, i) => ({
      id: q.id || `-${i}`,
      category: i >= 5 ? "economy" : "actions",
      glyph: i >= 5 ? "🪙" : "◇",
      title: q.text,
      text: q.text,
      detail: "Core loop reminder: capture 3 tiles, gather resources, then build from an empty captured tile.",
      rewardText: "+XP / supplies",
      done: (ST.me?.msIndex || 0) > i,
      claimed: false,
    }));
    const buildIds = new Set(ST.me?.buildKinds || []);
    const buildingRows = LIBRARY.filter((b) => !["bomb", "barbcamp", "wall", "gate"].includes(b.id)).map((b) => ({
      id: `building-${b.id}`,
      category: "buildings",
      glyph: b.glyph || "▣",
      title: `Build ${b.name}`,
      text: buildingPurposeLine(b),
      detail: `Cost: ${polishCostLine(b.cost)}. Requires: ${buildingRequirementLine(b)} Produces: ${buildingProductionLine(b)}${b.unlock ? ` Unlocks after ${b.unlock} captured tiles.` : ""}`,
      rewardText: "+XP · +coins",
      done: buildIds.has(b.id),
      claimed: false,
      buildingId: b.id,
    }));
    return [...firstRows, ...actionRows, ...buildingRows];
  }
  function guideRows() {
    const rows = Array.isArray(ST.me?.guideQuests) && ST.me.guideQuests.length ? ST.me.guideQuests : guideFallbackRows();
    return rows.map((r) => ({ ...r, category: r.category || "actions", glyph: r.glyph || "◇", rewardText: r.rewardText || "Guide reward" }));
  }
  function guideVisibleRows() {
    const rows = guideRows();
    const tab = ST.questTab || "actions";
    if (tab === "done") return rows.filter((r) => r.done);
    return rows.filter((r) => r.category === tab);
  }
  function guideSummary() {
    const rows = guideRows();
    const done = rows.filter((r) => r.done).length;
    const claimed = rows.filter((r) => r.claimed).length;
    const claimable = rows.filter((r) => r.done && !r.claimed).length;
    return { rows, done, claimed, claimable, total: rows.length, pct: rows.length ? Math.round(done * 100 / rows.length) : 100 };
  }
  function scrollGuideListSoon() {
    requestAnimationFrame(() => {
      const pane = utilityRoot.querySelector?.(".quest-pop") as HTMLElement | null;
      const list = utilityRoot.querySelector?.(".quest-pop .guide-list") as HTMLElement | null;
      if (pane) pane.scrollTop = 0;
      if (list) list.scrollTop = 0;
    });
  }

  function setGuideTab(nextTab: string) {
    ST.questTab = nextTab || "actions";
    paint(true);
    scrollGuideListSoon();
  }

  function markLocalGuideClaim(id: string) {
    const quests = Array.isArray(ST.me?.guideQuests) ? ST.me.guideQuests : null;
    if (!quests) return;
    for (const q of quests) if (String(q.id) === String(id)) q.claimed = true;
    const done = quests.filter((q) => q.done).length;
    const claimed = quests.filter((q) => q.claimed).length;
    const claimable = quests.filter((q) => q.done && !q.claimed).length;
    ST.me.guideSummary = { ...(ST.me.guideSummary || {}), done, claimed, claimable, total: quests.length, pct: quests.length ? Math.round(done * 100 / quests.length) : 100 };
  }

  function guideVisitClient(id: string) {
    return act("guideVisit", { id }).then((r) => {
      if (r?.ok) {
        if (ST.me) {
          if (r.inv) ST.me.inv = r.inv;
          if (Number.isFinite(Number(r.xp))) ST.me.xp = Number(r.xp) || 0;
          if (Number.isFinite(Number(r.level))) ST.me.level = Number(r.level) || ST.me.level;
          if (Number.isFinite(Number(r.skillPts))) ST.me.skillPts = Number(r.skillPts) || 0;
          if (r.skillXp) ST.me.skillXp = r.skillXp;
        }
        markLocalGuideClaim(id);
        sfx.coin();
        pollSoon();
        paint(true);
      }
    });
  }

  function GuideTabs() {
    const rows = guideRows();
    const count = (tab) => tab === "done" ? rows.filter((r) => r.done).length : rows.filter((r) => r.category === tab).length;
    return <div className="guide-tabs">
      {GUIDE_TABS.map(([id, label]) => <button key={id} className={(ST.questTab || "actions") === id ? "btn primary" : "btn"} onClick={() => setGuideTab(id)}>{label} {count(id)}</button>)}
    </div>;
  }
  function GuideCard({ row, compact = false }: any) {
    const status = row.claimed ? "Claimed" : row.done ? "Ready" : "To do";
    return <div className={"guide-card" + (row.done ? " done" : "") + (row.claimed ? " claimed" : "")}>
      <div className="guide-glyph">{row.glyph || "◇"}</div>
      <div>
        <h4>{row.title}</h4>
        <p className="tiny">{row.text}</p>
        {!compact ? <p className="guide-detail">{row.detail}</p> : null}
        <div className="guide-meta">
          <span className={"guide-chip " + (row.done ? "ok" : "wait")}>{status}</span>
          <span className="guide-chip">{row.rewardText}</span>
          {row.done && !row.claimed ? <button className="btn primary" onClick={() => guideVisitClient(row.id)}>Claim</button> : null}
          {row.claimed ? <span className="guide-chip ok">✓ reward</span> : null}
        </div>
      </div>
    </div>;
  }
  function GuideSummaryView() {
    const g = guideSummary();
    return <div className="guide-summary">
      <span className="guide-chip ok">{g.done}/{g.total} complete</span>
      <span className="guide-chip">{g.claimed} claimed</span>
      {g.claimable ? <span className="guide-chip wait">{g.claimable} rewards ready</span> : null}
      <div className="meter"><i style={{ width: `${g.pct}%` }} /></div>
    </div>;
  }
  function QuestsModal() {
    const visible = guideRows().slice(0, 12);
    return <div className="modal" style={{ width: "min(900px,94vw)" }}>
      <h2>📜 Guide / Quests</h2>
      <p className="tiny">This is now a guidebook, not a strict quest chain. Every major action and buildable structure has its own card, explanation, and one-time reward.</p>
      <GuideSummaryView />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        <div className="card source-card"><div className="card-title">Territory coins</div><div className="tiny">{territoryCoinStatusText()}</div><div className="usetag">{territoryCoinNextStep()}</div></div>
        <div className="card"><div className="card-title">Fixed mint</div><div className="tiny">Launch rate is {GOLD_PER_CRAFTS_FIXED}🪙 = 1 $CRAFTS. Coins must be in your purse and you must stand near an active Coin Mint.</div></div>
        <div className="card"><div className="card-title">Siege rule</div><div className="tiny">PvP is intentionally light. Keeps and NPCs are coin targets; territory size comes from your connected $CRAFTS holding.</div></div>
      </div>
      <h3>Guide cards</h3>
      <div className="guide-list">{visible.map((row) => <GuideCard key={row.id} row={row} compact={false} />)}</div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn" data-click="modal-close">Close</button><button className="btn primary" data-click="toggle-panel" data-panel="quests">Open Guide</button></div>
    </div>;
  }

  function PlayerModal() {
    return <PlayerModalView target={ST.inspectPlayer} player={ST.me} worldPlayer={world?.me || ST.me} />;
  }

  function OptionsModal() {
    return <OptionsModalView visual={ST.visual} musicMuted={ST.musicMuted} uiMuted={ST.uiMuted} />;
  }

  function HelpModal() {
    return <HelpModalView />;
  }

  function WorldMapModal() {
    return <WorldMapModalView
      map={ST.map}
      admin={isAdminPlayer()}
      onDraw={(cv) => drawKnownWorldMap(cv, true)}
    />;
  }

  function MorePanel() {
    return <MorePanelView groups={MORE_MENU_GROUPS} activePanel={ST.panel} />;
  }

  function CharacterPanel() {
    const cp = ST.characterProfile || loadCharacterProfile();
    return <UtilityShell className="character-pop" title="Character" sub="Choose your body parts and colors.">
      <CharacterPanelView profile={cp} presets={CHARACTER_COLOR_PRESETS} rgba={rgba} />
    </UtilityShell>;
  }

  function QuestPanel() {
    return <UtilityShell className="quest-pop" title="Guide" sub="Independent guide cards for every core action and building. Complete any card, then claim its reward.">
      <QuestPanelView rows={guideRows()} tabs={GUIDE_TABS} activeTab={ST.questTab || "actions"} onTab={setGuideTab} onClaim={guideVisitClient} />
    </UtilityShell>;
  }

  function InventoryPanel() {
    return <UtilityShell title="Inventory" sub="Resources, gear, tools, and usable items. Use elixirs from the 7 Use ribbon.">
      <InventoryPanelView player={ST.me} />
    </UtilityShell>;
  }

  function SkillsPanel() {
    return <UtilityShell title="Skills" sub="Skills train automatically from play. Chop and mine for Gathering/Efficiency, build for Masonry, claim for Vigor, siege/craft tools for Siegecraft.">
      <SkillsPanelView player={ST.me} />
    </UtilityShell>;
  }

  function BankPanel() {
    const m = ST.me;
    if (!m) return <div />;
    const bank = ST.bank || m.bank || {};
    const cfg = bank.config || {};
    const label = cfg.tokenLabel || "SOL";
    const deposit = bank.deposit || null;
    const depositAddress = deposit?.address || "";
    const gameplayCoins = bank.gameplayCoins ?? bank.softCoins ?? String(Math.floor(m.inv?.g || 0));
    const bankTokens = bank.bankTokens?.amountUi ?? bank.withdrawableCoins ?? "0";
    const principalUi = bank.withdrawablePrincipal?.amountUi || bank.depositedPrincipal?.withdrawableUi || "0";
    const walletBalance = bank.walletBalance?.amountUi || bank.walletBalanceApproxUi || String(m.tokenBalance || 0);
    const minWithdraw = Number(cfg.minWithdrawUi || 1) || 1;
    const defaultWithdraw = Math.max(minWithdraw, Math.min(Math.floor(Number(bankTokens || 0)), Math.max(minWithdraw, 100)));
    const disabled = cfg.enabled === false || ST.spectator || !m.wallet;
    const transfersLive = cfg.withdrawalsLive === true || cfg.dryRunOnly === false;
    const bankConfigured = cfg.configured !== false && !!(cfg.token || cfg.tokenAddress);
    const cleanStatus = (w) => {
      const raw = String(w?.status || "pending").toLowerCase();
      if (raw === "dry-run" || raw === "check") return "pending";
      return raw || "pending";
    };
    const scanLabel = bank.latestDepositScan?.ts ? `Last scan ${new Date(bank.latestDepositScan.ts).toLocaleTimeString()}` : "Scan after sending";
    const recent = (bank.withdrawals || []).slice(0, 4);
    const statusBad = ST.bankMsg && /failed|disabled|error|required|could not/i.test(ST.bankMsg);
    return <UtilityShell title="Bank" sub={`Deposit ${label} to buy gameplay coins. Withdrawals are capped by your own deposited principal, not by gameplay faucets.`}>
      <div className="exchange-widget">
        <div className="exchange-hero">
          <span className="exchange-icon">↔</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4>{label} ↔ coins</h4>
            <p>Connected wallet: <b>{m.wallet ? shortWallet(m.wallet) : "not connected"}</b>. $CRAFTS is not deposited; it stays in your wallet for holder buffs.</p>
          </div>
          <button className="btn" data-click="bank-refresh" disabled={ST.bankBusy}>{ST.bankBusy ? "Working…" : "Refresh"}</button>
        </div>
        <div className="exchange-balances">
          <div className="exchange-balance"><small>Gameplay coins</small><b>{gameplayCoins}</b><em>utility</em></div>
          <div className="exchange-balance"><small>Withdrawable cap</small><b>{bankTokens}</b><em>coins · {principalUi} {label}</em></div>
          <div className="exchange-balance"><small>Wallet balance</small><b>{walletBalance}</b><em>{label}</em></div>
        </div>
        {!bankConfigured ? <div className="exchange-note bad">Bank token is not configured yet. The operator must set the SOL/token settings on the server.</div> : null}
        {!transfersLive && bankConfigured ? <div className="exchange-note warn">Withdrawals are accepting requests. Live transfers are paused until the operator enables them.</div> : null}
        {ST.bankMsg || bank.depositError ? <div className={"exchange-note " + (statusBad || bank.depositError ? "bad" : "good")}>{ST.bankMsg || bank.depositError}</div> : null}
        <div className="exchange-card deposit">
          <span className="exchange-step">1</span>
          <div><h4>Deposit to game</h4><p>Send {label} from Phantom/Solwal to this personal address, then scan. Confirmed deposits buy coins at the current bank rate.</p></div>
          <div className={"exchange-address" + (depositAddress ? "" : " empty")}>{depositAddress || (ST.bankBusy ? "Preparing your deposit address…" : "Deposit address will appear here")}</div>
          <div className="exchange-actions">
            <button className="btn" data-click="copy-text" data-label="Deposit address" data-copy={depositAddress} disabled={!depositAddress}>Copy address</button>
            <button className="btn primary" data-click="bank-scan" disabled={disabled || ST.bankBusy || !depositAddress}>I sent SOL · Scan</button>
            {!depositAddress ? <button className="btn" data-click="bank-deposit" disabled={disabled || ST.bankBusy}>Prepare address</button> : null}
          </div>
          <div className="exchange-note">{scanLabel}. Confirmed deposits credit gameplay coins.</div>
        </div>
        <div className="exchange-card withdraw">
          <span className="exchange-step">2</span>
          <div><h4>Withdraw deposited principal</h4><p>Withdraw only the principal backed by your own scanned deposits. Gameplay-earned coins remain utility coins and cannot increase this cap. Destination: <b>{shortWallet(m.wallet)}</b>.</p></div>
          <div className="exchange-input-row">
            <input id="sc-bank-withdraw-ui" type="number" min={minWithdraw} step="1" defaultValue={defaultWithdraw} placeholder="Coins to withdraw" />
            <button className="btn primary" disabled={disabled || ST.bankBusy || Number(bankTokens || 0) <= 0} data-click="bank-withdraw-request">Withdraw</button>
          </div>
          <div className="exchange-note warn">Minimum {cfg.minWithdrawUi || 1} coins. Available now: {bankTokens} principal-backed coins. {transfersLive ? "Transfers send from the configured bank wallet." : "Your request will stay pending until live transfers are enabled."}</div>
        </div>
        {recent.length ? <details className="exchange-history"><summary>Recent withdrawals</summary><div className="mini-list" style={{ marginTop: 8 }}>{recent.map((w) => <div className="mini-row"><span>◇</span><div><b>{w.coinAmount || "?"} coins → {w.amountUi} {label}</b><div className="tiny">{cleanStatus(w)} · {shortWallet(w.to || w.wallet || "")}</div></div></div>)}</div></details> : null}
      </div>
    </UtilityShell>;
  }
  function SettingsPanel() {
    return <SettingsPanelView
      ui={ST.ui}
      visual={ST.visual}
      musicMuted={ST.musicMuted}
      uiMuted={ST.uiMuted}
      clampUiScale={clampUiScale}
      uiScalePct={uiScalePct}
      cameraZoomPct={cameraZoomPct}
      uiScaleMin={UI_SCALE_MIN}
      uiScaleMax={UI_SCALE_MAX}
      uiScaleStep={UI_SCALE_STEP}
      cameraZoomMin={CAMERA_ZOOM_MIN}
      cameraZoomMax={CAMERA_ZOOM_MAX}
      UiIcon={UiIcon}
      timeControls={ST.timeControls}
    />;
  }

  function InspectPanel() {
    const uid = ST.inspect;
    const b = uid != null ? world.buildPool?.get?.(uid) : null;
    if (!b) {
      ST.inspect = null;
      ST.panel = null;
      return <div />;
    }
    const def = LIB_BY_ID[b.kind] || { id: b.kind, name: b.nm || b.kind, glyph: "▣", blurb: "A settlement structure." };
    const foundationChoices = String(b.kind || "") === FOUNDATION_KIND
      ? FOUNDATION_BUILD_KINDS.map((id) => ({ ...(LIB_BY_ID[id] || {}), id, name: LIB_BY_ID[id]?.name || foundationChoiceLabel(id), cost: LIB_BY_ID[id]?.cost || {} }))
      : [];
    return <InspectPanelView
      building={b}
      player={ST.me}
      def={def}
      inspectUid={uid}
      inspectDraft={ST.inspectDraft}
      faceImage={ST.faceImage}
      buildingColorPresets={BUILDING_COLOR_PRESETS}
      construction={constructionStateForBuilding(b)}
      territoryHint={def?.id ? captureLimitLine(def) : ""}
      estimatedBin={estAcc(b)}
      costStr={polishCostLine}
      foundationChoices={foundationChoices}
      bank={ST.bank}
    />;
  }

  function UtilityPanel() {
    if (ST.screen !== "playing" || ST.modal || !ST.panel) return <div />;
    if (ST.panel === "inspect") return <InspectPanel />;
    if (ST.panel === "object") return <ObjectPreviewPanelView preview={ST.objectPreview} />;
    if (ST.panel === "capital") return <CapitalServicePanelView service={ST.capitalService} distance={capitalServiceDistance()} />;
    if (ST.panel === "bank" && (ST.serviceAccess === "bank" || ST.serviceAccess === "market")) return <BankPanel />;
    if (ST.panel === "char" && ST.serviceAccess === "tailor") return <CharacterPanel />;
    if (ST.panel === "quests" && ST.serviceAccess === "guide") return <QuestPanel />;
    if (ST.panel === "settings") return <SettingsPanel />;
    return <div />;
  }


  function clampPx(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function walkthroughTargetRect(panel) {
    try {
      if (panel === "chop") return document.querySelector(`[data-click="gather-wood"]`)?.getBoundingClientRect?.() || null;
      if (panel === "mine") return document.querySelector(`[data-click="gather-stone"]`)?.getBoundingClientRect?.() || null;
      if (panel === "use") return document.querySelector(`[data-click="use-tool"]`)?.getBoundingClientRect?.() || null;
      if (panel === "claim") return document.querySelector(`[data-click="claim"]`)?.getBoundingClientRect?.() || null;
      if (panel === "build") return document.querySelector(`[data-click="select-build"]`)?.getBoundingClientRect?.() || null;
      if (panel === "bank") return document.querySelector(`[data-guide-target="bank"]`)?.getBoundingClientRect?.() || document.querySelector(`[data-click="open-bank"]`)?.getBoundingClientRect?.() || null;
      return document.querySelector(`[data-guide-target="${panel}"]`)?.getBoundingClientRect?.() || null;
    } catch (e) { return null; }
  }
  function rectFromStyle(left, top, width, height) { return { left, top, right: left + width, bottom: top + height, width, height }; }
  function rectIntersects(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
  function expandRect(r, pad = 8) { return { left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad, width: r.width + pad * 2, height: r.height + pad * 2 }; }
  function visibleDomRect(sel) {
    try {
      const el = document.querySelector(sel);
      if (!el) return null;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity || 1) <= 0.02) return null;
      const r = el.getBoundingClientRect?.();
      if (!r || r.width < 4 || r.height < 4) return null;
      return r;
    } catch (e) { return null; }
  }
  function walkthroughAvoidRects(panel) {
    const selectors = [".scv-hud", ".chrome-actions", ".minimap", ".action-stack", ".chat", ".channel.on", ".toast.show", ".utility-pop"];
    const target = walkthroughTargetRect(panel);
    const out = [];
    for (const sel of selectors) {
      const r = visibleDomRect(sel);
      if (!r) continue;
      if (target && Math.abs(r.left - target.left) < 2 && Math.abs(r.top - target.top) < 2 && Math.abs(r.width - target.width) < 2) continue;
      out.push(expandRect(r, 10));
    }
    return out;
  }
  function placementPenalty(rect, avoid, safe, vw, vh) {
    let score = 0;
    if (rect.left < safe || rect.top < safe || rect.right > vw - safe || rect.bottom > vh - safe) score += 100000;
    for (const r of avoid) {
      if (!rectIntersects(rect, r)) continue;
      const xOverlap = Math.max(0, Math.min(rect.right, r.right) - Math.max(rect.left, r.left));
      const yOverlap = Math.max(0, Math.min(rect.bottom, r.bottom) - Math.max(rect.top, r.top));
      score += 900 + xOverlap * yOverlap;
    }
    return score;
  }
  function walkthroughPlacement(panel) {
    const safe = 14;
    const narrow = window.innerWidth < 720;
    const w = narrow ? Math.min(window.innerWidth - safe * 2, 340) : 340;
    return {
      card: {
        right: `${safe}px`,
        top: `calc(${safe}px + env(safe-area-inset-top))`,
        left: "auto",
        width: `${Math.round(w)}px`,
        maxHeight: `min(52vh, 360px)`,
      },
      nub: null,
    };
  }

  function WalkthroughLayer() {
    if (ST.screen !== "playing" || !ST.walkthrough?.active || ST.updateRequired || ST.modal || ST.needsProfile || !ST.me?.profileDone) return <div />;
    const step = ST.walkthrough.step;
    const meta = {
      chop: { panel: "chop", title: t("walkthrough.chop.title", "Step 1: Axe"), text: t("walkthrough.chop.text", "Select the axe and click a tree. Wood drops as pickups on the map."), btn: t("walkthrough.chop.button", "Select axe"), click: "gather-wood" },
      mine: { panel: "mine", title: t("walkthrough.mine.title", "Step 2: Pickaxe"), text: t("walkthrough.mine.text", "Select the pickaxe and click stone. The cursor tells you what can be worked."), btn: t("walkthrough.mine.button", "Select pickaxe"), click: "gather-stone" },
      claim: { panel: "claim", title: t("walkthrough.claim.title", "Step 3: Capture"), text: t("walkthrough.claim.text", "Select capture and claim any free tile inside your territory capacity. Claims are free; $CRAFTS holding sets the limit."), btn: t("walkthrough.claim.button", "Select capture"), click: "claim" },
      build: { panel: "build", title: t("walkthrough.build.title", "Step 4: Build"), text: t("walkthrough.build.text", "Select the hammer, click an empty captured tile, then choose House. Red highlights explain blocked tiles before you click."), btn: t("walkthrough.build.button", "Open build"), click: "select-build" },
    }[step] || { panel: "chop", title: t("walkthrough.fallback.title", "Step 1: Axe"), text: t("walkthrough.fallback.text", "Start by gathering wood."), btn: t("walkthrough.fallback.button", "Select axe"), click: "gather-wood" };
    const place = walkthroughPlacement(meta.panel);
    return <div className="walkthrough-layer">
      <div className="walkthrough-scrim" />
      {place.nub ? <div className="walkthrough-nub" style={place.nub} /> : null}
      <div className="walkthrough-callout" style={place.card}>
        <div className="walkthrough-progress">{Math.max(1, WALK_STEPS.indexOf(step) + 1)} / {WALK_STEPS.length}</div>
        <h3>{meta.title}</h3>
        <p>{meta.text}</p>
        <div className="walkthrough-actions"><button className="btn primary" data-click={meta.click} data-panel={meta.panel}>{meta.btn}</button><button className="btn" data-click="guide-skip">{t("walkthrough.skip", "Skip")}</button></div>
      </div>
    </div>;
  }

  function ModalLayer() {
    if (ST.updateRequired) return <div className="modal-wrap"><div className="modal" style={{ width: "min(420px,94vw)", textAlign: "center" }}><h2>{t("update.title", "Update ready")}</h2><p className="tiny">{ST.updateReason || t("update.reason", "A new game build is ready. Refresh when convenient.")}</p><button className="btn primary" data-click="reload-page">{t("update.refresh", "Refresh and continue")}</button></div></div>;
    if (ST.screen === "playing" && ST.me && (ST.needsProfile || !ST.me.profileDone)) return <div className="modal-wrap"><IntroModal /></div>;
    if (ST.screen === "playing" && ST.modal === "invite-gift") return <div className="modal-wrap"><InviteGiftModal /></div>;
    if (ST.screen !== "playing" || !ST.modal) return <div />;
    return (
      <div className="modal-wrap" data-click="modal-backdrop">
        {ST.modal === "build" ? <BuildModal /> :
          ST.modal === "wonder-plan" ? <WonderPlannerModal /> :
          ST.modal === "craft" ? <CraftModal /> :
          ST.modal === "player" ? <PlayerModal /> :
          ST.modal === "wonder-view" ? <WonderViewModal /> :
          ST.modal === "worldmap" ? <WorldMapModal /> :
          ST.modal === "trade" ? <TradeModal /> :
          ST.modal === "quests" || ST.modal === "coinGuide" ? <QuestsModal /> :
          ST.modal === "options" ? <OptionsModal /> :
          <HelpModal />}
      </div>
    );
  }

  /* ============================================================
     PAINT — per-region rendering.
     Structural regions render through tradjs; live scalar values are bound
     through MicroStore. No JSON/stringify signatures on the steady path.
     ============================================================ */
  const regions = [
    { name: "hud", root: hudRoot, view: Hud },
    { name: "top", root: actionsRoot, view: TopActions },
    { name: "utility", root: utilityRoot, view: UtilityPanel },
    { name: "bottom", root: bottomRoot, view: BottomBar },
    { name: "guide", root: guideRoot, view: WalkthroughLayer },
    { name: "modal", root: modalRoot, view: ModalLayer },
    { name: "menu", root: menuRoot, view: Menu },
  ];

  // UI paint policy: keep tradjs reconciliation explicit and debuggable. The
  // canvas world can tick at rAF, but structural HUD regions only need to render
  // when their state bucket changes. We intentionally avoid JSON/stringify
  // signature gates here; changes are marked by code paths or by the conservative
  // fallback in paint(). Live HP/energy stay on MicroStore direct DOM bindings.
  const uiDirtyRegions = new Set(regions.map((r) => r.name));
  let lastMinimapPaintAt = 0;
  let lastMinimapPaintKey = "";
  const uiRegionLastPaint = new Map();
  const uiRegionMinMs = { hud: 60, top: 90, utility: 120, bottom: 120, guide: 160, modal: 90, menu: 180 };
  function markUiDirty(...names) {
    const all = !names.length || names.includes("all");
    if (all) { for (const r of regions) uiDirtyRegions.add(r.name); return; }
    for (const name of names) if (name) uiDirtyRegions.add(String(name));
  }
  function markSnapUiDirty() {
    markUiDirty("hud", "bottom", "guide");
    if (ST.panel || ST.modal) markUiDirty("utility", "modal");
    if (ST.screen !== "playing") markUiDirty("menu");
  }
  function regionCanThrottle(name, force, forceSet, now) {
    if (force || forceSet) return false;
    if (uiDirtyRegions.has(name)) return false;
    const last = Number(uiRegionLastPaint.get(name) || 0);
    return now - last < Number(uiRegionMinMs[name] || 100);
  }

  function syncToolCursor() {
    const cursor = toolCursorForState({ screen: ST.screen, mode: ST.mode, tool: ST.tool, placing: ST.placing, hover: ST.hoverIntent });
    if (root.dataset.toolCursor !== cursor) root.dataset.toolCursor = cursor;
  }

  function paint(force = false, only = null) {
    syncToolCursor();
    const paintStart = performance.now();
    let changed = 0;
    const nowForRegions = performance.now();
    const forceSet = only ? new Set(Array.isArray(only) ? only : [only]) : null;
    if (force) markUiDirty("all");
    else if (forceSet) for (const name of forceSet) markUiDirty(name);
    else if (!uiDirtyRegions.size) {
      // Conservative fallback for older call sites that still say paint()
      // without naming a region. This keeps correctness while avoiding repeated
      // utility/menu/modal reconciliation during ordinary state polling.
      markUiDirty("hud", "bottom");
      if (ST.panel) markUiDirty("utility");
      if (ST.modal) markUiDirty("modal");
      if (ST.walkthrough?.active) markUiDirty("guide");
      if (ST.screen !== "playing") markUiDirty("menu");
    }
    /* chat panel visibility is imperative */
    perf.measure("ui.hints", () => updateHints());
    chatEl.style.display = ST.screen === "playing" ? "flex" : "none";
    minimapEl.style.display = (ST.screen === "playing" && !ST.modal) ? "block" : "none";
    try {
      const miniCanvas = minimapEl?.tagName === "CANVAS" ? minimapEl : minimapEl?.querySelector?.("canvas");
      const miniKey = [ST.screen, ST.modal || "", ST.mapRev ?? "", Math.trunc(Number(ST.me?.x || 0) / 3), Math.trunc(Number(ST.me?.z || 0) / 3)].join("|");
      const nowMini = performance.now();
      // Minimap decision: keep it derived from the drawable world snapshot, but do
      // not repaint it during every unrelated HUD paint. The map changes on coarse
      // position/rev boundaries, so throttle its canvas work independently from
      // live HP/energy and action-ribbon updates.
      if (ST.screen === "playing" && !ST.modal && miniCanvas && (force || miniKey !== lastMinimapPaintKey || nowMini - lastMinimapPaintAt > 700)) {
        lastMinimapPaintKey = miniKey; lastMinimapPaintAt = nowMini;
        drawKnownWorldMap(miniCanvas, false);
        world?.updateMinimapInfo?.();
      }
    } catch {}
    vignetteEl.style.display = ST.screen === "playing" ? "block" : "none";
    if (ST.screen !== "playing" || ST.modal) hideCtx();
    let utilityRendered = false;
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (forceSet && !forceSet.has(r.name)) continue;
      if (!forceSet && !force && !uiDirtyRegions.has(r.name) && regionCanThrottle(r.name, force, forceSet, nowForRegions)) continue;
      if (!forceSet && !force && !uiDirtyRegions.has(r.name)) continue;
      const regionStart = performance.now();
      render(r.view(), r.root);
      uiRegionLastPaint.set(r.name, nowForRegions);
      uiDirtyRegions.delete(r.name);
      const regionMs = performance.now() - regionStart;
      perf.record("ui.region", regionMs, r.name);
      perf.record(`ui.region.${r.name}`, regionMs);
      if (r.name === "utility") utilityRendered = true;
      changed++;
    }
    if (ST.screen === "playing" && (ST.mode === "build" || ST.mode === "place")) syncBuildScrollSoon();
    mountWonderViewerSoon();
    if ((force && (!forceSet || forceSet.has("utility"))) || utilityRendered) syncMiniPreviewPanels(utilityRoot);
    bindLiveHudBindings();
    const paintMs = performance.now() - paintStart;
    perf.record("ui.paint", paintMs, { force, only, changed });
    perfMini.update({ paint: paintMs });
  }

  /* ---------- live scalar ticker: selector-scoped MicroStore bindings ---------- */
  const tick = scheduler.every("ui.liveTicker", 250, () => {
    if (ST.screen !== "playing" || !ST.me) return;
    perf.measure("ui.liveTicker", () => {
      world?.refreshConstructionProgress?.();
      try {
        const ms = world?.movementState?.();
        const rc = ms?.renderCounters || {};
        perfMini.update({
          frame: Number(ms?.renderDtMs || 0),
          quality: ms?.renderQuality || "",
          cells: world?.cells?.size || 0,
          terrain: rc.terrainTilesDrawn || 0,
          entities: rc.entitiesDrawn || rc.entitiesSorted || 0,
          weather: rc.weatherDrawn || 0,
          staticMs: rc.staticRebuildMs || 0,
          dynamicMs: rc.dynamicDrawMs || 0,
          prisms: rc.prismPartsDrawn || 0,
          particles: rc.particlesDrawn || 0,
          sprites: rc.spriteDraws || 0,
          slices: rc.buildingSlicesDrawn || 0,
          patches: rc.terrainBlendPatches || 0,
          fillers: rc.blockFillersDrawn || 0,
          organic: rc.resourceOrganicDraws || 0,
          snapped: rc.snappedDrawImages || 0,
          selftest: rc.featureSelfTestFailures || 0,
          cache: `${rc.staticCacheHits || 0}/${rc.staticCacheMisses || 0} · spr ${rc.spriteCacheHits || 0}/${rc.spriteCacheMisses || 0}`,
          skipped: rc.staticSkipped || 0,
        });
      } catch {}
      const m = ST.me, e = liveE();
      liveHudStore.patch({
        energyNow: Math.floor(Math.max(0, e)),
        energyPct: Math.max(0, Math.min(100, 100 * e / Math.max(1, Number(m.maxE || 1)))),
        hpNow: Math.ceil(Math.max(0, Number(m.hp || 0))),
        hpPct: 100 * Math.max(0, Number(m.hp || 0)) / Math.max(1, MAX_HP),
      });
    });
  });

  /* ============================================================
     BOOT
     ============================================================ */
  // Run a cheap heartbeat so desiredPollInterval() can adapt to recent
  // actions, hidden tabs, failures, and local movement without rebuilding the
  // scheduler. Most heartbeats intentionally do no network work.
  pollT = scheduler.every("state.poll.heartbeat", POLL_HEARTBEAT_MS, () => poll(), { immediate: false });
  paint(true);
  if (ST.auth) setTimeout(() => startPlaying(), 0);

  return () => {
    scheduler.cancel(pollT);
    scheduler.cancel(nearT);
    scheduler.cancel(tick);
    scheduler.cancel(channelT);
    scheduler.cancel(keyboardMoveT);
    scheduler.clear();
    liveHudUnsubs.forEach((fn) => { try { fn(); } catch {} });
    liveHudUnsubs = [];
    clearTimeout(toastT);
    clearTimeout(pollSoonT);
    clearTimeout(appearanceSaveT);
    clearTimeout(appearanceRigT);
    worldEl.removeEventListener("pointermove", onPointerMove);
    worldEl.removeEventListener("pointerdown", onPointerDown);
    worldEl.removeEventListener("wheel", onWheel);
    worldEl.removeEventListener("contextmenu", onContext);
    disposeMiniPreviews();
    document.removeEventListener("contextmenu", preventGameContext, { capture: true });
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", clearHeldMoveKeys);
    hudEl.removeEventListener("click", onDelegatedHudClick, true);
    hudEl.removeEventListener("input", onDelegatedHudInput, true);
    hudEl.removeEventListener("change", onDelegatedHudChange, true);
    hudEl.removeEventListener("keydown", onDelegatedHudKeyDown, true);
    hudEl.removeEventListener("pointerdown", onDelegatedHudPointerDown, true);
    hudEl.removeEventListener("pointerover", onDelegatedHudPointerOver, true);
    hudEl.removeEventListener("pointermove", onDelegatedHudPointerMove, true);
    hudEl.removeEventListener("pointerout", onDelegatedHudPointerOut, true);
    hudEl.removeEventListener("wheel", onDelegatedHudWheel, true);
    hudEl.removeEventListener("scroll", onDelegatedHudScroll, true);
    hudEl.removeEventListener("dragstart", onDelegatedHudDragStart, true);
    hudEl.removeEventListener("dragend", onDelegatedHudDragEnd, true);
    hudEl.removeEventListener("dragover", onDelegatedHudDragOver, true);
    hudEl.removeEventListener("dragleave", onDelegatedHudDragLeave, true);
    hudEl.removeEventListener("drop", onDelegatedHudDrop, true);
    world.dispose();
    perf.dispose();
    for (const r of regions) render(null, r.root);
    root.replaceChildren();
  };
}