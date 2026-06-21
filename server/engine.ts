/* ============================================================
   SOLCRAFT engine — the single source of truth.
   Every rule (spacing, costs, cooldowns, combat, trade) is
   enforced here; the client only renders and asks.

   PERFORMANCE MODEL (built for 100+ concurrent pollers):
   1. READS NEVER WRITE. Energy / HP / producer stockpiles are
      computed from (value, settledAt) pairs; the row is only
      written when something is actually spent or collected.
   2. WORLD PAYLOAD IS SKIPPED ENTIRELY when nothing changed:
      a global worldRev bumps on any visible mutation, and the
      view is keyed to a quantized anchor — if the client's
      (rev, anchor) match, the snapshot is just me+players+chat.
   3. EVERY SPATIAL QUERY IS AN INDEXED RANGE QUERY — no table
      is ever scanned in full on the hot path.
   4. HOT LOOKUPS ARE IN-MEMORY: live player positions, player
      name/body, per-player derived stats, the chat ring, and
      a "has pending events" set that avoids one query per poll.
   ============================================================ */
import { measureSync } from "measure-fn";
import { db, metaGet, metaSet } from "./db";
import { verifyWalletAuth, type WalletAuthInput } from "./wallet-auth";
import { assertWalletPassesLoginGate, publicLoginGateSettings } from "./login-gate";
import { bankAdminStatus, bankStatusForPlayer } from "./bank";
import {
  ACC_CAP, ANCHOR_PAD, BASE_MAX, BASE_REGEN, BOMB_FUSE_MS, BOMB_ITEM_COST, BUILDING_REWARD_MS, BUILDING_REWARD_POOL, CLAIM_COST, ECONOMY_RULES, FIGHT_COST, GEAR, GEAR_BY_ID, GOLD_MINE_KIND, BARB_CAMP_KIND, GOLD_MINE_STORAGE_CAP, GOLD_MINE_BASE_HP, GOLD_PER_CRAFTS_FIXED, CRAFTS_PER_GOLD_FIXED,
  GOLD_COIN_BASE_INTERVAL_MS, GOLD_COIN_SOLO_INTERVAL_MS, GOLD_COIN_LOWPOP_INTERVAL_MS, GOLD_COIN_TAX_PCT, GOLD_COIN_MAX_WORLD, GOLD_COIN_TERRITORY_DIVISOR,
  DESTROY_BY_ID, DESTROY_TOOLS, LIBRARY, LIB_BY_ID, MAX_HP, MAX_LEVEL, MILESTONES, MOVE_COST, N4, N8, NPC_TRADES, PACK_SIZE, WORLD_WONDER_GOLD_COST, WORLD_WONDER_PLAZA_RADIUS, WORLD_WONDER_PLAZA_SIZE, WORLD_WONDER_PLAZA_TILES, WORLD_WONDER_BUILD_MS, WORLD_WONDER_CLIENT_VERSION, NORMAL_BUILDING_BUILD_MS, DECOR_BUILDING_BUILD_MS, SCIENCE_BASE_CAP, SCIENCE_CAP_PER_ACADEMY,
  RAID_COST, RAID_DMG, RECIPE_BY_ID, REDEEM_MIN_GOLD, RELICS, RES_KEYS, SKILL_BY_ID, SPAWN_HALF, USE_ITEMS,
  START_INV, TELEPORT_COST, TELEPORT_MS, TILE_CAPTURE_COST, TOWER_DMG_CUT, TOWER_RADIUS, TOWER_BOMB_DMG_CUT, TOWER_BOMB_DPS, SIEGE_BUILDING_DMG, SIEGE_TOOL_DMG, STRONGBOX_CAP, VAULT_CAP, VAULT_LOOT_SHARE, VAULT_BURN_SHARE, VIEW_RADIUS, XP, RESOURCE_BASE_CAP, WAREHOUSE_RESOURCE_CAP_BONUS, GRANARY_FOOD_CAP_BONUS, TOWNHALL_STORAGE_BONUS, TOWNHALL_TILE_CAP_BONUS, BARRACKS_TOWER_RANGE_BONUS, BARRACKS_TOWER_DPS_BONUS, BARRACKS_TOOL_DAMAGE_CUT_BONUS,
  anchorOf, biomeAt, buildMaxHp, cheb, gatherBonus, gearStat, harvestMs, key, lvlMul, masonHp, naturalDoodad, proceduralKeepCandidatesAround, proceduralNpcAt,
  nearTradePost, repairCost, skillAtk, skillDef, skillLvl, spawnOrigin, tradePostAt, upgradeCost, vigorMax, vigorRegen, xpForLevel, holdWeight, tokenRegenPerMin, tokenMaxEnergy, rewardWeight, maxTilesFor,
  type BuildingDef, type Equip, type Inv, type MeWire, type PackItem, type ResKey, type Skills, type Snapshot, type WorldWire,
} from "./shared";
import { cleanWonderPrompt, assertRealWonderRecipe, applyWonderDesignOptions, wonderFootprintRadius, normalizeWonderFootprint, wonderFootprintTiles, wonderBuildMsFor } from "./wonderRecipe";
import { resolveKeepVaultBreak } from "./mechanics/keepVault";
import { applyKeepRegen, keepRaidHitPreview, keepRaidNote } from "./mechanics/keepRaid";
import { academyScienceCapFor, resourceCapFor, scienceStatusFor, storageCapsFor } from "./mechanics/science";
import { craftDestroyToolFor, tunedDestroySpecFor } from "./mechanics/destroyTools";
import { capitalBlocksPlayerTerritory } from "./capitalRules";
import { tileCapacityForProgress, tileCapacityExplanation } from "./progressionRules";
import { FOUNDATION_KIND, isFoundationBuildKind, foundationChoiceLabel } from "./foundationRules";
import { adjustFactionStanding, factionDeltaText, factionSummaryForWire, factionTileCapacityBonus, readFactionStanding } from "./factionRules";
import { devCommandsEnabled, isAdminPlayerName } from "./adminAuth";
import { buildingAt, buildingCacheStats, deleteBuilding, getBuilding, hydrateBuildingStore, insertBuilding } from "./buildingStore";
import { claimTileAt, deleteTile, hydrateTileStore, insertTile, insertTiles, tileAt, tileCacheStats } from "./tileStore";
import { deleteLoot, getLoot, hydrateLootStore, insertLoot, lootAt, lootCacheStats } from "./lootStore";

type Player = ReturnType<typeof db.players.get> & Record<string, any>;
type Building = Record<string, any>;

const now = () => Date.now();
const ok = (extra: Record<string, any> = {}) => ({ ok: true, ...extra });
const err = (msg: string, reasonCode = "BAD_ACTION") => ({ ok: false, msg, reasonCode });
function wonderMetaKey(uid: number) { return `solcraft:wonder:${uid}:v1`; }
function saveWonderRecipe(uid: number, recipe: any) { metaSet(wonderMetaKey(uid), JSON.stringify(recipe || {})); }
function readWonderRecipe(uid: number) { try { return JSON.parse(metaGet(wonderMetaKey(uid), "{}") || "{}"); } catch { return {}; } }
function isPlayerBaseProtectedBuilding(b: Building | null | undefined) {
  if (!b || !Number(b.owner || 0)) return false;
  if (b.kind === "bomb") return false;
  return true;
}
function isAdminPlayer(p: Player) {
  return isAdminPlayerName(String(p?.name || ""));
}
const COST_GLYPH: Record<string, string> = { e: "⚡", w: "🪵", p: "📦", s: "🪨", f: "🌾", g: "🪙", sh: "◈", sc: "🔬" };
function costPart(res: string, amt: number) { return `${Math.ceil(Number(amt || 0))}${COST_GLYPH[res] || res}`; }
function costText(cost: Partial<Record<string, number>> = {}) { return Object.entries(cost || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => costPart(k, Number(v))).join(" "); }
function missingText(p: Player, cost: Partial<Record<string, number>> = {}) {
  const e = energyNow(p);
  return Object.entries(cost || {}).filter(([, v]) => Number(v) > 0).map(([res, amt]) => {
    const have = res === "e" ? e.energy : Number((p.inv || {})[res] || 0);
    const need = Number(amt || 0);
    return have >= need ? "" : `${costPart(res, need - have)} more ${COST_GLYPH[res] || res}`;
  }).filter(Boolean).join(", ");
}

function snapshotMeasureFields(r: any, playerId: number) {
  const me = r?.me || {};
  const world = r?.world || {};
  return {
    ok: true,
    player: playerId,
    me: {
      id: me.id,
      x: me.x,
      z: me.z,
      energy: Math.round(Number(me.energy || 0) * 10) / 10,
      maxE: me.maxE,
      level: me.level,
      territory: me.territory,
      spectator: !!me.spectator,
      hasFaceImage: !!me.faceImage,
    },
    world: {
      rev: world.rev,
      ax: world.ax,
      az: world.az,
      tiles: world.tiles?.length || 0,
      buildings: world.buildings?.length || 0,
      doodads: world.doodads?.length || 0,
      loot: world.loot?.length || 0,
      map: !!world.map,
      mapTiles: world.map?.tiles?.length || 0,
      mapBuildings: world.map?.buildings?.length || 0,
      mapLoot: world.map?.loot?.length || 0,
      mapPlayers: world.map?.players?.length || 0,
    },
    mapPlayers: r?.mapPlayers?.length || 0,
    peers: r?.players?.length || 0,
    chat: r?.chat?.length || 0,
    events: r?.events?.length || 0,
    leaderboard: r?.leaderboard?.length || 0,
    quests: r?.me?.quests?.length || 0,
    requiredVersion: r?.requiredVersion || undefined,
  };
}

/* range helper for the indexed x/z queries.
   sqlite-zod-orm operator objects ($gte/$lte) — same family as the
   $lt already used for doodad regrowth. */
const between = (a: number, b: number) => ({ $gte: a, $lte: b });
const inBox = (cx: number, cz: number, r: number) => ({
  x: between(cx - r, cx + r),
  z: between(cz - r, cz + r),
});

/* ============================================================
   IN-MEMORY HOT STATE (rebuilt from the DB on boot)
   ============================================================ */

/* worldRev: bumps on any mutation visible in the world payload */
let worldRev = parseInt(metaGet("worldRev", "1"), 10) || 1;
function bump() { worldRev++; metaSet("worldRev", String(worldRev)); }
const VERSION_META = "solcraft:client:requiredVersion";
export const clientRequiredVersion = () => metaGet(VERSION_META, process.env.SOLCRAFT_CLIENT_VERSION || WORLD_WONDER_CLIENT_VERSION) || (process.env.SOLCRAFT_CLIENT_VERSION || WORLD_WONDER_CLIENT_VERSION);
export const clientUpdateReason = () => metaGet("solcraft:client:updateReason", "Active player visibility and movement performance update. Refresh once so your client receives the wider player stream.");
export function forceClientRefresh(reason = "Admin published an update") {
  const version = `${Date.now()}`;
  metaSet(VERSION_META, version);
  metaSet("solcraft:client:updateReason", String(reason || "Refresh required").slice(0, 160));
  return { version, reason: metaGet("solcraft:client:updateReason", "Refresh required") };
}

/* live player mirror — positions/equip for the players[] payload
   without scanning the players table on every poll */
type Live = { id: number; name: string; body: number; hat: number; x: number; z: number; hp: number; equip: Equip; faceImage?: string | null; appearance?: any; level?: number; xp?: number; lastSeen: number; spectator?: boolean; spawnX?: number; spawnZ?: number };
function envNum(name: string, fallback: number) {
  const n = Number(process.env[name] || fallback);
  return Number.isFinite(n) ? n : fallback;
}
const ACTIVE_PLAYER_WINDOW_MS = Math.max(30000, envNum("SOLCRAFT_ACTIVE_PLAYER_WINDOW_MS", 120000));
const PLAYER_VIEW_RADIUS = Math.max(VIEW_RADIUS, envNum("SOLCRAFT_PLAYER_VIEW_RADIUS", 56));
const MAX_WIRE_PLAYERS = Math.max(24, envNum("SOLCRAFT_MAX_WIRE_PLAYERS", 120));
const MAX_MAP_PLAYERS = Math.max(MAX_WIRE_PLAYERS, envNum("SOLCRAFT_MAX_MAP_PLAYERS", 300));
const live = new Map<number, Live>();
function isSpectatorLike(row: any) {
  return !!row && !row.wallet && String(row.secret || "").startsWith("spectator:");
}
for (const q of db.players.select().all() as Player[]) {
  live.set(q.id, { id: q.id, name: q.name, body: q.body, hat: q.hat, x: q.x, z: q.z, hp: q.hp, equip: q.equip as Equip, faceImage: q.faceImage || null, appearance: parseAppearance((q as any).appearance), level: q.level || 1, xp: q.xp || 0, lastSeen: q.lastSeen || 0, spectator: isSpectatorLike(q), spawnX: q.spawnX ?? q.x ?? 0, spawnZ: q.spawnZ ?? q.z ?? 0 });
}
hydrateBuildingStore();
hydrateTileStore();
hydrateLootStore();
function isSpectator(p: Player | null | undefined) {
  return isSpectatorLike(p);
}
function liveTouch(p: Player) {
  let l = live.get(p.id);
  if (!l) { l = { id: p.id, name: p.name, body: p.body, hat: p.hat, x: p.x, z: p.z, hp: p.hp, equip: p.equip as Equip, faceImage: p.faceImage || null, appearance: parseAppearance((p as any).appearance), level: p.level || 1, xp: p.xp || 0, lastSeen: 0, spectator: isSpectator(p), spawnX: p.spawnX ?? p.x ?? 0, spawnZ: p.spawnZ ?? p.z ?? 0 }; live.set(p.id, l); }
  l.name = p.name; l.body = p.body; l.hat = p.hat;
  l.x = p.x; l.z = p.z; l.hp = p.hp; l.equip = p.equip as Equip; l.faceImage = p.faceImage || null; l.appearance = parseAppearance((p as any).appearance); l.level = p.level || 1; l.xp = p.xp || 0; l.spectator = isSpectator(p); l.spawnX = p.spawnX ?? p.x ?? 0; l.spawnZ = p.spawnZ ?? p.z ?? 0; l.lastSeen = now();
}
export const activeCount = () => {
  const t = now(); let n = 0;
  for (const l of live.values()) if (!l.spectator && t - l.lastSeen < ACTIVE_PLAYER_WINDOW_MS) n++;
  return n;
};


function spectatorSpawnPoint(index = 0): [number, number] {
  const t = now();
  const recent: Array<{ x: number; z: number; spawnX: number; spawnZ: number; lastSeen: number }> = [];
  for (const l of live.values()) {
    if (t - l.lastSeen > 5 * 60 * 1000) continue;
    if (l.spectator) continue;
    recent.push({
      x: Number(l.x || 0),
      z: Number(l.z || 0),
      spawnX: Number(l.spawnX ?? l.x ?? 0),
      spawnZ: Number(l.spawnZ ?? l.z ?? 0),
      lastSeen: Number(l.lastSeen || 0),
    });
  }
  const offsets = [
    [0, 0], [2, 0], [-2, 0], [0, 2], [0, -2],
    [2, 2], [-2, 2], [2, -2], [-2, -2], [3, 1], [-3, -1],
  ];
  const off = offsets[Math.abs(index) % offsets.length];
  if (recent.length) {
    // Watch the middle of current activity instead of throwing spectators to
    // spawnOrigin(+1000), which put them far out in untouched wilderness.
    recent.sort((a, b) => b.lastSeen - a.lastSeen);
    const q = recent[Math.abs(index) % Math.min(8, recent.length)];
    return [Math.round(q.spawnX + off[0]), Math.round(q.spawnZ + off[1])];
  }
  const spawnIdx = Math.max(0, (parseInt(metaGet("spawnIndex", "0"), 10) || 0) - 1);
  const [cx, cz] = spawnOrigin(spawnIdx);
  return [cx + off[0], cz + off[1]];
}

function activeMapPlayers(t = now()) {
  const out: Array<Record<string, any>> = [];
  for (const l of live.values()) {
    if (t - l.lastSeen > ACTIVE_PLAYER_WINDOW_MS) continue;
    out.push({
      id: l.id, name: l.spectator ? (l.name || "Spectator") : l.name, body: l.body, hat: l.hat,
      x: l.x, z: l.z, spawnX: l.spawnX ?? 0, spawnZ: l.spawnZ ?? 0,
      hp: l.hp, equip: l.spectator ? {} : l.equip, appearance: l.spectator ? null : (l.appearance || null),
      level: l.level || 1, xp: l.xp || 0, spectator: !!l.spectator, lastSeen: l.lastSeen, ts: l.lastSeen,
    });
  }
  return out
    .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0) || String(a.name || "").localeCompare(String(b.name || "")) || Number(a.id || 0) - Number(b.id || 0))
    .slice(0, MAX_MAP_PLAYERS);
}

function hslToHex(h: number, sat = 72, light = 55) {
  const a = sat * Math.min(light, 100 - light) / 10000;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c);
  };
  return (f(0) << 16) + (f(8) << 8) + f(4);
}
function shadeColor(hex: number, factor = 0.72) {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 255) * factor)));
  return (r << 16) + (g << 8) + b;
}
function playerPalette(indexOrSeed: number) {
  const h = (Math.abs(indexOrSeed || 0) * 137.508) % 360;
  const body = hslToHex(h, 72, 57);
  return { body, hat: shadeColor(body, 0.62) };
}

function parseAppearance(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch { return null; }
}
function normalizeAppearance(raw: any) {
  const obj = parseAppearance(raw);
  if (!obj || typeof obj !== "object") return null;
  const palette = obj.palette && typeof obj.palette === "object" ? obj.palette : {};
  const parts = obj.parts && typeof obj.parts === "object" ? obj.parts : {};
  const cleanPalette: Record<string, string> = {};
  for (const [k, v] of Object.entries(palette)) if (/^#[0-9a-fA-F]{6}$/.test(String(v))) cleanPalette[String(k).slice(0, 24)] = String(v);
  const cleanParts: Record<string, any> = {};
  for (const [k, v] of Object.entries(parts)) {
    if (k === "showHat" || k === "showBack") cleanParts[k] = !!v;
    else cleanParts[String(k).slice(0, 24)] = Math.max(0, Math.min(7, Math.trunc(Number(v) || 0)));
  }
  return {
    palette: cleanPalette,
    parts: cleanParts,
    showHat: obj.showHat == null ? cleanParts.showHat !== false : !!obj.showHat,
    showBack: obj.showBack == null ? !!cleanParts.showBack : !!obj.showBack,
  };
}
function saveAppearance(p: Player, raw: any) {
  const app = normalizeAppearance(raw);
  (p as any).appearance = app ? JSON.stringify(app).slice(0, 12000) : null;
  liveTouch(p);
  bump();
  return app;
}
function stateChangedRetry(e: any) {
  const msg = String(e?.message || e || "");
  if (/UNIQUE|constraint|SQLITE_CONSTRAINT/i.test(msg)) return err("The frontier changed at the same time. Try that action again.");
  return err("Action failed. Try again.");
}
function tx<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const out = fn(); db.exec("COMMIT"); return out; }
  catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; }
}

/* name/body lookups for tiles/buildings payloads */
const pinfo = (id: number) => live.get(id) || { name: "?", body: 0x888888, faceImage: null };

/* derived stats cache — invalidated when a player's building set changes */
const statCache = new Map<number, { regen: number; maxE: number }>();
const dropStats = (pid: number) => statCache.delete(pid);

/* chat ring — last 60 messages with their DB ids, no query per poll */
type ChatMsg = { id: number; name: string; msg: string; ts: number };
const chatRing: ChatMsg[] = ((db.chat.select().orderBy("id", "DESC").limit(60).all() as any[]) || [])
  .reverse()
  .map((c) => ({ id: c.id, name: c.sys ? "" : c.name, msg: c.msg, ts: Date.parse(c.createdAt) || 0 }));
function chatPush(name: string, msg: string, sys = 0) {
  const row = db.chat.insert({ name, msg, sys }) as any;
  chatRing.push({ id: row.id, name: sys ? "" : name, msg, ts: now() });
  if (chatRing.length > 60) chatRing.shift();
}
const sysChat = (msg: string) => chatPush("", msg, 1);

/* transient event inbox — memory-only to avoid SQLite insert/delete churn on hot toasts.
   Persistent chat remains in the DB; these events are best-effort UI notifications. */
type TransientEvent = { id: number; target: number; kind: string; msg: string; ts: number };
const MAX_TRANSIENT_EVENTS_PER_PLAYER = Math.max(8, Math.min(50, envNum("SOLCRAFT_MAX_TRANSIENT_EVENTS_PER_PLAYER", 20)));
let transientEventSeq = 1;
const eventQueue = new Map<number, TransientEvent[]>();
const hasEvents = new Set<number>();
function pushEvent(target: number, kind: string, msg: string) {
  const pid = Math.trunc(Number(target || 0));
  if (!pid) return;
  const q = eventQueue.get(pid) || [];
  q.push({
    id: transientEventSeq++,
    target: pid,
    kind: String(kind || "info").slice(0, 32),
    msg: String(msg || "").slice(0, 240),
    ts: now(),
  });
  while (q.length > MAX_TRANSIENT_EVENTS_PER_PLAYER) q.shift();
  eventQueue.set(pid, q);
  hasEvents.add(pid);
}
function drainEventsForPlayer(pid: number, t = now()) {
  if (!hasEvents.has(pid)) return [] as { kind: string; msg: string; ts: number }[];
  const rows = eventQueue.get(pid) || [];
  eventQueue.delete(pid);
  hasEvents.delete(pid);
  return rows.map((ev) => ({ kind: ev.kind, msg: ev.msg, ts: Number(ev.ts || t) }));
}
export function transientEventStatus() {
  let pending = 0;
  for (const q of eventQueue.values()) pending += q.length;
  return { players: eventQueue.size, pending, maxPerPlayer: MAX_TRANSIENT_EVENTS_PER_PLAYER };
}

/* ---------- auth ---------- */
export function auth(pid: number, secret: string): Player | null {
  const p = db.players.get(pid) as Player | null;
  if (!p || p.secret !== secret) return null;
  /* throttle the lastSeen write — one per 15s, not one per poll */
  const t = now();
  if (t - (p.lastSeen || 0) > 15000) p.lastSeen = t;
  const l = live.get(p.id);
  if (l) l.lastSeen = t; else liveTouch(p);
  return p;
}

/* ---------- derived stats / lazy energy (PURE reads) ---------- */
function ownerBuildings(pid: number): Building[] {
  return db.buildings.select().where({ owner: pid }).all() as Building[];
}
function ownerWonders(pid: number): Building[] {
  return ownerBuildings(pid).filter((b) => b.kind === "worldwonder");
}
function ownedKindCount(pid: number, kind: string): number {
  return ownerBuildings(pid).filter((b) => b.kind === kind).length;
}
function hasOwnedKind(p: Player, kind: string): boolean {
  return ownerBuildings(p.id).some((b) => b.kind === kind);
}
function ownedUpgradeStacks(pid: number, kind: string): number {
  return ownerBuildings(pid).reduce((sum, b) => b.kind === kind ? sum + Math.max(0, Math.floor(Number(b.level || 1)) - 1) : sum, 0);
}
function territoryYieldBoost(ownerId: number, boosterKind: string, amount: number, perStack = 0.25) {
  const base = Math.max(0, Math.floor(Number(amount || 0)));
  const stacks = ownerId ? ownedUpgradeStacks(ownerId, boosterKind) : 0;
  if (!base || stacks <= 0) return { base, amount: base, bonus: 0, stacks, mult: 1 };
  const mult = Math.min(3, 1 + perStack * Math.min(8, stacks));
  const boosted = Math.max(base, Math.round(base * mult));
  return { base, amount: boosted, bonus: Math.max(0, boosted - base), stacks, mult };
}
function territoryYieldNote(boost: { bonus?: number; mult?: number }, label: string) {
  return boost.bonus ? ` · ${label} upgrades +${boost.bonus}` : "";
}
function territoryYieldBonusPct(ownerId: number, boosterKind: string, perStack = 0.25) {
  return Math.max(0, territoryYieldBoost(ownerId, boosterKind, 100, perStack).amount - 100);
}
function townHallCount(pid: number): number { return ownedKindCount(pid, "townhall"); }
function warehouseCount(pid: number): number { return ownedKindCount(pid, "warehouse"); }
function granaryCount(pid: number): number { return ownedKindCount(pid, "granary"); }
function barracksCount(pid: number): number { return ownedKindCount(pid, "barracks"); }
function scienceContext() {
  return {
    nonBombBuildings: (playerId: number) => nonBombBuildings(playerId),
    buildingDef: (kind: string) => buildingDef(kind),
  };
}
function academyScienceCap(p: Player): number { return academyScienceCapFor(scienceContext(), p); }
function resourceCap(p: Player, res: string): number { return resourceCapFor(scienceContext(), p, res); }
function storageCaps(p: Player) { return storageCapsFor(scienceContext(), p); }
function scienceStatus(p: Player) { return scienceStatusFor(scienceContext(), p); }
function tileCapacityFor(p: Player): number {
  // Tile ownership is progression-gated. XP/level remain the main path, while
  // faction standing adds a small frontier trust bonus without replacing levels.
  const base = tileCapacityForProgress({ level: p.level || 1, buildings: nonBombBuildings(p.id) as any[] });
  return base + factionTileCapacityBonus(readFactionStanding(p.id));
}
function ownedTileCount(p: Player): number {
  return db.tiles.select().where({ owner: p.id }).count();
}
function tileCapacityBlockReason(p: Player, action = "claim"): string {
  const owned = ownedTileCount(p);
  const cap = tileCapacityFor(p);
  if (owned < cap) return "";
  const factionBonus = factionTileCapacityBonus(readFactionStanding(p.id));
  const factionText = factionBonus ? ` Faction standing adds +${factionBonus} trusted frontier tiles.` : "";
  return `Tile limit reached (${owned}/${cap}). ${tileCapacityExplanation({ level: p.level || 1, buildings: nonBombBuildings(p.id) as any[] })}${factionText}`;
}
function energyRefillPerMinute(p: Player) {
  return tokenRegenPerMin(Number(p.tokenBalance || 0));
}
function derived(p: Player) {
  const hit = statCache.get(p.id); if (hit) return hit;
  const hold = Number(p.tokenBalance || 0);
  const tune = gameTuning();
  let regen = (tokenRegenPerMin(hold) / 60) * tune.energyRegenMultiplier;
  let maxE = tokenMaxEnergy(hold);
  for (const b of ownerBuildings(p.id)) {
    const def = buildingDef(b.kind); if (!def) continue;
    regen += (def.regen || 0) * lvlMul(b.level || 1);
    maxE += def.maxE || 0;
  }
  regen = Math.min(regen, (ECONOMY_RULES.energyRegenHardCapPerMinute / 60) * Math.max(1, tune.energyRegenMultiplier));
  const out = { regen, maxE };
  statCache.set(p.id, out);
  return out;
}
/* read current energy/hp WITHOUT touching the row */
function energyNow(p: Player) {
  const { regen, maxE } = derived(p);
  const dt = Math.max(0, (now() - (p.energyAt || now())) / 1000);
  return {
    regen, maxE,
    energy: Math.min(maxE, p.energy + regen * dt),
    hp: Math.min(MAX_HP, p.hp),
  };
}
/* persist energy/hp — call ONLY right before spending or gaining */
function settleEnergy(p: Player) {
  const e = energyNow(p);
  p.energy = e.energy;
  p.hp = e.hp;
  p.energyAt = now();
  return e;
}
function normalBuildMs(def: BuildingDef | undefined, kind = "") {
  if (!def || def.weapon || kind === "bomb" || kind === "keep" || kind === "road" || kind === FOUNDATION_KIND) return 0;
  if (kind === "worldwonder") return WORLD_WONDER_BUILD_MS;
  if (def.decor) return DECOR_BUILDING_BUILD_MS;
  if (["townhall", "goldmine", "academy", "workshop", "vault"].includes(String(kind))) return NORMAL_BUILDING_BUILD_MS + 8000;
  return NORMAL_BUILDING_BUILD_MS;
}
function constructionWindow(b: Building): { start: number; end: number } {
  const kind = String((b as any)?.kind || "");
  if (!b || kind === "bomb" || kind === "keep") return { start: 0, end: 0 };
  const def = buildingDef(kind);
  const explicitStart = Number((b as any).constructAt || 0);
  const explicitEnd = Number((b as any).constructUntil || 0);
  if (explicitEnd > 0) return { start: explicitStart || Number(b.accAt || 0) || Math.max(0, explicitEnd - normalBuildMs(def, kind)), end: explicitEnd };

  // DB-safe construction storage: do not require new columns. New buildings store
  // construction start in accAt and construction end in cdUntil. Later building
  // cooldowns also use cdUntil, so only treat cdUntil as construction when the
  // stored window matches the expected build duration.
  const start = Number(b.accAt || 0);
  const end = Number((b as any).cdUntil || 0);
  if (!start || !end || end <= start) return { start: 0, end: 0 };
  if (kind === "worldwonder") return { start, end };
  const buildMs = normalBuildMs(def, kind);
  if (!buildMs) return { start: 0, end: 0 };
  const delta = end - start;
  if (Math.abs(delta - buildMs) <= 1500) return { start, end };
  return { start: 0, end: 0 };
}
function constructionLeftMs(b: Building): number {
  const w = constructionWindow(b);
  return Math.max(0, w.end - now());
}
function isUnderConstruction(b: Building): boolean {
  return constructionLeftMs(b) > 0;
}

