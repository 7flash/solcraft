// @ts-nocheck
import { createHash } from "crypto";
import { db, metaGet, metaSet } from "./db";

const META = "solcraft:actionIdempotency:fallback:v1";
function now() { return Date.now(); }
function safeJson(raw: string, fallback: any) { try { return JSON.parse(raw || "") ?? fallback; } catch { return fallback; } }
function q(sql: string) { try { return (db as any).query?.(sql); } catch { return null; } }
function key(v: any) { return String(v || "").trim().slice(0, 160); }

export function requestHash(payload: any) {
  return createHash("sha256").update(JSON.stringify(payload || {})).digest("hex");
}

export function ensureActionIdempotencySchema() {
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uniq_action_idempotency_player_action_key ON action_idempotency(player, action, idempotencyKey)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_action_idempotency_created ON action_idempotency(createdAt)");
  } catch {}
}

export function findActionIdempotency(player: number, action: string, idempotencyKey: string) {
  ensureActionIdempotencySchema();
  const pid = Math.max(0, Math.floor(Number(player || 0)));
  const a = key(action);
  const idem = key(idempotencyKey);
  if (!idem) return null;
  try {
    const row = q("SELECT * FROM action_idempotency WHERE player = ? AND action = ? AND idempotencyKey = ? LIMIT 1")?.get?.(pid, a, idem) || null;
    if (row) return { ...row, response: row.responseJson ? safeJson(row.responseJson, null) : null };
  } catch {}
  const rows = safeJson(metaGet(META, "[]"), []);
  const row = rows.find((r: any) => Number(r.player) === pid && String(r.action) === a && String(r.idempotencyKey) === idem) || null;
  return row ? { ...row, response: row.responseJson ? safeJson(row.responseJson, null) : null } : null;
}

export function recordActionIdempotency(player: number, action: string, idempotencyKey: string, hash: string, response: any) {
  ensureActionIdempotencySchema();
  const pid = Math.max(0, Math.floor(Number(player || 0)));
  const a = key(action);
  const idem = key(idempotencyKey);
  if (!idem) return null;
  const row = { player: pid, action: a, idempotencyKey: idem, requestHash: String(hash || ""), responseJson: JSON.stringify(response ?? null), createdAt: now() };
  try {
    q("INSERT INTO action_idempotency (player, action, idempotencyKey, requestHash, responseJson, createdAt) VALUES (?, ?, ?, ?, ?, ?)")?.run?.(row.player, row.action, row.idempotencyKey, row.requestHash, row.responseJson, row.createdAt);
    return row;
  } catch {
    return findActionIdempotency(pid, a, idem);
  }
}

export function idempotencyConflict(existing: any, hash: string) {
  return existing && String(existing.requestHash || "") && String(existing.requestHash || "") !== String(hash || "");
}
