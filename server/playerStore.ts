import { db } from "./db";

export type PlayerRow = Record<string, any>;

const playerByIdCache = new Map<number, PlayerRow>();
const playerIdByWallet = new Map<string, number>();
let hydrated = false;
let hydratedAt = 0;

function cleanId(value: any) {
  const id = Math.trunc(Number(value || 0));
  return id > 0 ? id : 0;
}

function cleanWallet(value: any) {
  return String(value || "").trim();
}

function rowId(row: any) {
  return cleanId(row?.id);
}

function uncachePlayer(id: number, row?: PlayerRow | null) {
  if (!id) return;
  const cached = row || playerByIdCache.get(id);
  const wallet = cleanWallet(cached?.wallet || "");
  if (wallet) playerIdByWallet.delete(wallet);
  playerByIdCache.delete(id);
}

function cachePlayer(row: PlayerRow | null | undefined) {
  if (!row) return null;
  const id = rowId(row);
  if (!id) return row;
  const old = playerByIdCache.get(id);
  if (old) {
    const oldWallet = cleanWallet(old.wallet || "");
    if (oldWallet) playerIdByWallet.delete(oldWallet);
  }
  playerByIdCache.set(id, row);
  const wallet = cleanWallet(row.wallet || "");
  if (wallet) playerIdByWallet.set(wallet, id);
  return row;
}

export function hydratePlayerStore(force = false) {
  if (hydrated && !force) return playerCacheStats(false);
  playerByIdCache.clear();
  playerIdByWallet.clear();
  for (const row of db.players.select().all() as PlayerRow[]) cachePlayer(row);
  hydrated = true;
  hydratedAt = Date.now();
  return playerCacheStats(false);
}

export function invalidatePlayerStore() {
  hydrated = false;
  playerByIdCache.clear();
  playerIdByWallet.clear();
}

function ensureHydrated() {
  if (!hydrated) hydratePlayerStore();
}

export function getPlayer(idLike: any): PlayerRow | null {
  ensureHydrated();
  const id = cleanId(idLike);
  if (!id) return null;
  // Refresh from SQLite before returning. Like the building/tile/loot stores,
  // this cache owns identity indexes; mutable row contents remain DB-backed.
  const row = db.players.get(id) as PlayerRow | null;
  if (!row) { uncachePlayer(id); return null; }
  return cachePlayer(row) || null;
}

export function playerByWallet(walletLike: any): PlayerRow | null {
  ensureHydrated();
  const wallet = cleanWallet(walletLike);
  if (!wallet) return null;
  const cachedId = playerIdByWallet.get(wallet);
  if (cachedId) {
    const row = getPlayer(cachedId);
    if (row && cleanWallet(row.wallet || "") === wallet) return row;
    playerIdByWallet.delete(wallet);
  }
  const row = db.players.select().where({ wallet }).first() as PlayerRow | null;
  return cachePlayer(row) || null;
}

export function allPlayers(): PlayerRow[] {
  ensureHydrated();
  const rows = db.players.select().all() as PlayerRow[];
  for (const row of rows) cachePlayer(row);
  return rows;
}

export function insertPlayer(row: PlayerRow): PlayerRow {
  ensureHydrated();
  const inserted = db.players.insert(row as any) as PlayerRow;
  cachePlayer(inserted);
  return inserted;
}

export function refreshPlayer(rowOrId: number | PlayerRow | null | undefined): PlayerRow | null {
  ensureHydrated();
  const row = typeof rowOrId === "number" ? db.players.get(rowOrId) as PlayerRow | null : rowOrId || null;
  return cachePlayer(row) || null;
}

export function touchPlayerSeen(rowOrId: number | PlayerRow | null | undefined, at = Date.now(), minIntervalMs = 15000): PlayerRow | null {
  const p = typeof rowOrId === "number" ? getPlayer(rowOrId) : refreshPlayer(rowOrId);
  if (!p) return null;
  if (at - Number(p.lastSeen || 0) > Math.max(0, minIntervalMs)) p.lastSeen = at;
  return refreshPlayer(p);
}

export function playerCacheStats(ensure = true) {
  if (ensure) ensureHydrated();
  return {
    hydrated,
    hydratedAt,
    ids: playerByIdCache.size,
    wallets: playerIdByWallet.size,
  };
}
