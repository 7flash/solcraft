// Resident ECS world runtime.
// Live gameplay snapshots read this in-memory world. SQLite remains the
// account/config/bank/audit store and initial boot source until a snapshot file
// exists. Runtime movement lives here instead of going through per-step DB writes.
import { db, metaGet, metaSet } from "./db";
import { saveResidentWorldSnapshot, loadResidentWorldSnapshot, type ResidentWorldSnapshot } from "./residentWorldSnapshot";

export type ResidentRow = Record<string, any>;
export type ResidentMoveState = {
  id: number;
  x: number;
  z: number;
  energy?: number;
  energyAt?: number;
  lastSeq: number;
  updatedAt: number;
  dirty: boolean;
};

type ResidentWorld = {
  loaded: boolean;
  loadedAt: number;
  rev: number;
  playerRev: number;
  dirty: boolean;
  playerDirty: boolean;
  chunkSize: number;
  chunkRevs: Map<string, number>;
  players: Map<number, ResidentRow>;
  tiles: Map<string, ResidentRow>;
  buildings: Map<number, ResidentRow>;
  doodads: Map<string, ResidentRow>;
  loot: Map<number, ResidentRow>;
  lastSaveAt: number;
  reason: string;
};

const CHUNK_SIZE = 32;
const world: ResidentWorld = {
  loaded: false,
  loadedAt: 0,
  rev: 1,
  playerRev: 1,
  dirty: false,
  playerDirty: false,
  chunkSize: CHUNK_SIZE,
  chunkRevs: new Map(),
  players: new Map(),
  tiles: new Map(),
  buildings: new Map(),
  doodads: new Map(),
  loot: new Map(),
  lastSaveAt: 0,
  reason: "boot",
};

const liveMoves = new Map<number, ResidentMoveState>();

function now() { return Date.now(); }
function int(v: any, fallback = 0) { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : fallback; }
function num(v: any, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function idOf(v: any) { const id = int(v, 0); return id > 0 ? id : 0; }
function key(x: any, z: any) { return `${int(x)},${int(z)}`; }
function chunkKey(x: any, z: any) { return `${Math.floor(int(x) / CHUNK_SIZE)},${Math.floor(int(z) / CHUNK_SIZE)}`; }
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v ?? null)); }
function rowArray(table: any): any[] { try { return table?.select?.().all?.() || []; } catch { return []; } }
function setChunkRevFor(x: any, z: any) {
  const ck = chunkKey(x, z);
  world.chunkRevs.set(ck, Math.max(Number(world.chunkRevs.get(ck) || 0), world.rev));
}
function normalizeBuildingKind(row: any) {
  const r = { ...(row || {}) };
  if (String(r.kind || "") === "worldwonder") r.kind = "landmark";
  return r;
}
function denormalizeBuildingKind(row: any) {
  const r = { ...(row || {}) };
  if (String(r.kind || "") === "landmark") r.kind = "worldwonder";
  return r;
}


function cleanPlayerRow(rowLike: any) {
  const r = { ...(rowLike || {}) };
  // Keep Resident snapshot hot rows lean. Full face/profile payloads should be
  // read only by profile/inspect flows, never by every /api/state poll.
  delete r.faceImage;
  if (typeof r.appearance === "string" && r.appearance.length > 2400) r.appearance = "";
  return r;
}
function nextEntityId(map: Map<number, ResidentRow>) {
  let max = 0;
  for (const id of map.keys()) max = Math.max(max, Number(id || 0));
  return max + 1;
}
function setStructuralDirty(reason = "mutation", atX?: any, atZ?: any) {
  world.rev += 1;
  world.dirty = true;
  world.reason = reason;
  if (atX !== undefined && atZ !== undefined) setChunkRevFor(atX, atZ);
  try { metaSet("solcraft:residentWorld:lastMutation:v1", JSON.stringify({ at: now(), rev: world.rev, reason })); } catch {}
  return world.rev;
}
function setPlayerDirty(reason = "player") {
  world.playerRev += 1;
  world.playerDirty = true;
  world.reason = reason;
  return world.playerRev;
}

