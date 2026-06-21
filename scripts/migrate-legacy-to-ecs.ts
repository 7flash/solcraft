#!/usr/bin/env bun
/**
 * Stage 12 one-shot migration/mirror.
 *
 * This is intentionally idempotent. It does not delete legacy rows. It creates
 * and refreshes ECS mirror metadata/tables so the server can be started with:
 *
 *   SOLCRAFT_BACKEND_MODE=hybrid bun run dev
 *   SOLCRAFT_BACKEND_MODE=ecs bun run start
 */
import { ensureDbSchemaVersion } from "../server/db";
import { mirrorLegacyToEcsTables, ecsMigrationStatus } from "../server/ecsDbAdapter";
import { dbIntegrityReport } from "../server/dbIntegrity";

const before = ecsMigrationStatus();
const schema = ensureDbSchemaVersion();
const world = mirrorLegacyToEcsTables("script");
const integrity = dbIntegrityReport();
const after = ecsMigrationStatus();

console.log(JSON.stringify({
  ok: true,
  schema,
  before,
  after,
  world: { players: world.players.size, tiles: world.tiles.size, buildings: world.buildings.size, loot: world.loot.size, doodads: world.doodads.size },
  integrity: { ok: integrity.ok, problems: integrity.summary?.issueCount || 0, counts: integrity.counts },
}, null, 2));
