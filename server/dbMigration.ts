/*
 * Clean RC/runtime startup must not run legacy data migrations.
 *
 * Fresh databases are created by scripts/create-release-candidate-db.ts from
 * server/ECS_CLEAN_SCHEMA.sql. Legacy/prod migrations should run offline against
 * a copied DB, not during SSR/API module import.
 */
export type ExecDb = { exec(sql: string): unknown };

export function applyStartupDataMigrations(_db: ExecDb) {
  return { ok: true, skipped: true, reason: "startup-data-migrations-disabled" };
}

export function startupDataMigrationsEnabled() {
  return false;
}
