// @ts-nocheck
/**
 * Player-facing production polish copy and small pure helpers.
 * Kept client-side so build cards, guide cards, and preview panels use the
 * same language instead of drifting across modals and HUD panels.
 */

export const RESOURCE_LABELS: Record<string, string> = {
  w: "wood",
  s: "stone",
    f: "food",
  g: "coins",
  e: "energy",
  sh: "shards",
  sc: "$CRAFTS",
};

export const RESOURCE_ICONS: Record<string, string> = {
  w: "🪵",
  s: "🪨",
    f: "🌾",
  g: "🪙",
  e: "⚡",
  sh: "✦",
  sc: "$",
};

export type BuildingPolish = {
  id: string;
  purpose: string;
  requires: string;
  produces: string;
  bestNear: string;
};

export const BUILDING_POLISH: Record<string, BuildingPolish> = {
  cottage: {
    id: "cottage",
    purpose: "House · first settlement anchor and travel point between your homes.",
    requires: "An empty captured tile you own.",
    produces: "Teleport access from the minimap/build panel; settlement identity.",
    bestNear: "Where you want a fast-travel stop.",
  },
  warehouse: {
    id: "warehouse",
    purpose: "Warehouse · the only normal building that raises shared wood/stone/food storage.",
    requires: "An empty captured tile you own.",
    produces: "More total material capacity. Coins stay unlimited and separate.",
    bestNear: "Near camps, quarries, farms, and your most-used House.",
  },
  lumber: {
    id: "lumber",
    purpose: "Lumber Camp · creates renewable tree work nearby; chop and collect for wood.",
    requires: "An empty captured tile you own.",
    produces: "Nearby tree nodes for wood gathering.",
    bestNear: "Forest edges and owned tiles you can patrol quickly.",
  },
  quarry: {
    id: "quarry",
    purpose: "Quarry · creates renewable rock work nearby; mine and collect for stone.",
    requires: "An empty captured tile you own.",
    produces: "Nearby rock nodes for stone used in construction and Wonders.",
    bestNear: "Open land close to storage and expansion routes.",
  },
  farm: {
    id: "farm",
    purpose: "Farm · grows food patches nearby; harvest them before fights and raids.",
    requires: "An empty captured tile you own.",
    produces: "Nearby crop nodes for food gathering.",
    bestNear: "Open land close to a Warehouse.",
  },
  worldwonder: {
    id: "worldwonder",
    purpose: "World Wonder · shared landmark funded with wood and stone that boosts coin production for everyone.",
    requires: "A clear frontier plaza. It does not require your personal captured tiles.",
    produces: "Global coin-production bonus, identity, and a visible world landmark.",
    bestNear: "A planned open district with room around the plaza.",
  },
  keep: {
    id: "keep",
    purpose: "Neutral Keep · coin target. Donate for reputation or raid for coins at reputation risk.",
    requires: "Stand beside it.",
    produces: "Coins if raided, reputation if supported.",
    bestNear: "Scout before attacking; reputation loss can slow expansion.",
  },
  npc: {
    id: "npc",
    purpose: "Traveler · donate coins for reputation or attack for loot at reputation risk.",
    requires: "Stand beside the traveler.",
    produces: "Reputation from donation, or dropped resources from combat.",
    bestNear: "Use donations when you need more tile capacity.",
  },
};
export function resourceAmountLabel(key: string, value: any) {
  const n = Math.max(0, Math.ceil(Number(value || 0)));
  return `${n}${RESOURCE_ICONS[key] || ""} ${RESOURCE_LABELS[key] || key}`.trim();
}

export function costLine(cost: any = {}) {
  const parts = Object.entries(cost || {}).filter(([, v]) => Number(v || 0) > 0).map(([k, v]) => resourceAmountLabel(k, v));
  return parts.length ? parts.join(", ") : "Free";
}

export function missingCostDetails(cost: any = {}, inv: any = {}, liveEnergy = 0) {
  return Object.entries(cost || {})
    .map(([key, amount]) => {
      const have = key === "e" ? Number(liveEnergy || 0) : Number(inv?.[key] || 0);
      const need = Number(amount || 0);
      return { key, need, have, missing: Math.max(0, Math.ceil(need - have)) };
    })
    .filter((r) => r.missing > 0);
}

