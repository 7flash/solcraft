import { LIBRARY } from "./shared";

/**
 * Major-release gameplay contract.
 *
 * This file is intentionally small and boring: it is the single list of things
 * the clean ECS release exposes to players. Legacy code may still exist during
 * deletion, but new backend/client paths should use this surface instead of
 * rediscovering old feature flags.
 */
export const CLEAN_BUILDING_IDS = [
  "cottage",      // House: first settlement anchor and travel point
  "lumber",       // spawns trees nearby; no passive credit
  "quarry",       // spawns rocks nearby; no passive credit
  "farm",         // spawns crops nearby; crops must be harvested
  "warehouse",    // the only normal storage-cap building
  "worldwonder",  // coin sink, reputation landmark, prestige teleport
] as const;

export type CleanBuildingId = (typeof CLEAN_BUILDING_IDS)[number];

export const REMOVED_BUILDING_IDS = [
  "foundation",
  "road",
  "shrine",
  "goldmine",
  "barbcamp",
  "bomb",
  "workshop",
  "academy",
  "forge",
  "watchtower",
  "keep", // spawned automatically by world rules, not player-built
] as const;

const CLEAN_BUILDING_SET = new Set<string>(CLEAN_BUILDING_IDS as readonly string[]);
const REMOVED_BUILDING_SET = new Set<string>(REMOVED_BUILDING_IDS as readonly string[]);

export function isCleanBuildKind(kind: any): kind is CleanBuildingId {
  return CLEAN_BUILDING_SET.has(String(kind || ""));
}

export function isRemovedBuildKind(kind: any) {
  return REMOVED_BUILDING_SET.has(String(kind || ""));
}

export function cleanBuildKindResponse(kind: any) {
  const k = String(kind || "");
  if (isCleanBuildKind(k)) return null;
  return {
    ok: false,
    reasonCode: "BUILDING_REMOVED",
    msg: isRemovedBuildKind(k)
      ? "That building was removed from the clean release. Use House, Lumber Camp, Quarry, Farm, Warehouse, or World Wonder."
      : "That building is not part of the clean release build list.",
    kind: k,
  };
}

export function cleanBuildCatalog() {
  const byId = new Map((LIBRARY as any[]).map((b) => [String(b.id), b]));
  return CLEAN_BUILDING_IDS.map((id) => byId.get(id)).filter(Boolean);
}

export const CLEAN_ACTION_SURFACE = [
  "move", "movePath", "claim",
  "harvestStart", "harvestFinish", "harvestCancel", "pickup",
  "place", "upgrade", "repair", "demolish", "customize", "use",
  "talkNpc", "attackNpc", "donateNpc", "donateKeep", "raid", "attack", "fight",
  "home", "homeStart", "homeFinish", "homeCancel",
  "houseStart", "houseFinish", "houseCancel",
  "wonderStart", "wonderFinish", "wonderCancel", "placeWonder",
  "profileAppearance", "profileFace", "setupProfile", "customizerAccess", "wallet", "chat",
] as const;

export function cleanActionSurface() {
  return [...CLEAN_ACTION_SURFACE].sort();
}

export function cleanReleaseSummary() {
  return {
    version: "stage29-40-rc",
    buildings: cleanBuildCatalog().map((b: any) => ({ id: b.id, name: b.name || b.label || b.id })),
    actions: cleanActionSurface(),
    removedBuildings: [...REMOVED_BUILDING_IDS],
  };
}