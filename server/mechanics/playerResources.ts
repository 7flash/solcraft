// @ts-nocheck
import { PACK_SIZE } from "../shared";
import { allPlayers, getPlayer } from "../playerStore";

export const PLAYER_RESOURCE_KEYS = ["w", "s", "p", "f", "g", "sh", "sc"] as const;
export const BOMB_IDS = new Set(["cracker", "snare", "popper", "thumper", "cutter", "sapper", "breacher", "quake"]);

export function expectedAdminKey() {
  return String(process.env.SOLCRAFT_ADMIN_KEY || process.env.ADMIN_KEY || process.env.SOLCRAFT_DEPLOY_ADMIN_KEY || "").trim();
}

export function providedAdminKey(req: Request, url: URL, body: any = {}) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return String(
    req.headers.get("x-solcraft-admin-key") ||
    req.headers.get("x-admin-key") ||
    bearer ||
    url.searchParams.get("adminKey") ||
    url.searchParams.get("key") ||
    body?.adminKey ||
    body?.key ||
    "",
  ).trim();
}

export function requireAdminKey(req: Request, url: URL, body: any = {}) {
  const expected = expectedAdminKey();
  // Admin routes are still expected to be protected by the app middleware in
  // production. This optional key adds a second local/operator safety gate.
  if (expected && providedAdminKey(req, url, body) !== expected) {
    throw Object.assign(new Error("Unauthorized admin key"), { status: 401, reasonCode: "UNAUTHORIZED" });
  }
}

export function safeJson(raw: any, fallback: any) {
  if (raw && typeof raw === "object") return raw;
  try { return JSON.parse(String(raw || "")); } catch { return fallback; }
}

export function numberValue(v: any, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function clampInt(v: any, min = 0, max = 1_000_000_000) {
  return Math.max(min, Math.min(max, Math.floor(numberValue(v, 0))));
}

export function displayPlayerResources(p: any) {
  const inv = safeJson(p.inv, {});
  const pack = Array.isArray(p.pack) ? p.pack : safeJson(p.pack, []);
  const bombs: Record<string, number> = {};
  for (const it of pack) {
    if (it?.t === "bomb") bombs[it.id || "popper"] = (bombs[it.id || "popper"] || 0) + 1;
  }
  return {
    id: p.id,
    name: p.name,
    wallet: p.wallet || "",
    x: p.x,
    z: p.z,
    hp: Math.floor(numberValue(p.hp, 0)),
    energy: Math.floor(numberValue(p.energy, 0)),
    tokenBalance: Math.floor(numberValue(p.tokenBalance, 0)),
    strongbox: Math.floor(numberValue(p.strongbox, 0)),
    level: Math.floor(numberValue(p.level, 1)),
    xp: Math.floor(numberValue(p.xp, 0)),
    skillPts: Math.floor(numberValue(p.skillPts, 0)),
    lastSeen: Number(p.lastSeen || 0),
    inv,
    bombs,
    packUsed: pack.filter(Boolean).length,
    packSize: Math.max(Number(PACK_SIZE || 0) || pack.length || 0, pack.length || 0),
  };
}

export function listPlayerResources() {
  return (allPlayers() as any[])
    .map(displayPlayerResources)
    .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0) || Number(a.id) - Number(b.id));
}

export function playerById(id: any) {
  const p = getPlayer(Number(id || 0)) as any;
  if (!p) throw Object.assign(new Error("Player not found"), { status: 404, reasonCode: "PLAYER_NOT_FOUND" });
  return p;
}

export function normalizePack(p: any) {
  const minSize = Math.max(Number(PACK_SIZE || 0) || 0, 24);
  const pack = Array.isArray(p.pack) ? [...p.pack] : safeJson(p.pack, []);
  while (pack.length < minSize) pack.push(null);
  return pack;
}

export function addBombsToPlayer(p: any, variant: string, count: number) {
  const id = BOMB_IDS.has(String(variant)) ? String(variant) : "popper";
  const pack = normalizePack(p);
  let added = 0;
  for (let i = 0; i < pack.length && added < count; i++) {
    if (!pack[i]) { pack[i] = { t: "bomb", id }; added++; }
  }
  while (added < count && pack.length < 120) { pack.push({ t: "bomb", id }); added++; }
  p.pack = pack;
  p.lastSeen = Math.max(Number(p.lastSeen || 0), Date.now());
  return added;
}

export function applyPlayerValues(p: any, mode: "grant" | "set", values: any = {}) {
  const inv = { ...safeJson(p.inv, {}) };
  const changed: Record<string, number> = {};

  for (const k of PLAYER_RESOURCE_KEYS) {
    if (values[k] === undefined || values[k] === "") continue;
    const v = clampInt(values[k]);
    const next = mode === "set" ? v : clampInt((inv[k] || 0) + v);
    inv[k] = next;
    changed[k] = next;
  }

  // Friendly alias for pages/scripts that post { science: n }.
  if (values.science !== undefined && values.sc === undefined) {
    const v = clampInt(values.science);
    inv.sc = mode === "set" ? v : clampInt((inv.sc || 0) + v);
    changed.sc = inv.sc;
  }

  p.inv = inv;

  for (const field of ["energy", "hp", "xp", "skillPts", "tokenBalance", "strongbox"] as const) {
    if (values[field] === undefined || values[field] === "") continue;
    const v = clampInt(values[field]);
    p[field] = mode === "set" ? v : clampInt((p[field] || 0) + v);
    changed[field] = p[field];
  }

  if (values.energy !== undefined) p.energyAt = Date.now();
  p.lastSeen = Math.max(Number(p.lastSeen || 0), Date.now());
  return changed;
}

export const PLAYER_RESOURCE_PRESETS: Record<string, any> = {
  starter: { w: 150, s: 150, p: 60, f: 60, g: 100, sc: 30, energy: 100, hp: 100 },
  builder: { w: 1000, s: 1000, p: 500, f: 300, g: 500, sc: 150, energy: 200, hp: 200 },
  siege: { w: 300, s: 300, p: 100, f: 80, g: 100, sc: 120, energy: 200, hp: 200 },
  wonder: { w: 1000, s: 1000, p: 500, f: 500, g: 1000, sc: 300, energy: 200, hp: 200 },
};

export function applyPlayerPreset(p: any, preset: string) {
  const key = String(preset || "starter");
  const changed = applyPlayerValues(p, "grant", PLAYER_RESOURCE_PRESETS[key] || PLAYER_RESOURCE_PRESETS.starter);
  if (key === "siege") addBombsToPlayer(p, "popper", 3);
  return changed;
}

export function healAndRefillPlayer(p: any) {
  p.hp = Math.max(100, Number(p.hp || 0));
  p.energy = Math.max(100, Number(p.energy || 0));
  p.energyAt = Date.now();
  p.lastSeen = Math.max(Number(p.lastSeen || 0), Date.now());
}

export function playerResourcesResponse(extra: any = {}) {
  return Response.json({ ok: true, players: listPlayerResources(), ...extra }, { headers: { "Cache-Control": "no-store" } });
}