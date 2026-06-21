import type { GameRules, ResourceBag } from "../types.ts";
import { DEFAULT_ECS_RULES } from "../tuning.ts";

/**
 * Builds ECS rules from the existing game/shared.ts module shape.
 * Import it lazily from game/engine.ts so tests can stay independent.
 */
export function rulesFromLegacyShared(shared: any): GameRules {
  const rules: GameRules = structuredClone(DEFAULT_ECS_RULES);
  const economy = shared?.ECONOMY_RULES || shared?.ECONOMY || {};
  rules.movement.energyPerStep = Number(shared?.MOVE_COST || economy?.moveCost || rules.movement.energyPerStep) || rules.movement.energyPerStep;
  rules.energy.defaultMax = Number(economy?.energyMaxBase || economy?.energyCap || rules.energy.defaultMax) || rules.energy.defaultMax;
  rules.energy.defaultRegenPerMinute = Number(economy?.energyRegenBasePerMinute || rules.energy.defaultRegenPerMinute) || rules.energy.defaultRegenPerMinute;
  if (shared?.CLAIM_COST) rules.claim.cost = normalizeCost(shared.CLAIM_COST);

  const library = Array.isArray(shared?.LIBRARY) ? shared.LIBRARY : [];
  for (const def of library) {
    const kind = String(def?.id || def?.kind || "");
    if (!kind) continue;
    rules.buildings[kind] = {
      kind,
      label: String(def?.name || def?.label || kind),
      cost: normalizeCost(def?.cost || {}),
      upgradeCost: normalizeCost(def?.upgrade || def?.upgradeCost || {}),
      produces: normalizeCost(def?.produces || def?.prod || {}),
      maxLevel: Number(shared?.MAX_LEVEL || def?.maxLevel || 5) || 5,
      storageBonus: normalizeCost({
        w: def?.storageBonus || 0,
        p: def?.storageBonus || 0,
        s: def?.storageBonus || 0,
        f: def?.foodStorageBonus || 0,
      }),
      footprint: [Number(def?.w || 1) || 1, Number(def?.h || 1) || 1],
    };
  }
  return rules;
}

function normalizeCost(input: any): ResourceBag {
  const out: ResourceBag = {};
  for (const key of ["e", "w", "p", "s", "f", "g", "sh", "sc"] as const) {
    const n = Number(input?.[key] || 0);
    if (Number.isFinite(n) && n !== 0) out[key] = n;
  }
  return out;
}