/* producer stockpile, pure read */
function accNow(b: Building): number {
  const def = buildingDef(b.kind);
  if (!def?.prod) return 0;
  const w = constructionWindow(b);
  if (w.end > now()) return 0;
  const rate = (Object.values(def.prod)[0] || 0) * lvlMul(b.level || 1);
  const readyAt = Math.max(w.end || 0, Number(b.accAt || 0), 0) || now();
  const dt = Math.max(0, (now() - readyAt) / 1000);
  return Math.min(ACC_CAP, (b.acc || 0) + rate * dt);
}

/* ---------- inventory helpers ---------- */
function afford(p: Player, cost: Partial<Record<string, number>>): string[] {
  const miss: string[] = [];
  const e = energyNow(p);
  for (const [res, amt] of Object.entries(cost || {})) {
    if (!amt) continue;
    const have = res === "e" ? e.energy : (p.inv[res] || 0);
    if (have < amt) miss.push(`${amt}${res}`);
  }
  return miss;
}
function spend(p: Player, cost: Partial<Record<string, number>>) {
  settleEnergy(p);
  const inv = { ...p.inv };
  for (const [res, amt] of Object.entries(cost || {})) {
    if (!amt) continue;
    if (res === "e") p.energy = Math.max(0, p.energy - amt);
    else inv[res] = (inv[res] || 0) - amt;
  }
  p.inv = inv;
}
function gain(p: Player, out: Partial<Record<string, number>>) {
  const { maxE } = settleEnergy(p);
  const inv = { ...p.inv };
  for (const [res, amt] of Object.entries(out || {})) {
    if (!amt) continue;
    if (res === "e") p.energy = Math.min(maxE, p.energy + amt);
    else {
      const cap = resourceCap(p, res);
      const before = inv[res] || 0;
      const after = before + amt;
      // Capacity is an intake limit, not a destructive cleanup. If an older/tuned
      // save is already above cap, never silently shrink the player's resources.
      inv[res] = Number.isFinite(cap) ? Math.max(before, Math.min(cap, after)) : after;
    }
  }
  p.inv = inv;
}
function gainQuestReward(p: Player, out: Partial<Record<string, number>>) {
  // Guide/quest rewards are bonuses, not gathered intake. Do not silently drop
  // them because the player is near a storage cap; players complained that
  // rewards looked claimed but did not appear in their balance.
  const { maxE } = settleEnergy(p);
  const inv = { ...p.inv };
  for (const [res, rawAmt] of Object.entries(out || {})) {
    const amt = Math.max(0, Number(rawAmt) || 0);
    if (!amt) continue;
    if (res === "e") p.energy = Math.min(maxE, p.energy + amt);
    else inv[res] = Math.max(0, Number(inv[res] || 0) + amt);
  }
  p.inv = inv;
}
function packAdd(p: Player, item: PackItem): boolean {
  const pack = [...p.pack];
  const i = pack.findIndex((x: PackItem) => !x);
  if (i < 0) return false;
  pack[i] = item;
  p.pack = pack;
  return true;
}
function bombCount(p: Player, id: string) {
  return ((p.pack || []) as any[]).filter((it) => it && it.t === "bomb" && it.id === id).length;
}
function consumeBombItem(p: Player, id: string) {
  const pack = [...(p.pack || [])] as any[];
  const i = pack.findIndex((it) => it && it.t === "bomb" && it.id === id);
  if (i < 0) return false;
  pack[i] = null;
  p.pack = pack;
  return true;
}
const packFull = (p: Player) => (p.pack as PackItem[]).every(Boolean);

/* ---------- world queries (all indexed) ---------- */
function doodadAt(x: number, z: number): "tree" | "rock" | "food" | null {
  const ex = db.doodads.select().where({ x, z }).first() as any;
  if (ex) return ex.state === "gone" ? null : (ex.state as "tree" | "rock" | "food");
  // Claimed land is clean by default; only explicit doodad rows can put nature back there.
  if (tileAt(x, z)) return null;
  return naturalDoodad(x, z);
}
function buildingBlocksPlayer(p: Player, x: number, z: number) {
  // Roads are ground infrastructure, not blockers. World Wonder plazas are
  // handled on the client as reserved/selectable space; the server only stores
  // the Wonder center building.
  const b = buildingAt(x, z) as any;
  if (!b) return false;
  if (String(b.kind || "") === "road") return false;
  return true;
}
const walkable = (x: number, z: number) => !buildingAt(x, z) && !doodadAt(x, z) && !tradePostAt(x, z);
const walkableFor = (p: Player, x: number, z: number) => !buildingBlocksPlayer(p, x, z) && !doodadAt(x, z) && !tradePostAt(x, z);

/* ---------- milestones ---------- */
function refreshMilestones(p: Player) {
  const s = milestoneState(p);
  let idx = p.msIndex;
  let advanced = false;
  while (idx < MILESTONES.length && MILESTONES[idx].done(s)) { idx++; advanced = true; }
  if (advanced) {
    p.msIndex = idx;
    pushEvent(p.id, "milestone", idx >= MILESTONES.length ? "✦ All objectives complete!" : "✦ Objective complete!");
  }
}

/* ---------- XP & levels ---------- */
function addXp(p: Player, amt: number) {
  p.xp = (p.xp || 0) + amt;
  let leveled = false;
  while (p.xp >= xpForLevel((p.level || 1) + 1)) {
    p.xp -= xpForLevel((p.level || 1) + 1);
    p.level = (p.level || 1) + 1;
    p.skillPts = (p.skillPts || 0) + 1;
    leveled = true;
  }
  if (leveled) { dropStats(p.id); pushEvent(p.id, "milestone", `✨ Level ${p.level}!`); }
}
function autoTrainSkill(p: Player, id: string, amt = 1) {
  const def = SKILL_BY_ID[id];
  if (!def) return;
  const skills = { ...(p.skills || {}) };
  const cur = Math.max(0, Math.min(def.max, Number(skills[id] || 0)));
  if (cur >= def.max) { p.skills = skills; return; }
  const xp = { ...(p.skillXp || {}) };
  xp[id] = Math.max(0, Number(xp[id] || 0)) + Math.max(1, amt);
  let lvl = cur;
  let need = 25 * (lvl + 1);
  while (lvl < def.max && xp[id] >= need) {
    xp[id] -= need;
    lvl++;
    need = 25 * (lvl + 1);
  }
  if (lvl !== cur) {
    skills[id] = lvl;
    p.skills = skills;
    dropStats(p.id);
    pushEvent(p.id, "milestone", `${def.glyph} ${def.name} trained to Lv${lvl}`);
  } else {
    p.skills = skills;
  }
  p.skillXp = xp;
}
export function learnSkill(p: Player, id: string) {
  const def = SKILL_BY_ID[id];
  if (!def) return err("Unknown skill.");
  if ((p.skillPts || 0) < 1) return err("No skill points — level up first.");
  const cur = (p.skills || {})[id] || 0;
  if (cur >= def.max) return err(`${def.name} is already maxed.`);
  const skills = { ...(p.skills || {}) };
  skills[id] = cur + 1;
  p.skills = skills;
  p.skillPts = (p.skillPts || 0) - 1;
  dropStats(p.id); // vigor changes derived energy
  return ok({ note: `${def.glyph} ${def.name} → level ${cur + 1}` });
}

/* ---------- channelled harvest state (in-memory; no DB writes) ---------- */
const channels = new Map<number, { x: number; z: number; until: number; type?: "harvest" | "home" | "redeem" | "wonder"; gold?: number; uid?: number; tx?: number; tz?: number }>();
const clearChannel = (pid: number) => channels.delete(pid);

function playerById(id: number): Player | null {
  return db.players.get(id) as Player | null;
}
function isStarterTile(x: number, z: number): Player | null {
  for (const q of db.players.select().all() as Player[]) {
    if (Math.max(Math.abs(x - q.spawnX), Math.abs(z - q.spawnZ)) <= SPAWN_HALF) return q;
  }
  return null;
}
const META_FEE_POOL = "solcraft:economy:craftsFeePool";
const META_PAYOUT_POOL = "solcraft:economy:craftsPayoutPool";
const META_RESERVE_POOL = "solcraft:economy:craftsReservePool";
const META_PAUSE_REWARDS = "solcraft:economy:pauseRewards";
const META_PAUSE_WITHDRAWALS = "solcraft:economy:pauseWithdrawals";
const META_PAUSE_DESTROY = "solcraft:economy:pauseDestroyTools";
const META_EVENT_LOG = "solcraft:economy:eventLog";
const META_GAME_TUNING = "solcraft:economy:tuning:v2";
const OLD_META_GAME_TUNING = "solcraft:economy:tuning:v1";

const META_QUESTS = "solcraft:quests:v1";
const META_GUIDE_REWARDS_PREFIX = "solcraft:guideRewards:v1:";
const META_GUIDE_FLAGS_PREFIX = "solcraft:guideFlags:v1:";
type QuestTune = { id: string; text: string; enabled: boolean };
type GuideReward = { xp?: number; inv?: Partial<Record<string, number>> };
type GuideQuestDef = {
  id: string;
  category: "actions" | "buildings" | "economy";
  title: string;
  text: string;
  detail: string;
  reward: GuideReward;
  done: (s: ReturnType<typeof milestoneState>, p: Player) => boolean;
  action?: string;
  buildingId?: string;
  glyph?: string;
};
export const DEFAULT_QUEST_TUNING: QuestTune[] = MILESTONES.map((m, i) => ({
  id: `q${i + 1}`,
  text: m.text,
  enabled: true,
}));
function sanitizeQuestTuning(raw: any): QuestTune[] {
  const byId = new Map<string, any>();
  if (Array.isArray(raw)) for (const row of raw) byId.set(String(row?.id || ""), row);
  else if (raw && typeof raw === "object") for (const [id, row] of Object.entries(raw)) byId.set(String(id), row);
  return DEFAULT_QUEST_TUNING.map((q) => {
    const row: any = byId.get(q.id) || byId.get(String(Number(q.id.slice(1)) - 1)) || {};
    const text = String(row.text ?? row.label ?? q.text).trim().slice(0, 180) || q.text;
    const enabled = row.enabled == null ? true : !!row.enabled;
    return { id: q.id, text, enabled };
  });
}
function readQuestTuning() {
  let raw: any = [];
  try { raw = JSON.parse(metaGet(META_QUESTS, "[]") || "[]"); } catch { raw = []; }
  return sanitizeQuestTuning(raw);
}
let questTuningCache: QuestTune[] = readQuestTuning();
export function gameQuestTuning() { return questTuningCache; }
export function reloadQuestTuning() { questTuningCache = readQuestTuning(); return questTuningCache; }
export function setQuestTuning(rows: any[]) {
  const next = sanitizeQuestTuning(rows || []);
  metaSet(META_QUESTS, JSON.stringify(next));
  questTuningCache = next;
  bump();
  logEconomyEvent("questTuning", { count: next.length });
  return { ok: true, quests: next };
}
function milestoneState(p: Player) {
  const territory = db.tiles.select().where({ owner: p.id }).count();
  const buildIds = ownerBuildings(p.id).map((b) => b.kind);
  return {
    treesChopped: p.treesChopped, planksMade: p.planksMade, tradesDone: p.tradesDone,
    equippedOnce: !!p.equippedOnce, territory, gearCrafted: p.gearCrafted, buildIds,
  };
}
function playerQuestProgress(p: Player) {
  const s = milestoneState(p);
  const quests = gameQuestTuning();
  const rows = quests.map((q, i) => ({ ...q, index: i, done: !!MILESTONES[i]?.done(s) }));
  const enabled = rows.filter((q) => q.enabled);
  const done = enabled.filter((q) => q.done).length;
  const next = enabled.find((q) => !q.done) || null;
  return { done, total: enabled.length, pct: enabled.length ? Math.round((done / enabled.length) * 100) : 100, nextText: next?.text || "Complete", rows };
}

