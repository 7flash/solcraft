export type ValidatedAction = { ok: true; body: Record<string, any> } | { ok: false; msg: string; reasonCode: string };

const KNOWN_ACTIONS = new Set([
  "move", "movePath", "adminMapTeleport",
  "claim", "place", "upgrade", "demolish", "repair", "customize", "customizerAccess",
  "harvest", "harvestStart", "harvestFinish", "harvestCancel", "pickup",
  "home", "homeStart", "homeFinish", "homeCancel",
  "wonderStart", "wonderFinish", "wonderCancel", "placeWonder",
  "profileFace", "profileAppearance", "setupProfile",
  "use", "fight", "attackNpc", "donateNpc", "donateKeep", "raid",
  "wallet", "withdrawGold", "chat",
  "adminSpawnKeep", "adminDemolishAt",
]);

const COORD_KEYS = new Set(["x", "z", "sourceX", "sourceZ"]);
const ID_KEYS = new Set(["uid", "id", "idx", "target", "targetId", "sourceId"]);
const SAFE_ID = /^[a-z0-9_.:-]{0,64}$/i;

function intValue(v: any, min = -1_000_000, max = 1_000_000) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
}
function moneyValue(v: any, max = 10_000_000) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
}
function shortText(v: any, max = 160) {
  return String(v ?? "").trim().slice(0, max);
}
function safeId(v: any, fallback = "") {
  const s = shortText(v, 64);
  return SAFE_ID.test(s) ? s : fallback;
}
function cleanSteps(value: any) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).map((s) => ({ x: intValue(s?.x), z: intValue(s?.z) }));
}

export function validateActionBody(raw: any): ValidatedAction {
  const src = raw && typeof raw === "object" ? raw : {};
  const type = shortText(src.type, 64);
  if (!type) return { ok: false, msg: "Missing action type.", reasonCode: "ACTION_TYPE_REQUIRED" };
  if (!KNOWN_ACTIONS.has(type)) return { ok: false, msg: `Unknown action: ${type}`, reasonCode: "UNKNOWN_ACTION" };

  const body: Record<string, any> = { ...src, type };
  for (const k of Object.keys(body)) {
    if (COORD_KEYS.has(k)) body[k] = intValue(body[k]);
    else if (ID_KEYS.has(k)) body[k] = intValue(body[k], 0, 2_147_483_647);
  }

  if (type === "movePath") body.steps = cleanSteps(body.steps);
  if (["place", "customize"].includes(type)) {
    body.kind = safeId(body.kind, String(body.kind || ""));
    body.variant = safeId(body.variant, String(body.variant || ""));
  }
  if (type === "chat") body.msg = shortText(body.msg, 180);
  if (type === "customize") { body.nm = shortText(body.nm, 32); body.cl = shortText(body.cl, 24); }
  if (type === "setupProfile") { body.name = shortText(body.name, 24); body.referralCode = shortText(body.referralCode, 40).toUpperCase().replace(/[^A-Z0-9_-]+/g, ""); }
  if (type === "wallet") body.addr = shortText(body.addr, 80);
  if (["withdrawGold", "donateKeep", "donateNpc"].includes(type)) {
    body.amount = moneyValue(body.amount ?? body.gold ?? body.gAmt ?? 0);
    body.gold = moneyValue(body.gold ?? body.amount ?? 0);
    body.gAmt = moneyValue(body.gAmt ?? 0);
  }
  if (type === "profileFace" && typeof body.faceImage === "string" && body.faceImage.length > 225_000) {
    return { ok: false, msg: "That portrait is too large for this profile.", reasonCode: "PORTRAIT_TOO_LARGE" };
  }

  return { ok: true, body };
}

export function actionRatePolicy(type: string) {
  switch (type) {
    case "chat": return { capacity: 4, refillPerSec: 0.35, cost: 1 };
    case "profileFace": return { capacity: 2, refillPerSec: 1 / 120, cost: 1 };
    case "move": return { capacity: 60, refillPerSec: 25, cost: 1 };
    case "movePath": return { capacity: 24, refillPerSec: 10, cost: 1 };
    case "pickup": return { capacity: 80, refillPerSec: 40, cost: 1 };
    case "harvestStart":
    case "harvestFinish":
    case "harvestCancel":
    case "harvest": return { capacity: 24, refillPerSec: 8, cost: 1 };
    case "fight":
    case "attackNpc":
    case "raid": return { capacity: 12, refillPerSec: 2.5, cost: 1 };
    case "wonderStart":
    case "placeWonder": return { capacity: 4, refillPerSec: 1 / 30, cost: 1 };
    default: return { capacity: 30, refillPerSec: 12, cost: 1 };
  }
}
