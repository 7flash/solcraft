// @ts-nocheck
import { db, metaGet, metaSet } from "./db";

const META_LEDGER = "solcraft:craftsLedger:fallback:v1";

function now() { return Date.now(); }
function safeJson(raw: string, fallback: any) { try { return JSON.parse(raw || "") ?? fallback; } catch { return fallback; } }
function q(sql: string) { try { return (db as any).query?.(sql); } catch { return null; } }
function cleanKey(v: any) { return String(v || "").trim().slice(0, 160); }
function cleanReason(v: any) { return String(v || "adjust").replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 64) || "adjust"; }
function asRaw(v: any): bigint { try { return BigInt(String(v || "0")); } catch { return 0n; } }

export function ensureCraftsLedgerSchema() {
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_crafts_ledger_player_created ON crafts_ledger(player, createdAt)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_crafts_ledger_wallet_created ON crafts_ledger(wallet, createdAt)");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uniq_crafts_ledger_player_idem ON crafts_ledger(player, idempotencyKey) WHERE idempotencyKey IS NOT NULL AND idempotencyKey != ''");
  } catch {}
}

export function craftsLedgerBalanceRaw(player: number): bigint {
  ensureCraftsLedgerSchema();
  const pid = Math.max(0, Math.floor(Number(player || 0)));
  try {
    const row = q("SELECT amountRaw FROM crafts_ledger WHERE player = ?")?.all?.(pid) || [];
    if (Array.isArray(row)) return row.reduce((sum: bigint, r: any) => sum + asRaw(r.amountRaw), 0n);
  } catch {}
  const rows = safeJson(metaGet(META_LEDGER, "[]"), []);
  return rows.filter((r: any) => Number(r.player) === pid).reduce((sum: bigint, r: any) => sum + asRaw(r.amountRaw), 0n);
}

export function findCraftsLedgerByIdempotency(player: number, idempotencyKey: string) {
  ensureCraftsLedgerSchema();
  const pid = Math.max(0, Math.floor(Number(player || 0)));
  const key = cleanKey(idempotencyKey);
  if (!key) return null;
  try {
    const row = q("SELECT * FROM crafts_ledger WHERE player = ? AND idempotencyKey = ? LIMIT 1")?.get?.(pid, key) || null;
    if (row) return row;
  } catch {}
  const rows = safeJson(metaGet(META_LEDGER, "[]"), []);
  return rows.find((r: any) => Number(r.player) === pid && String(r.idempotencyKey || "") === key) || null;
}

export function appendCraftsLedger(entry: any) {
  ensureCraftsLedgerSchema();
  const player = Math.max(0, Math.floor(Number(entry?.player || entry?.playerId || 0)));
  const idempotencyKey = cleanKey(entry?.idempotencyKey);
  if (idempotencyKey) {
    const existing = findCraftsLedgerByIdempotency(player, idempotencyKey);
    if (existing) return existing;
  }
  const amountRaw = asRaw(entry?.amountRaw ?? entry?.deltaRaw ?? "0");
  if (amountRaw === 0n) return null;
  const balanceRawAfter = craftsLedgerBalanceRaw(player) + amountRaw;
  if (balanceRawAfter < 0n) {
    const e: any = new Error("Insufficient deposited $CRAFTS balance.");
    e.reasonCode = "CRAFTS_LEDGER_LOW";
    throw e;
  }
  const row = {
    player,
    wallet: cleanKey(entry?.wallet),
    token: cleanKey(entry?.token || "$CRAFTS"),
    amountRaw: amountRaw.toString(),
    balanceRawAfter: balanceRawAfter.toString(),
    direction: amountRaw > 0n ? "credit" : "debit",
    reason: cleanReason(entry?.reason),
    refType: cleanKey(entry?.refType) || null,
    refId: cleanKey(entry?.refId) || null,
    idempotencyKey: idempotencyKey || null,
    metaJson: JSON.stringify(entry?.meta || {}),
    createdAt: now(),
  };
  try {
    q("INSERT INTO crafts_ledger (player, wallet, token, amountRaw, balanceRawAfter, direction, reason, refType, refId, idempotencyKey, metaJson, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")?.run?.(row.player, row.wallet, row.token, row.amountRaw, row.balanceRawAfter, row.direction, row.reason, row.refType, row.refId, row.idempotencyKey, row.metaJson, row.createdAt);
    return row;
  } catch (e: any) {
    if (/constraint|unique/i.test(String(e?.message || e)) && idempotencyKey) return findCraftsLedgerByIdempotency(player, idempotencyKey);
  }
  const rows = safeJson(metaGet(META_LEDGER, "[]"), []);
  rows.push(row);
  metaSet(META_LEDGER, JSON.stringify(rows.slice(-10000)));
  return row;
}

export function hardCurrencyBalanceRaw(player: number, _currency?: string): bigint {
  return craftsLedgerBalanceRaw(player);
}

export function appendHardCurrencyLedger(entry: any) {
  return appendCraftsLedger({
    player: entry?.player ?? entry?.playerId,
    wallet: entry?.wallet,
    token: entry?.currency || entry?.token || "$CRAFTS",
    amountRaw: entry?.deltaRaw ?? entry?.amountRaw,
    reason: entry?.reason,
    refType: entry?.refType,
    refId: entry?.refId,
    idempotencyKey: entry?.idempotencyKey,
    meta: entry?.meta,
  });
}