const RES_GLYPH: Record<string, string> = { w: "🪵", p: "📦", s: "🪨", f: "🌾", g: "🪙", sh: "◈", e: "⚡" };
const visibleBuildGuides = () => LIBRARY.filter((b: any) => !["bomb", "barbcamp", "wall", "gate"].includes(String(b.id || "")));
const makeGuideRewardText = (r: GuideReward) => {
  const parts: string[] = [];
  if (r.xp) parts.push(`+${r.xp} XP`);
  for (const [k, v] of Object.entries(r.inv || {})) if (v) parts.push(`+${v}${RES_GLYPH[k] || k}`);
  return parts.join(" · ") || "Guide credit";
};
const guideClaimKey = (p: Player) => `${META_GUIDE_REWARDS_PREFIX}${p.id}`;
function readGuideClaims(p: Player): Set<string> {
  try {
    const raw = JSON.parse(metaGet(guideClaimKey(p), "[]") || "[]");
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch { return new Set(); }
}
function writeGuideClaims(p: Player, claims: Set<string>) {
  metaSet(guideClaimKey(p), JSON.stringify(Array.from(claims).sort()));
}
export function adminResetGuideRewards(playerId: number, opts: { clearVisits?: boolean } = {}) {
  const id = Number(playerId || 0);
  const p = db.players.get(id) as Player | null;
  if (!p) return { ok: false, msg: "player not found", reasonCode: "PLAYER_NOT_FOUND" };
  metaSet(guideClaimKey(p), "[]");
  if (opts.clearVisits) metaSet(guideFlagKey(p), "{}");
  liveTouch(p);
  logEconomyEvent("adminResetGuideRewards", { player: p.id, clearVisits: !!opts.clearVisits });
  return {
    ok: true,
    player: { id: p.id, name: p.name, wallet: p.wallet || "" },
    guide: playerGuideProgress(p),
    msg: opts.clearVisits ? "Guide rewards and guide visit flags reset." : "Guide reward claims reset.",
  };
}
const guideFlagKey = (p: Player) => `${META_GUIDE_FLAGS_PREFIX}${p.id}`;
function readGuideFlags(p: Player): Record<string, boolean> {
  try {
    const raw = JSON.parse(metaGet(guideFlagKey(p), "{}") || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
function hasGuideFlag(p: Player, id: string) { return !!readGuideFlags(p)[id]; }
function markGuideVisit(p: Player, id: string) {
  const key = String(id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
  if (!key) return err("Unknown guide visit.");
  const flags = readGuideFlags(p);
  if (!flags[key]) {
    flags[key] = true;
    metaSet(guideFlagKey(p), JSON.stringify(flags));
  }
  return ok();
}
function hasPackItem(p: Player, type: string) {
  return (p.pack as PackItem[] || []).some((it: any) => it && it.t === type);
}
function guideQuestDefs(): GuideQuestDef[] {
  const actionGuides: GuideQuestDef[] = [
    {
      id: "action-character", category: "actions", glyph: "🧑", title: "Customize your settler", text: "Open Character and choose a style preset.",
      detail: "Click the Character button on the left HUD and choose one complete look preset. Fine-tune colors, hair, hats, and tool silhouettes are hidden from the player-facing flow.",
      reward: { xp: 10, inv: { f: 5 } }, done: (_s, p) => hasGuideFlag(p, "character"),
    },
    {
      id: "action-quests", category: "actions", glyph: "📜", title: "Open the Guide", text: "Open Quests/Guide and read your next objectives.",
      detail: "Click the Quests button on the left HUD. This panel is not a strict chain: every action and building has its own guide card and reward.",
      reward: { xp: 10, inv: { w: 5, s: 5 } }, done: (_s, p) => hasGuideFlag(p, "quests"),
    },
    {
      id: "action-chop", category: "actions", glyph: "🪓", title: "Chop a tree", text: "Use Chop (2) on a tree and pick up the dropped logs.",
      detail: "Press 2 or click Chop, stand next to a highlighted tree, then click it. Stay close until the channel finishes; drops appear on the ground instead of teleporting into your bag.",
      reward: { xp: 20, inv: { w: 15 } }, done: (s) => s.treesChopped >= 1,
    },
    {
      id: "action-mine", category: "actions", glyph: "⛏️", title: "Mine stone", text: "Use Mine (3) on a rock and pick up chunks.",
      detail: "Press 3 or click Mine, stand next to a highlighted rock, then click it. If you are holding the wrong tool, the game tells you which one to select.",
      reward: { xp: 20, inv: { s: 15 } }, done: (_s, p) => Number(p.inv?.s || 0) >= 1 || hasOwnedKind(p, "quarry"),
    },
    {
      id: "action-claim", category: "actions", glyph: "◇", title: "Capture free land", text: "Use Capture to claim any open tile outside the capital.",
      detail: "Select Capture, stand on an open tile, and claim it if you have enough storage space and action energy. Your level controls how much land you can own.",
      reward: { xp: 25, inv: { f: 10 } }, done: (s) => s.territory >= 13,
    },
    {
      id: "action-craft", category: "actions", glyph: "⚒️", title: "Craft something", text: "Open Craft (1) and make a tool or supply.",
      detail: "Press 1 or click Craft. Early recipes turn gathered resources into useful supplies; advanced recipes may need a Workshop first.",
      reward: { xp: 25, inv: { p: 5 } }, done: (s, p) => s.gearCrafted >= 1 || hasPackItem(p, "use") || hasPackItem(p, "bomb"),
    },
    {
      id: "action-spawn", category: "actions", glyph: "💣", title: "Deploy a destroy tool", text: "Craft a destroy tool, then place it with Deploy (6).",
      detail: "Destroy tools are city siege objects, not direct player attacks. Craft one first, press 6, choose the tool, and place it on open territory where it can threaten enemy infrastructure.",
      reward: { xp: 35, inv: { s: 10 } }, done: (_s, p) => ownerBuildings(p.id).some((b) => b.kind === "bomb"),
    },
    {
      id: "action-use", category: "actions", glyph: "✦", title: "Use nearby objects", text: "Use (7) handles buildings, Return Scroll, elixirs, and banks.",
      detail: "Press 7 to open usable backpack items and Return Scroll, or click a nearby building and use its panel. Return Scroll is infinite but requires standing still through its cast.",
      reward: { xp: 20, inv: { f: 8 } }, done: (_s, p) => hasOwnedKind(p, GOLD_MINE_KIND) || Number(p.tradesDone || 0) > 0,
    },
    {
      id: "action-use-pack", category: "actions", glyph: "🎒", title: "Use backpack supplies", text: "Open Use (7) and spend a stacked supply such as a ration or elixir.",
      detail: "Supplies are crafted from Craft (1) and appear as stacks in Use (7). Gear and trophies stay in your backpack; usable supplies do not need a separate inventory screen.",
      reward: { xp: 20, inv: { g: 5 } }, done: (s) => !!s.equippedOnce,
    },
    {
      id: "economy-loose-tokens", category: "economy", glyph: "🪙", title: "Collect loose tokens", text: "Walk over loose tokens that spawn on claimed land.",
      detail: "Loose tokens spawn over time on claimed tiles. When you collect them they become in-game bank tokens. Visitors collecting loose tokens on your land pay a tax share to your bank.",
      reward: { xp: 35, inv: { g: 10 } }, done: (_s, p) => Number(p.inv?.g || 0) >= 1 || Number((p as any).strongbox || 0) > 0,
    },
    {
      id: "economy-bank", category: "economy", glyph: "$", title: "Use the Bank", text: "Open Bank, generate a deposit address, scan deposits, and request withdrawals.",
      detail: `The Bank shows three separate balances: wallet $CRAFTS on-chain, in-game bank tokens you can spend here, and loose tokens collected from the map. Deposits and withdrawals go through your wallet/deposit address.`,
      reward: { xp: 50, inv: { g: 20 } }, done: (_s, p) => Number(p.tokenBalance || 0) > 0 || hasOwnedKind(p, GOLD_MINE_KIND),
    },
  ];
  const tierGuides: GuideQuestDef[] = [];
  const tierDefs: any[] = [
    { key: "chop", glyph: "🪓", name: "Chop", unit: "trees", counts: [1, 10, 50], reward: (i: number) => ({ xp: 20 + i * 25, inv: { w: 10 + i * 10 } }), done: (s: any) => Number(s.treesChopped || 0) },
    { key: "mine", glyph: "⛏️", name: "Mine", unit: "stone gathered", counts: [10, 100, 500], reward: (i: number) => ({ xp: 20 + i * 25, inv: { s: 10 + i * 10 } }), done: (_s: any, p: any) => Number(p.inv?.s || 0) },
    { key: "claim", glyph: "◇", name: "Claim", unit: "tiles", counts: [13, 40, 120], reward: (i: number) => ({ xp: 25 + i * 30, inv: { f: 10 + i * 8 } }), done: (s: any) => Number(s.territory || 0) },
    { key: "build", glyph: "🏗️", name: "Build", unit: "buildings", counts: [1, 5, 15], reward: (i: number) => ({ xp: 30 + i * 35, inv: { p: 6 + i * 6 } }), done: (s: any) => Array.isArray(s.buildIds) ? s.buildIds.length : 0 },
    { key: "bank", glyph: "$", name: "Bank", unit: "bank tokens", counts: [1, 25, 100], reward: (i: number) => ({ xp: 25 + i * 30, inv: { g: 5 + i * 5 } }), done: (_s: any, p: any) => Number(p.inv?.g || 0) },
  ];
  for (const def of tierDefs) {
    def.counts.forEach((target: number, i: number) => {
      const roman = ["I", "II", "III"][i] || String(i + 1);
      tierGuides.push({
        id: `skill-${def.key}-${i + 1}`,
        category: "skills",
        glyph: def.glyph,
        title: `${def.name} ${roman}`,
        text: `${def.name} ${target} ${def.unit}.`,
        detail: `This is a repeatable skill-style achievement tier. Progress comes naturally from playing; claim each tier for XP and supplies.`,
        reward: def.reward(i),
        done: (s: any, p: any) => def.done(s, p) >= target,
      });
    });
  }
  const buildingGuides: GuideQuestDef[] = visibleBuildGuides().map((b: any) => {
    const unlock = Number(b.unlock || 0) || 0;
    const rewardGold = b.id === GOLD_MINE_KIND ? 20 : unlock >= 25 ? 12 : 6;
    return {
      id: `building-${b.id}`,
      category: "buildings",
      buildingId: String(b.id),
      glyph: String(b.glyph || "▣"),
      title: `Build ${b.name}`,
      text: `${b.name}: ${String(b.blurb || b.effect || "City infrastructure")}`,
      detail: `Select Build (5), choose ${b.name}, then place it on valid owned land. Cost: ${Object.entries(b.cost || {}).filter(([, v]) => v).map(([k, v]) => `${v}${RES_GLYPH[k] || k}`).join(" ") || "free"}. ${unlock ? `Unlocks after ${unlock} claimed tiles. ` : ""}${b.effect || b.blurb || "It adds another useful city function."}`,
      reward: { xp: 30 + Math.min(60, unlock), inv: { g: rewardGold } },
      done: (s) => s.buildIds.includes(String(b.id)),
    } as GuideQuestDef;
  });
  return [...actionGuides, ...tierGuides, ...buildingGuides];
}
function playerGuideProgress(p: Player) {
  const s = milestoneState(p);
  const claims = readGuideClaims(p);
  const rows = guideQuestDefs().map((q) => {
    const done = !!q.done(s, p);
    const claimed = claims.has(q.id);
    return {
      id: q.id, category: q.category, title: q.title, text: q.text, detail: q.detail, glyph: q.glyph || "◇",
      action: q.action || "", buildingId: q.buildingId || "", rewardText: makeGuideRewardText(q.reward), done, claimed,
    };
  });
  const done = rows.filter((q) => q.done).length;
  const claimed = rows.filter((q) => q.claimed).length;
  const claimable = rows.filter((q) => q.done && !q.claimed).length;
  return { rows, done, total: rows.length, claimed, claimable, pct: rows.length ? Math.round((done / rows.length) * 100) : 100 };
}
function claimGuideReward(p: Player, id: string) {
  const q = guideQuestDefs().find((row) => row.id === String(id || ""));
  if (!q) return err("Unknown guide reward.");
  const claims = readGuideClaims(p);
  if (claims.has(q.id)) return err("That guide reward is already claimed.");
  const s = milestoneState(p);
  if (!q.done(s, p)) return err(`Complete “${q.title}” first.`);
  if (q.reward.inv) gainQuestReward(p, q.reward.inv);
  if (q.reward.xp) addXp(p, q.reward.xp);
  claims.add(q.id);
  writeGuideClaims(p, claims);
  liveTouch(p);
  const rewardText = makeGuideRewardText(q.reward);
  pushEvent(p.id, "milestone", `Guide reward claimed: ${q.title} · ${rewardText}`);
  return ok({
    note: `Claimed ${rewardText} for ${q.title}.`,
    inv: p.inv,
    xp: p.xp || 0,
    level: p.level || 1,
    skillPts: p.skillPts || 0,
    skillXp: (p as any).skillXp || {},
  });
}

type BuildingTune = {
  hp: number;
  unlock: number;
  regen: number;
  maxE: number;
  protect: number;
  storageBonus: number;
  foodStorageBonus: number;
  tileCapBonus: number;
  cost: Partial<Record<ResKey | "e", number>>;
  prod: Partial<Record<ResKey, number>>;
};
const cleanNum = (v: any, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const buildDefaultBuildingTuning = (): Record<string, BuildingTune> => Object.fromEntries(LIBRARY.map((b) => [b.id, {
  hp: buildMaxHp(b, 1),
  unlock: cleanNum((b as any).unlock, 0),
  regen: cleanNum((b as any).regen, 0),
  maxE: cleanNum((b as any).maxE, 0),
  protect: cleanNum((b as any).protect, 0),
  storageBonus: cleanNum((b as any).storageBonus, 0),
  foodStorageBonus: cleanNum((b as any).foodStorageBonus, 0),
  tileCapBonus: cleanNum((b as any).tileCapBonus, 0),
  cost: Object.fromEntries(Object.entries((b as any).cost || {}).map(([k, v]) => [k, Math.max(0, cleanNum(v, 0))])) as any,
  prod: Object.fromEntries(Object.entries((b as any).prod || {}).map(([k, v]) => [k, Math.max(0, cleanNum(v, 0))])) as any,
}])) as Record<string, BuildingTune>;
export const DEFAULT_BUILDING_TUNING = buildDefaultBuildingTuning();

export const DEFAULT_GAME_TUNING = {
  onlinePlayerCap: 0, // 0 = no cap
  coinBaseIntervalMs: GOLD_COIN_BASE_INTERVAL_MS,
  coinSoloIntervalMs: GOLD_COIN_SOLO_INTERVAL_MS,
  coinLowPopIntervalMs: GOLD_COIN_LOWPOP_INTERVAL_MS,
  coinTaxPct: GOLD_COIN_TAX_PCT,
  coinMaxWorld: GOLD_COIN_MAX_WORLD,
  coinTerritoryDivisor: GOLD_COIN_TERRITORY_DIVISOR,
  moveEnergy: MOVE_COST,
  claimEnergy: CLAIM_COST,
  energyRegenMultiplier: 1,
  tileBaseCapacity: ECONOMY_RULES.tileBaseCapacity,
  tileCapacityPerBuilding: ECONOMY_RULES.tileCapacityPerBuilding,
  bombCostMultiplier: 1,
  bombFuseMultiplier: 1,
  bombRadiusBonus: 0,
  buildings: DEFAULT_BUILDING_TUNING,
};
const TUNING_LIMITS: Record<string, [number, number]> = {
  onlinePlayerCap: [0, 500],
  coinBaseIntervalMs: [1000, 60000],
  coinSoloIntervalMs: [1000, 120000],
  coinLowPopIntervalMs: [1000, 90000],
  coinTaxPct: [0, 0.9],
  coinMaxWorld: [1, 10000],
  coinTerritoryDivisor: [1, 1000],
  moveEnergy: [0, 100],
  claimEnergy: [0, 500],
  energyRegenMultiplier: [0.05, 10],
  tileBaseCapacity: [9, 100000],
  tileCapacityPerBuilding: [0, 10000],
  bombCostMultiplier: [0.05, 20],
  bombFuseMultiplier: [0.05, 20],
  bombRadiusBonus: [-5, 5],
};
const BUILDING_TUNE_LIMITS: Record<string, [number, number]> = {
  hp: [1, 100000], unlock: [0, 100000], regen: [0, 100], maxE: [0, 10000], protect: [0, 100],
  storageBonus: [0, 1000000], foodStorageBonus: [0, 1000000], tileCapBonus: [0, 1000000],
};
function clampTune(k: string, v: any) {
  const [lo, hi] = TUNING_LIMITS[k] || [-1e9, 1e9];
  const n = Number(v);
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : (DEFAULT_GAME_TUNING as any)[k]));
}
function clampBuildingField(k: string, v: any, fallback: number) {
  const [lo, hi] = BUILDING_TUNE_LIMITS[k] || [0, 1_000_000];
  const n = Number(v);
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : fallback));
}
function clampResourceMap(raw: any, fallback: Partial<Record<string, number>>, max = 1000000) {
  const out: Record<string, number> = {};
  for (const k of [...RES_KEYS, "e"] as string[]) {
    const n = Number((raw && raw[k] != null ? raw[k] : (fallback as any)?.[k]) || 0);
    if (Number.isFinite(n) && n > 0) out[k] = Math.min(max, Math.max(0, n));
  }
  return out;
}
function clampBuildingTune(id: string, raw: any): BuildingTune {
  const fallback = DEFAULT_BUILDING_TUNING[id];
  const src = raw && typeof raw === "object" ? raw : {};
  const out: any = {};
  for (const k of Object.keys(BUILDING_TUNE_LIMITS)) out[k] = clampBuildingField(k, src[k], (fallback as any)[k]);
  out.cost = clampResourceMap(src.cost, fallback.cost);
  out.prod = clampResourceMap(src.prod, fallback.prod) as any;
  delete out.prod.e;
  return out as BuildingTune;
}
function sanitizeGameTuning(raw: any = {}) {
  const out: any = { ...DEFAULT_GAME_TUNING, buildings: { ...DEFAULT_BUILDING_TUNING } };
  for (const k of Object.keys(TUNING_LIMITS)) out[k] = clampTune(k, raw[k] ?? (DEFAULT_GAME_TUNING as any)[k]);
  const rawBuildings = raw?.buildings && typeof raw.buildings === "object" ? raw.buildings : {};
  out.buildings = {};
  for (const id of Object.keys(DEFAULT_BUILDING_TUNING)) out.buildings[id] = clampBuildingTune(id, rawBuildings[id]);
  return out as typeof DEFAULT_GAME_TUNING;
}
function readGameTuningFromMeta() {
  let raw: any = {};
  const text = metaGet(META_GAME_TUNING, metaGet(OLD_META_GAME_TUNING, "{}"));
  try { raw = JSON.parse(text || "{}"); } catch { raw = {}; }
  return sanitizeGameTuning(raw);
}
let gameTuningCache: typeof DEFAULT_GAME_TUNING = readGameTuningFromMeta();
export function gameTuning() {
  return gameTuningCache;
}
export function reloadGameTuning() {
  gameTuningCache = readGameTuningFromMeta();
  statCache.clear();
  return gameTuningCache;
}
export function setGameTuning(patch: Record<string, any> = {}) {
  const cur: any = JSON.parse(JSON.stringify(gameTuningCache));
  for (const [k, v] of Object.entries(patch || {})) {
    if (k === "buildings" && v && typeof v === "object") {
      cur.buildings = cur.buildings || {};
      for (const [id, row] of Object.entries(v as any)) if (id in DEFAULT_BUILDING_TUNING) cur.buildings[id] = clampBuildingTune(id, { ...(cur.buildings[id] || {}), ...(row as any), cost: { ...(cur.buildings[id]?.cost || {}), ...((row as any)?.cost || {}) }, prod: { ...(cur.buildings[id]?.prod || {}), ...((row as any)?.prod || {}) } });
    } else if (k in TUNING_LIMITS) cur[k] = clampTune(k, v);
  }
  const next = sanitizeGameTuning(cur);
  metaSet(META_GAME_TUNING, JSON.stringify(next));
  gameTuningCache = next; // force-reload the live memory object immediately for this server process
  statCache.clear();
  bump();
  logEconomyEvent("tuning", { keys: Object.keys(patch || {}).filter((k) => k in TUNING_LIMITS || k === "buildings") });
  return { ok: true, tuning: gameTuningCache, reloaded: true };
}
export function reloadGameTuningFromAdmin() {
  const tuning = reloadGameTuning();
  logEconomyEvent("tuningReload", { keys: ["memory"] });
  return { ok: true, tuning, reloaded: true };
}
export function resyncBuildingHpDefaults() {
  let changed = 0;
  for (const b of db.buildings.select().all() as Building[]) {
    if (b.kind === "bomb") continue;
    const def = buildingDef(b.kind);
    if (!def) continue;
    const owner = playerById(b.owner);
    const bonus = owner ? masonHp((owner.skills || {}) as Skills) : 0;
    const nextMax = buildMaxHp(def, b.level || 1) + bonus;
    const oldMax = Math.max(1, Number(b.maxHp || nextMax));
    const ratio = Math.max(0, Math.min(1, Number(b.hp || 0) / oldMax));
    if (Math.round(Number(b.maxHp || 0)) !== Math.round(nextMax)) {
      b.maxHp = nextMax;
      b.hp = Math.max(1, Math.min(nextMax, Math.round(nextMax * ratio)));
      changed++;
    }
  }
  if (changed) bump();
  logEconomyEvent("buildingHpResync", { changed });
  return { ok: true, changed };
}
export function buildingDef(kind: string): BuildingDef | undefined {
  const base = LIB_BY_ID[String(kind || "")];
  if (!base) return undefined;
  const tune = gameTuningCache.buildings[String(kind || "")];
  if (!tune) return base;
  const prod = Object.keys(tune.prod || {}).length ? { ...(tune.prod as any) } : undefined;
  return {
    ...base,
    hp: tune.hp,
    unlock: tune.unlock,
    regen: tune.regen,
    maxE: tune.maxE || undefined,
    protect: tune.protect || undefined,
    storageBonus: tune.storageBonus || undefined,
    foodStorageBonus: tune.foodStorageBonus || undefined,
    tileCapBonus: tune.tileCapBonus || undefined,
    cost: { ...(tune.cost as any) },
    prod,
  } as BuildingDef;
}
function publicGameTuning() {
  const t = gameTuning();
  return {
    moveEnergy: t.moveEnergy,
    claimEnergy: t.claimEnergy,
    energyRegenMultiplier: t.energyRegenMultiplier,
    onlinePlayerCap: t.onlinePlayerCap,
  };
}
const readMetaNum = (k: string) => Math.max(0, Number(metaGet(k, "0")) || 0);
const writeMetaNum = (k: string, v: number) => metaSet(k, String(Math.max(0, Math.floor(v * 1_000_000) / 1_000_000)));
const readMetaBool = (k: string) => metaGet(k, "0") === "1";
const writeMetaBool = (k: string, v: boolean) => metaSet(k, v ? "1" : "0");
function logEconomyEvent(kind: string, data: Record<string, any> = {}) {
  let rows: any[] = [];
  try { rows = JSON.parse(metaGet(META_EVENT_LOG, "[]")); } catch { rows = []; }
  rows.unshift({ t: now(), kind, ...data });
  metaSet(META_EVENT_LOG, JSON.stringify(rows.slice(0, 100)));
}

type GoldSource = { id: string; x: number; z: number; state: "barb" | "cleared" | "mining" | "ruined"; owner?: number; hp?: number; maxHp?: number; mineUid?: number | null; createdAt?: number; updatedAt?: number; manual?: boolean };
const META_GOLD_SOURCES = "solcraft:goldSources:v1";
const META_GOLD_CYCLE_AT = "solcraft:goldSources:cycleAt";
function readGoldSources(): GoldSource[] {
  // Deprecated: source/ruin fixtures were unreliable and are no longer part of runtime gameplay.
  // Keep the function for admin/backward-compat callers, but expose an empty set to the game.
  return [];
}
function writeGoldSources(rows: GoldSource[]) { metaSet(META_GOLD_SOURCES, "[]"); }
function goldSourceAt(x: number, z: number): GoldSource | null { return null; }
function nearGoldMine(p: Player): Building | null {
  const r = 2;
  const around = db.buildings.select().where(inBox(p.x, p.z, r)).all() as Building[];
  return around.find((b) => b.kind === GOLD_MINE_KIND && cheb(b.x, b.z, p.x, p.z) <= r) || null;
}
function sourceForMine(uid: number): GoldSource | null { return readGoldSources().find((g) => Number(g.mineUid || 0) === Number(uid)) || null; }
function sourceInView(ax: number, az: number, r: number) {
  return [] as any[];
}
function notifyAll(kind: string, msg: string) { for (const q of db.players.select().all() as Player[]) pushEvent(q.id, kind, msg); }
export function adminSpawnGoldSource(x: number, z: number, state: string = "barb") {
  return { ok: false, msg: "Gold Sources/Ruins are deprecated. Coins now spawn as pickups on claimed territory." };
}
export function adminUpdateGoldSource(id: string, patch: Record<string, any> = {}) {
  return { ok: false, msg: "Gold Sources/Ruins are deprecated. Use territory coin spawns instead." };
}
export function adminRemoveGoldSource(id: string) {
  return { ok: true, msg: "Gold Sources/Ruins are deprecated and no longer spawn." };
}
export function adminBroadcast(msg: string) {
  const text = String(msg || "").trim().slice(0, 220);
  if (!text) return { ok: false, msg: "message required" };
  sysChat(`📣 ${text}`); notifyAll("milestone", `📣 ${text}`); logEconomyEvent("adminBroadcast", { msg: text });
  return { ok: true };
}
function autoSeedGoldSources() {
  // Deprecated: territory coin spawns replaced source seeding.
}
function lastGoldMineOutput(mine: Building | null) {
  return 0;
}
function produceGoldFromSources() {
  return { produced: 0, mines: 0 };
}
export function collectGoldMine(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b || b.kind !== GOLD_MINE_KIND || b.owner !== p.id) return err("Not your Coin Mint.");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Walk beside your Coin Mint first.");
  const amt = Math.max(0, Math.floor(Number(b.stored || 0)));
  if (!amt) return ok({ note: "Coins now appear as territory coin pickups. Build/defend claimed land, walk over coins, then redeem purse coins here." });
  b.stored = 0; depositGold(p, amt); bump(); addXp(p, 8);
  return ok({ note: `Collected ${amt}🪙 legacy stored coins from the mint.` });
}

function destroyToolsContext() {
  return {
    gameTuning,
    packFull,
    afford,
    spend,
    packAdd,
    addXp,
    autoTrainSkill,
    bombCount,
    ok,
    err,
  };
}
function tunedDestroySpec(variant: string) { return tunedDestroySpecFor(destroyToolsContext(), variant); }

export function craftDestroyTool(p: Player, variant = "popper") {
  return craftDestroyToolFor(destroyToolsContext(), p, variant);
}

const PRODUCER_CORNER_SPOTS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const PRODUCER_EMPTY_CROSS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;

function clearProducerCrossNodes(x: number, z: number, kind: "tree" | "rock" | "food") {
  let cleared = 0;
  for (const [dx, dz] of PRODUCER_EMPTY_CROSS) {
    const row = db.doodads.select().where({ x: x + dx, z: z + dz }).first() as any;
    if (row && row.state === kind) {
      db.doodads.delete(row.id);
      cleared++;
    }
  }
  return cleared;
}

function openNodeSpotNear(x: number, z: number, kind: "tree" | "rock" | "food") {
  // Producer buildings keep the cross open for walking/reading the board.
  // Only the four diagonal border/corner cells are producer planting slots.
  for (const [dx, dz] of PRODUCER_CORNER_SPOTS) {
    const sx = x + dx, sz = z + dz;
    if (buildingAt(sx, sz) || tradePostAt(sx, sz) || doodadAt(sx, sz)) continue;
    const ex = db.doodads.select().where({ x: sx, z: sz }).first() as any;
    if (ex) ex.state = kind; else db.doodads.insert({ x: sx, z: sz, state: kind });
    return true;
  }
  return false;
}
function buildingResourceTick() {
  let spawned = 0, food = 0, cleaned = 0;
  for (const b of db.buildings.select().all() as Building[]) {
    const lvl = Math.max(1, Number(b.level || 1));
    const attempts = Math.min(4, 1 + Math.floor(lvl / 2));
    if (b.kind === "lumber") {
      cleaned += clearProducerCrossNodes(b.x, b.z, "tree");
      for (let i = 0; i < attempts; i++) if (openNodeSpotNear(b.x, b.z, "tree")) spawned++;
    }
    else if (b.kind === "quarry") {
      cleaned += clearProducerCrossNodes(b.x, b.z, "rock");
      for (let i = 0; i < attempts; i++) if (openNodeSpotNear(b.x, b.z, "rock")) spawned++;
    }
    else if (b.kind === "farm") {
      cleaned += clearProducerCrossNodes(b.x, b.z, "food");
      for (let i = 0; i < attempts; i++) if (openNodeSpotNear(b.x, b.z, "food")) { food++; spawned++; }
    }
  }
  if (spawned || food || cleaned) { bump(); logEconomyEvent("buildingResources", { spawned, food, cleaned }); }
}
export function siegeGoldSource(p: Player, idOrX: any, zMaybe?: any) {
  return err("Old gold ruins are deprecated. Use bombs against neutral Keeps; coins now come from territory coin pickups and Keep breaches.");
}
export function adminUsers() {
  return (db.players.select().all() as Player[]).map((p) => {
    const e = energyNow(p);
    const ownedTiles = db.tiles.select().where({ owner: p.id }).count();
    const ownedBuildings = nonBombBuildings(p.id).length;
    const strongbox = normalizeStrongbox(p);
    const vaultStorage = vaultStoredGold(p.id);
    return {
      id: p.id,
      name: p.name,
      wallet: p.wallet || "",
      tokenBalance: Number(p.tokenBalance || 0),
      wood: Math.floor(Number(p.inv?.w || 0)),
      stone: Math.floor(Number(p.inv?.s || 0)),
      gold: Math.floor(Number(p.inv?.g || 0)),
      vault: Math.floor(strongbox),
      strongbox: Math.floor(strongbox),
      vaultStorage: Math.floor(vaultStorage),
      energy: Math.floor(e.energy),
      maxEnergy: Math.floor(e.maxE),
      hp: Math.floor(e.hp),
      x: p.x,
      z: p.z,
      tiles: ownedTiles,
      buildings: ownedBuildings,
      guideClaimed: playerGuideProgress(p).claimed,
      guideClaimable: playerGuideProgress(p).claimable,
      lastSeen: p.lastSeen || 0,
    };
  }).sort((a, b) => b.tiles - a.tiles || b.buildings - a.buildings || a.id - b.id);
}
export function adminUpdateUser(id: number, fields: Record<string, any>) {
  const p = db.players.get(Number(id || 0)) as Player | null;
  if (!p) return { ok: false, msg: "player not found" };
  const inv = { ...(p.inv || {}) } as any;
  const num = (v: any, fallback = 0) => Math.max(0, Number(v ?? fallback) || 0);
  if (fields.name != null) p.name = String(fields.name || "Settler").trim().slice(0, 24) || "Settler";
  if (fields.wallet != null) p.wallet = String(fields.wallet || "").trim() || null;
  if (fields.tokenBalance != null) { p.tokenBalance = num(fields.tokenBalance); dropStats(p.id); }
  if (fields.wood != null) inv.w = Math.floor(num(fields.wood));
  if (fields.stone != null) inv.s = Math.floor(num(fields.stone));
  if (fields.gold != null) inv.g = Math.floor(num(fields.gold));
  if (fields.vault != null) { (p as any).strongbox = Math.min(STRONGBOX_CAP, Math.floor(num(fields.vault))); (p as any).vault = 0; }
  if (fields.energy != null) { const maxE = derived(p).maxE; p.energy = Math.min(maxE, num(fields.energy)); p.energyAt = now(); }
  if (fields.hp != null) p.hp = Math.min(MAX_HP, num(fields.hp));
  p.inv = inv;
  liveTouch(p);
  logEconomyEvent("adminUserUpdate", { id: p.id, fields: Object.keys(fields || {}) });
  return { ok: true, user: adminUsers().find((u) => u.id === p.id) };
}
export function economyControls() {
  return {
    pauseRewards: readMetaBool(META_PAUSE_REWARDS),
    pauseWithdrawals: readMetaBool(META_PAUSE_WITHDRAWALS),
    pauseDestroyTools: readMetaBool(META_PAUSE_DESTROY),
  };
}
export function setEconomyControl(name: string, value: boolean) {
  const map: Record<string, string> = {
    pauseRewards: META_PAUSE_REWARDS,
    pauseWithdrawals: META_PAUSE_WITHDRAWALS,
    pauseDestroyTools: META_PAUSE_DESTROY,
  };
  const key = map[String(name || "")];
  if (!key) return { ok: false, msg: "unknown control" };
  writeMetaBool(key, !!value);
  logEconomyEvent("control", { name, value: !!value });
  return { ok: true, controls: economyControls() };
}
function nonBombBuildings(pid: number): Building[] {
  return ownerBuildings(pid).filter((b) => b.kind !== "bomb");
}
function vaultBuildings(pid: number): Building[] {
  return nonBombBuildings(pid).filter((b) => !!buildingDef(b.kind)?.storage);
}
function normalizeStrongbox(p: Player) {
  const legacy = Math.max(0, Number((p as any).vault || 0));
  if (legacy > 0) {
    (p as any).strongbox = Math.min(STRONGBOX_CAP, Math.max(0, Number((p as any).strongbox || 0)) + legacy);
    (p as any).vault = 0;
  }
  (p as any).strongbox = Math.max(0, Math.floor(Number((p as any).strongbox || 0)));
  return (p as any).strongbox;
}
function vaultStoredGold(pid: number) {
  return vaultBuildings(pid).reduce((a, b) => a + Math.max(0, Number(b.stored || 0)), 0);
}
function depositGold(p: Player, amount: number) {
  let g = Math.max(0, Math.floor(Number(amount) || 0));
  if (!g) return { strongbox: normalizeStrongbox(p), vaulted: 0, purse: 0 };
  const sb = normalizeStrongbox(p);
  const putSafe = Math.min(g, Math.max(0, STRONGBOX_CAP - sb));
  (p as any).strongbox = sb + putSafe; g -= putSafe;
  let vaulted = 0;
  for (const v of vaultBuildings(p.id)) {
    if (g <= 0) break;
    const room = Math.max(0, VAULT_CAP - Math.max(0, Number(v.stored || 0)));
    const put = Math.min(g, room);
    if (put > 0) { v.stored = Math.max(0, Number(v.stored || 0)) + put; vaulted += put; g -= put; }
  }
  if (g > 0) { const inv = { ...p.inv }; inv.g = (inv.g || 0) + g; p.inv = inv; }
  return { strongbox: (p as any).strongbox, vaulted, purse: g };
}
function withdrawSafeGold(p: Player, amount: number) {
  let need = Math.max(0, Math.floor(Number(amount) || 0));
  if (!need) return err("Nothing to withdraw.");
  const total = normalizeStrongbox(p) + vaultStoredGold(p);
  if (total < need) return err("Not enough safe coins available.");
  let from = Math.min(need, normalizeStrongbox(p));
  (p as any).strongbox -= from; need -= from;
  for (const v of vaultBuildings(p.id)) {
    if (need <= 0) break;
    const take = Math.min(need, Math.max(0, Number(v.stored || 0)));
    if (take > 0) { v.stored = Math.max(0, Number(v.stored || 0)) - take; need -= take; }
  }
  const inv = { ...p.inv }; inv.g = (inv.g || 0) + amount; p.inv = inv;
  return ok({ note: `Withdrew ${amount}🪙 to your purse. It is now redeemable at a Coin Mint.` });
}
export function creditCraftsFeePool(amount: number) {
  const n = Math.max(0, Number(amount) || 0);
  if (!n) return { ok: false, msg: "amount" };
  writeMetaNum(META_FEE_POOL, readMetaNum(META_FEE_POOL) + n);
  logEconomyEvent("creditFees", { amount: n });
  return economyStatus();
}
export function economyStatus() {
  const goldSources = readGoldSources();
  const players = db.players.select().all() as Player[];
  const buildings = db.buildings.select().all() as Building[];
  const tiles = db.tiles.select().all() as any[];
  const redemptions = db.redemptions.select().all() as any[];
  const activeCutoff = now() - ECONOMY_RULES.activeWindowMs;
  let wood = 0, stone = 0, gold = 0, vaultGold = 0;
  for (const p of players) { wood += Number(p.inv?.w || 0); stone += Number(p.inv?.s || 0); gold += Number(p.inv?.g || 0); vaultGold += normalizeStrongbox(p) + vaultStoredGold(p.id); }
  let eventLog: any[] = [];
  try { eventLog = JSON.parse(metaGet(META_EVENT_LOG, "[]")); } catch { eventLog = []; }
  return {
    feePoolCrafts: readMetaNum(META_FEE_POOL),
    payoutPoolCrafts: readMetaNum(META_PAYOUT_POOL),
    reservePoolCrafts: readMetaNum(META_RESERVE_POOL),
    controls: economyControls(),
    counts: {
      players: players.length,
      activePlayers: players.filter((p) => (p.lastSeen || 0) >= activeCutoff).length,
      tiles: tiles.length,
      buildings: buildings.filter((b) => b.kind !== "bomb").length,
      activeDestroyTools: buildings.filter((b) => b.kind === "bomb").length,
      pendingWithdrawals: redemptions.filter((r) => r.status === "pending").length,
      goldSources: goldSources.length,
      activeGoldMines: buildings.filter((b) => b.kind === GOLD_MINE_KIND).length,
      loot: db.loot.select().count(),
      offers: db.offers.select().where({ open: 1 }).count(),
      plantedNodes: db.doodads.select().all().filter((d: any) => d.state === "tree" || d.state === "rock").length,
    },
    circulation: {
      wood: Math.floor(wood), stone: Math.floor(stone), purseGold: Math.floor(gold), vaultGold: Math.floor(vaultGold), gold: Math.floor(gold + vaultGold),
      pendingWithdrawalGold: redemptions.filter((r) => r.status === "pending").reduce((a, r) => a + Number(r.gold || 0), 0),
    },
    leaderboard: leaderboardRows(),
    economyRows: economyRows(true).sort((a, b) => b.score - a.score).slice(0, 100),
    users: adminUsers(),
    goldSources: goldSources.map((g) => { const mine = g.mineUid ? getBuilding(Number(g.mineUid)) as Building | null : null; return { ...g, owner: mine?.owner || g.owner || 0, ownerName: mine?.owner ? pinfo(mine.owner).name : "", stored: Math.floor(Number(mine?.stored || 0)), cap: GOLD_MINE_STORAGE_CAP, mineLevel: mine?.level || 0, mineHp: mine?.hp || 0, mineMaxHp: mine?.maxHp || 0, output: Math.floor(lastGoldMineOutput(mine)) }; }),
    map: { tiles: tiles.map((t:any)=>({x:t.x,z:t.z,owner:t.owner})), buildings: buildings.map((b:any)=>({id:b.id,kind:b.kind,x:b.x,z:b.z,owner:b.owner,hp:b.hp,maxHp:b.maxHp,stored:b.stored||0})) },
    eventLog,
    rules: ECONOMY_RULES,
    buildingDefs: LIBRARY.map((b) => ({ id: b.id, name: b.name, glyph: b.glyph, decor: !!b.decor, weapon: !!b.weapon, storage: !!b.storage })),
    tuning: gameTuning(),
    loginGate: publicLoginGateSettings(),
    bank: bankAdminStatus(),
    quests: gameQuestTuning(),
    questProgress: players.map((p) => ({ id: p.id, name: p.name, wallet: p.wallet || "", lastSeen: p.lastSeen || 0, ...playerQuestProgress(p) })),
  };
}
function isStarterOwnedTile(t: any) {
  const owner = playerById(t.owner);
  return !!owner && Math.max(Math.abs(t.x - owner.spawnX), Math.abs(t.z - owner.spawnZ)) <= SPAWN_HALF;
}
function economyRows(all = false) {
  const rows = new Map<number, { id: number; buildings: number; territory: number; nonStarterTiles: number; score: number; eligible: boolean; weight: number; goldReward: number }>();
  const ensure = (id: number) => {
    const r = rows.get(id) || { id, buildings: 0, territory: 0, nonStarterTiles: 0, score: 0, eligible: false, weight: 0, goldReward: 0 };
    rows.set(id, r); return r;
  };
  for (const b of db.buildings.select().all() as Building[]) {
    if (b.kind === "bomb") continue;
    ensure(b.owner).buildings++;
  }
  for (const t of db.tiles.select().all() as any[]) {
    const r = ensure(t.owner);
    r.territory++;
    if (!isStarterOwnedTile(t)) r.nonStarterTiles++;
  }
  const cutoff = now() - ECONOMY_RULES.activeWindowMs;
  for (const r of rows.values()) {
    const p = playerById(r.id);
    r.score = r.nonStarterTiles + ECONOMY_RULES.buildingScoreTiles * r.buildings;
    r.eligible = !!p && !!p.wallet && (p.lastSeen || 0) >= cutoff && Number(p.tokenBalance || 0) >= ECONOMY_RULES.minCraftsForRewards && r.score > 0;
    r.weight = r.eligible ? Math.pow(r.score, ECONOMY_RULES.leaderboardWeightPower) : 0;
  }
  return Array.from(rows.values()).filter((r) => all || r.score > 0);
}
function leaderboardRows() {
  const eligible = economyRows().filter((r) => r.eligible).sort((a, b) => b.score - a.score || b.buildings - a.buildings || b.territory - a.territory);
  const top = eligible.slice(0, ECONOMY_RULES.leaderboardWinnerCount);
  const rewards = new Map<number, number>();
  return economyRows(true)
    .map((r) => {
      const info = pinfo(r.id);
      return { id: r.id, name: info.name, body: info.body, buildings: r.buildings, territory: r.territory, nonStarterTiles: r.nonStarterTiles, score: r.score, goldReward: rewards.get(r.id) || 0 } as any;
    })
    .sort((a, b) => b.score - a.score || b.buildings - a.buildings || b.territory - a.territory || a.name.localeCompare(b.name))
    .slice(0, 20);
}
function settlePendingRedemptions() {
  const pending = db.redemptions.select().where({ status: "pending" }).all() as any[];
  const totalGold = pending.reduce((a, r) => a + Number(r.gold || 0), 0);
  const feePool = readMetaNum(META_FEE_POOL);
  if (totalGold <= 0 || feePool <= 0) return { settledGold: 0, crafts: 0, count: 0 };
  const rewardCrafts = feePool * ECONOMY_RULES.rewardPoolShare;
  const reserveCrafts = feePool * ECONOMY_RULES.reservePoolShare;
  writeMetaNum(META_FEE_POOL, 0);
  writeMetaNum(META_RESERVE_POOL, readMetaNum(META_RESERVE_POOL) + reserveCrafts);
  writeMetaNum(META_PAYOUT_POOL, readMetaNum(META_PAYOUT_POOL) + rewardCrafts);
  for (const r of pending) {
    const crafts = Math.floor((rewardCrafts * Number(r.gold || 0) / totalGold) * 1_000_000) / 1_000_000;
    (r as any).crafts = crafts;
    (r as any).status = "ready";
  }
  logEconomyEvent("redemptionSettlement", { gold: totalGold, crafts: rewardCrafts, reserveCrafts, count: pending.length });
  return { settledGold: totalGold, crafts: rewardCrafts, count: pending.length };
}
function decayOutermostTiles(p: Player, n: number) {
  const rows = (db.tiles.select().where({ owner: p.id }).all() as any[])
    .filter((t) => Math.max(Math.abs(t.x - p.spawnX), Math.abs(t.z - p.spawnZ)) > SPAWN_HALF)
    .filter((t) => !buildingAt(t.x, t.z))
    .sort((a, b) => cheb(b.x, b.z, p.spawnX, p.spawnZ) - cheb(a.x, a.z, p.spawnX, p.spawnZ));
  let dropped = 0;
  for (const t of rows) {
    if (dropped >= n) break;
    deleteTile(t);
    dropped++;
  }
  if (dropped) bump();
  return dropped;
}
function distributeBuildingRewards() {
  const t = now();
  const last = parseInt(metaGet("solcraft:buildingRewardAt", "0"), 10) || 0;
  if (t - last < BUILDING_REWARD_MS) return;
  metaSet("solcraft:buildingRewardAt", String(t));

  if (!readMetaBool(META_PAUSE_REWARDS)) {
    buildingResourceTick();
  }

  for (const p of db.players.select().all() as Player[]) {
    const cap = tileCapacityFor(p);
    const owned = ownedTileCount(p);
    if (owned <= cap) continue;
    // Older worlds may already be over capacity. Do not delete territory during
    // maintenance; new claims/captures are blocked instead so land never seems to
    // randomly disappear after a tick or refresh.
    pushEvent(p.id, "fill", `Tile capacity exceeded (${owned}/${cap}). Existing tiles are kept, but new captures are blocked until your level or settlement support increases.`);
  }

  settlePendingRedemptions();
}
function transferSurroundedBuildings(actor: Player) {
  // Buildings are never captured now. Siege them down, clear the land, then rebuild.
  return;
}

function nearBuilding(p: Player, kind: string): boolean {
  const around = db.buildings.select().where(inBox(p.x, p.z, 1)).all() as Building[];
  return around.some((b) => b.kind === kind);
}


/*   starter plots so neighbours are a short walk away.
   ============================================================ */
export async function join(name: string, body: number, hat: number, walletAuth: WalletAuthInput, appearance?: any) {
  const wallet = verifyWalletAuth(walletAuth);
  const loginGate = await assertWalletPassesLoginGate(wallet);
  return measureSync(`join wallet`, () => {
    const hasName = String(name || "").trim().length > 0;
    const cleanName = hasName ? String(name || "").trim().slice(0, 18) : "Wanderer";
    const existing = db.players.select().where({ wallet }).first() as Player | null;
    const secret = crypto.randomUUID();

    if (existing) {
      existing.secret = secret; // rotate local session every signed login
      existing.lastSeen = now();
      // Returning settlers keep their name/look; login should be just Phantom.
      if (!(existing as any).profileDone && hasName) {
        existing.name = cleanName;
        existing.body = body;
        existing.hat = hat;
        if (appearance !== undefined) saveAppearance(existing, appearance);
        (existing as any).profileDone = 1;
      }
      liveTouch(existing);
      return { id: existing.id, secret, wallet, existing: true, needsProfile: !(existing as any).profileDone, loginGate };
    }

    const cap = Math.floor(gameTuning().onlinePlayerCap || 0);
    if (cap > 0 && activeCount() >= cap) throw new Error(`World is full right now (${cap} online players). Try Spectate, then join when a slot opens.`);

    const idx = parseInt(metaGet("spawnIndex", "0"), 10);
    const [ox, oz] = spawnOrigin(idx);
    metaSet("spawnIndex", String(idx + 1));
    const pal = playerPalette(idx + 1);
    const p = db.players.insert({
      name: hasName ? cleanName : "Wanderer",
      secret, body: pal.body, hat: pal.hat, wallet,
      x: ox, z: oz, spawnX: ox, spawnZ: oz,
      hp: MAX_HP, energy: BASE_MAX, energyAt: now(),
      inv: { ...START_INV },
      pack: Array(PACK_SIZE).fill(null),
      equip: { hat: null, cape: null, armor: null, hand: null, boots: null },
      xp: 0, level: 1, skillPts: 0, skills: {},
      profileDone: hasName ? 1 : 0,
      appearance: normalizeAppearance(appearance) ? JSON.stringify(normalizeAppearance(appearance)).slice(0, 12000) : null,
      lastSeen: now(),
    }) as Player;
    /* starter plot: exactly 3x3 claimed around spawn */
    const rows: any[] = [];
    for (let x = ox - SPAWN_HALF; x <= ox + SPAWN_HALF; x++)
      for (let z = oz - SPAWN_HALF; z <= oz + SPAWN_HALF; z++)
        if (!tileAt(x, z)) rows.push({ x, z, owner: p.id });
    insertTiles(rows);
    liveTouch(p);
    if ((p as any).profileDone) sysChat(`${p.name} settled a new hold on the frontier`);
    bump();
    return { id: p.id, secret, wallet, existing: false, needsProfile: !(p as any).profileDone, spawnX: ox, spawnZ: oz, homeX: ox, homeZ: oz, loginGate };
  });
}

export function joinSpectator(name = "Spectator", appearance?: any) {
  const idx = parseInt(metaGet("spectatorIndex", "0"), 10) || 0;
  metaSet("spectatorIndex", String(idx + 1));
  const [ox, oz] = spectatorSpawnPoint(idx);
  const secret = `spectator:${crypto.randomUUID()}`;
  const pal = playerPalette(idx + 1000);
  const p = db.players.insert({
    name: String(name || "Spectator").trim().slice(0, 18) || "Spectator",
    secret, body: pal.body, hat: pal.hat, wallet: null,
    x: ox, z: oz, spawnX: ox, spawnZ: oz,
    hp: MAX_HP, energy: BASE_MAX, energyAt: now(),
    inv: { w: 0, p: 0, s: 0, f: 0, g: 0, sh: 0, sc: 0 },
    pack: Array(PACK_SIZE).fill(null),
    equip: { hat: null, cape: null, armor: null, hand: null, boots: null },
    xp: 0, level: 1, skillPts: 0, skills: {},
    profileDone: 1,
    appearance: normalizeAppearance(appearance) ? JSON.stringify(normalizeAppearance(appearance)).slice(0, 12000) : null,
    lastSeen: now(),
  }) as Player;
  liveTouch(p);
  return { id: p.id, secret, wallet: "", existing: false, needsProfile: false, spectator: true };
}

export function setupProfile(p: Player, name: string, body: number, hat: number, appearance?: any) {
  const cleanName = String(name || "").trim().slice(0, 18);
  if (!cleanName) return err("Name your settler first.");
  const wasProfileDone = !!(p as any).profileDone;
  const oldName = String(p.name || "");
  p.name = cleanName;
  p.body = Number(body) || p.body;
  p.hat = Number(hat) || p.hat;
  if (appearance !== undefined) saveAppearance(p, appearance);
  (p as any).profileDone = 1;
  liveTouch(p);
  if (!wasProfileDone || !oldName || oldName === "Wanderer") sysChat(`${p.name} settled a new hold on the frontier`);
  bump();
  pushEvent(p.id, "milestone", `Welcome home, ${p.name}. The flag was keeping your spot warm.`);
  return ok({ note: "Home base introduced. Your starter flag is ready." });
}



/* ---------- Wonder districts / roads ---------- */
const ROAD_KIND = "road";
const WONDER_DISTRICT_COIN_INTERVAL_MS = Math.max(10000, Number(process.env.SOLCRAFT_WONDER_DISTRICT_COIN_INTERVAL_MS || 45000) || 45000);
let wonderDistrictCoinTickAt = 0;
function wonderDistrictRadiusFromRecipe(recipeLike: any) {
  const size = normalizeWonderFootprint(recipeLike?.footprint || WORLD_WONDER_PLAZA_SIZE);
  if (size <= 3) return 8;
  if (size <= 5) return 12;
  if (size <= 7) return 16;
  return 20;
}
function wonderDistrictRadiusForBuildingRow(b: any) {
  return wonderDistrictRadiusFromRecipe(readWonderRecipe(Number(b?.id || 0)) || { footprint: WORLD_WONDER_PLAZA_SIZE });
}
function worldWonderDistrictAt(x: number, z: number, ownerId = 0) {
  const rows = db.buildings.select().where({ kind: "worldwonder" }).all() as any[];
  let best: any = null, bestD = Infinity;
  for (const w of rows) {
    if (ownerId && Number(w.owner || 0) !== Number(ownerId)) continue;
    const d = cheb(Number(w.x || 0), Number(w.z || 0), x, z);
    const r = wonderDistrictRadiusForBuildingRow(w);
    if (d <= r && d < bestD) { best = w; bestD = d; }
  }
  return best;
}
function roadCellForPlayer(p: Player, x: number, z: number) {
  const b = buildingAt(x, z) as any;
  if (b && String(b.kind || "") === ROAD_KIND && Number(b.owner || 0) === Number(p.id)) return true;
  return !!worldWonderDistrictAt(x, z, p.id);
}
function moveEnergyCostFor(p: Player, fromX: number, fromZ: number, toX: number, toZ: number) {
  // Travelling within a Wonder district or over player-built roads is city
  // movement, so it is free. Wilderness/frontier travel still spends energy.
  if (roadCellForPlayer(p, fromX, fromZ) || roadCellForPlayer(p, toX, toZ)) return 0;
  return gameTuning().moveEnergy;
}
function districtCoinCellOpen(x: number, z: number) {
  if (buildingAt(x, z) || doodadAt(x, z) || tradePostAt(x, z)) return false;
  if (lootAt(x, z)) return false;
  return true;
}
function wonderDistrictCoinCells(ownerId = 0) {
  const out: any[] = [];
  const wonders = db.buildings.select().where({ kind: "worldwonder" }).all() as any[];
  for (const w of wonders) {
    const wid = Number(w.id || 0), owner = Number(w.owner || 0);
    if (!owner || (ownerId && owner !== Number(ownerId))) continue;
    const r = wonderDistrictRadiusForBuildingRow(w);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const x = Number(w.x || 0) + dx, z = Number(w.z || 0) + dz;
      const t = tileAt(x, z) as any;
      if (!t || Number(t.owner || 0) !== owner) continue;
      if (!districtCoinCellOpen(x, z)) continue;
      out.push({ ...t, x, z, owner, wonderId: wid, district: true });
      if (out.length > 5000) return out;
    }
  }
  return out;
}
function prioritizeWonderDistrictTiles(playerId: number, tiles: any[]) {
  const districtKeys = new Set(wonderDistrictCoinCells(playerId).map((t: any) => key(t.x, t.z)));
  if (!districtKeys.size) return tiles;
  return [...tiles].sort((a: any, b: any) => (districtKeys.has(key(b.x, b.z)) ? 1 : 0) - (districtKeys.has(key(a.x, a.z)) ? 1 : 0));
}

