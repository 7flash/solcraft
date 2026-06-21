import { db, metaGet, metaSet } from "./db";
import { getPlayer, refreshPlayer } from "./playerStore";
import { refreshBuilding } from "./buildingStore";
import { bumpEcsWorldRev } from "./ecsDbAdapter";
import { readReputationConfig, reputationShortfallForPlayer, storageCapsForPlayer, tileCapacityForPlayer } from "./reputationRules";
import { RES_KEYS } from "./shared";
import type { ResourceBag } from "./ecs/types";

export type ProducerKind = "lumber" | "quarry" | "farm";
export type CleanEconomyConfig = {
  tickMs: number;
  storageRotFractionPerTick: number;
  storageRotMinPerTick: number;
  buildingRegenPerTick: number;
  buildingRegenPerLevel: number;
  capitalRegenPerTick: number;
  campSpawnIntervalMs: number;
  campSpawnRadius: number;
  campMaxNodesPerLevel: number;
  campMaxTotalNodes: number;
  campSpawnChancePerTick: number;
  harvestEnergy: Record<string, number>;
  harvestYield: Record<string, ResourceBag>;
  producerNodes: Record<ProducerKind, "tree" | "rock" | "food">;
  overCap: { stopBuildingRegen: boolean; allowStorageRot: boolean };
};

const META_CONFIG = "solcraft:clean:economyRuntime:v1";
const META_LAST_TICK = "solcraft:clean:economy:lastTick:v1";
const META_LAST_SUMMARY = "solcraft:clean:economy:lastSummary:v1";
const META_LAST_SPAWN = "solcraft:clean:economy:lastSpawn:v1:";

export const DEFAULT_CLEAN_ECONOMY_CONFIG: CleanEconomyConfig = {
  tickMs: 1000,
  storageRotFractionPerTick: 0.08,
  storageRotMinPerTick: 1,
  buildingRegenPerTick: 0.8,
  buildingRegenPerLevel: 0.22,
  capitalRegenPerTick: 12,
  campSpawnIntervalMs: 28_000,
  campSpawnRadius: 3,
  campMaxNodesPerLevel: 2,
  campMaxTotalNodes: 12,
  campSpawnChancePerTick: 0.72,
  harvestEnergy: { tree: 0.8, rock: 1.0, food: 0.6, crop: 0.6, coin: 0.2 },
  harvestYield: { tree: { w: 3 }, rock: { s: 2 }, food: { f: 2 }, crop: { f: 2 }, coin: { g: 1 } },
  producerNodes: { lumber: "tree", quarry: "rock", farm: "food" },
  overCap: { stopBuildingRegen: true, allowStorageRot: true },
};

function safeJson<T>(raw: string, fallback: T): T { try { return JSON.parse(raw || "") as T; } catch { return fallback; } }
function finite(v: any, fallback: number) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function cleanBag(raw: any): ResourceBag {
  const out: ResourceBag = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const k of RES_KEYS as any) {
    const n = finite(src[k], NaN);
    if (Number.isFinite(n)) (out as any)[k] = Math.max(0, n);
  }
  return out;
}
function mergeConfig(raw: any): CleanEconomyConfig {
  const b = DEFAULT_CLEAN_ECONOMY_CONFIG;
  const o = raw && typeof raw === "object" ? raw : {};
  const producerNodes = { ...b.producerNodes, ...(o.producerNodes || {}) } as CleanEconomyConfig["producerNodes"];
  return {
    tickMs: Math.max(250, Math.floor(finite(o.tickMs, b.tickMs))),
    storageRotFractionPerTick: clamp(finite(o.storageRotFractionPerTick, b.storageRotFractionPerTick), 0, 1),
    storageRotMinPerTick: Math.max(0, finite(o.storageRotMinPerTick, b.storageRotMinPerTick)),
    buildingRegenPerTick: Math.max(0, finite(o.buildingRegenPerTick, b.buildingRegenPerTick)),
    buildingRegenPerLevel: Math.max(0, finite(o.buildingRegenPerLevel, b.buildingRegenPerLevel)),
    capitalRegenPerTick: Math.max(0, finite(o.capitalRegenPerTick, b.capitalRegenPerTick)),
    campSpawnIntervalMs: Math.max(1_000, Math.floor(finite(o.campSpawnIntervalMs, b.campSpawnIntervalMs))),
    campSpawnRadius: Math.max(1, Math.min(8, Math.floor(finite(o.campSpawnRadius, b.campSpawnRadius)))),
    campMaxNodesPerLevel: Math.max(1, Math.floor(finite(o.campMaxNodesPerLevel, b.campMaxNodesPerLevel))),
    campMaxTotalNodes: Math.max(1, Math.floor(finite(o.campMaxTotalNodes, b.campMaxTotalNodes))),
    campSpawnChancePerTick: clamp(finite(o.campSpawnChancePerTick, b.campSpawnChancePerTick), 0, 1),
    harvestEnergy: { ...b.harvestEnergy, ...(o.harvestEnergy || {}) },
    harvestYield: Object.fromEntries(Object.entries({ ...b.harvestYield, ...(o.harvestYield || {}) }).map(([k, v]) => [k, cleanBag(v)])),
    producerNodes,
    overCap: { ...b.overCap, ...(o.overCap || {}) },
  };
}

