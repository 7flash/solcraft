/*
 * SolCrafts forward-only startup migrations.
 *
 * Legacy data rewrites remain disabled; production-safe additive schema creation
 * is allowed on boot so bank/ledger/idempotency tables cannot silently drift from
 * the code that uses them.
 */
import { DB_SCHEMA_VERSION, applyProductionDbSchema } from "./dbSchema";

declare const process: any;

export type ExecDb = { exec(sql: string): unknown };

function quote(v: any) { return String(v ?? "").replace(/'/g, "''"); }
function setMeta(db: ExecDb, k: string, v: string) {
  try {
    db.exec("CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY AUTOINCREMENT, k TEXT NOT NULL, v TEXT NOT NULL)");
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_k ON meta(k)");
    db.exec(`INSERT INTO meta(k, v) VALUES ('${quote(k)}', '${quote(v)}') ON CONFLICT(k) DO UPDATE SET v = excluded.v`);
  } catch {}
}

export function applyStartupDataMigrations(db: ExecDb) {
  if (process.env.SOLCRAFT_DISABLE_STARTUP_SCHEMA_MIGRATIONS === "1") {
    return { ok: true, skipped: true, reason: "startup-schema-migrations-disabled-by-env" };
  }
  try {
    applyProductionDbSchema(db);
    setMeta(db, "solcraft:db:schemaVersion", String(DB_SCHEMA_VERSION));
    setMeta(db, "solcraft:db:schemaTarget", String(DB_SCHEMA_VERSION));
    setMeta(db, "solcraft:db:lastStartupMigration", `schema:${DB_SCHEMA_VERSION}`);
    setMeta(db, "solcraft:db:lastStartupMigrationAt", String(Date.now()));
    return { ok: true, schemaVersion: DB_SCHEMA_VERSION, additive: true };
  } catch (e: any) {
    if (process.env.SOLCRAFT_STRICT_SCHEMA_MIGRATIONS === "1") throw e;
    return { ok: false, skipped: true, reason: "startup-schema-migration-failed", msg: String(e?.message || e) };
  }
}

export function startupDataMigrationsEnabled() {
  return process.env.SOLCRAFT_DISABLE_STARTUP_SCHEMA_MIGRATIONS !== "1";
}
