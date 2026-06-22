import { backendMode, backendStatus } from "./backend";
import { DB_SCHEMA_VERSION } from "./dbSchema";
import { measureActivitySummary } from "./measureActivity";
import { cleanReleaseSummary } from "./cleanRelease";

function env(name: string, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}
function bool(name: string, fallback = false) {
  const v = env(name, fallback ? "1" : "0").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function cleanReleaseEnv() {
  return {
    backendMode: backendMode(),
    strict: bool("SOLCRAFT_STRICT_CLEAN_RELEASE", true),
    legacyBackendEnabled: bool("SOLCRAFT_ENABLE_LEGACY_BACKEND", false),
    bombsEnabled: bool("SOLCRAFT_ENABLE_BOMBS", false),
    territoryCoinsEnabled: bool("SOLCRAFT_ENABLE_TERRITORY_COINS", false),
    passiveProductionEnabled: bool("SOLCRAFT_ENABLE_PASSIVE_PRODUCTION", false),
    bankTables: env("SOLCRAFT_BANK_TABLES", "1") !== "0",
    dbPath: env("SOLCRAFT_DB", "solcraft.db"),
    schemaVersion: DB_SCHEMA_VERSION,
  };
}

export function cleanReleaseGateReport() {
  const e = cleanReleaseEnv();
  const checks = [
    { id: "ecs-only", ok: e.backendMode === "ecs", value: e.backendMode, msg: "Backend must run in ECS mode." },
    { id: "legacy-off", ok: !e.legacyBackendEnabled, value: e.legacyBackendEnabled, msg: "Legacy/hybrid fallback must be disabled." },
    { id: "bombs-off", ok: !e.bombsEnabled, value: e.bombsEnabled, msg: "Bombs were removed." },
    { id: "territory-coins-off", ok: !e.territoryCoinsEnabled, value: e.territoryCoinsEnabled, msg: "Old territory coin rain is removed." },
    { id: "passive-production-off", ok: !e.passiveProductionEnabled, value: e.passiveProductionEnabled, msg: "Passive building production is removed." },
    { id: "bank-tables-on", ok: e.bankTables, value: e.bankTables, msg: "Bank audit tables should be enabled." },
    { id: "schema-40", ok: e.schemaVersion >= 40, value: e.schemaVersion, msg: "Clean release schema must be v40+." },
  ];
  const blockers = checks.filter((c) => !c.ok);
  return {
    ok: blockers.length === 0,
    generatedAt: Date.now(),
    env: e,
    checks,
    blockers,
    backend: backendStatus(),
    cleanRelease: cleanReleaseSummary(),
    measureActivity: measureActivitySummary(),
  };
}
