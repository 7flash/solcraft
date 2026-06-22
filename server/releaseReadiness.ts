import { runtimeConfigReady } from "./runtimeConfigValidation";

export type ReleaseReadinessCheck = {
  id: string;
  ok: boolean;
  severity: "blocker" | "warn";
  msg: string;
  value?: unknown;
};

function envFlag(name: string, fallback = "0") {
  return String(process.env[name] ?? fallback).trim();
}
function envEnabled(name: string, fallback = "0") {
  return ["1", "true", "yes", "on"].includes(envFlag(name, fallback).toLowerCase());
}
function check(id: string, ok: boolean, severity: "blocker" | "warn", msg: string, value?: unknown): ReleaseReadinessCheck {
  return { id, ok, severity, msg, value };
}

export function expectedCleanReleaseEnvChecks(): ReleaseReadinessCheck[] {
  const backend = envFlag("SOLCRAFT_BACKEND_MODE", "ecs").toLowerCase();
  return [
    check("backend.ecs", backend === "ecs", "blocker", "SOLCRAFT_BACKEND_MODE must be ecs for RC/prod clean release.", backend),
    check("legacy.disabled", !envEnabled("SOLCRAFT_ENABLE_LEGACY_BACKEND"), "blocker", "Legacy backend must be disabled for clean release.", envFlag("SOLCRAFT_ENABLE_LEGACY_BACKEND", "0")),
    check("bombs.disabled", !envEnabled("SOLCRAFT_ENABLE_BOMBS"), "blocker", "Bombs must stay disabled/removed.", envFlag("SOLCRAFT_ENABLE_BOMBS", "0")),
    check("territoryCoins.disabled", !envEnabled("SOLCRAFT_ENABLE_TERRITORY_COINS"), "blocker", "Old territory coin rain must stay disabled.", envFlag("SOLCRAFT_ENABLE_TERRITORY_COINS", "0")),
    check("passiveProduction.disabled", !envEnabled("SOLCRAFT_ENABLE_PASSIVE_PRODUCTION"), "blocker", "Passive production must stay disabled.", envFlag("SOLCRAFT_ENABLE_PASSIVE_PRODUCTION", "0")),
    check("devCommands.disabled", !envEnabled("SOLCRAFT_ENABLE_DEV_COMMANDS"), "blocker", "Dev commands must stay disabled in player chat.", envFlag("SOLCRAFT_ENABLE_DEV_COMMANDS", "0")),
    check("bank.tables", envEnabled("SOLCRAFT_BANK_TABLES", "1"), "warn", "Bank table mode should be enabled.", envFlag("SOLCRAFT_BANK_TABLES", "1")),
  ];
}

export function buildReleaseReadinessReport(input: {
  schemaVersion?: number;
  expectedSchemaVersion?: number;
  runtimeConfig?: Record<string, unknown>;
  measureActivityCount?: number;
  worldTickVisible?: boolean;
  backendStatus?: unknown;
} = {}) {
  const checks: ReleaseReadinessCheck[] = [...expectedCleanReleaseEnvChecks()];
  const expected = Number(input.expectedSchemaVersion || 40);
  const schema = Number(input.schemaVersion || 0);
  checks.push(check("schema.version", schema >= expected, "blocker", `Schema version must be >= ${expected}.`, schema));
  checks.push(check("measure.activity", Number(input.measureActivityCount || 0) >= 0, "warn", "Measure-scoped activity ring should be available.", input.measureActivityCount || 0));
  checks.push(check("world.tick", input.worldTickVisible !== false, "warn", "World tick status should be visible to admin readiness.", input.worldTickVisible));

  if (input.runtimeConfig) {
    const cfg = runtimeConfigReady(input.runtimeConfig);
    checks.push(check("runtime.config", cfg.ok, "blocker", "Runtime economy/combat config must pass validation.", cfg.issues));
  } else {
    checks.push(check("runtime.config", false, "warn", "Runtime config was not provided to readiness report.", null));
  }

  const blockers = checks.filter((c) => !c.ok && c.severity === "blocker");
  const warnings = checks.filter((c) => !c.ok && c.severity === "warn");
  return {
    ok: blockers.length === 0,
    ready: blockers.length === 0,
    blockers,
    warnings,
    checks,
    backendStatus: input.backendStatus || null,
    generatedAt: Date.now(),
  };
}