export function missingCostLineDetailed(cost: any = {}, inv: any = {}, liveEnergy = 0) {
  const missing = missingCostDetails(cost, inv, liveEnergy);
  if (!missing.length) return "Ready to build";
  return `Missing ${missing.map((m) => resourceAmountLabel(m.key, m.missing)).join(", ")}`;
}

export function buildingPurposeLine(building: any) {
  const id = String(building?.id || "");
  return BUILDING_POLISH[id]?.purpose || String(building?.blurb || building?.effect || "City infrastructure.");
}

export function buildingRequirementLine(building: any) {
  const id = String(building?.id || "");
  return BUILDING_POLISH[id]?.requires || "An empty captured tile.";
}

export function buildingProductionLine(building: any) {
  const id = String(building?.id || "");
  const fixed = BUILDING_POLISH[id]?.produces;
  if (fixed) return fixed;
  const produces = Object.entries(building?.produces || {}).filter(([, v]) => Number(v || 0) > 0).map(([k, v]) => `${RESOURCE_ICONS[k] || ""}${v}/${k}`);
  return produces.length ? produces.join(", ") : "Service, landmark, or settlement effect.";
}

export function buildingBestNearLine(building: any) {
  const id = String(building?.id || "");
  return BUILDING_POLISH[id]?.bestNear || "Near related buildings and resource routes.";
}

export function captureLimitLine(player: any) {
  const territory = Math.max(0, Number(player?.territory || 0));
  const cap = Math.max(0, Number(player?.tileCap || 0));
  const rep = Math.floor(Number(player?.reputation?.score ?? player?.rep ?? 0) || 0);
  if (!cap) return `$CRAFTS capacity loading`;
  const left = Math.max(0, cap - territory);
  return `$CRAFTS land capacity ${territory}/${cap} · ${left} claimable`;
}

export function firstStepsGuideRows(player: any = {}) {
  const territory = Math.max(0, Number(player?.territory || 0));
  const inv = player?.inv || {};
  const hasGathered = Number(inv.w || 0) > 0 || Number(inv.s || 0) > 0 || Number(inv.f || 0) > 0;
  const buildKinds = new Set(player?.buildKinds || []);
  return [
    {
      id: "first-gather",
      category: "actions",
      glyph: "🪓",
      title: "Gather visible resources",
      text: "Chop trees, mine rocks, and harvest crops. Walk over drops to collect them into shared storage.",
      detail: `Shared storage: ${Math.floor(Number(inv.w || 0))} wood + ${Math.floor(Number(inv.s || 0))} stone + ${Math.floor(Number(inv.f || 0))} food. Coins are separate.`,
      rewardText: "Starter materials",
      done: hasGathered,
      claimed: false,
    },
    {
      id: "first-capture-3",
      category: "actions",
      glyph: "▦",
      title: "Capture 3 tiles",
      text: "Your first building needs owned land. Capture three nearby tiles for free, then build your first House within the first minute.",
      detail: `${Math.min(territory, 3)}/3 captured · ${captureLimitLine(player)} · claiming is free`,
      rewardText: "Starter settlement space",
      done: territory >= 3,
      claimed: false,
    },
    {
      id: "first-house",
      category: "buildings",
      glyph: "🏠",
      title: "Build a House",
      text: BUILDING_POLISH.cottage.purpose,
      detail: "Select Hammer, click an empty captured tile, then choose House. Houses become your travel points between settlements.",
      rewardText: "First travel anchor",
      done: buildKinds.has("cottage"),
      claimed: false,
    },
    {
      id: "first-production",
      category: "buildings",
      glyph: "🧭",
      title: "Add one resource building",
      text: "Natural nodes do not regenerate on the same harvested tile. Camps, Quarries, and Farms create nearby work you still gather manually.",
      detail: "Choose what your next bottleneck needs: wood from Lumber Camp, stone from Quarry, food from Farm.",
      rewardText: "Repeatable resource loop",
      done: buildKinds.has("lumber") || buildKinds.has("quarry") || buildKinds.has("farm"),
      claimed: false,
    },
    {
      id: "first-storage",
      category: "economy",
      glyph: "▤",
      title: "Build Warehouse when storage fills",
      text: "Wood, stone, and food share one material storage limit. Coins do not use this limit.",
      detail: "Warehouses raise the total material space for wood, stone, and food.",
      rewardText: "More storage",
      done: buildKinds.has("warehouse"),
      claimed: false,
    },
  ];
}