export function readCleanEconomyConfig(): CleanEconomyConfig { return mergeConfig(safeJson(metaGet(META_CONFIG, "{}"), {})); }
export function writeCleanEconomyConfig(next: Partial<CleanEconomyConfig>) {
  const cfg = mergeConfig({ ...readCleanEconomyConfig(), ...(next || {}) });
  metaSet(META_CONFIG, JSON.stringify(cfg));
  return cfg;
}
export function cleanHarvestRules() {
  const cfg = readCleanEconomyConfig();
  return {
    costs: Object.fromEntries(Object.entries(cfg.harvestEnergy).map(([kind, e]) => [kind, { e: Math.max(0, Number(e || 0)) }])),
    yields: cfg.harvestYield,
  };
}
export function publicCleanEconomyConfig() {
  const cfg = readCleanEconomyConfig();
  const rep = readReputationConfig();
  return {
    tickMs: cfg.tickMs,
    storageRotFractionPerTick: cfg.storageRotFractionPerTick,
    storageRotMinPerTick: cfg.storageRotMinPerTick,
    buildingRegenPerTick: cfg.buildingRegenPerTick,
    buildingRegenPerLevel: cfg.buildingRegenPerLevel,
    capitalRegenPerTick: cfg.capitalRegenPerTick,
    campSpawnIntervalMs: cfg.campSpawnIntervalMs,
    campSpawnRadius: cfg.campSpawnRadius,
    campMaxNodesPerLevel: cfg.campMaxNodesPerLevel,
    campMaxTotalNodes: cfg.campMaxTotalNodes,
    campSpawnChancePerTick: cfg.campSpawnChancePerTick,
    harvestEnergy: cfg.harvestEnergy,
    harvestYield: cfg.harvestYield,
    producerNodes: cfg.producerNodes,
    reputation: { tileBase: rep.tileBase, tilePerLevel: rep.tilePerLevel, tilePerReputation: rep.tilePerReputation },
  };
}

function ownedRows(playerId: number) { return (db.buildings.select().where({ owner: Number(playerId || 0) }).all() as any[]) || []; }
function isOverextendedPlayer(p: any) { return reputationShortfallForPlayer(p) > 0; }
function isCapitalBuilding(b: any) { return Number(b?.owner || 0) <= 0 || String(b?.capital || "") === "1" || String(b?.kind || "").startsWith("capital"); }
function isReadyBuilding(b: any, t: number) { return Number(b?.cdUntil || 0) <= t && Number(b?.hp || 0) > 0; }
function cheb(x: number, z: number, x2: number, z2: number) { return Math.max(Math.abs((x | 0) - (x2 | 0)), Math.abs((z | 0) - (z2 | 0))); }
function k(x: number, z: number) { return `${x | 0},${z | 0}`; }

function applyStorageRotForPlayer(p: any, cfg: CleanEconomyConfig) {
  if (!p || !p.inv || typeof p.inv !== "object") return 0;
  const caps = storageCapsForPlayer(p);
  let rotted = 0;
  for (const rk of RES_KEYS as any) {
    if (rk === "g" || rk === "sh" || rk === "sc") continue;
    const cur = Math.max(0, Number(p.inv[rk] || 0));
    const cap = Math.max(0, Number((caps as any)[rk] ?? 0));
    if (cur <= cap) continue;
    const over = cur - cap;
    const decay = Math.min(over, Math.max(cfg.storageRotMinPerTick, Math.ceil(over * cfg.storageRotFractionPerTick)));
    p.inv[rk] = Math.max(cap, cur - decay);
    rotted += decay;
  }
  if (rotted > 0) refreshPlayer(p);
  return rotted;
}

function applyBuildingRegen(t: number, cfg: CleanEconomyConfig) {
  let healed = 0;
  const playerCache = new Map<number, any>();
  for (const b of db.buildings.select().all() as any[]) {
    if (!isReadyBuilding(b, t)) continue;
    const hp = Number(b.hp || 0);
    const maxHp = Math.max(hp, Number(b.maxHp || hp || 1));
    if (hp >= maxHp) continue;
    let regen = 0;
    if (isCapitalBuilding(b)) regen = cfg.capitalRegenPerTick;
    else {
      const owner = Number(b.owner || 0);
      const p = playerCache.get(owner) || getPlayer(owner) as any;
      if (p) playerCache.set(owner, p);
      if (cfg.overCap.stopBuildingRegen && p && isOverextendedPlayer(p)) continue;
      regen = cfg.buildingRegenPerTick + Math.max(0, Number(b.level || 1) - 1) * cfg.buildingRegenPerLevel;
    }
    if (regen <= 0) continue;
    b.hp = Math.min(maxHp, hp + regen);
    refreshBuilding(b);
    healed++;
  }
  return healed;
}

