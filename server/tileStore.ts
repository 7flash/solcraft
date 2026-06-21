import { db } from "./db";

export type TileRow = Record<string, any>;

const tileById = new Map<number, TileRow>();
const tileIdByCell = new Map<string, number>();
let hydrated = false;
let hydratedAt = 0;

function cellKey(x: number, z: number) {
  return `${Math.trunc(Number(x || 0))},${Math.trunc(Number(z || 0))}`;
}

function rowId(row: any) {
  const id = Math.trunc(Number(row?.id || 0));
  return id > 0 ? id : 0;
}

function uncacheTile(id: number, row?: TileRow | null) {
  if (!id) return;
  const cached = row || tileById.get(id);
  if (cached) tileIdByCell.delete(cellKey(cached.x, cached.z));
  tileById.delete(id);
}

function cacheTile(row: TileRow | null | undefined) {
  if (!row) return null;
  const id = rowId(row);
  if (!id) return row;
  const old = tileById.get(id);
  if (old) tileIdByCell.delete(cellKey(old.x, old.z));
  tileById.set(id, row);
  tileIdByCell.set(cellKey(row.x, row.z), id);
  return row;
}

export function hydrateTileStore(force = false) {
  if (hydrated && !force) return tileCacheStats(false);
  tileById.clear();
  tileIdByCell.clear();
  for (const row of db.tiles.select().all() as TileRow[]) cacheTile(row);
  hydrated = true;
  hydratedAt = Date.now();
  return tileCacheStats(false);
}

export function invalidateTileStore() {
  hydrated = false;
  tileById.clear();
  tileIdByCell.clear();
}

function ensureHydrated() {
  if (!hydrated) hydrateTileStore();
}

export function getTile(uid: number): TileRow | null {
  ensureHydrated();
  const id = Math.trunc(Number(uid || 0));
  if (!id) return null;
  const row = db.tiles.get(id) as TileRow | null;
  if (!row) { uncacheTile(id); return null; }
  return cacheTile(row) || null;
}

export function tileAt(x: number, z: number): TileRow | null {
  ensureHydrated();
  const k = cellKey(x, z);
  const id = tileIdByCell.get(k);
  if (id) {
    const row = db.tiles.get(id) as TileRow | null;
    if (row) return cacheTile(row) || null;
    tileIdByCell.delete(k);
    tileById.delete(id);
  }
  const row = db.tiles.select().where({ x: Math.trunc(Number(x || 0)), z: Math.trunc(Number(z || 0)) }).first() as TileRow | null;
  return cacheTile(row) || null;
}

export function hasTileAt(x: number, z: number): boolean {
  return !!tileAt(x, z);
}

export function insertTile(row: TileRow): TileRow {
  ensureHydrated();
  const inserted = db.tiles.insert(row as any) as TileRow;
  cacheTile(inserted);
  return inserted;
}

export function insertTiles(rows: TileRow[]): TileRow[] {
  ensureHydrated();
  const clean = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!clean.length) return [];
  const inserted: TileRow[] = [];
  // Keep the cache invariant simple while the engine is still being extracted:
  // every caller-visible insert goes through the same single-row cache path.
  for (const row of clean) inserted.push(insertTile(row));
  return inserted;
}

export function deleteTile(target: number | TileRow | null | undefined): boolean {
  ensureHydrated();
  const id = typeof target === "number" ? Math.trunc(Number(target || 0)) : rowId(target);
  if (!id) return false;
  const row = typeof target === "object" && target ? target : tileById.get(id) || null;
  db.tiles.delete(id);
  uncacheTile(id, row);
  return true;
}

export function refreshTile(rowOrId: number | TileRow | null | undefined): TileRow | null {
  ensureHydrated();
  const row = typeof rowOrId === "number" ? db.tiles.get(rowOrId) as TileRow | null : rowOrId || null;
  return cacheTile(row) || null;
}

export function claimTileAt(x: number, z: number, owner: number): TileRow {
  const existing = tileAt(x, z);
  if (existing) {
    existing.owner = Math.trunc(Number(owner || 0));
    return cacheTile(existing) || existing;
  }
  return insertTile({ x, z, owner: Math.trunc(Number(owner || 0)) });
}

export function tileCacheStats(ensure = true) {
  if (ensure) ensureHydrated();
  return { hydrated, hydratedAt, ids: tileById.size, cells: tileIdByCell.size };
}
