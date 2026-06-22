import { db } from './db';

export type BuildingRow = Record<string, any>;

// `var` + lazy map access avoids TDZ crashes when diagnostics import this module
// through a cycle during db boot/tests.
var buildingById: Map<number, BuildingRow> | undefined;
var buildingIdByCell: Map<string, number> | undefined;
var hydrated = false;
var hydratedAt = 0;

function idMap() { return buildingById || (buildingById = new Map<number, BuildingRow>()); }
function cellMap() { return buildingIdByCell || (buildingIdByCell = new Map<string, number>()); }

function cellKey(x: number, z: number) {
  return `${Math.trunc(Number(x || 0))},${Math.trunc(Number(z || 0))}`;
}

function rowId(row: any) {
  const id = Math.trunc(Number(row?.id || 0));
  return id > 0 ? id : 0;
}

function uncacheBuilding(id: number, row?: BuildingRow | null) {
  if (!id) return;
  const byId = idMap();
  const byCell = cellMap();
  const cached = row || byId.get(id);
  if (cached) byCell.delete(cellKey(cached.x, cached.z));
  byId.delete(id);
}

function cacheBuilding(row: BuildingRow | null | undefined) {
  if (!row) return null;
  const id = rowId(row);
  if (!id) return row;
  const byId = idMap();
  const byCell = cellMap();
  const old = byId.get(id);
  if (old) byCell.delete(cellKey(old.x, old.z));
  byId.set(id, row);
  byCell.set(cellKey(row.x, row.z), id);
  return row;
}

export function hydrateBuildingStore(force = false) {
  if (hydrated && !force) return buildingCacheStats(false);
  idMap().clear();
  cellMap().clear();
  for (const row of db.buildings.select().all() as BuildingRow[]) cacheBuilding(row);
  hydrated = true;
  hydratedAt = Date.now();
  return buildingCacheStats(false);
}

export function invalidateBuildingStore() {
  hydrated = false;
  idMap().clear();
  cellMap().clear();
}

function ensureHydrated() {
  if (!hydrated) hydrateBuildingStore();
}

export function getBuilding(uid: number): BuildingRow | null {
  ensureHydrated();
  const id = Math.trunc(Number(uid || 0));
  if (!id) return null;
  const row = db.buildings.get(id) as BuildingRow | null;
  if (!row) { uncacheBuilding(id); return null; }
  return cacheBuilding(row) || null;
}

export function buildingAt(x: number, z: number): BuildingRow | null {
  ensureHydrated();
  const k = cellKey(x, z);
  const id = cellMap().get(k);
  if (id) {
    const row = db.buildings.get(id) as BuildingRow | null;
    if (row) return cacheBuilding(row) || null;
    cellMap().delete(k);
    idMap().delete(id);
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
  const id = typeof target === 'number' ? Math.trunc(Number(target || 0)) : rowId(target);
  if (!id) return false;
  const row = typeof target === 'object' && target ? target : idMap().get(id) || null;
  db.buildings.delete(id);
  uncacheBuilding(id, row);
  return true;
}

export function refreshBuilding(rowOrId: number | BuildingRow | null | undefined): BuildingRow | null {
  ensureHydrated();
  const row = typeof rowOrId === 'number' ? db.buildings.get(rowOrId) as BuildingRow | null : rowOrId || null;
  return cacheBuilding(row) || null;
}

export function buildingCacheStats(ensure = true) {
  try { if (ensure) ensureHydrated(); } catch (e: any) {
    return { hydrated: false, hydratedAt: 0, ids: 0, cells: 0, error: String(e?.message || e) };
  }
  return { hydrated: !!hydrated, hydratedAt, ids: idMap().size, cells: cellMap().size };
}
