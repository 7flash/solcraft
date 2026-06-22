import { cleanActionSurface } from "./cleanRelease";
export const REMOVED_FEATURES: Record<string, { feature: string; replacement: string; msg: string }> = {
  makeBomb: { feature: "bombs", replacement: "attack / raid", msg: "Bombs were removed for the clean ECS release. Use the Sword to attack Keeps and structures." },
  spawnBomb: { feature: "bombs", replacement: "attack / raid", msg: "Bomb deployment was removed. Combat is now direct attacks and Keep raids." },
  placeBomb: { feature: "bombs", replacement: "attack / raid", msg: "Bomb placement was removed. Combat is now direct attacks and Keep raids." },
  siegeSource: { feature: "old gold sources", replacement: "Keeps and NPC coin bags", msg: "Gold Sources/Ruins were removed to protect the economy." },
  siege: { feature: "legacy siege", replacement: "raid", msg: "Legacy siege was removed. Use raid/attack against Keeps and buildings." },
  collectGoldMine: { feature: "gold mines", replacement: "Keeps, NPCs, bank", msg: "Gold mines/sources were removed to prevent inflation." },
  craft: { feature: "old crafting", replacement: "buildings and future ECS recipes", msg: "Crafting is disabled for this release while recipes are redesigned." },
  usePack: { feature: "packs", replacement: "future inventory", msg: "Packs are disabled for this release." },
  equip: { feature: "equipment", replacement: "future stats/equipment", msg: "Equipment is disabled for this release." },
  unequip: { feature: "equipment", replacement: "future stats/equipment", msg: "Equipment is disabled for this release." },
  drop: { feature: "equipment", replacement: "future inventory", msg: "Item dropping is disabled for this release." },
  trade: { feature: "legacy trading", replacement: "future market buildings", msg: "Legacy trading is disabled for this release." },
  postOffer: { feature: "player escrow market", replacement: "future market buildings", msg: "Player escrow offers were removed from the release build." },
  acceptOffer: { feature: "player escrow market", replacement: "future market buildings", msg: "Player escrow offers were removed from the release build." },
  cancelOffer: { feature: "player escrow market", replacement: "future market buildings", msg: "Player escrow offers were removed from the release build." },
  withdrawGold: { feature: "old redeem flow", replacement: "bank building / bank API", msg: "Old action-based redemption was removed. Use bank deposit/withdraw flows." },
  redeem: { feature: "old redeem flow", replacement: "bank building / bank API", msg: "Old action-based redemption was removed. Use bank deposit/withdraw flows." },
  redeemStart: { feature: "old redeem flow", replacement: "bank building / bank API", msg: "Old action-based redemption was removed. Use bank deposit/withdraw flows." },
  redeemFinish: { feature: "old redeem flow", replacement: "bank building / bank API", msg: "Old action-based redemption was removed. Use bank deposit/withdraw flows." },
  redeemCancel: { feature: "old redeem flow", replacement: "bank building / bank API", msg: "Old action-based redemption was removed. Use bank deposit/withdraw flows." },
  completeFoundation: { feature: "foundations", replacement: "direct building construction", msg: "Foundations were removed. Select Hammer, choose your owned tile, then pick a building." },
  learn: { feature: "skills", replacement: "future skill release", msg: "Skills are disabled for this release." },
  claimGuideReward: { feature: "guide rewards", replacement: "future achievements", msg: "Guide rewards are disabled while achievements are redesigned." },
  guideVisit: { feature: "guide tracking", replacement: "tutorial/help only", msg: "Guide progression is disabled for this release." },
  adminMapTeleport: { feature: "public admin actions", replacement: "admin panel", msg: "Admin commands are only available from the admin panel." },
  adminDemolishAt: { feature: "public admin actions", replacement: "admin panel", msg: "Admin commands are only available from the admin panel." },
  adminSpawnKeep: { feature: "public admin actions", replacement: "automatic Keeps", msg: "Keeps spawn automatically; admin spawning moved to admin tools." },
};

export function removedFeatureForAction(type: any) {
  return REMOVED_FEATURES[String(type || "")] || null;
}

export function removedFeatureResponse(type: any) {
  const r = removedFeatureForAction(type);
  if (!r) return null;
  return { ok: false, reasonCode: "FEATURE_REMOVED", msg: r.msg, feature: r.feature, replacement: r.replacement, type: String(type || "") };
}

export function activeActionSurface() {
  return cleanActionSurface();
}