function loadFromDb() {
  world.players.clear();
  world.tiles.clear();
  world.buildings.clear();
  world.doodads.clear();
  world.loot.clear();
  for (const p of rowArray(db.players)) world.players.set(Number(p.id || 0), cleanPlayerRow(clone(p)));
  for (const t of rowArray(db.tiles)) world.tiles.set(key(t.x, t.z), clone(t));
  for (const b of rowArray(db.buildings)) world.buildings.set(Number(b.id || 0), normalizeBuildingKind(b));
  for (const d of rowArray(db.doodads)) world.doodads.set(key(d.x, d.z), clone(d));
  for (const l of rowArray(db.loot)) world.loot.set(Number(l.id || 0), clone(l));
  world.loaded = true;
  world.loadedAt = now();
  world.dirty = false;
  world.reason = "db-load";
}

function applySnapshot(s: ResidentWorldSnapshot) {
  world.players.clear(); world.tiles.clear(); world.buildings.clear(); world.doodads.clear(); world.loot.clear(); world.chunkRevs.clear();
  for (const p of s.players || []) world.players.set(Number((p as any).id || 0), cleanPlayerRow(clone(p)));
  for (const t of s.tiles || []) world.tiles.set(key((t as any).x, (t as any).z), clone(t));
  for (const b of s.buildings || []) world.buildings.set(Number((b as any).id || 0), normalizeBuildingKind(b));
  for (const d of s.doodads || []) world.doodads.set(key((d as any).x, (d as any).z), clone(d));
  for (const l of s.loot || []) world.loot.set(Number((l as any).id || 0), clone(l));
  for (const [k, v] of Object.entries(s.chunkRevs || {})) world.chunkRevs.set(k, Number(v || 0));
  world.rev = Math.max(1, Number(s.rev || 1));
  world.playerRev = Math.max(1, Number((s as any).playerRev || 1));
  world.loaded = true;
  world.loadedAt = now();
  world.lastSaveAt = Number(s.savedAt || 0);
  world.dirty = false;
  world.reason = "snapshot-load";
}

export function ensureResidentWorldStarted() {
  if (world.loaded) return residentWorldStatus();
  const snap = loadResidentWorldSnapshot();
  if (snap?.ok && snap.snapshot) applySnapshot(snap.snapshot);
  else loadFromDb();
  return residentWorldStatus();
}

export function residentWorldStatus() {
  ensureResidentWorldLoaded();
  let dirtyMoves = 0;
  for (const m of liveMoves.values()) if (m.dirty) dirtyMoves++;
  return {
    loaded: world.loaded,
    loadedAt: world.loadedAt,
    rev: world.rev,
    playerRev: world.playerRev,
    dirty: world.dirty,
    playerDirty: world.playerDirty,
    dirtyMoves,
    chunkSize: world.chunkSize,
    chunks: world.chunkRevs.size,
    players: world.players.size,
    tiles: world.tiles.size,
    buildings: world.buildings.size,
    loot: world.loot.size,
    lastSaveAt: world.lastSaveAt,
    reason: world.reason,
  };
}

function ensureResidentWorldLoaded() { if (!world.loaded) ensureResidentWorldStarted(); }

export function residentWorldRev() { ensureResidentWorldLoaded(); return world.rev; }
export function residentPlayerRev() { ensureResidentWorldLoaded(); return world.playerRev; }
export function residentChunkRevs() { ensureResidentWorldLoaded(); return Object.fromEntries(world.chunkRevs.entries()); }

export function markResidentWorldDirty(reason = "mutation", atX?: any, atZ?: any) {
  ensureResidentWorldLoaded();
  return setStructuralDirty(reason, atX, atZ);
}
export function markResidentPlayerDirty(reason = "player") {
  ensureResidentWorldLoaded();
  return setPlayerDirty(reason);
}