function emptyForDoodad(x: number, z: number) {
  if (db.buildings.select().where({ x, z }).first()) return false;
  const row = db.doodads.select().where({ x, z }).first() as any;
  return !row || row.state === "gone";
}
function countNodesAround(x: number, z: number, radius: number, state: string) {
  let n = 0;
  for (const d of db.doodads.select().all() as any[]) if (String(d.state || "") === state && cheb(Number(d.x), Number(d.z), x, z) <= radius) n++;
  return n;
}
function candidateCellsAround(x: number, z: number, radius: number) {
  const cells: { x: number; z: number; score: number }[] = [];
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    if (!dx && !dz) continue;
    const cx = (x | 0) + dx;
    const cz = (z | 0) + dz;
    if (!emptyForDoodad(cx, cz)) continue;
    cells.push({ x: cx, z: cz, score: Math.abs(dx) + Math.abs(dz) + Math.abs((cx * 928371 + cz * 364479) % 11) / 20 });
  }
  cells.sort((a, b) => a.score - b.score || a.x - b.x || a.z - b.z);
  return cells;
}
function spawnProducerDoodads(t: number, cfg: CleanEconomyConfig) {
  let spawned = 0;
  for (const b of db.buildings.select().all() as any[]) {
    const kind = String(b.kind || "") as ProducerKind;
    const node = cfg.producerNodes[kind];
    if (!node || !isReadyBuilding(b, t) || Number(b.owner || 0) <= 0) continue;
    const lastKey = `${META_LAST_SPAWN}${b.id}`;
    const last = Number(metaGet(lastKey, "0")) || 0;
    if (t - last < cfg.campSpawnIntervalMs) continue;
    metaSet(lastKey, String(t));
    const lvl = Math.max(1, Math.floor(Number(b.level || 1)));
    const cap = Math.min(cfg.campMaxTotalNodes, cfg.campMaxNodesPerLevel * lvl);
    if (countNodesAround(Number(b.x), Number(b.z), cfg.campSpawnRadius, node) >= cap) continue;
    const roll = Math.abs(Math.sin((Number(b.id || 1) * 99991 + t / cfg.campSpawnIntervalMs) * 12.9898)) % 1;
    if (roll > cfg.campSpawnChancePerTick) continue;
    const cell = candidateCellsAround(Number(b.x), Number(b.z), cfg.campSpawnRadius)[0];
    if (!cell) continue;
    const row = db.doodads.select().where({ x: cell.x, z: cell.z }).first() as any;
    if (row) row.state = node; else db.doodads.insert({ x: cell.x, z: cell.z, state: node });
    spawned++;
  }
  return spawned;
}

export function cleanEconomyTick(t = Date.now()) {
  const cfg = readCleanEconomyConfig();
  const last = Number(metaGet(META_LAST_TICK, "0")) || 0;
  if (t - last < cfg.tickMs) return { ok: true, skipped: true, at: last, config: publicCleanEconomyConfig() };
  metaSet(META_LAST_TICK, String(t));
  let rotted = 0;
  let overextended = 0;
  for (const p of db.players.select().all() as any[]) {
    if (String(p.secret || "").startsWith("spectator:")) continue;
    if (isOverextendedPlayer(p)) overextended++;
    if (cfg.overCap.allowStorageRot) rotted += applyStorageRotForPlayer(p, cfg);
  }
  const healedBuildings = applyBuildingRegen(t, cfg);
  const spawnedNodes = spawnProducerDoodads(t, cfg);
  const summary = { ok: true, at: t, rotted, overextended, healedBuildings, spawnedNodes, config: publicCleanEconomyConfig() };
  metaSet(META_LAST_SUMMARY, JSON.stringify(summary));
  if (rotted || healedBuildings || spawnedNodes) bumpEcsWorldRev();
  return summary;
}

export function cleanEconomyStatus() {
  return {
    lastTickAt: Number(metaGet(META_LAST_TICK, "0")) || 0,
    lastSummary: safeJson(metaGet(META_LAST_SUMMARY, "{}"), {}),
    config: publicCleanEconomyConfig(),
  };
}

export function cleanPlayerEconomySummary(playerId: number) {
  const p = getPlayer(playerId) as any;
  if (!p) return null;
  const ownedTiles = (() => { try { return Number(db.tiles.select().where({ owner: playerId }).count() || 0); } catch { return 0; } })();
  return {
    tileCapacity: tileCapacityForPlayer(p),
    ownedTiles,
    reputationShortfall: reputationShortfallForPlayer(p),
    overextended: reputationShortfallForPlayer(p) > 0,
    storageCaps: storageCapsForPlayer(p),
    warehouses: ownedRows(playerId).filter((b) => String(b.kind || "") === "warehouse").length,
  };
}
