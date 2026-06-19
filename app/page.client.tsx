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
  BOMB_ITEM_COST, BODY_COLORS, COLOR_CHOICES, COSTI, DESTROY_BY_ID, DESTROY_TOOLS, ECONOMY, FINAL_TEXT, GEAR_BY_ID, HAT_COLORS, GOLD_MINE_KIND, GOLD_PER_CRAFTS_FIXED, WORLD_WONDER_GOLD_COST, WORLD_WONDER_PLAZA_RADIUS, WORLD_WONDER_PLAZA_SIZE as SHARED_WONDER_PLAZA_SIZE, WORLD_WONDER_PLAZA_TILES as SHARED_WONDER_PLAZA_TILES, WORLD_WONDER_BUILD_MS, NORMAL_BUILDING_BUILD_MS, DECOR_BUILDING_BUILD_MS,
  LIBRARY, LIB_BY_ID, MAX_HP, MAX_LEVEL, MILESTONES, MOVE_COST, N4, N8, NPC_TRADES, PACK_SIZE,
  RECIPES, REDEEM_MIN_GOLD, RES_KEYS, RES_NAMES, SKILLS, SLOTS, SLOT_LABEL, USE_ITEMS,
  biomeAt, biomeTerrainAt, cheb, gearStat, harvestMs, hrand, key, lvlMul, naturalDoodad, proceduralNpcAt, repairCost,
  skillLvl, tradePostAt, upgradeCost, xpForLevel,
} from "../game/shared";
import {
  M, ME, buildBanner, buildRig, buildRock, buildTree, lootMesh,
  makeBuildingGroup, makeLabel, makeSfx,
} from "../client/meshes";
import { loadAtlasRuntimeConfig, terrainMats, tickVisualTextures, setTerrainVisualPrefs } from "../client/textures";
import { loadCharacterProfile, saveCharacterProfile, type CharacterProfile } from "../client/dollProfile";
import { isMoveKey, movementVectorFromKeys, normalizeMoveKey } from "../client/game/directionalInput";
import { CORE_ACTIONS } from "../client/ui/coreActions";
import { actionBarActive } from "../client/ui/actionBarState";
import { MORE_MENU_GROUPS } from "../client/ui/moreMenu";
import { ribbonModeForState } from "../client/ui/ribbonMode";
import { ActionRibbon } from "../client/ui/actionRibbons";
import { InspectPanelView } from "../client/ui/inspectPanel";

const AUTH_KEY = "solcraft:auth";
const FACE_KEY = "solcraft:face.v1";
const RENDER_R = 48;
const TILE_LOAD_R = RENDER_R + 18;
const TILE_LOAD_R_MAX = 92;
const TILE_WINDOW_HYSTERESIS = 9;
const PATH_R = 112;
const MOVE_BATCH_MAX = 18;
const REMOTE_FULL_RIG_RADIUS = 16;
const REMOTE_FULL_RIG_BUDGET = 24;
const CLIENT_BOOT_AT = Date.now();
const UPDATE_ACK_KEY = "solcraft:client:ackVersion:v1";
const WALKTHROUGH_KEY = "solcraft:firstGuide:v2";
const UI_SETTINGS_KEY = "solcraft:uiScale:v1";
const UI_SCALE_MIN = 0.50;
const UI_SCALE_MAX = 2.00;
const UI_SCALE_STEP = 0.08;
const CAMERA_ZOOM_MIN = 0.75;
const CAMERA_ZOOM_MAX = 2.15;
const CAMERA_ZOOM_STEP = 0.18;
const CAMERA_ROTATION_STEP = 0; // fixed classic isometric camera; expanded minimap handles global view
const GUIDE_TABS = [
  ["actions", "Actions"],
  ["buildings", "Buildings"],
  ["economy", "Economy"],
  ["skills", "Skills"],
  ["done", "Done"],
];

const VISUAL_QUALITY_CHOICES = ["auto", "crisp", "balanced", "fast"];
const MOTION_FEEL_CHOICES = ["smooth", "classic", "low"];
const WONDER_PLAZA_SIZE = SHARED_WONDER_PLAZA_SIZE || 9;
const WONDER_PLAZA_RADIUS = WORLD_WONDER_PLAZA_RADIUS || 4;
const WONDER_PLAZA_TILES = SHARED_WONDER_PLAZA_TILES || 81;
const WONDER_AI_TIME_HINT = "usually 5–25s";
const WONDER_BUILD_TIME_HINT = `${Math.max(1, Math.round((WORLD_WONDER_BUILD_MS || 45000) / 1000))}s construction`;
const WONDER_FOOTPRINT_CHOICES = [3, 5, 7, 9];
const WONDER_MODE_CHOICES = [
  { id: "district", name: "District / many tiles", text: "Multiple towers, halls, gardens, pylons, and accents spread across the plaza." },
  { id: "single", name: "Big single landmark", text: "One dominant monument centered on the plaza with support props." },
];
const WONDER_PALETTES = [
  { id: "solar", name: "Solar gold", colors: ["#fff0a8", "#ffd76e", "#c79337", "#14f195"] },
  { id: "arcane", name: "Arcane violet", colors: ["#f3ead7", "#9945ff", "#5a2d91", "#7dcfe8"] },
  { id: "emerald", name: "Emerald mint", colors: ["#dfffee", "#14f195", "#0d7054", "#7dcfe8"] },
  { id: "ember", name: "Ember red", colors: ["#ffe3c2", "#ffb45e", "#d6604f", "#8e3d26"] },
  { id: "frost", name: "Frost blue", colors: ["#ecfbff", "#b8e9ff", "#7dcfe8", "#31507d"] },
  { id: "royal", name: "Royal prism", colors: ["#fff0a8", "#9945ff", "#4d287f", "#ffd76e"] },
];
const WONDER_NAME_PRESETS = [
  "Crystal Skyscraper",
  "Solar Citadel",
  "Arcane Observatory",
  "Emerald Garden District",
  "Royal Sky Bridge",
  "Frost Beacon",
  "Ember Forge Cathedral",
  "Moonlit Archive",
];
function normalizeWonderFootprintClient(v) { const n = Math.trunc(Number(v || 9)); return WONDER_FOOTPRINT_CHOICES.includes(n) ? n : 9; }
function wonderRadiusClient(v) { return Math.max(1, Math.floor((normalizeWonderFootprintClient(v) - 1) / 2)); }
function wonderTilesClient(v) { const s = normalizeWonderFootprintClient(v); return s * s; }
function wonderBuildMsClient(size, mode) { size = normalizeWonderFootprintClient(size); const base = size === 3 ? 24000 : size === 5 ? 32000 : size === 7 ? 40000 : 48000; return mode === "single" ? Math.max(22000, base - 4000) : base; }


function pickChoice(value, choices, fallback) {
  const v = String(value || "").trim().toLowerCase();
  return choices.includes(v) ? v : fallback;
}
function resolveVisualQuality(visual, lowEnd = false) {
  const q = pickChoice(visual?.quality, VISUAL_QUALITY_CHOICES, "auto");
  if (q !== "auto") return q;
  return lowEnd ? "fast" : "balanced";
}
function visualPerfFor(visual, lowEnd = false) {
  const quality = resolveVisualQuality(visual, lowEnd);
  const motion = pickChoice(visual?.motion, MOTION_FEEL_CHOICES, "smooth");
  const pixelRatioCap =
    quality === "crisp" ? 1.55 :
    quality === "balanced" ? 1.25 :
    0.92;
  return {
    quality,
    motion,
    antialias: quality === "crisp" || (!lowEnd && quality === "balanced"),
    pixelRatioCap,
    frameMs: motion === "classic" ? 22 : motion === "low" ? 33 : 0,
    decorStep: quality === "fast" ? 0.14 : quality === "balanced" ? 0.085 : 0.055,
    envStep: quality === "fast" ? 0.40 : quality === "balanced" ? 0.28 : 0.18,
    cameraMode: motion,
  };
}

const CHARACTER_COLOR_KEYS = ["skin", "hair", "primaryCloth", "secondaryCloth", "leather", "metal"];
const CHARACTER_COLOR_PRESETS = [
  { id: "solana", name: "Solana", look: "Explorer", skin: "#f0b887", hair: "#f4f0dd", primaryCloth: "#31507d", secondaryCloth: "#14f195", leather: "#6a4124", metal: "#b8c2cc", parts: { head: 0, hair: 0, torso: 1, legs: 1, back: 0, tool: 0, hat: 0 } },
  { id: "forest", name: "Forest", look: "Ranger", skin: "#c68f63", hair: "#2f2118", primaryCloth: "#2f6b46", secondaryCloth: "#8fbf6a", leather: "#5a3a22", metal: "#b0b9b5", parts: { head: 1, hair: 0, torso: 2, legs: 2, back: 0, tool: 0, hat: 0 } },
  { id: "sunforge", name: "Sunforge", look: "Smith", skin: "#a96b4d", hair: "#f2c35b", primaryCloth: "#8e3d26", secondaryCloth: "#e0b54a", leather: "#6a3e20", metal: "#ffe0a6", parts: { head: 2, hair: 0, torso: 3, legs: 3, back: 0, tool: 0, hat: 0 } },
  { id: "tide", name: "Tide", look: "Sailor", skin: "#8cc7d8", hair: "#17384a", primaryCloth: "#1e5f86", secondaryCloth: "#7dcfe8", leather: "#38516a", metal: "#d6f2ff", parts: { head: 3, hair: 0, torso: 4, legs: 4, back: 0, tool: 0, hat: 0 } },
  { id: "violet", name: "Violet", look: "Mage", skin: "#d5a5ff", hair: "#33204a", primaryCloth: "#56359b", secondaryCloth: "#9945ff", leather: "#4b315f", metal: "#dec8ff", parts: { head: 4, hair: 0, torso: 5, legs: 5, back: 0, tool: 0, hat: 0 } },
  { id: "rose", name: "Rose", look: "Trader", skin: "#f0b8a0", hair: "#5b2434", primaryCloth: "#8f3049", secondaryCloth: "#f08bb0", leather: "#6a3b35", metal: "#ffd5dc", parts: { head: 5, hair: 0, torso: 6, legs: 6, back: 0, tool: 0, hat: 0 } },
  { id: "ash", name: "Ash", look: "Guard", skin: "#d2c4ad", hair: "#2a2e35", primaryCloth: "#4a4f5a", secondaryCloth: "#9aa3ad", leather: "#37312d", metal: "#cbd1d8", parts: { head: 6, hair: 0, torso: 7, legs: 7, back: 0, tool: 0, hat: 0 } },
  { id: "mint", name: "Mint", look: "Builder", skin: "#f2d2ad", hair: "#0f332d", primaryCloth: "#146b5a", secondaryCloth: "#14f195", leather: "#4b3a22", metal: "#dbfff1", parts: { head: 7, hair: 0, torso: 0, legs: 0, back: 0, tool: 0, hat: 0 } },
];
const BUILDING_COLOR_PRESETS = [
  { id: "default", name: "Default", primary: null, secondary: "#ffd76e" },
  { id: "paper", name: "Paper / Brick", primary: "#f6e7c8", secondary: "#d6604f" },
  { id: "harbor", name: "Harbor Blue", primary: "#3f8ab5", secondary: "#7dcfe8" },
  { id: "grove", name: "Grove Mint", primary: "#35b87a", secondary: "#14f195" },
  { id: "sun", name: "Sun Gold", primary: "#e0b54a", secondary: "#ffe0a6" },
  { id: "violet", name: "Violet Neon", primary: "#9263c4", secondary: "#9945ff" },
  { id: "rose", name: "Rose Clay", primary: "#f08bb0", secondary: "#d6604f" },
  { id: "slate", name: "Slate Ice", primary: "#4a4f5a", secondary: "#7dcfe8" },
];
function normalizePresetHex(value, fallback = "#999999") {
  const s = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}
function presetHexToNumber(value, fallback) {
  const s = normalizePresetHex(value, "");
  return s ? parseInt(s.slice(1), 16) : fallback;
}
function characterPresetById(id) {
  return CHARACTER_COLOR_PRESETS.find((p) => p.id === id) || CHARACTER_COLOR_PRESETS[0];
}
function buildingPresetById(id) {
  return BUILDING_COLOR_PRESETS.find((p) => p.id === id) || BUILDING_COLOR_PRESETS[0];
}
function characterPresetActive(profile, preset) {
  // Color presets should only decide skin/clothes/material colors.
  // Shape/body-part choices stay independently editable.
  const palette = profile?.palette || profile || {};
  return CHARACTER_COLOR_KEYS.every((k) => normalizePresetHex(palette?.[k], "") === normalizePresetHex(preset[k], ""));
}

function loadVisualSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem("solcraft:visual.v1") || "{}");
    return {
      warmth: Number.isFinite(Number(raw.warmth)) ? Math.max(0, Math.min(1, Number(raw.warmth))) : 0.62,
      texture: Number.isFinite(Number(raw.texture)) ? Math.max(0, Math.min(1, Number(raw.texture))) : 0.18,
      shadows: raw.shadows === false ? false : true,
      quality: pickChoice(raw.quality, VISUAL_QUALITY_CHOICES, "fast"),
      motion: pickChoice(raw.motion, MOTION_FEEL_CHOICES, "classic"),
      cameraZoom: clampCameraZoom(raw.cameraZoom, 1),
      cameraYaw: normalizeCameraYaw(raw.cameraYaw, Math.PI / 4),
    };
  } catch {
    return { warmth: 0.64, texture: 0.18, shadows: true, quality: "fast", motion: "classic", cameraZoom: 1, cameraYaw: Math.PI / 4 };
  }
}
function saveVisualSettings(v) {
  const next = {
    warmth: Math.max(0, Math.min(1, Number(v?.warmth ?? 0.62))),
    texture: Math.max(0, Math.min(1, Number(v?.texture ?? 0.18))),
    shadows: v?.shadows !== false,
    quality: pickChoice(v?.quality, VISUAL_QUALITY_CHOICES, "fast"),
    motion: pickChoice(v?.motion, MOTION_FEEL_CHOICES, "classic"),
    cameraZoom: clampCameraZoom(v?.cameraZoom, 1),
    cameraYaw: normalizeCameraYaw(v?.cameraYaw, Math.PI / 4),
  };
  try { localStorage.setItem("solcraft:visual.v1", JSON.stringify(next)); } catch {}
  return next;
}
function clampUiScale(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, Math.round(n * 100) / 100));
}
function uiScalePct(value) {
  return `${Math.round(clampUiScale(value) * 100)}%`;
}
function clampCameraZoom(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, Math.round(n * 100) / 100));
}
function cameraZoomPct(value) {
  return `${Math.round(clampCameraZoom(value, 1) * 100)}%`;
}
function normalizeCameraYaw(value, fallback = Math.PI / 4) {
  const n = Number(value);
  const base = Number.isFinite(n) ? n : fallback;
  const tau = Math.PI * 2;
  return ((base % tau) + tau) % tau;
}
function cameraYawDeg(value) {
  return Math.round(normalizeCameraYaw(value, Math.PI / 4) * 180 / Math.PI) % 360;
}
function loadUiSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_SETTINGS_KEY) || "{}");
    return {
      uiScale: clampUiScale(raw.uiScale, 1),
      menuScale: clampUiScale(raw.menuScale, 1),
    };
  } catch {
    return { uiScale: 1, menuScale: 1 };
  }
}
function saveUiSettings(v) {
  const next = {
    uiScale: clampUiScale(v?.uiScale, 1),
    menuScale: clampUiScale(v?.menuScale, 1),
  };
  try { localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(next)); } catch {}
  return next;
}
function readAckedClientVersion() {
  try { return String(localStorage.getItem(UPDATE_ACK_KEY) || ""); } catch { return ""; }
}
function writeAckedClientVersion(version) {
  const v = String(version || "");
  if (!v) return;
  try { localStorage.setItem(UPDATE_ACK_KEY, v); } catch {}
}

/** UI atlas v2 contract — 4×4 cells.
    row 0: character, quests, inventory, skills
    row 1: bank, settings, sound, logout
    row 2: craft, wood, stone, capture
    row 3: build, spawn, use, energy
    Keep this in sync with the public UI atlas contract. */
