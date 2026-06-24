/* ============================================================
   SOLCRAFT economy config — single source of truth.

   Keep this file DB-free and DOM-free. It is imported by shared.ts and can
   later be overlaid by admin economy settings. For alpha, code should read
   values through this config instead of duplicating constants across shared,
   cleanEconomy, ECS systems, or UI models.
   ============================================================ */

export const SOLCRAFT_ECONOMY = {
  version: "economy-rules-alignment-rc1",

  resources: {
    sharedMaterialKeys: ["w", "s", "f"] as const,
    materialBaseCap: 120,
    warehouseMaterialCapBonus: 600,
    townHallStorageBonus: 300,
    coinsUnlimited: true,
  },

  progression: {
    tutorialClaimTiles: 3,
    firstMinuteBuilding: "cottage",
    starterBuildKinds: ["cottage", "lumber", "quarry", "farm", "warehouse"] as const,
    houseIsTravelPoint: true,
  },

  tiles: {
    claimCost: {} as const,
    requiresConnectedTiles: false,
    capacitySource: "craftsHolding" as const,
    baseTileCapacity: 6,
    craftsPerExtraTile: 1000,
    maxTileCapacity: 900,
  },

  resourceNodes: {
    naturalNodesRegenerate: false,
    lumberCampSpawnsWood: true,
    quarrySpawnsStone: true,
    farmSpawnsFood: true,
    campSpawnRadius: 6,
  },

  worldWonder: {
    cost: { w: 300, s: 220 } as const,
    consumesCoins: false,
    requiresPersonalTile: false,
    globalCoinProductionBonusPct: 3,
    maxGlobalCoinProductionBonusPct: 30,
    minDistanceFromOtherWonders: 9,
  },

  economyRules: {
    // Energy: concave, capped, floored. Movement has a tiny cost to stop spam,
    // but recovers quickly enough for new players to build a House in minute 1.
    energyCap: 100,
    energyBaseNoHolderPerMinute: 40,
    energyBaseHolderPerMinute: 40,
    energyMaxHolderPerMinute: 120,
    energyRegenBasePerMinute: 80,
    energyRegenBonusPerMinute: 80,
    energyRegenHardCapPerMinute: 300,
    energyRefHold: 100_000,
    energyMaxBase: 100,
    energyMaxBonus: 100,
    minCraftsForHolderEnergy: 0,
    minCraftsForRewards: 100,
    energyBalanceCap: 100_000,
    activeWindowMs: 10 * 60 * 1000,

    rewardCycleMs: 5 * 60 * 1000,
    leaderboardWinnerCount: 20,
    leaderboardRankPower: 0.80,
    goldCyclePool: 1000,
    rewardPoolShare: 0.80,
    reservePoolShare: 0.20,
    goldPerCrafts: 1000,
    withdrawGoldPerCrafts: 0,
    redeemMinGold: 100,
    redeemCapGoldPerWalletCycle: 1000,
    leaderboardTopShare: 0.25,
    leaderboardMinWinners: 5,
    leaderboardMaxWinners: 20,
    leaderboardWeightPower: 0.70,
    buildingScoreTiles: 9,

    // Tile capture is free. Capacity comes from the $CRAFTS holder profile.
    tileBaseCapacity: 6,
    tileCapacityPerBuilding: 0,
    tileDecayPerCycle: 0,
    claimEnergy: 0,
    claimWood: 0,
    claimStone: 0,

    moveEnergy: 1,
    chopEnergy: 5,
    mineEnergy: 5,
    attackEnergy: 6,
    destroyBombEnergy: 10,
    teleportEnergy: 0,
    raidEnergy: 6,
    repairEnergy: 0,

    chopMs: 4000,
    mineMs: 5000,
    teleportMs: 8000,
    withdrawMs: 12000,
    treeWood: 3,
    rockStone: 3,

    destroyMaxActive: 3,
    respawnMs: 10000,
    spawnProtectionMs: 6000,
    deathWoodDropPct: 0.20,
    deathStoneDropPct: 0.20,
    deathGoldDropPct: 0.30,
    deathGoldDropCap: 50,
    deathGoldBurnPct: 0.10,
  } as const,

  buildCosts: {
    road: { w: 1 },
    cottage: { w: 6 },
    lumber: { w: 12 },
    quarry: { w: 12, s: 4 },
    farm: { w: 14 },
    warehouse: { w: 30, s: 12 },
    worldwonder: { w: 300, s: 220 },
  } as const,

  money: {
    // SOL deposits buy gameplay coins. Withdrawals are principal-bounded:
    // gameplay faucets never increase the amount of SOL a player can withdraw
    // transfers are enabled by the operator.
    gameplayCoinsWithdrawableToSol: true,
    solDepositsBuyGameplayCoins: true,
    defaultCoinsPerSol: 1000,
    minWithdrawCoins: 10,

    // $CRAFTS is not deposited into the game. It stays in the connected wallet
    // and is read externally for buffs such as reputation/tile-cap bonuses.
    craftsHeldInWalletForBuffs: true,
    craftsDepositsDisabled: true,
    ledgerRawUnits: true,
    runtimeAdminEditable: true,
  } as const,
};

export type SolcraftEconomyConfig = typeof SOLCRAFT_ECONOMY;
export const ECONOMY_RULES_SINGLE_SOURCE = SOLCRAFT_ECONOMY.economyRules;
export const CLEAN_BUILD_COSTS_SINGLE_SOURCE = SOLCRAFT_ECONOMY.buildCosts;


export const META_ECONOMY_SETTINGS = "solcraft:economy:settings:v1";
export function defaultRuntimeEconomySettings() {
  return JSON.parse(JSON.stringify(SOLCRAFT_ECONOMY));
}