/* ---------- loot & regrowth maintenance (lazy, throttled) ---------- */
let territoryCoinTickAt = 0;
function coinSpawnIntervalMs(active: number) {
  const t = gameTuning();
  if (active <= 1) return t.coinSoloIntervalMs;
  if (active <= 4) return t.coinLowPopIntervalMs;
  return t.coinBaseIntervalMs;
}
function spawnTerritoryGoldCoins() {
  const t = now();
  const active = activeCount();
  const baseTiles = db.tiles.select().all() as any[];
  if (!baseTiles.length) return;
  const districtTiles = wonderDistrictCoinCells();
  const districtMode = districtTiles.length > 0;
  const interval = districtMode ? Math.min(coinSpawnIntervalMs(active), WONDER_DISTRICT_COIN_INTERVAL_MS) : coinSpawnIntervalMs(active);
  if (t - territoryCoinTickAt < interval) return;
  territoryCoinTickAt = t;
  const existingGold = db.loot.select().where({ kind: "gold" }).count();
  const tune = gameTuning();
  const tiles = districtTiles.length ? districtTiles : baseTiles;
  const target = Math.min(tune.coinMaxWorld, Math.max(1, Math.ceil(tiles.length / Math.max(1, tune.coinTerritoryDivisor))));
  if (existingGold >= target) return;
  const attempts = Math.min(96, 12 + Math.ceil(active || 1) * 5 + (districtMode ? 20 : 0));
  const toSpawn = Math.min(Math.max(1, Math.ceil(Math.max(1, active) / 4)), target - existingGold);
  let spawned = 0;
  for (let i = 0; i < attempts && spawned < toSpawn; i++) {
    const tile = tiles[Math.floor(Math.random() * tiles.length)];
    if (!tile) continue;
    const x = Math.trunc(Number(tile.x || 0)), z = Math.trunc(Number(tile.z || 0));
    if (buildingAt(x, z) || doodadAt(x, z) || tradePostAt(x, z)) continue;
    if (lootAt(x, z)) continue;
    const amount = 1 + Math.floor(Math.random() * (active > 6 ? 4 : active > 1 ? 3 : 2)) + (tile.district ? 1 : 0);
    try { insertLoot({ x, z, kind: "gold", gid: String(amount) }); spawned++; }
    catch { /* another action filled the tile first; harmless under unique loot coordinates */ }
  }
  if (spawned) { bump(); logEconomyEvent(districtMode ? "wonderDistrictCoins" : "territoryCoins", { spawned, target, active, tiles: tiles.length, interval, districtMode }); }
}

let legacyPurgeAt = 0;
function purgeLegacyStructures() {
  const t = now();
  if (t - legacyPurgeAt < 10000) return;
  legacyPurgeAt = t;
  const legacy = (db.buildings.select().all() as Building[]).filter((b) => [BARB_CAMP_KIND, "wall", "gate"].includes(String(b.kind || "")));
  if (!legacy.length) return;
  for (const b of legacy) deleteBuilding(b);
  bump();
  logEconomyEvent("legacyStructuresPurged", { count: legacy.length });
}

const mtAt = new Map<number, number>(); // in-memory per-player maintenance throttle, no meta writes
let worldTickStarted = false;
let worldTickRunning = false;
let worldTickAt = 0;
let worldSlowTickAt = 0;
const WORLD_TICK_MS = Math.max(250, envNum("SOLCRAFT_WORLD_TICK_MS", 1000));
const WORLD_SLOW_TICK_MS = Math.max(4000, envNum("SOLCRAFT_WORLD_SLOW_TICK_MS", 8000));
let towerBombTickAt = now();
function towerRangeFor(owner: number) { return Number(buildingDef("watchtower")?.protect || TOWER_RADIUS) + Math.min(2, barracksCount(owner) * BARRACKS_TOWER_RANGE_BONUS); }
function towerDpsFor(owner: number) { return TOWER_BOMB_DPS * (1 + Math.min(2, barracksCount(owner)) * BARRACKS_TOWER_DPS_BONUS); }
function towerCutFor(owner: number) { return Math.min(0.80, TOWER_BOMB_DMG_CUT + Math.min(2, barracksCount(owner)) * BARRACKS_TOOL_DAMAGE_CUT_BONUS); }
function towerBombTick() {
  const t = now();
  const dt = Math.min(2, Math.max(0, (t - towerBombTickAt) / 1000));
  if (dt <= 0.05) return;
  towerBombTickAt = t;
  const bombs = db.buildings.select().where({ kind: "bomb" }).all() as Building[];
  if (!bombs.length) return;
  const towers = db.buildings.select().where({ kind: "watchtower" }).all() as Building[];
  for (const bomb of bombs) {
    let dmg = 0;
    for (const tw of towers) {
      if (tw.owner === bomb.owner) continue;
      if (cheb(tw.x, tw.z, bomb.x, bomb.z) <= towerRangeFor(tw.owner)) dmg += towerDpsFor(tw.owner) * dt;
    }
    if (dmg <= 0) continue;
    bomb.hp = Math.max(0, Number(bomb.hp || 0) - dmg);
    if (bomb.hp <= 0) { deleteBuilding(bomb); if (bomb.owner) pushEvent(bomb.owner, "raid", "🏹 A Watchtower destroyed your active tool."); bump(); }
  }
}
let armedBombResolveAt = 0;
function destroyToolFuseMsFor(b: Building) {
  const spec = tunedDestroySpec(String((b as any).nm || "popper"));
  return Math.max(1000, Number((spec as any).fuseMs || BOMB_FUSE_MS || 12000));
}
function normalizeBombFuseEnd(b: Building, t = now()) {
  // Older patch builds could create visible bomb buildings without a usable
  // cdUntil, which made them sit forever. Treat accAt/usedAt as the planted
  // timestamp and repair the row on the next tick.
  let end = Number((b as any).cdUntil || 0);
  if (end > 0 && end < 100000000000) end *= 1000; // tolerate accidental seconds timestamps
  if (!Number.isFinite(end) || end <= 0) {
    const planted = Math.max(0, Number((b as any).accAt || (b as any).usedAt || 0));
    end = planted > 0 ? planted + destroyToolFuseMsFor(b) : t + 1000;
  }
  if (Number((b as any).cdUntil || 0) !== end) (b as any).cdUntil = end;
  return end;
}
function resolveArmedBombs(opts: { force?: boolean; reason?: string } = {}) {
  const t = now();
  // Bomb fuses must feel real-time. Do not hide them behind the slower
  // maintenance throttle for coin spawning/regrowth; otherwise planted
  // tools can look stuck while the player is actively watching them.
  if (!opts.force && t - armedBombResolveAt < 250) return 0;
  armedBombResolveAt = t;
  let detonated = 0;
  const bombs = (db.buildings.select().where({ kind: "bomb" }).all() as Building[])
    .sort((a, b) => normalizeBombFuseEnd(a, t) - normalizeBombFuseEnd(b, t));
  for (const b of bombs) {
    // It may already be gone because a previous blast in this same pass hit it.
    const liveBomb = getBuilding(b.id) as Building | null;
    if (!liveBomb || liveBomb.kind !== "bomb") continue;
    const end = normalizeBombFuseEnd(liveBomb, t);
    if (!opts.force && end > t) continue;
    const owner = db.players.get(liveBomb.owner) as Player | null;
    if (!owner) { deleteBuilding(liveBomb); bump(); continue; }
    try {
      detonateBomb(owner, liveBomb);
      detonated++;
    } catch (e: any) {
      // Never let one broken tool freeze every other fuse. Leave this one
      // expired but mark a small cooldown so admin/debug state can reveal it.
      (liveBomb as any).cdUntil = t - 1;
      pushEvent(owner.id, "raid", `⚠ ${liveBomb.nm || "Destroy tool"} failed to resolve: ${String(e?.message || e || "unknown error")}`);
    }
  }
  return detonated;
}
export function adminBombsStatus() {
  const t = now();
  const bombs = (db.buildings.select().where({ kind: "bomb" }).all() as Building[]).map((b: any) => {
    const end = normalizeBombFuseEnd(b as Building, t);
    const owner = db.players.get(Number(b.owner || 0)) as Player | null;
    return {
      id: b.id, owner: b.owner, ownerName: owner?.name || `#${b.owner}`, kind: b.kind, variant: b.nm || "popper",
      x: b.x, z: b.z, hp: b.hp, maxHp: b.maxHp, accAt: b.accAt || 0, cdUntil: end,
      fuseLeftMs: Math.max(0, end - t), expired: end <= t,
    };
  });
  return ok({ bombs, count: bombs.length, expired: bombs.filter((b: any) => b.expired).length, now: t });
}
export function adminForceResolveBombs() {
  const resolved = resolveArmedBombs({ force: true, reason: "admin" });
  return ok({ resolved, ...((adminBombsStatus() as any) || {}) });
}
function maintainActivePlayer(p: Player, t = now()) {
  if (!p || isSpectator(p)) return;
  if (t - (mtAt.get(p.id) || 0) < WORLD_SLOW_TICK_MS) return;
  mtAt.set(p.id, t);
  autoEatFoodForHealth(p, t);
}

function materializeKeepsAroundActivePlayers(t = now(), limit = 12) {
  let done = 0;
  const active = [...live.values()]
    .filter((l) => !l.spectator && t - l.lastSeen < ACTIVE_PLAYER_WINDOW_MS)
    .sort((a, b) => Number(b.lastSeen || 0) - Number(a.lastSeen || 0));
  for (const l of active) {
    materializeProceduralKeepsAround(Math.trunc(Number(l.x || 0)), Math.trunc(Number(l.z || 0)));
    done++;
    if (done >= limit) break;
  }
}

export function maintainWorld(t = now()) {
  purgeLegacyStructures();
  towerBombTick();
  resolveArmedBombs();

  if (t - worldSlowTickAt >= WORLD_SLOW_TICK_MS) {
    worldSlowTickAt = t;
    distributeBuildingRewards();
    /* regrow: harvested doodads recover after 4 minutes */
    const dead = db.doodads.select().where({ state: "gone", updatedAt: { $lt: new Date(t - 240000).toISOString() } as any });
    const n = (dead as any).count?.() ?? 0;
    if (n > 0) { (dead as any).deleteAll?.(); bump(); }
    spawnTerritoryGoldCoins();
    materializeKeepsAroundActivePlayers(t);
  }

  for (const l of live.values()) {
    if (l.spectator || t - l.lastSeen > ACTIVE_PLAYER_WINDOW_MS) continue;
    const p = db.players.get(l.id) as Player | null;
    if (p) maintainActivePlayer(p, t);
  }
}

export function runWorldTick(reason = "manual") {
  const t = now();
  if (worldTickRunning || t - worldTickAt < WORLD_TICK_MS) return { ok: true, skipped: true, reason, nextInMs: Math.max(0, WORLD_TICK_MS - (t - worldTickAt)) };
  worldTickRunning = true;
  worldTickAt = t;
  try {
    maintainWorld(t);
    return { ok: true, skipped: false, reason, at: t, events: transientEventStatus() };
  } catch (e: any) {
    console.error("[worldTick]", e);
    return { ok: false, skipped: false, reason, at: t, msg: String(e?.message || e || "world tick failed") };
  } finally {
    worldTickRunning = false;
  }
}

