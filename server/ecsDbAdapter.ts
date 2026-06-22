import { db, metaGet, metaSet } from "./db";
import { insertBuilding, deleteBuilding, invalidateBuildingStore } from "./buildingStore";
import { insertTile, deleteTile, invalidateTileStore } from "./tileStore";
import { insertLoot, deleteLoot, invalidateLootStore } from "./lootStore";
import { getPlayer, refreshPlayer } from "./playerStore";
import { ECONOMY_RULES, LIBRARY, START_INV, BASE_MAX, tokenMaxEnergy, tokenRegenPerMin, biomeAt, naturalDoodad, RES_KEYS } from "./shared";
import { cleanHarvestRules } from "./cleanEconomy";
import { isCleanBuildKind } from "./cleanRelease";
import { createWorld, addPlayer, setTile, addBuilding, addDoodad, addLoot, type BuildingC, type EcsWorld, type GameRules, type LootC, type ResourceBag } from "./ecs/index";
import { key as ecsKey } from "./ecs/math";

export const META_ECS_WORLD_REV = "solcraft:ecs:worldRev:v1";
export const META_ECS_MIRROR_AT = "solcraft:ecs:mirrorAt:v1";
export const META_ECS_SCHEMA = "solcraft:ecs:schemaVersion:v1";
export const ECS_SCHEMA_VERSION = 1;

const RESOURCE_KEYS = new Set<string>(["w", "p", "s", "f", "g", "sh", "sc"]);
const LOOT_TO_RES: Record<string, keyof ResourceBag> = { wood: "w", stone: "s", food: "f", gold: "g", shard: "sh", science: "sc", sc: "sc", plank: "p", planks: "p" } as any;

function now() { return Date.now(); }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function cleanInv(raw: any): ResourceBag {
  const out: ResourceBag = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const k of RES_KEYS) out[k] = Math.max(0, num(src[k], 0));
  return out;
}
function lootResources(kind: string): ResourceBag {
  const k = LOOT_TO_RES[String(kind || "").toLowerCase()] || (RESOURCE_KEYS.has(String(kind)) ? String(kind) as keyof ResourceBag : "g");
  return { [k]: 1 } as ResourceBag;
}
function fromLootResources(resources: ResourceBag): string {
  const first = Object.entries(resources || {}).find(([, v]) => Number(v || 0) > 0)?.[0] || "g";
  if (first === "w") return "wood";
  if (first === "s") return "stone";
  if (first === "f") return "food";
  if (first === "sh") return "shard";
  if (first === "sc") return "science";
  if (first === "p") return "planks";
  return "gold";
}

export function ecsWorldRev() { return Math.max(0, Number(metaGet(META_ECS_WORLD_REV, "0")) || 0); }
export function bumpEcsWorldRev() { const n = ecsWorldRev() + 1; metaSet(META_ECS_WORLD_REV, String(n)); return n; }
export function setEcsWorldRev(v: number) { metaSet(META_ECS_WORLD_REV, String(Math.max(0, Math.trunc(Number(v) || 0)))); }

export function ecsRulesFromShared(): GameRules {
  const buildings: GameRules["buildings"] = {};
  for (const b of LIBRARY as any[]) {
    if (!b?.id || !isCleanBuildKind(b.id)) continue;
    buildings[String(b.id)] = {
      kind: String(b.id),
      label: String(b.name || b.label || b.id),
      cost: { ...(b.cost || {}) },
      upgradeCost: { ...(b.upgradeCost || b.cost || {}) },
      // Clean-slate economy: buildings spawn harvestable resources; they do not passively credit inventory.
      produces: {},
      maxLevel: Number(b.maxLevel || 5),
      footprint: [1, 1],
    } as any;
  }
  return {
    movement: { maxChebStep: 1, energyPerStep: Number(ECONOMY_RULES.moveEnergy || 1) },
    energy: { defaultMax: BASE_MAX, defaultRegenPerMinute: ECONOMY_RULES.energyRegenBasePerMinute },
    claim: { cost: { e: ECONOMY_RULES.claimEnergy || 0, w: ECONOMY_RULES.claimWood || 0, s: ECONOMY_RULES.claimStone || 0 }, requireAdjacentOwnedTile: true },
    harvest: cleanHarvestRules(),
    caps: { w: 999999, p: 999999, s: 999999, f: 999999, g: 999999, sh: 999999, sc: 999999 },
    buildings,
  };
}

