import { db, metaGet, metaSet } from "./db";

export type ReputationReason =
  | "npcDonate"
  | "npcKill"
  | "keepDonate"
  | "keepRaid"
  | "keepBreach"
  | "buildingAttack"
  | "tileDestroy"
  | "worldWonder"
  | "admin";

export type ReputationConfig = {
  min: number;
  max: number;
  start: number;
  tileBase: number;
  tilePerLevel: number;
  tilePerReputation: number;
  tileCapHardMax: number;
  underCapGraceTiles: number;
  warehouseBaseStorage: number;
  warehouseStoragePerLevel: number;
  baseStorage: Record<string, number>;
  deltas: Record<ReputationReason, number>;
};

const META_CONFIG = "solcraft:clean:economyConfig:v1";
const META_REP_PREFIX = "solcraft:reputation:v1:";

export const DEFAULT_REPUTATION_CONFIG: ReputationConfig = {
  min: -500,
  max: 500,
  start: 0,
  tileBase: 18,
  tilePerLevel: 3,
  tilePerReputation: 0.12,
  tileCapHardMax: 900,
  underCapGraceTiles: 3,
  warehouseBaseStorage: 80,
  warehouseStoragePerLevel: 45,
  baseStorage: { w: 120, p: 80, s: 120, f: 90, g: 999999, sh: 0, sc: 0 },
  deltas: {
    npcDonate: 7,
    npcKill: -8,
    keepDonate: 1,
    keepRaid: -2,
    keepBreach: -16,
    buildingAttack: -3,
    tileDestroy: -5,
    worldWonder: 35,
    admin: 0,
  },
};

function safeJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw || "") as T; } catch { return fallback; }
}
function finite(value: any, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function playerKey(playerId: number) {
  return `${META_REP_PREFIX}${Math.max(0, Math.floor(Number(playerId || 0)))}`;
}
function mergeConfig(raw: any): ReputationConfig {
  const base = DEFAULT_REPUTATION_CONFIG;
  const obj = raw && typeof raw === "object" ? raw : {};
  const min = Math.floor(finite(obj.min, base.min));
  const max = Math.floor(finite(obj.max, base.max));
  return {
    min,
    max: Math.max(min + 1, max),
    start: clamp(Math.floor(finite(obj.start, base.start)), min, Math.max(min + 1, max)),
    tileBase: Math.max(1, Math.floor(finite(obj.tileBase, base.tileBase))),
    tilePerLevel: Math.max(0, finite(obj.tilePerLevel, base.tilePerLevel)),
    tilePerReputation: Math.max(0, finite(obj.tilePerReputation, base.tilePerReputation)),
    tileCapHardMax: Math.max(1, Math.floor(finite(obj.tileCapHardMax, base.tileCapHardMax))),
    underCapGraceTiles: Math.max(0, Math.floor(finite(obj.underCapGraceTiles, base.underCapGraceTiles))),
    warehouseBaseStorage: Math.max(0, Math.floor(finite(obj.warehouseBaseStorage, base.warehouseBaseStorage))),
    warehouseStoragePerLevel: Math.max(0, Math.floor(finite(obj.warehouseStoragePerLevel, base.warehouseStoragePerLevel))),
    baseStorage: { ...base.baseStorage, ...(obj.baseStorage || {}) },
    deltas: { ...base.deltas, ...(obj.deltas || {}) },
  };
}

export function readReputationConfig(): ReputationConfig {
  return mergeConfig(safeJson(metaGet(META_CONFIG, "{}"), {}));
}

export function writeReputationConfig(next: Partial<ReputationConfig>) {
  const cfg = mergeConfig({ ...readReputationConfig(), ...(next || {}) });
  metaSet(META_CONFIG, JSON.stringify(cfg));
  return cfg;
}

export function clampReputation(value: any, cfg = readReputationConfig()) {
  return clamp(Math.floor(finite(value, cfg.start)), cfg.min, cfg.max);
}

export function readReputation(playerId: number) {
  const cfg = readReputationConfig();
  return clampReputation(metaGet(playerKey(playerId), String(cfg.start)), cfg);
}

export function writeReputation(playerId: number, value: number) {
  const next = clampReputation(value);
  metaSet(playerKey(playerId), String(next));
  return next;
}

export function adjustReputation(playerId: number, delta: number, reason: ReputationReason = "admin") {
  const before = readReputation(playerId);
  const after = writeReputation(playerId, before + Math.floor(finite(delta, 0)));
  try {
    metaSet(`solcraft:reputation:lastChange:${playerId}`, JSON.stringify({ at: Date.now(), before, after, delta: after - before, reason }));
  } catch {}
  return { before, after, delta: after - before, reason };
}

export function reputationDeltaFor(reason: ReputationReason, multiplier = 1) {
  const cfg = readReputationConfig();
  return Math.floor(finite(cfg.deltas[reason], 0) * Math.max(0, finite(multiplier, 1)));
}

export function reputationTitle(value: number) {
  const n = Math.floor(Number(value || 0));
  if (n >= 300) return "Legendary Builder";
  if (n >= 180) return "Trusted Founder";
  if (n >= 80) return "Good Neighbor";
  if (n >= 20) return "Known Settler";
  if (n <= -220) return "World Menace";
  if (n <= -100) return "Feared Raider";
  if (n <= -30) return "Untrusted";
  return "Neutral";
}

export function reputationSummaryForWire(playerId: number) {
  const value = readReputation(playerId);
  return {
    value,
    title: reputationTitle(value),
    tileBonus: reputationTileBonus(value),
    config: publicReputationConfig(),
  };
}

export function reputationTileBonus(value: number) {
  const cfg = readReputationConfig();
  return Math.max(0, Math.floor(Math.max(0, Number(value || 0)) * cfg.tilePerReputation));
}

export function tileCapacityForPlayer(p: any) {
  const cfg = readReputationConfig();
  const level = Math.max(1, Math.floor(Number(p?.level || 1)));
  const rep = readReputation(Number(p?.id || 0));
  return Math.max(1, Math.min(cfg.tileCapHardMax, Math.floor(cfg.tileBase + (level - 1) * cfg.tilePerLevel + reputationTileBonus(rep))));
}

export function ownedTileCount(playerId: number) {
  try { return Number(db.tiles.select().where({ owner: Number(playerId || 0) }).count() || 0); } catch { return 0; }
}

export function reputationShortfallForPlayer(p: any) {
  const owned = ownedTileCount(Number(p?.id || 0));
  const cap = tileCapacityForPlayer(p);
  const cfg = readReputationConfig();
  return Math.max(0, owned - cap - cfg.underCapGraceTiles);
}

export function storageCapsForPlayer(p: any) {
  const cfg = readReputationConfig();
  const caps: Record<string, number> = { ...cfg.baseStorage };
  try {
    const rows = db.buildings.select().where({ owner: Number(p?.id || 0), kind: "warehouse" }).all() as any[];
    for (const b of rows) {
      const lvl = Math.max(1, Math.floor(Number(b.level || 1)));
      const add = cfg.warehouseBaseStorage + Math.max(0, lvl - 1) * cfg.warehouseStoragePerLevel;
      caps.w = Math.floor(Number(caps.w || 0) + add);
      caps.s = Math.floor(Number(caps.s || 0) + add);
      caps.f = Math.floor(Number(caps.f || 0) + add);
      caps.p = Math.floor(Number(caps.p || 0) + Math.floor(add / 2));
    }
  } catch {}
  return caps;
}

export function publicReputationConfig() {
  const cfg = readReputationConfig();
  return {
    min: cfg.min,
    max: cfg.max,
    tileBase: cfg.tileBase,
    tilePerLevel: cfg.tilePerLevel,
    tilePerReputation: cfg.tilePerReputation,
    warehouseBaseStorage: cfg.warehouseBaseStorage,
    warehouseStoragePerLevel: cfg.warehouseStoragePerLevel,
    deltas: cfg.deltas,
  };
}

export function reputationDeltaText(change: { before: number; after: number; delta: number }) {
  const d = Math.floor(Number(change?.delta || 0));
  if (!d) return `Reputation ${Math.floor(Number(change?.after || 0))}`;
  return `Reputation ${d > 0 ? "+" : ""}${d} (${Math.floor(Number(change.after || 0))})`;
}