export function ensureWorldTickStarted() {
  if (worldTickStarted) return;
  worldTickStarted = true;
  const interval = setInterval(() => { runWorldTick("interval"); }, WORLD_TICK_MS);
  (interval as any)?.unref?.();
}

export function worldTickStatus() {
  return { started: worldTickStarted, running: worldTickRunning, lastTickAt: worldTickAt, lastSlowTickAt: worldSlowTickAt, tickMs: WORLD_TICK_MS, slowTickMs: WORLD_SLOW_TICK_MS, events: transientEventStatus(), buildingCache: buildingCacheStats(), tileCache: tileCacheStats(), lootCache: lootCacheStats() };
}

/* ============================================================
   SNAPSHOT
   Client sends (rev, ax, az, chatId). If rev === worldRev and
   the anchor matches, the world payload is OMITTED ENTIRELY —
   only me / nearby players / new chat / events go on the wire.
   ============================================================ */
export function snapshot(p: Player, q: { rev: number; ax: number; az: number; chat: number; mapRev?: number }): Snapshot {
  const run = () => {
    const t = now();
    const e = energyNow(p); // pure — NO write per poll

    const [ax, az] = anchorOf(p.x, p.z);
    const worldSame = q.rev === worldRev && q.ax === ax && q.az === az && Number(q.mapRev || 0) === worldRev;

    /* players: from the live mirror, view-filtered, zero queries */
    const players = [];
    for (const l of live.values()) {
      if (l.id === p.id || t - l.lastSeen > ACTIVE_PLAYER_WINDOW_MS) continue;
      const dist = cheb(l.x, l.z, p.x, p.z);
      if (dist > PLAYER_VIEW_RADIUS) continue;
      players.push({ id: l.id, name: l.spectator ? (l.name || "Spectator") : l.name, body: l.body, hat: l.hat, x: l.x, z: l.z, hp: l.hp, equip: l.spectator ? {} : l.equip, appearance: l.spectator ? null : (l.appearance || null), level: l.level || 1, xp: l.xp || 0, spectator: !!l.spectator, ts: l.lastSeen, lastSeen: l.lastSeen, dist });
    }
    players.sort((a: any, b: any) => Number(a.dist || 0) - Number(b.dist || 0) || Number(b.ts || 0) - Number(a.ts || 0));
    if (players.length > MAX_WIRE_PLAYERS) players.length = MAX_WIRE_PLAYERS;
    for (const row of players as any[]) delete row.dist;

    const mapPlayers = activeMapPlayers(t);

    /* chat: only what the client hasn't seen, from the ring */
    const chat = chatRing.filter((c) => c.id > (q.chat || 0));

    /* events: memory-only transient toasts; no SQLite insert/delete per delivery */
    const events = drainEventsForPlayer(p.id, t);

    const territory = db.tiles.select().where({ owner: p.id }).count();
    const built = nonBombBuildings(p.id).length;

    const guide = playerGuideProgress(p);
    const me: MeWire = {
      id: p.id, name: p.name, body: p.body, hat: p.hat, x: p.x, z: p.z, spawnX: p.spawnX, spawnZ: p.spawnZ, appearance: parseAppearance((p as any).appearance),
      energy: e.energy, maxE: e.maxE, regen: e.regen, hp: e.hp, wallet: p.wallet ?? null, tokenBalance: p.tokenBalance || 0, strongbox: normalizeStrongbox(p), vaultGold: vaultStoredGold(p.id), biome: biomeAt(p.x, p.z).name,
      wonders: ownerWonders(p.id).map((b) => { const wr = readWonderRecipe(Number(b.id)); return { uid: Number(b.id), x: Number(b.x), z: Number(b.z), name: b.nm || wr?.name || null, prompt: wr?.prompt || "" }; }),
      inv: p.inv as Inv, pack: p.pack as PackItem[], equip: p.equip as Equip, scienceCap: resourceCap(p, "sc"),
      xp: p.xp || 0, level: p.level || 1, skillPts: p.skillPts || 0, skills: (p.skills || {}) as Skills, skillXp: (p.skillXp || {}) as any,
      territory, built, msIndex: p.msIndex,
      treesChopped: p.treesChopped, planksMade: p.planksMade,
      gearCrafted: p.gearCrafted, tradesDone: p.tradesDone, equippedOnce: !!p.equippedOnce,
      clientVersion: "", requiredVersion: clientRequiredVersion(), updateReason: clientUpdateReason(), profileDone: !!(p as any).profileDone, spectator: isSpectator(p),
      tileCap: tileCapacityFor(p), storageCap: storageCaps(p), tuning: publicGameTuning(), quests: gameQuestTuning(), factions: factionSummaryForWire(p.id),
      guideQuests: guide.rows, guideSummary: { done: guide.done, total: guide.total, claimed: guide.claimed, claimable: guide.claimable, pct: guide.pct }, bank: bankStatusForPlayer(p),
    } as any;

    if (worldSame) return { now: t, me, players, mapPlayers, chat, events, leaderboard: leaderboardRows(), requiredVersion: clientRequiredVersion(), updateReason: clientUpdateReason() } as any;

    /* world payload — indexed BOX queries around the anchor only */
    const R = VIEW_RADIUS + ANCHOR_PAD;
    const tiles = db.tiles.select().where(inBox(ax, az, R)).all() as any[];
    const buildings = db.buildings.select().where(inBox(ax, az, R)).all() as any[];
    const doodads = db.doodads.select().where(inBox(ax, az, R)).all() as any[];
    const loot = db.loot.select().where(inBox(ax, az, R)).all() as any[];
    const offers = db.offers.select().where({ open: 1 }).orderBy("id", "DESC").limit(20).all() as any[];

    const includeMap = Number(q.mapRev || 0) !== worldRev;
    const mapTiles = includeMap ? (db.tiles.select().all() as any[]).map((r) => ({ x: r.x, z: r.z, owner: r.owner, ownerBody: pinfo(r.owner).body, ownerName: pinfo(r.owner).name })) : [];
    const mapBuildings = includeMap ? (db.buildings.select().all() as any[]).map((b) => ({ uid: b.id, owner: b.owner, ownerBody: pinfo(b.owner).body, kind: b.kind, x: b.x, z: b.z })) : [];
    const mapLoot = includeMap ? (db.loot.select().where({ kind: "gold" }).all() as any[]).map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, gid: l.gid })) : [];

    const world: WorldWire = {
      rev: worldRev, ax, az,
      tiles: tiles.map((r) => ({ x: r.x, z: r.z, owner: r.owner, ownerBody: pinfo(r.owner).body, ownerName: pinfo(r.owner).name })),
      buildings: buildings.map((b) => {
        const def = buildingDef(b.kind);
        return {
          uid: b.id, owner: b.owner, ownerName: pinfo(b.owner).name, ownerBody: pinfo(b.owner).body, ownerFace: null,
          kind: b.kind, x: b.x, z: b.z, nm: b.nm, cl: b.cl,
          acc: b.acc, accAt: b.accAt, cdUntil: b.cdUntil, ...(() => { const w = constructionWindow(b as any); return { constructAt: w.start, constructUntil: w.end }; })(), usedAt: Number((b as any).usedAt || 0),
          level: b.level || 1, hp: b.hp, maxHp: b.maxHp || buildMaxHp(def, b.level || 1), stored: Number(b.stored || 0),
          wonder: b.kind === "worldwonder" ? readWonderRecipe(Number(b.id)) : null,
        };
      }),
      doodads: doodads.map((d) => ({ x: d.x, z: d.z, type: d.state === "gone" ? "gone" : (d.state === "rock" ? "rock" : d.state === "food" ? "food" : "tree") })),
      loot: loot.map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, gid: l.gid })),
      offers: offers.map((o) => ({ id: o.id, byId: o.byId, byName: o.byName, gRes: o.gRes, gAmt: o.gAmt, wRes: o.wRes, wAmt: o.wAmt })),
      goldSources: sourceInView(ax, az, 1000000),
      map: includeMap ? { rev: worldRev, tiles: mapTiles, buildings: mapBuildings, loot: mapLoot, players: mapPlayers } : undefined,
    };
    return { now: t, me, players, mapPlayers, chat, events, leaderboard: leaderboardRows(), requiredVersion: clientRequiredVersion(), updateReason: clientUpdateReason(), world } as any;
  };
  if (process.env.SOLCRAFT_MEASURE_SNAPSHOTS !== "0") {
    return measureSync(`snapshot player=${p.id}`, run, (r: any) => snapshotMeasureFields(r, p.id)) as Snapshot;
  }
  return run() as Snapshot;
}

/* ============================================================
   ACTIONS
   ============================================================ */
const FOOD_HEAL_AMOUNT = 8;
const FOOD_HEAL_INTERVAL_MS = 8000;
function autoEatFoodForHealth(p: Player, t = now()) {
  const live = energyNow(p);
  if (live.hp >= MAX_HP - 0.001) return { hp: live.hp, eaten: 0 };
  if (t - Number((p as any).lastFoodHealAt || 0) < FOOD_HEAL_INTERVAL_MS) return { hp: live.hp, eaten: 0 };
  const food = Math.floor(Number(p.inv?.f || 0));
  if (food <= 0) return { hp: live.hp, eaten: 0 };
  p.inv.f = Math.max(0, Number(p.inv.f || 0) - 1);
  p.hp = Math.min(MAX_HP, live.hp + FOOD_HEAL_AMOUNT);
  (p as any).lastFoodHealAt = t;
  liveTouch(p);
  return { hp: p.hp, eaten: 1 };
}

export function move(p: Player, x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return err("Bad destination.");
  if (!Number.isInteger(x) || !Number.isInteger(z)) return err("bad coords");
  if (cheb(x, z, p.x, p.z) > 1) return err("Move rejected: one tile at a time.");
  if (!walkableFor(p, x, z)) {
    const b = buildingAt(x, z);
    return err(doodadAt(x, z) ? "That tree blocks the path. Walk around it or chop it first." : "That spot is occupied.");
  }
  const e = settleEnergy(p);
  // Walking must never hard-stop the player. Energy is now primarily an action
  // throttle for gathering, claiming, building, and fighting. Calling
  // settleEnergy() here still lets energy recover naturally while the player
  // is travelling, and resting recovers it faster because no actions spend it.
  p.energy = e.energy;
  p.energyAt = now();
  p.x = x; p.z = z;
  clearChannel(p.id); // moving away cancels any in-progress channel
  liveTouch(p);
  const l = lootAt(x, z) as any;
  if (l) {
    if (isSpectator(p)) return ok({ energy: p.energy, x: p.x, z: p.z, inv: p.inv, xp: p.xp, level: p.level, note: "Spectator ghost: pickups are visible but cannot be collected." });
    const r = collectLoot(p, l) as any;
    return r && r.ok ? { ...r, energy: p.energy, x: p.x, z: p.z, inv: p.inv, xp: p.xp, level: p.level } : r;
  }
  return ok({ energy: p.energy, x: p.x, z: p.z, inv: p.inv, xp: p.xp, level: p.level });
}

const MAX_MOVE_PATH_STEPS = Math.max(1, Math.min(32, Number(process.env.SOLCRAFT_MAX_MOVE_PATH_STEPS || 18) || 18));

export function movePath(p: Player, rawSteps: any) {
  const input = Array.isArray(rawSteps) ? rawSteps : [];
  const steps = input
    .slice(0, MAX_MOVE_PATH_STEPS)
    .map((s: any) => ({ x: Number(s?.x), z: Number(s?.z) }))
    .filter((s: any) => Number.isInteger(s.x) && Number.isInteger(s.z));
  if (!steps.length) return err("No movement path.");

  const accepted: Array<{ x: number; z: number }> = [];
  let stopped: any = null;
  for (const step of steps) {
    const r = move(p, step.x, step.z) as any;
    if (!r || !r.ok) { stopped = r || err("Movement stopped."); break; }
    accepted.push({ x: p.x, z: p.z });
  }

  if (!accepted.length) return stopped || err("Movement stopped.");
  return ok({
    path: accepted,
    partial: !!stopped,
    stoppedMsg: stopped?.msg || "",
    energy: p.energy,
    x: p.x,
    z: p.z,
    inv: p.inv,
    xp: p.xp,
    level: p.level,
  });
}


export function adminMapTeleport(p: Player, rawX: any, rawZ: any) {
  if (!isAdminPlayer(p)) return err("Only the world admin can use map jump.");
  const x = Number(rawX), z = Number(rawZ);
  if (!Number.isInteger(x) || !Number.isInteger(z)) return err("Bad map jump destination.");
  const landing = walkableFor(p, x, z) ? { x, z } : (() => {
    const spots = [[0,0], ...N8, [2,0],[-2,0],[0,2],[0,-2],[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[-1,2],[1,-2],[-1,-2]];
    for (const [dx, dz] of spots) {
      const nx = x + dx, nz = z + dz;
      if (walkableFor(p, nx, nz)) return { x: nx, z: nz };
    }
    return null;
  })();
  if (!landing) return err("No walkable landing tile near that point.");
  p.x = landing.x; p.z = landing.z;
  clearChannel(p.id);
  liveTouch(p);
  bump();
  return ok({ x: p.x, z: p.z, note: `Admin map jump → ${p.x},${p.z}` });
}

function collectLoot(p: Player, l: any) {
  if (isSpectator(p)) return err("Spectator ghosts can see pickups but cannot collect them.", "SPECTATOR_NO_PICKUP");
  const fresh = getLoot(l.id) as any;
  if (!fresh) return err("That pickup was already collected.");
  l = fresh;
  deleteLoot(l);
  bump();
  let note = "";
  if (l.kind === "wood") { const amt = Math.max(1, Math.floor(Number(l.gid || 5) || 5)); gain(p, { w: amt }); note = `+${amt} wood 🪵`; }
  else if (l.kind === "stone") { const amt = Math.max(1, Math.floor(Number(l.gid || 4) || 4)); gain(p, { s: amt }); note = `+${amt} stone 🪨`; }
  else if (l.kind === "food") { const amt = Math.max(1, Math.floor(Number(l.gid || 3) || 3)); gain(p, { f: amt }); note = `+${amt} food 🌾`; }
  else if (l.kind === "gold") {
    const baseAmt = Math.max(1, Math.floor(Number(l.gid || 3) || 3));
    const land = tileAt(l.x, l.z) as any;
    const ownerId = Number(land?.owner || 0);
    let take = baseAmt;
    let tax = 0;
    let mintBonus = 0;
    if (ownerId === p.id) {
      const boost = territoryYieldBoost(p.id, GOLD_MINE_KIND, baseAmt, 0.20);
      take = boost.amount;
      mintBonus = boost.bonus;
    } else if (ownerId) {
      tax = Math.max(1, Math.floor(baseAmt * gameTuning().coinTaxPct));
      if (tax >= baseAmt) tax = Math.max(0, baseAmt - 1);
      take = Math.max(0, baseAmt - tax);
      const ownerTaxBoost = territoryYieldBoost(ownerId, GOLD_MINE_KIND, tax, 0.20);
      tax = ownerTaxBoost.amount;
      mintBonus = ownerTaxBoost.bonus;
    }
    if (take) gain(p, { g: take });
    if (tax) {
      const owner = playerById(ownerId);
      if (owner) { gain(owner, { g: tax }); pushEvent(owner.id, "fill", `🪙 Territory tax: +${tax}🪙${mintBonus ? ` (${mintBonus} from Coin Mint upgrades)` : ""} from ${p.name}'s pickup at ${l.x}, ${l.z}.`); }
    }
    p.tradesDone = (p.tradesDone || 0) + 1;
    if (tax) note = `+${take} coins 🪙 (${tax} tax paid${mintBonus ? `, +${mintBonus} mint bonus` : ""})`;
    else note = mintBonus ? `+${take} coins 🪙 (+${mintBonus} mint bonus)` : `+${take} coins 🪙`;
  }
  else { note = "old unbacked trinket archived"; }
  addXp(p, 1);
  refreshMilestones(p);
  return ok({ note: `Picked up ${note}.`, lootGone: l.id, inv: p.inv, xp: p.xp, level: p.level });
}

function touchesOwnLand(p: Player, x: number, z: number): boolean {
  return N4.some(([dx, dz]) => tileAt(x + dx, z + dz)?.owner === p.id);
}
function ownsBuildPad(p: Player, x: number, z: number): boolean {
  if (tileAt(x, z)?.owner !== p.id) return false;
  return N8.every(([dx, dz]) => tileAt(x + dx, z + dz)?.owner === p.id);
}
function adjacentEnemyTile(p: Player, x: number, z: number) {
  for (const [dx, dz] of N4) {
    const t = tileAt(x + dx, z + dz) as any;
    if (t && t.owner !== p.id) return { x: x + dx, z: z + dz, tile: t };
  }
  return null;
}
function buildPadRadius(kind = "") { if (kind === ROAD_KIND) return 0; return kind === "worldwonder" ? WORLD_WONDER_PLAZA_RADIUS : 1; }
function buildPadName(kind = "") { return kind === "worldwonder" ? `${WORLD_WONDER_PLAZA_SIZE}×${WORLD_WONDER_PLAZA_SIZE} Wonder plaza` : "building foundation"; }
function buildPadOffsets(kind = ""): [number, number][] {
  const r = buildPadRadius(kind);
  const out: [number, number][] = [];
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx || dz) out.push([dx, dz]);
  return out;
}

function wonderRecipeForBuilding(b: any) {
  if (!b || b.kind !== "worldwonder") return null;
  return readWonderRecipe(Number(b.id));
}
function wonderRadiusForBuilding(b: any) {
  return wonderFootprintRadius(wonderRecipeForBuilding(b) || { footprint: WORLD_WONDER_PLAZA_SIZE });
}
function wonderSizeForRecipe(recipe: any) {
  return normalizeWonderFootprint(recipe?.footprint || WORLD_WONDER_PLAZA_SIZE);
}
function worldWonderFootprintAt(x: number, z: number, ignoreId = 0) {
  const rows = db.buildings.select().where({ kind: "worldwonder" }).all() as any[];
  return rows.find((b) => {
    if (Number(b.id) === Number(ignoreId || 0)) return false;
    const r = wonderRadiusForBuilding(b);
    return Math.abs(Number(b.x) - x) <= r && Math.abs(Number(b.z) - z) <= r;
  }) || null;
}
function buildPadProblem(p: Player, x: number, z: number, kind = "", recipeLike: any = null): string | null {
  const def = buildingDef(kind);
  const pad = buildPadName(kind);
  if (tradePostAt(x, z)) return "The trade post refuses to be redecorated.";
  if (kind === ROAD_KIND) return "Road building is disabled in this build.";
  if (kind === "worldwonder") {
    if (buildingAt(x, z)) return "Occupied.";
    const size = wonderSizeForRecipe(recipeLike);
    const r = wonderFootprintRadius({ footprint: size });
    const tiles = size * size;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const sx = x + dx, sz = z + dz;
      const st = tileAt(sx, sz);
      if (st && st.owner !== p.id) return "World Wonders need an open frontier plaza, not someone else's claimed land.";
      if (worldWonderFootprintAt(sx, sz)) return `Another World Wonder plaza already reserves part of that ${size}×${size} space.`;
      if (buildingAt(sx, sz)) return `The ${size}×${size} Wonder plaza (${tiles} tiles) is blocked by another building.`;
      if (tradePostAt(sx, sz)) return "A public trade post sits in that Wonder plaza.";
    }
    return null;
  }
  if (worldWonderFootprintAt(x, z)) return "A World Wonder plaza reserves this space.";
  const center = tileAt(x, z);
  if (!center || center.owner !== p.id) return `Build on YOUR claimed land. ${def?.name || "This building"} also needs a clear claimed ${pad}.`;
  if (buildingAt(x, z)) return "Occupied.";
  if (doodadAt(x, z)) return "Clear the tree or rock on the center tile first.";
  if (isFoundationBuildKind(kind)) return null;
  for (const [dx, dz] of buildPadOffsets(kind)) {
    const sx = x + dx, sz = z + dz;
    const st = tileAt(sx, sz);
    if (!st || st.owner !== p.id) return `Claim the full ${pad} first.`;
    if (worldWonderFootprintAt(sx, sz)) return "A World Wonder plaza reserves part of this build pad.";
    if (buildingAt(sx, sz)) return `The ${pad} is blocked by another building.`;
    if (doodadAt(sx, sz)) return `Clear trees and rocks from the ${pad} first.`;
    if (tradePostAt(sx, sz)) return `A public trade post sits in that ${pad}.`;
  }
  return null;
}


function ownerMainIslandHas(ownerId: number, x: number, z: number): boolean {
  const owner = playerById(ownerId);
  if (!owner) return false;
  const start = tileAt(owner.spawnX, owner.spawnZ);
  if (!start || start.owner !== ownerId) return false;
  const goal = key(x, z);
  const q: [number, number][] = [[owner.spawnX, owner.spawnZ]];
  const seen = new Set<string>([key(owner.spawnX, owner.spawnZ)]);
  while (q.length && seen.size < 20000) {
    const [cx, cz] = q.shift()!;
    if (key(cx, cz) === goal) return true;
    for (const [dx, dz] of N4) {
      const nx = cx + dx, nz = cz + dz, nk = key(nx, nz);
      if (seen.has(nk)) continue;
      const nt = tileAt(nx, nz);
      if (!nt || nt.owner !== ownerId) continue;
      seen.add(nk); q.push([nx, nz]);
    }
  }
  return false;
}
function captureDisconnectedTile(p: Player, t: any, x: number, z: number) {
  if (capitalBlocksPlayerTerritory(x, z)) return err("The capital plaza is public land.", "CAPITAL_RESERVED");
  const capReason = tileCapacityBlockReason(p, "capture");
  if (capReason) return err(capReason);
  const claimCost = Object.fromEntries(Object.entries({ e: gameTuning().claimEnergy, w: ECONOMY_RULES.claimWood, s: ECONOMY_RULES.claimStone }).filter(([, v]) => Number(v) > 0)) as any;
  const miss = afford(p, claimCost);
  if (miss.length) return err("Capture needs " + Object.entries(claimCost).map(([k, v]) => `${v}${k}`).join(" ") + ".");
  spend(p, claimCost);
  const oldOwner = playerById(t.owner);
  t.owner = p.id;
  bump();
  addXp(p, XP.capture);
  autoTrainSkill(p, "vigor", 5);
  refreshMilestones(p);
  if (oldOwner) pushEvent(oldOwner.id, "raid", `⚑ ${p.name} recaptured a disconnected tile at ${x}, ${z}. Keep borders connected to your flag.`);
  return ok({ note: "Disconnected land recaptured. Keep territory connected to your flag." });
}

export function claim(p: Player, x: number, z: number) {
  if (cheb(x, z, p.x, p.z) > 0) return err("Stand on the tile to claim or capture it.");
  const t = tileAt(x, z);
  if (t?.owner === p.id) return err("Already yours.");
  const liveB = buildingAt(x, z);
  if (liveB) return err(liveB.kind === "bomb" ? "A destroy tool is sitting there. Siege it first." : "A building still stands there. Siege it down before claiming this tile.");
  if (t && t.owner !== p.id) {
    return err("Player territory is protected. Expand into open frontier or siege neutral Keeps for coins.", "BASE_PROTECTED");
  }
  if (capitalBlocksPlayerTerritory(x, z)) return err("The capital plaza is public land. Build settlements outside the service ring.", "CAPITAL_RESERVED");
  const capReason = tileCapacityBlockReason(p, "claim");
  if (capReason) return err(capReason);

  const claimCost = Object.fromEntries(Object.entries({ e: gameTuning().claimEnergy, w: ECONOMY_RULES.claimWood, s: ECONOMY_RULES.claimStone }).filter(([, v]) => Number(v) > 0)) as any;
  const miss = afford(p, claimCost);
  if (miss.length) return err("Claim needs " + Object.entries(claimCost).map(([k, v]) => `${v}${k}`).join(" ") + ".");
  spend(p, claimCost);
  insertTile({ x, z, owner: p.id });
  bump();
  addXp(p, XP.claim);
  autoTrainSkill(p, "vigor", 3);
  refreshMilestones(p);
  return ok({ note: "Tile captured." });
}