export function rebuildResidentWorldFromDb(reason = "db-refresh") {
  loadFromDb();
  markResidentWorldDirty(reason);
  world.dirty = false;
  return residentWorldStatus();
}

export function upsertResidentPlayer(rowLike: any) {
  ensureResidentWorldLoaded();
  if (!rowLike) return null;
  const row = clone(rowLike);
  const live = liveMoves.get(Number(row.id || 0));
  if (live) { row.x = live.x; row.z = live.z; if (live.energy !== undefined) row.energy = live.energy; if (live.energyAt !== undefined) row.energyAt = live.energyAt; row.moveSeq = live.lastSeq; }
  world.players.set(Number(row.id || 0), cleanPlayerRow(row));
  setPlayerDirty("player");
  return row;
}

export function residentMovementFor(playerIdLike: any): ResidentMoveState | null {
  ensureResidentWorldLoaded();
  const id = idOf(playerIdLike);
  return id ? liveMoves.get(id) || null : null;
}

export function residentPlayerRow<T extends Record<string, any> | null | undefined>(row: T): T {
  ensureResidentWorldLoaded();
  if (!row) return row;
  const id = idOf((row as any).id);
  const cached = id ? world.players.get(id) : null;
  const live = id ? liveMoves.get(id) : null;
  const base = cached || row;
  if (!live) return { ...(row as any), ...clone(base) } as T;
  return {
    ...(row as any),
    ...clone(base),
    x: live.x,
    z: live.z,
    energy: live.energy ?? (base as any).energy,
    energyAt: live.energyAt ?? (base as any).energyAt,
    lastSeen: Math.max(num((base as any).lastSeen, 0), live.updatedAt),
    updatedAt: Math.max(num((base as any).updatedAt, 0), live.updatedAt),
    moveSeq: live.lastSeq,
  } as T;
}

export function residentPlayerRows<T extends Record<string, any>>(rows?: T[]): T[] {
  ensureResidentWorldLoaded();
  const source = [...world.players.values()] as T[];
  return source.map((row) => residentPlayerRow(row) as T);
}

export function commitResidentMovement(rowLike: Record<string, any>, next: { x: number; z: number; energy?: number; energyAt?: number; seq?: number; at?: number }) {
  ensureResidentWorldLoaded();
  const id = idOf(rowLike?.id);
  if (!id) return null;
  const cached = world.players.get(id) || clone(rowLike || {});
  const prev = liveMoves.get(id);
  const at = num(next.at, now());
  const state: ResidentMoveState = {
    id,
    x: int(next.x, int(prev?.x ?? cached.x, 0)),
    z: int(next.z, int(prev?.z ?? cached.z, 0)),
    energy: next.energy === undefined ? (prev?.energy ?? (Number.isFinite(Number(cached.energy)) ? Number(cached.energy) : undefined)) : Math.max(0, Number(next.energy || 0)),
    energyAt: next.energyAt === undefined ? (prev?.energyAt ?? (Number.isFinite(Number(cached.energyAt)) ? Number(cached.energyAt) : undefined)) : num(next.energyAt, at),
    lastSeq: Math.max(int(prev?.lastSeq || 0), int(next.seq || 0)),
    updatedAt: at,
    dirty: true,
  };
  liveMoves.set(id, state);
  cached.x = state.x; cached.z = state.z; cached.lastSeen = Math.max(num(cached.lastSeen, 0), at); cached.updatedAt = Math.max(num(cached.updatedAt, 0), at);
  if (state.energy !== undefined) cached.energy = state.energy;
  if (state.energyAt !== undefined) cached.energyAt = state.energyAt;
  cached.moveSeq = state.lastSeq;
  world.players.set(id, cleanPlayerRow(cached));
  setPlayerDirty("movement");
  return state;
}

