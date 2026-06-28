// @ts-nocheck
import { frameThrottleMsForMotion } from "./renderBudget";

const UPDATE_ACK_KEY = "solcraft:client:ackVersion:v1";
const UI_SETTINGS_KEY = "solcraft:uiScale:v1";

export const UI_SCALE_MIN = 0.50;
export const UI_SCALE_MAX = 2.00;
export const UI_SCALE_STEP = 0.08;
export const CAMERA_ZOOM_MIN = 0.75;
export const CAMERA_ZOOM_MAX = 2.15;
export const CAMERA_ZOOM_STEP = 0.18;
// Fixed classic isometric camera; expanded minimap handles global view.
export const CAMERA_ROTATION_STEP = 0;

export const VISUAL_QUALITY_CHOICES = ["auto", "crisp", "balanced", "fast"];
export const MOTION_FEEL_CHOICES = ["smooth", "classic", "low"];

export function pickChoice(value: any, choices: readonly string[], fallback: string) {
  const v = String(value || "").trim().toLowerCase();
  return choices.includes(v) ? v : fallback;
}

export function resolveVisualQuality(visual: any, lowEnd = false) {
  const q = pickChoice(visual?.quality, VISUAL_QUALITY_CHOICES, "auto");
  if (q !== "auto") return q;
  return lowEnd ? "fast" : "balanced";
}

export function visualPerfFor(visual: any, lowEnd = false) {
  const quality = resolveVisualQuality(visual, lowEnd);
  const motion = pickChoice(visual?.motion, MOTION_FEEL_CHOICES, "smooth");
  const pixelRatioCap =
    quality === "crisp" ? 1.65 :
    quality === "balanced" ? 1.25 :
    0.92;
  const isFast = quality === "fast";
  const isBalanced = quality === "balanced";
  return {
    quality,
    motion,
    antialias: quality === "crisp" || (!lowEnd && isBalanced),
    pixelRatioCap,
    // Stage 17 perf: classic should change camera feel only, not cap the render loop.
    // A 22ms cap makes the game feel like ~45fps, especially during horizontal movement.
    frameMs: frameThrottleMsForMotion(motion),
    decorStep: isFast ? 0.16 : isBalanced ? 0.095 : 0.055,
    envStep: isFast ? 0.48 : isBalanced ? 0.30 : 0.18,
    cameraMode: motion,
    // Canvas renderer budgets. These are intentionally semantic instead of
    // renderer-specific so the settings panel can keep one quality model while
    // the world decides how to spend the frame.
    terrainDetailStride: isFast ? 3 : isBalanced ? 2 : 1,
    cityDecorStride: isFast ? 4 : isBalanced ? 2 : 1,
    maxCitizens: isFast ? 0 : isBalanced ? 8 : 18,
    maxCarts: isFast ? 0 : isBalanced ? 2 : 5,
    birdCount: isFast ? 0 : isBalanced ? 2 : 4,
    weatherDensity: isFast ? 0.18 : isBalanced ? 0.55 : 1,
    sparkleDensity: isFast ? 0.25 : isBalanced ? 0.62 : 1,
    shadowAlphaMul: isFast ? 0.70 : 1,
    labelMode: isFast ? "essential" : "contextual",
    // One-phase visual/mechanics budgets. The Canvas world reads these to
    // decide how much construction polish, Wonder aura, static caching, and
    // observability to spend before the player notices frame cost.
    staticLayer: true,
    staticCameraSnapPx: isFast ? 4 : isBalanced ? 2 : 1,
    maxPrismPartsPerBuilding: isFast ? 24 : isBalanced ? 42 : 72,
    constructionFx: isFast ? 0.45 : isBalanced ? 0.75 : 1,
    wonderAuraDensity: isFast ? 0.35 : isBalanced ? 0.70 : 1,
    influenceTintAlpha: isFast ? 0.050 : isBalanced ? 0.075 : 0.105,
    perfBudgetWarnMs: isFast ? 33 : 24,
  };
}

export function clampUiScale(value: any, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(UI_SCALE_MIN, Math.min(UI_SCALE_MAX, Math.round(n * 100) / 100));
}

export function uiScalePct(value: any) {
  return `${Math.round(clampUiScale(value) * 100)}%`;
}

export function clampCameraZoom(value: any, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, Math.round(n * 100) / 100));
}

export function cameraZoomPct(value: any) {
  return `${Math.round(clampCameraZoom(value, 1) * 100)}%`;
}

export function normalizeCameraYaw(value: any, fallback = Math.PI / 4) {
  const n = Number(value);
  const base = Number.isFinite(n) ? n : fallback;
  const tau = Math.PI * 2;
  return ((base % tau) + tau) % tau;
}

export function cameraYawDeg(value: any) {
  return Math.round(normalizeCameraYaw(value, Math.PI / 4) * 180 / Math.PI) % 360;
}

export function loadVisualSettings() {
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

export function saveVisualSettings(v: any) {
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

export function loadUiSettings() {
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

export function saveUiSettings(v: any) {
  const next = {
    uiScale: clampUiScale(v?.uiScale, 1),
    menuScale: clampUiScale(v?.menuScale, 1),
  };
  try { localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function readAckedClientVersion() {
  try { return String(localStorage.getItem(UPDATE_ACK_KEY) || ""); } catch { return ""; }
}

export function writeAckedClientVersion(version: any) {
  const v = String(version || "");
  if (!v) return;
  try { localStorage.setItem(UPDATE_ACK_KEY, v); } catch {}
}