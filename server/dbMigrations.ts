// @ts-nocheck
import { DB_SCHEMA_VERSION, applyProductionDbSchema } from "./dbSchema";

const MIGRATION_META_KEY = "solcraft:db:migrationVersion";

type DbLike = { exec(sql: string): unknown; meta?: any };

function metaGetFrom(db: any, key: string, fallback = "") {
  try { const row = db.meta?.select?.().where?.({ k: key })?.first?.(); return row ? row.v : fallback; } catch { return fallback; }
}
function metaSetTo(db: any, key: string, value: string) {
  try {
    const row = db.meta?.select?.().where?.({ k: key })?.first?.();
    if (row) row.v = value;
    else db.meta?.insert?.({ k: key, v: value });
  } catch {}
}

export function runForwardDbMigrations(db: DbLike) {
  const current = Number(metaGetFrom(db, MIGRATION_META_KEY, "0")) || 0;
  // Current migrations are additive and idempotent: tables/indexes only.
  // Keep this runner explicit so future non-additive migrations have a single
  // production-safe place to live instead of ad-hoc startup scripts.
  applyProductionDbSchema(db);
  if (current < DB_SCHEMA_VERSION) metaSetTo(db, MIGRATION_META_KEY, String(DB_SCHEMA_VERSION));
  return { ok: true, current: Math.max(current, DB_SCHEMA_VERSION), target: DB_SCHEMA_VERSION };
}
