import { db, metaGet } from './db';
import { buildingCacheStats } from './buildingStore';
import { tileCacheStats } from './tileStore';
import { lootCacheStats } from './lootStore';
import { playerCacheStats } from './playerStore';

const COORD_TABLES = ['tiles', 'buildings', 'loot'] as const;
type CoordTable = (typeof COORD_TABLES)[number];
type IntegrityIssue = { code: string; severity: 'info' | 'warn' | 'error'; table?: string; msg: string; count?: number; sample?: any[] };

function rowsFor(table: CoordTable): any[] { try { return ((db as any)[table]?.select?.().all?.() || []) as any[]; } catch { return []; } }
function rows(table: string): any[] { try { return ((db as any)[table]?.select?.().all?.() || []) as any[]; } catch { return []; } }
function countTable(table: string) { try { return Number((db as any)[table]?.select?.().count?.() || 0) || 0; } catch { return 0; } }
function safeStats(fn: () => any) { try { return fn(); } catch (e: any) { return { error: String(e?.message || e) }; } }

function playerIdSet() {
  const ids = new Set<number>();
  for (const p of rows('players')) ids.add(Number(p.id || 0));
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
  const dupes = [...byCell.entries()].filter(([, list]) => list.length > 1);
  if (!dupes.length) return null;
  return { code: 'DUPLICATE_COORDINATES', severity: 'error', table, msg: `${table} contains multiple rows on the same coordinate.`, count: dupes.length, sample: dupes.slice(0, sampleLimit).map(([cell, list]) => ({ cell, ids: list.map((r) => r.id) })) };
}

function orphanOwnerIssue(table: 'tiles' | 'buildings', ids: Set<number>, sampleLimit: number): IntegrityIssue | null {
  const bad: any[] = [];
  for (const row of rowsFor(table)) {
    const owner = Number(row.owner || 0);
    if (owner > 0 && !ids.has(owner)) bad.push({ id: row.id, owner, x: row.x, z: row.z, kind: row.kind || undefined });
  }
  if (!bad.length) return null;
  return { code: 'ORPHAN_OWNER', severity: 'warn', table, msg: `${table} has rows owned by missing players.`, count: bad.length, sample: bad.slice(0, sampleLimit) };
}

function malformedPlayerIssue(sampleLimit: number): IntegrityIssue | null {
  const bad: any[] = [];
  for (const p of rows('players')) {
    const reasons: string[] = [];
    if (!p.name && !p.spectator) reasons.push('missing-name');
    if (!p.secret) reasons.push('missing-secret');
    if (!Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.z))) reasons.push('bad-position');
    if (reasons.length) bad.push({ id: p.id, name: p.name, reasons });
  }
  if (!bad.length) return null;
  return { code: 'MALFORMED_PLAYER', severity: 'error', table: 'players', msg: 'Some player rows are missing required fields.', count: bad.length, sample: bad.slice(0, sampleLimit) };
}

export function dbIntegrityReport(opts: { sampleLimit?: number } = {}) {
  const sampleLimit = Math.max(1, Math.min(50, Math.trunc(Number(opts.sampleLimit || 12))));
  const issues: IntegrityIssue[] = [];
  for (const table of COORD_TABLES) {
    const issue = duplicateCoordinateIssue(table, sampleLimit);
    if (issue) issues.push(issue);
  }
  const ids = playerIdSet();
  const tileOwners = orphanOwnerIssue('tiles', ids, sampleLimit);
  const buildingOwners = orphanOwnerIssue('buildings', ids, sampleLimit);
  const malformed = malformedPlayerIssue(sampleLimit);
  if (tileOwners) issues.push(tileOwners);
  if (buildingOwners) issues.push(buildingOwners);
  if (malformed) issues.push(malformed);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warn').length;
  const current = Number(metaGet('solcraft:db:schemaVersion', '0')) || 0;
  return {
    ok: errors === 0,
    generatedAt: Date.now(),
    schema: {
      current,
      target: Number(metaGet('solcraft:db:schemaTarget', String(current))) || current,
      lastStartupMigration: metaGet('solcraft:db:lastStartupMigration', ''),
      lastStartupMigrationAt: Number(metaGet('solcraft:db:lastStartupMigrationAt', '0')) || 0,
    },
    counts: {
      players: countTable('players'), tiles: countTable('tiles'), buildings: countTable('buildings'), doodads: countTable('doodads'), loot: countTable('loot'),
      chat: countTable('chat'), offers: countTable('offers'), events: countTable('events'), redemptions: countTable('redemptions'), walletChallenges: countTable('walletChallenges'),
      keeps: countTable('keeps'), npcs: countTable('npcs'), wonders: countTable('wonders'), referralCodes: countTable('referralCodes'), referralClaims: countTable('referralClaims'),
    },
    caches: { players: safeStats(playerCacheStats), buildings: safeStats(buildingCacheStats), tiles: safeStats(tileCacheStats), loot: safeStats(lootCacheStats) },
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