export function checkpointResidentWorld(reason = "manual") {
  ensureResidentWorldLoaded();
  const snapshot: ResidentWorldSnapshot = {
    schemaVersion: 1,
    savedAt: now(),
    rev: world.rev,
    playerRev: world.playerRev,
    chunkSize: world.chunkSize,
    reason,
    chunkRevs: Object.fromEntries(world.chunkRevs.entries()),
    players: [...world.players.values()].map((p) => cleanPlayerRow(clone(p))),
    tiles: [...world.tiles.values()].map(clone),
    buildings: [...world.buildings.values()].map((b) => denormalizeBuildingKind(clone(b))),
    doodads: [...world.doodads.values()].map(clone),
    loot: [...world.loot.values()].map(clone),
  };
  const result = saveResidentWorldSnapshot(snapshot);
  if (result.ok) { world.lastSaveAt = snapshot.savedAt; world.dirty = false; world.playerDirty = false; for (const m of liveMoves.values()) m.dirty = false; }
  return { ...result, status: residentWorldStatus() };
}



export function residentTileAt(x: any, z: any) { ensureResidentWorldLoaded(); return world.tiles.get(key(x, z)) || null; }
export function upsertResidentTile(rowLike: any, reason = "tile") {
  ensureResidentWorldLoaded();
  const row = clone(rowLike || {});
  row.x = int(row.x); row.z = int(row.z); row.owner = int(row.owner);
  world.tiles.set(key(row.x, row.z), row);
  return setStructuralDirty(reason, row.x, row.z);
}
export function residentOwnedTileCount(ownerLike: any) {
  ensureResidentWorldLoaded();
  const owner = int(ownerLike);
  let n = 0;
  for (const t of world.tiles.values()) if (int(t.owner) === owner) n++;
  return n;
}

export function residentBuildingAt(x: any, z: any) {
  ensureResidentWorldLoaded();
  for (const b of world.buildings.values()) if (int(b.x) === int(x) && int(b.z) === int(z)) return b;
  return null;
}
export function residentBuildingById(idLike: any) { ensureResidentWorldLoaded(); return world.buildings.get(int(idLike)) || null; }
export function residentBuildings(kind?: string) {
  ensureResidentWorldLoaded();
  const k = String(kind || "");
  return [...world.buildings.values()].filter((b) => !k || String(b.kind || "") === k || (k === "worldwonder" && String(b.kind || "") === "landmark"));
}
export function upsertResidentBuilding(rowLike: any, reason = "building") {
  ensureResidentWorldLoaded();
  const row = normalizeBuildingKind(clone(rowLike || {}));
  row.id = int(row.id || row.uid || 0) || nextEntityId(world.buildings);
  row.x = int(row.x); row.z = int(row.z); row.owner = int(row.owner);
  world.buildings.set(Number(row.id), row);
  return setStructuralDirty(reason, row.x, row.z);
}
export function removeResidentBuilding(idLike: any, reason = "building-remove") {
  ensureResidentWorldLoaded();
  const id = int(idLike);
  const row = world.buildings.get(id);
  if (!row) return false;
  world.buildings.delete(id);
  setStructuralDirty(reason, row.x, row.z);
  return true;
}

export function residentDoodadAt(x: any, z: any) { ensureResidentWorldLoaded(); return world.doodads.get(key(x, z)) || null; }
export function upsertResidentDoodad(rowLike: any, reason = "doodad") {
  ensureResidentWorldLoaded();
  const row = clone(rowLike || {});
  row.x = int(row.x); row.z = int(row.z); row.state = String(row.state || "gone");
  world.doodads.set(key(row.x, row.z), row);
  return setStructuralDirty(reason, row.x, row.z);
}

export function residentLootAt(x: any, z: any) {
  ensureResidentWorldLoaded();
  for (const l of world.loot.values()) if (int(l.x) === int(x) && int(l.z) === int(z)) return l;
  return null;
}
export function residentLootById(idLike: any) { ensureResidentWorldLoaded(); return world.loot.get(int(idLike)) || null; }
export function upsertResidentLoot(rowLike: any, reason = "loot") {
  ensureResidentWorldLoaded();
  const row = clone(rowLike || {});
  row.id = int(row.id || row.uid || 0) || nextEntityId(world.loot);
  row.x = int(row.x); row.z = int(row.z);
  world.loot.set(Number(row.id), row);
  return setStructuralDirty(reason, row.x, row.z);
}
export function removeResidentLoot(idLike: any, reason = "loot-remove") {
  ensureResidentWorldLoaded();
  const id = int(idLike);
  const row = world.loot.get(id);
  if (!row) return false;
  world.loot.delete(id);
  setStructuralDirty(reason, row.x, row.z);
  return true;
}