function clearDoodadCell(x: number, z: number) {
  const ex = db.doodads.select().where({ x, z }).first() as any;
  if (ex) (ex as any).state = "gone";
  else if (naturalDoodad(x, z)) db.doodads.insert({ x, z, state: "gone" });
}
function claimWonderPlaza(p: Player, x: number, z: number, recipeLike: any = null) {
  const r = wonderFootprintRadius(recipeLike || { footprint: WORLD_WONDER_PLAZA_SIZE });
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const sx = x + dx, sz = z + dz;
    claimTileAt(sx, sz, p.id);
    clearDoodadCell(sx, sz);
  }
}
function findWonderLanding(p: Player, x: number, z: number, recipeLike: any = null) {
  const r = wonderFootprintRadius(recipeLike || { footprint: WORLD_WONDER_PLAZA_SIZE });
  const d = r + 1;
  const spots = [[d,0],[-d,0],[0,d],[0,-d],[d,1],[-d,-1],[1,d],[-1,-d],[d,-1],[-d,1],[-1,d],[1,-d],[d+1,0],[-d-1,0],[0,d+1],[0,-d-1]];
  for (const [dx, dz] of spots) {
    const sx = x + dx, sz = z + dz;
    const t = tileAt(sx, sz) as any;
    if (t && t.owner === p.id && !buildingAt(sx, sz) && !doodadAt(sx, sz) && !tradePostAt(sx, sz)) return { x: sx, z: sz };
  }
  return { x: x + 1, z };
}
function normalizedWonderPrompt(prompt: string) {
  return cleanWonderPrompt(prompt).toLowerCase();
}
function ownerWonderWithPrompt(p: Player, prompt: string, recipeLike: any = null) {
  const want = normalizedWonderPrompt(prompt);
  if (!want) return null;
  const size = normalizeWonderFootprint(recipeLike?.footprint || WORLD_WONDER_PLAZA_SIZE);
  const mode = String(recipeLike?.mode || "district");
  const paletteId = String(recipeLike?.paletteId || "solar");
  for (const b of ownerWonders(p.id) as any[]) {
    const wr = readWonderRecipe(Number(b.id));
    if (normalizedWonderPrompt(wr?.prompt || "") !== want) continue;
    // Same prompt is allowed when the player intentionally changes the footprint,
    // layout mode, or palette. This only blocks accidental double-submits.
    if (normalizeWonderFootprint(wr?.footprint || WORLD_WONDER_PLAZA_SIZE) === size && String(wr?.mode || "district") === mode && String(wr?.paletteId || "solar") === paletteId) return { building: b, recipe: wr };
  }
  return null;
}
function placeWorldWonder(p: Player, x: number, z: number, promptRaw = "", recipeRaw: any = null) {
  const prompt = cleanWonderPrompt(promptRaw);
  if (!prompt) return err("Describe your World Wonder first.", "WONDER_PROMPT_REQUIRED");
  if (!recipeRaw?.parts?.length) return err("AI mesh recipe required. Generate the World Wonder with real AI first.", "WONDER_RECIPE_REQUIRED");
  let recipe: any;
  try { recipe = applyWonderDesignOptions(assertRealWonderRecipe(recipeRaw, prompt), recipeRaw || {}); }
  catch (e: any) { return err(String(e?.message || "Invalid AI Wonder recipe."), "WONDER_RECIPE_INVALID"); }
  const duplicate = ownerWonderWithPrompt(p, prompt, recipe);
  if (duplicate) {
    const b: any = duplicate.building;
    const wr: any = duplicate.recipe || {};
    return err(`You already founded ${b.nm || wr.name || "a World Wonder"} from that prompt at ${b.x}, ${b.z}. Change the prompt, footprint, mode, or palette for another Wonder.`, "WONDER_DUPLICATE_PROMPT");
  }
  const problem = buildPadProblem(p, x, z, "worldwonder", recipe);
  if (problem) return err(problem);
  const cost = WORLD_WONDER_GOLD_COST;
  if ((p.inv?.g || 0) < cost) return err(`Need ${cost}🪙 to found a permanent World Wonder. Collect territory coins or breach neutral Keeps.`, "NOT_ENOUGH_GOLD");
  spend(p, { g: cost });
  claimWonderPlaza(p, x, z, recipe);
  const def = buildingDef("worldwonder");
  const mhp = buildMaxHp(def, 1) + masonHp(p.skills as Skills);
  const startedAt = now();
  const buildMs = wonderBuildMsFor(recipe);
  const size = wonderSizeForRecipe(recipe);
  const tiles = wonderFootprintTiles(recipe);
  const b = insertBuilding({ owner: p.id, kind: "worldwonder", x, z, level: 1, hp: mhp, maxHp: mhp, accAt: startedAt, cdUntil: startedAt + buildMs, stored: 0, nm: recipe.name || `${p.name}'s Wonder`, cl: recipe.palette?.[0] || "#fff0a8" }) as any;
  saveWonderRecipe(Number(b.id), recipe);
  const landing = p.x === x && p.z === z ? findWonderLanding(p, x, z, recipe) : null;
  if (landing) { p.x = landing.x; p.z = landing.z; liveTouch(p); }
  dropStats(p.id);
  bump();
  addXp(p, XP.build + 40);
  autoTrainSkill(p, "mason", 12);
  refreshMilestones(p);
  notifyAll("milestone", `★ ${recipe.name} is under construction at ${x}, ${z}. Founder: ${p.name}.`);
  sysChat(`★ ${recipe.name} founded by ${p.name} at ${x}, ${z}; construction has started.`);
  return ok({
    uid: Number(b.id),
    x: p.x,
    z: p.z,
    wonder: recipe,
    buildMs,
    footprint: { size, radius: wonderFootprintRadius(recipe), tiles },
    note: `★ ${recipe.name} founded for ${cost}🪙. Its ${size}×${size} plaza (${tiles} cells) is yours; construction finishes in about ${Math.round(buildMs / 1000)}s.`,
  });
}
function manualKeepName(x: number, z: number) {
  const b = biomeAt(x, z);
  return `${b.name} Keep`;
}
const KEEP_SIEGE_PAD_RADIUS = 1;
function keepSiegePadOffsets(): [number, number][] {
  const out: [number, number][] = [];
  for (let dx = -KEEP_SIEGE_PAD_RADIUS; dx <= KEEP_SIEGE_PAD_RADIUS; dx++) {
    for (let dz = -KEEP_SIEGE_PAD_RADIUS; dz <= KEEP_SIEGE_PAD_RADIUS; dz++) out.push([dx, dz]);
  }
  return out;
}
function keepSiegePadKeysAround(kx: number, kz: number) {
  const keys = new Set<string>();
  for (const [dx, dz] of keepSiegePadOffsets()) keys.add(key(kx + dx, kz + dz));
  return keys;
}
function keepSiegePadKeysInBox(cx: number, cz: number, r: number) {
  const keys = new Set<string>();
  const keeps = db.buildings.select().where(inBox(cx, cz, Math.max(1, Math.floor(r || 1)) + KEEP_SIEGE_PAD_RADIUS)).all() as Building[];
  for (const k of keeps) {
    if (Number(k.owner || 0) !== 0 || k.kind !== "keep") continue;
    for (const kk of keepSiegePadKeysAround(k.x, k.z)) keys.add(kk);
  }
  return keys;
}
function ensureKeepSiegeTilesAround(kx: number, kz: number) {
  // Keeps are public siege targets. They need a permanent neutral 3×3 yard so
  // players can place bombs/tools around them without claiming or destroying land.
  for (const [dx, dz] of keepSiegePadOffsets()) {
    const x = kx + dx, z = kz + dz;
    clearDoodadCell(x, z);
    const t = tileAt(x, z) as any;
    if (!t) {
      try { insertTile({ x, z, owner: 0 }); } catch {}
    }
  }
}
function cleanupNeutralKeepSiegeTilesAround(kx: number, kz: number, excludeKeepId = 0) {
  for (const [dx, dz] of keepSiegePadOffsets()) {
    const x = kx + dx, z = kz + dz;
    const t = tileAt(x, z) as any;
    if (!t || Number(t.owner || 0) !== 0) continue;
    const stillNeeded = (db.buildings.select().where(inBox(x, z, KEEP_SIEGE_PAD_RADIUS)).all() as Building[])
      .some((b) => Number(b.id || 0) !== Number(excludeKeepId || 0) && Number(b.owner || 0) === 0 && b.kind === "keep" && cheb(b.x, b.z, x, z) <= KEEP_SIEGE_PAD_RADIUS);
    if (!stillNeeded) try { deleteTile(t); } catch {}
  }
}
function canSpawnNeutralKeepAt(x: number, z: number) {
  if (!Number.isInteger(x) || !Number.isInteger(z)) return "Choose a real tile.";
  if (Math.abs(x) < SPAWN_HALF + 2 && Math.abs(z) < SPAWN_HALF + 2) return "Too close to the starter flag.";
  for (const [dx, dz] of keepSiegePadOffsets()) {
    const sx = x + dx, sz = z + dz;
    const live = buildingAt(sx, sz) as any;
    if (live) return "Keeps need an empty neutral 3×3 siege yard.";
    if (tradePostAt(sx, sz)) return "A trade post occupies the Keep siege yard.";
    const t = tileAt(sx, sz) as any;
    if (t && Number(t.owner || 0) !== 0) return "Keeps need a neutral 3×3 siege yard, not player-claimed land.";
  }
  return "";
}
function spawnNeutralKeepAt(x: number, z: number, gold = 150, hp = 140, name = "") {
  const reason = canSpawnNeutralKeepAt(x, z);
  if (reason) return { ok: false as const, msg: reason };
  clearDoodadCell(x, z);
  const keepName = String(name || manualKeepName(x, z)).trim().slice(0, 42);
  const keepHp = Math.max(40, Math.min(3000, Math.floor(Number(hp || 140))));
  const keepGold = Math.max(0, Math.min(100000, Math.floor(Number(gold || 150))));
  const existing = db.buildings.select().where({ owner: 0, kind: "keep", x, z }).first() as any;
  if (existing) return { ok: false as const, msg: "A Keep is already there." };
  const b = insertBuilding({ owner: 0, kind: "keep", x, z, nm: keepName, level: 1, hp: keepHp, maxHp: keepHp, stored: keepGold, accAt: now(), cl: "#ffd76e" }) as any;
  ensureKeepSiegeTilesAround(x, z);
  bump();
  sysChat(`♜ ${keepName} appeared at ${x}, ${z}. Breach it for coins.`);
  return { ok: true as const, uid: Number(b?.id || 0), x, z, name: keepName, hp: keepHp, gold: keepGold };
}
function adminDeleteBuilding(p: Player, b: Building, clearTile = false) {
  const kind = String(b.kind || "building");
  const owner = Number(b.owner || 0);
  const x = Number(b.x || 0), z = Number(b.z || 0);
  if (kind === "keep" && owner === 0) cleanupNeutralKeepSiegeTilesAround(x, z, Number(b.id || 0));
  if (kind === "worldwonder") saveWonderRecipe(Number(b.id || 0), { deleted: true, deletedAt: now(), deletedBy: p.id, name: b.nm || "World Wonder" });
  try { deleteBuilding(b); } catch {}
  if (owner) dropStats(owner);
  if (clearTile) {
    const t = tileAt(x, z) as any;
    if (t && !isStarterTile(x, z)) { try { deleteTile(t); } catch {} }
  }
  return { uid: Number(b.id || 0), kind, owner, x, z, name: b.nm || kind };
}
export function adminDemolishAt(p: Player, body: any = {}) {
  if (!isAdminPlayer(p)) return err("Only the world admin can do that.");
  const uid = Math.trunc(Number(body.uid || 0));
  const x = Math.trunc(Number(body.x ?? p.x ?? 0));
  const z = Math.trunc(Number(body.z ?? p.z ?? 0));
  const clearTile = !!body.clearTile;
  const removed: any[] = [];
  if (uid) {
    const b = getBuilding(uid) as Building | null;
    if (!b) return err("That building/object is already gone.");
    removed.push(adminDeleteBuilding(p, b, clearTile));
  } else {
    const b = buildingAt(x, z) as Building | null;
    if (b) removed.push(adminDeleteBuilding(p, b, clearTile));
    const d = db.doodads.select().where({ x, z }).first() as any;
    if (d) { try { db.doodads.delete(d.id); removed.push({ kind: "doodad", x, z, state: d.state }); } catch {} }
    const loot = lootAt(x, z) as any;
    if (loot) { try { deleteLoot(loot); removed.push({ kind: "loot", x, z, loot: loot.kind, amount: loot.gid }); } catch {} }
    if (clearTile) {
      const t = tileAt(x, z) as any;
      if (t && !isStarterTile(x, z)) { try { deleteTile(t); removed.push({ kind: "tile", x, z, owner: t.owner }); } catch {} }
    }
  }
  if (!removed.length) return err(clearTile ? "No removable object or non-starter tile there." : "No removable object there. Use Clear tile if you intentionally want to remove land.");
  dropStats(p.id);
  bump();
  const names = removed.map((r) => r.name || r.state || r.loot || r.kind).join(", ");
  sysChat(`⚙ Admin removed ${names} at ${removed[0].x}, ${removed[0].z}.`);
  return ok({ removed, x: removed[0].x, z: removed[0].z, note: `Removed ${names}.` });
}

export function adminSpawnKeep(p: Player, body: any = {}) {
  if (!isAdminPlayer(p)) return err("Only the world admin can do that.");
  const mode = String(body.mode || "here");
  const baseX = Number.isFinite(Number(body.x)) ? Math.trunc(Number(body.x)) : Math.trunc(Number(p.x || 0));
  const baseZ = Number.isFinite(Number(body.z)) ? Math.trunc(Number(body.z)) : Math.trunc(Number(p.z || 0));
  const gold = Math.floor(Number(body.gold || 150));
  const hp = Math.floor(Number(body.hp || 140));
  const name = String(body.name || "").trim();

  const spots: [number, number][] = [];
  if (mode === "ring") {
    const r = Math.max(4, Math.min(24, Math.floor(Number(body.radius || 8))));
    spots.push([baseX + r, baseZ], [baseX - r, baseZ], [baseX, baseZ + r], [baseX, baseZ - r]);
  } else if (mode === "line") {
    const r = Math.max(4, Math.min(24, Math.floor(Number(body.radius || 7))));
    spots.push([baseX + r, baseZ], [baseX + r * 2, baseZ], [baseX + r * 3, baseZ]);
  } else {
    spots.push([baseX, baseZ]);
  }

  const made: any[] = [];
  const failed: any[] = [];
  for (let i = 0; i < spots.length; i++) {
    const [x, z] = spots[i];
    const spawned = spawnNeutralKeepAt(x, z, gold, hp, name || "");
    if (spawned.ok) made.push(spawned);
    else failed.push({ x, z, msg: spawned.msg });
  }
  if (!made.length) return err(failed[0]?.msg || "No Keeps spawned.");
  return ok({ keeps: made, failed, note: `Spawned ${made.length} Keep${made.length === 1 ? "" : "s"} for players to raid.` });
}

function materializeProceduralKeepsAround(cx: number, cz: number) {
  const keeps = proceduralKeepCandidatesAround(cx, cz, VIEW_RADIUS + ANCHOR_PAD + 4);
  for (const k of keeps) {
    if (canSpawnNeutralKeepAt(k.x, k.z)) continue;
    const existing = (db.buildings.select().where({ owner: 0, kind: "keep", x: k.x, z: k.z }).first() as any);
    if (existing) continue;
    clearDoodadCell(k.x, k.z);
    insertBuilding({ owner: 0, kind: "keep", x: k.x, z: k.z, nm: k.name, level: 1, hp: k.hp, maxHp: k.hp, stored: k.gold, accAt: now(), cl: "#7dcfe8" });
    ensureKeepSiegeTilesAround(k.x, k.z);
    bump();
  }
}

/* one cell per building, with one empty cell reserved around every structure.
   The client previews this, but the server is authoritative. */
export function place(p: Player, kind: string, x: number, z: number, prompt = "", recipe: any = null) {
  const def = buildingDef(kind);
  if (!def) return err("Unknown building.");
  if (def.weapon) return err("Destroy tools are deployed from Deploy (6), not the building menu.");
  if ([BARB_CAMP_KIND, "wall", "gate"].includes(kind)) return err("That legacy structure is disabled. Cities stay walkable with normal buildings and one free tile of street around each.");
  if (kind === "worldwonder") return placeWorldWonder(p, x, z, prompt, recipe);
  if (String(kind) === FOUNDATION_KIND) return err("Choose the final building from the selected tile panel.", "FOUNDATION_REMOVED");
  if (!isFoundationBuildKind(kind)) return err("Choose House, Lumber Camp, Mine, Farm, or Market.", "BUILD_KIND_DISABLED");
  if (capitalBlocksPlayerTerritory(x, z)) return err("The capital plaza is reserved for public buildings.", "CAPITAL_RESERVED");
  const territory = db.tiles.select().where({ owner: p.id }).count();
  if (territory < (def.unlock || 0)) return err(`Unlocks at ${def.unlock} tiles.`);
  const padProblem = buildPadProblem(p, x, z, kind);
  if (padProblem) return err(padProblem);
  if (String(kind) !== ROAD_KIND && p.x === x && p.z === z) return err("Step aside first.");

  const miss = afford(p, def.cost);
  if (miss.length) return err(`Missing resources for ${def.name}: ${missingText(p, def.cost)}. Cost: ${costText(def.cost)}.`);
  spend(p, def.cost);
  const mhp = buildMaxHp(def, 1) + masonHp(p.skills as Skills);
  const startedAt = now();
  const buildMs = normalBuildMs(def, kind);
  // Do not insert constructAt/constructUntil: older live DBs do not have those
  // columns. Construction is encoded with existing fields: accAt=start,
  // cdUntil=end. Snapshot exposes virtual constructAt/constructUntil for UI.
  const b = insertBuilding({ owner: p.id, kind, x, z, level: 1, hp: mhp, maxHp: mhp, accAt: startedAt, cdUntil: startedAt + buildMs, stored: 0 });
  /* clear any doodad/loot under the new building */
  const ex = db.doodads.select().where({ x, z }).first() as any;
  if (doodadAt(x, z)) { if (ex) (ex as any).state = "gone"; else db.doodads.insert({ x, z, state: "gone" }); }
  const l = lootAt(x, z) as any;
  if (l) deleteLoot(l);
  dropStats(p.id);
  bump();
  addXp(p, def.decor ? 2 : XP.build);
  autoTrainSkill(p, "mason", def.decor ? 2 : 6);
  refreshMilestones(p);
  return ok({ uid: (b as any).id, buildMs, note: `${def.name} construction started. It will finish in about ${Math.round(buildMs / 1000)}s.` });
}

export function completeFoundation(p: Player, uid: number, kind: string) {
  if (!isFoundationBuildKind(kind)) return err("Choose House, Lumber Camp, Mine, Farm, or Market.", "FOUNDATION_KIND_INVALID");
  const b = getBuilding(uid) as Building | null;
  if (!b || b.owner !== p.id) return err("That is not your foundation.");
  if (b.kind !== FOUNDATION_KIND) return err("This spot is already assigned.", "NOT_FOUNDATION");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Walk next to the foundation first.");
  const def = buildingDef(kind);
  if (!def) return err("Unknown building.");
  const miss = afford(p, def.cost);
  if (miss.length) return err(`Missing resources for ${foundationChoiceLabel(kind)}: ${missingText(p, def.cost)}. Cost: ${costText(def.cost)}.`);
  spend(p, def.cost);
  const mhp = buildMaxHp(def, 1) + masonHp(p.skills as Skills);
  const startedAt = now();
  const buildMs = normalBuildMs(def, kind);
  b.kind = kind;
  b.level = 1;
  b.hp = mhp;
  b.maxHp = mhp;
  b.acc = 0;
  b.accAt = startedAt;
  b.cdUntil = startedAt + buildMs;
  b.stored = 0;
  b.nm = null;
  dropStats(p.id);
  bump();
  addXp(p, XP.build);
  autoTrainSkill(p, "mason", 6);
  refreshMilestones(p);
  return ok({ uid: b.id, kind, buildMs, note: `${foundationChoiceLabel(kind)} started. Construction finishes in about ${Math.round(buildMs / 1000)}s.` });
}


export function castBorderBomb(p: Player, variant = "popper", tx?: number, tz?: number) {
  if (readMetaBool(META_PAUSE_DESTROY)) return err("Destroy tools are temporarily paused.");
  const def = buildingDef("bomb");
  if (!def) return err("Destroy tools are unavailable right now.");
  const spec = tunedDestroySpec(String(variant || "popper"));
  const x = Number.isFinite(Number(tx)) ? (Number(tx) | 0) : (p.x | 0);
  const z = Number.isFinite(Number(tz)) ? (Number(tz) | 0) : (p.z | 0);
  if (cheb(x, z, p.x, p.z) > 10) return err("Walk into scouting range before planting a destroy tool.");
  if (!tileAt(x, z)) return err("Destroy tools go on claimed territory or neutral Keep siege tiles — not raw wilderness.");
  if (buildingAt(x, z)) return err("Something is already standing here.");
  if (doodadAt(x, z)) return err("Clear trees and rocks before placing a destroy tool.");
  if (tradePostAt(x, z)) return err("The merchant says no explosives on the welcome mat.");
  const active = (db.buildings.select().where({ owner: p.id, kind: "bomb" }).all() as Building[]).length;
  if (active >= ECONOMY_RULES.destroyMaxActive) return err(`Only ${ECONOMY_RULES.destroyMaxActive} destroy tools can be active at once.`);
  if (bombCount(p, spec.id) <= 0) return err(`Craft a ${spec.name} first, then use Deploy (6) to place it.`);
  if (!consumeBombItem(p, spec.id)) return err(`Craft a ${spec.name} first, then use Deploy (6) to place it.`);
  const mhp = (spec.hp || buildMaxHp(def, 1)) + masonHp(p.skills as Skills);
  const b = insertBuilding({ owner: p.id, kind: "bomb", x, z, nm: spec.id, level: 1, hp: mhp, maxHp: mhp, accAt: now(), cdUntil: now() + (spec.fuseMs || BOMB_FUSE_MS) });
  bump();
  const targetTile = tileAt(x, z);
  sysChat(`${p.name} deployed a ${spec.name}${targetTile && targetTile.owner !== p.id ? " on contested territory" : ""}. The fuse is live.`);
  const warned = new Set<number>();
  const radius = Math.max(1, spec.radius || 0);
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    const nt = tileAt(x + dx, z + dz);
    if (nt && nt.owner !== p.id && !warned.has(nt.owner)) { warned.add(nt.owner); pushEvent(nt.owner, "raid", `⚠ ${p.name} deployed a ${spec.name} nearby. Its fuse is live.`); }
  }
  const fuseS = Math.max(1, Math.ceil(Number(spec.fuseMs || BOMB_FUSE_MS) / 1000));
  return ok({ uid: (b as any).id, x, z, fuseMs: Number(spec.fuseMs || BOMB_FUSE_MS), note: `${spec.name} deployed. Fuse ${fuseS}s — it will detonate automatically.` });
}

export function setProfileFace(p: Player, faceImage: string | null) {
  const img = typeof faceImage === "string" ? faceImage : "";
  if (img && (!img.startsWith("data:image/") || img.length > 220000)) return err("That portrait is too large for this profile.");
  (p as any).faceImage = img || null;
  liveTouch(p);
  bump();
  return ok({ faceImage: (p as any).faceImage, note: img ? "Portrait uploaded. It appears on profile and inspection cards." : "Portrait cleared. Incognito settler mode." });
}
export function setProfileAppearance(p: Player, appearance: any) {
  const app = saveAppearance(p, appearance);
  if (!app) return err("Character appearance could not be saved.");
  return ok({ appearance: app, note: "Character appearance saved." });
}

export function demolish(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b || b.owner !== p.id) return err("Not your building.");
  if (b.kind === "worldwonder") return err("World Wonders cannot be demolished. They are history now.");
  const def = buildingDef(b.kind);
  if (def) {
    const back: Record<string, number> = {};
    for (const [res, amt] of Object.entries(def.cost || {})) {
      const half = Math.floor((amt || 0) / 2);
      if (half) back[res] = half;
    }
    gain(p, back);
  }
  deleteBuilding(uid);
  dropStats(p.id);
  bump();
  return ok();
}

export function customize(p: Player, uid: number, nm?: string, cl?: string | null) {
  const b = getBuilding(uid) as Building | null;
  if (!b || b.owner !== p.id) return err("Not your building.");
  if (cl !== undefined && cl !== null && cl !== "" && !/^#[0-9a-fA-F]{6}$/.test(String(cl))) return err("Choose one of the safe building colors.");
  if (nm !== undefined) b.nm = String(nm || "").trim().slice(0, 16) || null;
  if (cl !== undefined) {
    b.cl = cl ? String(cl) : null;
  }
  bump();
  return ok();
}

/* upgrade: levels boost production & regen by lvlMul() and add HP */
export function upgrade(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b || b.owner !== p.id) return err("Not your building.");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Walk next to it first.");
  const def = buildingDef(b.kind);
  if (!def) return err("Unknown building.");
  const level = b.level || 1;
  if (level >= MAX_LEVEL) return err(`${def.name} is already max level.`);
  const cost = upgradeCost(def, level);
  const miss = afford(p, cost);
  if (miss.length) return err("Missing: " + miss.join(" "));
  /* settle the stockpile at the OLD rate before the rate changes */
  b.acc = accNow(b); b.accAt = now();
  spend(p, cost);
  b.level = level + 1;
  b.maxHp = (b.maxHp || buildMaxHp(def, level)) + 6;
  b.hp = Math.min(b.maxHp, (b.hp || 0) + 6);
  dropStats(p.id);
  bump();
  let benefit = "";
  if (b.kind === "lumber") benefit = ` Trees on your territory now drop about +${territoryYieldBonusPct(p.id, "lumber")}% wood.`;
  else if (b.kind === "quarry") benefit = ` Rocks on your territory now drop about +${territoryYieldBonusPct(p.id, "quarry")}% stone.`;
  else if (b.kind === GOLD_MINE_KIND) benefit = ` Territory coin pickups and taxes now gain about +${territoryYieldBonusPct(p.id, GOLD_MINE_KIND, 0.20)}% coins.`;
  return ok({ note: `⬆ ${b.nm || def.name} is now level ${b.level}.${benefit}` });
}

/* repair: anyone can repair their OWN damaged building */
export function repair(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b || b.owner !== p.id) return err("Not your building.");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Walk next to it first.");
  const def = buildingDef(b.kind);
  const maxHp = b.maxHp || buildMaxHp(def, b.level || 1);
  const missing = maxHp - (b.hp || 0);
  if (missing <= 0) return err("Already in perfect shape.");
  const cost = repairCost(missing);
  const miss = afford(p, cost);
  if (miss.length) return err("Repairs need: " + Object.entries(cost).map(([k, v]) => `${v}${k}`).join(" "));
  spend(p, cost);
  b.hp = maxHp;
  bump();
  return ok({ note: `🔧 ${b.nm || def?.name} fully repaired.` });
}

/* E / right-click — channelled chop/mine. Energy is charged on
   START; the resource only drops on FINISH after the bar fills.
   Moving away (move() clears the channel) wastes the energy —
   exactly the "distracted but energy spent anyway" behaviour. */
function dropHarvestLoot(x: number, z: number, kind: "wood" | "stone", amount: number) {
  const spots = [[0,0], ...N8, ...N4.map(([dx, dz]) => [dx * 2, dz * 2] as [number, number])];
  let left = Math.max(1, Math.floor(amount));
  let dropped = 0;
  for (const [dx, dz] of spots) {
    if (left <= 0) break;
    const lx = x + dx, lz = z + dz;
    if (buildingAt(lx, lz) || tradePostAt(lx, lz) || lootAt(lx, lz)) continue;
    const n = Math.min(left, kind === "wood" ? 5 : 4);
    insertLoot({ x: lx, z: lz, kind, gid: String(n) });
    left -= n;
    dropped += n;
  }
  if (left > 0) {
    insertLoot({ x, z, kind, gid: String(left) });
    dropped += left;
  }
  return dropped;
}

