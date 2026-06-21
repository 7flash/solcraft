import { db, CURRENT_DB_SCHEMA_VERSION, metaGet } from "./db";
import { buildingCacheStats } from "./buildingStore";
import { tileCacheStats } from "./tileStore";
import { lootCacheStats } from "./lootStore";
import { playerCacheStats } from "./playerStore";

const COORD_TABLES = ["tiles", "buildings", "loot"] as const;
type CoordTable = (typeof COORD_TABLES)[number];

type IntegrityIssue = {
  code: string;
  severity: "info" | "warn" | "error";
  table?: string;
  msg: string;
  count?: number;
  sample?: any[];
};

function rowsFor(table: CoordTable): any[] {
  return ((db as any)[table]?.select?.().all?.() || []) as any[];
}

function playerIdSet() {
  const ids = new Set<number>();
  for (const p of ((db as any).players.select().all() || []) as any[]) ids.add(Number(p.id || 0));
  return ids;
}

function duplicateCoordinateIssue(table: CoordTable, sampleLimit: number): IntegrityIssue | null {
  const byCell = new Map<string, any[]>();
  for (const row of rowsFor(table)) {
    const k = `${Number(row.x || 0)},${Number(row.z || 0)}`;
    const list = byCell.get(k) || [];
    list.push(row);
    byCell.set(k, list);
  }
  const dupes = [...byCell.entries()].filter(([, rows]) => rows.length > 1);
  if (!dupes.length) return null;
  return {
    code: "DUPLICATE_COORDINATES",
    severity: "error",
    table,
    msg: `${table} contains multiple rows on the same coordinate. Coordinate unique indexes/cache invariants require one row per cell.`,
    count: dupes.length,
    sample: dupes.slice(0, sampleLimit).map(([cell, rows]) => ({ cell, ids: rows.map((r) => r.id) })),
  };
}

function orphanOwnerIssue(table: "tiles" | "buildings", ids: Set<number>, sampleLimit: number): IntegrityIssue | null {
  const bad: any[] = [];
  for (const row of rowsFor(table)) {
    const owner = Number(row.owner || 0);
    if (owner > 0 && !ids.has(owner)) bad.push({ id: row.id, owner, x: row.x, z: row.z, kind: row.kind || undefined });
  }
  if (!bad.length) return null;
  return {
    code: "ORPHAN_OWNER",
    severity: "warn",
    table,
    msg: `${table} has rows owned by missing players. This is repairable, but ECS migration should not proceed until owners are resolved or neutralized.`,
    count: bad.length,
    sample: bad.slice(0, sampleLimit),
  };
}

function malformedPlayerIssue(sampleLimit: number): IntegrityIssue | null {
  const bad: any[] = [];
  for (const p of ((db as any).players.select().all() || []) as any[]) {
    const reasons: string[] = [];
    if (!p.name) reasons.push("missing-name");
    if (!p.secret) reasons.push("missing-secret");
    if (!p.inv || typeof p.inv !== "object") reasons.push("bad-inv");
    if (!Array.isArray(p.pack)) reasons.push("bad-pack");
    if (!p.equip || typeof p.equip !== "object") reasons.push("bad-equip");
    if (!Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.z))) reasons.push("bad-position");
    if (reasons.length) bad.push({ id: p.id, name: p.name, reasons });
  }
  if (!bad.length) return null;
  return {
    code: "MALFORMED_PLAYER",
    severity: "error",
    table: "players",
    msg: "Some player rows are missing required legacy fields or have invalid JSON-shaped values.",
    count: bad.length,
    sample: bad.slice(0, sampleLimit),
  };
}

function countTable(table: string) {
  try { return Number((db as any)[table].select().count()) || 0; } catch { return 0; }
}

export function dbIntegrityReport(opts: { sampleLimit?: number } = {}) {
  const sampleLimit = Math.max(1, Math.min(50, Math.trunc(Number(opts.sampleLimit || 12))));
  const issues: IntegrityIssue[] = [];
  for (const table of COORD_TABLES) {
    const issue = duplicateCoordinateIssue(table, sampleLimit);
    if (issue) issues.push(issue);
  }
  const ids = playerIdSet();
  const tileOwners = orphanOwnerIssue("tiles", ids, sampleLimit);
  const buildingOwners = orphanOwnerIssue("buildings", ids, sampleLimit);
  const malformed = malformedPlayerIssue(sampleLimit);
  if (tileOwners) issues.push(tileOwners);
  if (buildingOwners) issues.push(buildingOwners);
  if (malformed) issues.push(malformed);

  const counts = {
    players: countTable("players"),
    tiles: countTable("tiles"),
    buildings: countTable("buildings"),
    doodads: countTable("doodads"),
    loot: countTable("loot"),
    chat: countTable("chat"),
    offers: countTable("offers"),
    events: countTable("events"),
    redemptions: countTable("redemptions"),
    walletChallenges: countTable("walletChallenges"),
  };
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warn").length;
  return {
    ok: errors === 0,
    generatedAt: Date.now(),
    schema: {
      current: Number(metaGet("solcraft:db:schemaVersion", "0")) || 0,
      target: CURRENT_DB_SCHEMA_VERSION,
      lastStartupMigration: metaGet("solcraft:db:lastStartupMigration", ""),
      lastStartupMigrationAt: Number(metaGet("solcraft:db:lastStartupMigrationAt", "0")) || 0,
    },
    counts,
    caches: {
      players: playerCacheStats(),
      buildings: buildingCacheStats(),
      tiles: tileCacheStats(),
      loot: lootCacheStats(),
    },
    issues,
    summary: { errors, warnings, issueCount: issues.length },
  };
}

export function assertDbIntegrity() {
  const report = dbIntegrityReport();
  if (!report.ok) {
    const e: any = new Error(`DB integrity failed with ${report.summary.errors} error(s).`);
    e.report = report;
    throw e;
  }
  return report;
}
