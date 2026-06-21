/*
 * Startup data migrations for the legacy SQLite authority store.
 *
 * Keep this file intentionally small and deterministic.  It runs before hard
 * coordinate unique indexes are created, so it is the right place for one-time
 * compatibility cleanup that makes old DB files safe for stricter ECS-era
 * invariants.  Do not put hot gameplay logic here.
 */

type ExecDb = { exec(sql: string): unknown };

const COORD_TABLES = ["tiles", "buildings", "loot"] as const;
type CoordTable = (typeof COORD_TABLES)[number];

function quoteIdent(name: CoordTable) {
  // Hardcoded table names only; never pass user input into this helper.
  return name;
}

function upsertMetaSql(key: string, value: string) {
  const k = key.replace(/'/g, "''");
  const v = value.replace(/'/g, "''");
  return `INSERT INTO meta(k, v) SELECT '${k}', '${v}' WHERE NOT EXISTS (SELECT 1 FROM meta WHERE k='${k}');\nUPDATE meta SET v='${v}' WHERE k='${k}';`;
}

export function deleteDuplicateCoordinates(db: ExecDb, table: CoordTable) {
  const t = quoteIdent(table);
  // Keep the oldest row for each coordinate.  This matches the pre-Stage 11
  // behavior, but gives the cleanup a named/auditable home and makes future
  // migrations easier to reason about.
  db.exec(`DELETE FROM ${t} WHERE id NOT IN (SELECT MIN(id) FROM ${t} GROUP BY x, z)`);
}

export function applyStartupDataMigrations(db: ExecDb) {
  for (const table of COORD_TABLES) deleteDuplicateCoordinates(db, table);
  db.exec(upsertMetaSql("solcraft:db:lastStartupMigrationAt", String(Date.now())));
  db.exec(upsertMetaSql("solcraft:db:lastStartupMigration", "coord-dedupe:v1"));
}