const UI_SLOT: Record<string, [number, number]> = {
  character: [0, 0], quests: [1, 0], inv: [2, 0], inventory: [2, 0], skills: [3, 0],
  bank: [0, 1], settings: [1, 1], sound: [2, 1], logout: [3, 1], exit: [3, 1],
  craft: [0, 2], wood: [1, 2], stone: [2, 2], claim: [3, 2], capture: [3, 2],
  build: [0, 3], spawn: [1, 3], use: [2, 3], energy: [3, 3],
  gold: [0, 1], heart: [3, 3],
};
function UiIcon({ name, fallback = "•" }: any) {
  const slot = UI_SLOT[name] || [0, 0];
  return <span className="ui-ico" aria-hidden="true" style={{ backgroundPosition: `${slot[0] * 33.3333}% ${slot[1] * 33.3333}%` }}><span>{fallback}</span></span>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Outfit:wght@400;600;800;900&display=swap');
:root{
  --c-bg:#05080e;--c-glass:rgba(7,13,22,.90);--c-glass2:rgba(12,20,34,.86);
  --c-line:rgba(243,234,215,.11);--c-line2:rgba(243,234,215,.22);
  --c-mint:#14f195;--c-violet:#9945ff;--c-gold:#ffd76e;--c-paper:#f3ead7;
  --c-danger:#e0604c;--c-muted:#8da4b0;--c-shadow:0 16px 48px rgba(0,0,0,.46);
  --r-panel:18px;--r-card:14px;--r-btn:10px;--f-display:'Chakra Petch',ui-sans-serif;--f-body:Outfit,ui-sans-serif,system-ui,sans-serif;
  --mint:var(--c-mint);--violet:var(--c-violet);--ink:var(--c-bg);--paper:var(--c-paper);--glass:var(--c-glass);--line:var(--c-line);--line2:var(--c-line2);
}
.sc-root{position:relative;width:100%;height:100dvh;min-height:0;overflow:hidden;background:var(--ink);color:var(--paper);font-family:Outfit,ui-sans-serif,system-ui,sans-serif;touch-action:none;-webkit-touch-callout:none;user-select:none;overscroll-behavior:none;}
.sc-world{position:absolute;inset:0;}
.sc-hud{position:absolute;inset:0;pointer-events:none;}
.sc-hud>*{pointer-events:none;}
.sc-hud>*>*{pointer-events:auto;}
.glass{background:var(--c-glass);border:1px solid var(--c-line);box-shadow:var(--c-shadow),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(16px) saturate(1.18);border-radius:var(--r-panel);}
.glass2{background:var(--c-glass2);border:1px solid var(--c-line);border-radius:var(--r-card);}

.sc-top{position:absolute;top:8px;left:8px;right:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;}
.panel,.modal,.menu-card{background:var(--glass);border:1px solid var(--line);box-shadow:0 10px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(14px);border-radius:16px;}
.hud{padding:8px 9px;min-width:0;width:min(282px,calc(100vw - 16px));}
.row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.stat{display:inline-flex;align-items:center;gap:4px;padding:4px 7px;border-radius:999px;background:rgba(255,255,255,.075);font-weight:800;font-size:11px;}
.stat.good{background:rgba(20,241,149,.14);color:#baffdf;box-shadow:inset 0 0 0 1px var(--line2);}
.tiny{font-size:12px;color:#aebfc9;}
.ebar{position:relative;height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:7px;}
.ebar i{position:absolute;inset:0 auto 0 0;width:50%;border-radius:99px;background:linear-gradient(90deg,#2e9bb0,var(--mint));transition:width .3s;}
.objective{margin-top:8px;font-size:13px;color:#dffbed;display:flex;gap:6px;align-items:flex-start;}
.objective b{color:var(--mint);}
.top-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.btn{border:0;border-radius:999px;padding:7px 11px;background:#17243a;color:var(--paper);font-weight:800;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 2px 8px rgba(0,0,0,.24);font-family:inherit;font-size:12px;transition:transform .08s,filter .12s;}
.btn:hover{filter:brightness(1.18);}
.btn:active{transform:translateY(1px) scale(.98);}
.btn.primary{background:linear-gradient(135deg,var(--mint),#2e9bb0);color:#04221a;}
.btn.warn{background:linear-gradient(135deg,var(--violet),#5d2bd0);color:#fff;}
.btn.danger{background:linear-gradient(135deg,#e0604c,#a8342a);color:#fff;}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none;}
.minimap{position:absolute;right:14px;bottom:14px;width:190px;height:190px;border-radius:20px;border:1px solid var(--line2);background:#171821;box-shadow:0 12px 34px rgba(0,0,0,.36);pointer-events:auto;}
.toast{position:absolute;left:50%;top:58px;transform:translateX(-50%) translateY(-10px);opacity:0;padding:8px 13px;border-radius:999px;background:linear-gradient(135deg,var(--mint),#39d3a8);color:#04241b;font-weight:900;box-shadow:0 12px 26px rgba(0,0,0,.32);max-width:86vw;text-align:center;z-index:30;transition:opacity .18s,transform .18s;pointer-events:none;font-size:12px;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.goldsrc-chip{color:#ffd76e;font-weight:900;}
.gold-guide{margin-top:8px;padding:8px 9px;border-radius:13px;background:linear-gradient(135deg,rgba(255,215,110,.12),rgba(20,241,149,.08));border:1px solid rgba(255,215,110,.22);display:grid;gap:4px;}
.gold-guide b{color:#ffd76e;font-size:12px}.gold-guide span{font-size:11px;color:#d8cfb7}.gold-guide button{justify-self:flex-start;border:0;border-radius:999px;background:rgba(255,215,110,.16);color:#fff0b8;padding:4px 8px;font:800 10px Outfit;cursor:pointer;}
.guide-steps{display:grid;gap:8px;margin-top:12px}.guide-step{display:flex;gap:9px;align-items:flex-start;padding:9px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.guide-step.done{opacity:.62}.guide-step .dot{width:20px;height:20px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.10);font:900 11px Outfit;color:#ffd76e;flex:none}.guide-step.done .dot{background:rgba(20,241,149,.18);color:#14f195}.source-card{border-color:rgba(255,215,110,.24);background:linear-gradient(180deg,rgba(255,215,110,.08),rgba(255,255,255,.04));}
.menu{position:absolute;inset:0;display:grid;place-items:center;background:radial-gradient(1100px 700px at 50% 18%,rgba(20,241,149,.12),transparent 55%),radial-gradient(900px 700px at 80% 90%,rgba(153,69,255,.14),transparent 55%),rgba(4,8,14,.84);padding:18px;z-index:40;}
.menu-card{width:min(480px,94vw);padding:22px;max-height:92vh;overflow:auto;}
.menu-card.clean{padding:24px 24px 20px;text-align:left;}
.menu-title-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}
.menu-title-row .title{font-size:38px;margin:0;}
.menu-copy{margin:0 0 14px;color:#c8d7db;font-size:13px;line-height:1.45;}
.menu-wallet{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0 14px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line);}
.menu-actions{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:14px;}
.menu-actions .btn.primary{flex:1;}
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
.bottom-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 190px);}
.chat{position:absolute;left:12px;bottom:64px;width:min(300px,calc(100vw - 24px));max-height:160px;display:flex;flex-direction:column;overflow:hidden;border-radius:14px;background:rgba(8,13,23,.52);}
.chat-log{padding:7px 8px;overflow:auto;display:flex;flex-direction:column;gap:4px;font-size:11px;max-height:104px;}
.chat-line.sys{color:#9bffd9;}
.chat-form{display:flex;border-top:1px solid rgba(255,255,255,.1);}
.chat-form input{border:0;border-radius:0;flex:1;background:rgba(255,255,255,.05);font-size:12px;padding:8px 10px;}
.tabs{display:flex;gap:8px;margin:10px 0;}
.slot{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08);}
.packgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px;margin-top:10px;}
.packslot{aspect-ratio:1;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font-size:10px;color:#cdd9de;padding:4px;text-align:center;position:relative;}
.packslot:hover{background:rgba(20,241,149,.1);border-color:var(--line2);}
.packslot.empty{cursor:default;opacity:.45;}
.packslot .pg{font-size:22px;line-height:1;}
.packslot .pd{position:absolute;top:2px;right:5px;opacity:.5;font-size:11px;cursor:pointer;}
.packslot .pd:hover{opacity:1;color:#ff9a8a;}
.build-sep{flex:0 0 auto;align-self:stretch;min-width:8px;margin:0 4px;border-left:1px solid rgba(255,255,255,.18);border-right:1px solid rgba(20,241,149,.20);display:flex;flex-direction:column;justify-content:center;gap:2px;padding:0 10px;color:#ffe6aa;font-size:10px;text-transform:uppercase;letter-spacing:.08em;}
.build-sep small{color:#9bffd9;font-size:9px;text-transform:none;letter-spacing:0;opacity:.82;}
.scv-quick .mini.primary{background:rgba(20,241,149,.22);border-color:rgba(20,241,149,.46);color:#d9ffe9;}
.kbd{font-family:ui-monospace,Menlo,monospace;background:rgba(255,255,255,.11);border-radius:6px;padding:2px 5px;font-size:12px;}
.hpbar{height:6px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;flex:1;min-width:80px;}
.hpbar i{display:block;height:100%;background:linear-gradient(90deg,#ff7a5c,#ffd76e);border-radius:99px;}
.xpbar{position:relative;height:5px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:5px;}
.xpbar i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:linear-gradient(90deg,var(--violet),#c79bff);}
.lvlchip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:linear-gradient(135deg,var(--violet),#6a2bd0);color:#fff;font-weight:900;font-size:12px;}
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
.space-req{font-size:10px;color:#bfeee0;opacity:.9;margin-top:3px;}
.scv-cap{margin-top:6px;font-size:10px;color:#bfeee0;white-space:normal;line-height:1.2;}
.scv-cap b{color:var(--mint);} 
.menu-hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(240px,.9fr);gap:16px;align-items:stretch;margin-bottom:14px;}
.wallet-card{background:linear-gradient(135deg,rgba(20,241,149,.12),rgba(153,69,255,.16));border:1px solid var(--line2);border-radius:18px;padding:14px;display:grid;gap:8px;}
.wallet-chip{display:inline-flex;align-items:center;gap:7px;border-radius:999px;background:rgba(20,241,149,.12);border:1px solid var(--line2);padding:6px 10px;color:#baffdf;font-weight:900;font-size:12px;}
.wallet-chip.off{background:rgba(255,255,255,.07);border-color:var(--line);color:#cdd9de;}

.exchange-widget{display:grid;gap:10px;}
.exchange-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:12px;border-radius:18px;background:linear-gradient(135deg,rgba(20,241,149,.14),rgba(153,69,255,.14));border:1px solid rgba(243,234,215,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.06);}
.exchange-hero h4,.exchange-card h4{margin:0;color:var(--paper);font:900 15px/1.1 var(--f-display);letter-spacing:-.01em;}
.exchange-hero p,.exchange-card p{margin:4px 0 0;color:#b9cbd0;font:650 11.5px/1.35 var(--f-body);}
.exchange-icon{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;background:rgba(20,241,149,.16);border:1px solid rgba(20,241,149,.28);box-shadow:0 10px 24px rgba(0,0,0,.22);font-size:20px;flex:none;}
.exchange-balances{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.exchange-balance{padding:10px;border-radius:15px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.085);}
.exchange-balance small{display:block;color:var(--c-muted);font:900 9px/1 var(--f-body);letter-spacing:.08em;text-transform:uppercase;}
.exchange-balance b{display:block;margin-top:4px;color:var(--paper);font:900 21px/1 var(--f-display);letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.exchange-balance em{font-style:normal;color:#baffdf;font:900 10px/1 var(--f-body);}
.exchange-card{position:relative;display:grid;gap:8px;padding:12px 12px 12px 48px;border-radius:18px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);overflow:hidden;}
.exchange-card.deposit{background:linear-gradient(180deg,rgba(20,241,149,.075),rgba(255,255,255,.04));}
.exchange-card.withdraw{background:linear-gradient(180deg,rgba(255,215,110,.075),rgba(255,255,255,.04));}
.exchange-step{position:absolute;left:12px;top:12px;width:25px;height:25px;border-radius:10px;display:grid;place-items:center;background:rgba(20,241,149,.16);border:1px solid rgba(20,241,149,.28);color:#baffdf;font:900 12px/1 var(--f-display);}
.exchange-card.withdraw .exchange-step{background:rgba(255,215,110,.16);border-color:rgba(255,215,110,.28);color:#ffe6aa;}
.exchange-address{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:9px 10px;border-radius:13px;background:rgba(0,0,0,.22);border:1px dashed rgba(243,234,215,.16);color:#fff0c8;font:900 11px/1.2 ui-monospace,Menlo,monospace;}
.exchange-address.empty{color:#9fb2bd;font-family:var(--f-body);font-weight:800;}
.exchange-input-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;}
.exchange-input-row input{width:100%;min-width:0;}
.exchange-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center;}
.exchange-note{color:#9fb2bd;font:700 10.5px/1.35 var(--f-body);}
.exchange-note.good{color:#baffdf;}.exchange-note.warn{color:#ffe6aa;}.exchange-note.bad{color:#ffb7ad;}
.exchange-history{padding:8px 10px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);}
.exchange-history summary{cursor:pointer;font:900 11px/1 var(--f-body);color:#d8cfb7;}
@media(max-width:520px){.exchange-balances{grid-template-columns:1fr}.exchange-card{padding-left:12px;padding-top:44px}.exchange-step{top:10px}.exchange-input-row{grid-template-columns:1fr}.exchange-input-row .btn{width:100%;}}
.hud{width:min(282px,calc(100vw - 16px));}
.hud-main{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.hud-resources{display:flex;gap:5px;margin-top:6px;overflow:hidden;}
.hud-resources .stat{justify-content:center;padding:4px 6px;min-width:0;}
.hud-extra{display:none;}
.hud-hint{margin-top:5px;color:rgba(215,247,231,.86);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.objective{display:none;}
.top-actions .btn:not(.primary):not(.warn):not(.danger){opacity:.78;}
.bottom-bar{padding:5px;border-radius:999px;background:rgba(4,8,14,.22);backdrop-filter:blur(8px);}
.minimap{opacity:.84;transition:opacity .14s,transform .14s;}
.minimap:hover{opacity:1;transform:scale(1.04);}
.chat{opacity:.86;transition:opacity .14s;}
.chat:focus-within,.chat:hover{opacity:1;background:rgba(8,13,23,.86);}

.action-stack{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:grid;gap:7px;justify-items:center;width:min(940px,calc(100vw - 24px));pointer-events:none;z-index:16;}
.action-stack>*{pointer-events:auto;}
.build-ribbon{width:100%;padding:7px 8px 7px;border-radius:16px;background:rgba(4,8,14,.82);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(14px);box-shadow:0 10px 26px rgba(0,0,0,.28);overflow:hidden;position:relative;}
.build-ribbon:before,.build-ribbon:after{content:"";position:absolute;top:0;bottom:0;width:24px;z-index:2;pointer-events:none}.build-ribbon:before{left:0;background:linear-gradient(90deg,rgba(4,8,14,.82),transparent)}.build-ribbon:after{right:0;background:linear-gradient(270deg,rgba(4,8,14,.82),transparent)}
.build-strip{display:flex;flex-flow:row nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.28) rgba(255,255,255,.06);padding:2px 8px 4px;max-width:100%;white-space:nowrap;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;}.build-strip::-webkit-scrollbar{height:8px;display:block}.build-strip::-webkit-scrollbar-thumb{background:rgba(255,255,255,.28);border-radius:99px}.build-strip::-webkit-scrollbar-track{background:rgba(255,255,255,.06);border-radius:99px}.build-scroll-track{height:8px;margin:5px 8px 0;border-radius:99px;background:rgba(255,255,255,.16);overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);}.build-scroll-track i{display:block;height:100%;width:34%;min-width:48px;border-radius:99px;background:linear-gradient(90deg,var(--mint),rgba(255,255,255,.46));transform:translateX(0);transition:width .08s,transform .08s;}

.wonder-inline-planner{margin:2px 8px 8px;padding:9px 10px;border-radius:14px;background:linear-gradient(180deg,rgba(8,14,20,.88),rgba(4,8,14,.76));border:1px solid rgba(255,215,110,.24);box-shadow:0 10px 28px rgba(0,0,0,.30),inset 0 0 0 1px rgba(255,255,255,.035);}
.wonder-inline-head{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#f3ead7;margin-bottom:7px}.wonder-inline-head span{color:#b8c2cc;font-size:12px}.wonder-line-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.wonder-line-row.small{gap:6px;margin-top:7px}.wonder-prompt-line{flex:1 1 340px;min-width:220px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;padding:10px 12px;font:inherit;outline:none}.wonder-prompt-line:focus{border-color:rgba(20,241,149,.72);box-shadow:0 0 0 3px rgba(20,241,149,.12)}.btn.mini{padding:6px 9px;font-size:12px;min-height:auto}.swatch-btn{white-space:nowrap}.wonder-quick-plan{border-color:rgba(20,241,149,.28)!important;background:rgba(20,241,149,.06)!important;}

.wonder-action-ribbon{border-color:rgba(255,215,110,.26);background:linear-gradient(135deg,rgba(10,16,22,.92),rgba(14,23,28,.78));box-shadow:0 12px 34px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.05)}.wonder-only-ribbon{max-width:min(860px,calc(100vw - 24px));margin-inline:auto}.wonder-action-ribbon .wonder-prompt-line{font-size:14px;font-weight:850;min-height:40px;background:rgba(255,255,255,.055);border-color:rgba(255,215,110,.28)}.wonder-action-ribbon .tiny{color:#cfd8dc}.wonder-action-ribbon .btn.primary{box-shadow:0 0 0 1px rgba(255,255,255,.07),0 8px 20px rgba(255,215,110,.10)}.wonder-live-status{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 12px;border-radius:12px;background:rgba(255,215,110,.10);border:1px solid rgba(255,215,110,.30);color:#fff2c4;font:900 12px/1.1 var(--f-body);white-space:nowrap}.wonder-live-status.busy{background:rgba(20,241,149,.12);border-color:rgba(20,241,149,.34);color:#dfffee;animation:pulseSoft 1s ease-in-out infinite}
.build-tile{flex:0 0 104px;width:104px;min-width:104px;height:58px;border:0;border-radius:12px;background:rgba(255,255,255,.075);color:var(--paper);font:inherit;cursor:pointer;padding:6px;display:grid;grid-template-rows:18px 14px 12px;gap:1px;text-align:left;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);scroll-snap-align:start;}
.build-tile:hover{background:rgba(20,241,149,.12);}
.build-tile.on{background:linear-gradient(135deg,rgba(20,241,149,.24),rgba(153,69,255,.22));box-shadow:inset 0 0 0 1px var(--line2);}
.build-tile.locked,.build-tile:disabled{opacity:.42;cursor:not-allowed;filter:grayscale(.4);}
.build-tile .bg{font-size:17px;line-height:1;}
.build-tile .bn{font-weight:900;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.build-tile .bc{font-size:9px;color:#ffe6aa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.88;}
.action-bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:5px;width:100%;padding:6px;border-radius:18px;background:rgba(4,8,14,.82);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(14px);box-shadow:0 12px 30px rgba(0,0,0,.32);}
.action-slot{min-width:0;height:50px;border:0;border-radius:13px;background:rgba(255,255,255,.075);color:var(--paper);font-family:inherit;cursor:pointer;display:grid;grid-template-rows:19px 14px;align-items:center;justify-items:center;position:relative;box-shadow:inset 0 0 0 1px rgba(255,255,255,.09);transition:transform .08s,filter .12s,background .12s;padding-top:5px;}
.action-slot:hover{filter:brightness(1.15);}
.action-slot:active{transform:translateY(1px) scale(.98);}
.action-slot.primary,.action-slot.on{background:linear-gradient(135deg,rgba(20,241,149,.28),rgba(46,155,176,.22));box-shadow:inset 0 0 0 1px var(--line2);}
.action-slot.danger{background:linear-gradient(135deg,rgba(224,96,76,.34),rgba(130,40,35,.28));}
.action-slot:disabled{opacity:.38;cursor:not-allowed;transform:none;}
.action-slot .num{position:absolute;top:4px;left:6px;font:900 10px ui-monospace,Menlo,monospace;color:#9bffd9;opacity:.82;}
.action-slot .ico{font-size:18px;line-height:1;}
.action-slot .lbl{font-size:9px;font-weight:900;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px;opacity:.92;}
.tip{position:absolute;z-index:80;max-width:260px;padding:8px 10px;border-radius:12px;background:rgba(4,8,14,.92);border:1px solid rgba(20,241,149,.24);box-shadow:0 12px 30px rgba(0,0,0,.34);backdrop-filter:blur(10px);color:#e8fff4;font-size:12px;line-height:1.3;font-weight:700;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .08s,transform .08s;}.tip.show{opacity:1;transform:translateY(0);}.tip b{color:var(--mint);}.tip small{display:block;margin-top:2px;color:rgba(232,255,244,.68);font-weight:600;}
.bottom-bar{position:static;left:auto;bottom:auto;transform:none;display:block;max-width:none;padding:0;border-radius:0;background:transparent;backdrop-filter:none;}

.char-card{width:min(560px,94vw)}
.char-hero{display:flex;gap:14px;align-items:center;margin:10px 0 14px;padding:12px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid var(--line);}
.face-preview{width:72px;height:72px;border-radius:22px;object-fit:cover;background:linear-gradient(135deg,var(--violet),var(--mint));border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 20px rgba(0,0,0,.28);display:grid;place-items:center;font-size:28px;font-weight:900;color:#061a18;overflow:hidden;}
.face-preview.empty:before{content:"🙂";}
.char-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0 14px;}
.char-stat{padding:10px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid var(--line);}
.char-stat b{display:block;font-size:18px}.char-stat small{color:#aebfc9;font-weight:700;}
.file-btn{position:relative;overflow:hidden}.file-btn input{position:absolute;inset:0;opacity:0;cursor:pointer;}
.bomb-kit{padding:12px;border-radius:16px;background:rgba(255,215,110,.075);border:1px solid rgba(255,215,110,.22);margin-top:10px;}.leader-card{padding:12px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid var(--line);margin-top:10px;}
.sc-vignette{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(125% 95% at 50% 42%,transparent 55%,rgba(3,6,11,.55) 100%);mix-blend-mode:multiply;display:none;}
@media (max-width:720px){.title{font-size:34px}.menu-title-row .title{font-size:32px}.menu-actions{flex-direction:column;align-items:stretch}.sc-top{flex-direction:column}.top-actions{justify-content:flex-start}.minimap{width:118px;height:118px}.action-stack{left:6px;right:6px;bottom:6px;transform:none;width:auto}.action-bar{grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:3px;padding:4px}.action-slot{height:46px;border-radius:11px}.action-slot .ico{font-size:16px}.action-slot .lbl{font-size:8px}.build-tile{flex:0 0 92px;width:92px;min-width:92px}.bottom-bar{max-width:100%;left:8px;right:8px;transform:none;border-radius:18px}.chat{bottom:60px}.hud{min-width:0;width:min(282px,calc(100vw - 16px))}.hud-resources{display:flex}}

/* World of SolCrafts login landing */
.login-scene{position:absolute;inset:0;overflow:hidden;background:#03060b;}
.login-glow{position:absolute;border-radius:50%;filter:blur(60px);opacity:.55;pointer-events:none;}
.login-glow.a{width:50rem;height:50rem;left:-14rem;top:-18rem;background:radial-gradient(circle,rgba(20,241,149,.30),transparent 60%);}
.login-glow.b{width:46rem;height:46rem;right:-16rem;bottom:-16rem;background:radial-gradient(circle,rgba(153,69,255,.34),transparent 60%);}
.login-glow.c{width:30rem;height:30rem;left:40%;top:30%;background:radial-gradient(circle,rgba(20,241,149,.10),transparent 60%);}
.login-grain{position:absolute;inset:0;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.login-iso{position:absolute;right:-4vw;bottom:-6vh;width:64vw;max-width:1000px;aspect-ratio:1/.9;transform:rotateX(58deg) rotateZ(45deg) scale(1.05);transform-style:preserve-3d;opacity:.9;}
.login-iso-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);gap:10px;}
.login-tile{position:relative;border-radius:6px;background:linear-gradient(180deg,rgba(122,165,111,.20),rgba(8,13,23,.5));box-shadow:inset 0 0 0 1px rgba(243,234,215,.06);transform:translateZ(0);animation:loginTile 7s ease-in-out infinite;}
.login-tile.owned{background:linear-gradient(180deg,rgba(20,241,149,.26),rgba(8,30,24,.6));box-shadow:inset 0 0 0 1px rgba(20,241,149,.30);}
.login-tile.build:after{content:"";position:absolute;left:22%;right:22%;bottom:24%;height:54%;border-radius:5px;background:linear-gradient(180deg,#f3ead7,#c79337);box-shadow:0 6px 16px rgba(0,0,0,.45);transform:translateZ(26px);}
.login-tile.build.violet:after{background:linear-gradient(180deg,#caa6ff,#6a2bd0);}
.login-tile.tree:after{content:"";position:absolute;left:36%;right:36%;bottom:30%;height:42%;border-radius:50% 50% 40% 40%;background:#3f9148;transform:translateZ(20px);}
@keyframes loginTile{0%,100%{transform:translateZ(0)}50%{transform:translateZ(8px)}}
.login-mote{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--mint);opacity:.5;box-shadow:0 0 8px var(--mint);animation:loginDrift linear infinite;}
@keyframes loginDrift{from{transform:translateY(8vh);opacity:0}10%{opacity:.6}90%{opacity:.6}to{transform:translateY(-90vh);opacity:0}}
.login-stage{position:relative;z-index:2;height:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,420px);align-items:center;gap:40px;padding:clamp(20px,5vw,72px);pointer-events:auto;}
.login-hero{max-width:720px;animation:loginRise .7s cubic-bezier(.2,.8,.2,1) both;}
.login-eyebrow{display:inline-flex;align-items:center;gap:9px;margin:0 0 22px;font:700 11px/1 'Chakra Petch',monospace;letter-spacing:.28em;text-transform:uppercase;color:var(--mint);}
.login-eyebrow:before{content:"";width:26px;height:1px;background:linear-gradient(90deg,var(--mint),transparent);}
.login-pulse{width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint);animation:loginBeat 2s ease-in-out infinite;}
@keyframes loginBeat{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.7)}}
.login-wordmark{font-family:'Chakra Petch',sans-serif;font-weight:700;line-height:.88;font-size:clamp(48px,8vw,116px);letter-spacing:-.045em;margin:0 0 18px;text-transform:uppercase;max-width:9ch;}
.login-wordmark .b{background:linear-gradient(120deg,var(--mint) 10%,var(--violet) 90%);-webkit-background-clip:text;background-clip:text;color:transparent;}
.login-lede{margin:0 0 30px;max-width:35ch;font-size:clamp(16px,1.6vw,21px);line-height:1.5;color:#dcd2bb;}.login-lede b{color:var(--paper);font-weight:700;}
.login-loop{display:flex;flex-wrap:wrap;gap:10px 22px;margin:0 0 34px;padding:0;list-style:none;}
.login-loop li{display:flex;align-items:baseline;gap:9px;font-size:14px;color:#c7d2da;}.login-loop b{font:700 12px/1 'Chakra Petch',monospace;color:#ffd76e;letter-spacing:.06em;}.login-loop li+li:before{content:"";align-self:center;width:6px;height:6px;margin-right:13px;transform:rotate(45deg);background:rgba(243,234,215,.22);}
.login-cta-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;}.login-play{appearance:none;border:0;cursor:pointer;font:800 16px/1 Outfit;color:#04221a;padding:16px 26px;border-radius:14px;display:inline-flex;align-items:center;gap:11px;background:linear-gradient(135deg,var(--mint),#2bd6a8);box-shadow:0 10px 30px rgba(20,241,149,.30),inset 0 1px 0 rgba(255,255,255,.4);transition:transform .12s ease,filter .15s ease;}.login-play:hover{transform:translateY(-2px);filter:brightness(1.06);}.login-play:disabled{opacity:.66;cursor:wait;transform:none;}.login-ghostbtn{appearance:none;cursor:pointer;font:700 14px/1 Outfit;color:var(--paper);padding:15px 18px;border-radius:14px;background:rgba(243,234,215,.05);border:1px solid var(--line);transition:background .15s,border-color .15s;}.login-ghostbtn:hover{background:rgba(243,234,215,.10);border-color:var(--line2);}.login-trust{margin:18px 0 0;font-size:13px;color:#9fb2bd;display:flex;align-items:center;gap:8px;}.login-msg{margin:12px 0 0;max-width:560px;padding:11px 13px;border-radius:14px;background:rgba(255,112,92,.12);border:1px solid rgba(255,112,92,.34);color:#ffd8d0;font-weight:800;font-size:13px;line-height:1.35;box-shadow:0 12px 34px rgba(0,0,0,.22);}.login-msg small{display:block;margin-top:3px;color:#f4c5ba;font-weight:600;}
.login-req{margin:14px 0 0;padding:12px 14px;border-radius:16px;background:rgba(255,255,255,.055);border:1px solid var(--line);display:grid;gap:6px;color:#d8cfb7;font-size:13px;line-height:1.35}.login-req b{color:var(--paper)}.login-req.ok{border-color:rgba(20,241,149,.28);background:rgba(20,241,149,.075)}.login-req.bad{border-color:rgba(255,112,92,.34);background:rgba(255,112,92,.10)}.login-req code{font:800 11px/1.25 ui-monospace,monospace;color:#baffdf;word-break:break-all}.login-req .mini{font-size:11px;color:#9fb2bd}.login-play.blocked{filter:grayscale(.25) brightness(.8);}
.login-rail{animation:loginRise .7s .12s cubic-bezier(.2,.8,.2,1) both;}.login-token{position:relative;border-radius:22px;padding:24px;background:rgba(9,15,26,.62);border:1px solid var(--line);backdrop-filter:blur(16px);box-shadow:0 30px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.06);}.login-wallet{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-radius:13px;background:rgba(20,241,149,.07);border:1px solid var(--line2);}.login-chip{display:inline-flex;align-items:center;gap:8px;font:800 13px/1 Outfit;color:#baffdf;}.login-chip.off{color:#cdd9de;}.login-tag{font:700 10px/1 'Chakra Petch',monospace;letter-spacing:.14em;text-transform:uppercase;color:#9fb2bd;}.login-home{margin:20px auto 6px;width:150px;aspect-ratio:1/1;position:relative;transform:rotateX(56deg) rotateZ(45deg);transform-style:preserve-3d;}.login-home .pad{position:absolute;inset:0;border-radius:14px;background:linear-gradient(180deg,rgba(20,241,149,.28),rgba(8,30,24,.7));box-shadow:inset 0 0 0 1px var(--line2);}.login-home .roof{position:absolute;left:30%;right:30%;bottom:34%;height:46%;border-radius:6px;background:linear-gradient(180deg,#f3ead7,#c79337);box-shadow:0 10px 24px rgba(0,0,0,.5);transform:translateZ(40px);animation:loginBob 4s ease-in-out infinite;}.login-home .flag{position:absolute;left:62%;bottom:60%;width:4px;height:34px;background:#5d4430;transform:translateZ(40px);}.login-home .flag:after{content:"";position:absolute;left:4px;top:0;width:20px;height:13px;background:var(--mint);}@keyframes loginBob{0%,100%{transform:translateZ(40px)}50%{transform:translateZ(52px)}}.login-token h3{margin:8px 0 4px;font:700 17px 'Chakra Petch';letter-spacing:-.01em;text-align:center;}.login-token p{margin:0;text-align:center;font-size:13px;color:#9fb2bd;line-height:1.5;}.login-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px;}.login-stat{text-align:center;padding:10px 4px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--line);}.login-stat b{display:block;font:800 16px Outfit;color:var(--paper);}.login-stat span{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#9fb2bd;}
.login-customizer{display:grid;gap:7px;margin:14px 0;padding:11px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid var(--line);}.login-customizer label{font:900 10px var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:var(--c-muted);} 
@keyframes loginRise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@media(max-width:1000px){.login-stage{grid-template-columns:1fr}.login-rail{display:none}.login-iso{opacity:.5}.login-wordmark{font-size:clamp(46px,14vw,92px)}}
@media(prefers-reduced-motion:reduce){.login-scene *{animation:none!important}}


/* World of SolCrafts in-game HUD refresh */
.sc-top{top:12px;left:12px;right:12px;display:block;pointer-events:none;}
.sc-top>div{pointer-events:auto;}
.scv-hud{position:fixed;top:12px;left:12px;width:300px;padding:11px 12px;border-radius:17px;background:rgba(8,13,23,.78);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(14px);box-shadow:0 12px 30px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.06);pointer-events:auto;}
.scv-top{display:flex;align-items:center;gap:10px;}
.scv-av{position:relative;width:38px;height:38px;flex:none;border-radius:11px;background:linear-gradient(135deg,#3f8ab5,#27506e);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 4px 10px rgba(0,0,0,.4);display:grid;place-items:center;overflow:visible;}
.scv-av b{font:800 15px Outfit;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.5);text-transform:uppercase;}
.scv-lv{position:absolute;right:-6px;bottom:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:7px;background:linear-gradient(135deg,var(--violet),#6a2bd0);color:#fff;font:800 10px/18px Outfit;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.4);}
.scv-id{min-width:0;flex:1;}
.scv-name{font:700 15px 'Chakra Petch';letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.scv-sub{display:flex;align-items:center;gap:6px;margin-top:2px;min-width:0;}
.scv-gold{display:inline-flex;align-items:center;gap:4px;font:800 13px Outfit;color:#ffd76e;white-space:nowrap;}
.scv-sub small{font:600 11px Outfit;color:#9fb2bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.scv-meters{margin-top:10px;display:grid;gap:6px;}
.scv-meter{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:7px;}
.scv-meter .ic{font-size:12px;text-align:center;opacity:.9;}
.scv-track{position:relative;height:7px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.4);}
.scv-track i{position:absolute;inset:0 auto 0 0;border-radius:99px;transition:width .3s ease;}
.scv-track.e i{background:linear-gradient(90deg,#2e9bb0,var(--mint));box-shadow:0 0 10px rgba(20,241,149,.5);}
.scv-track.hp i{background:linear-gradient(90deg,#ff7a5c,#ffd76e);}
.scv-val{font:800 11px/1 ui-monospace,Menlo,monospace;color:#cfe0d8;min-width:46px;text-align:right;}
.scv-res{display:flex;gap:5px;margin-top:10px;}
.scv-pill{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 4px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);font:800 12px Outfit;min-width:0;}
.scv-pill .pi{font-size:12px;}
.scv-pill b{color:var(--paper);font-variant-numeric:tabular-nums;}
.scv-hint{margin-top:9px;padding-top:8px;border-top:1px solid rgba(243,234,215,.08);font-size:11px;color:rgba(215,247,231,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.scv-hint b{color:var(--mint);}
.scv-quick{display:flex;gap:5px;margin-top:9px;}
.scv-quick .mini{flex:1;border:0;border-radius:10px;background:rgba(255,255,255,.065);color:var(--paper);font:800 11px Outfit;padding:7px 4px;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);}
.scv-quick .mini:hover{background:rgba(20,241,149,.12);}
.scv-xp{margin-top:8px;height:5px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden;}
.scv-xp i{display:block;height:100%;background:linear-gradient(90deg,var(--violet),var(--mint));}
.top-actions{display:flex!important;position:fixed;top:12px;left:324px;right:auto;max-width:calc(100vw - 336px);gap:6px;flex-wrap:wrap;justify-content:flex-start;pointer-events:auto;z-index:22}.top-actions .btn{background:rgba(8,13,23,.72);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.10)}
.action-stack{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:min(880px,calc(100vw - 24px));display:grid;gap:7px;justify-items:stretch;pointer-events:none;z-index:16;}
.action-stack>*{pointer-events:auto;}
.action-bar{display:grid;grid-template-columns:repeat(auto-fit,minmax(58px,1fr));gap:6px;width:100%;padding:7px;border-radius:18px;background:rgba(4,8,14,.84);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(14px);box-shadow:0 14px 36px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.05);}
.action-slot{position:relative;height:54px;border:0;border-radius:13px;cursor:pointer;color:var(--paper);font-family:inherit;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);display:grid;grid-template-rows:20px 13px;align-items:center;justify-items:center;padding-top:7px;transition:transform .09s,filter .14s,background .14s,box-shadow .14s;overflow:hidden;}
.action-slot:before{content:"";position:absolute;inset:0 0 60% 0;background:linear-gradient(180deg,rgba(255,255,255,.10),transparent);pointer-events:none;}
.action-slot:hover{filter:brightness(1.12);transform:translateY(-1px);}
.action-slot:active{transform:translateY(1px) scale(.98);}
.action-slot.primary{background:linear-gradient(150deg,rgba(20,241,149,.30),rgba(46,155,176,.20));box-shadow:inset 0 0 0 1px var(--line2),0 0 18px rgba(20,241,149,.18);}
.action-slot.on{background:linear-gradient(150deg,rgba(20,241,149,.30),rgba(153,69,255,.22));box-shadow:inset 0 0 0 1px var(--line2),0 0 16px rgba(20,241,149,.16);}
.action-slot.on:after{content:"";position:absolute;left:14%;right:14%;bottom:5px;height:2px;border-radius:2px;background:var(--mint);box-shadow:0 0 8px var(--mint);}
.action-slot.danger{background:linear-gradient(150deg,rgba(224,96,76,.34),rgba(130,40,35,.26));}
.action-slot:disabled{opacity:.4;cursor:not-allowed;transform:none;filter:none;}
.action-slot .num{position:absolute;top:4px;left:5px;font:800 9px ui-monospace,Menlo,monospace;color:#9bffd9;padding:1px 4px;border-radius:5px;background:rgba(0,0,0,.35);opacity:.9;z-index:2;}
.action-slot .ico{font-size:19px;line-height:1;z-index:2;}
.action-slot .lbl{font:800 9px Outfit;letter-spacing:.01em;opacity:.92;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px;z-index:2;}
.action-slot .cd{position:absolute;inset:0;background:conic-gradient(rgba(4,8,14,.66) var(--cd,0%),transparent 0);pointer-events:none;z-index:1;}
.build-ribbon{width:100%;padding:7px 8px 7px;border-radius:16px;background:rgba(4,8,14,.84);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(14px);box-shadow:0 12px 30px rgba(0,0,0,.32);overflow:hidden;position:relative;}
.build-strip{padding:2px 8px 4px;}
@media(max-width:720px){.scv-hud{top:8px;left:8px;width:min(292px,calc(100vw - 16px));}.top-actions{top:126px;left:8px;right:8px;max-width:none}.action-stack{left:6px;right:6px;bottom:6px;transform:none;width:auto}.action-bar{gap:3px;padding:4px}.action-slot{height:46px;border-radius:11px}.action-slot .ico{font-size:16px}.action-slot .lbl{font-size:8px}.sc-top{top:8px;left:8px;right:8px}}


/* Utility controls orbit the top-left HUD island instead of forming one long row. */
.top-actions{display:grid!important;grid-template-columns:repeat(3,max-content);position:fixed;top:12px;left:324px;right:auto;max-width:260px;gap:6px;justify-content:start;align-content:start;pointer-events:auto;z-index:22;}
.top-actions .btn{border-radius:12px;padding:7px 10px;background:rgba(8,13,23,.74);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.10);}
.utility-pop{position:fixed;top:118px;left:324px;width:min(360px,calc(100vw - 344px));max-height:min(72vh,680px);overflow:auto;padding:12px;border-radius:18px;background:rgba(7,13,22,.94);border:1px solid rgba(243,234,215,.16);box-shadow:0 18px 48px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(16px);pointer-events:auto;z-index:24;}
.utility-pop h3{margin:0 0 4px;font:700 17px var(--f-display);letter-spacing:-.01em;color:var(--paper);}
.utility-pop .utility-sub{margin:0 0 10px;font:600 12px/1.35 var(--f-body);color:var(--c-muted);}
.utility-pop .utility-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.utility-pop .utility-field{display:grid;gap:5px;margin:8px 0;}
.utility-pop .utility-field label{font:900 10px/1 var(--f-body);letter-spacing:.08em;text-transform:uppercase;color:#8fd9bb;}
.utility-pop .utility-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.utility-pop .utility-range{display:grid;grid-template-columns:42px 1fr;gap:6px;align-items:center;font:800 10px var(--f-body);color:var(--c-muted);}
.utility-pop .utility-range input{padding:0;}
.utility-pop input[type=color]{height:34px;padding:3px;}
.utility-pop .utility-close{position:absolute;right:8px;top:8px;border:0;border-radius:999px;background:rgba(255,255,255,.08);color:var(--paper);width:26px;height:26px;cursor:pointer;font-weight:900;}
@media(max-width:720px){.top-actions{top:124px;left:8px;right:8px;max-width:none;grid-template-columns:repeat(3,minmax(0,1fr));}.top-actions .btn{padding:7px 6px;}.utility-pop{left:8px;right:8px;top:214px;width:auto;max-height:calc(100vh - 310px);}.utility-pop .utility-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}

/* Stable island chrome: tabs live inside the Current Island card; only sound/logout float top-right. */
.ui-ico{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:8px;background-image:url('/api/atlas-runtime/ui');background-size:400% 400%;background-repeat:no-repeat;color:transparent;overflow:hidden;filter:drop-shadow(0 2px 3px rgba(0,0,0,.58));position:relative;flex:none}.ui-ico span{position:absolute;inset:0;display:grid;place-items:center;color:rgba(243,234,215,.42);font:900 10px var(--f-body);opacity:.10;mix-blend-mode:screen;}
.scv-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px;}
.scv-tab{min-height:52px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:rgba(255,255,255,.055);color:var(--paper);font:900 9px/1.1 var(--f-body);letter-spacing:.035em;text-transform:uppercase;display:grid;place-items:center;gap:3px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 18px rgba(0,0,0,.20);padding:5px 3px;}
.scv-tab:hover,.scv-tab.on{border-color:rgba(20,241,149,.42);background:linear-gradient(135deg,rgba(20,241,149,.18),rgba(153,69,255,.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 18px rgba(20,241,149,.12);}
.scv-tab .ui-ico{width:28px;height:28px;border-radius:10px;}
.chrome-actions{position:fixed;top:10px;right:10px;display:flex;gap:8px;z-index:27;pointer-events:auto;}
.chrome-btn{width:45px;height:45px;border:1px solid rgba(255,255,255,.12);border-radius:15px;background:rgba(8,13,23,.55);backdrop-filter:blur(14px);display:grid;place-items:center;cursor:pointer;box-shadow:0 10px 24px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05);position:relative;padding:0;}
.chrome-btn:hover{border-color:rgba(20,241,149,.42);background:rgba(20,241,149,.12);}
.chrome-btn.muted:after{content:"";position:absolute;width:34px;height:3px;border-radius:3px;background:#ff6b5d;transform:rotate(-38deg);box-shadow:0 0 8px rgba(255,107,93,.5);}
.chrome-btn .ui-ico{width:30px;height:30px;border-radius:10px;}
.chrome-btn.zoom-btn{font:1000 19px/1 var(--f-body);color:#eafff4;}
.chrome-btn.zoom-btn:hover{background:rgba(20,241,149,.14);border-color:rgba(20,241,149,.35);}
.scale-fab{position:fixed;right:10px;top:252px;display:flex;gap:6px;z-index:27;pointer-events:auto;}
.scale-fab .chrome-btn{width:45px;height:36px;border-radius:13px;}
.menu-scale-fab{position:fixed;top:14px;right:14px;z-index:45;display:flex;gap:6px;pointer-events:auto;}
.menu-scale-fab .chrome-btn{width:46px;height:38px;border-radius:13px;}
.chrome-btn.on{border-color:rgba(20,241,149,.45);background:rgba(20,241,149,.13);}
.side-actions{display:none!important;}
.side-btn{display:none!important;}
.utility-pop{left:12px!important;top:238px!important;width:min(385px,calc(100vw - 24px))!important;max-height:calc(100dvh - 306px)!important;overflow:auto!important;}
.quest-pop{left:12px!important;top:238px!important;width:min(430px,calc(100vw - 24px))!important;max-height:calc(100dvh - 306px)!important;}
.inspect-pop{width:min(410px,calc(100vw - 24px))!important;padding:11px!important;}
.minimap{position:fixed!important;right:10px!important;top:72px!important;bottom:auto!important;width:174px!important;height:174px!important;z-index:21!important;}
@media(max-width:720px){.scv-hud{width:min(316px,calc(100vw - 16px));}.chrome-actions{top:8px;right:8px}.chrome-btn{width:40px;height:40px;border-radius:13px}.minimap{width:118px!important;height:118px!important;top:58px!important;right:8px!important}.utility-pop,.quest-pop{left:8px!important;right:8px!important;top:calc(100dvh - min(58dvh,420px) - 62px)!important;width:auto!important;max-height:min(58dvh,420px)!important}.scv-tabs{gap:5px}.scv-tab{min-height:45px;font-size:8px}.scv-tab .ui-ico{width:24px;height:24px}}
.utility-grid.two{grid-template-columns:repeat(2,minmax(0,1fr));}
.more-pop{width:min(430px,calc(100vw - 392px));}
.more-group{display:grid;gap:7px;margin:9px 0 12px;}
.more-group-head{display:grid;gap:2px;}
.more-group-head b{font:900 11px/1 var(--f-display);letter-spacing:.08em;text-transform:uppercase;color:#bfffe0;}
.more-group-head span{font:650 10.5px/1.25 var(--f-body);color:var(--c-muted);}
.more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.more-tile{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;align-items:center;min-height:54px;text-align:left;border:1px solid rgba(255,255,255,.10);border-radius:14px;background:rgba(255,255,255,.055);color:var(--paper);cursor:pointer;padding:8px;font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
.more-tile:hover{filter:brightness(1.12);border-color:rgba(20,241,149,.24);}
.more-tile.on{background:linear-gradient(135deg,rgba(20,241,149,.16),rgba(153,69,255,.10));border-color:rgba(20,241,149,.34);}
.more-glyph{display:grid;place-items:center;width:30px;height:30px;border-radius:11px;background:rgba(255,255,255,.08);font-size:15px;}
.more-copy{display:grid;gap:2px;min-width:0;}
.more-copy b{font:900 11px/1.1 var(--f-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.more-copy small{font:650 9.5px/1.2 var(--f-body);color:#9fb2bd;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
@media(max-width:720px){.more-pop{width:auto!important}.more-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.more-tile{min-height:48px;padding:7px;}}
.inspect-pop{width:min(410px,calc(100vw - 24px))!important;padding:11px!important;}
.inspect-head{display:flex;align-items:center;gap:9px;margin:0 30px 8px 0;}
.inspect-head .accent-orb{width:18px;height:18px;border-radius:999px;display:inline-block;flex:none;}
.inspect-name{flex:1;min-width:0;font:800 16px/1.1 var(--f-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.color-palette{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;}
.color-choice{position:relative;height:34px;border-radius:12px;border:2px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 7px 16px rgba(0,0,0,.26);cursor:pointer;overflow:hidden;padding:0;}
.color-choice:hover{transform:translateY(-1px);filter:saturate(1.08) brightness(1.05);}
.color-choice.on{border-color:#fff;outline:3px solid rgba(20,241,149,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 0 0 2px rgba(0,0,0,.45),0 0 20px var(--choice-glow,rgba(20,241,149,.30));}
.color-choice.on:after{content:"✓";position:absolute;right:5px;top:4px;width:16px;height:16px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;display:grid;place-items:center;font:900 11px/1 var(--f-body);}
.color-choice.default:before{content:"D";position:absolute;left:6px;bottom:5px;color:rgba(255,255,255,.86);font:900 10px/1 var(--f-body);text-shadow:0 1px 2px rgba(0,0,0,.6);}
.combo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;}
.combo-card{position:relative;min-height:58px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:linear-gradient(135deg,var(--p1,#31507d),var(--p2,#14f195));box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 8px 18px rgba(0,0,0,.28);cursor:pointer;overflow:hidden;padding:8px;text-align:left;color:#fff;display:grid;align-content:end;gap:5px;isolation:isolate;}
.combo-card:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.58));z-index:-1;}
.combo-card:hover{transform:translateY(-1px);filter:saturate(1.06) brightness(1.06);}
.combo-card.on{border-color:#fff;outline:3px solid rgba(20,241,149,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 0 0 2px rgba(0,0,0,.42),0 0 22px var(--choice-glow,rgba(20,241,149,.30));}
.combo-card b{font:900 12px/1.05 var(--f-body);text-shadow:0 1px 3px rgba(0,0,0,.65);}
.combo-dots{display:flex;gap:4px;flex-wrap:wrap;}.combo-dot{width:13px;height:13px;border-radius:999px;border:1px solid rgba(255,255,255,.62);box-shadow:0 1px 4px rgba(0,0,0,.42);}.combo-card .combo-check{position:absolute;right:6px;top:6px;width:18px;height:18px;border-radius:999px;background:rgba(0,0,0,.62);display:grid;place-items:center;font:900 11px/1 var(--f-body);}
.character-combos .combo-card{min-height:76px;align-content:start;}.building-combos .combo-card{min-height:54px;}
.combo-look{display:block;margin-top:2px;color:#b8f5da;font:850 9px/1.1 var(--f-body);letter-spacing:.08em;text-transform:uppercase;opacity:.9;}
.char-part-list{display:grid;gap:7px;}
.char-part-row{display:grid;grid-template-columns:28px minmax(0,1fr) 28px 24px;gap:6px;align-items:center;padding:7px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);}
.char-part-row .mini{width:28px;height:28px;min-height:28px;border-radius:10px;padding:0;font:900 16px/1 var(--f-body);}
.char-part-mid{min-width:0;display:grid;gap:4px;}
.char-part-mid div{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;}
.char-part-mid b{font:900 11px/1 var(--f-body);color:#f3ead7;}
.char-part-mid span{font:800 9px/1 var(--f-body);color:#9fb2bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.char-part-mid input{width:100%;padding:0;min-height:20px;}
.char-part-row strong{font:900 11px/1 ui-monospace,Menlo,monospace;color:#ffd76e;text-align:right;}
.dev-note,.debug-note,.compat-note,.legacy-note,.internal-note{display:none!important;}

.fine-colors{margin-top:8px;}.fine-colors .utility-field{margin:0;}
.inspect-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:9px;}
.inspect-actions .btn{width:100%;}
.wonder-view-modal{width:min(1040px,96vw);max-height:92vh;overflow:auto;}
.wonder-view-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}
.wonder-view-stage{position:relative;height:min(62vh,620px);min-height:360px;border-radius:18px;overflow:hidden;background:radial-gradient(circle at 50% 28%,rgba(125,207,232,.16),rgba(5,10,16,.96) 58%,rgba(1,4,8,1));border:1px solid rgba(255,255,255,.13);box-shadow:inset 0 0 0 1px rgba(255,255,255,.035),0 18px 48px rgba(0,0,0,.35);}
.wonder-view-stage canvas{display:block;width:100%;height:100%;}
.wonder-view-overlay{position:absolute;left:12px;right:12px;bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;pointer-events:none;}
.wonder-view-chip{padding:6px 9px;border-radius:999px;background:rgba(4,8,14,.72);border:1px solid rgba(255,255,255,.13);color:#f3ead7;font:900 11px/1 var(--f-body);box-shadow:0 4px 12px rgba(0,0,0,.22);}
.wonder-view-note{margin-top:9px;color:#b8c2cc;font-size:12px;line-height:1.35;}
.wonder-view-error{height:100%;display:grid;place-items:center;padding:24px;text-align:center;color:#ffd6ce;font:900 13px/1.45 Outfit;background:rgba(80,18,12,.18);}

.mini-list{display:grid;gap:7px}.mini-row{display:flex;gap:8px;align-items:center;padding:8px;border-radius:11px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);font-size:12px}.mini-row span{display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:rgba(255,255,255,.09);color:var(--c-gold);font-weight:900;flex:none}.mini-row.done{opacity:.78}.mini-row.done span{background:rgba(20,241,149,.16);color:var(--c-mint)}
.mini-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}.mini-slot{min-height:58px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.055);color:var(--paper);font:900 18px var(--f-body);display:grid;place-items:center;gap:2px;padding:5px;cursor:pointer}.mini-slot small{font-size:8px;font-weight:800;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--c-muted)}.mini-slot.empty{opacity:.35;cursor:default}
.skill-mini{padding:8px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07)}.mini-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.10);overflow:hidden;margin:5px 0}.mini-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--c-violet),var(--c-mint));}
@media(max-width:720px){.side-actions{top:124px!important;left:8px!important;width:calc(100vw - 16px)!important;height:42px!important;max-width:none!important;display:grid!important;grid-template-columns:repeat(6,42px)!important;gap:6px!important}.side-btn{position:static!important}.utility-pop{left:8px!important;right:8px!important;top:174px!important;width:auto!important;max-height:calc(100dvh - 255px)!important}.inspect-pop{width:auto!important}.mini-slots{grid-template-columns:repeat(4,minmax(0,1fr));}.inspect-actions{grid-template-columns:1fr;}}
@media(max-width:520px),(max-height:640px){.scv-hud{width:min(276px,calc(100vw - 12px));}.side-actions{top:112px!important;left:6px!important;width:calc(100vw - 12px)!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:4px!important}.side-btn{width:auto!important;height:38px!important;border-radius:11px!important}.utility-pop{top:158px!important;left:6px!important;right:6px!important;max-height:calc(100dvh - 224px)!important}.action-stack{left:5px!important;right:5px!important;bottom:max(5px,env(safe-area-inset-bottom))!important}.action-slot{height:42px!important}.minimap{width:104px!important;height:104px!important;right:8px!important;bottom:72px!important}}

/* Scale-safe overlays: panels should support play, not hide the avatar/world. */
@media(max-width:860px),(max-height:680px){
  .utility-pop.character-pop{left:auto!important;right:6px!important;top:auto!important;bottom:calc(58px + env(safe-area-inset-bottom))!important;width:min(286px,calc(100vw - 12px))!important;max-height:min(42dvh,318px)!important;padding:9px!important;}
  .utility-pop.character-pop .utility-sub{display:none;}
  .utility-pop.character-pop .utility-grid.two{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;}
  .utility-pop.character-pop .utility-field{margin:5px 0;}
  .utility-pop.character-pop .utility-range{grid-template-columns:54px minmax(0,1fr);gap:5px;font-size:9px;}
  .utility-pop.character-pop input[type=color]{height:28px;}
}
@media(max-width:420px),(max-height:560px){
  .scv-hud{transform:scale(.88);transform-origin:top left;}
  .side-actions{top:96px!important;}
  .utility-pop:not(.character-pop){max-height:35dvh!important;}
  .utility-pop.character-pop{width:min(248px,calc(100vw - 12px))!important;max-height:36dvh!important;}
  .utility-pop.character-pop h3{font-size:14px;}
}


/* Guide quests + first-login walkthrough */
.guide-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px;flex:none}.guide-tabs .btn{padding:6px 9px;font-size:10px;min-height:28px}.guide-summary{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0 8px;flex:none}.guide-summary .meter{flex:1;min-width:96px;height:7px;border-radius:99px;background:rgba(255,255,255,.10);overflow:hidden}.guide-summary .meter i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--c-violet),var(--c-mint));}.guide-list{display:grid;gap:7px}.quest-pop .guide-list{min-height:0;overflow:auto;padding-right:4px;scrollbar-width:thin}.guide-card{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;padding:8px;border-radius:13px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}.guide-card.done{border-color:rgba(20,241,149,.22);background:rgba(20,241,149,.055)}.guide-card.claimed{opacity:.78}.guide-glyph{display:grid;place-items:center;width:30px;height:30px;border-radius:11px;background:rgba(255,255,255,.08);font-size:15px}.guide-card h4{margin:0;color:var(--paper);font:900 12px/1.1 var(--f-display)}.guide-card p{margin:3px 0 0}.guide-detail{color:var(--c-muted);font:600 10px/1.28 var(--f-body)}.guide-meta{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:6px}.guide-chip{display:inline-flex;align-items:center;border-radius:999px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.055);padding:3px 6px;font:900 8.5px/1 var(--f-body);letter-spacing:.04em;text-transform:uppercase;color:#cfe8db}.guide-chip.ok{border-color:rgba(20,241,149,.26);color:#bdf8d9}.guide-chip.wait{color:#ffe6aa}.guide-card .btn{padding:5px 8px;font-size:9.5px;min-height:25px}.quest-pop{top:72px!important;width:min(430px,calc(100vw - 392px))!important;max-height:min(72dvh,720px)!important;overflow:hidden!important;display:grid!important;grid-template-rows:auto auto auto auto minmax(0,1fr);align-content:start}.quest-pop h3,.quest-pop .utility-sub{flex:none}.quest-pop .utility-sub{font-size:11px!important;line-height:1.28!important;margin-bottom:5px!important}.walkthrough-layer{position:fixed;inset:0;z-index:31;pointer-events:none}.walkthrough-callout{position:fixed;width:min(270px,calc(100vw - 16px));max-width:calc(100vw - 16px);padding:9px 10px;border-radius:16px;background:rgba(7,13,22,.94);border:1px solid rgba(20,241,149,.36);box-shadow:0 14px 36px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(14px);pointer-events:auto}.walkthrough-callout h3{margin:0 0 4px;color:var(--paper);font:900 14px/1.05 var(--f-display)}.walkthrough-callout p{margin:0 0 6px;color:#d6cfbb;font:650 10.5px/1.24 var(--f-body)}.walkthrough-callout .tiny{color:var(--c-muted);font:700 9.5px/1.2 var(--f-body)}.walkthrough-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:8px}.walkthrough-actions .btn{min-height:29px;padding:6px 10px;font-size:10.5px}.walkthrough-nub{position:fixed;width:54px;height:54px;border-radius:17px;border:2px solid rgba(20,241,149,.72);box-shadow:0 0 0 7px rgba(20,241,149,.12),0 0 26px rgba(20,241,149,.30);pointer-events:none;animation:guidePulse 1.2s ease-in-out infinite}.side-btn.guide-target{outline:3px solid rgba(20,241,149,.52);box-shadow:0 0 0 6px rgba(20,241,149,.10),0 14px 30px rgba(0,0,0,.36);animation:guidePulse 1.2s ease-in-out infinite}.walkthrough-inline{display:grid;gap:6px;margin:0 0 10px;padding:8px 9px;border-radius:14px;background:linear-gradient(135deg,rgba(20,241,149,.13),rgba(153,69,255,.09));border:1px solid rgba(20,241,149,.30);box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}.walkthrough-inline b{font:900 12px/1.1 var(--f-display);color:var(--paper)}.walkthrough-inline span{font:650 10px/1.28 var(--f-body);color:#cfe4d6}.walkthrough-inline .walkthrough-actions{margin-top:1px}.walkthrough-inline .btn{min-height:28px;padding:5px 9px;font-size:10px}@keyframes guidePulse{50%{transform:scale(1.055)}}
@media(max-width:720px),(max-height:560px){.quest-pop{left:8px!important;right:8px!important;top:132px!important;width:auto!important;max-height:calc(100dvh - 190px)!important}.walkthrough-callout{width:min(252px,calc(100vw - 16px));padding:8px 9px}.walkthrough-callout h3{font-size:13px}.walkthrough-callout p{font-size:10px}.walkthrough-callout .tiny{display:none}.guide-card{grid-template-columns:28px minmax(0,1fr);gap:7px;padding:8px}.guide-glyph{width:28px;height:28px;border-radius:10px;font-size:15px}.guide-detail{display:none}.walkthrough-inline{padding:7px 8px}.walkthrough-inline span{display:none}}
@media(max-width:420px),(max-height:460px){.walkthrough-callout{width:min(226px,calc(100vw - 12px));padding:7px 8px}.walkthrough-callout p{display:none}.walkthrough-actions .btn{min-height:28px;padding:5px 8px;font-size:10px}.walkthrough-nub{width:46px;height:46px;border-radius:14px}}



/* Patch: compact guide drawer + preset-only character panel cleanup. */
.quest-pop{
  left:12px!important;
  right:auto!important;
  top:104px!important;
  width:min(370px,calc((100vw - 300px) / max(var(--ui-scale),.75)))!important;
  max-width:calc(100vw - 24px)!important;
  max-height:min(70dvh,calc((100dvh - 128px) / max(var(--ui-scale),.75)))!important;
  overflow:hidden!important;
  display:flex!important;
  flex-direction:column!important;
}
.quest-pop .utility-sub{font-size:10.5px!important;line-height:1.22!important;margin-bottom:4px!important;}
.quest-pop .guide-summary{gap:4px!important;margin:4px 0 6px!important;}
.quest-pop .guide-summary .meter{flex-basis:100%;min-width:100%;}
.quest-pop .guide-tabs{gap:4px!important;margin:4px 0 6px!important;}
.quest-pop .guide-tabs .btn{padding:5px 7px!important;min-height:26px!important;font-size:9.5px!important;}
.quest-pop .guide-list{min-height:0!important;overflow:auto!important;padding-right:5px!important;}
.quest-pop .guide-card{grid-template-columns:28px minmax(0,1fr)!important;gap:7px!important;padding:7px!important;}
.quest-pop .guide-detail{display:none!important;}
.quest-pop .guide-card h4{font-size:11.5px!important;}
.quest-pop .guide-chip{font-size:8px!important;padding:3px 5px!important;}
.character-pop .character-combos{max-height:min(54dvh,420px);overflow:auto;padding-right:3px;}
@media(max-width:720px),(max-height:560px){
  .quest-pop{left:8px!important;right:8px!important;top:132px!important;width:auto!important;max-height:calc(100dvh - 184px)!important;}
}

/* Final HUD regression guard: no duplicate side icon column; minimap remains top-right; old inventory UI stays hidden. */
.sc-inventory,.inventory-pop,[data-panel="inv"],[data-panel="inventory"]{display:none!important;}
.side-actions{display:none!important;}
.side-btn{display:none!important;}
.minimap{position:fixed!important;right:10px!important;top:72px!important;bottom:auto!important;width:174px!important;height:174px!important;}
@media(max-width:720px){.minimap{width:118px!important;height:118px!important;top:58px!important;right:8px!important;bottom:auto!important}.utility-pop,.quest-pop{left:8px!important;right:8px!important;width:auto!important;}}


/* Urgent UI clarity patch: walkthrough + tooltips must always float above game chrome. */
.sc-hud{z-index:10;}
.tip{position:fixed!important;z-index:2147483600!important;max-width:min(320px,calc(100vw - 18px));font-size:12px;line-height:1.35;background:rgba(4,8,14,.97);border-color:rgba(20,241,149,.42);box-shadow:0 18px 44px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.06);}
.tip small{margin-top:4px;color:#d6e4dc;}
.walkthrough-layer{position:fixed!important;inset:0!important;z-index:2147483200!important;pointer-events:none!important;isolation:isolate;}
.walkthrough-scrim{position:fixed;inset:0;background:radial-gradient(55vw 45vh at 50% 48%,transparent 45%,rgba(3,6,11,.18) 100%);pointer-events:none;}
.walkthrough-callout{z-index:2147483300!important;max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important;overflow:auto!important;border-color:rgba(20,241,149,.58)!important;background:linear-gradient(180deg,rgba(8,15,25,.985),rgba(5,9,16,.965))!important;box-shadow:0 24px 70px rgba(0,0,0,.68),0 0 0 1px rgba(255,255,255,.08),0 0 36px rgba(20,241,149,.16)!important;}
.walkthrough-progress{float:right;margin:0 0 4px 8px;padding:3px 7px;border-radius:999px;background:rgba(20,241,149,.14);border:1px solid rgba(20,241,149,.30);color:#bfffe0;font:900 9px/1 var(--f-body);}
.walkthrough-nub{z-index:2147483250!important;background:rgba(20,241,149,.035);}
.scv-limit-row{display:grid;gap:5px;margin-top:7px;}
.scv-limit-pill{display:flex;align-items:center;gap:6px;padding:5px 7px;border-radius:10px;background:rgba(255,215,110,.095);border:1px solid rgba(255,215,110,.22);color:#fff0bd;font:900 10px/1.15 var(--f-body);}
.scv-limit-pill span{flex:none}.scv-limit-pill b{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.scv-limit-pill.bad{background:rgba(224,96,76,.14);border-color:rgba(224,96,76,.34);color:#ffd2c8;}
.scv-cap{padding:6px 7px;border-radius:10px;background:rgba(20,241,149,.06);border:1px solid rgba(20,241,149,.12);}
@media(max-width:720px),(max-height:620px){
  .walkthrough-callout{font-size:11px!important;}
  .walkthrough-callout p{font-size:10.5px!important;line-height:1.28!important;}
  .scv-hud{max-width:calc(100vw - 16px);}
  .scv-limit-row{grid-template-columns:1fr;}
  .scv-limit-pill{padding:4px 6px;font-size:9.5px;}
}
@media(max-width:420px),(max-height:500px){
  .walkthrough-callout{padding:8px!important;border-radius:14px!important;}
  .walkthrough-callout h3{font-size:13px!important;}
  .walkthrough-callout p{display:block!important;}
  .walkthrough-actions{gap:5px!important;}
  .walkthrough-actions .btn{min-height:27px!important;padding:5px 8px!important;font-size:9.5px!important;}
  .scv-res{gap:3px;}.scv-pill{font-size:11px;padding:4px 2px;}
}


/* Manual UI/Menu scale controls. Values are set on .sc-root from localStorage. */
.sc-root{--ui-scale:1;--menu-scale:1;}
.ui-scale-card{display:grid;gap:8px;padding:10px;border-radius:15px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);margin:8px 0;}
.ui-scale-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.ui-scale-head b{font:900 12px/1 var(--f-body);color:#dffbed;}
.ui-scale-value{font:900 12px/1 ui-monospace,Menlo,monospace;color:#ffd76e;}
.ui-scale-controls{display:grid;grid-template-columns:42px 1fr 42px 58px;gap:6px;align-items:center;}
.ui-scale-controls .btn{min-height:34px;padding:6px 8px;}
.ui-scale-controls input[type=range]{width:100%;min-width:0;padding:0;}
.ui-scale-note{font:700 11px/1.35 var(--f-body);color:#9fb2bd;}
.chrome-btn.scale-txt{font:900 12px/1 var(--f-body);color:#dffbed;letter-spacing:.02em;}
.chrome-btn.scale-txt small{display:block;font:900 9px/1 ui-monospace,Menlo,monospace;color:#ffd76e;margin-top:2px;}
/* Robust manual scaling: use the modern CSS scale property so controls work even
   when browser zoom / non-standard CSS zoom behave differently between clients. */
.scv-hud,.utility-pop,.ctx,.modal,.tip,.walkthrough-callout{scale:var(--ui-scale);transform-origin:top left;}
.chrome-actions,.scale-fab,.menu-scale-fab,.minimap{scale:var(--ui-scale);transform-origin:top right;}
.action-stack,.bottom-bar,.channel{scale:var(--ui-scale);transform-origin:bottom center;}
.chat{scale:var(--ui-scale);transform-origin:bottom left;}
.login-stage,.menu-card{scale:var(--menu-scale);transform-origin:center;}
.settings-scale-preview{display:flex;align-items:center;gap:7px;min-height:36px;padding:7px 9px;border-radius:13px;background:rgba(20,241,149,.08);border:1px solid rgba(20,241,149,.18);overflow:hidden;}
.settings-scale-preview span{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:11px;background:rgba(255,255,255,.08);font:900 12px/1 var(--f-body);scale:var(--ui-scale);transform-origin:left center;}
.settings-scale-preview b{font:900 12px/1.1 var(--f-body);color:#dffbed;}
.settings-scale-preview small{color:#9fb2bd;font:800 10px/1.2 var(--f-body);}
@supports not (scale:1){
  .scv-hud{transform:scale(var(--ui-scale));transform-origin:top left;}
  .chrome-actions,.scale-fab,.menu-scale-fab{transform:scale(var(--ui-scale));transform-origin:top right;}
  .minimap{transform:scale(var(--ui-scale));transform-origin:top right;}
  .utility-pop,.ctx,.tip,.walkthrough-callout{transform:scale(var(--ui-scale));transform-origin:top left;}
  .chat{transform:scale(var(--ui-scale));transform-origin:bottom left;}
  .channel{transform:translateX(-50%) scale(var(--ui-scale));transform-origin:bottom center;}
  .action-stack{transform:translateX(-50%) scale(var(--ui-scale));transform-origin:bottom center;}
  .login-stage,.menu-card{transform:scale(var(--menu-scale));transform-origin:center;}
}
@media(max-width:720px){
  .scale-fab{top:182px;right:8px;gap:5px;}.scale-fab .chrome-btn{width:40px;height:32px;border-radius:12px;}
  .menu-scale-fab{top:8px;right:8px;gap:5px;}.menu-scale-fab .chrome-btn{width:40px;height:32px;border-radius:12px;}
  .ui-scale-controls{grid-template-columns:40px 1fr 40px;}.ui-scale-controls .ui-scale-reset{grid-column:1/-1;}
}

/* Redesigned settings modal: independent from cramped utility panels and safe even if UI scale is misconfigured. */
.settings-layer{position:fixed;inset:0;z-index:72;pointer-events:auto;display:grid;place-items:center;padding:16px;isolation:isolate;}
.settings-scrim{position:absolute;inset:0;border:0;background:radial-gradient(900px 620px at 18% 12%,rgba(20,241,149,.14),transparent 56%),rgba(2,5,10,.62);backdrop-filter:blur(8px);cursor:pointer;}
.settings-panel{position:relative;width:min(760px,calc(100vw - 24px));max-height:min(86dvh,760px);overflow:auto;padding:16px;border-radius:24px;border:1px solid rgba(243,234,215,.18);background:linear-gradient(180deg,rgba(12,22,34,.98),rgba(5,10,18,.98));box-shadow:0 28px 80px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.06);color:var(--paper);scrollbar-width:thin;}
.settings-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px;padding-right:40px;}
.settings-kicker{margin:0 0 4px;color:var(--mint);font:900 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.15em;text-transform:uppercase;}
.settings-top h3{margin:0;color:var(--paper);font:900 clamp(24px,4vw,36px)/.98 var(--f-display);letter-spacing:-.025em;}
.settings-top p{margin:6px 0 0;color:#cfc5ae;font:650 12px/1.35 var(--f-body);max-width:58ch;}
.settings-close{position:absolute;right:12px;top:12px;width:34px;height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:var(--paper);font:900 18px/1 var(--f-body);cursor:pointer;}
.settings-close:hover{background:rgba(20,241,149,.14);border-color:rgba(20,241,149,.36);}
.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;}
.settings-card{display:grid;gap:10px;min-width:0;padding:12px;border-radius:18px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10);box-shadow:inset 0 1px 0 rgba(255,255,255,.045);}
.settings-card.wide{grid-column:1/-1;}
.settings-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.settings-card-head b{font:900 14px/1.1 var(--f-body);color:#eafff4;}
.settings-card-head span{font:900 12px/1 ui-monospace,Menlo,monospace;color:#ffd76e;white-space:nowrap;}
.settings-note{margin:0;color:#9fb2bd;font:700 11px/1.35 var(--f-body);}
.settings-scale-row{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;gap:8px;align-items:center;}
.settings-scale-row .btn{min-height:38px;border-radius:12px;font-size:16px;}
.settings-scale-row input[type=range]{width:100%;min-width:0;padding:0;accent-color:#14f195;}
.settings-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;}
.settings-presets .btn{min-height:32px;padding:6px 8px;font-size:11px;border-radius:11px;}
.settings-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}
.settings-actions .btn{min-height:40px;justify-content:center;}.settings-select{width:100%;min-height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:var(--paper);font:800 13px/1 var(--f-body);padding:8px 10px;outline:none;}.settings-select:focus{border-color:rgba(20,241,149,.55);box-shadow:0 0 0 2px rgba(20,241,149,.14);}
.settings-danger{margin-top:10px;display:grid;grid-template-columns:1fr;gap:8px;}
.settings-divider{height:1px;background:rgba(255,255,255,.10);margin:2px 0;}
@media(max-width:720px){
  .settings-layer{align-items:end;padding:8px;}
  .settings-panel{width:100%;max-height:min(88dvh,720px);border-radius:22px 22px 16px 16px;padding:14px;}
  .settings-grid{grid-template-columns:1fr;}
  .settings-presets{grid-template-columns:repeat(2,minmax(0,1fr));}
  .settings-actions{grid-template-columns:1fr;}
  .settings-top{padding-right:36px;}
}
@media(max-width:420px),(max-height:520px){.settings-layer{padding:6px}.settings-panel{max-height:92dvh;padding:12px}.settings-top h3{font-size:24px}.settings-card{padding:10px}.settings-scale-row{grid-template-columns:38px minmax(0,1fr) 38px;gap:6px}.settings-presets .btn{font-size:10px;padding:6px 4px}}

/* Urgent cleanup: scale is controlled only inside Settings now. Hide old floating A-/A+ buttons. */
.scale-fab,.menu-scale-fab{display:none!important;}
/* Keep Guide/Quest panels compact and scrollable so rewards never cover the whole game. */
.quest-pop{width:min(360px,calc(100vw - 24px))!important;max-height:min(62dvh,620px)!important;overflow:hidden!important;}
.quest-pop .guide-list{overflow:auto!important;min-height:0!important;max-height:100%!important;padding-bottom:6px!important;}
.utility-pop{overscroll-behavior:contain;}
@media(max-width:820px),(max-height:640px){
  .quest-pop{left:8px!important;right:8px!important;top:auto!important;bottom:calc(64px + env(safe-area-inset-bottom))!important;width:auto!important;max-height:52dvh!important;border-radius:18px!important;}
  .utility-pop.character-pop{left:8px!important;right:8px!important;top:auto!important;bottom:calc(64px + env(safe-area-inset-bottom))!important;width:auto!important;max-height:46dvh!important;}
  .guide-summary .meter{flex-basis:100%;}
}



/* ============================================================
   Layout polish v1 — stable readable game chrome.
   The goal is to make the HUD feel intentional while preserving
   the region-render model: CSS-only, no gameplay/state changes.
   ============================================================ */
.sc-root{
  --safe-x:max(10px,env(safe-area-inset-left));
  --safe-y:max(10px,env(safe-area-inset-top));
  --safe-b:max(10px,env(safe-area-inset-bottom));
  --hud-w:clamp(286px,26vw,342px);
}
.sc-root:before{
  content:"";
  position:absolute;
  inset:0;
  z-index:2;
  pointer-events:none;
  background:
    radial-gradient(70vw 54vh at 52% 44%,transparent 55%,rgba(2,5,10,.22) 100%),
    linear-gradient(180deg,rgba(2,5,10,.14),transparent 22%,transparent 72%,rgba(2,5,10,.20));
  opacity:.82;
}
.sc-world canvas{filter:saturate(.98) contrast(1.03);}
.sc-hud{z-index:11;}
.scv-hud{
  top:var(--safe-y)!important;
  left:var(--safe-x)!important;
  width:var(--hud-w)!important;
  padding:12px!important;
  border-radius:22px!important;
  background:
    linear-gradient(180deg,rgba(9,15,25,.88),rgba(5,9,16,.76)),
    radial-gradient(circle at 0% 0%,rgba(20,241,149,.12),transparent 18rem)!important;
  border:1px solid rgba(243,234,215,.14)!important;
  box-shadow:
    0 22px 64px rgba(0,0,0,.48),
    inset 0 1px 0 rgba(255,255,255,.08),
    0 0 0 1px rgba(0,0,0,.18)!important;
  backdrop-filter:blur(18px) saturate(1.18)!important;
}
.scv-top{gap:11px!important;}
.scv-av{width:44px!important;height:44px!important;border-radius:15px!important;}
.scv-av b{font-size:17px!important;}
.scv-lv{right:-7px!important;bottom:-7px!important;min-width:21px!important;height:21px!important;border-radius:9px!important;font-size:11px!important;line-height:21px!important;}
.scv-name{font-size:17px!important;line-height:1.05!important;letter-spacing:-.02em!important;}
.scv-gold{font-size:14px!important;}
.scv-sub{gap:7px!important;}
.scv-sub small{font-size:11px!important;color:#b9c9d2!important;}
.scv-meters{margin-top:11px!important;gap:7px!important;}
.scv-meter{grid-template-columns:17px 1fr auto!important;gap:7px!important;}
.scv-track{height:8px!important;background:rgba(255,255,255,.12)!important;}
.scv-track i{transition:width .22s ease-out!important;}
.scv-val{font-size:11px!important;color:#dff4ea!important;}
.scv-res{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:7px!important;
  margin-top:11px!important;
}
.scv-pill{
  min-height:34px!important;
  border-radius:13px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.085),rgba(255,255,255,.045))!important;
  border:1px solid rgba(243,234,215,.13)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055)!important;
}
.scv-pill b{font-size:13px!important;}
.scv-limit-row{margin-top:9px!important;}
.scv-limit-pill,.scv-cap{
  border-radius:14px!important;
  line-height:1.25!important;
  background:linear-gradient(135deg,rgba(20,241,149,.10),rgba(255,215,110,.08))!important;
  border-color:rgba(20,241,149,.22)!important;
}
.scv-hint{font-size:11px!important;line-height:1.28!important;color:#cdeada!important;}
.scv-tabs{gap:8px!important;margin-top:12px!important;}
.scv-tab{
  min-height:56px!important;
  border-radius:16px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.078),rgba(255,255,255,.04))!important;
  border-color:rgba(243,234,215,.13)!important;
}
.scv-tab:hover,.scv-tab.on{
  transform:translateY(-1px);
  border-color:rgba(20,241,149,.48)!important;
  box-shadow:0 12px 28px rgba(0,0,0,.28),0 0 24px rgba(20,241,149,.12),inset 0 1px 0 rgba(255,255,255,.08)!important;
}
.chrome-actions{
  top:var(--safe-y)!important;
  right:var(--safe-x)!important;
  gap:9px!important;
}
.chrome-btn{
  width:46px!important;height:46px!important;border-radius:17px!important;
  background:linear-gradient(180deg,rgba(9,15,25,.82),rgba(5,9,16,.60))!important;
  border-color:rgba(243,234,215,.15)!important;
  box-shadow:0 14px 36px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08)!important;
}
.chrome-btn:hover{transform:translateY(-1px);border-color:rgba(20,241,149,.45)!important;}
.minimap{
  top:calc(var(--safe-y) + 58px)!important;
  right:var(--safe-x)!important;
  width:178px!important;height:178px!important;
  border-radius:22px!important;
  background:rgba(9,11,18,.76)!important;
  border:1px solid rgba(243,234,215,.14)!important;
  box-shadow:0 18px 52px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.07)!important;
  backdrop-filter:blur(14px) saturate(1.12)!important;
  opacity:.92!important;
}
.minimap:hover{opacity:1!important;transform:none!important;}

.worldmap-canvas{width:100%;height:min(68vh,720px);min-height:420px;border-radius:18px;border:1px solid rgba(20,241,149,.26);background:#111821;display:block;cursor:crosshair;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
.worldmap-legend{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:10px 0;color:#b8c2cc;font:800 11px Outfit}.worldmap-dot{display:inline-block;width:10px;height:10px;border-radius:99px;margin-right:5px}.worldmap-help{margin-top:8px;color:#9fb2bd;font:700 12px/1.45 Outfit}.worldmap-help b{color:#f3ead7}.minimap{cursor:pointer}.minimap:after{content:""}
.action-stack{
  left:50%!important;
  right:auto!important;
  bottom:var(--safe-b)!important;
  width:min(980px,calc(100vw - 28px))!important;
  gap:8px!important;
  z-index:20!important;
}
.action-bar,.build-ribbon{
  border-radius:22px!important;
  background:
    linear-gradient(180deg,rgba(10,16,27,.90),rgba(5,9,16,.78)),
    radial-gradient(circle at 50% 0%,rgba(20,241,149,.08),transparent 22rem)!important;
  border:1px solid rgba(243,234,215,.14)!important;
  box-shadow:0 22px 64px rgba(0,0,0,.50),inset 0 1px 0 rgba(255,255,255,.08)!important;
  backdrop-filter:blur(18px) saturate(1.15)!important;
}
.action-bar{padding:8px!important;gap:8px!important;}
.action-slot{
  height:58px!important;
  border-radius:17px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.082),rgba(255,255,255,.038))!important;
  border:1px solid rgba(243,234,215,.08)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 8px 18px rgba(0,0,0,.18)!important;
}
.action-slot:hover{filter:none!important;transform:translateY(-1px)!important;background:linear-gradient(180deg,rgba(255,255,255,.11),rgba(255,255,255,.055))!important;}
.action-slot.primary,.action-slot.on{
  background:linear-gradient(150deg,rgba(20,241,149,.34),rgba(46,155,176,.22))!important;
  border-color:rgba(20,241,149,.38)!important;
  box-shadow:0 0 0 1px rgba(20,241,149,.14),0 0 24px rgba(20,241,149,.16),inset 0 1px 0 rgba(255,255,255,.10)!important;
}
.action-slot.danger{background:linear-gradient(150deg,rgba(224,96,76,.38),rgba(96,34,34,.26))!important;border-color:rgba(224,96,76,.32)!important;}
.action-slot .ico{font-size:20px!important;}
.action-slot .lbl{font-size:9.5px!important;letter-spacing:.015em!important;}
.action-slot .num{top:6px!important;left:7px!important;background:rgba(0,0,0,.44)!important;}
.build-ribbon{padding:8px!important;}
.build-strip{gap:9px!important;padding:2px 10px 5px!important;}
.build-tile{
  min-width:96px!important;
  height:58px!important;
  border-radius:16px!important;
  background:linear-gradient(180deg,rgba(255,255,255,.080),rgba(255,255,255,.040))!important;
  border:1px solid rgba(243,234,215,.11)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055)!important;
}
.build-tile:hover{background:linear-gradient(180deg,rgba(20,241,149,.14),rgba(255,255,255,.045))!important;transform:translateY(-1px);}
.build-tile.on{background:linear-gradient(150deg,rgba(20,241,149,.26),rgba(153,69,255,.18))!important;border-color:rgba(20,241,149,.40)!important;}
.build-tile.locked,.build-tile:disabled{opacity:.34!important;filter:saturate(.55) grayscale(.25)!important;}
.build-tile .bg{font-size:18px!important;}
.build-tile .bn{font-size:10.5px!important;}
.build-tile .bc{font-size:9.5px!important;color:#ffe7ad!important;}
.chat{
  left:var(--safe-x)!important;
  bottom:calc(var(--safe-b) + 118px)!important;
  width:min(330px,calc(100vw - 24px))!important;
  max-height:150px!important;
  border-radius:18px!important;
  background:linear-gradient(180deg,rgba(9,15,25,.72),rgba(5,9,16,.52))!important;
  border:1px solid rgba(243,234,215,.12)!important;
  box-shadow:0 16px 42px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.055)!important;
  backdrop-filter:blur(12px)!important;
}
.chat-log{font-size:11px!important;line-height:1.25!important;}
.chat-form input{background:rgba(255,255,255,.055)!important;}
.tip{
  border-radius:16px!important;
  padding:10px 12px!important;
  background:linear-gradient(180deg,rgba(6,11,19,.98),rgba(2,6,10,.96))!important;
  border-color:rgba(20,241,149,.50)!important;
  box-shadow:0 22px 66px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.06)!important;
}
.toast{top:calc(var(--safe-y) + 8px)!important;border-radius:16px!important;}
.channel{bottom:calc(var(--safe-b) + 88px)!important;border-radius:18px!important;}
.utility-pop,.quest-pop,.inspect-pop,.ctx,.modal,.settings-panel{
  border-radius:22px!important;
  background:linear-gradient(180deg,rgba(10,16,27,.96),rgba(5,9,16,.92))!important;
  border-color:rgba(243,234,215,.15)!important;
  box-shadow:0 24px 70px rgba(0,0,0,.56),inset 0 1px 0 rgba(255,255,255,.07)!important;
}
.utility-pop{left:calc(var(--safe-x) + var(--hud-w) + 12px)!important;top:calc(var(--safe-y) + 78px)!important;max-height:calc(100dvh - 184px)!important;}
.quest-pop{top:calc(var(--safe-y) + 98px)!important;}
@media(max-width:900px),(max-height:720px){
  .sc-root{--hud-w:min(316px,calc(100vw - 16px));}
  .scv-hud{padding:9px 10px!important;border-radius:18px!important;}
  .scv-av{width:38px!important;height:38px!important;border-radius:13px!important;}
  .scv-name{font-size:15px!important;}
  .scv-res{gap:5px!important;}
  .scv-pill{min-height:30px!important;font-size:11px!important;border-radius:11px!important;}
  .scv-tabs{gap:5px!important;margin-top:8px!important;}
  .scv-tab{min-height:46px!important;border-radius:13px!important;font-size:8px!important;}
  .minimap{width:132px!important;height:132px!important;top:calc(var(--safe-y) + 54px)!important;}
  .chrome-btn{width:40px!important;height:40px!important;border-radius:14px!important;}
  .action-stack{width:calc(100vw - 12px)!important;left:6px!important;right:6px!important;transform:none!important;gap:5px!important;}
  .action-bar{gap:4px!important;padding:5px!important;border-radius:18px!important;}
  .action-slot{height:46px!important;border-radius:13px!important;}
  .action-slot .ico{font-size:16px!important;}
  .action-slot .lbl{font-size:8px!important;}
  .build-ribbon{padding:6px!important;border-radius:18px!important;}
  .build-tile{min-width:84px!important;height:52px!important;border-radius:14px!important;}
  .chat{bottom:calc(var(--safe-b) + 104px)!important;width:min(296px,calc(100vw - 16px))!important;max-height:124px!important;}
  .utility-pop,.quest-pop{left:8px!important;right:8px!important;width:auto!important;top:auto!important;bottom:calc(var(--safe-b) + 78px)!important;max-height:min(48dvh,360px)!important;}
}
@media(max-width:520px),(max-height:560px){
  .sc-root{--hud-w:min(292px,calc(100vw - 12px));}
  .scv-hud{scale:.94!important;transform-origin:top left!important;}
  .scv-res{grid-template-columns:repeat(4,minmax(0,1fr))!important;}
  .scv-limit-pill span{display:none!important;}
  .minimap{width:104px!important;height:104px!important;top:calc(var(--safe-y) + 48px)!important;right:6px!important;}
  .chrome-actions{gap:6px!important;}
  .chrome-btn{width:36px!important;height:36px!important;border-radius:12px!important;}
  .action-bar{grid-template-columns:repeat(auto-fit,minmax(42px,1fr))!important;}
  .build-strip{gap:6px!important;padding-left:7px!important;padding-right:7px!important;}
  .build-tile{min-width:76px!important;height:49px!important;}
  .build-tile .bc{display:none!important;}
  .chat{display:none!important;}
  .toast{max-width:calc(100vw - 12px)!important;}
}
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

function shortWallet(addr) {
  return addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : "Not connected";
}
function bytesToBase64(bytes) {
  let s = "";
  const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}
function phantomProvider() {
  const w = typeof window !== "undefined" ? window : {};
  const p = w.phantom?.solana || w.solana;
  return p?.isPhantom ? p : null;
}
async function loadLoginGateConfig() {
  const cfg = await api("/api/auth/config");
  if (cfg?.ok && cfg.loginGate) return cfg.loginGate;
  return null;
}
function loginGateText(gate) {
  if (!gate?.enabled) return "No token gate configured for this world.";
  if (!gate.configured) return "Token gate is enabled, but admin must configure token mint and RPC endpoint.";
  return `Requires at least ${gate.minUi || 1} ${gate.tokenLabel || "$CRAFTS"} in your Phantom wallet.`;
}
async function connectAndSignPhantom() {
  const provider = phantomProvider();
  if (!provider) throw new Error("Phantom wallet was not found. Install Phantom or enable the extension, then try again. You can still use Spectate read-only without a wallet.");
  const conn = await provider.connect();
  const wallet = (conn?.publicKey || provider.publicKey)?.toString?.();
  if (!wallet) throw new Error("Phantom did not return a Solana wallet.");
  const tokenCheck = await api("/api/auth/token-check", { wallet });
  if (!tokenCheck?.ok) throw new Error(tokenCheck?.msg || "This wallet does not meet the token requirement.");
  const challenge = await api("/api/auth/challenge", { wallet });
  if (!challenge?.ok) throw new Error(challenge?.msg || "Could not create wallet challenge.");
  const encoded = new TextEncoder().encode(challenge.message);
  const signed = await provider.signMessage(encoded, "utf8");
  const signature = bytesToBase64(signed.signature || signed);
  return { wallet, message: challenge.message, signature, loginGate: tokenCheck?.loginGate || challenge?.loginGate || null };
}

export default function mount() {
  const root = document.getElementById("solcraft-root");
  if (!root) return;
  root.className = "sc-root";
  root.replaceChildren(); // hot-reload safe: no double HUD/canvas ghosts

  const styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  const worldEl = document.createElement("div");
  worldEl.className = "sc-world";
  const hudEl = document.createElement("div");
  hudEl.className = "sc-hud";
  root.append(styleEl, worldEl, hudEl);
  const preventGameContext = (ev) => { if (root.contains(ev.target)) { ev.preventDefault(); return false; } };
  root.addEventListener("contextmenu", preventGameContext, { capture: true });
  hudEl.addEventListener("contextmenu", preventGameContext, { capture: true });
  worldEl.addEventListener("contextmenu", preventGameContext, { capture: true });
  document.addEventListener("contextmenu", preventGameContext, { capture: true });

  /* region roots — each its own tradjs render target */
  const mk = (cls) => { const d = document.createElement("div"); if (cls) d.className = cls; hudEl.appendChild(d); return d; };
  const topEl = mk("sc-top");
  const hudRoot = document.createElement("div"); topEl.appendChild(hudRoot);
  const actionsRoot = document.createElement("div"); topEl.appendChild(actionsRoot);
  const utilityRoot = mk("");
  const minimapEl = document.createElement("canvas");
  minimapEl.id = "sc-minimap"; minimapEl.className = "minimap"; minimapEl.width = 190; minimapEl.height = 190;
  minimapEl.title = "Open world map";
  minimapEl.addEventListener("click", () => { if (ST.screen === "playing") { ST.modal = "worldmap"; paint(true); } });
  hudEl.appendChild(minimapEl);
  const chatEl = mk("");
  const bottomRoot = mk("");
  const toastEl = document.createElement("div"); toastEl.className = "toast"; hudEl.appendChild(toastEl);
  const channelEl = document.createElement("div"); channelEl.className = "channel";
  channelEl.innerHTML = `<div id="sc-ch-label">Chopping…</div><div class="cbar"><i id="sc-ch-fill"></i></div>`;
  hudEl.appendChild(channelEl);
  const ctxEl = document.createElement("div"); ctxEl.className = "ctx"; ctxEl.style.display = "none"; hudEl.appendChild(ctxEl);
  const tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.style.display = "none"; hudEl.appendChild(tipEl);
  const vignetteEl = document.createElement("div"); vignetteEl.className = "sc-vignette"; hudEl.appendChild(vignetteEl);
  const guideRoot = mk("");
  const modalRoot = mk("");
  const menuRoot = mk("");

  const sfx = makeSfx();

  const ST = {
    screen: "menu", auth: null, walletVerified: false, loginMsg: "", loginGate: null,
    profile: { name: "", body: BODY_COLORS[0], hat: HAT_COLORS[0], wallet: "" },
    characterProfile: loadCharacterProfile(),
    me: null, rev: 0, ax: 1e6, az: 1e6, chatId: 0, mapRev: -1,
    players: [], offers: [], leaderboard: [], goldSources: [], map: { rev: -1, tiles: [], buildings: [], loot: [], players: [] },
    visual: loadVisualSettings(), ui: loadUiSettings(),
    mode: "explore", placing: null, tool: "none", destroying: DESTROY_TOOLS[0]?.id || "popper",
    near: { i: null, g: null, r: null, m: false },
    modal: null, panel: null, tradeTab: "market", inspect: null,
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
    wonderPrompt: "", wonderName: "", wonderFootprint: 9, wonderMode: "district", wonderPaletteId: "solar", wonderRecipe: null, wonderBusy: false, wonderPlacing: false, wonderMsg: "", wonderLastPlaceAt: 0, wonderLastPlaceKey: "",
    adminTool: "demolish", adminMsg: "",
  };
  function currentWonderSize() { return normalizeWonderFootprintClient(ST.wonderFootprint || ST.wonderRecipe?.footprint || 9); }
  function currentWonderMode() { return ["single", "district"].includes(String(ST.wonderMode || ST.wonderRecipe?.mode)) ? String(ST.wonderMode || ST.wonderRecipe?.mode) : "district"; }
  function currentWonderPalette() { return WONDER_PALETTES.find((p) => p.id === (ST.wonderPaletteId || ST.wonderRecipe?.paletteId)) || WONDER_PALETTES[0]; }
  function currentWonderNameFallback() { return cleanWonderPromptClient(ST.wonderName || ST.wonderPrompt || "World Wonder").replace(/[^ws'’-]/g, " ").replace(/s+/g, " ").trim().slice(0, 42) || "World Wonder"; }
  function setWonderName(value) {
    ST.wonderName = String(value || "").replace(/[<>`{}]/g, " ").replace(/s+/g, " ").slice(0, 42);
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
    if (def.id === "road") return 0;
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
    if (toast) say(`${kind === "menu" ? "Menu" : "Interface"} scale ${uiScalePct(ST.ui[key])}`, 900);
  }
  function stepUiScale(kind, delta) {
    const key = kind === "menu" ? "menuScale" : "uiScale";
    const cur = ST.ui?.[key] ?? 1;
    setUiScale(kind, cur + delta, true);
  }
  function resetUiScale(kind = "all") {
    if (kind === "menu") setUiScale("menu", 1, true);
    else if (kind === "ui") setUiScale("ui", 1, true);
    else { ST.ui = { uiScale: 1, menuScale: 1 }; saveUiPrefs(ST.ui); say("Interface and menu scale reset.", 1000); }
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
  function toggleMusicSound() { ST.musicMuted = !ST.musicMuted; saveSoundPrefs(); if (!ST.musicMuted) { sfx.resume(); say("Music on. If your browser blocked autoplay, this click starts the uploaded track.", 1800); } }
  function startMusicNow() { ST.musicMuted = false; saveSoundPrefs(); sfx.resume(); say("Music started. Uploaded track will play if /api/audio-runtime has a background URL.", 2200); }

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
    if (!ST.walkthrough) ST.walkthrough = { active: true, step: "char" };
    return true;
  }
  function skipWalkthrough() {
    markWalkthroughDone();
    say("Walkthrough skipped. Open Quests anytime for the full guide.", 1800);
    paint(true);
  }
  function restartWalkthrough() {
    try { localStorage.removeItem(walkthroughStorageKey()); } catch (e) {}
    ST.walkthrough = null;
    const started = maybeStartWalkthrough(true);
    if (started) {
      ST.panel = null;
      ST.modal = null;
      say("Tutorial restarted from the beginning.", 1800);
    } else {
      say("Tutorial reset. It will start when you enter as a player.", 2200);
    }
    paint(true);
  }
  function markGuidePanelVisited(panel) {
    const id = panel === "char" ? "character" : panel === "quests" ? "quests" : panel === "bank" ? "bank" : "";
    if (!id || !ST.auth || ST.spectator) return;
    act("guideVisit", { id }).then((r) => r?.ok && pollSoon());
  }
  const WALK_STEPS = ["char", "quests", "chop", "mine", "claim", "build", "bank"];
  function nextWalkStep(cur) { const i = WALK_STEPS.indexOf(cur); return i >= 0 && i < WALK_STEPS.length - 1 ? WALK_STEPS[i + 1] : "done"; }
  function advanceWalkthroughTo(next, msg = "") {
    if (next === "done") { markWalkthroughDone(); if (msg) say(msg, 2400); paint(true); return; }
    ST.walkthrough = { active: true, step: next };
    if (msg) say(msg, 2200);
    paint(true);
  }
  function advanceWalkthroughPanel(panel) {
    if (!ST.walkthrough?.active) return;
    if (ST.walkthrough.step === "char" && panel === "char") return advanceWalkthroughTo("quests", "Nice. Open Guide to see action, building, and skill rewards.");
    if (ST.walkthrough.step === "quests" && panel === "quests") return advanceWalkthroughTo("chop", "Guide opened. Next, try Chop (2) on a tree.");
    if (ST.walkthrough.step === "bank" && panel === "bank") return advanceWalkthroughTo("done", "Bank opened. Deposits, scans, and withdrawals live here.");
  }
  function advanceWalkthroughAction(kind) {
    if (!ST.walkthrough?.active) return;
    // Selection alone should not complete Chop/Mine/Capture. Those steps advance
    // only after the server confirms the actual completed action.
    if (ST.walkthrough.step === "build" && kind === "build") return advanceWalkthroughTo("bank", "Build cards explain cost, footprint, and construction time. Next open Bank (7) from the main bar.");
    if (ST.walkthrough.step === "bank" && kind === "bank") return advanceWalkthroughPanel("bank");
  }
  function completeWalkthroughAction(kind) {
    if (!ST.walkthrough?.active) return;
    if (ST.walkthrough.step === "chop" && kind === "chop") return advanceWalkthroughTo("mine", "Tree chopped. Next try Mine (3) on stone.");
    if (ST.walkthrough.step === "mine" && kind === "mine") return advanceWalkthroughTo("claim", "Stone mined. Next select Capture (4) to expand connected territory.");
    if (ST.walkthrough.step === "claim" && kind === "claim") return advanceWalkthroughTo("build", "Land captured. Build next to raise limits and make the camp useful.");
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
  setTerrainVisualPrefs(ST.visual);
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
  function saveLiveCharacterProfile(msg = "Character updated.") {
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
    saveLiveCharacterProfile(`${preset.name} colors applied.`);
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
    setTerrainVisualPrefs(ST.visual);
    world?.applyVisualQuality?.(ST.visual);
    loadAtlasRuntimeConfig(true).finally(() => { for (const [, c] of world.cells) c.owner = -1; world.refreshWindow?.(true); paint(true); });
  }
  function setCameraZoom(value, toast = false) {
    const next = clampCameraZoom(value, ST.visual?.cameraZoom || 1);
    ST.visual = saveVisualSettings({ ...ST.visual, cameraZoom: next });
    world?.refreshCameraZoom?.();
    world?.refreshWindow?.(true);
    if (toast) say(`Camera view ${cameraZoomPct(next)}${next >= 3.25 ? " — map view" : next > 1 ? " — seeing more map" : next < 1 ? " — closer view" : ""}.`, 1100);
    paint(true);
    return next;
  }
  function stepCameraZoom(delta) {
    return setCameraZoom((ST.visual?.cameraZoom || 1) + Number(delta || 0), true);
  }
  function setCameraYaw(value, toast = false) {
    const next = normalizeCameraYaw(value, ST.visual?.cameraYaw ?? Math.PI / 4);
    ST.visual = saveVisualSettings({ ...ST.visual, cameraYaw: next });
    world?.refreshCameraRotation?.();
    if (toast) say(`Camera rotated ${cameraYawDeg(next)}°`, 900);
    paint(true);
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
    say("Camera reset.", 900);
    paint(true);
  }
  function setMapView() {
    setCameraZoom(2.05, true);
  }

  /* imperative toast — zero vdom */
  let toastT = null;
  const say = (msg, ms = 2400) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), ms);
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
    if (!file.type?.startsWith("image/")) { sfx.err(); say("That is not an image file."); return; }
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
      img.onerror = () => { sfx.err(); say("Portrait could not be loaded. Try another image."); };
      img.src = String(rd.result || "");
    };
    rd.readAsDataURL(file);
  }

  /* imperative chat — input never re-renders */
  chatEl.className = "panel chat";
  chatEl.style.display = "flex";
  const chatLogEl = document.createElement("div"); chatLogEl.className = "chat-log";
  const chatForm = document.createElement("div"); chatForm.className = "chat-form";
  const chatInput = document.createElement("input");
  chatInput.maxLength = 120; chatInput.placeholder = "Chat… press Enter";
  chatInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { ST.chatOpen = false; chatInput.blur(); paint(true); return; }
    if (ev.key !== "Enter") return;
    const msg = chatInput.value.trim();
    if (!msg) { ST.chatOpen = false; chatInput.blur(); paint(true); return; }
    chatInput.value = "";
    act("chat", { msg });
    ST.chatOpen = false; chatInput.blur(); paint(true);
  });
  chatForm.appendChild(chatInput);
  chatEl.append(chatLogEl, chatForm);
  function appendChat(line) {
    const d = document.createElement("div");
    d.className = "chat-line" + (line.sys ? " sys" : "");
    if (line.sys || !line.n) d.textContent = line.m;
    else { const b = document.createElement("b"); b.textContent = line.n + ": "; d.append(b, document.createTextNode(line.m)); }
    chatLogEl.appendChild(d);
    while (chatLogEl.children.length > 36) chatLogEl.removeChild(chatLogEl.firstChild);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }

  /* ---------- NET: anchor/rev protocol ---------- */
  let pollT = null, pollBusy = false, pollSoonT = null;
  async function poll(force = false) {
    if (!ST.auth || pollBusy || (!force && ST.screen !== "playing")) return false;
    const a = { ...ST.auth };
    pollBusy = true;
    const r = await api(`/api/state?pid=${a.pid}&secret=${encodeURIComponent(a.secret)}&rev=${ST.rev}&ax=${ST.ax}&az=${ST.az}&chat=${ST.chatId}&mapRev=${ST.mapRev ?? -1}`);
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
    applySnap(r.snap);
    return true;
  }
  const pollSoon = () => { clearTimeout(pollSoonT); pollSoonT = setTimeout(() => poll(true), 120); };

  function applySnap(snap) {
    const requiredRaw = String(snap.requiredVersion || snap.me?.requiredVersion || "");
    const required = Number(requiredRaw || 0) || 0;
    const acked = readAckedClientVersion();
    // Previous logic only compared requiredVersion to page boot time. That can
    // miss users who were in menu/admin/not polling during deploy. Now every
    // deployment version is shown once until the player clicks Refresh.
    if (requiredRaw && requiredRaw !== acked) {
      ST.updateRequired = true;
      ST.updateVersion = requiredRaw;
      ST.updateReason = String(snap.updateReason || snap.me?.updateReason || "A game update landed. Refresh once so your client and the server agree.");
    } else if (required && required > CLIENT_BOOT_AT && !ST.updateRequired) {
      ST.updateRequired = true;
      ST.updateVersion = requiredRaw;
      ST.updateReason = "A game update landed. Refresh once so your client and the server agree.";
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
      ST.offers = snap.world.offers;
      if (snap.world.map) { ST.map = { players: ST.map?.players || [], ...snap.world.map }; ST.mapRev = snap.world.map.rev ?? snap.world.rev ?? ST.mapRev; }
      world.applyWorld(snap.world);
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
    let minX = Number(ST.me?.x || 0), maxX = minX, minZ = Number(ST.me?.z || 0), maxZ = minZ;
    const add = (x, z) => { x = Number(x); z = Number(z); if (!Number.isFinite(x) || !Number.isFinite(z)) return; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
    for (const t of tiles) add(t.x, t.z);
    for (const b of buildings) add(b.x, b.z);
    for (const l of loot) add(l.x, l.z);
    for (const p of players) add(p.x, p.z);
    if (!expanded) { add(meX - 28, meZ - 28); add(meX + 28, meZ + 28); }
    const span = Math.max(maxX - minX + 1, maxZ - minZ + 1, expanded ? 12 : 58);
    const pad = Math.max(expanded ? 6 : 10, Math.min(expanded ? 30 : 18, Math.ceil(span * (expanded ? 0.08 : 0.05))));
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
    const c = canvas.getContext("2d");
    const Wm = canvas.width, Hm = canvas.height;
    const data = worldMapData(expanded);
    const { tiles, buildings, loot, players, minX, maxX, minZ, maxZ } = data;
    c.clearRect(0, 0, Wm, Hm);
    c.fillStyle = "#111821"; c.fillRect(0, 0, Wm, Hm);
    const spanX = Math.max(1, maxX - minX + 1), spanZ = Math.max(1, maxZ - minZ + 1);
    const margin = expanded ? 30 : 7;
    const scale = Math.max(1, Math.min((Wm - margin * 2) / spanX, (Hm - margin * 2) / spanZ));
    const ox = (Wm - spanX * scale) / 2, oz = (Hm - spanZ * scale) / 2;
    const px = (x) => ox + (Number(x) - minX) * scale;
    const pz = (z) => oz + (Number(z) - minZ) * scale;
    const cell = Math.max(expanded ? 2 : 1, scale * 0.92);
    c.save();
    c.globalAlpha = expanded ? 0.18 : 0.10;
    c.strokeStyle = "#14f195"; c.lineWidth = 1;
    const gridStep = expanded ? Math.max(1, Math.ceil(8 / Math.max(1, scale))) : Math.max(2, Math.ceil(18 / Math.max(1, scale)));
    for (let x = Math.ceil(minX / gridStep) * gridStep; x <= maxX; x += gridStep) { c.beginPath(); c.moveTo(px(x), oz); c.lineTo(px(x), oz + spanZ * scale); c.stroke(); }
    for (let z = Math.ceil(minZ / gridStep) * gridStep; z <= maxZ; z += gridStep) { c.beginPath(); c.moveTo(ox, pz(z)); c.lineTo(ox + spanX * scale, pz(z)); c.stroke(); }
    c.restore();
    for (const t of tiles) {
      const col = new THREE.Color(t.ownerBody || 0x6f8057);
      c.fillStyle = `#${col.getHexString()}`;
      c.globalAlpha = t.owner === ST.me.id ? 0.92 : 0.42;
      c.fillRect(px(t.x), pz(t.z), cell, cell);
    }
    c.globalAlpha = 1;
    const wondersForMap = buildings.filter((b) => b && b.kind === "worldwonder");
    for (const w of wondersForMap) {
      const r = wonderMapDistrictRadius(w);
      const sx = px(Number(w.x) - r), sz = pz(Number(w.z) - r);
      const sw = Math.max(2, (r * 2 + 1) * scale), sh = Math.max(2, (r * 2 + 1) * scale);
      c.save();
      c.globalAlpha = expanded ? 0.18 : 0.11;
      c.strokeStyle = wonderDistrictColorHex(w);
      c.lineWidth = expanded ? 2 : 1;
      c.strokeRect(sx, sz, sw, sh);
      c.restore();
    }
    const roadMap = new Map();
    for (const r of districtRoadsForMap(buildings)) roadMap.set(`${r.x},${r.z}`, r);
    if (roadMap.size) {
      c.save();
      c.globalAlpha = expanded ? 0.64 : 0.48;
      for (const r of roadMap.values()) {
        c.fillStyle = r.color || "#d3aa63";
        const rr = Math.max(expanded ? 2 : 1.1, scale * 0.48);
        c.fillRect(px(r.x) + scale * 0.26, pz(r.z) + scale * 0.26, rr, rr);
      }
      c.restore();
    }
    for (const b of buildings) {
      c.fillStyle = b.kind === "worldwonder" ? "#9945ff" : b.kind === "keep" ? "#ff705c" : b.kind === "bomb" ? "#ffb36c" : b.owner === ST.me.id ? "#f6ead6" : "#37404b";
      const s = b.kind === "worldwonder" ? Math.max(4, scale * 1.15) : Math.max(2, scale * .75);
      c.fillRect(px(b.x) + scale * .12, pz(b.z) + scale * .12, s, s);
    }
    for (const l of loot) {
      if (l.kind !== "gold") continue;
      c.fillStyle = "#ffd76e"; c.beginPath(); c.arc(px(l.x) + scale * .5, pz(l.z) + scale * .5, Math.max(1.6, scale * .28), 0, Math.PI * 2); c.fill();
    }
    const nowMs = Date.now();
    for (const q of players) {
      const isMe = q.id === ST.me.id;
      const seenAt = Number(q.lastSeen || q.ts || 0);
      const active = isMe || !seenAt || nowMs - seenAt <= 120000;
      const x = px(q.x) + scale * .5, z = pz(q.z) + scale * .5;
      const ghost = !!q.spectator;
      const col = new THREE.Color(isMe ? 0xffffff : ghost ? 0x9fdcff : (q.body || 0xf29c72));
      c.globalAlpha = ghost ? 0.58 : active ? 1 : 0.35;
      c.fillStyle = `#${col.getHexString()}`; c.beginPath(); c.arc(x, z, isMe ? Math.max(4, scale * .55) : Math.max(2.4, scale * .42), 0, Math.PI * 2); c.fill();
      c.strokeStyle = isMe ? "#14f195" : ghost ? "rgba(189,238,255,.9)" : "rgba(255,255,255,.75)"; c.lineWidth = isMe ? 2 : 1; c.stroke();
    }
    c.globalAlpha = 1;
    const view = { minX, minZ, scale, ox, oz, spanX, spanZ, margin, w: Wm, h: Hm };
    if (expanded) ST.worldMapView = view; else ST.minimapView = view;
    if (!expanded) {
      c.save(); c.globalAlpha = 0.92; c.fillStyle = "rgba(5,8,14,.62)"; c.fillRect(7, Hm - 25, Math.min(156, Wm - 14), 18);
      c.font = "800 9px Outfit, sans-serif"; c.textBaseline = "middle"; const ly = Hm - 16;
      c.fillStyle = "#fff"; c.beginPath(); c.arc(16, ly, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#9945ff"; c.fillRect(47, ly - 3, 6, 6); c.fillStyle = "#d3aa63"; c.fillRect(91, ly - 2, 10, 4); c.fillStyle = "#f29c72"; c.beginPath(); c.arc(132, ly, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(243,234,215,.82)"; c.fillText("you", 22, ly); c.fillText("wonder", 58, ly); c.fillText("road", 104, ly); c.fillText("player", 138, ly); c.restore();
    }
    return view;
  }

  function handleWorldMapClick(ev) {
    const view = ST.worldMapView;
    const cv = ev?.target?.closest?.("canvas");
    if (!view || !cv || !ST.me) return;
    const r = cv.getBoundingClientRect();
    const sx = cv.width / Math.max(1, r.width), sy = cv.height / Math.max(1, r.height);
    const x = Math.round(view.minX + ((ev.clientX - r.left) * sx - view.ox) / view.scale);
    const z = Math.round(view.minZ + ((ev.clientY - r.top) * sy - view.oz) / view.scale);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (isAdminPlayer()) {
      act("adminMapTeleport", { x, z }).then((res) => {
        if (res && res.ok) { ST.modal = null; world.hardSnapMe(res.x ?? x, res.z ?? z); world.refreshWindow?.(true); pollSoon(); paint(true); }
      });
      return;
    }
    ST.modal = null; paint(true);
    if (!world.pathTo(x, z)) say("That point is too far to walk from here. Normal players use roads, Return Scroll, or Wonder teleports.", 2600);
  }

  async function act(type, payload = {}) {
    if (ST.updateRequired) return { ok: false, msg: "refresh required" };
    if (!ST.auth) return { ok: false };
    if (ST.spectator && !["move", "movePath", "adminMapTeleport", "adminDemolishAt", "adminSpawnKeep", "profileAppearance", "setupProfile", "homeStart", "homeFinish", "homeCancel", "home"].includes(type)) {
      say("Spectator mode is read-only. Connect Phantom to claim, craft, build, trade, or collect. Spectators are visible as ghosts but cannot pick up coins.", 2200);
      return { ok: false, msg: "spectator" };
    }
    const r = await api("/api/action", { pid: ST.auth.pid, secret: ST.auth.secret, type, ...payload });
    if (r && r.note) say(r.note, 2600);
    else if (r && !r.ok && r.msg) { sfx.err(); say(r.msg, 2400); }
    if (r && r.ok && type !== "move" && type !== "movePath") pollSoon();
    return r;
  }


  function cleanWonderPromptClient(value) {
    return String(value || "").replace(/s+/g, " ").trim().slice(0, 180);
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
    if (ST.wonderBusy) { say("World Wonder AI is already generating. The foundation will start after the plan is ready.", 1800); return null; }
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
      r = { ok: false, msg: e?.message || "Wonder generator failed." };
    }
    ST.wonderBusy = false;
    if (!r || !r.ok || !r.recipe) { sfx.err(); ST.wonderMsg = r?.msg || "Wonder generator failed."; say(ST.wonderMsg, 2600); paint(true); return null; }
    ST.wonderRecipe = r.recipe;
    ST.wonderName = r.recipe?.name || ST.wonderName || currentWonderNameFallback();
    ST.wonderFootprint = r.recipe?.footprint || ST.wonderFootprint;
    ST.wonderMode = r.recipe?.mode || ST.wonderMode;
    ST.wonderPaletteId = r.recipe?.paletteId || ST.wonderPaletteId;
    ST.wonderMsg = `AI plan ready: ${r.recipe?.name || "World Wonder"}. Founding starts when you click a valid ${r.recipe?.footprint || currentWonderSize()}×${r.recipe?.footprint || currentWonderSize()} plaza center.`;
    paint(true);
    return r.recipe;
  }
  async function placeWorldWonderAt(x, z) {
    if (ST.wonderPlacing) { say("World Wonder placement is already running. Wait for the current request.", 1800); return; }
    const promptBefore = cleanWonderPromptClient(ST.wonderPrompt);
    const placeKey = `${x},${z}:${promptBefore}`;
    if (Date.now() - Number(ST.wonderLastPlaceAt || 0) < 3500 && ST.wonderLastPlaceKey === placeKey) {
      say("Already founding that Wonder. Wait for the server response.", 1800);
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
      // Login is wallet-only. New settlers name/customize after they enter the world.
      const r = await api("/api/join", { name: "", body: ST.profile.body, hat: ST.profile.hat, appearance: ST.characterProfile, walletAuth });
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
      say(e?.message || "Spectator mode failed.", 2600);
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
      else say("Welcome back. Your flag is ready.", 3200);
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
      const zoom = clampCameraZoom(ST.visual?.cameraZoom, 1);
      scene.fog.near = Math.max(24, 16 * zoom);
      scene.fog.far = Math.max(58, 54 * zoom);
    };
    function currentTileLoadRadius() {
      const aspect = W() / Math.max(1, H());
      // Keep the 3D world light. The expanded minimap gives global overview without
      // streaming/rendering the entire infinite world into Three.js.
      const needed = Math.ceil(view * Math.max(1, aspect) + 12);
      return Math.max(TILE_LOAD_R, Math.min(Math.min(TILE_LOAD_R_MAX, 44), needed));
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
      const phase = (t / 220) % 1;
      const wave = Math.sin(phase * Math.PI * 2 - Math.PI * 0.5);
      const day = Math.max(0.16, 0.5 + 0.5 * wave);
      const dusk = 1 - Math.abs(day - 0.5) * 2;
      sun.intensity = 0.35 + day * 1.05;
      hemi.intensity = 0.48 + day * 0.68;
      fill.intensity = 0.18 + (1 - day) * 0.45;
      renderer.toneMappingExposure = 0.82 + day * 0.34;
      sun.color.set(day < 0.28 ? 0x9bb7ff : dusk > 0.55 ? 0xffbd83 : 0xffdfaa);
      hemi.color.set(day < 0.28 ? 0xaec4ff : 0xffefd8);
      hemi.groundColor.set(day < 0.28 ? 0x283452 : 0x6f614f);
      scene.fog.color.set(day < 0.28 ? 0x222d4a : dusk > 0.55 ? 0x93745f : 0xb7a77a);
      scene.fog.near = 24 + day * 5; scene.fog.far = 56 + day * 14;
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

    const tileGeo = new THREE.BoxGeometry(1.006, 1, 1.006);
    const neutralMats = () => terrainMats("sand");
    const ownerMatCache = new Map();
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

    const cells = new Map(), doodadPool = new Map(), buildPool = new Map(), buildAt = new Map(), sourcePool = new Map(), npcPool = new Map();
    const lootPool = new Map(), rigPool = new Map(), tradePostPool = new Map(), exceptions = new Map(), tileOwner = new Map();
    const roadPool = new Map(), districtPool = new Map();
    const roadGeo = new THREE.PlaneGeometry(0.70, 0.70);
    const roadMat = new THREE.MeshBasicMaterial({ color: 0xb98c55, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide });
    const roadMatMine = new THREE.MeshBasicMaterial({ color: 0xd8b66e, transparent: true, opacity: 0.66, depthWrite: false, side: THREE.DoubleSide });
    const districtLineMatCache = new Map();
    function districtLineMat(color) {
      const k = String(color || "#14f195");
      if (!districtLineMatCache.has(k)) districtLineMatCache.set(k, new THREE.LineBasicMaterial({ color: new THREE.Color(k), transparent: true, opacity: 0.52, depthWrite: false }));
      return districtLineMatCache.get(k);
    }
    const anims = [], bursts = [], waves = [], walkQueue = [], netMoveQueue = [];
    let walking = false, moveBusy = false, pendingWalk = null, moveErrorAt = 0, moveToken = 0, activeMoveToken = 0;
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
    const confirmedMove = { x: 0, z: 0 };
    const player = new THREE.Group();
    let rig = null, rigSig = "";
    player.position.set(0, 0.22, 0); scene.add(player);
    const aura = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), new THREE.MeshBasicMaterial({ color: 0x14f195, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    aura.rotation.x = -Math.PI / 2; aura.position.y = 0.008; player.add(aura);
    const plight = new THREE.PointLight(0xb9a6ff, 0.35, 4.5); plight.position.y = 0.9; player.add(plight);
    function heldToolForState() {
      if (ST.tool === "wood") return "axe";
      if (ST.tool === "stone") return "pickaxe";
      if (ST.tool === "build" || ST.tool === "craft" || ST.tool === "spawn" || ST.tool === "siege") return "hammer";
      if (ST.tool === "claim") return "spear";
      if (ST.tool === "use" || ST.tool === "home") return "staff";
      return "none";
    }
    function ensureRig(force = false) {
      if (!ST.me) return;
      const heldTool = heldToolForState();
      const sig = JSON.stringify([ST.me.body, ST.me.hat, ST.me.equip, ST.characterProfile?.palette, ST.characterProfile?.parts, ST.characterProfile?.showBack, heldTool]);
      if (!force && sig === rigSig) return;
      rigSig = sig;
      if (rig) player.remove(rig);
      rig = buildRig(ST.me.body, ST.me.hat, ST.me.equip || {}, { lit: true, palette: ST.characterProfile?.palette, dollParts: ST.characterProfile?.parts, showBack: ST.characterProfile?.showBack === true, heldTool, name: ST.me.name });
      player.add(rig);
    }
    const homeBanner = new THREE.Group(); let bannerOwner = 0; scene.add(homeBanner);
    const hoverMarker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x14f195, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
    hoverMarker.rotation.x = -Math.PI / 2; hoverMarker.position.y = 0.233; hoverMarker.visible = false; scene.add(hoverMarker);

    const hintGeo = new THREE.PlaneGeometry(0.82, 0.82);
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

    function ensureTradePost(x, z) {
      const k = key(x, z), want = tradePostAt(x, z) && !buildPoolAt(x, z);
      const have = tradePostPool.get(k);
      if (have && want) return;
      if (have && !want) { scene.remove(have.group); tradePostPool.delete(k); return; }
      if (!want) return;
      const { group, parts } = makeBuildingGroup("market", { nm: "Trade Post", cl: "#ffd76e", plinth: 0xc79337 });
      group.position.set(x, 0.22, z);
      group.scale.setScalar(0.82);
      scene.add(group);
      // Trade posts stay visually calm; use-trigger animation handles feedback.
      tradePostPool.set(k, { group, x, z });
      const dd = doodadPool.get(k); if (dd) { scene.remove(dd.group); doodadPool.delete(k); }
    }
    function ensureNpcCamp(x, z) {
      const k = key(x, z);
      const npc = proceduralNpcAt(x, z);
      const want = npc && !buildPoolAt(x, z) && !tradePostAt(x, z);
      const have = npcPool.get(k);
      if (have && want && have.id === npc.id) return;
      if (have) { scene.remove(have.group); npcPool.delete(k); }
      if (!want) return;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.08, 10), M(0x5a4b35, { roughness: 1 }));
      base.position.y = 0.08; g.add(base);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), ME(0xffd76e, 0xffd76e, 0.55));
      body.position.y = 0.34; g.add(body); bobbers.push(body);
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.5, 0.035), M(0x7a5230));
      pole.position.set(0.22, 0.34, 0.1); g.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.02), M(biomeAt(x, z).tint || 0x14f195));
      flag.position.set(0.34, 0.53, 0.1); g.add(flag); wavers.push(flag);
      g.add(makeLabel(npc.name, "#fff0b8"));
      g.position.set(x, 0.18, z);
      scene.add(g);
      npcPool.set(k, { group: g, id: npc.id, ...npc });
    }
    const doodadVisible = (x, z) => {
      const k = key(x, z);
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
      if (have && have.type === want) return;
      if (have) { scene.remove(have.group); doodadPool.delete(k); }
      if (!want || buildPoolAt(x, z)) return;
      const g = new THREE.Group();
      if (want === "tree") buildTree(g, 0, 0, 0.9 + hrand(x, z, 11) * 0.5); else buildRock(g);
      g.position.set(x + (hrand(x, z, 5) - 0.5) * 0.3, 0.14, z + (hrand(x, z, 6) - 0.5) * 0.3);
      g.rotation.y = hrand(x, z, 7) * Math.PI * 2; scene.add(g);
      doodadPool.set(k, { group: g, type: want });
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
      // World Wonders reserve a plaza for selection/placement purposes, but
      // only their center tower is a movement blocker. See physicalBuildAt().
      eachBuildIndexedCell(have, (x, z) => buildAt.set(key(x, z), have));
    }
    function clearBuildAt(have) {
      if (!have) return;
      eachBuildIndexedCell(have, (x, z) => { if (buildAt.get(key(x, z)) === have) buildAt.delete(key(x, z)); });
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
      // Biomes affect discovery/resources/keeps, but neutral ground stays visually calm.
      // Loud per-tile biome materials made player territory harder to read.
      const wantMats = t ? ownerMats(t.body, ST.me && t.owner === ST.me.id) : neutralMats();
      const wantH = t ? 0.18 : 0.11;
      if (!cell) {
        const mesh = new THREE.Mesh(tileGeo, wantMats);
        mesh.scale.y = wantH; mesh.position.set(x, wantH / 2, z);
        mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData = { x, z };
        scene.add(mesh); cell = { mesh, owner: (t && t.owner) || 0, body: (t && t.body) || 0 }; cells.set(k, cell);
      } else if (cell.owner !== ((t && t.owner) || 0) || cell.body !== ((t && t.body) || 0)) {
        cell.mesh.material = wantMats; cell.mesh.scale.y = wantH; cell.mesh.position.y = wantH / 2;
        cell.owner = (t && t.owner) || 0; cell.body = (t && t.body) || 0;
      }
      ensureTradePost(x, z);
      ensureNpcCamp(x, z);
      ensureDoodad(x, z);
    }
    let winX = 1e9, winZ = 1e9;
    function syncWorldVisibility() {
      const px = Math.round(me.x), pz = Math.round(me.z), r = currentTileLoadRadius();
      for (const b of buildPool.values()) {
        if (!b?.group) continue;
        // Buildings must never float on unloaded terrain. Keep their visibility
        // tied to the same ground window as the tile meshes.
        b.group.visible = cheb(b.x, b.z, px, pz) <= r + 1 && cells.has(key(b.x, b.z));
      }
      for (const l of lootPool.values()) if (l?.group) l.group.visible = cheb(l.x, l.z, px, pz) <= r + 1 && cells.has(key(l.x, l.z));
      for (const gs of sourcePool.values()) if (gs?.group) gs.group.visible = cheb(gs.x, gs.z, px, pz) <= r + 1 && cells.has(key(gs.x, gs.z)); for (const npc of npcPool.values()) if (npc?.group) npc.group.visible = cheb(npc.x, npc.z, px, pz) <= r + 1 && cells.has(key(npc.x, npc.z));
      updateWonderDistrictRoads();
    }
    function refreshWindow(force = false) {
      const px = Math.round(me.x), pz = Math.round(me.z), r = currentTileLoadRadius();
      if (!force && Math.max(Math.abs(px - winX), Math.abs(pz - winZ)) <= TILE_WINDOW_HYSTERESIS) { syncWorldVisibility(); return; }
      winX = px; winZ = pz;
      for (const [k, c] of cells) {
        const [cx, cz] = k.split(",").map(Number);
        if (cheb(cx, cz, px, pz) > r + 2) {
          scene.remove(c.mesh); cells.delete(k);
          const d = doodadPool.get(k); if (d) { scene.remove(d.group); doodadPool.delete(k); }
          const tp = tradePostPool.get(k); if (tp) { scene.remove(tp.group); tradePostPool.delete(k); } const npc = npcPool.get(k); if (npc) { scene.remove(npc.group); npcPool.delete(k); }
          const gs = sourcePool.get(k); if (gs && cheb(cx, cz, px, pz) > r + 3) { scene.remove(gs.group); sourcePool.delete(k); }
          const rd = roadPool.get(k); if (rd) { scene.remove(rd); roadPool.delete(k); }
        }
      }
      for (let x = px - r; x <= px + r; x++)
        for (let z = pz - r; z <= pz + r; z++) refreshCell(x, z);
      syncWorldVisibility();
    }
    loadAtlasRuntimeConfig().then(() => { ownerMatCache.clear(); for (const [, c] of cells) c.owner = -1; refreshWindow(true); }).catch(() => {});

    function hardSnapMe(x, z) {
      walkQueue.length = 0; netMoveQueue.length = 0; walking = false; moveBusy = false; pendingWalk = null; activeMoveToken = ++moveToken;
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].kind === "hop") anims.splice(i, 1);
      confirmedMove.x = x; confirmedMove.z = z;
      me.x = x; me.z = z; player.position.set(x, 0.22, z); camTarget.set(x, 0.22, z);
      refreshWindow(true);
    }

    function ensureGoldSource(src) {
      if (!src) return;
      const k = key(src.x, src.z), sig = [src.state, src.owner || 0, Math.ceil(src.hp || 0), src.mineUid || 0, src.stored || 0].join("|");
      let have = sourcePool.get(k);
      if (have && have.sig === sig) return;
      if (have) { scene.remove(have.group); sourcePool.delete(k); }
      const g = new THREE.Group();
      const color = src.state === "barb" ? 0xff705c : src.state === "mining" ? 0xffd76e : src.state === "ruined" ? 0x9fb2bd : 0x14f195;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.08, 8), M(0x463b2e, { roughness: 1 }));
      pad.position.y = 0.02; pad.receiveShadow = true; g.add(pad);
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.045, 24), M(src.state === "mining" ? 0x6b5121 : 0x5e6b71, { roughness: 0.95 }));
      inner.position.y = 0.09; inner.receiveShadow = true; g.add(inner);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.62, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.14; g.add(ring);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.2, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: src.state === "barb" ? 0.10 : 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      beam.position.y = 0.72; g.add(beam);
      if (src.state === "barb") {
        const camp = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.52, 5), M(0x7b4a35, { roughness: 1 })); camp.position.y = 0.44; camp.castShadow = true; g.add(camp);
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M(0xf3ead7, { roughness: 1 })); skull.position.set(0.12, 0.74, 0.1); g.add(skull);
        g.add(makeLabel(`Coin ${Math.ceil(src.hp || 0)}HP`, "#ffd6ce"));
      } else if (src.state === "mining") {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), ME(0xffd76e, 0xffb43d, 1)); gem.position.y = 0.55; g.add(gem); spinsY.push(gem);
        g.add(makeLabel(`${src.stored || 0}🪙 / ${src.cap || 2000}`, "#fff0b8"));
      } else {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), ME(color, color, 0.7)); gem.position.y = 0.42; g.add(gem); bobbers.push(gem);
        g.add(makeLabel(src.state === "ruined" ? "Ruined source" : "territory coin", "#ffd76e"));
      }
      g.position.set(src.x, 0.26, src.z); scene.add(g); sourcePool.set(k, { group: g, sig, ...src });
    }
    function sourceAt(x, z) { return sourcePool.get(key(x, z)) || null; }
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
      const plinth = territoryTopHex(b.ownerBody || ST.me?.body || 0x14f195, ST.me && b.owner === ST.me.id);
      const cs = constructionStateForBuilding(b);
      const { group, parts } = b.kind === "road" ? makeRoadBuildingGroup(b) : makeBuildingGroup(b.kind, { nm: b.nm, cl: b.cl, plinth, wonder: b.wonder, buildProgress: cs ? cs.progress : 1, buildUntil: cs ? cs.end : b.cdUntil });
      decorateBuilding(group, b);
      group.position.set(b.x, 0.22, b.z); scene.add(group);
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
      for (const b of w.buildings) {
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
        const sig = [b.kind, b.nm || "", b.cl || "", b.ownerBody, b.ownerFace || "", b.level, Math.ceil(b.hp), b.maxHp, b.cdUntil || 0, b.constructUntil || 0, buildBucket, b.wonder ? JSON.stringify(b.wonder) : ""].join("|");
        let have = buildPool.get(b.uid);
        if (have && have.sig !== sig) { removeBuild(b.uid); have = null; }
        if (!have) {
          const plinth = territoryTopHex(b.ownerBody, ST.me && b.owner === ST.me.id);
          const { group, parts } = b.kind === "road" ? makeRoadBuildingGroup(b) : makeBuildingGroup(b.kind, { nm: b.nm, cl: b.cl, plinth, wonder: b.wonder, buildProgress, buildUntil: b.cdUntil });
          decorateBuilding(group, b);
          group.position.set(b.x, 0.22, b.z); scene.add(group);
          // Buildings do not idle-spin/bob/flicker; interaction triggers a short pulse instead.
          have = { group, parts, sig, x: b.x, z: b.z, kind: b.kind, owner: b.owner, uid: b.uid, ownerBody: b.ownerBody, usedAt: Number(b.usedAt || 0) };
          buildPool.set(b.uid, have);
          indexBuildAt(have);
          const dd = doodadPool.get(key(b.x, b.z));
          if (dd) { scene.remove(dd.group); doodadPool.delete(key(b.x, b.z)); }
        }
        have.uid = b.uid; indexBuildAt(have);
        if (have.usedAt && Number(b.usedAt || 0) > Number(have.usedAt || 0)) animateBuildingUse(b.uid);
        Object.assign(have, { acc: b.acc, accAt: b.accAt, cdUntil: b.cdUntil, constructAt: b.constructAt || 0, constructUntil: b.constructUntil || 0, usedAt: Number(b.usedAt || 0), ownerName: b.ownerName, ownerFace: b.ownerFace || null, nm: b.nm, cl: b.cl, level: b.level, hp: b.hp, maxHp: b.maxHp, stored: b.stored || 0, ownerBody: b.ownerBody, wonder: b.wonder || null, buildBucket });
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
      ST.goldSources = [];
      for (const [, gs] of [...sourcePool]) { scene.remove(gs.group); }
      sourcePool.clear();
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
      const g = new THREE.Group();
      const bodyColor = Number(q.body || 0xf29c72);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 18), new THREE.MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      g.add(ring);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.34, 8), M(bodyColor, { roughness: 0.85 }));
      body.position.y = 0.34;
      body.castShadow = false;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M(0xf3ead7, { roughness: 0.9 }));
      head.position.y = 0.63;
      g.add(head);
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
        if (r && r.sig !== sig) { scene.remove(r.group); rigPool.delete(q.id); r = null; }
        if (!r) {
          const group = new THREE.Group();
          if (mode === "ghost") {
            group.add(makeRemoteGhostSpectator(q));
          } else if (mode === "full") {
            group.add(buildRig(q.body, q.hat, q.equip || {}, { name: q.name, palette: q.appearance?.palette, dollParts: q.appearance?.parts, showBack: q.appearance?.showBack }));
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
      for (const [id, r] of [...rigPool]) { if (pSeen.has(id)) continue; scene.remove(r.group); rigPool.delete(id); }
    }
    function optimisticMoveLead() { return netMoveQueue.length + (moveBusy ? 1 : 0); }
    function hasPendingMove() { return walking || moveBusy || netMoveQueue.length > 0 || walkQueue.length > 0 || !!pendingWalk || anims.some((a) => a.kind === "hop"); }
    function applyMe(forceMe = false) {
      if (!ST.me) return;
      const movingNow = hasPendingMove();
      if (!movingNow) { confirmedMove.x = ST.me.x; confirmedMove.z = ST.me.z; }
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
      scene.remove(b.group); clearBuildAt(b); buildPool.delete(uid);
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
      moveBusy = false;
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
    function queueServerMove(x, z, from) {
      netMoveQueue.push({ x, z, from });
      flushMoveQueue();
    }
    function flushMoveQueue() {
      if (moveBusy || !netMoveQueue.length) return;
      const batch = netMoveQueue.splice(0, Math.min(MOVE_BATCH_MAX, netMoveQueue.length));
      const lastReq = batch[batch.length - 1];
      moveBusy = true;
      const token = ++moveToken;
      activeMoveToken = token;
      act("movePath", { steps: batch.map((q) => ({ x: q.x, z: q.z })) }).then((r) => {
        if (token !== activeMoveToken) return;
        moveBusy = false;
        if (!r || !r.ok) {
          sfx.err();
          const sx = (r && Number.isInteger(r.x)) ? r.x : confirmedMove.x;
          const sz = (r && Number.isInteger(r.z)) ? r.z : confirmedMove.z;
          stopOptimisticMovement(sx, sz);
          pollSoon();
          return;
        }
        const accepted = Array.isArray(r.path) && r.path.length ? r.path : [{ x: r.x, z: r.z }];
        const last = accepted[accepted.length - 1] || lastReq;
        confirmedMove.x = (typeof last.x === "number" ? last.x : lastReq.x);
        confirmedMove.z = (typeof last.z === "number" ? last.z : lastReq.z);
        const stillAhead = walking || walkQueue.length > 0 || netMoveQueue.length > 0 || !!pendingWalk;
        if (ST.me) {
          ST.me.x = stillAhead ? me.x : confirmedMove.x;
          ST.me.z = stillAhead ? me.z : confirmedMove.z;
          if (typeof r.energy === "number") { ST.me.energy = r.energy; ST.me.energyAt = performance.now(); }
          if (r.inv) ST.me.inv = { ...(ST.me.inv || {}), ...r.inv };
          if (typeof r.xp === "number") ST.me.xp = r.xp;
        }
        if (r.partial) {
          if (r.stoppedMsg) say(r.stoppedMsg, 1600);
          stopOptimisticMovement(confirmedMove.x, confirmedMove.z);
          pollSoon();
          return;
        }
        if (r.lootGone || r.inv) pollSoon();
        refreshWindow(); refreshNear();
        if (ST.tool === "use" && ST.useAfterWalkUid != null) {
          const b = buildPool.get(ST.useAfterWalkUid);
          if (b && cheb(b.x, b.z, me.x, me.z) <= 1) { const uid = ST.useAfterWalkUid; ST.useAfterWalkUid = null; setTimeout(() => useBuildingClient(uid), 0); }
        }
        if (ST.tool === "claim" && captureTargetHere(me.x, me.z)) setTimeout(() => claimTile(me.x, me.z), 0);
        flushMoveQueue();
        advanceLocalWalk();
      }).catch(() => {
        if (token !== activeMoveToken) return;
        moveBusy = false;
        const now = performance.now();
        if (now - moveErrorAt > 900) { moveErrorAt = now; sfx.err(); say("Network hiccup — keeping movement synced.", 1600); }
        // Do not throw away the user's target on a transient request failure.
        // Snap to the last confirmed tile, then let the next click/path continue cleanly.
        stopOptimisticMovement(confirmedMove.x, confirmedMove.z);
        pollSoon();
      });
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
    function travelStepDuration() {
      // Low energy no longer slows the client. The server still spends/rebuilds
      // energy and validates every move as an adjacent step, but movement feel
      // stays crisp instead of pretending to lag.
      const cost = Math.max(0.0001, clientMoveCost());
      if (clientEnergyNow() < cost) {
        const now = performance.now();
        if (now - lowEnergyToastAt > 2600) {
          lowEnergyToastAt = now;
          say("Low energy — keep moving, then rest to refill.", 1200);
        }
      }
      return 0.16;
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
      if (!freeRoadStep && clientEnergyNow() < clientMoveCost()) {
        say("Out of energy. Roads and World Wonder districts are free to travel.", 2200);
        walkQueue.length = 0; pendingWalk = null; return false;
      }
      const hopDur = travelStepDuration();
      walking = true;
      me.x = x; me.z = z;
      if (ST.me) {
        ST.me.x = x; ST.me.z = z;
        ST.me.energy = freeRoadStep ? clientEnergyNow() : Math.max(0, clientEnergyNow() - clientMoveCost());
        ST.me.energyAt = performance.now();
      }
      anims.push({ kind: "hop", t: 0, dur: hopDur, from, to: { x, z }, done: () => {
        walking = false; sfx.hop(); queueServerMove(x, z, from); advanceLocalWalk();
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
      const hits = raycaster.intersectObjects([...cells.values()].map((c) => c.mesh), false);
      if (!hits.length) return null;
      const u = hits[0].object.userData; return { x: u.x, z: u.z };
    }
    function buildingFromEvent(ev) {
      const c = cellFromEvent(ev); if (!c) return null;
      const b = buildAt.get(key(c.x, c.z));
      return b ? { uid: b.uid, b } : null;
    }

    const clock = new THREE.Clock(); let mmT = 0, decorT = 0, envT = 0, lastRenderAt = 0;
    renderer.setAnimationLoop((frameNow = performance.now()) => {
      const nowMs = typeof frameNow === "number" ? frameNow : performance.now();
      if (visualPerf.frameMs && nowMs - lastRenderAt < visualPerf.frameMs) return;
      lastRenderAt = nowMs;
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      tickVisualTextures(t);
      envT += dt; if (envT > visualPerf.envStep) { envT = 0; updateEnvironment(t); }
      decorT += dt; const decorStep = decorT > visualPerf.decorStep; if (decorStep) decorT = 0;
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur);
        if (a.kind === "hop") {
          const x = a.from.x + (a.to.x - a.from.x) * k, z = a.from.z + (a.to.z - a.from.z) * k;
          player.position.set(x, 0.22 + Math.sin(k * Math.PI) * 0.24, z);
        } else if (a.kind === "in") { if (a.obj) a.obj.scale.setScalar(0.01 + 0.99 * k); }
        else if (a.kind === "up") { if (a.obj) { a.obj.position.y = 0.52 + k * 0.7; a.obj.scale.setScalar(1 - k * 0.9); } }
        else if (a.kind === "pulse") { if (a.obj) { const p = 1 + Math.sin(k * Math.PI) * 0.09; const b = a.base || { x: 1, y: 1, z: 1 }; a.obj.scale.set(b.x * p, b.y * (1 + Math.sin(k * Math.PI) * 0.04), b.z * p); } }
        if (k >= 1) { if (a.kind === "pulse" && a.obj && a.base) a.obj.scale.copy(a.base); anims.splice(i, 1); a.done && a.done(); }
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
      const camEase = visualPerf.cameraMode === "classic" ? 0.075 : visualPerf.cameraMode === "low" ? 0.12 : 1 - Math.pow(0.001, dt);
      camTarget.x += (player.position.x - camTarget.x) * camEase;
      camTarget.z += (player.position.z - camTarget.z) * camEase;
      camera.position.copy(camTarget).add(camOffset); camera.lookAt(camTarget);
      sun.position.set(camTarget.x + sunOffset.x, sunOffset.y, camTarget.z + sunOffset.z); sun.target.position.copy(camTarget);
      mmT += dt; if (mmT > 1.05) { mmT = 0; drawMinimap(); }
      renderer.render(scene, camera);
    });

    function drawMinimap() {
      if (!ST.me || ST.screen !== "playing") return;
      drawKnownWorldMap(minimapEl, false);
    }


    function onResize() { renderer.setSize(W(), H()); setFrustum(); }
    window.addEventListener("resize", onResize);

    return {
      applyWorld, applyPlayers, applyMe, me, cellFromEvent, buildingFromEvent, pathTo, pathToNear, tryMoveDelta,
      blocked, buildPoolAt, doodadVisible, burst, shockwave, hoverMarker, hardSnapMe,
      setHintCells, hideBuildGhost, showBuildGhost, refreshWindow, rebuildBuilding, animateBuildingUse, refreshConstructionProgress,
      refreshOwnRig: () => ensureRig(true),
      applyVisualQuality,
      hasPendingMove,
      tileOwner, buildPool, buildAt, lootPool, rigPool, tradePostPool, sourcePool, sourceAt, cells,
      rotateCam: (delta = CAMERA_ROTATION_STEP) => stepCameraYaw(delta),
      refreshCameraRotation: () => {},
      refreshCameraZoom: () => setFrustum(),
      zoom: (delta = 0) => setCameraZoom((ST.visual?.cameraZoom || 1) + Number(delta || 0), true),
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
  const nearT = setInterval(() => { if (ST.screen !== "playing") return; refreshNear(); updateHints(); paint(); }, 450);

  function useBuildingClient(uid) {
    if (uid == null) return;
    act("use", { uid }).then((r) => {
      if (!r || !r.ok) return;
      world.animateBuildingUse?.(uid);
      if (r.openTrade) { ST.panel = "bank"; ST.tradeTab = "bank"; paint(true); return; }
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
  function startChop(x, z) {
    if (ST.channel) return; // already busy
    const d = world.doodadVisible(x, z);
    if (!d) return;
    act("harvestStart", { x, z }).then((r) => {
      if (!r || !r.ok) return;
      sfx.chop();
      ST.channel = { x, z, until: performance.now() + r.ms, ms: r.ms, kind: r.kind || d };
      showChannel(ST.channel.kind === "tree" ? "Chopping…" : "Mining…");
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
      showChannel("Travelling to Wonder…");
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
    if (!isAdminPlayer()) { sfx.err(); say("Admin tools are only available to the world admin.", 1800); return; }
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
      } else if (r) { sfx.err(); say(r.msg || "Nothing to remove there.", 2200); }
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
    if (!silent) act(kind === "home" ? "homeCancel" : kind === "wonder" ? "wonderCancel" : kind === "redeem" ? "redeemCancel" : "harvestCancel", {});
  }
  /* drives the bar + completion; cancels if the player walks off */
  const channelT = setInterval(() => {
    if (!ST.channel) return;
    const ch = ST.channel;
    const moved = (ch.kind === "home" || ch.kind === "wonder" || ch.kind === "redeem")
      ? (!ST.me || world.me.x !== ch.x || world.me.z !== ch.z)
      : (!ST.me || cheb(world.me.x, world.me.z, ch.x, ch.z) > 1);
    if (moved) { cancelChop(); return; }
    const now = performance.now();
    const k = Math.min(1, 1 - (ch.until - now) / ch.ms);
    const fill = document.getElementById("sc-ch-fill");
    if (fill) fill.style.width = `${(k * 100).toFixed(0)}%`;
    if (now >= ch.until) {
      const { x, z, kind } = ch;
      ST.channel = null;
      channelEl.classList.remove("on");
      if (kind === "home") {
        act("homeFinish", {}).then((r) => {
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
            world.burst(x, 0.4, z, kind === "tree" ? 0x52ad58 : 0xaaa69a, 12, 0.45);
            completeWalkthroughAction(kind === "tree" ? "chop" : "mine");
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
    if (ST.screen !== "playing") return;
    ev.preventDefault();
    if (ST.modal) return;
    if (ST.panel) { ST.panel = null; paint(true); }
    const hitB = world.buildingFromEvent(ev);
    const c = world.cellFromEvent(ev);
    const me = ST.me;
    /* a building under the cursor */
    if (hitB && me) {
      const def = LIB_BY_ID[hitB.b.kind];
      const adj = cheb(hitB.b.x, hitB.b.z, world.me.x, world.me.z) <= 1;
      if (hitB.b.owner === me.id) {
        const items = [{ label: "Inspect / manage", run: () => { ST.inspect = hitB.uid; ST.panel = "inspect"; ST.modal = null; ST.inspectDraft = null; paint(true); } }];
        items.push({ label: "Use", disabled: !adj, hint: adj ? "trigger building" : "walk closer", run: () => useBuildingClient(hitB.uid) });
        if (adj) items.push({ label: "Upgrade", hint: `Lv ${hitB.b.level}`, run: () => act("upgrade", { uid: hitB.uid }) });
        if (adj && hitB.b.hp < hitB.b.maxHp) items.push({ label: "Repair", run: () => act("repair", { uid: hitB.uid }) });
        items.push({ label: "Demolish", danger: true, run: () => act("demolish", { uid: hitB.uid }).then((r) => r?.ok && sfx.demolish()) });
        showCtx(ev.clientX, ev.clientY, `${def?.glyph || ""} ${hitB.b.nm || def?.name || hitB.b.kind}`, items);
      } else {
        showCtx(ev.clientX, ev.clientY, `${def?.name || hitB.b.kind} — ${hitB.b.ownerName}'s`, [
          { label: "Inspect base", run: () => { ST.inspect = hitB.uid; ST.panel = "inspect"; ST.modal = null; ST.inspectDraft = null; paint(true); } },
          { label: "Use", disabled: !adj, hint: adj ? "trigger building" : "walk closer", run: () => useBuildingClient(hitB.uid) },
          { label: hitB.b.kind === "bomb" ? "Defuse / siege tool" : "Siege structure", danger: true, disabled: !adj, hint: adj ? "in range" : "walk closer", run: () => doRaid(hitB.uid) },
          { label: "Walk beside", run: () => world.pathToNear(hitB.b.x, hitB.b.z) },
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
          { label: "Open bank", hint: "nearby panel", run: () => { ST.panel = "bank"; ST.tradeTab = "bank"; paint(true); } },
          { label: "Inspect", run: () => { ST.inspectPlayer = q; ST.modal = "player"; paint(); } },
          { label: "Walk toward", run: () => world.pathTo(q.x, q.z) },
        ]);
        return;
      }
    }
    /* public trade post */
    if (c && tradePostAt(c.x, c.z)) {
      const adj = cheb(c.x, c.z, world.me.x, world.me.z) <= 1;
      showCtx(ev.clientX, ev.clientY, "᯼ Trade Post", [
        { label: "Bank", disabled: !adj, hint: adj ? "nearby panel" : "walk closer", run: () => { ST.panel = "bank"; ST.tradeTab = "bank"; paint(true); } },
        { label: "Walk beside", run: () => world.pathToNear(c.x, c.z) },
      ]);
      return;
    }
    /* a tree / rock doodad */
    if (c) {
      const d = world.doodadVisible(c.x, c.z);
      if (d) {
        const adj = cheb(c.x, c.z, world.me.x, world.me.z) <= 1;
        showCtx(ev.clientX, ev.clientY, d === "tree" ? "🌳 Tree" : "🪨 Rock", [
          { label: d === "tree" ? "Select axe + chop (+10🪵)" : "Select pick + mine (+8🪨)", hint: adj ? `${(harvestMs(me?.skills, d) / 1000).toFixed(1)}s` : "select tool + walk closer", run: () => gatherDoodadFromContext(c.x, c.z, d) },
          { label: "Walk beside", run: () => world.pathToNear(c.x, c.z) },
        ]);
        return;
      }
      /* empty tile */
      const t = world.tileOwner.get(key(c.x, c.z));
      const onTile = world.me.x === c.x && world.me.z === c.z;
      const items = [{ label: "Walk here", run: () => world.pathTo(c.x, c.z) }];
      if (me && t && t.owner === me.id) items.push({ label: "Open build bar (5)", run: () => selectBuildTool() });
      if (me && onTile) items.unshift({ label: "Claim / capture (C)", run: () => claimTile() });
      showCtx(ev.clientX, ev.clientY, t ? (t.owner === me?.id ? "Your land" : "Claimed land") : "Frontier", items);
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
    if (ST.tool === next) { closeTools(); say(`${next === "wood" ? "Wood axe" : "Stone pick"} packed away.`, 1100); paint(); return; }
    selectGatherTool(next, true);
  }
  function selectGatherTool(kind, announce = false) {
    const next = kind === "stone" ? "stone" : "wood";
    ST.tool = next;
    ST.mode = "explore"; ST.placing = null;
    updateHints();
    if (announce) say(next === "wood" ? "Wood tool selected — trees are highlighted." : "Stone tool selected — rocks are highlighted.", 1400);
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
  function doClaim() {
    if (ST.tool === "claim") { closeTools(); say("Claim flag tucked away. Very tidy.", 1100); paint(); return; }
    ST.tool = "claim"; ST.mode = "explore"; ST.placing = null;
    updateHints();
    if (claimableHere(world.me.x, world.me.z)) claimTile(world.me.x, world.me.z);
    else { say("Claim selected — each tile costs 2 stone.", 1400); paint(); }
  }
  function doHome() { ST.tool = "home"; updateHints(); paint(); startHomeCast(); }
  function doFight() { if (!ST.near.g) return; act("fight", { target: ST.near.g.id }).then((r) => { if (r && r.ok) sfx.hit(); }); }
  function doRaid(uid) { const target = uid != null ? uid : (ST.near.r && ST.near.r.uid); if (target == null) return; act("raid", { uid: target }).then((r) => { if (r && r.ok) sfx.raid(); }); }
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
  function padRadiusForDef(def) { if (def?.id === "road") return 0; return def?.id === "worldwonder" ? wonderRadiusClient(currentWonderSize()) : 1; }
  function padNameForDef(def) { if (def?.id === "road") return "road tile"; return def?.id === "worldwonder" ? `${currentWonderSize()}×${currentWonderSize()} Wonder plaza` : "3×3 street ring"; }
  function padOffsetsForDef(def) {
    const r = padRadiusForDef(def);
    const out = [];
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx || dz) out.push([dx, dz]);
    }
    return out;
  }
  function padRequirementLine(def) {
    if (def?.id === "worldwonder") return `Costs ${WORLD_WONDER_GOLD_COST}🪙. Needs a clear ${currentWonderSize()}×${currentWonderSize()} plaza (${wonderTilesClient(currentWonderSize())} tiles): center plus ${wonderTilesClient(currentWonderSize()) - 1} surrounding cells. ${wonderFactsLine()}.`;
    if (def?.id === "road") return "Roads go on a single claimed tile and are walkable. Moving on roads and inside Wonder districts spends no energy.";
    return "Needs a clear claimed 3×3 street ring: the eight surrounding tiles must be yours and empty.";
  }
  function canPlaceAt(x, z) {
    const t = world.tileOwner.get(key(x, z));
    const def = LIB_BY_ID[ST.placing || ""];
    const padName = padNameForDef(def);
    if (def?.id === "worldwonder") {
      if (!ST.me) return "No settler loaded.";
      if (!cleanWonderPromptClient(ST.wonderPrompt)) return "Type one Wonder prompt first.";
      if ((ST.me?.inv?.g || 0) < WORLD_WONDER_GOLD_COST) return `Need ${WORLD_WONDER_GOLD_COST}🪙 to found a World Wonder.`;
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
    if (!t || !ST.me || t.owner !== ST.me.id) return "Build on YOUR claimed land.";
    if (def?.id === "road") {
      if (tradePostAt(x, z)) return "A trade post occupies this tile.";
      const b = world.buildPoolAt(x, z);
      if (b && b.kind === "road") return "Road already exists here.";
      if (b) return "Another building already occupies that road tile.";
      if (world.doodadVisible(x, z)) return "Clear the tree or rock before paving a road.";
      return null;
    }
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
  function claimableHere(x, z) {
    const t = world.tileOwner.get(key(x, z));
    if (!ST.me || t) return false;
    if (!touchesOwnLand(x, z)) return false;
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
    for (const [k] of world.cells) {
      const [x, z] = k.split(",").map(Number);
      fn(x, z);
    }
  }
  function updateHints() {
    world?.refreshOwnRig?.();
    if (ST.screen !== "playing" || !ST.me || ST.modal) { world.setHintCells([]); world.hideBuildGhost(); return; }
    const cells = [];
    const push = (x, z, color, opacity = 0.20) => cells.push({ x, z, color, opacity });
    if (ST.tool === "wood" || ST.tool === "stone") {
      const want = ST.tool === "wood" ? "tree" : "rock";
      eachVisibleCell((x, z) => {
        const d = world.doodadVisible(x, z);
        if (d === want && !world.buildPoolAt(x, z)) push(x, z, d === "tree" ? 0x14f195 : 0x7dcfe8, 0.24);
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

  /* ---------- input ---------- */

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
    if (ST.mode === "place") {
      const def = ST.placing ? LIB_BY_ID[ST.placing] : null;
      const bad = canPlaceAt(c.x, c.z);
      return bad ? tipText(`Can't place ${def?.name || "building"}`, bad) : tipText(`Place ${def?.name || "building"}`, padRequirementLine(def));
    }
    if (b) {
      const def = LIB_BY_ID[b.kind];
      let extra = def?.id === "worldwonder" ? " · World Wonder resists manual siege" : "";
      if (b.kind === "keep") extra += ` · vault ${Math.floor(Number(b.stored || 0))} coins`;
      const ownerName = b.owner === 0 && b.kind === "keep" ? "Neutral" : (b.owner === ST.me?.id ? "Your" : `${b.ownerName || "Unknown"}'s`);
      return tipText(`${ownerName} ${def?.name || b.kind}`, `Level ${b.level || 1} · ${Math.ceil(b.hp || 0)}/${b.maxHp || 0} HP${extra}`);
    }
    if (q) return tipText(q.name || "Settler", `Level ${q.level || "?"} · right-click to inspect or walk toward.`);
    if (tradePostAt(c.x, c.z)) return tipText("Trade Post", "Stand beside it to withdraw coins into $CRAFTS or open player offers.");
    const npc = proceduralNpcAt(c.x, c.z);
    if (npc) return tipText(npc.name, `${biomeAt(c.x, c.z).name} · a frontier encounter. More interactions coming soon.`);
    if (ST.tool === "claim") {
      if (claimableHere(c.x, c.z)) return tipText("Claimable tile", "Click it, walk there, and capture it.");
      if (captureTargetHere(c.x, c.z)) return tipText("Claimable frontier", "Stand on this open tile to claim it.");
    }
    if (ST.tool === "use" && b && b.kind === GOLD_MINE_KIND) return tipText("Coin Mint", "Click to walk beside it and exchange purse coins at fixed rate.");
    return tipText(biomeAt(c.x, c.z).name, "Explore farther to find NPC camps, keeps, resources, and places for new World Wonders.");
  }

  function onPointerMove(ev) {
    if (ST.screen !== "playing") return;
    const c = world.cellFromEvent(ev);
    if (!c) { world.hoverMarker.visible = false; world.hideBuildGhost(); hideTip(); return; }
    world.hoverMarker.visible = true; world.hoverMarker.position.x = c.x; world.hoverMarker.position.z = c.z;
    const mat = world.hoverMarker.material;
    if (ST.mode === "place" || (ST.placing === "worldwonder" && ST.tool === "wonder")) {
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
    showTip(tileHoverInfo(c), ev);
  }
  function onPointerDown(ev) {
    if (ev.button === 2) { ev.preventDefault(); return; }
    if (ST.screen !== "playing" || ST.modal || ST.updateRequired) return;
    sfx.resume();
    const hitB = world.buildingFromEvent(ev), c = world.cellFromEvent(ev);
    if (ST.mode === "admin" && ST.tool === "admin" && isAdminPlayer() && c) {
      if (ST.adminTool === "spawnKeep") adminSpawnKeep("here", c);
      else adminDemolishAt(c.x, c.z, hitB?.uid || 0, false);
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
      if (d && d !== want) { sfx.err(); say(ST.tool === "wood" ? "Use the stone pick for rocks." : "Use the wood axe for trees."); return; }
      if (d === want && !world.buildPoolAt(c.x, c.z)) {
        if (cheb(c.x, c.z, world.me.x, world.me.z) <= 1) startChop(c.x, c.z);
        else world.pathToNear(c.x, c.z);
        return;
      }
    }
    if (ST.tool === "none" && c) {
      const d = world.doodadVisible(c.x, c.z);
      if (d && !world.buildPoolAt(c.x, c.z)) {
        sfx.err();
        say(d === "rock" ? "Select the stone pick first (3)." : "Select the wood axe first (2).");
        return;
      }
    }
    if (ST.tool === "spawn" && c) {
      const bad = canCastBombAt(c.x, c.z, false);
      if (bad) { sfx.err(); say(bad); return; }
      plantDestroy(c.x, c.z);
      return;
    }
    if (ST.tool === "siege" && c) {
      const target = world.buildPoolAt(c.x, c.z);
      if (!target || !ST.me || target.owner === ST.me.id) { sfx.err(); say("Siege targets buildings and destroy tools — not settlers. Very civilized chaos."); return; }
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
      if (ST.me && hitB.b.owner === ST.me.id) act("demolish", { uid: hitB.uid }).then((r) => { if (r && r.ok) sfx.demolish(); });
      else { sfx.err(); say("Not your building."); }
      return;
    }
    if (hitB) {
      world.pathToNear(hitB.b.x, hitB.b.z);
      say("Right-click a building, then choose Inspect to manage it.", 1200);
      return;
    }
    if (c) {
      if (tradePostAt(c.x, c.z)) {
        world.pathToNear(c.x, c.z);
      } else if (world.doodadVisible(c.x, c.z)) world.pathToNear(c.x, c.z);
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
  let lastKeyboardStepAt = 0;
  const KEYBOARD_STEP_MIN_MS = 92;
  function clearHeldMoveKeys() { heldMoveKeys.clear(); }
  function keyboardMovementAllowed() {
    if (ST.screen !== "playing" || ST.updateRequired || ST.modal) return false;
    const tag = document.activeElement?.tagName;
    return !(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT");
  }
  function tryKeyboardMove(ev) {
    if (!keyboardMovementAllowed()) return false;
    const v = movementVectorFromKeys(heldMoveKeys);
    if (!v.x && !v.z) return false;
    const nowStep = performance.now();
    if (ev?.repeat && nowStep - lastKeyboardStepAt < KEYBOARD_STEP_MIN_MS) return true;
    lastKeyboardStepAt = nowStep;
    world.tryMoveDelta(v.x, v.z);
    return true;
  }
  function onKeyUp(ev) {
    if (!isMoveKey(ev.key)) return;
    const k = normalizeMoveKey(ev.key);
    if (k) heldMoveKeys.delete(k);
  }
  function onKey(ev) {
    if (ST.screen !== "playing" || ST.updateRequired) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
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
    else if (k === "1") { closeTools(); clearHeldMoveKeys(); paint(); }
    else if (k === "2") doGather("wood");
    else if (k === "3") doGather("stone");
    else if (k === "4" || k === "c" || k === " ") doClaim();
    else if (k === "5" || k === "b") selectBuildTool();
    else if (k === "6") doUseTool();
    else if (k === "7") openOptions();
    else if (k === "e" || k === "t") doUseTool();
    else if (k === "i") { ST.panel = ST.panel === "bank" ? null : "bank"; ST.tradeTab = "bank"; loadBankStatus(); paint(true); }
    else if (k === "r") { ST.modal = ST.modal === "craft" ? null : "craft"; closeTools(); paint(true); }
    else if (ev.key === "Enter") { ST.chatOpen = true; paint(true); setTimeout(() => chatInput.focus(), 0); }
    else if (k === "j") openQuests();
    else if (k === "o") openOptions();
    else if (k === "k") togglePanel("skills");
    else if (k === "h" || k === "?") { ST.modal = ST.modal === "help" ? null : "help"; paint(); }
    else if (ev.key === "Escape") { cancelChop(); ST.modal = null; ST.panel = null; ST.inspect = null; ST.inspectPlayer = null; ST.wonderViewUid = null; ST.mode = "explore"; ST.placing = null; ST.tool = "none"; world.walkQueueClear(); clearHeldMoveKeys(); world.hideBuildGhost(); updateHints(); paint(); }
  }
  worldEl.addEventListener("pointermove", onPointerMove);
  worldEl.addEventListener("pointerleave", () => { hideTip(); world.hoverMarker.visible = false; world.hideBuildGhost(); });
  worldEl.addEventListener("pointerdown", onPointerDown);
  worldEl.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearHeldMoveKeys);

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
  const hasWorkshop = () => !!(ST.me?.buildKinds || []).includes("workshop");
  const hasAlchemy = () => !!(ST.me?.buildKinds || []).includes("alchemy");
  const isAdminPlayer = () => {
    const n = String(ST.me?.name || ST.me?.nickname || ST.me?.handle || "").trim().toLowerCase();
    return n === "second";
  };

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
    return (
      <div className="menu">

        <div className="login-scene">
          <div className="login-glow a" /><div className="login-glow b" /><div className="login-glow c" />
          {LoginIso()}<div className="login-grain" />{LoginMotes()}
        </div>
        <main className="login-stage">
          <section className="login-hero">
            <p className="login-eyebrow"><span className="login-pulse" /> Shared frontier · live on Solana</p>
            <h1 className="login-wordmark">World of <span className="b">SolCrafts</span></h1>
            <p className="login-lede">Stake a claim on one living map, raise a city tile by tile, and hold your border against every other player. <b>Loose tokens you collect belong to the in-game bank and can be withdrawn to $CRAFTS.</b></p>
            <ol className="login-loop"><li><b>01</b> Claim land</li><li><b>02</b> Build & defend</li><li><b>03</b> Collect tokens</li><li><b>04</b> Use the Bank</li></ol>
            <div className="login-cta-row">
              <button className={"login-play" + (!canJoin ? " blocked" : "")} data-click="join-game" disabled={!canJoin}><span>👻</span>{ST.joining ? "Checking…" : !hasPhantom ? "Install Phantom to play" : "Connect Phantom & play"}</button>
              <button className="login-ghostbtn" data-click="spectate-game" disabled={ST.joining}>Spectate read-only</button>
              {ST.auth ? <button className="login-ghostbtn" data-click="forget-session" disabled={ST.joining}>Forget local session</button> : null}
            </div>
            <div className={"login-req" + (!hasPhantom ? " bad" : gate?.enabled ? " ok" : "") }>
              <b>{!hasPhantom ? "Phantom wallet required" : gate?.enabled ? "Token-gated login" : "Wallet login"}</b>
              <span>{!hasPhantom ? "Install or enable Phantom to claim land, build, collect tokens, and play. Spectate remains available without a wallet." : loginGateText(gate)}</span>
              {gate?.tokenMint ? <code>{gate.tokenMint}</code> : null}
              <span className="mini">The server checks your token balance before creating a playable session.</span>
            </div>
            {ST.loginMsg ? <div className="login-msg">{ST.loginMsg}<small>Spectate mode works without Phantom and cannot affect the shared world.</small></div> : null}
            <p className="login-trust">◇ Phantom players must meet the token requirement to claim/build/redeem. Spectators can move around and customize locally. Other players see them as ghosts, and they cannot collect coins or affect the world.</p>
          </section>
          <aside className="login-rail"><div className="login-token">
            <div className="login-wallet"><span className={"login-chip" + (ST.profile.wallet ? "" : " off")}>👻 {ST.profile.wallet ? shortWallet(ST.profile.wallet) : hasPhantom ? "Ready to connect" : "Phantom not found"}</span><span className="login-tag">{gate?.enabled ? "Token required" : "Wallet"}</span></div>
            <div className="login-home"><div className="pad" /><div className="flag" /><div className="roof" /></div>
            <h3>Your home base awaits</h3>
            <p>New settlers get a protected 3×3 camp. Customize your doll after entering so you can see it live on the map.</p>
            <div className="login-stats"><div className="login-stat"><b>1</b><span>shared map</span></div><div className="login-stat"><b>25</b><span>buildings</span></div><div className="login-stat"><b>∞</b><span>frontier</span></div></div>
          </div></aside>
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
    return "Claim connected land, collect loose tokens, and use the Bank to manage deposits and withdrawals.";
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
        short: tileRatio >= 0.96 ? "Build before claiming" : "Near territory cap",
        body: "Build any normal building for more tile capacity. At 24 claimed tiles build Town Hall (+75). At 100 tiles build World Wonder (+250).",
      });
    }
    const resourceRows = [
      ["w", "Wood", "🪵", "Warehouse raises wood/stone/plank/shard storage. Lumber Camp helps create more tree nodes."],
      ["s", "Stone", "🪨", "Warehouse raises wood/stone/plank/shard storage. Quarry helps create more rock nodes."],
      ["p", "Planks", "📦", "Warehouse raises plank storage. Craft planks from wood and protect your supply."],
      ["f", "Food", "🌾", "Granary raises food storage. Farms produce food over time."],
      ["sh", "Shards", "◈", "Warehouse raises shard storage. Stone Keep slowly creates shards later."],
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
  function openOptions() { togglePanel("more"); }
  function openCoinGuide() { openQuests(); }
  function Hud() {
    const m = ST.me;
    if (ST.screen !== "playing" || !m) return <div />;
    const eNow = liveE();
    const hpNow = Math.max(0, Math.ceil(m.hp || 0));
    const gold = Math.floor(m.inv?.g || 0);
    const visiblePlayers = Array.isArray(ST.players) ? ST.players.length : 0;
    const activePlayers = Array.isArray(ST.map?.players) ? ST.map.players.length : visiblePlayers;
    const initial = String(m.name || "?").slice(0, 1) || "?";
    const limitRows = limitAdviceRows(m);
    const hint = ST.channel ? (ST.channel.kind === "home" ? "Casting return to flag — stand still" : ST.channel.kind === "redeem" ? "Withdrawing at trade post — hold your nerve" : ST.channel.kind === "tree" ? "Chopping wood — stay close until the logs drop" : "Mining stone — stay close until the chunks drop")
      : ST.tool === "spawn" ? "6 — choose a crafted tool · yellow tiles are valid deploy spots"
      : ST.mode === "place" ? `5 — place ${LIB_BY_ID[ST.placing]?.name || "building"} · green tile only`
      : ST.mode === "build" ? "5 — choose a building · scroll sideways"
      : ST.tool === "wood" ? "2 — trees are highlighted · drops become pickups"
      : ST.tool === "stone" ? "3 — rocks are highlighted · drops become pickups"
      : ST.tool === "claim" ? "4 — highlighted tiles can be captured"
      : ST.tool === "siege" ? "6 — siege enemy buildings and destroy tools"
      : ST.tool === "use" ? "6 — interact with nearby mines, buildings, offers, and elixirs"
      : ST.near.i ? `6 — ${ST.near.i.label}` : "Goal: claim territory · collect taxed coins · build a Coin Mint to redeem";
    return (
      <div className="scv-hud">
        <div className="scv-top">
          <div className="scv-av"><b>{initial}</b><span className="scv-lv">{m.level || 1}</span></div>
          <div className="scv-id">
            <div className="scv-name">{m.name || "Settler"}</div>
            <div className="scv-sub"><span className="scv-gold">🪙 {gold}</span><span className="scv-gold">🔬 {Math.floor(m.inv?.sc || 0)}/{m.scienceCap || 0}</span><small>· {m.territory || 0}/{m.tileCap || "?"} tiles · {m.built || 0} builds · {visiblePlayers}/{activePlayers} players visible</small></div>
          </div>
        </div>
        <div className="scv-meters">
          <div className="scv-meter" data-tip-title="Energy" data-tip-body={`Current energy ${Math.floor(eNow)} / ${m.maxE}. Claiming, moving, building, chopping, and mining spend energy; it refills over time.`}><span className="ic">⚡</span><div className="scv-track e"><i id="sc-e-fill" style={{ width: `${(100 * eNow / Math.max(1, m.maxE)).toFixed(1)}%` }} /></div><span className="scv-val"><span id="sc-e-now">{Math.floor(eNow)}</span> / {m.maxE}</span></div>
          <div className="scv-meter" data-tip-title="Health" data-tip-body={`Current health ${hpNow} / ${MAX_HP}. Siege tools target territory and structures; keep your city defended.`}><span className="ic">♥</span><div className="scv-track hp"><i id="sc-hp-fill" style={{ width: `${(100 * hpNow / MAX_HP).toFixed(1)}%` }} /></div><span className="scv-val"><span id="sc-hp-now">{hpNow}</span> / {MAX_HP}</span></div>
        </div>
        <div className="scv-res">
          <div className="scv-pill" aria-label={`Wood storage cap ${m.storageCap?.w || 250}`} data-tip-title="Wood" data-tip-body={`You have ${m.inv?.w || 0} wood. Storage cap: ${m.storageCap?.w || 250}. Build Warehouses to raise wood/stone/plank/shard caps.`}><span className="pi">🪵</span><b>{m.inv?.w || 0}</b></div>
          <div className="scv-pill" aria-label={`Stone storage cap ${m.storageCap?.s || 250}`} data-tip-title="Stone" data-tip-body={`You have ${m.inv?.s || 0} stone. Storage cap: ${m.storageCap?.s || 250}. Mine rocks or use Quarry buildings for more.`}><span className="pi">🪨</span><b>{m.inv?.s || 0}</b></div>
          <div className="scv-pill" aria-label={`Food cap ${m.storageCap?.f || 250}`} data-tip-title="Food" data-tip-body={`You have ${m.inv?.f || 0} food. Food cap: ${m.storageCap?.f || 250}. Farms produce food; Granaries raise food capacity.`}><span className="pi">🌾</span><b>{m.inv?.f || 0}</b></div>
          <div className="scv-pill" aria-label={`Shard cap ${m.storageCap?.sh || 250}`} data-tip-title="Shards" data-tip-body={`You have ${m.inv?.sh || 0} shards. Storage cap: ${m.storageCap?.sh || 250}. Shards are used for advanced buildings and deployed tools.`}><span className="pi">◈</span><b>{m.inv?.sh || 0}</b></div>
        </div>
        <div className="scv-cap" data-tip-title="Tile and resource limits" data-tip-body={limitAdviceSummary(m)}><b>Limits</b> Tiles {m.territory || 0}/{m.tileCap || "?"} · build Warehouses/Granaries for storage; Town Hall/World Wonder for territory.</div>
        {limitRows.length ? <div className="scv-limit-row">
          {limitRows.map((r) => <div className={`scv-limit-pill ${r.cls || "warn"}`} data-tip-title={r.title} data-tip-body={r.body}><span>{r.glyph}</span><b>{r.short}</b></div>)}
        </div> : null}
        <div className="scv-xp" aria-label={`XP ${m.xp || 0} / ${xpForLevel(m.level || 1)}`} data-tip-title="Level progress" data-tip-body={`XP ${m.xp || 0} / ${xpForLevel(m.level || 1)}. Gathering, claiming, building, crafting, and guide rewards all add XP.`}><i style={{ width: `${Math.min(100, 100 * ((m.xp || 0) / Math.max(1, xpForLevel(m.level || 1)))).toFixed(0)}%` }} /></div>
        <div className="scv-tabs">
          <button className={"scv-tab" + (ST.panel === "char" ? " on" : "")} data-click="toggle-panel" data-panel="char" data-guide-target="char" data-tip-title="Character" data-tip-body="Customize your settler while staying in the world."><UiIcon name="character" fallback="C" /><span>Character</span></button>
          <button className={"scv-tab" + (ST.panel === "quests" ? " on" : "")} data-click="toggle-panel" data-panel="quests" data-guide-target="quests" data-tip-title="Guide" data-tip-body="Guide cards, skills, and claimable rewards."><UiIcon name="quests" fallback="G" /><span>Guide</span></button>
          <button className={"scv-tab" + (ST.panel === "skills" ? " on" : "")} data-click="toggle-panel" data-panel="skills" data-tip-title="Achievements" data-tip-body="Skill tiers and progress."><UiIcon name="skills" fallback="A" /><span>Achievements</span></button>
          <button className={"scv-tab" + (ST.panel === "more" ? " on" : "")} data-click="open-more" data-panel="more" data-tip-title="More" data-tip-body="Bank, craft, siege, wonders, map, settings, and help."><UiIcon name="settings" fallback="☰" /><span>More</span></button>
        </div>
        <div className="scv-hint"><b>{hint.split(" — ")[0]}</b>{hint.includes(" — ") ? " — " + hint.split(" — ").slice(1).join(" — ") : hint}</div>
        {m.spectator ? <div className="scv-hint"><b>Spectator</b> — ghost view; read-only and no coin pickups</div> : null}
      </div>
    );
  }

  function TopActions() {
    if (ST.screen !== "playing") return <div />;
    const muted = !!(ST.uiMuted && ST.musicMuted);
    return <div>
      <div className="chrome-actions">
        <button className="chrome-btn zoom-btn" aria-label="World map" data-tip-title="World map" data-tip-body="Open the lightweight whole-known-map overlay. Admin can jump from there; normal players use it for overview." data-click="open-world-map">🗺</button>
        <button className="chrome-btn zoom-btn" aria-label="Zoom out" data-tip-title="Zoom out" data-tip-body="Zoom out a little. For whole-map overview use the map button/minimap." data-click="camera-zoom-out">−</button>
        <button className="chrome-btn zoom-btn" aria-label="Zoom in" data-tip-title="Zoom in" data-tip-body="Move the camera closer. Mouse wheel up or + also zooms in." data-click="camera-zoom-in">＋</button>
        <button className={"chrome-btn" + (ST.panel === "settings" ? " on" : "")} aria-label="Settings" data-tip-title="Settings" data-tip-body="Open sound, visual, tutorial reset, interface/menu scale, and camera zoom controls." data-click="toggle-panel" data-panel="settings"><UiIcon name="settings" fallback="⚙" /></button>
        <button className={"chrome-btn" + (muted ? " muted" : "")} aria-label={muted ? "Sound muted" : "Sound on"} data-tip-title={muted ? "Sound muted" : "Sound on"} data-tip-body="Click to toggle game music and UI sound." data-click="toggle-ui-sound"><UiIcon name="sound" fallback="♪" /></button>
        <button className="chrome-btn" aria-label="Logout" data-tip-title="Logout" data-tip-body="Leave this local session and return to the login screen." data-click="forget-session"><UiIcon name="logout" fallback="↩" /></button>
      </div>

    </div>;
  }


  const BUILDABLES = LIBRARY.filter((b) => !["bomb", "barbcamp", "wall", "gate", "keep"].includes(b.id));
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
    if (b.id === "road") return `Road · walkable city path · travelling on roads and inside Wonder districts spends no energy`;
    if (b.id === "cottage") return `House · expands tile capacity so your borders can grow`;
    if (b.id === "warehouse") return `Warehouse · expands storage for long frontier builds`;
    if (b.id === "academy") return `Academy · passively generates 🔬 science for bombs and inventions`;
    if (b.id === "workshop") return `Workshop · crafts bombs using materials + Academy science`;
    if (b.id === "alchemy") return `Alchemy Shop · brews travel and defense elixirs`;
    if (b.id === "worldwonder") return `World Wonder · prompt-built coin monument and teleport point`;
    if (b.id === GOLD_MINE_KIND) return `Coin Mint · redeem purse coins nearby · upgrades boost owned-territory coin and tax income`;
    if (b.id === "lumber") return `Lumber Camp · replants trees · upgrades boost wood from every tree on your territory`;
    if (b.id === "quarry") return `Quarry · spawns rocks · upgrades boost stone from every rock on your territory`;
    const parts = [];
    if (b.effect) parts.push(b.effect);
    if (b.storageBonus) parts.push(`+${b.storageBonus} storage`);
    if (b.foodStorageBonus) parts.push(`+${b.foodStorageBonus} food cap`);
    if (b.tileCapBonus) parts.push(`+${b.tileCapBonus} tile cap`);
    if (b.protect) parts.push("Counters destroy tools");
    return parts.join(" · ") || (b.decor ? "Decorative city detail" : "City infrastructure");
  }
  function buildingStatsLine(b) {
    const cost = b?.id === "worldwonder" ? `${WORLD_WONDER_GOLD_COST}🪙` : (costStr(b.cost) || "Free");
    return `Cost: ${cost} · HP: ${b.hp || 220} · ${padNameForDef(b)} · ${buildingRoleLine(b)}`;
  }
  function missingCostLine(cost, m = ST.me) {
    const miss = Object.entries(cost || {}).filter(([res, amt]) => (res === "e" ? liveE() : (m?.inv?.[res] || 0)) < amt);
    if (!miss.length) return "";
    return "Need " + miss.map(([res, amt]) => `${Math.max(0, Math.ceil(amt - (res === "e" ? liveE() : (m?.inv?.[res] || 0))))}${COSTI[res] || res} more`).join(", ");
  }
  function buildingUnavailableReason(id) {
    const b = LIB_BY_ID[id];
    const m = ST.me;
    if (!b || !m) return "No settler loaded.";
    if ((m.territory || 0) < (b.unlock || 0)) return `${b.name} unlocks at ${b.unlock} claimed tiles. You have ${m.territory || 0}.`;
    if (id === "worldwonder" && (m?.inv?.g || 0) < WORLD_WONDER_GOLD_COST) return `World Wonder needs ${WORLD_WONDER_GOLD_COST}🪙. Collect territory coins or breach neutral Keeps.`;
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
      const firstNormal = BUILDABLES.find((b) => b.id !== "worldwonder")?.id || BUILDABLES[0]?.id || null;
      ST.mode = "build"; ST.placing = ST.placing && ST.placing !== "worldwonder" ? ST.placing : firstNormal; ST.tool = "build";
    }
    updateHints(); paint(); syncBuildScrollSoon();
  }
  function selectWonderTool() {
    if (ST.mode === "wonder" || ST.tool === "wonder") { ST.wonderMsg = ""; closeTools(); }
    else openWonderPlanner("Describe a World Wonder, generate the AI plan, then place its foundation.");
  }
  function selectBuilding(id) {
    const reason = buildingUnavailableReason(id);
    if (reason) { sfx.err(); say(reason, 3200); return; }
    if (id === "worldwonder") {
      openWonderPlanner("Type one Wonder prompt, choose size/style if needed, then click a valid map tile. No separate plan/place step.");
      return;
    }
    ST.placing = id; ST.mode = "place"; ST.tool = "build";
    const def = LIB_BY_ID[id];
    if (def) say(`${def.name} selected. ${padRequirementLine(def)} Construction: about ${Math.round(normalBuildMsClient(def) / 1000)}s.`, 4200);
    updateHints(); paint(); syncBuildScrollSoon();
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

  function togglePanel(name) {
    if (name === "inv" || name === "inventory") name = "bank";
    const next = ST.panel === name ? null : name;
    ST.panel = next;
    ST.modal = null;
    closeTools();
    if (next) { markGuidePanelVisited(next); advanceWalkthroughPanel(next); }
    paint(true);
  }
  function openCharacter() { togglePanel("char"); }
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
  function openBankPanel() { ST.tradeTab = "bank"; togglePanel("bank"); loadBankStatus(); }
  function openTrade() { openBankPanel(); }
  function doUseTool() {
    if (ST.channel?.kind === "home") return;
    if (ST.tool !== "use") {
      ST.tool = "use"; ST.mode = "explore"; ST.placing = null; updateHints(); say("Use selected — choose Return Scroll, a crafted item, or click a building.", 1800); paint(); syncBuildScrollSoon(); return;
    }
    if (ST.near.i) return doInteract();
    startHomeCast();
  }
  function doAttackTool() {
    if (ST.tool === "siege") return closeTools(), paint();
    ST.tool = "siege"; ST.mode = "explore"; ST.placing = null; updateHints(); say("Siege selected — click an enemy building or destroy tool. Cities are the target, not settlers.", 1800); paint();
  }
  function plantDestroy(x = world.me.x, z = world.me.z) {
    const spec = destroySpec();
    const bad = canCastBombAt(x, z, true);
    if (bad) { sfx.err(); say(bad); return; }
    if (craftedToolCount(spec.id) <= 0) { sfx.err(); say(`Craft a ${spec.name} first.`); return; }
    act("spawnBomb", { variant: spec.id, x, z }).then((r) => { if (r && r.ok) { sfx.raid(); world.shockwave(x, z, 0xffd76e); updateHints(); paint(true); } });
  }
  function BottomBar() {
    if (ST.screen !== "playing") return <div />;
    const m = ST.me;
    const action = (num, ico, lbl, run, opts = {}) => {
      const info = opts.info || `${num}: ${lbl}`;
      return (
        <button className={"action-slot" + (opts.primary ? " primary" : "") + (opts.on ? " on" : "") + (opts.danger ? " danger" : "")} disabled={!!opts.disabled} aria-label={info} data-tip-title={`${num} · ${lbl}`} data-tip-body={info} data-click={run}>
          <span className="num">{num}</span><span className="ico"><UiIcon name={String(lbl).toLowerCase()} fallback={ico} /></span><span className="lbl">{lbl}</span>{opts.cd ? <span className="cd" style={`--cd:${opts.cd}%`} /> : null}
        </button>
      );
    };
    const admin = isAdminPlayer();
    const ribbonMode = ribbonModeForState({ mode: ST.mode, tool: ST.tool, placing: ST.placing });
    const adminOpen = admin && ribbonMode === "admin";
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
    return (
      <div className="action-stack">
        {ribbon}
        <div className="action-bar">
          {(() => {
            const active = actionBarActive({ mode: ST.mode, tool: ST.tool, panel: ST.panel });
            return CORE_ACTIONS.map((a) => action(a.key, a.icon, a.label, a.click, {
              primary: a.click === "explore-mode",
              on: !!active[a.click],
              info: a.help,
            }));
          })()}
          {admin ? action(8, "⚙", "Admin", "admin-toggle", { danger: true, on: adminOpen, info: "Admin world ops: demolish objects, clear broken cells, spawn neutral Keeps, and open world map jump." }) : null}
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
      <h2>★ World Wonder Planner</h2>
      <p className="tiny">No browser popups. Pick the name, prompt, footprint, layout mode, and color scheme here. Coins spend only after the server validates the AI recipe and open space.</p>
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
            <br/><b>Cost:</b> {WORLD_WONDER_GOLD_COST}🪙, spent only when founding succeeds. You have {m.inv?.g || 0}🪙.
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
          <div className="tiny"><b>Flow:</b> close this and click the map. The server generates the AI design, charges coins, places the foundation, and starts construction in one step.</div>
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
    return (
      <div className="modal">
        <h2>⌂ Build</h2>
        <p className="tiny">Stone claims land. Wood builds structures. Houses expand borders, Warehouses expand storage, Academies create science, Workshops craft bombs, and coins fund unique AI World Wonders.</p>
        <div className="recipe-req">Tiles: {m?.territory || 0}/{m?.tileCap || "?"}. Claiming costs 2🪨. Houses, Town Hall, and World Wonders expand capacity.</div>
        {wonders.length ? <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-title">World Wonder scrolls</div>
          <div className="tiny">Teleport between your permanent Wonders from here.</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {wonders.map((w) => <button className="btn" data-click="wonder-teleport" data-uid={w.uid}>Teleport · {w.name || `Wonder ${w.x},${w.z}`}</button>)}
          </div>
        </div> : null}
        <div className="grid">
          {([ADMIN_KEEP_BUILDING, ...BUILDABLES]).map((b) => {
            const isWonder = b.id === "worldwonder";
            const isAdminKeep = b.id === "admin_keep";
            const locked = !isWonder && !isAdminKeep && (m?.territory || 0) < (b.unlock || 0);
            const miss = (isWonder || isAdminKeep) ? [] : Object.entries(b.cost || {}).filter(([res, amt]) => (res === "e" ? liveE() : (m?.inv?.[res] || 0)) < amt);
            const needsGold = isWonder && (m?.inv?.g || 0) < WORLD_WONDER_GOLD_COST;
            const disabled = locked || miss.length > 0 || needsGold;
            const costLabel = isAdminKeep ? "admin" : isWonder ? `${WORLD_WONDER_GOLD_COST}🪙` : (costStr(b.cost) || "Free");
            return (
              <div className={"card" + (locked ? " locked" : "") }>
                <div className="row" style={{ justifyContent: "space-between" }}><span className="glyph">{b.glyph}</span><span className="cost">{costLabel}</span></div>
                <div className="card-title">{b.name}</div>
                <div className="tiny">{b.blurb || buildingRoleLine(b)}</div>
                <span className="usetag">{isAdminKeep ? "Spawn neutral Keep" : buildingRoleLine(b)}</span>
                <div className="tiny">HP {b.hp || 220}{isAdminKeep ? " · event target" : ` · ${padNameForDef(b)} · ${isWonder ? Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000) : Math.round(normalBuildMsClient(b) / 1000)}s construction`}</div>
                {isAdminKeep ? <div className="space-req">Creates a neutral coin Keep at your current tile. Server allows this only for nickname second.</div> : <div className="space-req">{padRequirementLine(b)}</div>}
                {isWonder ? <div className="space-req wonder-quick-plan">
                  <div className="recipe-req"><b>World Wonder:</b> one prompt → real AI plan → visible foundation → construction progress. No modal.</div>
                  <input className="wonder-prompt-line" maxlength="180" placeholder="Describe the landmark: school, dish, observatory, market..." value={ST.wonderPrompt || ""} data-input="wonder-prompt" />
                  <div className="tiny">Auto name: <b>{currentWonderNameFallback()}</b> · Cost {WORLD_WONDER_GOLD_COST}🪙 · Plan {WONDER_AI_TIME_HINT} · Build ~{Math.round(wonderBuildMsClient(currentWonderSize(), currentWonderMode()) / 1000)}s</div>
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
                {locked ? <div className="recipe-req">Unlocks at {b.unlock} claimed tiles</div> : null}
                {miss.length ? <div className="recipe-req">{missingCostLine(b.cost, m)}</div> : null}
                {needsGold ? <div className="recipe-req">Need {WORLD_WONDER_GOLD_COST}🪙</div> : null}
                {isAdminKeep ? <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <button className="btn primary" data-click="admin-spawn-keep" data-mode="here">Spawn here</button>
                  <button className="btn" data-click="admin-spawn-keep" data-mode="ring">4 around me</button>
                  <button className="btn" data-click="admin-spawn-keep" data-mode="line">3 east</button>
                </div> : <button className="btn primary" disabled={disabled || (isWonder && (ST.wonderBusy || ST.wonderPlacing))} data-click="place-building" data-id={b.id}>
                  {locked ? "Locked" : needsGold ? "Need coins" : miss.length ? "Missing resources" : isWonder ? (ST.wonderPlacing ? "Founding…" : ST.wonderBusy ? "Generating…" : ST.wonderRecipe ? "Place planned Wonder" : "Plan / place Wonder") : "Place on click"}
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
    const m = ST.me;
    return (
      <div className="modal">
        <h2>⚒ Crafting</h2>
        <p className="tiny">Crafting spends 🔬 science only. Deploy crafted tools later with action 6.</p>
        <h3>Destroy tools</h3>
        <div className="grid">
          {DESTROY_TOOLS.map((b) => {
            const miss = Object.entries(b.cost || {}).filter(([res, amt]) => (res === "e" ? liveE() : (m?.inv?.[res] || 0)) < amt);
            return (
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}><span className="glyph">{b.glyph}</span><span className="cost">{costStr(b.cost)}</span></div>
                <div className="card-title">{b.name}</div>
                <div className="tiny">{b.blurb}</div>
                <span className="usetag">Target: {(b as any).target || "territory"}</span>
                <span className="usetag">Owned: {craftedToolCount(b.id)} · Fuse {Math.round((b.fuseMs || 0) / 1000)}s</span>
                <span className="usetag">Science-only craft</span>
                <button className="btn primary" disabled={miss.length > 0} data-click="make-bomb" data-id={b.id}>
                  {miss.length ? "Need " + miss.map(([r]) => COSTI[r]).join(" ") : "Craft"}
                </button>
              </div>
            );
          })}
        </div>
        <h3>Gear & supplies</h3>
        <div className="grid">
          {RECIPES.map((r) => {
            const miss = Object.entries(r.cost || {}).filter(([res, amt]) => (res === "e" ? liveE() : (m?.inv?.[res] || 0)) < amt);
            const out = r.out?.t === "gear" ? GEAR_BY_ID[r.out.id] : null;
            return (
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between" }}><span className="glyph">{r.glyph}</span><span className="cost">{costStr(r.cost)}</span></div>
                <div className="card-title">{r.name}</div>
                <div className="tiny">{r.blurb}</div>
                {out ? <span className="usetag">{out.atk ? `💥+${out.atk} ` : ""}{out.def ? `🛡+${out.def} ` : ""}{out.spd ? `👟+${out.spd}` : ""}</span> : null}
                <span className="usetag">Science-only craft</span>
                <button className="btn primary" disabled={miss.length > 0} data-click="craft-recipe" data-id={r.id}>
                  {miss.length ? "Need " + miss.map(([res]) => COSTI[res]).join(" ") : "Craft"}
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
                  data-click="learn-skill" data-id={s.id}>{maxed ? "Maxed" : "Level up (1★)"}</button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  function WorldMapModal() {
    setTimeout(() => {
      const cv = document.getElementById("sc-worldmap-canvas");
      if (cv) drawKnownWorldMap(cv, true);
    }, 0);
    const admin = isAdminPlayer();
    const players = Array.isArray(ST.map?.players) ? ST.map.players.length : 0;
    const tiles = Array.isArray(ST.map?.tiles) ? ST.map.tiles.length : 0;
    const buildings = Array.isArray(ST.map?.buildings) ? ST.map.buildings.length : 0;
    return <div className="modal" style={{ width: "min(1040px,96vw)", maxHeight: "92vh", overflow: "auto" }}>
      <h2>World Map</h2>
      <p className="tiny">Lightweight overview from the minimap data. It does not render the whole 3D world, so movement stays fast.</p><div className="worldmap-road-note">Wonder districts are outlined; tan road cells show settlement links to nearby Wonders.</div>
      <div className="worldmap-legend">
        <span><i className="worldmap-dot" style={{ background: "#fff" }} />you</span>
        <span><i className="worldmap-dot" style={{ background: "#f29c72" }} />players</span>
        <span><i className="worldmap-dot" style={{ background: "#9945ff" }} />wonders</span>
        <span><i className="worldmap-dot" style={{ background: "#ffd76e" }} />coins</span>
        <span>{tiles} tiles · {buildings} buildings · {players} player markers</span>
      </div>
      <canvas id="sc-worldmap-canvas" className="worldmap-canvas" width="1200" height="760" data-click="worldmap-click" />
      <p className="worldmap-help">{admin ? <span><b>Admin:</b> click any open map point to teleport there for debugging.</span> : <span><b>Player:</b> click nearby points to walk. Long-range teleport stays limited to Return Scroll and World Wonder teleports.</span>}</p>
      <div className="row" style={{ marginTop: 12 }}><button className="btn" data-click="modal-close">Close</button><button className="btn primary" data-click="camera-zoom-reset">Reset camera</button></div>
    </div>;
  }

  function PlayerModal() {
    const q = ST.inspectPlayer;
    if (!q) { ST.modal = null; return <div />; }
    const siege = gearStat(q.equip || {}, "atk");
    const def = gearStat(q.equip || {}, "def");
    const adj = ST.me && cheb(q.x, q.z, world.me.x, world.me.z) <= 2;
    return (
      <div className="modal" style={{ width: "min(440px,94vw)" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 16, height: 16, borderRadius: 99, background: hex(q.body), display: "inline-block", border: "2px solid #fff" }} />
          {q.name} <span className="lvlchip">Lv {q.level || 1}</span>
        </h2>
        <div className="row" style={{ margin: "8px 0" }}>
          <span className="stat">♥ {Math.ceil(q.hp)}/{MAX_HP}</span>
          <span className="stat">💥 Siege {siege}</span>
        </div>
        <h3>Worn gear</h3>
        {SLOTS.map((s) => { const id = q.equip?.[s]; const g = id ? GEAR_BY_ID[id] : null; return <div className="slot"><span><b>{SLOT_LABEL[s]}</b> — {g ? `${g.glyph} ${g.name}` : <span className="tiny">—</span>}</span></div>; })}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" data-click="player-walk">Walk toward</button>
          <button className="btn" data-click="player-close">Close</button>
        </div>
      </div>
    );
  }

  function TradeModal() {
    const m = ST.me;
    return (
      <div className="modal">
        <h2>⛏ Trade Post</h2>
        <div className="tabs">
          <button className={"btn" + (ST.tradeTab === "market" ? " primary" : "")} data-click="trade-tab" data-tab="market">Info</button>
          <button className={"btn" + (ST.tradeTab === "players" ? " primary" : "")} data-click="trade-tab" data-tab="players">Player offers</button>
          <button className={"btn" + (ST.tradeTab === "bank" ? " primary" : "")} data-click="trade-tab" data-tab="bank">Exchange</button>
        </div>
        {ST.tradeTab === "market" ? (
          <div className="grid">
            <div className="card"><div className="card-title">Player-priced economy</div><div className="tiny">No NPC resource prices. Players trade resources directly; Coin Mints redeem purse coins into $CRAFTS at a fixed launch rate.</div></div>
            <div className="card"><div className="card-title">Territory coin economy</div><div className="tiny">Coins spawn on claimed empty tiles. Anyone can pick them up, and foreign pickups pay tax to the tile owner.</div></div>
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
              <button className="btn primary" data-click="post-offer">Post</button>
            </div>
            <h3>Open offers</h3>
            {ST.offers.length === 0 ? <p className="tiny">No open offers — be the first.</p> : null}
            {ST.offers.map((o) => (
              <div className="slot">
                <span><b>{o.byName}</b> gives {o.gAmt}{COSTI[o.gRes]} for {o.wAmt}{COSTI[o.wRes]}</span>
                {o.byId === m.id
                  ? <button className="btn" data-click="cancel-offer" data-id={o.id}>Cancel</button>
                  : <button className="btn primary" disabled={(m.inv[o.wRes] || 0) < o.wAmt} data-click="accept-offer" data-id={o.id}>Accept</button>}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid">
            <div className="card">
              <div className="card-title">$CRAFTS exchange</div>
              <div className="tiny">The old bank flow is now a single exchange widget: copy your personal deposit address, scan deposits, or withdraw coins to the wallet that signed in.</div>
              <span className={"wallet-chip" + (m.wallet ? "" : " off")}>👻 {m.wallet ? shortWallet(m.wallet) : "Wallet not connected"}</span>
              <button className="btn primary" disabled={!m.wallet} data-click="open-bank">Open Exchange</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function customizeInspect(change) {
    const b = world.buildPool.get(ST.inspect);
    if (b) {
      if (Object.prototype.hasOwnProperty.call(change, "cl")) { b.cl = change.cl == null ? null : change.cl; ST.inspectDraft = { ...(ST.inspectDraft || {}), uid: ST.inspect, cl: b.cl, at: Date.now() }; }
      if (Object.prototype.hasOwnProperty.call(change, "nm")) { b.nm = change.nm || null; ST.inspectDraft = { ...(ST.inspectDraft || {}), uid: ST.inspect, nm: b.nm, at: Date.now() }; }
      b.sig = String(b.sig || "") + "|local:" + Date.now();
      world.rebuildBuilding?.(ST.inspect);
    }
    paint(true);
    act("customize", { uid: ST.inspect, ...change }).then((r) => { if (!r || !r.ok) return; pollSoon(); });
  }
  function setInspectBuildingPreset(id) {
    const preset = buildingPresetById(id);
    if (!preset) return;
    customizeInspect({ cl: preset.primary || null });
    say(`${preset.name} building colors applied.`, 900);
  }

  function closeInspectPanel() {
    ST.inspect = null;
    ST.inspectDraft = null;
    if (ST.panel === "inspect") ST.panel = null;
    if (ST.modal === "inspect") ST.modal = null;
    paint(true);
  }

  function equipFromDrag(slot) {
    const m = ST.me;
    const idx = ST.drag;
    ST.drag = null;
    if (!m || idx == null) return;
    const item = (m.pack || [])[idx];
    if (!item || item.t !== "gear") { say("Only gear can be equipped."); return; }
    const g = GEAR_BY_ID[item.id];
    if (g && g.slot !== slot) { sfx.err(); say(`${g.name} goes in the ${SLOT_LABEL[g.slot]} slot.`); return; }
    act("equip", { idx }).then((r) => r && r.ok && sfx.equip());
  }

  function readNum(el, key, fallback = 0) {
    const n = Number(el?.dataset?.[key] ?? el?.getAttribute?.(`data-${key}`));
    return Number.isFinite(n) ? n : fallback;
  }
  function readStr(el, key, fallback = "") {
    return String(el?.dataset?.[key] ?? el?.getAttribute?.(`data-${key}`) ?? fallback);
  }
  function copyTextToClipboard(text, label = "Copied") {
    const value = String(text || "").trim();
    if (!value) return say("Nothing to copy.", 900);
    navigator.clipboard?.writeText(value).then(() => say(`${label} copied.`, 1100)).catch(() => say(value, 2200));
  }
  function reloadArtRuntime(withToast = true) {
    loadAtlasRuntimeConfig(true).then(() => {
      for (const [, c] of world.cells) c.owner = -1;
      world.refreshWindow?.(true);
      world.refreshOwnRig?.();
      if (withToast) say("Art reloaded.");
      paint(true);
    });
  }
  function handleDelegatedUiClick(action, el, ev) {
    switch (action) {
      case "join-game": return joinGame();
      case "spectate-game": return spectateGame();
      case "forget-session": return forgetLocalSettler();
      case "toggle-panel": return togglePanel(readStr(el, "panel"));
      case "explore-mode": closeTools(); clearHeldMoveKeys(); ST.panel = null; ST.modal = null; say("Move mode — click the map, use WASD/arrows, or hold two directions for diagonal movement.", 1800); paint(true); return;
      case "open-options":
      case "open-more": return openOptions();
      case "open-bank": advanceWalkthroughAction("bank"); return openBankPanel();
      case "select-wonder": advanceWalkthroughAction("wonder"); return selectWonderTool();
      case "select-craft": return selectCraftTool();
      case "gather-wood": return doGather("wood");
      case "gather-stone": return doGather("stone");
      case "claim": return doClaim();
      case "select-build": advanceWalkthroughAction("build"); return selectBuildTool();
      case "siege-tool": return doAttackTool();
      case "select-spawn-tool": return selectDeployTool();
      case "use-tool": advanceWalkthroughAction("use"); return doUseTool();
      case "select-building": return selectBuilding(readStr(el, "id"));
      case "make-bomb": return act("makeBomb", { variant: readStr(el, "id") }).then((r) => { if (r?.ok) { sfx.equip(); pollSoon(); paint(true); } });
      case "craft-recipe": return act("craft", { recipe: readStr(el, "id") }).then((r) => { if (r?.ok) { sfx.equip(); pollSoon(); paint(true); } });
      case "select-spawn": return selectDeploy(readStr(el, "id"));
      case "home-cast": return startHomeCast();
      case "use-pack-slot": return usePackSlot(readNum(el, "idx"));
      case "place-building": {
        const id = readStr(el, "id");
        if (id === "worldwonder") {
          if (!ST.wonderRecipe) return openWonderPlanner("Generate the AI plan first from the inline build bar. Then place the foundation once.");
          enterWonderPlacement();
          return;
        }
        ST.placing = id; ST.mode = "place"; ST.tool = "build"; ST.modal = null;
        const def = LIB_BY_ID[id];
        if (def) say(`${def.name}: foundation appears instantly, then builds for about ${Math.round(normalBuildMsClient(def) / 1000)}s.`, 2600);
        updateHints(); paint(true); syncBuildScrollSoon(); return;
      }
      case "unequip": return act("unequip", { slot: readStr(el, "slot") }).then((r) => r && r.ok && sfx.equip());
      case "pack-trophy": return say(`${readStr(el, "name", "Trophy")} — a trophy of the frontier.`);
      case "pack-drop": return act("drop", { idx: readNum(el, "idx") });
      case "pack-spawn-select": ST.destroying = readStr(el, "id"); return selectDeployTool();
      case "pack-equip": return act("equip", { idx: readNum(el, "idx") }).then((r) => r && r.ok && sfx.equip());
      case "learn-skill": return act("learn", { skill: readStr(el, "id") });
      case "player-walk": if (ST.inspectPlayer) { const q = ST.inspectPlayer; ST.modal = null; ST.inspectPlayer = null; paint(); world.pathTo(q.x, q.z); } return;
      case "player-close": ST.modal = null; ST.inspectPlayer = null; paint(); return;
      case "trade-tab": ST.tradeTab = readStr(el, "tab", "market"); if (ST.tradeTab === "bank") loadBankStatus(); paint(); return;
      case "post-offer": { const v = (id) => (document.getElementById(id) || {}).value; return act("postOffer", { gRes: v("sc-o-gres"), gAmt: Number(v("sc-o-gamt")), wRes: v("sc-o-wres"), wAmt: Number(v("sc-o-wamt")) }); }
      case "cancel-offer": return act("cancelOffer", { id: readNum(el, "id") });
      case "accept-offer": return act("acceptOffer", { id: readNum(el, "id") }).then((r) => r && r.ok && sfx.coin());
      case "withdraw-safe": return act("withdrawGold", { gold: Number((document.getElementById("sc-withdraw-safe") || {}).value) }).then((r) => r && r.ok && sfx.coin());
      case "redeem-main": return startRedeemCast(Number((document.getElementById("sc-redeem") || {}).value));
      case "inspect-close": return closeInspectPanel();
      case "inspect-rename": return customizeInspect({ nm: (document.getElementById("sc-rename") || {}).value || "" });
      case "inspect-wonder-view": { ST.wonderViewUid = ST.inspect; ST.wonderViewError = ""; ST.modal = "wonder-view"; ST.panel = null; paint(true); mountWonderViewerSoon(); return; }
      case "inspect-use": return useBuildingClient(ST.inspect);
      case "inspect-upgrade": return act("upgrade", { uid: ST.inspect });
      case "inspect-repair": return act("repair", { uid: ST.inspect });
      case "inspect-demolish": return act("demolish", { uid: ST.inspect }).then((r) => { if (r && r.ok) { sfx.demolish(); closeInspectPanel(); } });
      case "inspect-walk-near": { const uid = ST.inspect || ST.wonderViewUid; const b = uid ? world.buildPool.get(uid) : null; closeInspectPanel(); ST.modal = null; ST.wonderViewUid = null; if (b) world.pathToNear(b.x, b.z); return; }
      case "intro-submit": return submitIntroName();
      case "modal-close": ST.modal = null; ST.wonderViewUid = null; ST.wonderViewError = ""; stopWonderViewer(); paint(true); return;
      case "panel-close": ST.panel = null; paint(true); return;
      case "char-sync": world.refreshOwnRig?.(); say("Character synced.", 900); return;
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
      case "wonder-teleport": return startWonderCast(readNum(el, "uid", 0));
      case "reload-atlases-silent": return reloadArtRuntime(false);
      case "reload-art": return reloadArtRuntime(true);
      case "open-character-panel": ST.modal = null; ST.panel = "char"; markGuidePanelVisited("char"); advanceWalkthroughPanel("char"); paint(true); return;
      case "open-help": ST.modal = "help"; paint(true); return;
      case "guide-skip": return skipWalkthrough();
      case "tutorial-restart": return restartWalkthrough();
      case "copy-text": return copyTextToClipboard(readStr(el, "copy"), readStr(el, "label", "Value"));
      case "reload-page": writeAckedClientVersion(ST.updateVersion); return location.reload();
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
      paint(true);
      return;
    }
    if (kind === "wonder-prompt") {
      ST.wonderPrompt = cleanWonderPromptClient(input.value);
      invalidateWonderPlan(ST.wonderPrompt ? `Prompt set. Click a valid map tile to generate and found it. ${wonderFactsLine()}.` : "");
      paint(true);
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
    if (kind === "wonder-name-select") { setWonderName(input.value || ""); return paint(true); }
    if (kind === "wonder-footprint-select") { setWonderFootprint(input.value); return paint(true); }
    if (kind === "wonder-mode-select") { setWonderMode(input.value); return paint(true); }
    if (kind === "wonder-palette-select") { setWonderPalette(input.value); return paint(true); }
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

  let wonderViewerState = null;
  function wonderRecipeForInspect(b) {
    const raw = b?.wonder && typeof b.wonder === "object" ? b.wonder : {};
    const prompt = String(raw.prompt || b?.nm || raw.name || "World Wonder");
    return {
      ...raw,
      name: String(raw.name || b?.nm || prompt || "World Wonder").slice(0, 48),
      prompt,
      footprint: normalizeWonderFootprintClient(raw.footprint || b?.footprint || 5),
      mode: raw.mode || "district",
      paletteId: raw.paletteId || "solar",
      palette: Array.isArray(raw.palette) && raw.palette.length ? raw.palette : ["#f3ead7", "#ffd76e", "#7dcfe8", "#14f195"],
    };
  }
  function stopWonderViewer() {
    if (!wonderViewerState) return;
    try { cancelAnimationFrame(wonderViewerState.raf || 0); } catch {}
    try { wonderViewerState.renderer?.dispose?.(); } catch {}
    try { wonderViewerState.root && (wonderViewerState.root.innerHTML = ""); } catch {}
    wonderViewerState = null;
  }
  function mountWonderViewerSoon() { requestAnimationFrame(mountWonderViewer); }
  function mountWonderViewer() {
    if (ST.modal !== "wonder-view") { stopWonderViewer(); return; }
    const root = document.getElementById("sc-wonder-viewer");
    const b = ST.wonderViewUid ? world.buildPool.get(ST.wonderViewUid) : null;
    if (!root || !b || b.kind !== "worldwonder") { stopWonderViewer(); return; }
    const sig = [b.uid, b.nm || "", b.cl || "", JSON.stringify(b.wonder || {}), b.cdUntil || 0, b.accAt || 0].join("|");
    if (wonderViewerState && wonderViewerState.sig === sig && wonderViewerState.root === root) return;
    stopWonderViewer();
    ST.wonderViewError = "";
    try {
      const w = Math.max(360, root.clientWidth || 760);
      const h = Math.max(320, root.clientHeight || 480);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(w, h);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      root.innerHTML = "";
      root.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 120);
      camera.position.set(6.2, 5.4, 7.4);
      camera.lookAt(0, 1.1, 0);
      scene.add(new THREE.HemisphereLight(0xd8f6ff, 0x1b251e, 1.65));
      const sun = new THREE.DirectionalLight(0xffffff, 2.0);
      sun.position.set(5, 8, 4);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      scene.add(sun);
      const fill = new THREE.DirectionalLight(0x7dcfe8, 0.75);
      fill.position.set(-4, 4, -5);
      scene.add(fill);
      const base = new THREE.Mesh(new THREE.CircleGeometry(5.8, 64), new THREE.MeshStandardMaterial({ color: 0x19231d, roughness: 0.92, metalness: 0.02, transparent: true, opacity: 0.86 }));
      base.rotation.x = -Math.PI / 2;
      base.receiveShadow = true;
      scene.add(base);
      const recipe = wonderRecipeForInspect(b);
      const cs = constructionStateForBuilding(b);
      const progress = cs ? Math.max(0.05, Math.min(1, cs.progress || 0)) : 1;
      const made = makeBuildingGroup("worldwonder", { nm: b.nm, cl: b.cl, plinth: true, wonder: recipe, buildProgress: progress, buildUntil: b.cdUntil });
      const group = made?.group || made || new THREE.Group();
      group.position.set(0, 0.02, 0);
      group.scale.setScalar(0.86);
      scene.add(group);
      const resize = () => {
        if (!root || !renderer.domElement.isConnected) return;
        const nw = Math.max(360, root.clientWidth || w);
        const nh = Math.max(320, root.clientHeight || h);
        renderer.setSize(nw, nh, false);
        camera.aspect = nw / nh; camera.updateProjectionMatrix();
      };
      let lastW = w, lastH = h;
      const animate = () => {
        if (!wonderViewerState || wonderViewerState.sig !== sig || ST.modal !== "wonder-view") return;
        const nw = root.clientWidth || lastW, nh = root.clientHeight || lastH;
        if (Math.abs(nw - lastW) > 2 || Math.abs(nh - lastH) > 2) { lastW = nw; lastH = nh; resize(); }
        group.rotation.y += 0.006;
        renderer.render(scene, camera);
        wonderViewerState.raf = requestAnimationFrame(animate);
      };
      wonderViewerState = { sig, root, renderer, scene, camera, group, raf: 0 };
      animate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || "unknown render error");
      ST.wonderViewError = msg;
      root.innerHTML = "";
      const div = document.createElement("div");
      div.className = "wonder-view-error";
      div.textContent = `Could not render Wonder preview: ${msg}`;
      root.appendChild(div);
    }
  }

  function InspectPanel() {
    const b = (world.buildPool.get(ST.inspect)) || null;
    if (!b || !ST.me) { ST.panel = null; ST.inspect = null; return <div />; }
    const def = LIB_BY_ID[b.kind];
    return <InspectPanelView
      building={b}
      player={ST.me}
      def={def}
      inspectUid={ST.inspect}
      inspectDraft={ST.inspectDraft}
      faceImage={ST.faceImage}
      buildingColorPresets={BUILDING_COLOR_PRESETS}
      construction={constructionStateForBuilding(b)}
      territoryHint={territoryUpgradeHint(b.kind, b.level || 1)}
      estimatedBin={estAcc(b)}
      costStr={costStr}
    />;
  }

  function WonderViewModal() {
    const b = ST.wonderViewUid ? world.buildPool.get(ST.wonderViewUid) : null;
    if (!b || b.kind !== "worldwonder") { ST.modal = null; ST.wonderViewUid = null; return <div />; }
    const recipe = wonderRecipeForInspect(b);
    const cs = constructionStateForBuilding(b);
    const size = normalizeWonderFootprintClient(recipe.footprint || b.footprint || 5);
    const title = recipe.name || b.nm || "World Wonder";
    return <div className="modal wonder-view-modal" data-stop-pointerdown="1">
      <div className="wonder-view-head">
        <div>
          <h2>★ {title}</h2>
          <div className="tiny">3D inspection preview · rotating model · footprint {size}×{size} · {recipe.mode === "single" ? "single landmark" : "district wonder"}</div>
        </div>
        <button className="utility-close" data-click="modal-close">×</button>
      </div>
      <div id="sc-wonder-viewer" className="wonder-view-stage">
        {ST.wonderViewError ? <div className="wonder-view-error">Could not render Wonder preview: {ST.wonderViewError}</div> : <div className="wonder-view-overlay">
          <span className="wonder-view-chip">Loading 3D preview…</span>
        </div>}
      </div>
      <div className="wonder-view-overlay" style={{ position: "static", marginTop: 10 }}>
        <span className="wonder-view-chip">Prompt: {String(recipe.prompt || title).slice(0, 90)}</span>
        <span className="wonder-view-chip">Palette: {recipe.paletteId || "custom"}</span>
        {cs ? <span className="wonder-view-chip">Building {Math.round((cs.progress || 0) * 100)}% · {Math.ceil((cs.left || 0) / 1000)}s left</span> : <span className="wonder-view-chip">Complete preview</span>}
      </div>
      <div className="wonder-view-note">This uses the same in-world renderer, just isolated with a dedicated camera. It helps check whether the AI output actually reads like the prompt before we tune generation further.</div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" data-click="modal-close">Close</button>
        <button className="btn primary" data-click="inspect-walk-near">Walk near</button>
      </div>
    </div>;
  }

  function submitIntroName() {
    const input = document.getElementById("sc-intro-name");
    const name = String(input?.value || "").trim().slice(0, 18);
    if (!name) { sfx.err(); say("Choose a settler name."); return; }
    ST.profile.name = name;
    const randomHue = Math.floor(Math.random() * 360);
    const randomBody = new THREE.Color().setHSL(randomHue / 360, 0.62, 0.58).getHex();
    act("setupProfile", { name, body: randomBody, hat: ST.profile.hat, appearance: ST.characterProfile }).then((r) => {
      if (r && r.ok) {
        ST.needsProfile = false;
        if (ST.me) { ST.me.name = name; ST.me.body = randomBody; ST.me.profileDone = true; }
        world.refreshOwnRig();
        ST.modal = null;
        ST.panel = null;
        maybeStartWalkthrough(true);
        say("Welcome. Click Character first to try your look, then open Quests for the guide.", 3600);
        pollSoon(); paint(true);
      }
    });
  }

  function IntroModal() {
    const m = ST.me;
    return <div className="modal" style={{ width: "min(420px,94vw)" }}>
      <h2>Choose your settler name</h2>
      <p className="tiny">You will start with a random look. Edit your character live from the nearby panel after entering.</p>
      <div className="field"><label>Settler name</label><input id="sc-intro-name" maxLength={18} placeholder="Wanderer" defaultValue={ST.profile.name || (m?.name === "Wanderer" ? "" : m?.name || "")} data-keydown="intro-submit" /></div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn primary" style={{ width: "100%" }} data-click="intro-submit">Enter the frontier</button></div>
    </div>;
  }

  function guideFallbackRows() {
    const oldRows = (ST.me?.quests && ST.me.quests.length ? ST.me.quests : MILESTONES.map((m, i) => ({ id: `q${i + 1}`, text: m.text, enabled: true })));
    const actionRows = oldRows.filter((q) => q.enabled !== false).map((q, i) => ({
      id: q.id || `-${i}`,
      category: i >= 5 ? "economy" : "actions",
      glyph: i >= 5 ? "🪙" : "◇",
      title: q.text,
      text: q.text,
      detail: "Complete this frontier guide step. Update the server package to enable independent action/building reward cards.",
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
      text: b.blurb || b.effect || "City infrastructure",
      detail: `Select Build (5), choose ${b.name}, then place it on owned land. Cost: ${costStr(b.cost) || "free"}.${b.unlock ? ` Unlocks after ${b.unlock} tiles.` : ""}`,
      rewardText: "+XP · +coins",
      done: buildIds.has(b.id),
      claimed: false,
      buildingId: b.id,
    }));
    return [...actionRows, ...buildingRows];
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

  function claimGuideRewardClient(id: string) {
    return act("claimGuideReward", { id }).then((r) => {
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
          {row.done && !row.claimed ? <button className="btn primary" onClick={() => claimGuideRewardClient(row.id)}>Claim</button> : null}
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
        <div className="card"><div className="card-title">Siege rule</div><div className="tiny">Avatars explore and interact. They do not fight. Territory, buildings, vaults, mints, and tools are the targets.</div></div>
      </div>
      <h3>Guide cards</h3>
      <div className="guide-list">{visible.map((row) => <GuideCard key={row.id} row={row} compact={false} />)}</div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn" data-click="modal-close">Close</button><button className="btn primary" data-click="toggle-panel" data-panel="quests">Open Guide</button></div>
    </div>;
  }

  function OptionsModal() {
    return <div className="modal" style={{ width: "min(560px,94vw)" }}>
      <h2>⚙ Options</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
        <div className="card"><div className="card-title">Sound</div><div className="tiny">Music and UI sounds are controlled separately.</div><button className="btn primary" data-click="start-music">Start uploaded music</button><button className="btn" data-click="toggle-music">{ST.musicMuted ? "Turn music on" : "Turn music off"}</button><button className="btn" data-click="toggle-ui-sound">{ST.uiMuted ? "Turn UI sound on" : "Turn UI sound off"}</button></div>
        <div className="card"><div className="card-title">Terrain feel</div><div className="tiny">Tune procedural terrain until the island feels warm and readable.</div>
          <label className="tiny">Warmth <input type="range" min="0" max="1" step="0.05" value={ST.visual.warmth} data-input="visual-warmth" /></label>
          <label className="tiny">Texture detail <input type="range" min="0" max="1" step="0.05" value={ST.visual.texture} data-input="visual-texture" /></label>
          <label className="tiny">Visual quality <select data-input="visual-quality" value={ST.visual.quality || "fast"}><option value="auto">Auto</option><option value="crisp">Crisp</option><option value="balanced">Balanced</option><option value="fast">Fast</option></select></label>
          <label className="tiny">Motion feel <select data-input="motion-feel" value={ST.visual.motion || "classic"}><option value="smooth">Smooth</option><option value="classic">Classic hop</option><option value="low">Low-power</option></select></label>
          <button className="btn" data-click="visual-comfort">Comfort preset</button>
        </div>
        <div className="card"><div className="card-title">Atlas refresh</div><div className="tiny">Reload published atlases for terrain, buildings, UI icons, and character layers.</div><button className="btn" data-click="reload-atlases-silent">Reload atlases</button></div>
        <div className="card"><div className="card-title">Character</div><div className="tiny">Use the character nearby panel to edit your doll live on the map.</div><button className="btn" data-click="open-character-panel">Open character panel</button></div>
        <div className="card"><div className="card-title">Help</div><div className="tiny">Controls and mechanics reference.</div><button className="btn" data-click="open-help">Open help</button></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}><button className="btn" data-click="modal-close">Close</button></div>
    </div>;
  }

  function HelpModal() {
    return (
      <div className="modal" style={{ width: "min(560px,94vw)" }}>
        <h2>How to play</h2>
        <p className="tiny">Use the bottom bar like a city-builder hotbar: craft, gather with separate tools, capture, build, deploy crafted tools, and interact. Movement works in every action mode by clicking the world or using WASD, and each tile costs a tiny bit of energy that refills quickly. Tutorial objectives live in Quests.</p>
        <p><span className="kbd">1</span> craft · <span className="kbd">2</span> wood · <span className="kbd">3</span> stone · <span className="kbd">4</span> capture · <span className="kbd">5</span> build · <span className="kbd">6</span> deploy · <span className="kbd">7</span> use/scroll</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <div className="card"><div className="card-title">Gather</div><div className="tiny">Select Wood or Stone, then click the matching highlighted resource. Drops become pickups on the ground instead of teleporting into your bag.</div></div>
          <div className="card"><div className="card-title">Build</div><div className="tiny">Press 5, scroll the row, read exact cost/purpose, then click a valid owned pad.</div></div>
          <div className="card"><div className="card-title">Coin Economy Goal</div><div className="tiny">Claim more territory to increase coin opportunities, tax visitors on your land, and defend your Coin Mint.</div></div>
          <div className="card"><div className="card-title">Redeem</div><div className="tiny">Your Phantom wallet is the account and payout wallet.</div></div>
        </div>
      </div>
    );
  }


  function UtilityShell({ title, sub, children, className = "" }: any) {
    return <div className={"utility-pop" + (className ? " " + className : "")} data-stop-pointerdown="1">
      <button className="utility-close" data-click="panel-close">×</button>
      <h3>{title}</h3>
      {sub ? <p className="utility-sub">{sub}</p> : null}
      {children}
    </div>;
  }

  function MorePanel() {
    return <UtilityShell className="more-pop" title="More" sub="Secondary features stay here so the primary bar remains focused on move, gather, claim, build, and use.">
      {MORE_MENU_GROUPS.map((group) => <div className="more-group" data-group={group.id}>
        <div className="more-group-head"><b>{group.title}</b><span>{group.text}</span></div>
        <div className="more-grid">
          {group.items.map((item) => {
            const on = item.panel ? ST.panel === item.panel : false;
            return <button className={"more-tile" + (on ? " on" : "")} data-click={item.click} data-panel={item.panel || ""} data-tip-title={item.label} data-tip-body={item.text}>
              <span className="more-glyph">{item.glyph}</span>
              <span className="more-copy"><b>{item.label}</b><small>{item.text}</small></span>
            </button>;
          })}
        </div>
      </div>)}
    </UtilityShell>;
  }

  function CharacterPanel() {
    const cp = ST.characterProfile || loadCharacterProfile();
    const parts = cp.parts || {};
    const partRows = [
      ["head", "Head", "face / species"],
      ["torso", "Body", "outfit shape"],
      ["back", "Back", Number(parts.back || 0) === 0 ? "none" : "item"],
      ["legs", "Feet", "legs / boots"],
    ];
    return <UtilityShell className="character-pop" title="Character" sub="Choose your body parts and colors.">
      <div className="utility-field"><label>Body parts</label>
        <div className="char-part-list">
          {partRows.map(([key, label, hint]) => {
            const v = Math.max(0, Math.min(7, Math.trunc(Number(parts[key] || 0))));
            return <div className="char-part-row">
              <button type="button" className="mini" data-char-part-step="1" data-key={key} data-delta="-1" aria-label={`Previous ${label}`}>−</button>
              <div className="char-part-mid">
                <div><b>{label}</b><span>{hint}</span></div>
                <input type="range" min="0" max="7" value={v} data-input="char-part" data-key={key} aria-label={label} />
              </div>
              <button type="button" className="mini" data-char-part-step="1" data-key={key} data-delta="1" aria-label={`Next ${label}`}>+</button>
              <strong>{v}</strong>
            </div>;
          })}
        </div>
      </div>
      <div className="utility-field"><label>Color combos</label>
        <div className="combo-grid character-combos">
          {CHARACTER_COLOR_PRESETS.map((preset) => {
            const on = characterPresetActive(cp, preset);
            return <button type="button" className={"combo-card" + (on ? " on" : "")} data-char-preset-id={preset.id} aria-pressed={on} aria-label={`${preset.name} colors`} style={{ "--p1": preset.primaryCloth, "--p2": preset.secondaryCloth, "--choice-glow": rgba(preset.secondaryCloth, 0.28) }}>
              {on ? <span className="combo-check">✓</span> : null}
              <b>{preset.name}</b>
              <small className="combo-look">Colors</small>
              <span className="combo-dots"><i className="combo-dot" style={{ background: preset.skin }} /><i className="combo-dot" style={{ background: preset.primaryCloth }} /><i className="combo-dot" style={{ background: preset.secondaryCloth }} /><i className="combo-dot" style={{ background: preset.leather }} /><i className="combo-dot" style={{ background: preset.metal }} /></span>
            </button>;
          })}
        </div>
      </div>
    </UtilityShell>;
  }

  function QuestPanel() {
    const visible = guideVisibleRows();
    return <UtilityShell className="quest-pop" title="Guide" sub="Independent guide cards for every core action and building. Complete any card, then claim its reward.">
      <GuideSummaryView />
      <GuideTabs />
      <div className="guide-list">
        {visible.length ? visible.map((row) => <GuideCard key={row.id} row={row} />) : <div className="tiny">No cards in this section yet.</div>}
      </div>
    </UtilityShell>;
  }

  function InventoryPanel() {
    const m = ST.me;
    if (!m) return <div />;
    const pack = m.pack || [];
    return <UtilityShell title="Inventory" sub="Resources, gear, tools, and usable items. Use elixirs from the 7 Use ribbon.">
      <div className="utility-row">
        {RES_KEYS.map((r) => <span className="stat" aria-label={RES_NAMES[r]}>{COSTI[r]} {m.inv?.[r] || 0}</span>)}
      </div>
      <div className="mini-slots">
        {Array.from({ length: PACK_SIZE }, (_, i) => {
          const item = pack[i];
          if (!item) return <button className="mini-slot empty">·</button>;
          if (item.t === "bomb") { const b = DESTROY_BY_ID[item.id]; return <button className="mini-slot" aria-label={b?.blurb || "Destroy tool"}>{b?.glyph || "✹"}<small>{b?.name || item.id}</small></button>; }
          if (item.t === "use") { const u = USE_ITEMS[item.id]; return <button className="mini-slot" aria-label={u?.blurb || "Use item"}>{u?.glyph || "✦"}<small>{u?.name || item.id}</small></button>; }
          const g = GEAR_BY_ID[item.id];
          return <button className="mini-slot" data-click="pack-equip" data-idx={i} aria-label="Tap to equip">{g?.glyph || "◇"}<small>{g?.name || item.id}</small></button>;
        })}
      </div>
    </UtilityShell>;
  }

  function SkillsPanel() {
    const m = ST.me;
    if (!m) return <div />;
    const xp = m.skillXp || {};
    return <UtilityShell title="Skills" sub="Skills train automatically from play. Chop and mine for Gathering/Efficiency, build for Masonry, claim for Vigor, siege/craft tools for Siegecraft.">
      <div className="mini-list">
        {SKILLS.map((sk) => {
          const lvl = skillLvl(m.skills || {}, sk.id);
          const need = Math.max(1, 25 * (lvl + 1));
          const cur = Math.min(need, Number(xp[sk.id] || 0));
          return <div className="skill-mini"><div className="utility-row"><b>{sk.glyph} {sk.name}</b><span className="stat">Lv {lvl}/{sk.max}</span></div><div className="mini-bar"><i style={{ width: `${Math.min(100, 100 * cur / need).toFixed(0)}%` }} /></div><div className="tiny">{sk.blurb}</div></div>;
        })}
      </div>
    </UtilityShell>;
  }

  function BankPanel() {
    const m = ST.me;
    if (!m) return <div />;
    const bank = ST.bank || m.bank || {};
    const cfg = bank.config || {};
    const label = cfg.tokenLabel || "$CRAFTS";
    const deposit = bank.deposit || null;
    const depositAddress = deposit?.address || "";
    const bankTokens = bank.bankTokens?.amountUi ?? String(Math.floor(m.inv?.g || 0));
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
    return <UtilityShell title="Exchange" sub={`Simple ${label} wallet exchange. Deposit from Phantom into the game, or withdraw game coins back to the connected wallet.`}>
      <div className="exchange-widget">
        <div className="exchange-hero">
          <span className="exchange-icon">↔</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h4>{label} exchange</h4>
            <p>Connected wallet: <b>{m.wallet ? shortWallet(m.wallet) : "not connected"}</b>. Your deposit address is prepared automatically when the bank opens.</p>
          </div>
          <button className="btn" data-click="bank-refresh" disabled={ST.bankBusy}>{ST.bankBusy ? "Working…" : "Refresh"}</button>
        </div>
        <div className="exchange-balances">
          <div className="exchange-balance"><small>In-game coins</small><b>{bankTokens}</b><em>{label}</em></div>
          <div className="exchange-balance"><small>Wallet balance</small><b>{walletBalance}</b><em>{label}</em></div>
        </div>
        {!bankConfigured ? <div className="exchange-note bad">Exchange token is not configured yet. The operator must set the token mint/address on the server.</div> : null}
        {!transfersLive && bankConfigured ? <div className="exchange-note warn">Withdrawals are accepting requests. Live transfers are paused until the operator enables them.</div> : null}
        {ST.bankMsg || bank.depositError ? <div className={"exchange-note " + (statusBad || bank.depositError ? "bad" : "good")}>{ST.bankMsg || bank.depositError}</div> : null}
        <div className="exchange-card deposit">
          <span className="exchange-step">1</span>
          <div><h4>Deposit to game</h4><p>Send {label} from Phantom/Solwal to this personal address, then scan. The address is unique to this settler.</p></div>
          <div className={"exchange-address" + (depositAddress ? "" : " empty")}>{depositAddress || (ST.bankBusy ? "Preparing your deposit address…" : "Deposit address will appear here")}</div>
          <div className="exchange-actions">
            <button className="btn" data-click="copy-text" data-label="Deposit address" data-copy={depositAddress} disabled={!depositAddress}>Copy address</button>
            <button className="btn primary" data-click="bank-scan" disabled={disabled || ST.bankBusy || !depositAddress}>I sent tokens · Scan</button>
            {!depositAddress ? <button className="btn" data-click="bank-deposit" disabled={disabled || ST.bankBusy}>Prepare address</button> : null}
          </div>
          <div className="exchange-note">{scanLabel}. Confirmed deposits credit your in-game balance.</div>
        </div>
        <div className="exchange-card withdraw">
          <span className="exchange-step">2</span>
          <div><h4>Withdraw to connected wallet</h4><p>Withdraw game coins directly to the wallet that signed in: <b>{shortWallet(m.wallet)}</b>.</p></div>
          <div className="exchange-input-row">
            <input id="sc-bank-withdraw-ui" type="number" min={minWithdraw} step="1" defaultValue={defaultWithdraw} placeholder={`Amount in ${label}`} />
            <button className="btn primary" disabled={disabled || ST.bankBusy || Number(bankTokens || 0) <= 0} data-click="bank-withdraw-request">Withdraw</button>
          </div>
          <div className="exchange-note warn">Minimum {cfg.minWithdrawUi || 1} {label}. {transfersLive ? "Transfers send from the configured bank wallet." : "Your request will stay pending until live transfers are enabled."}</div>
        </div>
        {recent.length ? <details className="exchange-history"><summary>Recent withdrawals</summary><div className="mini-list" style={{ marginTop: 8 }}>{recent.map((w) => <div className="mini-row"><span>◇</span><div><b>{w.amountUi} {label}</b><div className="tiny">{cleanStatus(w)} · {shortWallet(w.to || w.wallet || "")}</div></div></div>)}</div></details> : null}
      </div>
    </UtilityShell>;
  }
  function ScaleControl({ kind, title, note }: any) {
    const key = kind === "menu" ? "menuScale" : "uiScale";
    const value = clampUiScale(ST.ui?.[key] ?? 1, 1);
    const presets = [0.75, 1, 1.25, 1.5];
    return <div className="settings-card">
      <div className="settings-card-head"><b>{title}</b><span>{uiScalePct(value)}</span></div>
      <div className="settings-scale-row">
        <button className="btn" data-click="ui-scale-step" data-kind={kind} data-delta={-UI_SCALE_STEP} aria-label={`${title} smaller`}>−</button>
        <input type="range" min={UI_SCALE_MIN} max={UI_SCALE_MAX} step="0.02" value={value} data-input="ui-scale" data-kind={kind} aria-label={title} />
        <button className="btn" data-click="ui-scale-step" data-kind={kind} data-delta={UI_SCALE_STEP} aria-label={`${title} larger`}>+</button>
      </div>
      <div className="settings-presets">
        {presets.map((preset) => <button className={"btn" + (Math.abs(value - preset) < 0.01 ? " primary" : "")} data-click="ui-scale-set" data-kind={kind} data-value={preset}>{uiScalePct(preset)}</button>)}
      </div>
      {kind === "ui" ? <div className="settings-scale-preview"><span>Aa</span><div><b>Live interface preview</b><small> HUD/buttons scale immediately after you click or drag.</small></div></div> : null}
      <button className="btn" data-click="ui-scale-reset" data-kind={kind}>Reset {kind === "menu" ? "menu" : "interface"}</button>
      <p className="settings-note">{note}</p>
    </div>;
  }
  function SettingsPanel() {
    const uiPct = uiScalePct(ST.ui?.uiScale || 1);
    const menuPct = uiScalePct(ST.ui?.menuScale || 1);
    return <div className="settings-layer">
      <button className="settings-scrim" data-click="panel-close" aria-label="Close settings" />
      <section className="settings-panel" data-stop-pointerdown="1" role="dialog" aria-modal="true" aria-label="Settings">
        <button className="settings-close" data-click="panel-close" aria-label="Close settings">×</button>
        <div className="settings-top">
          <div>
            <p className="settings-kicker">Client settings</p>
            <h3>Settings</h3>
            <p>Readable controls for this device. These settings are saved locally, apply instantly, and are separate from browser zoom.</p>
          </div>
        </div>
        <div className="settings-grid">
          <ScaleControl kind="ui" title={`Interface size · ${uiPct}`} note="HUD, minimap, action bar, tooltips, walkthrough callouts, and game panels." />
          <ScaleControl kind="menu" title={`Menu size · ${menuPct}`} note="Login/menu screen size, tuned separately from the in-game interface." />
          <div className="settings-card wide">
            <div className="settings-card-head"><b>Sound and visuals</b><span>{ST.musicMuted && ST.uiMuted ? "Muted" : "On"}</span></div>
            <p className="settings-note">Quick toggles that used to live in the cramped settings popover.</p>
            <div className="settings-actions">
              <button className="btn primary" data-click="start-music"><UiIcon name="sound" fallback="♪" /> Start music</button><button className="btn" data-click="toggle-music"><UiIcon name="sound" fallback="♪" /> {ST.musicMuted ? "Turn music on" : "Turn music off"}</button>
              <button className="btn" data-click="toggle-ui-sound"><UiIcon name="sound" fallback="♪" /> {ST.uiMuted ? "Turn UI sounds on" : "Turn UI sounds off"}</button>
              <button className="btn" data-click="reload-art">Reload art</button>
              <button className="btn" data-click="ui-scale-reset" data-kind="all">Reset all scale</button>
            </div>
          </div>
          <div className="settings-card">
            <div className="settings-card-head"><b>Visual quality</b><span>{ST.visual.quality || "fast"}</span></div>
            <p className="settings-note">Controls pixel sharpness and decoration cost. Movement is controlled separately.</p>
            <select className="settings-select" data-input="visual-quality" value={ST.visual.quality || "fast"}>
              <option value="auto">Auto</option>
              <option value="crisp">Crisp</option>
              <option value="balanced">Balanced</option>
              <option value="fast">Fast</option>
            </select>
          </div>
          <div className="settings-card">
            <div className="settings-card-head"><b>Motion feel</b><span>{ST.visual.motion || "classic"}</span></div>
            <p className="settings-note">Classic hop is the default arcade feel. Smooth is fluid. Low-power saves battery.</p>
            <select className="settings-select" data-input="motion-feel" value={ST.visual.motion || "classic"}>
              <option value="smooth">Smooth</option>
              <option value="classic">Classic hop</option>
              <option value="low">Low-power</option>
            </select>
          </div>
          <div className="settings-card wide">
            <div className="settings-card-head"><b>Camera view</b><span>{cameraZoomPct(ST.visual?.cameraZoom || 1)}</span></div>
            <p className="settings-note">This is a light local zoom for play. Use World Map for whole-map overview so the 3D scene stays fast.</p>
            <div className="settings-scale-row">
              <button className="btn" data-click="camera-zoom-in" aria-label="Camera closer">＋</button>
              <input type="range" min={CAMERA_ZOOM_MIN} max={CAMERA_ZOOM_MAX} step="0.01" value={ST.visual?.cameraZoom || 1} data-input="camera-zoom" aria-label="Camera view" />
              <button className="btn" data-click="camera-zoom-out" aria-label="Camera farther">−</button>
            </div>
            <div className="settings-presets">
              {[0.85, 1, 1.35, 1.7, 2.05].map((preset) => <button className={"btn" + (Math.abs((ST.visual?.cameraZoom || 1) - preset) < 0.02 ? " primary" : "")} data-click="camera-zoom-set" data-value={preset}>{preset === 1 ? "Default" : cameraZoomPct(preset)}</button>)}
            </div>
            <button className="btn" data-click="open-world-map">Open World Map</button>
            <button className="btn" data-click="camera-zoom-reset">Reset camera</button>
          </div>
          <div className="settings-card wide">
            <div className="settings-card-head"><b>Tutorial</b><span>Walkthrough</span></div>
            <p className="settings-note">Restart the first-time walkthrough from Character → Guide → Chop → Mine → Capture → Build → Use → Bank.</p>
            <div className="settings-actions">
              <button className="btn primary" data-click="tutorial-restart">Restart tutorial</button>
            </div>
          </div>
        </div>
        <div className="settings-danger">
          <div className="settings-divider" />
          <button className="btn warn" data-click="forget-session"><UiIcon name="logout" fallback="↩" /> Logout</button>
        </div>
      </section>
    </div>;
  }

  function UtilityPanel() {
    if (ST.screen !== "playing" || ST.modal || !ST.panel) return <div />;
    if (ST.panel === "inspect") return <InspectPanel />;
    if (ST.panel === "more") return <MorePanel />;
    if (ST.panel === "char") return <CharacterPanel />;
    if (ST.panel === "quests") return <QuestPanel />;
    if (ST.panel === "inv" || ST.panel === "inventory") { ST.panel = "bank"; return <BankPanel />; }
    if (ST.panel === "skills") return <SkillsPanel />;
    if (ST.panel === "bank") return <BankPanel />;
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
    const vw = Math.max(1, window.innerWidth || 1024);
    const vh = Math.max(1, window.innerHeight || 768);
    const compact = vw < 520 || vh < 520;
    const safe = compact ? 8 : 12;
    const w = Math.min(vw - safe * 2, compact ? 268 : vw < 720 || vh < 560 ? 300 : 326);
    const h = compact ? 112 : vw < 720 || vh < 560 ? 142 : 164;
    const gap = compact ? 10 : 14;
    const r = walkthroughTargetRect(panel);
    const avoid = walkthroughAvoidRects(panel);
    const candidates = [];
    function add(left, top, prefer = 0) {
      const rect = rectFromStyle(clampPx(left, safe, vw - w - safe), clampPx(top, safe, vh - h - safe), w, h);
      const score = placementPenalty(rect, avoid, safe, vw, vh) + prefer;
      candidates.push({ ...rect, score });
    }
    if (r) {
      const centeredLeft = r.left + r.width / 2 - w / 2;
      add(r.right + gap, r.top - 8, 1);
      add(r.left - w - gap, r.top - 8, 2);
      add(centeredLeft, r.bottom + gap, 3);
      add(centeredLeft, r.top - h - gap, 4);
    }
    add(vw - w - safe, safe, 20);
    add(safe, vh - h - Math.max(74, safe), 22);
    add((vw - w) / 2, safe, 24);
    add((vw - w) / 2, vh - h - Math.max(74, safe), 26);
    add((vw - w) / 2, (vh - h) / 2, 40);
    const best = candidates.sort((a, b) => a.score - b.score)[0] || { left: safe, top: safe };
    let nub = null;
    if (r) {
      const nubSize = compact ? 46 : 54;
      nub = {
        left: `${Math.round(clampPx(r.left + r.width / 2 - nubSize / 2, safe, vw - nubSize - safe))}px`,
        top: `${Math.round(clampPx(r.top + r.height / 2 - nubSize / 2, safe, vh - nubSize - safe))}px`,
      };
    }
    return {
      card: { left: `${Math.round(best.left)}px`, top: `${Math.round(best.top)}px`, width: `${Math.round(w)}px`, maxHeight: `${Math.round(Math.max(96, vh - safe * 2))}px` },
      nub,
    };
  }

  function WalkthroughLayer() {
    if (ST.screen !== "playing" || !ST.walkthrough?.active || ST.updateRequired || ST.modal || ST.needsProfile || !ST.me?.profileDone) return <div />;
    const step = ST.walkthrough.step;
    const meta = {
      char: { panel: "char", title: "Step 1: Character", text: "Open Character and try a quick look change while your settler stays visible.", btn: "Open Character", click: "toggle-panel" },
      quests: { panel: "quests", title: "Step 2: Guide", text: "Open Guide to see action, building, economy, and skill reward cards.", btn: "Open Guide", click: "toggle-panel" },
      chop: { panel: "chop", title: "Step 3: Chop", text: "Use Chop (2) on a tree. Wood drops as pickups on the map.", btn: "Select Chop", click: "gather-wood" },
      mine: { panel: "mine", title: "Step 4: Mine", text: "Use Mine (3) on stone. The game tells you if the wrong tool is selected.", btn: "Select Mine", click: "gather-stone" },
      claim: { panel: "claim", title: "Step 5: Capture", text: "Use Capture (4) on highlighted connected tiles. If tile limit is near full, the HUD tells you what to build next.", btn: "Select Capture", click: "claim" },
      build: { panel: "build", title: "Step 6: Build for limits", text: "Build normal structures to expand tile cap. Build Warehouses for wood/stone/plank/shard storage, Granaries for food, and Town Hall/World Wonder for big territory cap jumps.", btn: "Open Build", click: "select-build" },
      use: { panel: "use", title: "Step 7: Use", text: "Use (7) contains Return Scroll, Emergency Flask, rations, and elixirs.", btn: "Open Use", click: "use-tool" },
      bank: { panel: "bank", title: "Step 7: Bank", text: "Open Bank to see wallet $CRAFTS, in-game bank tokens, deposit address, and withdrawals.", btn: "Open Bank", click: "open-bank" },
    }[step] || { panel: "char", title: "Step 1: Character", text: "Open Character first.", btn: "Open", click: "toggle-panel" };
    const place = walkthroughPlacement(meta.panel);
    if (ST.panel && (step === "char" || step === "quests" || step === "bank")) {
      return <div className="walkthrough-layer walkthrough-target-only">{place.nub ? <div className="walkthrough-nub" style={place.nub} /> : null}</div>;
    }
    return <div className="walkthrough-layer">
      <div className="walkthrough-scrim" />
      {place.nub ? <div className="walkthrough-nub" style={place.nub} /> : null}
      <div className="walkthrough-callout" style={place.card}>
        <div className="walkthrough-progress">{Math.max(1, WALK_STEPS.indexOf(step) + 1)} / {WALK_STEPS.length}</div>
        <h3>{meta.title}</h3>
        <p>{meta.text}</p>
        <div className="tiny">Follow the steps, or skip and play your way.</div>
        <div className="walkthrough-actions"><button className="btn primary" data-click={meta.click} data-panel={meta.panel}>{meta.btn}</button><button className="btn" data-click="guide-skip">Skip</button></div>
      </div>
    </div>;
  }

  function ModalLayer() {
    if (ST.updateRequired) return <div className="modal-wrap"><div className="modal" style={{ width: "min(420px,94vw)", textAlign: "center" }}><h2>Refresh required</h2><p className="tiny">{ST.updateReason || "A game update landed. Refresh once so your client and the server agree."}</p><button className="btn primary" data-click="reload-page">Refresh and continue</button></div></div>;
    if (ST.screen === "playing" && ST.me && (ST.needsProfile || !ST.me.profileDone)) return <div className="modal-wrap"><IntroModal /></div>;
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
     PAINT — per-region, signature-gated rendering.
     A region only re-renders when its OWN signature changes, so
     pressing a button in one region never tears down the DOM the
     pointer is interacting with — clicks always complete.
     tradjs render() is called against the region root only.
     ============================================================ */
  const regions = [
    { root: hudRoot, view: Hud, sig: "" },
    { root: actionsRoot, view: TopActions, sig: "" },
    { root: utilityRoot, view: UtilityPanel, sig: "" },
    { root: bottomRoot, view: BottomBar, sig: "" },
    { root: guideRoot, view: WalkthroughLayer, sig: "" },
    { root: modalRoot, view: ModalLayer, sig: "" },
    { root: menuRoot, view: Menu, sig: "" },
  ];
  function hudSig() {
    const m = ST.me;
    if (ST.screen !== "playing" || !m) return "x";
    /* energy/hp deliberately EXCLUDED — the ticker mutates them in place */
    return [m.name, m.level, m.territory, m.built, m.maxE, m.msIndex, JSON.stringify(m.inv), JSON.stringify(m.equip),
      (m.pack || []).filter(Boolean).length, ST.mode, ST.placing, ST.tool, ST.destroying, ST.channel && ST.channel.kind, ST.near.i && ST.near.i.label, ST.goldSources && ST.goldSources.map(g=>g.id+g.state+(g.stored||0)).join(",")].join("|");
  }
  function actionsSig() { return ST.screen !== "playing" ? "x" : [ST.uiMuted ? 1 : 0, ST.musicMuted ? 1 : 0, ST.panel || "", ST.ui?.uiScale || 1, ST.visual?.cameraZoom || 1, ST.walkthrough?.active ? 1 : 0, ST.walkthrough?.step || ""].join("|"); }
  function utilitySig() {
    if (ST.screen !== "playing") return "x";
    const m = ST.me;
    const b = ST.panel === "inspect" ? world.buildPool.get(ST.inspect) : null;
    return [ST.panel, JSON.stringify(ST.visual || {}) || "", ST.questTab || "", ST.inspect || "", ST.inspectDraft && JSON.stringify(ST.inspectDraft), b && [b.level, Math.ceil(b.hp), b.maxHp, b.nm, b.cl, b.constructUntil || 0, Math.floor((constructionStateForBuilding(b)?.progress || 1) * 20)].join(":"), JSON.stringify(ST.characterProfile), m && JSON.stringify(m.inv), m && JSON.stringify(m.pack), m && JSON.stringify(m.skills), m && JSON.stringify(m.skillXp), m && m.wallet, m && m.strongbox, m && m.vaultGold, m && JSON.stringify(m.wonders), ST.wonderPrompt || "", ST.wonderName || "", ST.wonderFootprint || 9, ST.wonderMode || "district", ST.wonderPaletteId || "solar", ST.wonderBusy ? 1 : 0, ST.wonderPlacing ? 1 : 0, ST.wonderRecipe?.name || "", ST.wonderRecipe?.footprint || "", ST.wonderRecipe?.paletteId || "", ST.wonderMsg || "", m && m.biome, m && JSON.stringify(m.guideQuests), m && JSON.stringify(m.guideSummary), ST.uiMuted ? 1 : 0, ST.musicMuted ? 1 : 0, ST.ui?.uiScale || 1, ST.ui?.menuScale || 1, ST.visual?.cameraZoom || 1].join("|");
  }
  function bottomSig() {
    if (ST.screen !== "playing") return "x";
    const m = ST.me;
    return [ST.near.i && ST.near.i.label, ST.near.g && ST.near.g.id, ST.near.r && ST.near.r.uid, ST.mode, ST.placing, ST.tool, ST.destroying, ST.channel && ST.channel.kind, ST.uiMuted ? 1 : 0, ST.musicMuted ? 1 : 0, m && m.territory, m && JSON.stringify(m.inv), m && JSON.stringify(m.pack), ST.panel === "more" ? "more" : "", ST.wonderPrompt || "", ST.wonderName || "", ST.wonderFootprint || 9, ST.wonderMode || "", ST.wonderPaletteId || "", ST.wonderRecipe?.name || "", ST.adminTool || "", ST.adminMsg || "", Math.floor(liveE())].join("|");
  }
  function modalSig() {
    if (ST.updateRequired) return ["update", ST.updateVersion || "", ST.updateReason || ""].join("|");
    if (ST.screen !== "playing") return "none";
    if (ST.me && (ST.needsProfile || !ST.me.profileDone)) return ["intro", ST.profile.body, ST.profile.hat, ST.profile.name, JSON.stringify(ST.characterProfile)].join("|");
    if (!ST.modal) return "none";
    const m = ST.me;
    const b = ST.panel === "inspect" ? world.buildPool.get(ST.inspect) : null;
    return [ST.modal, ST.tradeTab, ST.inspect, ST.wonderViewUid || "", ST.inspectPlayer && ST.inspectPlayer.id,
      JSON.stringify(m && m.inv), m && m.maxE, m && m.wallet, m && m.skillPts, JSON.stringify(m && m.skills),
      JSON.stringify(m && m.equip), JSON.stringify(m && m.pack), m && m.territory,
      ST.near.m ? 1 : 0, ST.offers.length, ST.faceImage ? 1 : 0, ST.wonderPrompt || "", ST.wonderName || "", ST.wonderFootprint || 9, ST.wonderMode || "", ST.wonderPaletteId || "", ST.wonderBusy ? 1 : 0, ST.wonderPlacing ? 1 : 0, ST.wonderRecipe?.name || "", ST.wonderMsg || "", ST.wonderViewError || "", m && m.tokenBalance, ST.bank && JSON.stringify(ST.bank), m && m.msIndex, ST.inspectDraft && JSON.stringify(ST.inspectDraft), ST.goldSources && ST.goldSources.map(g=>g.id+g.state+(g.stored||0)).join(","), b && [b.level, Math.ceil(b.hp), b.maxHp, b.nm, b.cl, b.constructUntil || 0, Math.floor((constructionStateForBuilding(b)?.progress || 1) * 20)].join(":")].join("|");
  }
  function menuSig() { return ST.screen !== "menu" ? "x" : [ST.auth ? 1 : 0, ST.joining ? 1 : 0, ST.profile.body, ST.profile.hat, ST.profile.wallet, ST.loginMsg || "", JSON.stringify(ST.loginGate || {}), ST.ui?.menuScale || 1, phantomProvider() ? 1 : 0].join("|"); }
  function guideSig() {
    if (ST.screen !== "playing") return "x";
    return [ST.walkthrough?.active ? 1 : 0, ST.walkthrough?.step || "", ST.updateRequired ? 1 : 0, ST.modal || "", ST.needsProfile ? 1 : 0, ST.me?.profileDone ? 1 : 0, ST.ui?.uiScale || 1, ST.visual?.cameraZoom || 1].join("|");
  }
  const sigFns = [hudSig, actionsSig, utilitySig, bottomSig, guideSig, modalSig, menuSig];

  function paint(force = false) {
    /* chat panel visibility is imperative */
    updateHints();
    chatEl.style.display = ST.screen === "playing" ? "flex" : "none";
    minimapEl.style.display = ST.screen === "playing" ? "block" : "none";
    vignetteEl.style.display = ST.screen === "playing" ? "block" : "none";
    if (ST.screen !== "playing" || ST.modal) hideCtx();
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      const s = sigFns[i]();
      if (!force && s === r.sig) continue;
      r.sig = s;
      render(r.view(), r.root);
    }
    if (ST.screen === "playing" && (ST.mode === "build" || ST.mode === "place")) syncBuildScrollSoon();
    mountWonderViewerSoon();
  }

  /* ---------- imperative energy/bin ticker: NO vdom ---------- */
  const tick = setInterval(() => {
    if (ST.screen !== "playing" || !ST.me) return;
    world?.refreshConstructionProgress?.();
    const m = ST.me, e = liveE();
    const nowEl = document.getElementById("sc-e-now");
    if (nowEl) nowEl.textContent = String(Math.floor(e));
    const fill = document.getElementById("sc-e-fill");
    if (fill) fill.style.width = `${(100 * e / m.maxE).toFixed(1)}%`;
    const hpEl = document.getElementById("sc-hp-now");
    if (hpEl) hpEl.textContent = String(Math.ceil(m.hp || 0));
    const hpFill = document.getElementById("sc-hp-fill");
    if (hpFill) hpFill.style.width = `${(100 * Math.max(0, m.hp || 0) / MAX_HP).toFixed(1)}%`;
  }, 250);

  /* ============================================================
     BOOT
     ============================================================ */
  pollT = setInterval(poll, 850);
  paint(true);
  if (ST.auth) setTimeout(() => startPlaying(), 0);

  return () => {
    clearInterval(pollT);
    clearInterval(nearT);
    clearInterval(tick);
    clearInterval(channelT);
    clearTimeout(toastT);
    clearTimeout(pollSoonT);
    clearTimeout(appearanceSaveT);
    clearTimeout(appearanceRigT);
    worldEl.removeEventListener("pointermove", onPointerMove);
    worldEl.removeEventListener("pointerdown", onPointerDown);
    worldEl.removeEventListener("wheel", onWheel);
    worldEl.removeEventListener("contextmenu", onContext);
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
    for (const r of regions) render(null, r.root);
    root.replaceChildren();
  };
}