export function residentLandmarkBonusPct() {
  ensureResidentWorldLoaded();
  const pctEach = Number(metaGet("solcraft:landmarks:bonusPctEach:v1", "3")) || 3;
  const max = Number(metaGet("solcraft:landmarks:maxBonusPct:v1", "30")) || 30;
  const count = residentBuildings("worldwonder").length;
  return Math.max(0, Math.min(max, count * pctEach));
}

export function residentWorldRows(p: any, q: any, helpers: { pinfo: (id: number) => any; readLandmarkRecipe?: (uid: number) => any; activeMapPlayers?: () => any[] }) {
  ensureResidentWorldLoaded();
  const px = int(p?.x), pz = int(p?.z);
  const ax = Math.floor(px / 6) * 6;
  const az = Math.floor(pz / 6) * 6;
  const R = 34;
  const near = (r: any) => Math.max(Math.abs(int(r.x) - ax), Math.abs(int(r.z) - az)) <= R;
  const pinfo = helpers.pinfo;
  const tiles = [...world.tiles.values()].filter(near);
  const buildings = [...world.buildings.values()].filter(near);
  const doodads = [...world.doodads.values()].filter(near);
  const loot = [...world.loot.values()].filter(near);
  const rev = residentWorldRev();
  return {
    rev,
    ax,
    az,
    chunkSize: world.chunkSize,
    chunkRevs: Object.fromEntries([...world.chunkRevs.entries()].slice(-500)),
    tiles: tiles.map((r) => ({ x: r.x, z: r.z, owner: r.owner, ownerBody: pinfo(r.owner).body, ownerName: pinfo(r.owner).name })),
    buildings: buildings.map((b) => ({ uid: b.id, owner: b.owner, ownerName: pinfo(b.owner).name, ownerBody: pinfo(b.owner).body, ownerFace: null, kind: b.kind === "landmark" ? "worldwonder" : b.kind, x: b.x, z: b.z, nm: b.nm, cl: b.cl, acc: b.acc, accAt: b.accAt, cdUntil: b.cdUntil, constructAt: b.accAt, constructUntil: b.cdUntil, usedAt: b.usedAt || 0, level: b.level || 1, hp: b.hp, maxHp: b.maxHp, stored: b.stored || 0, wonder: b.kind === "landmark" || b.kind === "worldwonder" ? helpers.readLandmarkRecipe?.(Number(b.id)) || {} : null })),
    doodads: doodads.map((d) => ({ x: d.x, z: d.z, type: d.state === "gone" ? "gone" : d.state === "rock" ? "rock" : d.state === "food" ? "food" : "tree" })),
    loot: loot.map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, gid: l.gid })),
    offers: [],
    coinNodes: [],
    map: {
      rev,
      frontierRadius: Number(metaGet("solcraft:frontier:radius:v1", "96")) || 96,
      tiles: [...world.tiles.values()].map((r) => ({ x: r.x, z: r.z, owner: r.owner, ownerBody: pinfo(r.owner).body, ownerName: pinfo(r.owner).name })),
      buildings: [...world.buildings.values()].map((b) => ({ uid: b.id, owner: b.owner, ownerBody: pinfo(b.owner).body, kind: b.kind === "landmark" ? "worldwonder" : b.kind, x: b.x, z: b.z })),
      loot: [...world.loot.values()].filter((l) => String(l.kind || "") === "gold").map((l) => ({ id: l.id, x: l.x, z: l.z, kind: l.kind, gid: l.gid })),
      players: helpers.activeMapPlayers?.() || [],
    },
  };
}
