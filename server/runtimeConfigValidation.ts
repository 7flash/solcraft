// Runtime config validation for the clean ECS release candidate.
// Keep this module small and dependency-light so admin/runtime endpoints can use it safely.

export type RuntimeConfigIssue = {
  key: string;
  value: unknown;
  severity: "error" | "warn";
  msg: string;
};

export type RuntimeConfigRule = {
  key: string;
  min?: number;
  max?: number;
  integer?: boolean;
  required?: boolean;
};

export const CLEAN_RUNTIME_CONFIG_RULES: RuntimeConfigRule[] = [
  { key: "economy.reputation.baseTileCap", min: 1, max: 500, integer: true, required: true },
  { key: "economy.reputation.tilesPerReputation", min: 1, max: 100, integer: true, required: true },
  { key: "economy.reputation.npcDonate", min: 0, max: 500, integer: true },
  { key: "economy.reputation.npcKill", min: -500, max: 0, integer: true },
  { key: "economy.reputation.keepDonate", min: 0, max: 1000, integer: true },
  { key: "economy.reputation.keepRaid", min: -1000, max: 0, integer: true },
  { key: "economy.reputation.buildingAttack", min: -500, max: 0, integer: true },

  { key: "economy.storage.baseWood", min: 0, max: 100000, integer: true, required: true },
  { key: "economy.storage.baseStone", min: 0, max: 100000, integer: true, required: true },
  { key: "economy.storage.baseFood", min: 0, max: 100000, integer: true, required: true },
  { key: "economy.storage.warehouseWood", min: 0, max: 100000, integer: true },
  { key: "economy.storage.warehouseStone", min: 0, max: 100000, integer: true },
  { key: "economy.storage.warehouseFood", min: 0, max: 100000, integer: true },
  { key: "economy.storage.rotPerTick", min: 0, max: 10000, integer: true },

  { key: "economy.harvest.treeWoodMin", min: 0, max: 1000, integer: true },
  { key: "economy.harvest.treeWoodMax", min: 0, max: 1000, integer: true },
  { key: "economy.harvest.rockStoneMin", min: 0, max: 1000, integer: true },
  { key: "economy.harvest.rockStoneMax", min: 0, max: 1000, integer: true },
  { key: "economy.harvest.cropFoodMin", min: 0, max: 1000, integer: true },
  { key: "economy.harvest.cropFoodMax", min: 0, max: 1000, integer: true },

  { key: "economy.spawn.lumberCampRate", min: 0, max: 1000, integer: true },
  { key: "economy.spawn.quarryRate", min: 0, max: 1000, integer: true },
  { key: "economy.spawn.farmRate", min: 0, max: 1000, integer: true },
  { key: "economy.spawn.campRadius", min: 1, max: 24, integer: true },

  { key: "combat.playerAttackDamage", min: 0, max: 100, integer: true },
  { key: "combat.playerAttackSelfDamage", min: 0, max: 100, integer: true },
  { key: "combat.keepRegenPerTick", min: 0, max: 10000, integer: true },
  { key: "combat.capitalRegenPerTick", min: 0, max: 10000, integer: true },

  { key: "economy.keep.baseCoinDrop", min: 0, max: 100000, integer: true },
  { key: "economy.npc.baseCoinDrop", min: 0, max: 100000, integer: true },
];

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function validateRuntimeConfig(config: Record<string, unknown>): RuntimeConfigIssue[] {
  const issues: RuntimeConfigIssue[] = [];
  for (const rule of CLEAN_RUNTIME_CONFIG_RULES) {
    const value = config?.[rule.key];
    if ((value === undefined || value === null || value === "") && rule.required) {
      issues.push({ key: rule.key, value, severity: "error", msg: "Required runtime config is missing." });
      continue;
    }
    if (value === undefined || value === null || value === "") continue;
    const n = readNumber(value);
    if (n === null) {
      issues.push({ key: rule.key, value, severity: "error", msg: "Expected a numeric value." });
      continue;
    }
    if (rule.integer && Math.trunc(n) !== n) {
      issues.push({ key: rule.key, value, severity: "error", msg: "Expected an integer value." });
    }
    if (rule.min !== undefined && n < rule.min) {
      issues.push({ key: rule.key, value, severity: "error", msg: `Value is below minimum ${rule.min}.` });
    }
    if (rule.max !== undefined && n > rule.max) {
      issues.push({ key: rule.key, value, severity: "error", msg: `Value is above maximum ${rule.max}.` });
    }
  }

  const pairs: Array<[string, string]> = [
    ["economy.harvest.treeWoodMin", "economy.harvest.treeWoodMax"],
    ["economy.harvest.rockStoneMin", "economy.harvest.rockStoneMax"],
    ["economy.harvest.cropFoodMin", "economy.harvest.cropFoodMax"],
  ];
  for (const [minKey, maxKey] of pairs) {
    const min = readNumber(config?.[minKey]);
    const max = readNumber(config?.[maxKey]);
    if (min !== null && max !== null && min > max) {
      issues.push({ key: `${minKey}/${maxKey}`, value: { min, max }, severity: "error", msg: "Minimum is greater than maximum." });
    }
  }
  return issues;
}

export function runtimeConfigReady(config: Record<string, unknown>) {
  const issues = validateRuntimeConfig(config);
  return { ok: issues.every((i) => i.severity !== "error"), issues };
}
