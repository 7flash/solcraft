// @ts-nocheck
import { db, metaGet, metaSet } from "./db";

const META_LEDGER = "solcraft:coinLedger:fallback:v1";

function now() { return Date.now(); }
function safeJson(raw: string, fallback: any) { try { return JSON.parse(raw || "") ?? fallback; } catch { return fallback; } }
function q(sql: string) { try { return (db as any).query?.(sql); } catch { return null; } }

export function ensureCoinLedgerSchema() {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS coin_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player INTEGER NOT NULL DEFAULT 0,
      delta INTEGER NOT NULL DEFAULT 0,
      balanceAfter INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT 'adjust',
      refType TEXT,
      refId TEXT,
      idempotencyKey TEXT,
      metaJson TEXT,
      createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS idx_coin_ledger_player_created ON coin_ledger(player, createdAt)");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uniq_coin_ledger_player_idem ON coin_ledger(player, idempotencyKey) WHERE idempotencyKey IS NOT NULL AND idempotencyKey != ''");
  } catch {}
}

export function coinLedgerBalance(player: number) {
  ensureCoinLedgerSchema();
  const pid = Math.max(0, Math.floor(Number(player || 0)));
  try {
    const row = q("SELECT COALESCE(SUM(delta),0) AS bal FROM coin_ledger WHERE player = ?")?.get?.(pid) || q("SELECT COALESCE(SUM(delta),0) AS bal FROM coin_ledger WHERE player = ?")?.first?.(pid);
    if (row && row.bal != null) return Math.max(0, Math.floor(Number(row.bal || 0)));
  } catch {}
  const rows = safeJson(metaGet(META_LEDGER, "[]"), []);
  return Math.max(0, rows.filter((r: any) => Number(r.player) === pid).reduce((sum: number, r: any) => sum + Math.floor(Number(r.delta || 0)), 0));
}

export function findCoinLedgerByIdempotency(player: number, idempotencyKey: string) {
  ensureCoinLedgerSchema();
  const pid = Math.max(0, Math.floor(Number(player || 0)));
  const key = String(idempotencyKey || "").trim();
  if (!key) return null;
  try {
    const row = q("SELECT * FROM coin_ledger WHERE player = ? AND idempotencyKey = ? LIMIT 1")?.get?.(pid, key) || null;
    if (row) return row;
  } catch {}
  const rows = safeJson(metaGet(META_LEDGER, "[]"), []);
  return rows.find((r: any) => Number(r.player) === pid && String(r.idempotencyKey || "") === key) || null;
}

export function appendCoinLedger(entry: any) {
  ensureCoinLedgerSchema();
  const player = Math.max(0, Math.floor(Number(entry?.player || entry?.playerId || 0)));
  const delta = Math.floor(Number(entry?.delta || 0));
  const idempotencyKey = String(entry?.idempotencyKey || "").trim().slice(0, 120);
  if (idempotencyKey) {
    const existing = findCoinLedgerByIdempotency(player, idempotencyKey);
    if (existing) return existing;
  }
  const balanceAfter = Math.max(0, coinLedgerBalance(player) + delta);
  const row = {
    player,
    delta,
    balanceAfter,
    reason: String(entry?.reason || "adjust").slice(0, 64),
    refType: String(entry?.refType || "").slice(0, 48) || null,
    refId: String(entry?.refId || "").slice(0, 160) || null,
    idempotencyKey: idempotencyKey || null,
    metaJson: JSON.stringify(entry?.meta || {}),
    createdAt: now(),
  };
  try {
    q("INSERT INTO coin_ledger (player, delta, balanceAfter, reason, refType, refId, idempotencyKey, metaJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")?.run?.(row.player, row.delta, row.balanceAfter, row.reason, row.refType, row.refId, row.idempotencyKey, row.metaJson, row.createdAt);
    return row;
  } catch {}
  const rows = safeJson(metaGet(META_LEDGER, "[]"), []);
  rows.push(row);
  metaSet(META_LEDGER, JSON.stringify(rows.slice(-5000)));
  return row;
}
