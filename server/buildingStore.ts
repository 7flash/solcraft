import { db } from "./db";

export type BuildingRow = Record<string, any>;

const buildingById = new Map<number, BuildingRow>();
const buildingIdByCell = new Map<string, number>();
let hydrated = false;
let hydratedAt = 0;

function cellKey(x: number, z: number) {
  return `${Math.trunc(Number(x || 0))},${Math.trunc(Number(z || 0))}`;
}

function rowId(row: any) {
  const id = Math.trunc(Number(row?.id || 0));
  return id > 0 ? id : 0;
}

function uncacheBuilding(id: number, row?: BuildingRow | null) {
  if (!id) return;
  const cached = row || buildingById.get(id);
  if (cached) buildingIdByCell.delete(cellKey(cached.x, cached.z));
  buildingById.delete(id);
}

function cacheBuilding(row: BuildingRow | null | undefined) {
  if (!row) return null;
  const id = rowId(row);
  if (!id) return row;
  const old = buildingById.get(id);
  if (old) buildingIdByCell.delete(cellKey(old.x, old.z));
  buildingById.set(id, row);
  buildingIdByCell.set(cellKey(row.x, row.z), id);
  return row;
}

export function hydrateBuildingStore(force = false) {
  if (hydrated && !force) return buildingCacheStats(false);
  buildingById.clear();
  buildingIdByCell.clear();
  for (const row of db.buildings.select().all() as BuildingRow[]) cacheBuilding(row);
  hydrated = true;
  hydratedAt = Date.now();
  return buildingCacheStats(false);
}

export function invalidateBuildingStore() {
  hydrated = false;
  buildingById.clear();
  buildingIdByCell.clear();
}

function ensureHydrated() {
  if (!hydrated) hydrateBuildingStore();
}

export function getBuilding(uid: number): BuildingRow | null {
  ensureHydrated();
  const id = Math.trunc(Number(uid || 0));
  if (!id) return null;
  // Always refresh the row from SQLite. The exact-cell cache owns identity and
  // coordinates only; range queries may mutate row objects that are different
  // JS instances, so returning a stale cached row would be a correctness bug.
  const row = db.buildings.get(id) as BuildingRow | null;
  if (!row) { uncacheBuilding(id); return null; }
  return cacheBuilding(row) || null;
}

export function buildingAt(x: number, z: number): BuildingRow | null {
  ensureHydrated();
  const k = cellKey(x, z);
  const id = buildingIdByCell.get(k);
  if (id) {
    const row = db.buildings.get(id) as BuildingRow | null;
    if (row) return cacheBuilding(row) || null;
    buildingIdByCell.delete(k);
    buildingById.delete(id);
  }
  const row = db.buildings.select().where({ x: Math.trunc(Number(x || 0)), z: Math.trunc(Number(z || 0)) }).first() as BuildingRow | null;
  return cacheBuilding(row) || null;
}

export function hasBuildingAt(x: number, z: number): boolean {
  return !!buildingAt(x, z);
}

export function insertBuilding(row: BuildingRow): BuildingRow {
  ensureHydrated();
  const inserted = db.buildings.insert(row as any) as BuildingRow;
  cacheBuilding(inserted);
  return inserted;
}

export function deleteBuilding(target: number | BuildingRow | null | undefined): boolean {
  ensureHydrated();
  const id = typeof target === "number" ? Math.trunc(Number(target || 0)) : rowId(target);
  if (!id) return false;
  const row = typeof target === "object" && target ? target : buildingById.get(id) || null;
  db.buildings.delete(id);
  uncacheBuilding(id, row);
  return true;
}

export function refreshBuilding(rowOrId: number | BuildingRow | null | undefined): BuildingRow | null {
  ensureHydrated();
  const row = typeof rowOrId === "number" ? db.buildings.get(rowOrId) as BuildingRow | null : rowOrId || null;
  return cacheBuilding(row) || null;
}

export function buildingCacheStats(ensure = true) {
  if (ensure) ensureHydrated();
  return {
    hydrated,
    hydratedAt,
    ids: buildingById.size,
    cells: buildingIdByCell.size,
  };
}
