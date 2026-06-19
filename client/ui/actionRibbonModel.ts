export type InventoryLike = Record<string, number> | undefined | null;
export type PlayerLike = { inv?: InventoryLike; pack?: any[]; territory?: number } | undefined | null;
export type CostLike = Record<string, number> | undefined | null;

export function missingCostKeys(cost: CostLike, player: PlayerLike, liveEnergy = 0): string[] {
  const inv = player?.inv || {};
  return Object.entries(cost || {})
    .filter(([res, amount]) => (res === "e" ? liveEnergy : Number((inv as any)[res] || 0)) < Number(amount || 0))
    .map(([res]) => res);
}

export function isBuildChoiceLocked(building: any, player: PlayerLike): boolean {
  return Number(player?.territory || 0) < Number(building?.unlock || 0);
}

export function buildChoiceState(building: any, player: PlayerLike, liveEnergy = 0, placing: string | null = null, wonderGoldCost = 0) {
  const locked = isBuildChoiceLocked(building, player);
  const missing = missingCostKeys(building?.cost, player, liveEnergy);
  const needsWonderGold = building?.id === "worldwonder" && Number(player?.inv?.g || 0) < Number(wonderGoldCost || 0);
  return {
    id: String(building?.id || ""),
    active: placing === building?.id,
    locked,
    missing,
    needsWonderGold,
    disabled: locked || missing.length > 0 || needsWonderGold,
  };
}

export function usablePackItems(player: PlayerLike): Array<{ item: any; index: number }> {
  return (player?.pack || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item && item.t === "use");
}

export function craftedToolOwnedCount(pack: any[] | undefined | null, toolId: string): number {
  return (pack || []).filter((item) => item && item.t === "bomb" && item.id === toolId).length;
}