function addProceduralNodes(world: EcsWorld, px: number, pz: number, r = 26) {
  for (let x = px - r; x <= px + r; x++) for (let z = pz - r; z <= pz + r; z++) {
    const k = ecsKey(x, z);
    if (world.doodads.has(k)) continue;
    const persisted = (db.doodads.select().where({ x, z }).first() as any) || null;
    if (persisted?.state === "gone") continue;
    if (persisted?.state === "tree" || persisted?.state === "rock" || persisted?.state === "food" || persisted?.state === "crop") {
      addDoodad(world, { x, z, kind: persisted.state === "crop" ? "food" : persisted.state });
      continue;
    }
    const nd = naturalDoodad(x, z) as any;
    if (!nd || nd.kind === "none") continue;
    addDoodad(world, { x, z, kind: nd.kind === "rock" ? "rock" : nd.kind === "food" ? "food" : "tree" });
  }
}

export function loadEcsWorld(opts: { playerId?: number; ax?: number; az?: number; radius?: number; includeAll?: boolean } = {}): EcsWorld {
  const w = createWorld();
  w.version = ecsWorldRev();
  const radius = Math.max(8, Math.min(140, Number(opts.radius || 72)));
  const centerPlayer = opts.playerId ? getPlayer(opts.playerId) as any : null;
  const cx = Number.isFinite(Number(opts.ax)) ? Number(opts.ax) : num(centerPlayer?.x, 0);
  const cz = Number.isFinite(Number(opts.az)) ? Number(opts.az) : num(centerPlayer?.z, 0);
  const inRange = (row: any) => opts.includeAll || Math.max(Math.abs(num(row.x) - cx), Math.abs(num(row.z) - cz)) <= radius;

  const players = (db.players.select().all() as any[]).filter((p) => opts.includeAll || p.id === opts.playerId || now() - num(p.lastSeen, 0) < ECONOMY_RULES.activeWindowMs);
  let maxId = 1;
  for (const p of players) {
    maxId = Math.max(maxId, num(p.id));
    const hold = Number(p.tokenBalance || 0);
    addPlayer(w, {
      id: p.id,
      name: p.name || "Settler",
      spectator: String(p.secret || "").startsWith("spectator:"),
      level: p.level || 1,
      hp: p.hp || 100,
      spawnX: p.spawnX || 0,
      spawnZ: p.spawnZ || 0,
    }, { x: p.x || 0, z: p.z || 0 }, cleanInv(p.inv || START_INV), {
      value: p.energy || BASE_MAX,
      max: tokenMaxEnergy(hold),
      regenPerMinute: tokenRegenPerMin(hold),
      settledAt: p.energyAt || now(),
    });
  }

  for (const t of (db.tiles.select().all() as any[]).filter(inRange)) {
    maxId = Math.max(maxId, num(t.id));
    setTile(w, { id: t.id, x: t.x | 0, z: t.z | 0, owner: t.owner | 0, biome: biomeAt(t.x | 0, t.z | 0).id || biomeAt(t.x | 0, t.z | 0).name });
  }
  for (const b of (db.buildings.select().all() as any[]).filter(inRange)) {
    maxId = Math.max(maxId, num(b.id));
    addBuilding(w, {
      id: b.id,
      uid: b.id,
      owner: b.owner | 0,
      kind: String(b.kind || ""),
      x: b.x | 0,
      z: b.z | 0,
      level: Number(b.level || 1),
      hp: Number(b.hp || 0),
      maxHp: Number(b.maxHp || b.hp || 0),
      stored: { g: Number(b.stored || 0) },
      builtAt: Number(b.accAt || 0),
      readyAt: Number(b.cdUntil || 0),
    });
  }
  for (const l of (db.loot.select().all() as any[]).filter(inRange)) {
    maxId = Math.max(maxId, num(l.id));
    addLoot(w, { id: l.id, x: l.x | 0, z: l.z | 0, resources: lootResources(l.kind) });
  }
  for (const d of (db.doodads.select().all() as any[]).filter(inRange)) {
    if (d.state !== "gone") addDoodad(w, { x: d.x | 0, z: d.z | 0, kind: String(d.state || "tree") === "crop" ? "food" : String(d.state || "tree") });
  }
  addProceduralNodes(w, cx, cz, Math.min(radius, 36));
  w.nextEntityId = Math.max(w.nextEntityId, maxId + 1);
  // Loading should not itself make the DB appear changed.
  w.version = ecsWorldRev();
  return w;
}

export function persistEcsPlayer(world: EcsWorld, playerId: number) {
  const p = getPlayer(playerId) as any;
  if (!p) return;
  const pos = world.positions.get(playerId);
  const inv = world.inventories.get(playerId)?.resources;
  const energy = world.energies.get(playerId);
  if (pos) { p.x = pos.x | 0; p.z = pos.z | 0; }
  if (inv) p.inv = { ...p.inv, ...cleanInv(inv) };
  if (energy) { p.energy = Math.max(0, Number(energy.value || 0)); p.energyAt = Number(energy.settledAt || now()); }
  refreshPlayer(p);
}

