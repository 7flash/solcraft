import { db } from "./db";

export type LootRow = Record<string, any>;

const lootById = new Map<number, LootRow>();
const lootIdByCell = new Map<string, number>();
let hydrated = false;
let hydratedAt = 0;

function cellKey(x: number, z: number) {
  return `${Math.trunc(Number(x || 0))},${Math.trunc(Number(z || 0))}`;
}

function rowId(row: any) {
  const id = Math.trunc(Number(row?.id || 0));
  return id > 0 ? id : 0;
}

function uncacheLoot(id: number, row?: LootRow | null) {
  if (!id) return;
  const cached = row || lootById.get(id);
  if (cached) lootIdByCell.delete(cellKey(cached.x, cached.z));
  lootById.delete(id);
}

function cacheLoot(row: LootRow | null | undefined) {
  if (!row) return null;
  const id = rowId(row);
  if (!id) return row;
  const old = lootById.get(id);
  if (old) lootIdByCell.delete(cellKey(old.x, old.z));
  lootById.set(id, row);
  lootIdByCell.set(cellKey(row.x, row.z), id);
  return row;
}

export function hydrateLootStore(force = false) {
  if (hydrated && !force) return lootCacheStats(false);
  lootById.clear();
  lootIdByCell.clear();
  for (const row of db.loot.select().all() as LootRow[]) cacheLoot(row);
  hydrated = true;
  hydratedAt = Date.now();
  return lootCacheStats(false);
}

export function invalidateLootStore() {
  hydrated = false;
  lootById.clear();
  lootIdByCell.clear();
}

function ensureHydrated() {
  if (!hydrated) hydrateLootStore();
}

export function getLoot(uid: number): LootRow | null {
  ensureHydrated();
  const id = Math.trunc(Number(uid || 0));
  if (!id) return null;
  const row = db.loot.get(id) as LootRow | null;
  if (!row) { uncacheLoot(id); return null; }
  return cacheLoot(row) || null;
}

export function lootAt(x: number, z: number): LootRow | null {
  ensureHydrated();
  const k = cellKey(x, z);
  const id = lootIdByCell.get(k);
  if (id) {
    const row = db.loot.get(id) as LootRow | null;
    if (row) return cacheLoot(row) || null;
    lootIdByCell.delete(k);
    lootById.delete(id);
  }
  const row = db.loot.select().where({ x: Math.trunc(Number(x || 0)), z: Math.trunc(Number(z || 0)) }).first() as LootRow | null;
  return cacheLoot(row) || null;
}

export function hasLootAt(x: number, z: number): boolean {
  return !!lootAt(x, z);
}

export function insertLoot(row: LootRow): LootRow {
  ensureHydrated();
  const inserted = db.loot.insert(row as any) as LootRow;
  cacheLoot(inserted);
  return inserted;
}

export function deleteLoot(target: number | LootRow | null | undefined): boolean {
  ensureHydrated();
  const id = typeof target === "number" ? Math.trunc(Number(target || 0)) : rowId(target);
  if (!id) return false;
  const row = typeof target === "object" && target ? target : lootById.get(id) || null;
  db.loot.delete(id);
  uncacheLoot(id, row);
  return true;
}

export function refreshLoot(rowOrId: number | LootRow | null | undefined): LootRow | null {
  ensureHydrated();
  const row = typeof rowOrId === "number" ? db.loot.get(rowOrId) as LootRow | null : rowOrId || null;
  return cacheLoot(row) || null;
}

export function lootCacheStats(ensure = true) {
  if (ensure) ensureHydrated();
  return { hydrated, hydratedAt, ids: lootById.size, cells: lootIdByCell.size };
}
