// @ts-nocheck
import { metaGet } from "./db";

export type DeployReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  severity: "info" | "warn" | "blocker";
  value?: any;
  hint?: string;
};

function envFlag(name: string, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}
function envBool(name: string, fallback = false) {
  const v = envFlag(name, fallback ? "1" : "0").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
function cleanBackendMode() {
  const mode = envFlag("SOLCRAFT_BACKEND_MODE", "ecs").toLowerCase();
  return mode === "ecs" || mode === "hybrid" || mode === "legacy" ? mode : "unknown";
}
function schemaVersion() {
  const raw = metaGet("solcraft:db:schemaVersion", "0");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
function check(id: string, label: string, ok: boolean, severity: DeployReadinessCheck["severity"], value?: any, hint?: string): DeployReadinessCheck {
  return { id, label, ok: !!ok, severity, value, hint };
}

async function optionalCall(modulePath: string, fn: string, fallback: any = null) {
  try {
    const mod: any = await import(modulePath);
    return typeof mod?.[fn] === "function" ? await mod[fn]() : fallback;
  } catch {
    return fallback;
  }
}

export async function deployReadinessReport() {
  const backendMode = cleanBackendMode();
  const schema = schemaVersion();
  const adminKeyConfigured = !!(envFlag("SOLCRAFT_ADMIN_KEY") || envFlag("SOLCRAFT_DEPLOY_ADMIN_KEY") || envFlag("ADMIN_KEY"));
  const activityRows = await optionalCall("./measureActivity", "recentMeasureActivity", []);
  const tick = await optionalCall("./ecsBackend", "worldTickStatus", null);
  const backend = await optionalCall("./backend", "backendStatus", null);
  const cleanRelease = await optionalCall("./cleanRelease", "cleanReleaseSummary", null);
  const recentRows = Array.isArray(activityRows) ? activityRows : [];

  const checks: DeployReadinessCheck[] = [
    check("admin-key", "Admin/deploy key configured", adminKeyConfigured, "blocker", adminKeyConfigured, "Set SOLCRAFT_ADMIN_KEY or SOLCRAFT_DEPLOY_ADMIN_KEY before staging/prod."),
    
    check("legacy-disabled", "Legacy backend disabled", !envBool("SOLCRAFT_ENABLE_LEGACY_BACKEND"), "blocker", envFlag("SOLCRAFT_ENABLE_LEGACY_BACKEND", "0"), "Clean release must run ECS-only; do not enable legacy/hybrid fallback."),
    check("strict-clean-release", "Strict clean-release verification expected", envBool("SOLCRAFT_STRICT_CLEAN_RELEASE", true), "warn", envFlag("SOLCRAFT_STRICT_CLEAN_RELEASE", "1"), "Set SOLCRAFT_STRICT_CLEAN_RELEASE=1 in staging/prod."),
    check("backend-mode", "Clean backend mode", backendMode === "ecs", backendMode === "hybrid" ? "blocker" : "blocker", backendMode, "Use SOLCRAFT_BACKEND_MODE=ecs. Hybrid/legacy require SOLCRAFT_ENABLE_LEGACY_BACKEND=1 and are not clean-release ready."),
    check("schema-version", "Schema version at least clean release", schema >= 40, "blocker", schema, "Run the clean release-candidate DB init before deploy."),
    check("bombs-disabled", "Legacy bombs disabled", !envBool("SOLCRAFT_ENABLE_BOMBS"), "blocker", envFlag("SOLCRAFT_ENABLE_BOMBS", "0"), "Bombs are removed from clean release."),
    check("territory-coins-disabled", "Legacy territory coin rain disabled", !envBool("SOLCRAFT_ENABLE_TERRITORY_COINS"), "warn", envFlag("SOLCRAFT_ENABLE_TERRITORY_COINS", "0"), "Clean economy uses NPC/Keep coin drops instead of old territory coin rain."),
    check("passive-production-disabled", "Passive production disabled", !envBool("SOLCRAFT_ENABLE_PASSIVE_PRODUCTION"), "blocker", envFlag("SOLCRAFT_ENABLE_PASSIVE_PRODUCTION", "0"), "Camps/farms/quarries should spawn gatherables, not auto-credit resources."),
    check("bank-tables", "Bank tables enabled", envFlag("SOLCRAFT_BANK_TABLES", "1") !== "0", "warn", envFlag("SOLCRAFT_BANK_TABLES", "1"), "Use production bank tables for auditability."),
    check("measure-activity", "Measure-scoped activity is collecting rows", recentRows.length > 0, "info", recentRows.length, "This may be empty immediately after boot; it should fill after requests."),
    check("world-tick", "World tick status available", !!tick, "warn", tick ? { running: tick.running, lastRunAt: tick.lastRunAt } : null, "The clean backend should expose ECS/world tick status."),
  ];

  const blockers = checks.filter((c) => !c.ok && c.severity === "blocker");
  const warnings = checks.filter((c) => !c.ok && c.severity === "warn");
  const ready = blockers.length === 0;

  return {
    ok: true,
    ready,
    generatedAt: Date.now(),
    summary: {
      ready,
      blockers: blockers.length,
      warnings: warnings.length,
      backendMode,
      schemaVersion: schema,
    },
    checks,
    backend,
    cleanRelease,
    worldTick: tick,
    recentMeasureActivity: recentRows.slice(0, 8),
  };
}