export function persistEcsWorldDelta(before: EcsWorld, after: EcsWorld, playerId: number) {
  let changed = false;
  persistEcsPlayer(after, playerId);

  for (const [k, t] of after.tiles) {
    const prev = before.tiles.get(k);
    if (prev && prev.owner === t.owner) continue;
    const existing = db.tiles.select().where({ x: t.x, z: t.z }).first() as any;
    if (existing) { existing.owner = t.owner | 0; }
    else insertTile({ x: t.x | 0, z: t.z | 0, owner: t.owner | 0 });
    changed = true;
  }
  for (const [k, t] of before.tiles) if (!after.tiles.has(k)) { deleteTile(t as any); changed = true; }

  for (const [uid, b] of after.buildings) {
    const prev = before.buildings.get(uid);
    if (!prev) {
      const inserted = insertBuilding({ owner: b.owner | 0, kind: String(b.kind), x: b.x | 0, z: b.z | 0, nm: null, cl: null, level: b.level || 1, hp: b.hp || 12, maxHp: b.maxHp || b.hp || 12, acc: 0, accAt: now(), cdUntil: Number(b.readyAt || 0), usedAt: 0, stored: Number((b.stored as any)?.g || 0) });
      if (inserted && inserted.id && inserted.id !== uid) {
        // sqlite-zod-orm owns numeric IDs; ECS IDs are advisory in legacy tables.
      }
      changed = true;
    } else if (prev.level !== b.level || prev.hp !== b.hp || prev.owner !== b.owner || prev.kind !== b.kind) {
      const row = db.buildings.get(uid) as any;
      if (row) { row.level = Number(b.level || row.level || 1); row.hp = Number(b.hp || row.hp || 12); row.owner = b.owner | 0; row.kind = String(b.kind || row.kind); row.stored = Number((b.stored as any)?.g || row.stored || 0); }
      changed = true;
    }
  }
  for (const [uid] of before.buildings) if (!after.buildings.has(uid)) { deleteBuilding(uid); changed = true; }

  for (const [k, loot] of after.loot) {
    if (before.loot.has(k)) continue;
    insertLoot({ x: loot.x | 0, z: loot.z | 0, kind: fromLootResources(loot.resources), gid: null });
    changed = true;
  }
  for (const [k, loot] of before.loot) if (!after.loot.has(k)) { deleteLoot(loot as any); changed = true; }

  for (const [k, d] of before.doodads) {
    if (after.doodads.has(k)) continue;
    const existing = db.doodads.select().where({ x: d.x, z: d.z }).first() as any;
    if (existing) existing.state = "gone";
    else db.doodads.insert({ x: d.x | 0, z: d.z | 0, state: "gone" });
    changed = true;
  }
  if (changed || after.version !== before.version) {
    bumpEcsWorldRev();
    mirrorEcsWorldSummary(after, "delta");
  }
  invalidateBuildingStore(); invalidateTileStore(); invalidateLootStore();
}

export function mirrorEcsWorldSummary(world: EcsWorld, reason = "manual") {
  const t = now();
  metaSet(META_ECS_SCHEMA, String(ECS_SCHEMA_VERSION));
  metaSet(META_ECS_MIRROR_AT, String(t));
  const counts = { players: world.players.size, tiles: world.tiles.size, buildings: world.buildings.size, loot: world.loot.size, doodads: world.doodads.size, reason, at: t, rev: ecsWorldRev() };
  metaSet("solcraft:ecs:lastMirrorSummary:v1", JSON.stringify(counts));
  try {
    const row = (db as any).ecsSnapshots?.select?.().where({ name: "latest" }).first?.();
    const payload = JSON.stringify(counts);
    if (row) { row.rev = counts.rev; row.payload = payload; }
    else (db as any).ecsSnapshots?.insert?.({ name: "latest", rev: counts.rev, payload });
  } catch {}
  return counts;
}

export function mirrorLegacyToEcsTables(reason = "manual") {
  const world = loadEcsWorld({ includeAll: true, radius: 999999 });
  mirrorEcsWorldSummary(world, reason);
  return world;
}

export function ecsMigrationStatus() {
  let snapshotCount = 0;
  try { snapshotCount = Number((db as any).ecsSnapshots?.select?.().count?.() || 0); } catch {}
  return {
    schema: Number(metaGet(META_ECS_SCHEMA, "0")) || 0,
    targetSchema: ECS_SCHEMA_VERSION,
    worldRev: ecsWorldRev(),
    mirrorAt: Number(metaGet(META_ECS_MIRROR_AT, "0")) || 0,
    summary: (() => { try { return JSON.parse(metaGet("solcraft:ecs:lastMirrorSummary:v1", "{}") || "{}"); } catch { return {}; } })(),
    snapshotCount,
  };
}