export function harvestStart(p: Player, x: number, z: number) {
  if (cheb(x, z, p.x, p.z) > 1) return err("Walk next to it first.");
  const d = doodadAt(x, z);
  if (!d) return err("Nothing to harvest there.");
  const hCost = d === "food" ? 0 : d === "tree" ? ECONOMY_RULES.chopEnergy : ECONOMY_RULES.mineEnergy;
  if (energyNow(p).energy < hCost) return err(`Need ${hCost}⚡. The ${d === "tree" ? "tree" : d === "food" ? "crop" : "rock"} refuses unpaid labor.`);
  if (hCost > 0) spend(p, { e: hCost });
  const ms = d === "food" ? 900 : harvestMs(p.skills as Skills, d as any);
  channels.set(p.id, { x, z, until: now() + ms, type: "harvest" });
  return ok({ ms, kind: d });
}
export function harvestFinish(p: Player, x: number, z: number) {
  const ch = channels.get(p.id);
  if (!ch || ch.type !== "harvest" || ch.x !== x || ch.z !== z) return err("Not chopping that.");
  if (now() < ch.until - 250) return err("Still working…");
  clearChannel(p.id);
  if (cheb(x, z, p.x, p.z) > 1) return err("Moved away.");
  const d = doodadAt(x, z);
  if (!d) return err("Already gone.");
  const ex = db.doodads.select().where({ x, z }).first() as any;
  if (ex) (ex as any).state = "gone";
  else db.doodads.insert({ x, z, state: "gone" });
  const bonus = gatherBonus(p.skills as Skills);
  let note = "";
  if (d === "tree") {
    const ownerId = Number(tileAt(x, z)?.owner || 0);
    const raw = ECONOMY_RULES.treeWood + bonus;
    const boost = ownerId === p.id ? territoryYieldBoost(p.id, "lumber", raw) : { base: raw, amount: raw, bonus: 0, stacks: 0, mult: 1 };
    const dropped = dropHarvestLoot(x, z, "wood", boost.amount);
    p.treesChopped++;
    note = `Chopped tree: ${dropped} wood 🪵 dropped nearby${territoryYieldNote(boost, "Lumber Camp")}`;
  } else if (d === "food") {
    const amt = 4 + Math.floor(bonus / 2);
    gain(p, { f: amt });
    note = `Harvested crops: +${amt} food 🌾.`;
  } else {
    const ownerId = Number(tileAt(x, z)?.owner || 0);
    const raw = ECONOMY_RULES.rockStone + bonus;
    const boost = ownerId === p.id ? territoryYieldBoost(p.id, "quarry", raw) : { base: raw, amount: raw, bonus: 0, stacks: 0, mult: 1 };
    const dropped = dropHarvestLoot(x, z, "stone", boost.amount);
    note = `Mined rock: ${dropped} stone 🪨 dropped nearby${territoryYieldNote(boost, "Quarry")}`;
  }
  addXp(p, XP.chop);
  autoTrainSkill(p, "gather", d === "tree" ? 5 : 4);
  autoTrainSkill(p, "haste", 2);
  bump();
  refreshMilestones(p);
  return ok({ note: `${note} · +${XP.chop} XP` });
}
export function harvestCancel(p: Player) { clearChannel(p.id); return ok(); }

function hasTowerProtection(owner: number, x: number, z: number) {
  if (!owner) return false;
  const r = Math.ceil(towerRangeFor(owner));
  const towers = db.buildings.select().where(inBox(x, z, r)).all() as Building[];
  return towers.some((t) => t.owner === owner && t.kind === "watchtower" && cheb(t.x, t.z, x, z) <= towerRangeFor(owner));
}
function scatterGold(x: number, z: number, amount: number) {
  let left = Math.max(0, Math.floor(amount));
  if (!left) return;
  const spots = [[0,0], [1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1], [1,-1], [-1,1]];
  let piles = Math.min(5, left);
  for (let i = 0; i < piles; i++) {
    const amt = i === piles - 1 ? left : Math.max(1, Math.floor(left / (piles - i)));
    left -= amt;
    const [dx, dz] = spots[i % spots.length];
    try { insertLoot({ x: x + dx, z: z + dz, kind: "gold", gid: String(amt) }); } catch {}
  }
}
function scatterResource(x: number, z: number, kind: "wood" | "stone" | "food" | "gold", amount: number) {
  let left = Math.max(0, Math.floor(amount));
  if (!left) return;
  const spots = [[0,0], [1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1], [1,-1], [-1,1]];
  const piles = Math.min(5, left);
  for (let i = 0; i < piles; i++) {
    const amt = i === piles - 1 ? left : Math.max(1, Math.floor(left / (piles - i)));
    left -= amt;
    const [dx, dz] = spots[i % spots.length];
    try { insertLoot({ x: x + dx, z: z + dz, kind, gid: String(amt) }); } catch {}
  }
}
function markProceduralNpcGone(x: number, z: number) {
  const row = db.doodads.select().where({ x, z }).first() as any;
  if (row) row.state = "gone";
  else db.doodads.insert({ x, z, state: "gone" });
}

function npcGatheredResourceBonus(npc: any) {
  // NPCs are drawn toward productive frontier infrastructure. Their carried
  // supplies increase near player camps, which makes guarding resource hubs useful.
  const rows = db.buildings.select().where(inBox(Number(npc.x || 0), Number(npc.z || 0), 8)).all() as Building[];
  let bonus = 0;
  let source = "frontier";
  for (const b of rows) {
    if (!b || !Number(b.owner || 0) || isUnderConstruction(b)) continue;
    const lvl = Math.max(1, Math.floor(Number(b.level || 1)));
    if (npc.resource === "w" && b.kind === "lumber") { bonus += 2 * lvl; source = "nearby Lumber Camp"; }
    else if (npc.resource === "s" && b.kind === "quarry") { bonus += 2 * lvl; source = "nearby Quarry"; }
    else if (npc.resource === "f" && b.kind === "farm") { bonus += 2 * lvl; source = "nearby Farm"; }
  }
  return { bonus: Math.min(24, bonus), source };
}

function simpleInvBag(inv: any) {
  return { ...(inv || {}) } as any;
}
function dropDefeatedPlayerResources(target: Player) {
  const inv = simpleInvBag(target.inv as any);
  const drops: Record<string, number> = {};
  for (const k of ["w", "s", "f", "p"] as const) {
    const n = Math.max(0, Math.floor(Number((inv as any)[k] || 0)));
    if (n > 0) drops[k] = n;
  }
  if (drops.w) scatterResource(target.x, target.z, "wood", drops.w);
  if (drops.s) scatterResource(target.x, target.z, "stone", drops.s);
  if (drops.f) {
    // Food is not a loot table kind yet; leave it as small gold-like recovery value until food pickups are backed by loot schema.
    scatterResource(target.x, target.z, "gold", Math.max(1, Math.floor(drops.f / 2)));
  }
  target.inv = { ...inv, w: 0, s: 0, f: 0, p: 0 } as any;
  return drops;
}
function keepVaultContext() {
  return {
    ownedTilesFor: (playerId: number) => prioritizeWonderDistrictTiles(playerId, db.tiles.select().where({ owner: playerId }).all() as any[]),
    hasBuilding: (x: number, z: number) => !!buildingAt(x, z),
    hasLoot: (x: number, z: number) => !!lootAt(x, z),
    hasDoodad: (x: number, z: number) => !!doodadAt(x, z),
    hasTradePost: (x: number, z: number) => !!tradePostAt(x, z),
    insertCoinLoot: (x: number, z: number, amount: number) => {
      try { insertLoot({ x, z, kind: "gold", gid: String(Math.max(1, Math.floor(Number(amount || 1)))) }); return true; }
      catch { return false; }
    },
    canSpawnNeutralKeepAt,
    spawnNeutralKeepAt,
  };
}
function destroyBuilding(attacker: Player, b: Building, cause = "siege") {
  if (b.kind === "worldwonder") {
    pushEvent(attacker.id, "raid", "World Wonders are permanent. Siege the Keeps for coins.");
    return;
  }
  const def = buildingDef(b.kind);
  const owner = playerById(b.owner);
  if (b.owner === 0 && b.kind === "keep") {
    const result = resolveKeepVaultBreak(keepVaultContext(), attacker, b);
    addXp(attacker, 40);
    const delta = { empire: 18, bandits: -14 };
    const standing = adjustFactionStanding(attacker.id, delta);
    const rep = factionDeltaText(delta, standing);
    pushEvent(attacker.id, "fill", `${result.note} ${rep} +40 XP.`);
    if (result.nextKeep?.ok) sysChat(`♜ A new Keep appeared at ${result.nextKeep.x}, ${result.nextKeep.z} with ${Math.floor(Number(result.nextKeep.gold || 0))} coins inside.`);
    logEconomyEvent("keepVaultBreak", { attacker: attacker.id, keep: b.id, stored: result.stored, spawnedCoins: result.spawnedCoins, filledTiles: result.filledTiles, nextKeep: result.nextKeep, factions: standing });
  } else if (def?.storage && Number(b.stored || 0) > 0) {
    const stored = Math.max(0, Math.floor(Number(b.stored || 0)));
    const loot = Math.floor(stored * VAULT_LOOT_SHARE);
    const burn = Math.floor(stored * VAULT_BURN_SHARE);
    const scatter = Math.max(0, stored - loot - burn);
    if (loot) gain(attacker, { g: loot });
    if (burn) metaSet("solcraft:goldSunk", String((Number(metaGet("solcraft:goldSunk", "0")) || 0) + burn));
    if (scatter) scatterGold(b.x, b.z, scatter);
    if (owner) pushEvent(owner.id, "raid", `🏦 Your Vault was breached: ${loot}🪙 looted, ${burn} burned, ${scatter} scattered.`);
    pushEvent(attacker.id, "fill", `🏦 Vault breached. +${loot}🪙 to purse. The ledger gasped.`);
  } else if (owner) {
    pushEvent(owner.id, "raid", `🏚 ${attacker.name} destroyed your ${b.nm || def?.name || b.kind}. The cleared tile can be reclaimed.`);
  }
  const destroyedKeepId = b.owner === 0 && b.kind === "keep" ? Number(b.id || 0) : 0;
  const t = tileAt(b.x, b.z) as any;
  if (t && !isStarterTile(b.x, b.z)) deleteTile(t);
  if (b.kind === GOLD_MINE_KIND) {
    sysChat(`⛏ Coin Mint at ${b.x}, ${b.z} collapsed. Coin spawns continue on claimed territory, but redemption needs another mint.`);
  }
  deleteBuilding(b);
  if (destroyedKeepId) cleanupNeutralKeepSiegeTilesAround(b.x, b.z, destroyedKeepId);
  dropStats(b.owner); dropStats(attacker.id);
  bump();
  sysChat(`${attacker.name} destroyed ${def?.name || b.kind}. Cities remember.`);
  return ok({ note: `${def?.name || "Building"} destroyed. Clear land, clean slate.` });
}
function damageBuilding(attacker: Player, b: Building, rawDmg: number, cause = "siege") {
  const def = buildingDef(b.kind);
  if (!b || b.owner === attacker.id) return err("That's yours.");
  if (isPlayerBaseProtectedBuilding(b)) {
    pushEvent(attacker.id, "raid", "Player bases are protected. Siege neutral Keeps for coins.");
    return err("Player bases are protected. Siege neutral Keeps for coins.", "BASE_PROTECTED");
  }
  const isNeutralKeep = Number(b.owner || 0) === 0 && b.kind === "keep";
  const regen = isNeutralKeep ? applyKeepRegen(b, now()) : { recovered: 0 };
  let dmg = Math.max(1, Math.floor(rawDmg));
  if (b.kind === "worldwonder" && cause === "siege") dmg = 1;
  if (!isNeutralKeep && b.kind !== "bomb" && hasTowerProtection(b.owner, b.x, b.z)) dmg = Math.max(1, Math.floor(dmg * (1 - towerCutFor(b.owner))));
  b.hp = Math.max(0, Number(b.hp || buildMaxHp(def, b.level || 1)) - dmg);
  if (isNeutralKeep) b.accAt = now();
  bump();
  if (b.hp <= 0) return destroyBuilding(attacker, b, cause);
  if (b.owner) pushEvent(b.owner, "raid", `⚠ ${attacker.name} damaged your ${b.nm || def?.name || b.kind}: ${Math.ceil(b.hp)} HP left.`);
  if (isNeutralKeep) {
    const name = b.nm || "Keep";
    const baseNote = `${name} took ${dmg} damage — ${Math.ceil(b.hp)}/${Math.ceil(Number(b.maxHp || b.hp || 1))} HP left.`;
    return ok({ note: keepRaidNote({ regenRecovered: regen.recovered, baseNote }), keep: { uid: b.id, hp: b.hp, maxHp: b.maxHp, regenRecovered: regen.recovered } });
  }
  return ok({ note: `${def?.name || b.kind} took ${dmg} damage — ${Math.ceil(b.hp)} HP left.` });
}
function detonateBomb(p: Player, b: Building) {
  if (!b || b.kind !== "bomb") return err("That is not an active destroy tool.");
  const spec = tunedDestroySpec(String(b.nm || "popper"));
  const radius = spec.radius || 0;
  const keepSiegePads = keepSiegePadKeysInBox(b.x, b.z, radius + KEEP_SIEGE_PAD_RADIUS);
  let cleared = 0, protectedCount = 0, damaged = 0, destroyed = 0, towerSaved = 0;
  const touchedOwners = new Set<number>();
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    const x = b.x + dx, z = b.z + dz;
    if (isStarterTile(x, z)) { protectedCount++; continue; }
    const target = buildingAt(x, z) as Building | null;
    if (target && target.id !== b.id && target.kind !== "bomb") {
      if (isPlayerBaseProtectedBuilding(target)) { protectedCount++; continue; }
      const before = Number(target.hp || 0);
      const r = damageBuilding(p, target, Number((spec as any).buildingDmg || 35), "destroy tool");
      damaged++;
      if (!getBuilding(target.id)) destroyed++;
      continue;
    }
    const t = tileAt(x, z) as any;
    if (t) {
      if (keepSiegePads.has(key(x, z))) { protectedCount++; continue; }
      if (Number(t.owner || 0) && t.owner !== p.id) { protectedCount++; continue; }
      if (hasTowerProtection(t.owner, x, z) && radius > 0 && ((Math.abs(x + z) % 2) === 0)) { towerSaved++; continue; }
      if (t.owner !== p.id) touchedOwners.add(t.owner);
      deleteTile(t); cleared++;
    }
  }
  deleteBuilding(b);
  dropStats(p.id);
  bump();
  sysChat(`${p.name}'s ${spec.name} cleared ${cleared} tile${cleared === 1 ? "" : "s"} and damaged ${damaged} structure${damaged === 1 ? "" : "s"}.`);
  for (const owner of touchedOwners) pushEvent(owner, "raid", `💥 ${p.name}'s ${spec.name} cleared nearby territory. Towers saved ${towerSaved} tile${towerSaved === 1 ? "" : "s"}.`);
  addXp(p, XP.capture);
  autoTrainSkill(p, "warrior", Math.max(4, cleared + damaged * 2));
  return ok({ note: protectedCount ? `💥 Cleared ${cleared}, damaged ${damaged}. Starter camps refused.` : `💥 Cleared ${cleared}, damaged ${damaged}. Siege first, claim after.` });
}

function useBomb(p: Player, b: Building, def: any) {
  const fuseLeft = Math.ceil(((b.cdUntil || 0) - now()) / 1000);
  if (fuseLeft > 0) return err(`Tool fuse: ${fuseLeft}s left. It is counting with confidence.`);
  return detonateBomb(p, b);
}
function markBuildingUsed(b: Building) {
  (b as any).usedAt = now();
  bump();
  return (b as any).usedAt;
}


function autoHarvestProducerRing(p: Player, b: Building, kind: "tree" | "rock") {
  const cornerKeys = new Set(PRODUCER_CORNER_SPOTS.map(([dx, dz]) => `${b.x + dx},${b.z + dz}`));
  const rows = (db.doodads.select().where(inBox(b.x, b.z, 1)).all() as any[])
    .filter((d) => d.state === kind && cornerKeys.has(`${d.x},${d.z}`));
  const cleaned = clearProducerCrossNodes(b.x, b.z, kind);
  if (!rows.length) {
    if (cleaned) { bump(); logEconomyEvent("producerCrossCleanup", { player: p.id, building: b.kind, cleaned }); }
    return ok({ note: `${b.kind === "lumber" ? "Lumber Camp" : "Quarry"}: no ${kind === "tree" ? "corner trees" : "corner rocks"} ready. The cross stays open.` });
  }
  const rawPer = (kind === "tree" ? ECONOMY_RULES.treeWood : ECONOMY_RULES.rockStone) + gatherBonus(p.skills as Skills);
  const boosterKind = kind === "tree" ? "lumber" : "quarry";
  let dropped = 0;
  let upgradeBonus = 0;
  for (const d of rows) {
    // Camps/quarries automate the chopping/mining, not the pickup.
    // The resource still drops on the board so players must walk over it.
    db.doodads.delete(d.id);
    const landOwner = Number(tileAt(d.x, d.z)?.owner || 0);
    const boost = (landOwner === p.id || b.owner === p.id) ? territoryYieldBoost(p.id, boosterKind, rawPer) : { base: rawPer, amount: rawPer, bonus: 0, stacks: 0, mult: 1 };
    upgradeBonus += boost.bonus;
    dropped += dropHarvestLoot(d.x, d.z, kind === "tree" ? "wood" : "stone", boost.amount);
  }
  if (kind === "tree") {
    p.treesChopped = (p.treesChopped || 0) + rows.length;
    addXp(p, XP.chop * rows.length);
  } else {
    addXp(p, XP.mine * rows.length);
  }
  autoTrainSkill(p, "gather", rows.length);
  autoTrainSkill(p, "haste", Math.max(1, Math.ceil(rows.length / 2)));
  refreshMilestones(p);
  markBuildingUsed(b);
  bump();
  logEconomyEvent("producerHarvest", { player: p.id, building: b.kind, nodes: rows.length, cleaned, res: kind === "tree" ? "wood" : "stone", dropped, upgradeBonus });
  const bonusNote = upgradeBonus ? ` Upgrade bonus +${upgradeBonus}${kind === "tree" ? "🪵" : "🪨"}.` : "";
  return ok({ note: `${b.kind === "lumber" ? "Lumber Camp" : "Quarry"}: cut ${rows.length} corner ${kind === "tree" ? "tree" : "rock"}${rows.length === 1 ? "" : "s"}. ${dropped}${kind === "tree" ? "🪵" : "🪨"} dropped nearby.${bonusNote} Walk over it to collect.`, harvested: rows.length, dropped, cleaned, upgradeBonus });
}


/* E — use a nearby building. Owned buildings can perform real work;
   other buildings still respond cosmetically so the interaction feels coherent. */
export function useBuilding(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b) return err("Gone.");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Walk next to it first.");
  const def = buildingDef(b.kind);
  if (!def) return err("Unknown building.");
  if (isUnderConstruction(b)) return err(`${b.nm || def.name} is still under construction — ${Math.ceil(constructionLeftMs(b) / 1000)}s left.`);
  if (b.owner !== p.id) return ok({ cosmetic: true, usedAt: markBuildingUsed(b), note: `${def.name} responds, but only its owner can operate it.` });
  if (b.kind === GOLD_MINE_KIND) { markBuildingUsed(b); return collectGoldMine(p, uid); }
  if (def.use?.k === "bomb") return useBomb(p, b, def);
  if (b.kind === "lumber") return autoHarvestProducerRing(p, b, "tree");
  if (b.kind === "quarry") return autoHarvestProducerRing(p, b, "rock");

  /* producers: collect the stockpile (the only time acc is written) */
  const acc = accNow(b);
  if (def.prod && !["lumber", "quarry"].includes(b.kind) && acc >= 1) {
    const n = Math.floor(acc);
    b.acc = acc - n; b.accAt = now();
    const resKey = Object.keys(def.prod)[0] as ResKey;
    gain(p, { [resKey]: n });
    markBuildingUsed(b);
    return ok({ note: `Collected +${n}${COST_GLYPH[resKey] || resKey} from ${b.nm || def.name}.` });
  }
  const u = def.use;
  if (!u) {
    if (b.kind === "warehouse") { markBuildingUsed(b); return ok({ note: `Warehouse active — storage cap is ${resourceCap(p, "w")} each for wood, stone, and supplies.` }); }
    if (b.kind === "granary") { markBuildingUsed(b); return ok({ note: `Granary active — food cap is ${resourceCap(p, "f")}🌾.` }); }
    if (b.kind === "townhall") { markBuildingUsed(b); return ok({ note: `Town Hall active — territory capacity is ${tileCapacityFor(p)} tiles.` }); }
    if (b.kind === "barracks") { markBuildingUsed(b); return ok({ note: `Barracks active — Watchtowers get +${Math.round((towerDpsFor(p.id) / TOWER_BOMB_DPS - 1) * 100)}% tool damage and range ${towerRangeFor(p.id)}.` }); }
    if (b.kind === "watchtower") { markBuildingUsed(b); return ok({ note: `Watchtower active — shoots enemy destroy tools in range ${towerRangeFor(p.id)} and reduces building damage.` }); }
    markBuildingUsed(b);
    return ok({ cosmetic: true, note: `${def.name} responds.` });
  }
  if (u.k === "trade") { markBuildingUsed(b); return ok({ openTrade: true }); }
  if (b.cdUntil > now()) return err(`${def.name} is recharging — ${Math.ceil((b.cdUntil - now()) / 1000)}s.`);
  const cost: Record<string, number> = { ...(u.inp || {}) };
  if (u.e) cost.e = (cost.e || 0) + u.e;
  const miss = afford(p, cost);
  if (miss.length) return err("Missing: " + miss.join(" "));

  if (u.k === "rest") {
    spend(p, cost);
    p.hp = MAX_HP;
    b.cdUntil = now() + (u.cd || 0) * 1000;
    markBuildingUsed(b);
    return ok({ note: "Rested — ♥ restored." });
  }
  if (u.k === "energy") {
    const e = energyNow(p);
    if (e.energy >= e.maxE) return err("Energy already full.");
    spend(p, cost);
    gain(p, { e: u.amt || 5 });
    b.cdUntil = now() + (u.cd || 0) * 1000;
    markBuildingUsed(b);
    return ok({ note: `+${u.amt || 5}⚡` });
  }
  if (u.k === "heal") {
    if (energyNow(p).hp >= MAX_HP) return err("Already at full ♥.");
    spend(p, cost);
    p.hp = MAX_HP;
    markBuildingUsed(b);
    return ok({ note: "Hot meal — ♥ restored!" });
  }
  if (u.k === "convert") {
    spend(p, cost);
    gain(p, u.out || {});
    if (u.out?.p) p.planksMade += u.out.p;
    refreshMilestones(p);
    const got = Object.entries(u.out || {}).map(([k, v]) => `+${v}${k}`).join(" ");
    markBuildingUsed(b);
    return ok({ note: `${b.nm || def.name}: ${got}` });
  }
  if (u.k === "craft") {
    markBuildingUsed(b);
    return ok({ openCraft: true, note: "Forge ready. Open Craft to choose what to make." });
  }
  return err("Nothing happened.");
}

/* ---------- crafting (deterministic recipes from the Craft modal) ---------- */
export function craftRecipe(p: Player, rid: string) {
  const r = RECIPE_BY_ID[rid];
  if (!r) return err("Unknown recipe.");
  if (r.needForge && !nearBuilding(p, "forge")) return err("Stand beside a Forge to craft this.");
  if ((r as any).needWorkshop && !hasOwnedKind(p, "workshop")) return err("Build a Workshop to unlock this recipe.");
  if ((r as any).needAlchemy && !hasOwnedKind(p, "alchemy")) return err("Build an Alchemy Shop to brew this.");
  if (r.reqSkill && skillLvl(p.skills as Skills, r.reqSkill.id) < r.reqSkill.lvl)
    return err(`Needs ${SKILL_BY_ID[r.reqSkill.id]?.name} level ${r.reqSkill.lvl}.`);
  const miss = afford(p, r.cost);
  if (miss.length) return err("Missing: " + miss.join(" "));
  if ((r.out.t === "gear" || r.out.t === "use") && packFull(p)) return err("Backpack full — make room first (I).");
  spend(p, r.cost);
  if (r.out.t === "gear") {
    packAdd(p, { t: "gear", id: r.out.id });
    p.gearCrafted++;
  } else if (r.out.t === "use") {
    if (!(USE_ITEMS as any)[r.out.id]) return err("Unknown usable item.");
    packAdd(p, { t: "use", id: r.out.id } as any);
  } else {
    gain(p, { [r.out.id]: r.out.n || 1 });
    if (r.out.id === "p") p.planksMade += r.out.n || 1;
  }
  addXp(p, XP.craft);
  autoTrainSkill(p, r.out.t === "gear" || r.out.t === "use" ? "warrior" : "mason", 4);
  refreshMilestones(p);
  return ok({ note: `Crafted ${r.glyph} ${r.name} · +${XP.craft} XP` });
}

/* market adjacency: yours OR anyone's market within 1 cell */
export function nearMarket(p: Player): boolean {
  if (nearTradePost(p.x, p.z)) return true;
  const around = db.buildings.select().where(inBox(p.x, p.z, 1)).all() as Building[];
  return around.some((b) => buildingDef(b.kind)?.use?.k === "trade");
}
export function trade(p: Player, tradeIdx: number) {
  return err("Trade posts do not set resource prices. Player offers do — beautifully chaotic, but backed by escrow.");
}

