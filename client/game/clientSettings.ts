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

// The game has one visual contract: max-detail Canvas rendering backed by
// static terrain caches, sprite caches, culling, and adaptive non-render work.
export const MOTION_FEEL_CHOICES = ["smooth", "classic", "low"];

export function pickChoice(value: any, choices: readonly string[], fallback: string) {
  const v = String(value || "").trim().toLowerCase();
  return choices.includes(v) ? v : fallback;
}

export function visualPerfFor(visual: any, lowEnd = false) {
  const motion = pickChoice(visual?.motion, MOTION_FEEL_CHOICES, "smooth");
  void lowEnd;
  return {
    motion,
    antialias: true,
    pixelRatioCap: 2,
    // Motion changes input/camera feel only. It must not silently downgrade the
    // renderer; performance belongs to caching and culling, not hidden modes.
    frameMs: frameThrottleMsForMotion(motion),
    decorStep: 0.055,
    envStep: 0.18,
    cameraMode: motion,
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
      motion: pickChoice(raw.motion, MOTION_FEEL_CHOICES, "classic"),
      cameraZoom: clampCameraZoom(raw.cameraZoom, 1),
      cameraYaw: normalizeCameraYaw(raw.cameraYaw, Math.PI / 4),
    };
  } catch {
    return { warmth: 0.64, texture: 0.18, shadows: true, motion: "classic", cameraZoom: 1, cameraYaw: Math.PI / 4 };
  }
}

export function saveVisualSettings(v: any) {
  const next = {
    warmth: Math.max(0, Math.min(1, Number(v?.warmth ?? 0.62))),
    texture: Math.max(0, Math.min(1, Number(v?.texture ?? 0.18))),
    shadows: v?.shadows !== false,
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
