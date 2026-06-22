// @ts-nocheck
/**
 * Player-facing production polish copy and small pure helpers.
 * Kept client-side so build cards, guide cards, and preview panels use the
 * same language instead of drifting across modals and HUD panels.
 */

export const RESOURCE_LABELS: Record<string, string> = {
  w: "wood",
  s: "stone",
  p: "planks",
  f: "food",
  g: "coins",
  e: "energy",
  sh: "shards",
  sc: "$CRAFTS",
};

export const RESOURCE_ICONS: Record<string, string> = {
  w: "🪵",
  s: "🪨",
  p: "🧱",
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
    purpose: "House · raises settlement value and helps your reputation support more captured tiles.",
    requires: "An empty captured tile.",
    produces: "Settlement growth and future market value.",
    bestNear: "Near Markets, Town Hall, and other homes.",
  },
  warehouse: {
    id: "warehouse",
    purpose: "Warehouse · increases the shared storage used by wood, stone, planks, and food.",
    requires: "An empty captured tile.",
    produces: "More total material capacity.",
    bestNear: "Near resource camps and your main building cluster.",
  },
  lumber: {
    id: "lumber",
    purpose: "Lumber Camp · creates renewable tree work nearby; cut and gather to gain wood.",
    requires: "An empty captured tile with room around it.",
    produces: "Nearby tree nodes for wood gathering.",
    bestNear: "Forest edges and owned territory you can safely patrol.",
  },
  quarry: {
    id: "quarry",
    purpose: "Mine · creates renewable rock work nearby; mine and gather to gain stone.",
    requires: "An empty captured tile with room around it.",
    produces: "Nearby rock nodes for stone gathering.",
    bestNear: "Rocky ground and your storage route.",
  },
  farm: {
    id: "farm",
    purpose: "Farm · grows food patches nearby; harvest them to stock food.",
    requires: "An empty captured tile with room around it.",
    produces: "Nearby crop nodes for food gathering.",
    bestNear: "Open land close to warehouses.",
  },
  market: {
    id: "market",
    purpose: "Market · explains the settlement economy and prepares fixed-rate exchange services.",
    requires: "A developed captured tile and enough starter materials.",
    produces: "Trade access and later city income hooks.",
    bestNear: "Houses and the road to capital services.",
  },
  vault: {
    id: "vault",
    purpose: "Bank · deposit, scan, and withdraw through the connected wallet flow.",
    requires: "A captured service tile.",
    produces: "Bank access; coins stay separate from material storage.",
    bestNear: "Town Hall, Market, and high-traffic capital routes.",
  },
  alchemy: {
    id: "alchemy",
    purpose: "Customizer · change your character doll and colors from a world building.",
    requires: "A captured service tile and a small coin fee.",
    produces: "Appearance editing access.",
    bestNear: "Your social/capital area.",
  },
  townhall: {
    id: "townhall",
    purpose: "Town Hall · makes reputation, territory, and settlement goals explicit.",
    requires: "A central captured tile.",
    produces: "Governance and progression clarity.",
    bestNear: "Houses, Market, and Bank.",
  },
  worldwonder: {
    id: "worldwonder",
    purpose: "World Wonder · a prompt-built landmark, coin sink, and teleport destination.",
    requires: "A large clear captured footprint.",
    produces: "Prestige, travel identity, and a visible world landmark.",
    bestNear: "A planned plaza with clear surrounding tiles.",
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
  return produces.length ? produces.join(", ") : "No passive output; unlocks a service or world rule.";
}

export function buildingBestNearLine(building: any) {
  const id = String(building?.id || "");
  return BUILDING_POLISH[id]?.bestNear || "Near related buildings and resource routes.";
}

export function captureLimitLine(player: any) {
  const territory = Math.max(0, Number(player?.territory || 0));
  const cap = Math.max(0, Number(player?.tileCap || 0));
  const rep = Math.floor(Number(player?.reputation?.score ?? player?.rep ?? 0) || 0);
  if (!cap) return `Reputation ${rep} · tile limit loading`;
  const left = Math.max(0, cap - territory);
  return `Reputation ${rep} allows ${cap} captured tiles · ${left} left`;
}

export function firstStepsGuideRows(player: any = {}) {
  const territory = Math.max(0, Number(player?.territory || 0));
  const inv = player?.inv || {};
  const hasGathered = Number(inv.w || 0) > 0 || Number(inv.s || 0) > 0 || Number(inv.f || 0) > 0;
  const buildKinds = new Set(player?.buildKinds || []);
  return [
    {
      id: "first-capture-1",
      category: "actions",
      glyph: "▦",
      title: "Capture your first tile",
      text: "Use Capture on a free tile. The first tile can be anywhere outside protected capital space.",
      detail: captureLimitLine(player),
      rewardText: "Unlocks building space",
      done: territory >= 1,
      claimed: false,
    },
    {
      id: "first-capture-3",
      category: "actions",
      glyph: "▦",
      title: "Capture 3 tiles before building",
      text: "Your first clear goal is three owned tiles. That gives enough room to place a starter building and understand borders.",
      detail: `${Math.min(territory, 3)}/3 captured · ${captureLimitLine(player)}`,
      rewardText: "Starter settlement ready",
      done: territory >= 3,
      claimed: false,
    },
    {
      id: "first-gather",
      category: "actions",
      glyph: "🪓",
      title: "Gather visible resources",
      text: "Chop trees, mine rocks, and gather crops. Numbers should increase immediately in the resource HUD.",
      detail: `Storage is shared: wood + stone + planks + food. Current materials: ${Math.floor(Number(inv.w || 0))} wood, ${Math.floor(Number(inv.s || 0))} stone, ${Math.floor(Number(inv.f || 0))} food.`,
      rewardText: "Build materials",
      done: hasGathered,
      claimed: false,
    },
    {
      id: "first-house",
      category: "buildings",
      glyph: "🏠",
      title: "Build a House",
      text: BUILDING_POLISH.cottage.purpose,
      detail: "Select Hammer, click an empty captured tile, then choose House. Houses make settlement purpose obvious and support future economy systems.",
      rewardText: "Settlement core",
      done: buildKinds.has("cottage"),
      claimed: false,
    },
    {
      id: "first-storage",
      category: "economy",
      glyph: "▤",
      title: "Understand shared storage",
      text: "Wood, stone, planks, and food share one material storage limit. Coins do not use this limit.",
      detail: "Build Warehouses when you run out of space. The HUD shows used / limit and how much room is free.",
      rewardText: "Fewer confusing caps",
      done: buildKinds.has("warehouse"),
      claimed: false,
    },
  ];
}