/* ---------- wallet & gold → $CRAFTS redemption ---------- */
export function setWallet(p: Player, addr: string) {
  const a = String(addr || "").trim();
  if (!p.wallet) return err("Log out, connect Phantom, and sign in to bind a wallet.");
  if (!a || a === p.wallet) return ok({ note: "Wallet is already linked through Phantom sign-in." });
  return err("Wallet changes require signing in with that Phantom account.");
}
function redeemExecute(p: Player, gold: number) {
  if (readMetaBool(META_PAUSE_WITHDRAWALS)) return err("Withdrawals are temporarily paused.");
  if (!nearGoldMine(p)) return err("Stand beside an active Coin Mint to exchange coins into $CRAFTS.");
  if (!p.wallet) return err("Connect Phantom first. The bank only trusts signed settlers.");
  gold = Math.floor(Number(gold) || 0);
  if (gold < REDEEM_MIN_GOLD) return err(`Carry at least ${REDEEM_MIN_GOLD}🪙 in your purse to enter this cycle's $CRAFTS pool.`);
  const pendingForWallet = (db.redemptions.select().where({ wallet: p.wallet, status: "ready" }).all() as any[])
    .reduce((a, r) => a + Number(r.gold || 0), 0);
  const remainingCap = Math.max(0, ECONOMY_RULES.redeemCapGoldPerWalletCycle - pendingForWallet);
  if (remainingCap <= 0) return err(`This wallet already redeemed ${ECONOMY_RULES.redeemCapGoldPerWalletCycle}🪙 this cycle.`);
  gold = Math.min(gold, remainingCap);
  if ((p.inv.g || 0) < gold) return err("Not enough purse coins. Safe coins must be moved to purse first.");
  const crafts = Math.floor((gold * CRAFTS_PER_GOLD_FIXED) * 1_000_000) / 1_000_000;
  const available = readMetaNum(META_PAYOUT_POOL) + readMetaNum(META_FEE_POOL);
  if (available + 1e-9 < crafts) return err(`Mint liquidity is short. Needs ${crafts} $CRAFTS in the payout/fee pool.`);
  let need = crafts;
  const fromPayout = Math.min(readMetaNum(META_PAYOUT_POOL), need); writeMetaNum(META_PAYOUT_POOL, readMetaNum(META_PAYOUT_POOL) - fromPayout); need -= fromPayout;
  if (need > 0) writeMetaNum(META_FEE_POOL, readMetaNum(META_FEE_POOL) - need);
  spend(p, { g: gold });
  db.redemptions.insert({ player: p.id, wallet: p.wallet, gold, crafts, status: "ready" } as any);
  sysChat(`${p.name} exchanged ${gold}🪙 for ${crafts} $CRAFTS at a Coin Mint.`);
  logEconomyEvent("fixedRedeem", { player: p.id, wallet: p.wallet, gold, crafts });
  return ok({ note: `✓ ${gold}🪙 → ${crafts} $CRAFTS at fixed rate (${GOLD_PER_CRAFTS_FIXED}🪙 = 1).` });
}
export function redeemStart(p: Player, gold: number) {
  if (readMetaBool(META_PAUSE_WITHDRAWALS)) return err("Withdrawals are temporarily paused.");
  if (!nearGoldMine(p)) return err("Stand beside an active Coin Mint to exchange coins into $CRAFTS.");
  gold = Math.floor(Number(gold) || 0);
  if (gold < REDEEM_MIN_GOLD) return err(`Carry at least ${REDEEM_MIN_GOLD}🪙 in your purse to redeem.`);
  if ((p.inv.g || 0) < gold) return err("Not enough purse coins. Vault coins don't take risky walks by itself.");
  channels.set(p.id, { x: p.x, z: p.z, until: now() + ECONOMY_RULES.withdrawMs, type: "redeem", gold });
  return ok({ ms: ECONOMY_RULES.withdrawMs, note: "Minting… stay beside the Coin Mint until the transfer is ready." });
}
export function redeemFinish(p: Player) {
  const ch = channels.get(p.id);
  if (!ch || ch.type !== "redeem") return err("No withdrawal in progress.");
  if (now() < ch.until - 250) return err("Still redeeming…");
  if (p.x !== ch.x || p.z !== ch.z) { clearChannel(p.id); return err("Withdrawal cancelled because you moved."); }
  clearChannel(p.id);
  return redeemExecute(p, Number(ch.gold || 0));
}
export function redeemCancel(p: Player) {
  const ch = channels.get(p.id);
  if (ch?.type === "redeem") clearChannel(p.id);
  return ok();
}
export function redeem(p: Player, gold: number) { return redeemStart(p, gold); }

/* hook for the external $CRAFTS distributor: every minute it reads
   on-chain holder balances and calls this per holder share.
   Total minute pool = ENERGY_POOL_PER_PLAYER × activeCount(). */
export function syncCraftsBalance(wallet: string, balance: number): boolean {
  const p = db.players.select().where({ wallet }).first() as Player | null;
  if (!p) return false;
  p.tokenBalance = Math.max(0, Number(balance) || 0);
  dropStats(p.id);
  return true;
}
export function creditEnergyByWallet(wallet: string, amount: number): boolean {
  // Backward-compatible hook name: external indexers should now send the latest $CRAFTS balance.
  return syncCraftsBalance(wallet, amount);
}

/* ---------- gear and usable backpack items ---------- */
export function usePackItem(p: Player, idx: number) {
  const pack = [...(p.pack as PackItem[])];
  const item = pack[idx];
  if (!item) return err("Empty slot.");
  if ((item as any).t !== "use") return err("That backpack item is not usable with 7.");
  const def = (USE_ITEMS as any)[(item as any).id];
  if (!def) return err("Unknown usable item.");
  const live = settleEnergy(p);
  let changed = false;
  if (def.out?.e) {
    const { maxE } = derived(p);
    if (live.energy >= maxE - 0.001) return err("Energy is already full.");
    p.energy = Math.min(maxE, live.energy + Number(def.out.e || 0));
    p.energyAt = now();
    changed = true;
  }
  if (def.heal) {
    if (live.hp >= MAX_HP) return err("Health is already full.");
    p.hp = Math.min(MAX_HP, live.hp + Number(def.heal || 0));
    changed = true;
  }
  if (!changed) return err("Nothing to use right now.");
  pack[idx] = null;
  p.pack = pack;
  liveTouch(p);
  return ok({ note: `Used ${def.glyph || "✦"} ${def.name || (item as any).id}.` });
}

export function equipPack(p: Player, idx: number) {
  const pack = [...(p.pack as PackItem[])];
  const item = pack[idx];
  if (!item) return err("Empty slot.");
  if (item.t === "relic") return ok({ note: `${item.n} — a trophy for your collection.` });
  if ((item as any).t === "use") return usePackItem(p, idx);
  if ((item as any).t === "bomb") return ok({ note: "Destroy tools are deployed from Deploy (6), not equipped." });
  const gdef = GEAR_BY_ID[item.id];
  if (!gdef) return err("Unknown gear.");
  const equip = { ...(p.equip as Equip) };
  const worn = equip[gdef.slot];
  equip[gdef.slot] = item.id;
  pack[idx] = worn ? { t: "gear", id: worn } : null;
  p.equip = equip;
  p.pack = pack;
  p.equippedOnce = 1;
  liveTouch(p);
  refreshMilestones(p);
  return ok({ note: `Equipped ${gdef.glyph} ${gdef.name}` });
}
export function unequip(p: Player, slot: string) {
  const equip = { ...(p.equip as Equip) };
  const id = (equip as any)[slot];
  if (!id) return err("Nothing there.");
  if (packFull(p)) return err("Backpack full — can't unequip.");
  (equip as any)[slot] = null;
  p.equip = equip;
  packAdd(p, { t: "gear", id });
  liveTouch(p);
  return ok();
}
export function dropPack(p: Player, idx: number) {
  const pack = [...(p.pack as PackItem[])];
  if (!pack[idx]) return err("Empty slot.");
  pack[idx] = null;
  p.pack = pack;
  return ok();
}

/* ---------- combat ---------- */
const SWORD_COST = Math.max(1, Number(process.env.SOLCRAFT_SWORD_ENERGY_COST || 4) || 4);
const SWORD_PLAYER_DAMAGE = Math.max(1, Number(process.env.SOLCRAFT_SWORD_PLAYER_DAMAGE || 4) || 4);

export function fight(p: Player, targetId: number) {
  const target = db.players.get(Number(targetId || 0)) as Player | null;
  if (!target) return err("Target gone.");
  if (target.id === p.id) return err("That is you.");
  if (cheb(target.x, target.z, p.x, p.z) > 1) return err("Stand beside that settler to attack.");
  const live = settleEnergy(p);
  if (live.energy < SWORD_COST) return err(`Need ${SWORD_COST}⚡ to swing your sword.`, "NO_ATTACK_ENERGY");
  spend(p, { e: SWORD_COST });
  const victimLive = settleEnergy(target);
  target.hp = Math.max(1, Number(victimLive.hp || MAX_HP) - SWORD_PLAYER_DAMAGE);
  (target as any).lastFoodHealAt = 0;
  liveTouch(p); liveTouch(target);
  pushEvent(target.id, "raid", `⚔ ${p.name} struck you for ${SWORD_PLAYER_DAMAGE}♥ damage.`);
  pushEvent(p.id, "raid", `⚔ You struck ${target.name || "a settler"} for ${SWORD_PLAYER_DAMAGE}♥ damage.`);
  bump();
  if (target.hp <= 1) {
    const dropped = dropDefeatedPlayerResources(target);
    pushEvent(target.id, "raid", `Your pack spilled on the ground. Coins stay in your purse.`);
    pushEvent(p.id, "raid", `Defeated ${target.name || "a settler"}. Their loose resources dropped nearby.`);
    return ok({ note: `Settler defeated. Loose resources dropped nearby.`, player: { hp: p.hp, maxHp: MAX_HP }, target: { id: target.id, hp: target.hp, maxHp: MAX_HP }, dropped });
  }
  return ok({ note: `Sword hit: -${SWORD_PLAYER_DAMAGE}♥.`, player: { hp: p.hp, maxHp: MAX_HP }, target: { id: target.id, hp: target.hp, maxHp: MAX_HP } });
}

export function attackNpc(p: Player, x: number, z: number) {
  const npc = proceduralNpcAt(x, z);
  if (!npc) return err("Nobody is there anymore.");
  if (cheb(x, z, p.x, p.z) > 1) return err("Stand beside the traveler first.");
  if (db.doodads.select().where({ x, z, state: "gone" }).first()) return err("That traveler already moved on.");
  const live = settleEnergy(p);
  if (live.energy < SWORD_COST) return err(`Need ${SWORD_COST}⚡ to swing your sword.`, "NO_ATTACK_ENERGY");
  if (live.hp <= Math.max(2, npc.attack)) return err("Too hurt to risk that fight.", "LOW_HEALTH");
  spend(p, { e: SWORD_COST });
  p.hp = Math.max(1, Number(live.hp || MAX_HP) - Math.max(1, Math.floor(Number(npc.attack || 3))));
  markProceduralNpcGone(x, z);
  const gathered = npcGatheredResourceBonus(npc);
  const carriedAmount = Math.max(1, Math.floor(Number(npc.resourceAmount || 1) + gathered.bonus));
  if (npc.coins) scatterGold(x, z, npc.coins);
  if (npc.resource === "w") scatterResource(x, z, "wood", carriedAmount);
  if (npc.resource === "s") scatterResource(x, z, "stone", carriedAmount);
  if (npc.resource === "f") scatterResource(x, z, "food", carriedAmount);
  addXp(p, XP.fight);
  autoTrainSkill(p, "warrior", npc.role === "warrior" ? 5 : 2);
  const delta = { empire: -8, bandits: 2 };
  const standing = adjustFactionStanding(p.id, delta);
  const rep = factionDeltaText(delta, standing);
  bump(); liveTouch(p);
  return ok({ note: `${npc.title || "Traveler"} defeated. Loot dropped nearby${gathered.bonus ? ` from ${gathered.source}` : ""}. ${rep}`, player: { hp: p.hp, maxHp: MAX_HP }, npc: { id: npc.id, x, z }, factions: factionSummaryForWire(p.id) });
}

export function donateNpc(p: Player, x: number, z: number) {
  const npc = proceduralNpcAt(x, z);
  if (!npc) return err("Nobody is there anymore.");
  if (cheb(x, z, p.x, p.z) > 1) return err("Stand beside the traveler first.");
  const inv = simpleInvBag(p.inv as any);
  const food = Math.max(0, Math.floor(Number(inv.f || 0)));
  const wood = Math.max(0, Math.floor(Number(inv.w || 0)));
  if (food >= 2) spend(p, { f: 2 } as any);
  else if (wood >= 3) spend(p, { w: 3 } as any);
  else return err("Donate 2 food or 3 wood.", "DONATION_NEEDS_SUPPLIES");
  const heal = 3;
  p.hp = Math.min(MAX_HP, Math.max(1, Number(p.hp || MAX_HP)) + heal);
  markProceduralNpcGone(x, z);
  addXp(p, 8);
  autoTrainSkill(p, "vigor", 3);
  const delta = { empire: 8, bandits: -1 };
  const standing = adjustFactionStanding(p.id, delta);
  const rep = factionDeltaText(delta, standing);
  bump(); liveTouch(p);
  return ok({ note: `Donated supplies to ${npc.title || "traveler"}. +${heal}♥ goodwill, +8 XP. ${rep}`, player: { hp: p.hp, maxHp: MAX_HP }, inv: p.inv, factions: factionSummaryForWire(p.id) });
}

export function donateKeep(p: Player, uid: number, rawAmount = 10) {
  const b = getBuilding(uid) as Building | null;
  if (!b || Number(b.owner || 0) !== 0 || b.kind !== "keep") return err("That is not a neutral Keep.");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Walk beside the Keep first.");
  const amount = Math.max(1, Math.min(50, Math.floor(Number(rawAmount || 10))));
  const have = Math.floor(Number(p.inv?.g || 0));
  if (have < amount) return err(`Keep tribute needs ${amount}🪙.`, "DONATION_NEEDS_COINS");
  spend(p, { g: amount });
  b.stored = Math.max(0, Math.floor(Number(b.stored || 0)) + amount);
  b.hp = Math.min(Number(b.maxHp || b.hp || 1), Math.max(1, Number(b.hp || 1)) + Math.max(1, Math.floor(amount / 2)));
  b.accAt = now();
  markBuildingUsed(b);
  addXp(p, Math.max(4, Math.floor(amount / 2)));
  const delta = { empire: -Math.max(1, Math.floor(amount / 5)), bandits: Math.max(2, Math.ceil(amount / 2)) };
  const standing = adjustFactionStanding(p.id, delta);
  const rep = factionDeltaText(delta, standing);
  bump(); liveTouch(p);
  return ok({ note: `Paid ${amount}🪙 tribute to ${b.nm || "the Keep"}. Bandits remember. ${rep}`, keep: { uid: b.id, hp: b.hp, maxHp: b.maxHp, stored: b.stored }, inv: p.inv, factions: factionSummaryForWire(p.id) });
}

/* Siege targets infrastructure only: enemy buildings and destroy tools.
   No direct player killing; the war is on cities, vaults, and land. */
export function raid(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b) return err("Gone.");
  if (cheb(b.x, b.z, p.x, p.z) > 1) return err("Stand beside it to attack it.");
  if (energyNow(p).energy < RAID_COST) return err(`Need ${RAID_COST}⚡ to attack.`);
  const siegeBonus = gearStat(p.equip as Equip, "atk") + skillAtk(p.skills as Skills);
  const isNeutralKeep = Number(b.owner || 0) === 0 && b.kind === "keep";
  let keepHit: any = null;
  if (isNeutralKeep) {
    const live = settleEnergy(p);
    keepHit = keepRaidHitPreview({ playerHp: live.hp, stored: b.stored || 0, siegeBonus, random: Math.random });
    if (!keepHit.ok) return err(keepHit.msg || "Too hurt to raid.", keepHit.reasonCode || "LOW_HEALTH");
  }

  spend(p, { e: RAID_COST });
  if (keepHit) p.hp = keepHit.playerHpAfter;
  const dmg = b.kind === "bomb" ? SIEGE_TOOL_DMG + siegeBonus : (isNeutralKeep ? keepHit.damage : Math.max(2, 2 + Math.floor(siegeBonus / 3)));
  const r = damageBuilding(p, b, dmg, "siege");

  if (r.ok && keepHit && getBuilding(b.id)) {
    const delta = { empire: 1, bandits: -1 };
    const standing = adjustFactionStanding(p.id, delta);
    let coins = 0;
    if (b.hp > 0 && keepHit.coins > 0) {
      coins = Math.min(Math.max(0, Math.floor(Number(b.stored || 0))), Math.floor(keepHit.coins));
      if (coins > 0) {
        b.stored = Math.max(0, Math.floor(Number(b.stored || 0)) - coins);
        gain(p, { g: coins });
      }
    }
    const rep = factionDeltaText(delta, standing);
    (r as any).note = `${keepRaidNote({ baseNote: (r as any).note || "Raid landed.", backlash: keepHit.backlash, coins })} ${rep}`;
    (r as any).player = { hp: p.hp, maxHp: MAX_HP };
    (r as any).factions = factionSummaryForWire(p.id);
    if (coins) (r as any).coins = coins;
    sysChat(`${p.name} struck ${b.nm || "a Keep"} at ${b.x}, ${b.z}.`);
  }

  if (r.ok) { addXp(p, XP.fight); autoTrainSkill(p, "warrior", b.kind === "bomb" ? 5 : 3); if (b.kind === "bomb") sysChat(`${p.name} damaged a destroy tool.`); }
  return r;
}

export function withdrawGold(p: Player, amount: number) {
  return withdrawSafeGold(p, Math.max(0, Math.floor(Number(amount) || 0)));
}

export function teleportHomeStart(p: Player) {
  if (p.x === p.spawnX && p.z === p.spawnZ) return err("Already at your flag.");
  if (TELEPORT_COST > 0 && energyNow(p).energy < TELEPORT_COST) return err(`Need ${TELEPORT_COST}⚡ to return to your flag.`);
  if (TELEPORT_COST > 0) spend(p, { e: TELEPORT_COST });
  channels.set(p.id, { x: p.x, z: p.z, until: now() + TELEPORT_MS, type: "home" });
  return ok({ ms: TELEPORT_MS, note: "Return Scroll casting… stand still until the flag answers." });
}
export function teleportHomeFinish(p: Player) {
  const ch = channels.get(p.id);
  if (!ch || ch.type !== "home") return err("Not returning home.");
  if (now() < ch.until - 250) return err("Still returning…");
  if (p.x !== ch.x || p.z !== ch.z) {
    clearChannel(p.id);
    return err("Teleport cancelled because you moved.");
  }
  p.x = p.spawnX;
  p.z = p.spawnZ;
  clearChannel(p.id);
  liveTouch(p);
  bump();
  return ok({ note: "Return Scroll complete. Back at your flag.", x: p.x, z: p.z });
}
export function teleportHomeCancel(p: Player) {
  const ch = channels.get(p.id);
  if (ch?.type === "home") clearChannel(p.id);
  return ok();
}
export function teleportWonderStart(p: Player, uid: number) {
  const b = getBuilding(uid) as Building | null;
  if (!b || b.owner !== p.id || b.kind !== "worldwonder") return err("That World Wonder is not yours.");
  if (cheb(p.x, p.z, b.x, b.z) <= 2) return err("Already at that World Wonder.");
  channels.set(p.id, { x: p.x, z: p.z, until: now() + TELEPORT_MS, type: "wonder", uid: Number(b.id), tx: Number(b.x), tz: Number(b.z) });
  return ok({ ms: TELEPORT_MS, note: `Wonder Scroll casting… ${b.nm || "World Wonder"} is answering.` });
}
export function teleportWonderFinish(p: Player) {
  const ch = channels.get(p.id);
  if (!ch || ch.type !== "wonder") return err("Not travelling to a World Wonder.");
  if (now() < ch.until - 250) return err("Still travelling…");
  if (p.x !== ch.x || p.z !== ch.z) {
    clearChannel(p.id);
    return err("Teleport cancelled because you moved.");
  }
  const b = getBuilding(Number(ch.uid || 0)) as Building | null;
  if (!b || b.owner !== p.id || b.kind !== "worldwonder") { clearChannel(p.id); return err("That World Wonder is gone."); }
  const spot = findWonderLanding(p, Number(b.x), Number(b.z));
  p.x = spot.x; p.z = spot.z;
  clearChannel(p.id);
  liveTouch(p);
  bump();
  return ok({ note: "Wonder Scroll complete.", x: p.x, z: p.z });
}
export function teleportWonderCancel(p: Player) {
  const ch = channels.get(p.id);
  if (ch?.type === "wonder") clearChannel(p.id);
  return ok();
}
export function teleportHome(p: Player) {
  return teleportHomeStart(p);
}

/* ---------- player ↔ player offers (escrowed) ---------- */
export function postOffer(p: Player, gRes: ResKey, gAmt: number, wRes: ResKey, wAmt: number) {
  gAmt = Math.max(1, Math.min(99, Math.round(gAmt)));
  wAmt = Math.max(1, Math.min(99, Math.round(wAmt)));
  if (!RES_KEYS.includes(gRes) || !RES_KEYS.includes(wRes)) return err("Bad resources.");
  if ((p.inv[gRes] || 0) < gAmt) return err("You don't have that much to offer.");
  spend(p, { [gRes]: gAmt }); // escrow
  db.offers.insert({ byId: p.id, byName: p.name, gRes, gAmt, wRes, wAmt, open: 1 });
  bump();
  return ok({ note: "Offer posted to the board." });
}
export function acceptOffer(p: Player, offerId: number) {
  const o = db.offers.get(offerId) as any;
  if (!o || !o.open) return err("Offer is gone.");
  if (o.byId === p.id) return err("That's your own offer.");
  if ((p.inv[o.wRes] || 0) < o.wAmt) return err("You can't afford what they want.");
  spend(p, { [o.wRes]: o.wAmt });
  gain(p, { [o.gRes]: o.gAmt });
  o.open = 0;
  bump();
  const seller = db.players.get(o.byId) as Player | null;
  if (seller) {
    const inv = { ...seller.inv };
    inv[o.wRes] = (inv[o.wRes] || 0) + o.wAmt;
    seller.inv = inv;
    pushEvent(seller.id, "fill", `✓ ${p.name} accepted your offer — received ${o.wAmt} ${o.wRes}`);
  }
  p.tradesDone++;
  refreshMilestones(p);
  return ok({ note: `Trade complete: −${o.wAmt}${o.wRes} → +${o.gAmt}${o.gRes}` });
}
export function cancelOffer(p: Player, offerId: number) {
  const o = db.offers.get(offerId) as any;
  if (!o || !o.open || o.byId !== p.id) return err("Not yours.");
  o.open = 0;
  gain(p, { [o.gRes]: o.gAmt }); // refund escrow
  bump();
  return ok({ note: "Offer withdrawn, goods returned." });
}

/* ---------- chat ---------- */
export function sendChat(p: Player, msg: string) {
  const m = String(msg || "").trim().slice(0, 120);
  if (!m) return err("Empty.");
  if (m === "/loaded") {
    if (!devCommandsEnabled() || !isAdminPlayer(p)) return err("Unknown command.", "UNKNOWN_CHAT_COMMAND");
    gain(p, { w: 100, p: 20, s: 100, f: 50, g: 200, sh: 10 });
    const { maxE } = settleEnergy(p);
    p.energy = maxE;
    pushEvent(p.id, "sys", "Dev cache opened: +100🪵 +20📦 +100🪨 +50🌾 +200🪙 +10◈");
    return ok();
  }
  chatPush(p.name, m, 0);
  return ok();
}

/* ---------- dispatcher used by the API route ---------- */
function dispatchInner(p: Player, body: any) {
  const t = String(body.type || "");
  if (isSpectator(p) && !["move", "movePath", "adminMapTeleport", "adminDemolishAt", "adminSpawnKeep", "profileAppearance", "setupProfile", "home", "homeStart", "homeFinish", "homeCancel", "wonderStart", "wonderFinish", "wonderCancel"].includes(t)) {
    return err("Spectator mode can move and customize, but cannot affect the world.");
  }
  switch (t) {
    case "move": return move(p, body.x | 0, body.z | 0);
    case "movePath": return movePath(p, body.steps);
    case "adminMapTeleport": return adminMapTeleport(p, body.x, body.z);
    case "claim": return claim(p, body.x | 0, body.z | 0);
    case "home": return teleportHomeStart(p);
    case "homeStart": return teleportHomeStart(p);
    case "homeFinish": return teleportHomeFinish(p);
    case "homeCancel": return teleportHomeCancel(p);
    case "wonderStart": return teleportWonderStart(p, body.uid | 0);
    case "wonderFinish": return teleportWonderFinish(p);
    case "wonderCancel": return teleportWonderCancel(p);
    case "adminSpawnKeep": return adminSpawnKeep(p, body);
    case "adminDemolishAt": return adminDemolishAt(p, body);
    case "place": return place(p, String(body.kind), body.x | 0, body.z | 0, body.prompt, body.recipe);
    case "completeFoundation": return completeFoundation(p, Number(body.uid || 0), String(body.kind || ""));
    case "placeWonder": return placeWorldWonder(p, body.x | 0, body.z | 0, body.prompt, body.recipe);
    case "makeBomb": return craftDestroyTool(p, String(body.variant || body.bomb || "popper"));
    case "spawnBomb": return castBorderBomb(p, String(body.variant || body.bomb || "popper"), body.x, body.z);
    case "placeBomb": return castBorderBomb(p, String(body.variant || body.bomb || "popper"), body.x, body.z);
    case "demolish": return demolish(p, body.uid | 0);
    case "customize": return customize(p, body.uid | 0, body.nm, body.cl);
    case "profileFace": return setProfileFace(p, body.faceImage == null ? null : String(body.faceImage));
    case "profileAppearance": return setProfileAppearance(p, body.appearance);
    case "setupProfile": return setupProfile(p, String(body.name || ""), Number(body.body) || p.body, Number(body.hat) || p.hat, body.appearance);
    case "upgrade": return upgrade(p, body.uid | 0);
    case "repair": return repair(p, body.uid | 0);
    case "harvestStart": return harvestStart(p, body.x | 0, body.z | 0);
    case "harvestFinish": return harvestFinish(p, body.x | 0, body.z | 0);
    case "harvestCancel": return harvestCancel(p);
    case "craft": return craftRecipe(p, String(body.recipe || body.id || ""));
    case "learn": return err("Skills are hidden in the minimal build.");
    case "use": return useBuilding(p, body.uid | 0);
    case "trade": return trade(p, body.idx | 0);
    case "usePack": return usePackItem(p, body.idx | 0);
    case "equip": return equipPack(p, body.idx | 0);
    case "unequip": return unequip(p, String(body.slot));
    case "drop": return dropPack(p, body.idx | 0);
    case "fight": return fight(p, Number(body.target || body.targetId || 0));
    case "attackNpc": return attackNpc(p, body.x | 0, body.z | 0);
    case "donateNpc": return donateNpc(p, body.x | 0, body.z | 0);
    case "donateKeep": return donateKeep(p, body.uid | 0, Number(body.amount || 10));
    case "siege": return body.sourceId || body.sourceX != null ? siegeGoldSource(p, body.sourceId || body.sourceX, body.sourceZ) : raid(p, body.uid | 0);
    case "siegeSource": return siegeGoldSource(p, body.sourceId || body.x, body.z);
    case "raid": return raid(p, body.uid | 0);
    case "collectGoldMine": return collectGoldMine(p, body.uid | 0);
    case "postOffer": return postOffer(p, body.gRes, Number(body.gAmt), body.wRes, Number(body.wAmt));
    case "acceptOffer": return acceptOffer(p, body.id | 0);
    case "cancelOffer": return cancelOffer(p, body.id | 0);
    case "wallet": return setWallet(p, String(body.addr || ""));
    case "withdrawGold": return withdrawGold(p, Number(body.gold || body.amount || 0));
    case "redeem": return redeemStart(p, Number(body.gold));
    case "redeemStart": return redeemStart(p, Number(body.gold));
    case "redeemFinish": return redeemFinish(p);
    case "redeemCancel": return redeemCancel(p);
    case "claimGuideReward": return claimGuideReward(p, String(body.id || body.guideId || ""));
    case "guideVisit": return markGuideVisit(p, String(body.id || body.panel || ""));
    case "chat": return sendChat(p, body.msg);
    default: return err("Unknown action: " + t);
  }
}

export function dispatch(p: Player, body: any) {
  try { return tx(() => dispatchInner(p, body)); }
  catch (e) { return stateChangedRetry(e); }
}