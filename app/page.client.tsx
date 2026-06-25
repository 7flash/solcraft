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
import * as THREE from "three";
import {
  BOMB_ITEM_COST, BODY_COLORS, COLOR_CHOICES, COSTI, DESTROY_BY_ID, DESTROY_TOOLS, ECONOMY, FINAL_TEXT, GEAR_BY_ID, HAT_COLORS, GOLD_MINE_KIND, GOLD_PER_CRAFTS_FIXED, WORLD_WONDER_COST, WORLD_WONDER_GLOBAL_COIN_BONUS_PCT, WORLD_WONDER_PLAZA_RADIUS, WORLD_WONDER_PLAZA_SIZE as SHARED_WONDER_PLAZA_SIZE, WORLD_WONDER_PLAZA_TILES as SHARED_WONDER_PLAZA_TILES, WORLD_WONDER_BUILD_MS, NORMAL_BUILDING_BUILD_MS, DECOR_BUILDING_BUILD_MS,
  LIBRARY, LIB_BY_ID, MAX_HP, MAX_LEVEL, MILESTONES, MOVE_COST, N4, N8, NPC_TRADES, PACK_SIZE,
  RECIPES, REDEEM_MIN_GOLD, RES_KEYS, RES_NAMES, SKILLS, SLOTS, SLOT_LABEL, USE_ITEMS,
  biomeAt, biomeTerrainAt, cheb, gearStat, harvestMs, hrand, key, lvlMul, naturalDoodad, proceduralNpcAt, repairCost,
  skillLvl, tradePostAt, upgradeCost, xpForLevel,
} from "@server/shared";
import {
  M, ME, buildBanner, lootMesh,
  makeLabel, makeSfx,
} from "../client/meshes";
import { loadAtlasRuntimeConfig, terrainMats, tickVisualTextures } from "../client/textures";
import { capitalBuildingsInView, capitalLabelVisibleForPlayer } from "../client/world/capitalLayout";
import { makePlayerBillboard } from "../client/world/playerBillboard";
import { playerBillboardSignature } from "../client/world/playerBillboardModel";
import { capitalServiceForBuilding, capitalServiceAvailable } from "../client/world/capitalServices";
import { capitalBlocksNaturalResource, capitalBlocksPlayerTerritory } from "@server/capitalRules";
import { FOUNDATION_KIND, FOUNDATION_BUILD_KINDS, foundationChoiceLabel } from "@server/foundationRules";
import { loadCharacterProfile, saveCharacterProfile, type CharacterProfile } from "../client/dollProfile";
import { isMoveKey, movementVectorFromKeys, normalizeMoveKey } from "../client/game/directionalInput";
import { DEFAULT_KEYBOARD_STEP_MS } from "../client/game/keyboardStepper";
import { MovementPredictor } from "../client/game/movementPredictor";
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
import { SpatialGridCache } from "../client/world/spatialGridCache";
import { buildingRecipeFor, recipeVisibleParts } from "../client/world/buildingRecipes";
import { maxRecipeHeight, renderRecipeParts } from "../client/world/buildingRecipeRenderer";
import { resourceRecipeFor } from "../client/world/resourceRecipes";
import { disposeObject3D } from "../client/world/sceneMemoryAssetManager";
import { WorldMapModalView } from "../client/ui/worldMapModal";
import { PlayerModalView } from "../client/ui/playerModal";
import { renderKnownWorldMap, tileFromCanvasEvent } from "../client/world/mapCanvas";
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
    const data = { ping: 0, paint: 0, frame: 0, cells: 0, chunks: 0, draws: 0, tris: 0, resources: 0, last: 0 };
    function update(partial: any = {}) {
      if (!perfOverlayEnabled) return;
      Object.assign(data, partial || {});
      const now = performance.now();
      if (now - data.last < 180) return;
      data.last = now;
      const ping = data.ping ? `${Math.round(data.ping)}ms` : "—";
      el.textContent = `ping ${ping} · frame ${Math.round(data.frame || 0)}ms · ui ${Math.round(data.paint || 0)}ms · draw ${Math.round(data.draws || 0)} · tri ${Math.round(data.tris || 0)} · res ${Math.round(data.resources || 0)} · cells ${Math.round(data.cells || 0)}`;
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

  /* ---------- NET: anchor/rev protocol ---------- */
  let pollT = null, pollBusy = false, pollSoonT = null;
  async function poll(force = false) {
    if (!ST.auth || pollBusy || (!force && ST.screen !== "playing")) return false;
    const a = { ...ST.auth };
    pollBusy = true;
    const pollStartedAt = performance.now();
    const r = await perf.measureAsync("net.state", () => api("/api/state", { pid: a.pid, secret: a.secret, rev: ST.rev, ax: ST.ax, az: ST.az, chat: ST.chatId, mapRev: ST.mapRev ?? -1 }), { rev: ST.rev, mapRev: ST.mapRev ?? -1 });
    perfMini.update({ ping: performance.now() - pollStartedAt });
    pollBusy = false;
    if (!r || !r.ok) {
      if (r && r.msg === "auth") {
        localStorage.removeItem(AUTH_KEY);
        ST.auth = null; ST.walletVerified = false; ST.spectator = false; ST.profile.wallet = ""; ST.screen = "menu"; ST.me = null;
        ST.rev = 0; ST.ax = 1e6; ST.az = 1e6; ST.chatId = 0; ST.mapRev = -1;
        paint(true);
      }
      return false;
    }
    if (!ST.auth || ST.auth.pid !== a.pid || ST.auth.secret !== a.secret) return false;
    perf.measure("snap.apply", () => applySnap(r.snap), { rev: r.snap?.rev, players: r.snap?.players?.length || 0, buildings: r.snap?.buildings?.length || 0 });
    return true;
  }
  const pollSoon = () => { clearTimeout(pollSoonT); pollSoonT = setTimeout(() => poll(true), 120); };

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


  function worldMapData(expanded = false) {
    const allTiles = Array.isArray(ST.map?.tiles) ? ST.map.tiles : [];
    const allBuildings = Array.isArray(ST.map?.buildings) ? ST.map.buildings : [];
    const allLoot = Array.isArray(ST.map?.loot) ? ST.map.loot : [];
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
     THREE WORLD
     ============================================================ */
  const world = (() => {
    const W = () => worldEl.clientWidth || 1, H = () => worldEl.clientHeight || 1;
    const lowEnd = Math.min(window.innerWidth, window.innerHeight) < 760 || (navigator.hardwareConcurrency || 4) <= 4;
    let visualPerf = visualPerfFor(ST.visual, lowEnd);
    const renderer = new THREE.WebGLRenderer({ antialias: visualPerf.antialias, powerPreference: "high-performance" });
    function applyVisualQuality(nextVisual = ST.visual) {
      visualPerf = visualPerfFor(nextVisual, lowEnd);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, visualPerf.pixelRatioCap));
      const showClouds = visualPerf.quality !== "fast" && visualPerf.motion !== "low";
      try { for (const c of clouds || []) c.visible = showClouds; } catch {}
      setFrustum?.();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, visualPerf.pixelRatioCap));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = false; // stable mobile-friendly lighting; avoids tree-shadow flicker while moving
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    worldEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const sky = { cv: document.createElement("canvas"), ctx: null, tex: null, bucket: -1 };
    {
      sky.cv.width = 2; sky.cv.height = 512;
      sky.ctx = sky.cv.getContext("2d");
      sky.tex = new THREE.CanvasTexture(sky.cv);
      scene.background = sky.tex;
    }
    scene.fog = new THREE.Fog(0xb7a77a, 26, 64);

    let view = 7.6;
    function responsiveView() {
      const w = W(), h = H();
      const minSide = Math.min(w, h);
      const aspect = w / Math.max(1, h);
      const zoom = clampCameraZoom(ST.visual?.cameraZoom, 1);
      let base = 7.6;
      if (minSide < 430) base = 8.95;
      else if (minSide < 640) base = 8.35;
      else if (aspect > 1.8) base = 7.35;
      return base * zoom;
    }
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const setFrustum = () => {
      view = responsiveView();
      const a = W() / H();
      camera.left = -view * a; camera.right = view * a;
      camera.top = view; camera.bottom = -view;
      camera.updateProjectionMatrix();
      applyFogDistance();
    };
    function currentTileLoadRadius() {
      const aspect = W() / Math.max(1, H());
      // Keep the 3D world light. The expanded minimap gives global overview without
      // streaming/rendering the entire infinite world into Three.js.
      const needed = Math.ceil(view * Math.max(1, aspect) + 12);
      return Math.max(22, Math.min(TILE_LOAD_R_MAX, needed));
    }
    function applyFogDistance(day: any = null) {
      const zoom = clampCameraZoom(ST.visual?.cameraZoom, 1);
      const near = day == null ? Math.max(24, 16 * zoom) : 24 + Number(day || 0) * 5;
      const zoomFar = day == null ? Math.max(58, 54 * zoom) : Math.max(58, 56 + Number(day || 0) * 14);
      const streamFar = Math.max(58, currentTileLoadRadius() * 0.9);
      scene.fog.near = near;
      scene.fog.far = Math.max(near + 18, Math.min(zoomFar, streamFar));
    }
    setFrustum();
    function desiredCameraOffset() {
      const yaw = normalizeCameraYaw(ST.visual?.cameraYaw, Math.PI / 4);
      const horizontal = 18.4;
      return new THREE.Vector3(Math.cos(yaw) * horizontal, 14, Math.sin(yaw) * horizontal);
    }
    const camOffset = desiredCameraOffset();
    const camTarget = new THREE.Vector3(0, 0.22, 0);
    camera.position.copy(camOffset); camera.lookAt(camTarget);

    const hemi = new THREE.HemisphereLight(0xffefd8, 0x6f614f, 1.08); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffdfaa, 1.15);
    sun.position.set(8, 14, 5); sun.castShadow = false;
    sun.shadow.mapSize.set(lowEnd ? 512 : 1024, lowEnd ? 512 : 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 60 });
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xd8bfa0, 0.45);
    fill.position.set(-8, 6, -6); scene.add(fill);
    const sunOffset = new THREE.Vector3(8, 14, 5);
    function updateEnvironment(t) {
      // Lightweight day/night cycle: color/intensity changes only, no expensive shaders.
      // For production playtest the cycle can be frozen from Settings so terrain readability stays stable.
      const hour = currentWorldHour(ST, Date.now());
      const phase = Math.max(0, Math.min(23, hour)) / 24;
      const wave = Math.sin(phase * Math.PI * 2 - Math.PI * 0.5);
      const day = ST.timeControls?.auto === false ? 0.82 : Math.max(0.42, 0.5 + 0.5 * wave);
      const dusk = 1 - Math.abs(day - 0.5) * 2;
      sun.intensity = 0.35 + day * 1.05;
      hemi.intensity = 0.48 + day * 0.68;
      fill.intensity = 0.18 + (1 - day) * 0.45;
      renderer.toneMappingExposure = 0.82 + day * 0.34;
      sun.color.set(day < 0.28 ? 0x9bb7ff : dusk > 0.55 ? 0xffbd83 : 0xffdfaa);
      hemi.color.set(day < 0.28 ? 0xaec4ff : 0xffefd8);
      hemi.groundColor.set(day < 0.28 ? 0x283452 : 0x6f614f);
      scene.fog.color.set(day < 0.28 ? 0x222d4a : dusk > 0.55 ? 0x93745f : 0xb7a77a);
      applyFogDistance(day);
      const angle = phase * Math.PI * 2;
      sunOffset.set(Math.cos(angle) * 12, 5 + day * 11, Math.sin(angle) * 12);
      const bucket = Math.floor(day * 16 + dusk * 4);
      if (bucket !== sky.bucket && sky.ctx) {
        sky.bucket = bucket;
        const top = day < 0.28 ? "#18264b" : dusk > 0.55 ? "#5b426d" : "#4b77ad";
        const mid = day < 0.28 ? "#26345a" : dusk > 0.55 ? "#936168" : "#82a6c8";
        const low = day < 0.28 ? "#3a3f58" : dusk > 0.55 ? "#d2a06f" : "#c7b989";
        const gr = sky.ctx.createLinearGradient(0, 0, 0, 512);
        gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, low);
        sky.ctx.fillStyle = gr; sky.ctx.fillRect(0, 0, 2, 512);
        sky.tex.needsUpdate = true;
      }
    }
    updateEnvironment(0);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), M(0x456f73, { roughness: 1 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -0.38; scene.add(sea);

    { const n = 90, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i*3]=(Math.random()-0.5)*60; pos[i*3+1]=6+Math.random()*15; pos[i*3+2]=(Math.random()-0.5)*60; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xfff6dd, size: 0.06, transparent: true, opacity: 0.55, depthWrite: false }); m.fog = false;
      scene.add(new THREE.Points(g, m)); }
    { const pos = new Float32Array(28 * 3);
      for (let i = 0; i < 28; i++) { pos[i*3]=(Math.random()-0.5)*28; pos[i*3+1]=Math.random()*4.5; pos[i*3+2]=(Math.random()-0.5)*28; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x14f195, size: 0.08, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }))); }
    const clouds = [];
    const cloudCount = (visualPerf.quality === "fast" || visualPerf.motion === "low") ? 0 : (visualPerf.quality === "balanced" ? 2 : 4);
    for (let i = 0; i < cloudCount; i++) {
      const c = new THREE.Group();
      const cm = M(0xffffff, { transparent: true, opacity: 0.75, roughness: 1 });
      for (let j = 0; j < 3; j++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.5, 8, 6), cm); s.position.set(j*0.7-0.7, Math.random()*0.2, Math.random()*0.4); s.scale.y = 0.5; c.add(s); }
      c.position.set((Math.random()-0.5)*44, 7+Math.random()*3, (Math.random()-0.5)*44);
      c.userData.v = 0.2 + Math.random() * 0.25; scene.add(c); clouds.push(c);
    }

    // Fixed-camera render budget: terrain is batched, but it must still speak the
    // same visual language as the static world.  A flat PlaneGeometry made the world
    // look like a texture with objects floating above it; this slab keeps a top face
    // plus two visible sides while still drawing as only a few instanced batches.
    const TERRAIN_TOP_Y = 0.055;
    const STATIC_WORLD_BASE_Y = TERRAIN_TOP_Y - 0.002;
    function createTerrainSlabGeometry() {
      // Visual readability pass: terrain is a continuous floor, not one raised
      // mini-slab per tile. Side faces on every tile drew the loud black lattice
      // seen in playtest screenshots. Keep only the top face and reserve strong
      // outlines for hover/selection/placement feedback.
      const pos = [];
      const pushFace = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      const At = [-0.5, 1, -0.5], Bt = [0.5, 1, -0.5], Ct = [0.5, 1, 0.5], Dt = [-0.5, 1, 0.5];
      pushFace(At, Bt, Ct, Dt);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.addGroup(0, 6, 0);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      return geo;
    }
    const tileGeo = createTerrainSlabGeometry();
    tileGeo.userData.shared = true;
    const terrainBatchRoot = new THREE.Group(); scene.add(terrainBatchRoot);
    const terrainBatchMeshes = new Map(), terrainBatchMatCache = new Map();
    const batchDummy = new THREE.Object3D();
    let terrainBatchSig = "";
    const neutralMats = () => terrainMats("sand");
    const ownerMatCache = new Map();
    function shadeHexNumber(hex, amt = 0) {
      const c = new THREE.Color(Number(hex) || 0x3f3120);
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      hsl.l = Math.max(0.03, Math.min(0.96, hsl.l + amt));
      hsl.s = Math.max(0, Math.min(1, hsl.s * (amt > 0 ? 0.94 : 1.04)));
      c.setHSL(hsl.h, hsl.s, hsl.l);
      return c.getHex();
    }
    function territoryTopHex(color, mine) {
      const base = new THREE.Color(0x78bd7f);
      const oc = new THREE.Color(Number(color) || 0x14f195);
      return base.lerp(oc, mine ? 0.18 : 0.34).getHex();
    }
    function ownerMats(color, mine) {
      const ck = `${color}:${mine ? 1 : 0}`;
      if (ownerMatCache.has(ck)) return ownerMatCache.get(ck);
      // Owned territory uses the exact character/base color as a textured claim layer.
      // This keeps selected character color and claimed tiles visually coherent.
      const arr = terrainMats("claimed", Number(color) || 0x14f195);
      ownerMatCache.set(ck, arr);
      return arr;
    }
    function buildingPlinthHex(b) {
      // Keep foundations visually separate from claimed terrain.  Passing the
      // owner's tile color into building plinths made roof/foundation top faces
      // blend into the ground, especially in the capital cluster.  Ownership now
      // lives in small accents/flags; foundations stay stone/umber by building type.
      const k = String(b?.kind || "building").toLowerCase();
      if (k === "quarry") return "#6b7166";
      if (k === "bank" || k === "vault" || k === "goldmine") return "#74643d";
      if (k === "farm" || k === "granary" || k === "windmill") return "#6e5632";
      if (k === "lumber" || k === "sawmill") return "#65472c";
      if (k === "keep" || k === "watchtower" || k.includes("gate")) return "#696044";
      if (k === "worldwonder" || k === "obelisk" || k === "shrine") return "#6e623e";
      return "#67583a";
    }
    function terrainBatchKeyForCell(k) {
      const t = tileOwner.get(k);
      if (!t) return "neutral";
      const mine = ST.me && Number(t.owner) === Number(ST.me.id);
      return `owned:${mine ? 1 : 0}:${Math.trunc(Number(t.body) || 0)}`;
    }
    function terrainTopForBatchKey(batchKey) {
      if (batchKey === "neutral") return 0x3e5f49;
      const [, mine, body] = String(batchKey).split(":");
      return territoryTopHex(Number(body) || 0x14f195, mine === "1");
    }
    function terrainTopColorForCell(batchKey, c) {
      const base = terrainTopForBatchKey(batchKey);
      const out = new THREE.Color(shadeHexNumber(base, 0.00));
      const hsl = { h: 0, s: 0, l: 0 };
      out.getHSL(hsl);
      const n = hrand(c.cx, c.cz, 91) - 0.5;
      const broad = hrand(Math.floor(c.cx / 4), Math.floor(c.cz / 4), 133) - 0.5;
      const owned = batchKey !== "neutral";
      hsl.l = Math.max(0.08, Math.min(0.68, hsl.l + n * (owned ? 0.026 : 0.064) + broad * (owned ? 0.018 : 0.044)));
      hsl.s = Math.max(0.12, Math.min(0.78, hsl.s * (owned ? 0.94 : 0.86)));
      out.setHSL(hsl.h, hsl.s, hsl.l);
      return out;
    }
    function terrainBatchMat(batchKey) {
      if (terrainBatchMatCache.has(batchKey)) return terrainBatchMatCache.get(batchKey);
      // White material + per-instance colors gives subtle tile variation without
      // adding materials, textures, or a visible debug grid.
      const mats = [new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, depthWrite: true })];
      for (const mat of mats) mat.userData.shared = true;
      terrainBatchMatCache.set(batchKey, mats);
      return mats;
    }
    function rebuildTerrainBatches(force = false) {
      const buckets = new Map();
      for (const [k, c] of cells) {
        const bk = terrainBatchKeyForCell(k);
        if (!buckets.has(bk)) buckets.set(bk, []);
        buckets.get(bk).push(c);
      }
      const sig = [...buckets.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([bk, rows]) => {
        const first = rows[0], last = rows[rows.length - 1];
        return `${bk}:${rows.length}:${first?.cx},${first?.cz}:${last?.cx},${last?.cz}`;
      }).join("|");
      if (!force && sig === terrainBatchSig) return;
      terrainBatchSig = sig;
      for (const mesh of terrainBatchMeshes.values()) disposeSceneObject(mesh);
      terrainBatchMeshes.clear();
      for (const [bk, rows] of buckets) {
        const mesh = new THREE.InstancedMesh(tileGeo, terrainBatchMat(bk), rows.length);
        mesh.frustumCulled = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 0;
        for (let i = 0; i < rows.length; i++) {
          const c = rows[i];
          batchDummy.position.set(c.cx, 0, c.cz);
          batchDummy.rotation.set(0, 0, 0);
          batchDummy.scale.set(1.006, TERRAIN_TOP_Y, 1.006);
          batchDummy.updateMatrix();
          mesh.setMatrixAt(i, batchDummy.matrix);
          if (mesh.setColorAt) mesh.setColorAt(i, terrainTopColorForCell(bk, c));
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        terrainBatchRoot.add(mesh);
        terrainBatchMeshes.set(bk, mesh);
      }
    }

    // The previous pass removed the screaming black grid, but a perfectly flat
    // green field made buildings feel like they were floating in a void.  This
    // detail layer adds sparse, deterministic, low-opacity ground marks: enough
    // scale/context to read the floor without bringing the debug lattice back.
    const groundDetailRoot = new THREE.Group(); scene.add(groundDetailRoot);
    const groundDetailGeo = new THREE.PlaneGeometry(1, 1);
    groundDetailGeo.userData.shared = true;
    const groundDetailMats = [
      new THREE.MeshBasicMaterial({ color: 0x66896a, transparent: true, opacity: 0.165, depthWrite: false, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0x2c4a39, transparent: true, opacity: 0.150, depthWrite: false, side: THREE.DoubleSide }),
      new THREE.MeshBasicMaterial({ color: 0x9a8a59, transparent: true, opacity: 0.112, depthWrite: false, side: THREE.DoubleSide }),
    ];
    for (const mat of groundDetailMats) mat.userData.shared = true;
    const groundDetailMeshes = new Map();
    let groundDetailSig = "";
    function rebuildGroundDetails(force = false) {
      const buckets = new Map();
      for (const [k, c] of cells) {
        const n = hrand(c.cx, c.cz, 211);
        const occupied = !!buildAt.get(k) || !!doodadPool.get(k) || !!tradePostPool.get(k);
        if (occupied) continue;
        if (n > 0.64) continue;
        const type = n < 0.13 ? 2 : n < 0.27 ? 1 : 0;
        if (!buckets.has(type)) buckets.set(type, []);
        buckets.get(type).push(c);
      }
      const sig = [...buckets.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([type, rows]) => {
        const first = rows[0], last = rows[rows.length - 1];
        return `${type}:${rows.length}:${first?.cx},${first?.cz}:${last?.cx},${last?.cz}`;
      }).join("|");
      if (!force && sig === groundDetailSig) return;
      groundDetailSig = sig;
      for (const mesh of groundDetailMeshes.values()) disposeSceneObject(mesh);
      groundDetailMeshes.clear();
      for (const [type, rows] of buckets) {
        const mesh = new THREE.InstancedMesh(groundDetailGeo, groundDetailMats[type] || groundDetailMats[0], rows.length);
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        for (let i = 0; i < rows.length; i++) {
          const c = rows[i];
          const jx = (hrand(c.cx, c.cz, 212) - 0.5) * 0.42;
          const jz = (hrand(c.cx, c.cz, 213) - 0.5) * 0.42;
          const sx = type === 2 ? 0.56 : 0.18 + hrand(c.cx, c.cz, 214) * 0.22;
          const sz = type === 2 ? 0.30 : 0.035 + hrand(c.cx, c.cz, 215) * 0.055;
          batchDummy.position.set(c.cx + jx, TERRAIN_TOP_Y + 0.012, c.cz + jz);
          batchDummy.rotation.set(-Math.PI / 2, 0, hrand(c.cx, c.cz, 216) * Math.PI);
          batchDummy.scale.set(sx, sz, 1);
          batchDummy.updateMatrix();
          mesh.setMatrixAt(i, batchDummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        groundDetailRoot.add(mesh);
        groundDetailMeshes.set(type, mesh);
      }
    }

    const cells = new Map(), doodadPool = new Map(), buildPool = new Map(), buildAt = new Map(), npcPool = new Map();
    const lootPool = new Map(), rigPool = new Map(), tradePostPool = new Map(), exceptions = new Map(), tileOwner = new Map();
    const buildVisibilityGrid = new SpatialGridCache(16), lootVisibilityGrid = new SpatialGridCache(16), npcVisibilityGrid = new SpatialGridCache(16);
    let visibleBuilds = new Set(), visibleLoot = new Set(), visibleNpcs = new Set();
    const roadPool = new Map(), districtPool = new Map();
    const prismMatCache = new Map(), prismMatsCache = new Map();
    function cssHex(v, fallback = "#ffd76e") {
      if (typeof v === "number" && Number.isFinite(v)) return `#${new THREE.Color(v).getHexString()}`;
      const s = String(v || "").trim();
      return /^#[0-9a-f]{6}$/i.test(s) ? s : fallback;
    }
    function shadeHex(hex, amt = 0) {
      const c = new THREE.Color(cssHex(hex));
      const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
      hsl.l = Math.max(0.04, Math.min(0.96, hsl.l + amt));
      hsl.s = Math.max(0, Math.min(1, hsl.s * (amt > 0 ? 0.94 : 1.04)));
      c.setHSL(hsl.h, hsl.s, hsl.l);
      return `#${c.getHexString()}`;
    }
    function liftDarkHex(hex, floor = 0.13) {
      const c = new THREE.Color(cssHex(hex));
      const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
      hsl.l = Math.max(floor, Math.min(0.92, hsl.l));
      hsl.s = Math.max(0, Math.min(1, hsl.s * 0.94));
      c.setHSL(hsl.h, hsl.s, hsl.l);
      return `#${c.getHexString()}`;
    }
    function createStaticPrismGeometry() {
      const pos = [];
      const pushFace = (a, b, c, d) => {
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      };
      // One fixed-camera world primitive: top + two visible rectangular sides.
      // Origin is the center of the footprint at the bottom of the prism.
      const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5];
      const At = [-0.5, 1, -0.5], Bt = [0.5, 1, -0.5], Ct = [0.5, 1, 0.5], Dt = [-0.5, 1, 0.5];
      pushFace(At, Bt, Ct, Dt); // top
      pushFace(D, C, Ct, Dt);   // near side
      pushFace(C, B, Bt, Ct);   // right side
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.addGroup(0, 6, 0);
      geo.addGroup(6, 6, 1);
      geo.addGroup(12, 6, 2);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      return geo;
    }
    const staticPrismGeo = createStaticPrismGeometry();
    staticPrismGeo.userData.shared = true;
    function staticPrismMaterial(hex) {
      const k = cssHex(hex, "#ffd76e").toLowerCase();
      if (!prismMatCache.has(k)) { const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(k), depthWrite: true, depthTest: true }); mat.userData.shared = true; prismMatCache.set(k, mat); }
      return prismMatCache.get(k);
    }
    function prismMats(top, left = null, right = null) {
      const t = shadeHex(top, 0.09), l = liftDarkHex(left || shadeHex(top, -0.06), 0.20), r = liftDarkHex(right || shadeHex(top, -0.11), 0.17);
      const k = `${t}|${l}|${r}`.toLowerCase();
      if (!prismMatsCache.has(k)) prismMatsCache.set(k, [staticPrismMaterial(t), staticPrismMaterial(l), staticPrismMaterial(r)]);
      return prismMatsCache.get(k);
    }
    function prismFaceKey(top, left = null, right = null) {
      return `${shadeHex(top, 0.09)}|${liftDarkHex(left || shadeHex(top, -0.06), 0.20)}|${liftDarkHex(right || shadeHex(top, -0.11), 0.17)}`.toLowerCase();
    }
    function addPrismMesh(group, parts, spec = {}) {
      const top = cssHex(spec.top || spec.color || "#ffd76e");
      const mesh = new THREE.Mesh(staticPrismGeo, prismMats(top, spec.left, spec.right));
      mesh.position.set(Number(spec.x || 0), Number(spec.y || 0), Number(spec.z || 0));
      mesh.scale.set(Math.max(0.01, Number(spec.w || 1)), Math.max(0.01, Number(spec.h || 1)), Math.max(0.01, Number(spec.d || 1)));
      mesh.renderOrder = Number(spec.renderOrder || 4);
      mesh.userData.staticPrism = true;
      group.add(mesh);
      parts?.push?.(mesh);
      return mesh;
    }
    function resourcePrismRecipe(type) {
      return resourceRecipeFor(type, STATIC_WORLD_BASE_Y);
    }
    const resourceBatchRoot = new THREE.Group(); scene.add(resourceBatchRoot);
    const resourceBatchMeshes = new Map();
    let resourceBatchSig = "";
    function rebuildResourceBatches(force = false) {
      const buckets = new Map();
      for (const [k, d] of doodadPool) {
        if (!d || !d.type || !cells.has(k)) continue;
        const recipe = resourcePrismRecipe(d.type);
        const baseJx = (hrand(d.x, d.z, 5) - 0.5) * 0.16;
        const baseJz = (hrand(d.x, d.z, 6) - 0.5) * 0.16;
        const baseScale = 1.10 + hrand(d.x, d.z, 7) * 0.20;
        for (const spec of recipe) {
          const faceKey = prismFaceKey(spec.top, spec.left, spec.right);
          const bucketKey = `${d.type}:${spec.k}:${faceKey}`;
          if (!buckets.has(bucketKey)) buckets.set(bucketKey, { spec, rows: [] });
          buckets.get(bucketKey).rows.push({
            x: d.x + baseJx + Number(spec.ox || 0),
            y: Number(spec.y || 0),
            z: d.z + baseJz + Number(spec.oz || 0),
            w: Number(spec.w || 1) * baseScale,
            h: Number(spec.h || 1) * baseScale,
            d: Number(spec.d || 1) * baseScale,
          });
        }
      }
      const sig = [...buckets.entries()].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([bk, bucket]) => {
        const rows = bucket.rows, first = rows[0], last = rows[rows.length - 1];
        return `${bk}:${rows.length}:${first?.x?.toFixed?.(2)},${first?.z?.toFixed?.(2)}:${last?.x?.toFixed?.(2)},${last?.z?.toFixed?.(2)}`;
      }).join("|");
      if (!force && sig === resourceBatchSig) return;
      resourceBatchSig = sig;
      for (const mesh of resourceBatchMeshes.values()) disposeSceneObject(mesh);
      resourceBatchMeshes.clear();
      for (const [bucketKey, bucket] of buckets) {
        const { spec, rows } = bucket;
        const mesh = new THREE.InstancedMesh(staticPrismGeo, prismMats(spec.top, spec.left, spec.right), rows.length);
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          batchDummy.position.set(row.x, row.y, row.z);
          batchDummy.rotation.set(0, 0, 0);
          batchDummy.scale.set(row.w, row.h, row.d);
          batchDummy.updateMatrix();
          mesh.setMatrixAt(i, batchDummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.staticResourcePrismBatch = true;
        resourceBatchRoot.add(mesh);
        resourceBatchMeshes.set(bucketKey, mesh);
      }
    }
    const roadGeo = new THREE.PlaneGeometry(0.70, 0.70);
    roadGeo.userData.shared = true;
    const roadMat = new THREE.MeshBasicMaterial({ color: 0xb98c55, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide });
    const roadMatMine = new THREE.MeshBasicMaterial({ color: 0xd8b66e, transparent: true, opacity: 0.66, depthWrite: false, side: THREE.DoubleSide });
    roadMat.userData.shared = true; roadMatMine.userData.shared = true;
    const districtLineMatCache = new Map();
    function districtLineMat(color) {
      const k = String(color || "#14f195");
      if (!districtLineMatCache.has(k)) districtLineMatCache.set(k, new THREE.LineBasicMaterial({ color: new THREE.Color(k), transparent: true, opacity: 0.52, depthWrite: false }));
      return districtLineMatCache.get(k);
    }
    const anims = [], bursts = [], waves = [], walkQueue = [], netMoveQueue = [];
    const movePredictor = new MovementPredictor(MOVE_MAX_IN_FLIGHT * MOVE_BATCH_MAX);
    let walking = false, moveBusy = false, pendingWalk = null, moveErrorAt = 0, moveToken = 0, activeMoveToken = 0;
    let moveSeq = 0, lastAckMoveSeq = 0, moveFlushTimer = 0, inFlightMoveBatches = 0;
    const spinners = [], spinsY = [], wavers = [], bobbers = [], flickers = [];
    const partGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    function burst(x, y, z, color, n = 8, spread = 0.45) {
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
    function floatText(x, z, text, color = "#ffd76e") {
      const label = makeLabel(String(text || ""), color);
      label.position.set(Number(x || 0), 1.24, Number(z || 0));
      scene.add(label);
      anims.push({ kind: "float", t: 0, dur: 0.9, obj: label, fromY: label.position.y, done: () => { scene.remove(label); try { label.material?.map?.dispose?.(); label.material?.dispose?.(); } catch {} } });
    }
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 32);
    function shockwave(x, z, color = 0x14f195) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.24, z); scene.add(m);
      waves.push({ m, t: 0, dur: 0.55 });
    }
    const buildingShadowGeo = new THREE.CircleGeometry(0.46, 30);
    buildingShadowGeo.userData.shared = true;
    const buildingShadowMat = new THREE.MeshBasicMaterial({ color: 0x08140f, transparent: true, opacity: 0.145, depthWrite: false, side: THREE.DoubleSide });
    buildingShadowMat.userData.shared = true;
    function disposeSceneObject(obj) {
      disposeObject3D(obj, { detach: true });
    }
    function decorateBuilding(g, b) {
      if (b?.kind !== "road") {
        const sh = new THREE.Mesh(buildingShadowGeo, buildingShadowMat);
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = STATIC_WORLD_BASE_Y + 0.010;
        const s = b?.kind === "worldwonder" ? 2.2 : b?.kind === "keep" ? 1.35 : b?.kind === "warehouse" ? 1.08 : 0.96;
        sh.scale.set(s * 1.35, s * 0.78, 1);
        sh.renderOrder = 1;
        g.add(sh);
      }
      const lv = b.level || 1;
      for (let i = 0; i < lv - 1; i++) {
        const pip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), ME(0xffd76e, 0xffb43d, 1));
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
    const confirmedMove = { x: 0, z: 0 };
    const player = new THREE.Group();
    let rig = null, rigSig = "";
    player.position.set(0, 0.22, 0); scene.add(player);
    const aura = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), new THREE.MeshBasicMaterial({ color: 0x0b1d15, transparent: true, opacity: 0.22, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.010; aura.scale.set(1.02, 0.58, 1); player.add(aura);
    const plight = new THREE.PointLight(0xd6c66a, 0.12, 3.0); plight.position.y = 0.9; player.add(plight);
    function heldToolForState() {
      if (ST.tool === "wood") return "axe";
      if (ST.tool === "stone") return "pickaxe";
      if (ST.tool === "build" || ST.tool === "craft" || ST.tool === "spawn" || ST.tool === "siege") return "hammer";
      if (ST.tool === "demolish" || ST.mode === "demolish") return "shovel";
      if (ST.tool === "claim") return "capture";
      if (ST.tool === "sword" || ST.tool === "siege") return "sword";
      if (ST.tool === "use" || ST.tool === "home") return "staff";
      return "none";
    }
    function ensureRig(force = false) {
      if (!ST.me) return;
      const heldTool = heldToolForState();
      const sig = playerBillboardSignature({ body: ST.me.body, hat: ST.me.hat, heldTool, palette: ST.characterProfile?.palette });
      if (!force && sig === rigSig) return;
      rigSig = sig;
      if (rig) disposeSceneObject(rig);
      rig = makePlayerBillboard({ body: ST.me.body, hat: ST.me.hat, heldTool, palette: ST.characterProfile?.palette, name: ST.me.name });
      rig.scale?.setScalar?.(1.18);
      player.add(rig);
    }
    const homeBanner = new THREE.Group(); let bannerOwner = 0; scene.add(homeBanner);
    const hoverMarker = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), new THREE.MeshBasicMaterial({ color: 0xceb443, transparent: true, opacity: 0.18, depthWrite: false }));
    hoverMarker.rotation.x = -Math.PI / 2; hoverMarker.position.y = 0.233; hoverMarker.visible = false; scene.add(hoverMarker);

    const hintGeo = new THREE.PlaneGeometry(0.82, 0.82);
    hintGeo.userData.shared = true;
    const hintPool = [];
    function setHintCells(items = []) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        let m = hintPool[i];
        if (!m) {
          m = new THREE.Mesh(hintGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          m.rotation.x = -Math.PI / 2; m.position.y = 0.236; scene.add(m); hintPool[i] = m;
        }
        m.position.x = it.x; m.position.z = it.z; m.visible = true;
        m.material.color.set(it.color || 0x14f195); m.material.opacity = it.opacity == null ? 0.20 : it.opacity;
      }
      for (let i = items.length; i < hintPool.length; i++) hintPool[i].visible = false;
    }
    const ghost = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.68), new THREE.MeshBasicMaterial({ color: 0x14f195, transparent: true, opacity: 0.32, depthWrite: false }));
    ghost.position.y = 0.48; ghost.visible = false; scene.add(ghost);
    function showBuildGhost(x, z, valid) {
      ghost.visible = true; ghost.position.x = x; ghost.position.z = z;
      const wonder = ST.placing === "worldwonder";
      const flat = wonder ? (currentWonderSize() - 0.28) : 1;
      ghost.scale.set(flat, wonder ? 0.12 : 1, flat);
      ghost.material.color.set(valid ? (wonder ? 0xffd76e : 0x14f195) : 0xd6604f);
      ghost.material.opacity = valid ? (wonder ? 0.18 : 0.32) : 0.26;
    }
    function hideBuildGhost() { ghost.visible = false; ghost.scale.set(1, 1, 1); }


    function makePrismBuildingGroup(kind, opts = {}) {
      const g = new THREE.Group();
      const parts = [];
      const k = String(kind || "building").toLowerCase();
      const base = cssHex(opts.cl || "#d6604f", "#d6604f");
      const plinth = cssHex(opts.plinth || "#3f3920", "#3f3920");

      // Advanced buildings are now data recipes: every structure is assembled
      // from the same fixed-camera prism primitive, but each building kind gets
      // a handcrafted stack of foundation/body/roof/trim/accent parts.  This is
      // what lets us reach the richer screenshot style without abandoning the
      // strict prism renderer or adding arbitrary mesh geometry.
      const recipe = buildingRecipeFor(k, {
        color: base,
        plinth,
        name: opts.nm,
        buildProgress: opts.buildProgress,
      });
      const progress = Math.max(0, Math.min(1, Number(opts.buildProgress ?? 1) || 0));
      const visibleRecipe = recipeVisibleParts(recipe, progress);
      renderRecipeParts(visibleRecipe, (r) => addPrismMesh(g, parts, {
        x: r.x,
        z: r.z,
        y: r.y,
        w: r.w,
        d: r.d,
        h: r.h,
        top: r.top,
        left: r.left,
        right: r.right,
        renderOrder: 4,
      }), 4);

      // AI/generated wonders may provide a recipe of box parts from the server.
      // Keep that path additive: the curated base/anchor comes first, then the
      // AI landmark parts sit on top in the same prism language.
      if (k === "worldwonder" && opts.wonder && Array.isArray(opts.wonder.parts)) {
        const yBase = Math.max(0.95, maxRecipeHeight(visibleRecipe) * 0.70);
        for (let i = 0; i < Math.min(80, opts.wonder.parts.length); i++) {
          const wp = opts.wonder.parts[i] || {};
          if (wp.primitive && wp.primitive !== "box") continue;
          const pos = Array.isArray(wp.pos) ? wp.pos : [0, 0, 0];
          const scale = Array.isArray(wp.scale) ? wp.scale : [0.5, 0.5, 0.5];
          addPrismMesh(g, parts, {
            x: Number(pos[0] || 0) * 0.58,
            y: yBase + Number(pos[1] || 0) * 0.34,
            z: Number(pos[2] || 0) * 0.58,
            w: Math.max(0.06, Number(scale[0] || 0.35) * 0.58),
            h: Math.max(0.06, Number(scale[1] || 0.35) * 0.34),
            d: Math.max(0.06, Number(scale[2] || 0.35) * 0.58),
            top: cssHex(wp.color || base, base),
            renderOrder: 5,
          });
        }
      }

      const name = String(opts.nm || "").trim();
      if (name) {
        const label = makeLabel(name.slice(0, 24), "#fff0c8");
        label.position.set(0, maxRecipeHeight(visibleRecipe) + 0.24, 0);
        g.add(label);
        parts.push(label);
      }
      g.userData.staticPrismBuilding = true;
      g.userData.recipeKind = k;
      return { group: g, parts };
    }

    function ensureTradePost(x, z) {
      const k = key(x, z), want = tradePostAt(x, z) && !buildPoolAt(x, z);
      const have = tradePostPool.get(k);
      if (have && want) return;
      if (have && !want) { disposeSceneObject(have.group); tradePostPool.delete(k); return; }
      if (!want) return;
      const { group, parts } = makePrismBuildingGroup("market", { nm: "Trade Post", cl: "#ffd76e", plinth: 0xc79337 });
      group.position.set(x, 0, z);
      group.scale.setScalar(0.82);
      scene.add(group);
      // Trade posts stay visually calm; use-trigger animation handles feedback.
      tradePostPool.set(k, { group, x, z });
      const dd = doodadPool.get(k); if (dd) { doodadPool.delete(k); rebuildResourceBatches(true); }
    }
    function ensureNpcCamp(x, z) {
      const k = key(x, z);
      const npc = proceduralNpcAt(x, z);
      const hiddenByWorld = exceptions.get(k) === "gone";
      const want = npc && !hiddenByWorld && !buildPoolAt(x, z) && !tradePostAt(x, z);
      const have = npcPool.get(k);
      if (have && want && have.id === npc.id) return;
      if (have) { npcVisibilityGrid.remove(have); visibleNpcs.delete(have); disposeSceneObject(have.group); npcPool.delete(k); }
      if (!want) return;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.08, 10), M(0x5a4b35, { roughness: 1 }));
      base.position.y = 0.08; g.add(base);
      const roleColor = npc.role === "warrior" ? 0xff7a66 : npc.role === "trader" ? 0xffd76e : npc.role === "traveler" ? 0x7dcfe8 : 0xf3ead7;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.10), ME(roleColor, roleColor, 0.48));
      body.position.y = 0.34; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), M(0xf0b887));
      head.position.y = 0.57; g.add(head);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), M(0x7a5230));
      pole.position.set(0.22, 0.34, 0.1); g.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.02), M(roleColor));
      flag.position.set(0.34, 0.53, 0.1); g.add(flag);
      g.add(makeLabel(npc.name, "#fff0b8"));
      g.position.set(x, 0.18, z);
      scene.add(g);
      const row = { group: g, id: npc.id, ...npc };
      npcPool.set(k, row);
      npcVisibilityGrid.upsert(row);
    }
    const doodadVisible = (x, z) => {
      const k = key(x, z);
      if (capitalBlocksNaturalResource(x, z)) return null;
      if (tradePostAt(x, z)) return null;
      const ex = exceptions.get(k);
      if (ex) return ex === "gone" ? null : ex;
      // Claimed land is clean unless the server sends an explicit doodad row.
      if (tileOwner.has(k)) return null;
      return naturalDoodad(x, z);
    };
    function ensureDoodad(x, z) {
      const k = key(x, z);
      const want = tradePostAt(x, z) ? null : doodadVisible(x, z);
      const have = doodadPool.get(k);
      if (have && have.type === want && have.x === x && have.z === z) return;
      if (have) doodadPool.delete(k);
      if (!want || buildPoolAt(x, z)) return;
      doodadPool.set(k, { x, z, type: want, batched: true });
    }
    function wonderFootprintRadiusForBuild(have) {
      if (!have || have.kind !== "worldwonder") return 0;
      return wonderRadiusClient(have.wonder?.footprint || have.footprint || WONDER_PLAZA_SIZE);
    }
    function eachBuildIndexedCell(have, fn) {
      if (!have) return;
      if (have.kind !== "worldwonder") { fn(have.x, have.z); return; }
      const r = wonderFootprintRadiusForBuild(have);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) fn(have.x + dx, have.z + dz);
    }
    function indexBuildAt(have) {
      if (!have) return;
      // Landmarks reserve a plaza for selection/placement purposes, but
      // only their center tower is a movement blocker. See physicalBuildAt().
      eachBuildIndexedCell(have, (x, z) => buildAt.set(key(x, z), have));
      buildVisibilityGrid.upsert(have);
    }
    function clearBuildAt(have) {
      if (!have) return;
      eachBuildIndexedCell(have, (x, z) => { if (buildAt.get(key(x, z)) === have) buildAt.delete(key(x, z)); });
      buildVisibilityGrid.remove(have);
      visibleBuilds.delete(have);
    }
    function buildPoolAt(x, z) { return buildAt.get(key(x, z)) || null; }
    function physicalBuildAt(x, z) {
      const b = buildPoolAt(x, z);
      if (!b) return null;
      if (b.kind === "road") return null;
      if (b.kind === "worldwonder" && (Number(b.x) !== Number(x) || Number(b.z) !== Number(z))) return null;
      return b;
    }

    function updateWonderDistrictRoads() {
      const px = Math.round(me.x), pz = Math.round(me.z), r = currentTileLoadRadius();
      const buildings = Array.from(buildPool.values()).filter((b) => b && Number.isFinite(Number(b.x)) && Number.isFinite(Number(b.z)));
      const wonders = buildings.filter((b) => b.kind === "worldwonder");
      const wantDistricts = new Set();
      for (const w of wonders) {
        const d = cheb(w.x, w.z, px, pz);
        if (d > r + wonderMapDistrictRadius(w) + 4) continue;
        const uid = String(w.uid || `${w.x},${w.z}`);
        wantDistricts.add(uid);
        let g = districtPool.get(uid);
        const rad = wonderMapDistrictRadius(w) + 0.5;
        const color = wonderDistrictColorHex(w);
        const sig = [Math.round(w.x), Math.round(w.z), rad, color].join(":");
        if (g && g.sig !== sig) { scene.remove(g.group); districtPool.delete(uid); g = null; }
        if (!g) {
          const pts = [new THREE.Vector3(-rad, 0.028, -rad), new THREE.Vector3(rad, 0.028, -rad), new THREE.Vector3(rad, 0.028, rad), new THREE.Vector3(-rad, 0.028, rad)];
          const geom = new THREE.BufferGeometry().setFromPoints(pts);
          const line = new THREE.LineLoop(geom, districtLineMat(color));
          line.renderOrder = 4;
          const group = new THREE.Group();
          group.add(line);
          group.position.set(w.x, 0.242, w.z);
          scene.add(group);
          g = { group, sig, x: w.x, z: w.z };
          districtPool.set(uid, g);
        }
        g.group.visible = true;
      }
      for (const [uid, g] of [...districtPool]) if (!wantDistricts.has(uid)) { scene.remove(g.group); districtPool.delete(uid); }

      const wanted = new Map();
      for (const b of buildings) {
        if (!b || b.kind !== "road") continue;
        if (cheb(b.x, b.z, px, pz) > r + 10) continue;
        wanted.set(key(b.x, b.z), { x: b.x, z: b.z, mine: ST.me && Number(b.owner) === Number(ST.me.id), color: "#d8b66e", built: true });
      }
      for (const b of buildings) {
        if (!b.owner || b.kind === "worldwonder" || b.kind === "keep" || b.kind === "bomb" || b.kind === "road") continue;
        if (cheb(b.x, b.z, px, pz) > r + 10) continue;
        const w = nearestWonderForBuildingMap(b, wonders);
        if (!w) continue;
        for (const cell of roadPathToWonderMap(b, w, 70)) {
          if (wanted.size > 360) break;
          const k = key(cell.x, cell.z);
          if (!cells.has(k)) continue;
          const blocker = physicalBuildAt(cell.x, cell.z);
          if (blocker && blocker.kind !== "worldwonder") continue;
          wanted.set(k, { ...cell, mine: ST.me && Number(b.owner) === Number(ST.me.id), color: wonderDistrictColorHex(w) });
        }
      }
      for (const [k, it] of wanted) {
        let m = roadPool.get(k);
        if (!m) {
          m = new THREE.Mesh(roadGeo, it.mine ? roadMatMine : roadMat);
          m.rotation.x = -Math.PI / 2;
          m.position.y = 0.246;
          m.renderOrder = 3;
          scene.add(m);
          roadPool.set(k, m);
        }
        m.position.x = it.x; m.position.z = it.z; m.material = it.mine ? roadMatMine : roadMat; m.visible = true;
      }
      for (const [k, m] of [...roadPool]) if (!wanted.has(k)) { scene.remove(m); roadPool.delete(k); }
    }

    function refreshCell(x, z) {
      const k = key(x, z), t = tileOwner.get(k);
      let cell = cells.get(k);
      if (!cell) {
        cell = { owner: (t && t.owner) || 0, body: (t && t.body) || 0, cx: x, cz: z };
        cells.set(k, cell);
      } else {
        cell.cx = x; cell.cz = z;
      }
      cell.owner = (t && t.owner) || 0;
      cell.body = (t && t.body) || 0;
      ensureTradePost(x, z);
      ensureNpcCamp(x, z);
      ensureDoodad(x, z);
    }
    let winX = 1e9, winZ = 1e9;
    let visX = 1e9, visZ = 1e9, visR = -1, visWorldRev = -1;
    function syncSpatialVisibilitySet(prevSet, nextSet, predicate) {
      for (const ent of prevSet) {
        if (!nextSet.has(ent) && ent?.group) ent.group.visible = false;
      }
      for (const ent of nextSet) {
        if (!ent?.group) continue;
        const show = !!predicate(ent);
        if (ent.group.visible !== show) ent.group.visible = show;
      }
      return nextSet;
    }
    function syncWorldVisibility(force = false) {
      const px = Math.round(me.x), pz = Math.round(me.z), r = currentTileLoadRadius();
      const rev = Number(lastWorldPaintRev || 0);
      if (!force && px === visX && pz === visZ && r === visR && rev === visWorldRev) return;
      visX = px; visZ = pz; visR = r; visWorldRev = rev;
      const withinLoaded = (ent) => cheb(ent.x, ent.z, px, pz) <= r + 1 && cells.has(key(ent.x, ent.z));
      visibleBuilds = syncSpatialVisibilitySet(visibleBuilds, buildVisibilityGrid.query(px, pz, r + 2), withinLoaded);
      visibleLoot = syncSpatialVisibilitySet(visibleLoot, lootVisibilityGrid.query(px, pz, r + 2), withinLoaded);
      visibleNpcs = syncSpatialVisibilitySet(visibleNpcs, npcVisibilityGrid.query(px, pz, r + 2), withinLoaded);
      updateWonderDistrictRoads();
    }
    function refreshWindow(force = false) {
      const px = Math.round(me.x), pz = Math.round(me.z), r = currentTileLoadRadius();
      if (!force && Math.max(Math.abs(px - winX), Math.abs(pz - winZ)) <= TILE_WINDOW_HYSTERESIS) { syncWorldVisibility(); return; }
      winX = px; winZ = pz;
      for (const [k, c] of cells) {
        const cx = Number.isFinite(c.cx) ? c.cx : Number(String(k).split(",")[0]);
        const cz = Number.isFinite(c.cz) ? c.cz : Number(String(k).split(",")[1]);
        if (cheb(cx, cz, px, pz) > r + 2) {
          cells.delete(k);
          const d = doodadPool.get(k); if (d) doodadPool.delete(k);
          const tp = tradePostPool.get(k); if (tp) { scene.remove(tp.group); tradePostPool.delete(k); } const npc = npcPool.get(k); if (npc) { npcVisibilityGrid.remove(npc); visibleNpcs.delete(npc); scene.remove(npc.group); npcPool.delete(k); }
          const rd = roadPool.get(k); if (rd) { scene.remove(rd); roadPool.delete(k); }
        }
      }
      for (let x = px - r; x <= px + r; x++)
        for (let z = pz - r; z <= pz + r; z++) refreshCell(x, z);
      rebuildTerrainBatches(force);
      rebuildGroundDetails(force);
      rebuildResourceBatches(force);
      syncWorldVisibility();
    }
    loadAtlasRuntimeConfig().then(() => { ownerMatCache.clear(); terrainBatchMatCache.clear(); terrainBatchSig = ""; groundDetailSig = ""; for (const [, c] of cells) c.owner = -1; refreshWindow(true); }).catch(() => {});

    function hardSnapMe(x, z) {
      walkQueue.length = 0; netMoveQueue.length = 0; walking = false; moveBusy = false; pendingWalk = null; inFlightMoveBatches = 0; lastAckMoveSeq = moveSeq; activeMoveToken = ++moveToken;
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].kind === "hop") anims.splice(i, 1);
      confirmedMove.x = x; confirmedMove.z = z;
      movePredictor.reset({ x, z });
      me.x = x; me.z = z; player.position.set(x, 0.22, z); camTarget.set(x, 0.22, z);
      refreshWindow(true);
    }

    function landmarkPalette(recipe) {
      const raw = Array.isArray(recipe?.palette) ? recipe.palette.filter((x) => /^#[0-9a-f]{6}$/i.test(String(x))) : [];
      const arr = raw.length ? raw.slice(0, 8) : ["#ffd76e", "#14f195", "#7dcfe8", "#9945ff", "#f6e7c8", "#c79337"];
      while (arr.length < 6) arr.push(["#ffd76e", "#14f195", "#7dcfe8", "#9945ff", "#f6e7c8", "#c79337"][arr.length % 6]);
      return arr;
    }
    function landmarkSemanticKind(recipe) {
      const text = `${recipe?.name || ""} ${recipe?.prompt || ""}`.toLowerCase();
      if (/school|library|academy|campus|university/.test(text)) return "school";
      if (/dish|plate|food|meal|restaurant|kitchen|bowl/.test(text)) return "dish";
      if (/observatory|telescope|star|astronomy|space|planetarium/.test(text)) return "observatory";
      if (/temple|shrine|cathedral|monument|obelisk/.test(text)) return "temple";
      if (/market|bazaar|trade|mall|shop/.test(text)) return "market";
      if (/fountain|water|spring/.test(text)) return "fountain";
      if (/garden|park|grove|greenhouse/.test(text)) return "garden";
      if (/tower|spire|skyscraper|beacon/.test(text)) return "tower";
      return "landmark";
    }
    function landmarkRecipePartsAsPrisms(recipe, size) {
      const pal = landmarkPalette(recipe);
      const unit = Math.max(0.16, Math.min(0.42, Number(size || 5) / 18));
      const raw = Array.isArray(recipe?.parts) ? recipe.parts.slice(0, 96) : [];
      const out = [];
      for (let i = 0; i < raw.length; i++) {
        const part = raw[i] || {};
        const pos = Array.isArray(part?.pos) ? part.pos : Array.isArray(part?.position) ? part.position : [part?.x || 0, part?.y || 0, part?.z || 0];
        const sc = Array.isArray(part?.scale) ? part.scale : Array.isArray(part?.size) ? part.size : [part?.w || 1, part?.h || 1, part?.d || 1];
        const primitive = String(part?.primitive || part?.kind || "box").toLowerCase();
        const color = cssHex(part?.color || part?.material?.color || pal[i % pal.length], pal[i % pal.length]);
        const px = Math.max(-5, Math.min(5, Number(pos[0] || 0))) * unit * 0.92;
        const py = 0.10 + Math.max(0, Math.min(7, Number(pos[1] || 0))) * unit * 0.85;
        const pz = Math.max(-5, Math.min(5, Number(pos[2] || 0))) * unit * 0.92;
        let w = Math.max(0.08, Math.min(3.0, Math.abs(Number(sc[0] || 1)) * unit));
        let h = Math.max(0.08, Math.min(2.4, Math.abs(Number(sc[1] || 1)) * unit));
        let d = Math.max(0.08, Math.min(3.0, Math.abs(Number(sc[2] || 1)) * unit));
        // LLM may ask for unsupported rounded primitives. Static SolCrafts world still
        // normalizes every part into the same prism primitive and preserves only scale.
        if (primitive.includes("roof") || primitive.includes("cone")) { h *= 0.55; w *= 1.08; d *= 1.08; }
        if (primitive.includes("sphere") || primitive.includes("cyl")) { w *= 0.88; d *= 0.88; }
        out.push({ x: px, y: py, z: pz, w, h, d, top: color });
      }
      return out.sort((a, b) => (a.x + a.z + a.y * 0.2) - (b.x + b.z + b.y * 0.2));
    }
    function semanticLandmarkPrisms(recipe, size) {
      const pal = landmarkPalette(recipe);
      const kind = landmarkSemanticKind(recipe);
      const stone = pal[4] || "#f6e7c8", accent = pal[0] || "#ffd76e", accent2 = pal[1] || "#14f195", glass = pal[2] || "#7dcfe8", trim = pal[5] || "#c79337";
      const rows = [];
      const add = (x, z, y, w, d, h, top, left = null, right = null) => rows.push({ x, z, y, w, d, h, top, left, right });
      if (kind === "school") {
        add(0, 0, 0.12, 1.90, 1.05, 0.58, stone);
        add(0, -0.05, 0.70, 1.18, 0.72, 0.28, accent2);
        add(0, -0.10, 0.98, 0.50, 0.44, 0.72, accent);
        add(-0.62, 0.34, 0.74, 0.18, 0.12, 0.18, glass);
        add(-0.22, 0.34, 0.74, 0.18, 0.12, 0.18, glass);
        add(0.22, 0.34, 0.74, 0.18, 0.12, 0.18, glass);
        add(0.62, 0.34, 0.74, 0.18, 0.12, 0.18, glass);
      } else if (kind === "dish") {
        add(0, 0, 0.12, 1.85, 1.28, 0.16, "#f8fbef");
        add(0, 0, 0.30, 1.15, 0.78, 0.14, glass);
        add(-0.34, -0.06, 0.46, 0.34, 0.22, 0.14, "#fff0c8");
        add(0.12, -0.12, 0.46, 0.34, 0.22, 0.14, "#ffd76e");
        add(0.42, 0.18, 0.46, 0.24, 0.22, 0.14, "#2fbf6a");
      } else if (kind === "observatory") {
        add(0, 0, 0.12, 1.24, 1.08, 0.70, stone);
        add(0, 0, 0.82, 0.88, 0.72, 0.42, glass);
        add(0.44, -0.28, 1.08, 0.84, 0.22, 0.22, glass);
        add(-0.38, 0.36, 0.84, 0.32, 0.26, 0.56, accent);
      } else if (kind === "temple") {
        add(0, 0, 0.10, 2.08, 1.16, 0.28, stone);
        for (const x of [-0.76, -0.28, 0.28, 0.76]) add(x, 0.05, 0.38, 0.18, 0.18, 0.78, trim);
        add(0, 0.02, 1.12, 2.24, 1.02, 0.28, accent2);
        add(0, -0.08, 1.40, 1.42, 0.72, 0.34, accent);
      } else if (kind === "market") {
        add(0, 0, 0.10, 1.78, 1.18, 0.18, stone);
        let n = 0;
        for (const x of [-0.58, 0, 0.58]) for (const z of [-0.28, 0.34]) {
          add(x, z, 0.30, 0.42, 0.30, 0.34, pal[n++ % pal.length]);
          add(x, z, 0.66, 0.50, 0.36, 0.16, pal[n++ % pal.length]);
        }
      } else if (kind === "fountain") {
        add(0, 0, 0.10, 1.84, 1.22, 0.20, stone);
        add(0, 0, 0.32, 1.24, 0.82, 0.12, glass);
        add(0, 0, 0.46, 0.32, 0.26, 0.80, trim);
        add(-0.34, 0, 0.80, 0.20, 0.16, 0.30, glass);
        add(0.34, 0, 0.80, 0.20, 0.16, 0.30, glass);
      } else if (kind === "garden") {
        add(0, 0, 0.08, 1.86, 1.20, 0.12, stone);
        for (const [x,z,h,c] of [[-0.55,-0.24,.52,"#2f8f46"],[0.42,-0.12,.44,"#51b956"],[-0.10,0.34,.38,"#76d85d"],[0.68,0.38,.32,"#27944d"]]) {
          add(x, z, 0.22, 0.13, 0.12, 0.38, "#7a4b22");
          add(x, z, 0.58, 0.44, 0.34, h, c);
        }
      } else {
        add(0, 0, 0.10, 1.76, 1.06, 0.32, stone);
        add(0, 0, 0.42, 0.86, 0.72, kind === "tower" ? 1.65 : 1.05, accent);
        add(0, 0, kind === "tower" ? 2.06 : 1.46, 1.02, 0.86, 0.30, accent2);
        add(0, -0.02, kind === "tower" ? 2.38 : 1.78, 0.42, 0.36, 0.40, glass);
      }
      const scale = Math.max(0.9, Math.min(1.45, Number(size || 5) / 6));
      return rows.map((p) => ({ ...p, x: p.x * scale, z: p.z * scale, y: p.y * scale, w: p.w * scale, d: p.d * scale, h: p.h * scale }));
    }
    function makeProceduralLandmarkGroup(recipe, opts = {}) {
      const g = new THREE.Group();
      const parts = [];
      const progress = Math.max(0, Math.min(1, Number(opts.buildProgress ?? 1) || 0));
      const size = Math.max(3, Math.min(9, Number(recipe?.footprint || opts.footprint || 5) || 5));
      const pal = landmarkPalette(recipe);
      const pad = Math.max(1.65, Math.min(4.15, 1.30 + size * 0.30));
      addPrismMesh(g, parts, { x: 0, y: 0.035, z: 0, w: pad, d: pad * 0.78, h: 0.08, top: opts.plinth || pal[5] || "#c79337", left: shadeHex(opts.plinth || pal[5] || "#c79337", -0.14), right: shadeHex(opts.plinth || pal[5] || "#c79337", -0.26), renderOrder: 3 });
      const fromRecipe = landmarkRecipePartsAsPrisms(recipe, size);
      const rows = (fromRecipe.length ? fromRecipe : semanticLandmarkPrisms(recipe, size));
      const visible = progress >= 0.995 ? rows.length : Math.max(1, Math.ceil(rows.length * Math.max(0.10, progress)));
      let maxY = 0.8;
      for (let i = 0; i < visible; i++) {
        const row = rows[i];
        maxY = Math.max(maxY, Number(row.y || 0) + Number(row.h || 0));
        addPrismMesh(g, parts, { ...row, renderOrder: 5 });
      }
      const name = String(opts.nm || recipe?.name || "").trim();
      if (name) {
        const label = makeLabel(name.slice(0, 28), "#fff0c8");
        label.position.set(0, maxY + 0.28, 0);
        g.add(label);
        parts.push(label);
      }
      g.userData.landmarkPrismWorld = true;
      return { group: g, parts };
    }

    // Gold source/ruin client meshes were removed: the server now returns no runtime gold sources.
    function makeRoadBuildingGroup(b) {
      const g = new THREE.Group();
      const mat = (ST.me && Number(b.owner) === Number(ST.me.id)) ? roadMatMine : roadMat;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), mat);
      p.rotation.x = -Math.PI / 2;
      p.position.y = 0.035;
      p.renderOrder = 5;
      g.add(p);
      return { group: g, parts: [] };
    }

    function rebuildBuilding(uid) {
      const have = buildPool.get(uid);
      if (!have) return;
      const b = { ...have };
      removeBuild(uid);
      const plinth = buildingPlinthHex(b);
      const cs = constructionStateForBuilding(b);
      const labelName = b.capital && ST.me && !capitalLabelVisibleForPlayer(b, ST.me.x, ST.me.z) ? "" : b.nm;
      const { group, parts } = b.kind === "road"
        ? makeRoadBuildingGroup(b)
        : b.kind === "worldwonder"
          ? makeProceduralLandmarkGroup(wonderRecipeForWire(b), { nm: labelName, cl: b.cl, plinth, buildProgress: cs ? cs.progress : 1, buildUntil: cs ? cs.end : b.cdUntil })
          : makePrismBuildingGroup(b.kind, { nm: labelName, cl: b.cl, plinth, wonder: wonderRecipeForWire(b), buildProgress: cs ? cs.progress : 1, buildUntil: cs ? cs.end : b.cdUntil });
      decorateBuilding(group, b);
      group.position.set(b.x, 0, b.z); scene.add(group);
      // Buildings are intentionally static. Triggered use pulses animate them briefly.
      const next = { ...b, group, parts, sig: String(Date.now()) };
      buildPool.set(uid, next); indexBuildAt(next);
    }

    let lastWorldPaintRev = -1;
    function applyWorld(w) {
      tileOwner.clear();
      for (const t of w.tiles) tileOwner.set(key(t.x, t.z), { owner: t.owner, body: t.ownerBody, name: t.ownerName || `Player ${t.owner}` });
      exceptions.clear();
      for (const d of w.doodads) exceptions.set(key(d.x, d.z), d.type);
      const seen = new Set();
      const worldBuildings = Array.isArray(w.buildings) ? w.buildings : [];
      const virtualCapital = capitalBuildingsInView(Number(w.ax || 0), Number(w.az || 0), currentTileLoadRadius() + 10);
      const blockedCapitalKeys = new Set(worldBuildings.map((b) => key(b.x, b.z)));
      const renderBuildings = worldBuildings.concat(virtualCapital.filter((b) => !blockedCapitalKeys.has(key(b.x, b.z))));
      for (const b of renderBuildings) {
        seen.add(b.uid);
        if (ST.inspectDraft && ST.inspectDraft.uid === b.uid && Date.now() - (ST.inspectDraft.at || 0) < 3500) {
          if (Object.prototype.hasOwnProperty.call(ST.inspectDraft, "cl")) b.cl = ST.inspectDraft.cl;
          if (Object.prototype.hasOwnProperty.call(ST.inspectDraft, "nm")) b.nm = ST.inspectDraft.nm;
        }
        const buildStart = Number(b.constructAt || (b.kind === "worldwonder" ? b.accAt : 0) || 0) || 0;
        const buildUntil = Number(b.constructUntil || (b.kind === "worldwonder" ? b.cdUntil : 0) || 0) || 0;
        const buildProgress = buildUntil > Date.now()
          ? Math.max(0, Math.min(1, (Date.now() - buildStart) / Math.max(1, buildUntil - buildStart)))
          : 1;
        const buildBucket = buildUntil > Date.now() ? Math.floor(buildProgress * 20) : 20;
        const sig = [b.kind, b.nm || "", b.cl || "", b.ownerBody, b.ownerFace || "", b.level, Math.ceil(b.hp), b.maxHp, b.cdUntil || 0, b.constructUntil || 0, buildBucket, b.kind === "worldwonder" ? JSON.stringify(wonderRecipeForWire(b) || {}) : ""].join("|");
        let have = buildPool.get(b.uid);
        if (have && have.sig !== sig) { removeBuild(b.uid); have = null; }
        if (!have) {
          const plinth = buildingPlinthHex(b);
          const labelName = b.capital && ST.me && !capitalLabelVisibleForPlayer(b, ST.me.x, ST.me.z) ? "" : b.nm;
          const { group, parts } = b.kind === "road"
            ? makeRoadBuildingGroup(b)
            : b.kind === "worldwonder"
              ? makeProceduralLandmarkGroup(wonderRecipeForWire(b), { nm: labelName, cl: b.cl, plinth, buildProgress, buildUntil: b.cdUntil })
              : makePrismBuildingGroup(b.kind, { nm: labelName, cl: b.cl, plinth, wonder: wonderRecipeForWire(b), buildProgress, buildUntil: b.cdUntil });
          decorateBuilding(group, b);
          group.position.set(b.x, 0, b.z); scene.add(group);
          // Buildings do not idle-spin/bob/flicker; interaction triggers a short pulse instead.
          have = { group, parts, sig, x: b.x, z: b.z, kind: b.kind, owner: b.owner, uid: b.uid, ownerBody: b.ownerBody, usedAt: Number(b.usedAt || 0) };
          buildPool.set(b.uid, have);
          indexBuildAt(have);
          const dd = doodadPool.get(key(b.x, b.z));
          if (dd) { doodadPool.delete(key(b.x, b.z)); rebuildResourceBatches(true); }
        }
        have.uid = b.uid; indexBuildAt(have);
        if (have.usedAt && Number(b.usedAt || 0) > Number(have.usedAt || 0)) animateBuildingUse(b.uid);
        Object.assign(have, { acc: b.acc, accAt: b.accAt, cdUntil: b.cdUntil, constructAt: b.constructAt || 0, constructUntil: b.constructUntil || 0, usedAt: Number(b.usedAt || 0), ownerName: b.ownerName, ownerFace: b.ownerFace || null, nm: b.nm, cl: b.cl, level: b.level, hp: b.hp, maxHp: b.maxHp, stored: b.stored || 0, ownerBody: b.ownerBody, wonder: wonderRecipeForWire(b) || null, buildBucket });
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
        const lootRow = { id: l.id, group: g, x: l.x, z: l.z, kind: l.kind, gid: l.gid };
        lootPool.set(l.id, lootRow);
        lootVisibilityGrid.upsert(lootRow);
      }
      for (const [id, l] of [...lootPool]) {
        if (lootSeen.has(id)) continue;
        anims.push({ kind: "up", obj: l.group, t: 0, dur: 0.3, done: () => disposeSceneObject(l.group) });
        lootVisibilityGrid.remove(l); visibleLoot.delete(l);
        lootPool.delete(id);
      }
      // Gold Sources/Ruins are deprecated server-side; coins now arrive as loot/pickups.
      const nextWorldRev = Number(w.rev || 0);
      const worldChanged = nextWorldRev !== lastWorldPaintRev;
      lastWorldPaintRev = nextWorldRev;
      refreshWindow(worldChanged);
    }

    function makeRemoteGhostSpectator(q) {
      const g = new THREE.Group();
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.36, 24), new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.025;
      g.add(glow);
      const ghostMat = new THREE.MeshStandardMaterial({ color: 0xb7efff, emissive: 0x2e8ec5, metalness: 0.02, roughness: 0.42, transparent: true, opacity: 0.34, depthWrite: false });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), ghostMat);
      body.position.y = 0.52; body.scale.set(0.82, 1.18, 0.82); g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.32, 12), ghostMat);
      tail.position.y = 0.27; tail.rotation.x = Math.PI; g.add(tail);
      g.add(makeLabel(`${q.name || "Spectator"} · ghost`, "#bdeeff"));
      g.userData.ghost = true;
      return g;
    }

    function makeRemoteLitePlayer(q) {
      const g = makePlayerBillboard({ body: q.body, hat: q.hat, palette: q.appearance?.palette, heldTool: "none", name: q.name });
      g.scale?.setScalar?.(1.08);
      g.add(makeLabel(`${q.name || "Player"} · Lv ${q.level || 1}`, "#cfe8ff"));
      return g;
    }

    function applyPlayers(players) {
      const rows = Array.isArray(players) ? players.filter((q) => q && q.id != null) : [];
      const ordered = rows.slice().sort((a, b) => cheb(a.x, a.z, me.x, me.z) - cheb(b.x, b.z, me.x, me.z));
      const fullIds = new Set();
      let fullCount = 0;
      for (const q of ordered) {
        if (q.spectator) continue;
        const dist = cheb(q.x, q.z, me.x, me.z);
        if (dist <= REMOTE_FULL_RIG_RADIUS || fullCount < REMOTE_FULL_RIG_BUDGET) {
          fullIds.add(q.id);
          fullCount++;
        }
      }
      const pSeen = new Set();
      for (const q of rows) {
        pSeen.add(q.id);
        const mode = q.spectator ? "ghost" : fullIds.has(q.id) ? "full" : "lite";
        const sig = JSON.stringify([mode, q.spectator ? 1 : 0, q.body, q.hat, q.equip, q.name, q.level, q.appearance && q.appearance.palette, q.appearance && q.appearance.parts, q.appearance && q.appearance.showBack]);
        let r = rigPool.get(q.id);
        if (r && r.sig !== sig) { disposeSceneObject(r.group); rigPool.delete(q.id); r = null; }
        if (!r) {
          const group = new THREE.Group();
          if (mode === "ghost") {
            group.add(makeRemoteGhostSpectator(q));
          } else if (mode === "full") {
            group.add(makePlayerBillboard({ body: q.body, hat: q.hat, palette: q.appearance?.palette, heldTool: "none", name: q.name }));
            group.add(makeLabel(`${q.name || "Player"} · Lv ${q.level || 1}`, "#cfe8ff"));
          } else {
            group.add(makeRemoteLitePlayer(q));
          }
          group.position.set(q.x, 0.22, q.z); scene.add(group);
          r = { group, sig, tx: q.x, tz: q.z, hop: null, queue: [], lastX: q.x, lastZ: q.z, mode }; rigPool.set(q.id, r);
        }
        if (q.x !== r.tx || q.z !== r.tz) {
          let cx = Math.round(r.group.position.x), cz = Math.round(r.group.position.z);
          let steps = [];
          while ((cx !== q.x || cz !== q.z) && steps.length < 18) {
            if (cx < q.x) cx++; else if (cx > q.x) cx--;
            if (cz < q.z) cz++; else if (cz > q.z) cz--;
            steps.push([cx, cz]);
          }
          r.tx = q.x; r.tz = q.z;
          if (steps.length && steps.length < 18) {
            if (steps.length > 8) steps = steps.slice(-8);
            r.queue = steps;
          } else { r.queue = []; r.hop = null; r.group.position.set(q.x, 0.22, q.z); }
        }
      }
      for (const [id, r] of [...rigPool]) { if (pSeen.has(id)) continue; disposeSceneObject(r.group); rigPool.delete(id); }
    }
    function optimisticMoveLead() { return movePredictor.pendingCount() + netMoveQueue.length + inFlightMoveBatches * MOVE_BATCH_MAX; }
    function hasPendingMove() { return walking || inFlightMoveBatches > 0 || moveBusy || netMoveQueue.length > 0 || walkQueue.length > 0 || !!pendingWalk || anims.some((a) => a.kind === "hop" || a.kind === "correct"); }
    function applyMe(forceMe = false) {
      if (!ST.me) return;
      const movingNow = hasPendingMove();
      if (!movingNow) { confirmedMove.x = ST.me.x; confirmedMove.z = ST.me.z; movePredictor.reset({ x: ST.me.x, z: ST.me.z }); }
      const drift = cheb(ST.me.x, ST.me.z, me.x, me.z);
      const snapDrift = movingNow ? 16 : 4;
      if (forceMe || drift > snapDrift) hardSnapMe(ST.me.x, ST.me.z);
      ensureRig();
      if (bannerOwner !== ST.me.id) {
        bannerOwner = ST.me.id; homeBanner.clear();
        buildBanner(homeBanner, ST.me.body, { wavers });
        // Keep the home flag clean: the player already has a name label, so the flag stays visual-only.
      }
      homeBanner.position.set(ST.me.spawnX ?? ST.me.x, 0.22, ST.me.spawnZ ?? ST.me.z);
      refreshWindow();
    }
    function removeBuild(uid, boom = false) {
      const b = buildPool.get(uid); if (!b) return;
      if (boom) { burst(b.x, 0.5, b.z, 0xd6604f, 16, 0.6); shockwave(b.x, b.z, 0xff8a5e); }
      disposeSceneObject(b.group); clearBuildAt(b); buildPool.delete(uid);
      updateWonderDistrictRoads();
    }
    function animateBuildingUse(uid) {
      const b = buildPool.get(uid); if (!b || !b.group) return;
      anims.push({ kind: "pulse", obj: b.group, base: b.group.scale.clone(), t: 0, dur: 0.36 });
      shockwave(b.x, b.z, 0xffd76e);
    }
    function refreshConstructionProgress() {
      const nowMs = Date.now();
      for (const [uid, b] of buildPool) {
        const end = Number(b.constructUntil || (b.kind === "worldwonder" ? b.cdUntil : 0) || 0);
        if (!end) continue;
        if (end <= nowMs) {
          if (b.buildBucket !== 20) { b.buildBucket = 20; rebuildBuilding(uid); }
          continue;
        }
        const start = Number(b.constructAt || (b.kind === "worldwonder" ? b.accAt : 0) || nowMs);
        const progress = Math.max(0, Math.min(1, (nowMs - start) / Math.max(1, end - start)));
        const bucket = Math.floor(progress * 20);
        if (b.buildBucket === bucket) continue;
        b.buildBucket = bucket;
        rebuildBuilding(uid);
      }
    }

    const blocked = (x, z) => !!physicalBuildAt(x, z) || !!doodadVisible(x, z) || tradePostAt(x, z);
    function stopOptimisticMovement(snapX, snapZ) {
      walkQueue.length = 0;
      netMoveQueue.length = 0;
      pendingWalk = null;
      walking = false;
      moveBusy = false; inFlightMoveBatches = 0; lastAckMoveSeq = moveSeq;
      movePredictor.reset({ x: snapX, z: snapZ });
      hardSnapMe(snapX, snapZ);
      refreshWindow(); refreshNear(); paint(true);
    }
    function advanceLocalWalk() {
      if (walking) return;
      if (pendingWalk) {
        const p = pendingWalk; pendingWalk = null; walkQueue.length = 0;
        p.near ? pathToNear(p.x, p.z) : pathTo(p.x, p.z);
        return;
      }
      const next = walkQueue.shift();
      if (next) stepTo(next[0], next[1]);
    }
    function scheduleMoveFlush(delay = MOVE_FLUSH_MS) {
      if (moveFlushTimer) return;
      moveFlushTimer = window.setTimeout(() => { moveFlushTimer = 0; flushMoveQueue(); }, Math.max(0, delay));
    }
    function newestLocalMoveSeq() { return Math.max(moveSeq, lastAckMoveSeq); }
    function softCorrectMe(x, z) {
      const tx = Math.trunc(Number(x)), tz = Math.trunc(Number(z));
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].kind === "correct") anims.splice(i, 1);
      const from = { x: player.position.x, z: player.position.z };
      me.x = tx; me.z = tz;
      if (ST.me) { ST.me.x = tx; ST.me.z = tz; }
      anims.push({ kind: "correct", t: 0, dur: 0.18, from, to: { x: tx, z: tz }, done: () => { player.position.set(tx, 0.22, tz); refreshWindow(); } });
    }
    function reconcileMovePosition(x, z) {
      const tx = Math.trunc(Number(x)), tz = Math.trunc(Number(z));
      if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
      const d = cheb(me.x, me.z, tx, tz);
      if (d <= 0) return;
      if (d <= MOVE_SOFT_CORRECT_TILES) softCorrectMe(tx, tz);
      else hardSnapMe(tx, tz);
    }
    function finishMoveBatch() {
      inFlightMoveBatches = Math.max(0, inFlightMoveBatches - 1);
      moveBusy = inFlightMoveBatches > 0;
      if (netMoveQueue.length) scheduleMoveFlush(0);
    }
    function queueServerMove(x, z, from) {
      const seq = ++moveSeq;
      const intent = { x: Math.trunc(Number(x || 0)) - Math.trunc(Number(from?.x || 0)), z: Math.trunc(Number(z || 0)) - Math.trunc(Number(from?.z || 0)) };
      movePredictor.predictMove(from || { x: me.x, z: me.z }, { x, z }, intent, { seq, now: performance.now() });
      netMoveQueue.push({ seq, x, z, from, retry: 0 });
      scheduleMoveFlush();
    }
    function flushMoveQueue() {
      while (inFlightMoveBatches < MOVE_MAX_IN_FLIGHT && netMoveQueue.length) {
        const batch = netMoveQueue.splice(0, Math.min(MOVE_BATCH_MAX, netMoveQueue.length));
        const lastReq = batch[batch.length - 1];
        inFlightMoveBatches++;
        moveBusy = true;
        act("movePath", { baseSeq: lastAckMoveSeq, moveSeq: lastReq.seq, steps: batch.map((q) => ({ x: q.x, z: q.z, seq: q.seq })) }).then((r) => {
          const ackSeq = Math.max(0, Number(r?.ackSeq ?? r?.acceptedSeq ?? lastReq.seq) || 0);
          if (ackSeq <= lastAckMoveSeq) { finishMoveBatch(); return; }
          if (!r || !r.ok) {
            const staleFailure = lastReq.seq < newestLocalMoveSeq() || inFlightMoveBatches > 1 || netMoveQueue.length > 0 || walking || !!pendingWalk;
            if (!staleFailure) {
              sfx.err();
              const sx = (r && Number.isInteger(r.x)) ? r.x : confirmedMove.x;
              const sz = (r && Number.isInteger(r.z)) ? r.z : confirmedMove.z;
              confirmedMove.x = sx; confirmedMove.z = sz;
              movePredictor.reject(ackSeq || lastReq.seq, { x: sx, z: sz });
              reconcileMovePosition(sx, sz);
              pollSoon();
            }
            lastAckMoveSeq = Math.max(lastAckMoveSeq, ackSeq);
            finishMoveBatch();
            return;
          }
          lastAckMoveSeq = Math.max(lastAckMoveSeq, ackSeq);
          movePredictor.confirmThrough(lastAckMoveSeq);
          const accepted = Array.isArray(r.path) && r.path.length ? r.path : [{ x: r.x, z: r.z, seq: ackSeq }];
          const last = accepted[accepted.length - 1] || lastReq;
          confirmedMove.x = (typeof last.x === "number" ? last.x : lastReq.x);
          confirmedMove.z = (typeof last.z === "number" ? last.z : lastReq.z);
          const stillAhead = walking || walkQueue.length > 0 || netMoveQueue.length > 0 || !!pendingWalk || inFlightMoveBatches > 1 || lastAckMoveSeq < moveSeq;
          if (ST.me) {
            ST.me.x = stillAhead ? me.x : confirmedMove.x;
            ST.me.z = stillAhead ? me.z : confirmedMove.z;
            if (typeof r.energy === "number") { ST.me.energy = r.energy; ST.me.energyAt = performance.now(); }
            if (r.inv) ST.me.inv = { ...(ST.me.inv || {}), ...r.inv };
            if (typeof r.xp === "number") ST.me.xp = r.xp;
          }
          if (!stillAhead) {
            const rec = movePredictor.reconcile({ x: confirmedMove.x, z: confirmedMove.z }, lastAckMoveSeq, { softTiles: 0.35, hardTiles: MOVE_SOFT_CORRECT_TILES + 0.75 });
            reconcileMovePosition(rec.predicted.x, rec.predicted.z);
          }
          tryPickupAt(confirmedMove.x, confirmedMove.z);
          if (r.partial) {
            if (!stillAhead) {
              if (r.stoppedMsg) say(r.stoppedMsg, 1200);
              const rec = movePredictor.reconcile({ x: confirmedMove.x, z: confirmedMove.z }, lastAckMoveSeq, { softTiles: 0.35, hardTiles: MOVE_SOFT_CORRECT_TILES + 0.75 });
              reconcileMovePosition(rec.predicted.x, rec.predicted.z);
              pollSoon();
            }
            finishMoveBatch();
            return;
          }
          if (r.lootGone || r.inv) pollSoon();
          refreshWindow(); refreshNear();
          if (ST.tool === "use" && ST.useAfterWalkUid != null) {
            const b = buildPool.get(ST.useAfterWalkUid);
            if (b && cheb(b.x, b.z, me.x, me.z) <= 1) { const uid = ST.useAfterWalkUid; ST.useAfterWalkUid = null; setTimeout(() => useBuildingClient(uid), 0); }
          }
          if (ST.tool === "claim" && captureTargetHere(me.x, me.z)) setTimeout(() => claimTile(me.x, me.z), 0);
          finishMoveBatch();
          advanceLocalWalk();
        }).catch(() => {
          for (const q of batch.reverse()) {
            if (q.seq <= lastAckMoveSeq || q.retry >= 2) continue;
            q.retry = Number(q.retry || 0) + 1;
            netMoveQueue.unshift(q);
          }
          finishMoveBatch();
          const now = performance.now();
          if (now - moveErrorAt > 1200) { moveErrorAt = now; say(t("toast.networkHiccup", "Network hiccup — movement will resync."), 1200); }
          scheduleMoveFlush(120);
          pollSoon();
        });
      }
    }
    function clientMoveCost() { return Math.max(0, Number(ST.me?.tuning?.moveEnergy ?? MOVE_COST)); }
    function clientEnergyNow() {
      const m = ST.me;
      if (!m) return 0;
      const base = Number(m.energy || 0);
      const regen = Number(m.regen || 0);
      const dt = Math.max(0, performance.now() - Number(m.energyAt || performance.now())) / 1000;
      return Math.min(Number(m.maxE || base || 0), base + regen * dt);
    }
    let lowEnergyToastAt = 0;
    const moveMeasureA = new THREE.Vector3();
    const moveMeasureB = new THREE.Vector3();
    function projectedMoveDistance(from, to) {
      moveMeasureA.set(from.x, 0.22, from.z).project(camera);
      moveMeasureB.set(to.x, 0.22, to.z).project(camera);
      const dx = (moveMeasureB.x - moveMeasureA.x) * Math.max(1, W());
      const dy = (moveMeasureB.y - moveMeasureA.y) * Math.max(1, H());
      return Math.sqrt(dx * dx + dy * dy);
    }
    function projectedMoveReference(from) {
      // Use the normal one-tile grid-axis step as the reference feel. In the
      // isometric camera, some world-diagonal steps become long screen-horizontal
      // hops; those need a longer duration or they look like speed bursts.
      const sx = projectedMoveDistance(from, { x: from.x + 1, z: from.z });
      const sz = projectedMoveDistance(from, { x: from.x, z: from.z + 1 });
      return Math.max(1, Math.min(sx || Infinity, sz || Infinity));
    }
    function travelStepDuration(from, to) {
      // Low energy no longer slows the client. The server still spends/rebuilds
      // energy and validates every move as an adjacent step, but movement feel
      // stays crisp instead of pretending to lag.
      const cost = Math.max(0.0001, clientMoveCost());
      if (clientEnergyNow() < cost) {
        const now = performance.now();
        if (now - lowEnergyToastAt > 2600) {
          lowEnergyToastAt = now;
          say(t("toast.lowEnergy", "Low energy — keep moving, then rest to refill."), 1200);
        }
      }
      const projected = projectedMoveDistance(from, to);
      const reference = projectedMoveReference(from);
      const dur = hopDurationForProjectedDistance({ projectedDistance: projected, referenceDistance: reference, baseSeconds: 0.16 });
      perf.record("move.hop", dur * 1000, {
        dx: to.x - from.x,
        dz: to.z - from.z,
        projected: Math.round(projected),
        reference: Math.round(reference),
        feel: movementFeelBucket(projected, reference),
      });
      return dur;
    }
    function canStartLocalStep() { return true; }
    function stepTo(x, z) {
      if (walking) { pendingWalk = { x, z, near: false }; return true; }
      if (optimisticMoveLead() >= MOVE_BATCH_MAX * 2) { pendingWalk = { x, z, near: false }; return true; }
      if (blocked(x, z)) return false;
      // Do not start a predicted hop that the server is guaranteed to reject.
      // This prevents the annoying forward-then-snap-back when energy is empty.
      if (!canStartLocalStep()) { walkQueue.length = 0; pendingWalk = null; return false; }
      const from = { x: me.x, z: me.z };
      const freeRoadStep = freeRoadTravelCellClient(from.x, from.z) || freeRoadTravelCellClient(x, z);
      const energyBeforeStep = clientEnergyNow();
      if (!freeRoadStep && energyBeforeStep < clientMoveCost()) {
        say(t("toast.outOfEnergy", "Out of energy. Roads and Landmark districts are free to travel."), 2200);
        walkQueue.length = 0; pendingWalk = null; return false;
      }
      const hopDur = travelStepDuration(from, { x, z });
      walking = true;
      me.x = x; me.z = z;
      if (ST.me) {
        ST.me.x = x; ST.me.z = z;
        ST.me.energy = freeRoadStep ? energyBeforeStep : Math.max(0, energyBeforeStep - clientMoveCost());
        ST.me.energyAt = performance.now();
      }
      anims.push({ kind: "hop", t: 0, dur: hopDur, from, to: { x, z }, done: () => {
        walking = false; sfx.hop(); tryPickupAt(x, z); queueServerMove(x, z, from); advanceLocalWalk();
      } });
      return true;
    }
    function tryMoveDelta(dx, dz) {
      if (ST.modal || ST.screen !== "playing") return;
      const q = ((Math.round((normalizeCameraYaw(ST.visual?.cameraYaw, Math.PI / 4) - Math.PI / 4) / (Math.PI / 2)) % 4) + 4) % 4;
      const rot = [[1,0,0,1],[0,-1,1,0],[-1,0,0,-1],[0,1,-1,0]][q];
      const rx = dx*rot[0] + dz*rot[1], rz = dx*rot[2] + dz*rot[3];
      walkQueue.length = 0;
      stepTo(me.x + rx, me.z + rz);
    }
    function pathTo(tx, tz) {
      if (walking) { pendingWalk = { x: tx, z: tz, near: false }; return true; }
      if (blocked(tx, tz) || (tx === me.x && tz === me.z)) return false;
      if (cheb(tx, tz, me.x, me.z) > PATH_R) return false;
      const start = key(me.x, me.z);
      const prev = new Map([[start, null]]); const q = [[me.x, me.z]]; let found = false;
      while (q.length && prev.size < 2600) {
        const [cx, cz] = q.shift();
        if (cx === tx && cz === tz) { found = true; break; }
        for (const [dx, dz] of N8) {
          const nx = cx + dx, nz = cz + dz, nk = key(nx, nz);
          if (prev.has(nk) || blocked(nx, nz) || cheb(nx, nz, me.x, me.z) > PATH_R + 2) continue;
          prev.set(nk, [cx, cz]); q.push([nx, nz]);
        }
      }
      if (!found) return false;
      const path = []; let cur = [tx, tz];
      while (cur && key(cur[0], cur[1]) !== start) { path.unshift(cur); cur = prev.get(key(cur[0], cur[1])); }
      walkQueue.length = 0; walkQueue.push(...path.slice(1));
      if (path[0]) stepTo(path[0][0], path[0][1]);
      return true;
    }
    function pathToNear(tx, tz) {
      if (walking) { pendingWalk = { x: tx, z: tz, near: true }; return true; }
      if (cheb(tx, tz, me.x, me.z) <= 1) return true;
      const spots = N8.map(([dx, dz]) => [tx + dx, tz + dz])
        .filter(([x, z]) => !blocked(x, z) && cheb(x, z, me.x, me.z) <= PATH_R)
        .sort((a, b) => cheb(a[0], a[1], me.x, me.z) - cheb(b[0], b[1], me.x, me.z));
      for (const [x, z] of spots) if (pathTo(x, z)) return true;
      return false;
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
      return null;
    }
    function buildingFromEvent(ev) {
      const c = cellFromEvent(ev); if (!c) return null;
      const b = buildAt.get(key(c.x, c.z));
      return b ? { uid: b.uid, b } : null;
    }

    const clock = new THREE.Clock(); let mmT = 0, decorT = 0, envT = 0, lastRenderAt = 0;
    let perfSlowFrames = 0, perfTotalFrames = 0, perfFastMode = false;
    function enterPerfFastMode() {
      if (perfFastMode) return;
      perfFastMode = true;
      visualPerf = { ...visualPerf, quality: "fast", pixelRatioCap: Math.min(visualPerf.pixelRatioCap || 1, 0.88), decorStep: Math.max(visualPerf.decorStep || 0, 0.18), envStep: Math.max(visualPerf.envStep || 0, 0.42), frameMs: 0 };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, visualPerf.pixelRatioCap));
      try { for (const c of clouds || []) c.visible = false; } catch {}
      try { document.documentElement.classList.add("sc-perf-fast"); } catch {}
      setFrustum?.();
    }
    renderer.setAnimationLoop((frameNow = performance.now()) => {
      const frameStart = performance.now();
      const nowMs = typeof frameNow === "number" ? frameNow : performance.now();
      if (visualPerf.frameMs && nowMs - lastRenderAt < visualPerf.frameMs) return;
      lastRenderAt = nowMs;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05), t = clock.elapsedTime;
      const worldTickStart = performance.now();
      perfTotalFrames++;
      if (rawDt > 0.022) perfSlowFrames++;
      if (!perfFastMode && perfTotalFrames >= 150) {
        if (shouldEnterPerfMode({ slowFrames: perfSlowFrames, totalFrames: perfTotalFrames })) enterPerfFastMode();
        perfSlowFrames = 0; perfTotalFrames = 0;
      }
      if (decorT === 0 || decorT > visualPerf.decorStep) tickVisualTextures(t);
      envT += dt; if (envT > visualPerf.envStep) { envT = 0; updateEnvironment(t); }
      decorT += dt; const decorStep = decorT > visualPerf.decorStep; if (decorStep) decorT = 0;
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur);
        if (a.kind === "hop") {
          const x = a.from.x + (a.to.x - a.from.x) * k, z = a.from.z + (a.to.z - a.from.z) * k;
          player.position.set(x, 0.22 + Math.sin(k * Math.PI) * 0.24, z);
        } else if (a.kind === "correct") {
          const ease = 1 - Math.pow(1 - k, 3);
          const x = a.from.x + (a.to.x - a.from.x) * ease, z = a.from.z + (a.to.z - a.from.z) * ease;
          player.position.set(x, 0.22, z);
        } else if (a.kind === "in") { if (a.obj) a.obj.scale.setScalar(0.01 + 0.99 * k); }
        else if (a.kind === "up") { if (a.obj) { a.obj.position.y = 0.52 + k * 0.7; a.obj.scale.setScalar(1 - k * 0.9); } }
        else if (a.kind === "pulse") { if (a.obj) { const p = 1 + Math.sin(k * Math.PI) * 0.09; const b = a.base || { x: 1, y: 1, z: 1 }; a.obj.scale.set(b.x * p, b.y * (1 + Math.sin(k * Math.PI) * 0.04), b.z * p); } }
        else if (a.kind === "float") { if (a.obj) { a.obj.position.y = (a.fromY || 1.2) + k * 0.72; if (a.obj.material) a.obj.material.opacity = Math.max(0, 1 - k); } }
        if (k >= 1) { if (a.kind === "pulse" && a.obj && a.base) a.obj.scale.copy(a.base); anims.splice(i, 1); a.done && a.done(); }
      }
      if (!anims.some((a) => a.kind === "hop" || a.kind === "correct")) player.position.set(me.x, 0.22, me.z);
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
      // Keep visible idle motion smooth every frame; only expensive/noisy lights/clouds are throttled.
      for (const s of spinners) s.rotation.z -= dt * 2.4;
      for (const s of spinsY) s.rotation.y += dt * 1.6;
      for (const wv of wavers) wv.rotation.y = Math.sin(t * 2.4 + wv.position.y) * 0.16;
      for (const b of bobbers) b.position.y = (b.userData.baseY != null ? b.userData.baseY : b.position.y) + Math.sin(t * 2.0 + b.position.x) * 0.035;
      for (const l of lootPool.values()) { l.group.position.y = 0.52 + Math.sin(t * 2.1 + l.x) * 0.052; l.group.rotation.y += dt * 1.0; }
      if (decorStep) {
        for (const f of flickers) f.material.emissiveIntensity = 0.78 + Math.sin(t * 6 + f.position.x * 7) * 0.24;
      }
      for (const r of rigPool.values()) {
        if (!r.hop && r.queue && r.queue.length) {
          const [nx, nz] = r.queue.shift();
          const dur = r.queue && r.queue.length > 3 ? 0.085 : 0.13;
          r.hop = { from: r.group.position.clone(), to: new THREE.Vector3(nx, 0.22, nz), t: 0, dur };
        }
        if (r.hop) {
          r.hop.t += dt; const k = Math.min(1, r.hop.t / r.hop.dur);
          r.group.position.x = r.hop.from.x + (r.hop.to.x - r.hop.from.x) * k;
          r.group.position.z = r.hop.from.z + (r.hop.to.z - r.hop.from.z) * k;
          r.group.position.y = 0.22 + Math.sin(k * Math.PI) * 0.18;
          if (k >= 1) { r.group.position.copy(r.hop.to); r.hop = null; }
        } else {
          r.group.position.y = 0.22;
        }
      }
      if (decorStep) for (const c of clouds) { c.position.x += c.userData.v * visualPerf.decorStep; if (c.position.x > me.x + 30) c.position.x = me.x - 30; }
      const camEase = visualPerf.cameraMode === "classic" ? 0.13 : visualPerf.cameraMode === "low" ? 0.16 : 1 - Math.pow(0.001, dt);
      camTarget.x += (player.position.x - camTarget.x) * camEase;
      camTarget.z += (player.position.z - camTarget.z) * camEase;
      camera.position.copy(camTarget).add(camOffset); camera.lookAt(camTarget);
      sun.position.set(camTarget.x + sunOffset.x, sunOffset.y, camTarget.z + sunOffset.z); sun.target.position.copy(camTarget);
      mmT += dt; if (mmT > 1.25) { mmT = 0; drawMinimap(); }
      perf.record("webgl.tick", performance.now() - worldTickStart);
      const renderStart = performance.now();
      renderer.render(scene, camera);
      perf.record("webgl.render", performance.now() - renderStart);
      const frameMs = performance.now() - frameStart;
      perf.record("frame.total", frameMs, { rawDtMs: rawDt * 1000, anims: anims.length, rigs: rigPool.size, builds: buildPool.size, cells: cells.size });
      perfMini.update({ frame: frameMs, cells: cells.size, resources: doodadPool.size + lootPool.size, draws: renderer.info?.render?.calls || 0, tris: renderer.info?.render?.triangles || 0 });
    });

    function drawMinimap() {
      if (!ST.me || ST.screen !== "playing") return;
      if (ST.modal || ST.panel || !minimapEl?.isConnected) return;
      const rect = minimapEl.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      perf.measure("ui.minimap", () => drawKnownWorldMap(minimapEl, false));
      capitalCompass.update();
    }

    function updateMinimapInfo() {
      capitalCompass.update();
      if (!minimapEl?.isConnected) return;
      const stale = document.getElementById("sc-minimap-info");
      if (stale) stale.remove();
      if (ST.screen !== "playing" || ST.modal || !ST.me) return;
      const bonus = Math.max(0, Number(ST.landmarkBonusPct || 0) || 0);
      const hour = currentWorldHour(ST, Number(ST.now || Date.now()));
      const label = hour < 5 ? "Night" : hour < 8 ? "Dawn" : hour < 18 ? "Day" : hour < 21 ? "Dusk" : "Night";
      const x = Math.trunc(Number(ST.me?.x || 0));
      const z = Math.trunc(Number(ST.me?.z || 0));
      const text = `Minimap · ${label} ${String(hour).padStart(2, "0")}:00 · You ${x}, ${z} · Landmark bonus +${bonus}% coins`;
      minimapEl.setAttribute("aria-label", text);
      minimapEl.title = text;
    }

    function onResize() { renderer.setSize(W(), H()); setFrustum(); }
    window.addEventListener("resize", onResize);

    function markDoodadGone(x, z) {
      const k = key(x, z);
      exceptions.set(k, "gone");
      const dd = doodadPool.get(k);
      if (dd) doodadPool.delete(k);
      refreshCell(Math.trunc(Number(x || 0)), Math.trunc(Number(z || 0)));
      rebuildResourceBatches(true);
    }

    return {
      applyWorld, applyPlayers, applyMe, me, cellFromEvent, buildingFromEvent, pathTo, pathToNear, tryMoveDelta,
      blocked, buildPoolAt, doodadVisible, burst, floatText, shockwave, hoverMarker, hardSnapMe, markDoodadGone, removeBuild,
      setHintCells, hideBuildGhost, showBuildGhost, refreshWindow, rebuildBuilding, animateBuildingUse, refreshConstructionProgress,
      refreshOwnRig: () => ensureRig(true),
      applyVisualQuality,
      hasPendingMove,
      tileOwner, buildPool, buildAt, lootPool, rigPool, tradePostPool, cells,
      updateMinimapInfo,
      rotateCam: (delta = CAMERA_ROTATION_STEP) => stepCameraYaw(delta),
      refreshCameraRotation: () => { rebuildResourceBatches(true); },
      refreshCameraZoom: () => { setFrustum(); refreshWindow(true); },
      refreshEnvironment: () => updateEnvironment(clock?.elapsedTime || 0),
      zoom: (delta = 0) => setCameraZoom((ST.visual?.cameraZoom || 1) + Number(delta || 0), false),
      walkQueueClear: () => { walkQueue.length = 0; pendingWalk = null; },
      dispose: () => { renderer.setAnimationLoop(null); window.removeEventListener("resize", onResize); renderer.dispose(); worldEl.removeChild(renderer.domElement); },
    };
  })();

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
    if (!updateKeyboardMoveIntent()) return;
    keyboardMoveAccumulator.tick(now, () => ST.screen === "playing" && !ST.updateRequired && !!world?.tryMoveDelta, (intent) => world.tryMoveDelta(intent.x, intent.z));
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
    const d = world.doodadVisible(x, z);
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
            const gainText = String(r.note || "").match(/(?:\+\d+[^.]*|\d+\s+(?:wood|stone|food)[^.]*)/i)?.[0] || (kind === "tree" ? "+wood dropped" : kind === "rock" ? "+stone dropped" : "+food");
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
    const hitB = world.buildingFromEvent(ev);
    const c = world.cellFromEvent(ev);
    if (hitB) { openBuildingInspect(hitB); return; }
    if (c) {
      if (tradePostAt(c.x, c.z) || proceduralNpcAt(c.x, c.z) || world.doodadVisible(c.x, c.z)) openObjectPreview(worldObjectPreviewForCell(c));
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
        if (r.lootGone && world.lootPool?.has?.(Number(r.lootGone))) {
          const gone = world.lootPool.get(Number(r.lootGone));
          if (gone?.group) { try { gone.group.parent?.remove?.(gone.group); } catch {} }
          world.lootPool.delete(Number(r.lootGone));
        }
        const note = String(r.note || "Picked up.").replace(/^Picked up\s*/i, "").replace(/\.$/, "");
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
    if (world.doodadVisible(x, z)) return "Clear the tree or rock on the center tile first.";
    if (world.me.x === x && world.me.z === z) return "Step aside first.";
    for (const [dx, dz] of padOffsetsForDef(def)) {
      const sx = x + dx, sz = z + dz;
      const st = world.tileOwner.get(key(sx, sz));
      if (!st || st.owner !== ST.me.id) return `Claim the full ${padName} first.`;
      if (world.buildPoolAt(sx, sz)) return `The ${padName} is blocked by another building.`;
      if (world.doodadVisible(sx, sz)) return `Clear trees and rocks from the ${padName} first.`;
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
    if (world.doodadVisible(x, z)) return "Clear trees and rocks before placing a tool.";
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
    if (world.doodadVisible(c.x, c.z)) return "Clear the resource first";
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
    const d = world.doodadVisible(c.x, c.z);
    if (d) return { kind: d === "food" ? "food" : d === "rock" ? "rock" : "tree", x: c.x, z: c.z, biome: biomeAt(c.x, c.z).name };
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
    const c = world.cellFromEvent(ev);
    if (c) { ST.hoverCellX = c.x; ST.hoverCellZ = c.z; }
    if (!c) { ST.hoverIntent = "walk"; syncToolCursor(); world.hoverMarker.visible = false; world.hideBuildGhost(); hideTip(); return; }
    ST.hoverIntent = hoverIntentForCell(c);
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
    const hitB = world.buildingFromEvent(ev), c = world.cellFromEvent(ev);
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
        const targetPlayer = (ST.players || []).find((q) => q && q.id !== ST.me?.id && q.x === c.x && q.z === c.z);
        if (targetPlayer) {
          if (cheb(c.x, c.z, world.me.x, world.me.z) <= 1) act("fight", { targetId: targetPlayer.id }).then((r) => { if (r?.ok) { sfx.hit(); pollSoon(); } });
          else world.pathToNear(c.x, c.z);
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
      const d = world.doodadVisible(c.x, c.z);
      if (d && d !== want) { sfx.err(); say(ST.tool === "wood" ? t("toast.useStonePick", "Use the stone pick for rocks.") : t("toast.useWoodAxe", "Use the wood axe for trees.")); return; }
      if (d === want && !world.buildPoolAt(c.x, c.z)) {
        startChop(c.x, c.z);
        return;
      }
    }
    if (ST.tool === "none" && c) {
      if (hitB) { openBuildingInspect(hitB); return; }
      const d = world.doodadVisible(c.x, c.z);
      if (d && !world.buildPoolAt(c.x, c.z)) { openObjectPreview(worldObjectPreviewForCell(c)); return; }
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
      const target = world.buildPoolAt(c.x, c.z);
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
      if (tradePostAt(c.x, c.z) || proceduralNpcAt(c.x, c.z) || world.doodadVisible(c.x, c.z)) openObjectPreview(worldObjectPreviewForCell(c));
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
    const coins = world?.lootPool ? Array.from(world.lootPool.values()).filter((l) => l.group && l.x != null).length : 0;
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
    const randomBody = new THREE.Color().setHSL(randomHue / 360, 0.62, 0.58).getHex();
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

  function syncToolCursor() {
    const cursor = toolCursorForState({ screen: ST.screen, mode: ST.mode, tool: ST.tool, placing: ST.placing, hover: ST.hoverIntent });
    if (root.dataset.toolCursor !== cursor) root.dataset.toolCursor = cursor;
  }

  function paint(force = false, only = null) {
    syncToolCursor();
    const paintStart = performance.now();
    let changed = 0;
    /* chat panel visibility is imperative */
    perf.measure("ui.hints", () => updateHints());
    chatEl.style.display = ST.screen === "playing" ? "flex" : "none";
    minimapEl.style.display = (ST.screen === "playing" && !ST.modal) ? "block" : "none";
    try { world?.updateMinimapInfo?.(); } catch {}
    vignetteEl.style.display = ST.screen === "playing" ? "block" : "none";
    if (ST.screen !== "playing" || ST.modal) hideCtx();
    let utilityRendered = false;
    const forceSet = only ? new Set(Array.isArray(only) ? only : [only]) : null;
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (forceSet && !forceSet.has(r.name)) continue;
      const regionStart = performance.now();
      render(r.view(), r.root);
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
  pollT = scheduler.every("state.poll", 850, () => poll(), { immediate: false });
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
