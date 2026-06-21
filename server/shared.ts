/* ============================================================
   SOLCRAFT shared definitions — NO THREE, NO DOM, NO DB.
   Imported by both the server engine and the client renderer
   so costs / production rates / interactions can never drift.
   ============================================================ */

import { capitalBlocksNaturalResource, keepCrossIndexAt, keepCrossPositionsInBox, settlementSpawnPoint, SETTLEMENT_SPAWN_STEP as CAPITAL_SETTLEMENT_SPAWN_STEP } from "./capitalRules";

export const ECONOMY_RULES = {
  // Energy: concave, capped, floored. Movement has a tiny cost to stop spam, but recovers quickly.
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

  // Reward cycles: gold is an in-game ticket; $CRAFTS settlement floats pro-rata against real fee pool.
  rewardCycleMs: 5 * 60 * 1000,
  leaderboardWinnerCount: 20,
  leaderboardRankPower: 0.80,
  goldCyclePool: 1000,
  rewardPoolShare: 0.80,
  reservePoolShare: 0.20,
  goldPerCrafts: 1000, // indicative only; settlement rate floats at redemption cycle close
  withdrawGoldPerCrafts: 0, // deprecated fixed price, kept for old callers
  redeemMinGold: 100,
  redeemCapGoldPerWalletCycle: 1000,
  leaderboardTopShare: 0.25,
  leaderboardMinWinners: 5,
  leaderboardMaxWinners: 20,
  leaderboardWeightPower: 0.70,
  buildingScoreTiles: 9,

  tileBaseCapacity: 18,
  tileCapacityPerBuilding: 0,
  tileDecayPerCycle: 6,

  moveEnergy: 1,
  chopEnergy: 5,
  mineEnergy: 5,
  claimEnergy: 0,
  claimWood: 0,
  claimStone: 2,
  attackEnergy: 6, // legacy; direct attacks are disabled, siege uses raidEnergy
  destroyBombEnergy: 10,
  teleportEnergy: 0, // infinite Return Scroll; cast delay still applies
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
} as const;

export const holdWeight = (hold: number) => Math.max(0, Math.min(1, Math.sqrt(Math.min(Math.max(0, hold || 0), ECONOMY_RULES.energyBalanceCap) / ECONOMY_RULES.energyRefHold)));
export const tokenRegenPerMin = (hold: number) => ECONOMY_RULES.energyRegenBasePerMinute + ECONOMY_RULES.energyRegenBonusPerMinute * holdWeight(hold);
export const tokenMaxEnergy = (hold: number) => Math.round(ECONOMY_RULES.energyMaxBase + ECONOMY_RULES.energyMaxBonus * holdWeight(hold));
export const rewardWeight = (rank: number) => 1 / Math.pow(Math.max(1, rank), ECONOMY_RULES.leaderboardRankPower);
export const maxTilesFor = (buildings: number) => Math.round(ECONOMY_RULES.tileBaseCapacity + ECONOMY_RULES.tileCapacityPerBuilding * Math.max(0, Number(buildings) || 0));


export const CLAIM_COST = ECONOMY_RULES.claimEnergy;
export const TILE_CAPTURE_COST = ECONOMY_RULES.claimEnergy;
export const MOVE_COST = ECONOMY_RULES.moveEnergy;
export const BASE_REGEN = ECONOMY_RULES.energyRegenBasePerMinute / 60; // fallback energy per second
export const BASE_MAX = ECONOMY_RULES.energyCap;
export const MAX_HP = 100;
export const PACK_SIZE = 24;
export const ACC_CAP = 60; // max stockpile inside one producer
export const SPAWN_HALF = 1; // every new player gets a 3x3 starter plot (inclusive radius)
export const FIGHT_COST = ECONOMY_RULES.attackEnergy; // legacy action cost, direct fighting is disabled
export const RAID_COST = ECONOMY_RULES.raidEnergy;
export const RAID_DMG = 20; // legacy alias; siege uses the constants below
export const SIEGE_BUILDING_DMG = 1;
export const SIEGE_TOOL_DMG = 80;
export const STRONGBOX_CAP = 1000;
export const VAULT_CAP = 5000;
export const RESOURCE_BASE_CAP = 120;
export const WAREHOUSE_RESOURCE_CAP_BONUS = 600;
export const GRANARY_FOOD_CAP_BONUS = 300;
export const TOWNHALL_STORAGE_BONUS = 300;
export const TOWNHALL_TILE_CAP_BONUS = 90;
export const BARRACKS_TOWER_RANGE_BONUS = 1;
export const BARRACKS_TOWER_DPS_BONUS = 0.25;
export const BARRACKS_TOOL_DAMAGE_CUT_BONUS = 0.15;
export const VAULT_LOOT_SHARE = 0.40;
export const VAULT_BURN_SHARE = 0.20;
export const TOWER_BOMB_DPS = 8;
export const TOWER_BOMB_DMG_CUT = 0.50;
export const BOMB_FUSE_MS = 20000; // default destroy-tool fuse
export const BOMB_ARM_COST = 0;
export const SCIENCE_BASE_CAP = 20;
export const SCIENCE_CAP_PER_ACADEMY = 80;
export const ACADEMY_SCIENCE_RATE = 0.025; // points / second at level 1
export const BOMB_ITEM_COST = { sc: 2 } as const;
export const WORLD_WONDER_GOLD_COST = 250;
export const WORLD_WONDER_PROMPT_MAX = 180;
export const WORLD_WONDER_MAX_PARTS = 144;
export const WORLD_WONDER_SCHEMA_VERSION = 1;
export const WORLD_WONDER_PLAZA_RADIUS = 4;
export const WORLD_WONDER_PLAZA_SIZE = WORLD_WONDER_PLAZA_RADIUS * 2 + 1;
export const WORLD_WONDER_PLAZA_TILES = WORLD_WONDER_PLAZA_SIZE * WORLD_WONDER_PLAZA_SIZE;
export const WORLD_WONDER_BUILD_MS = 45_000;
export const WORLD_WONDER_CLIENT_VERSION = "wonder-district-roads-v1";
export const NORMAL_BUILDING_BUILD_MS = 18_000;
export const DECOR_BUILDING_BUILD_MS = 10_000;
export const DESTROY_TOOLS = [
  { id: "spark", name: "Spark", glyph: "•", cost: { sc: 1 }, fuseMs: 8000, radius: 0, hp: 70, buildingDmg: 15, target: "tile", blurb: "Cheap 8s science deployable. Clears only its own tile and scratches buildings." },
  { id: "snare", name: "Snare Charge", glyph: "◇", cost: { sc: 1 }, fuseMs: 9000, radius: 0, hp: 100, buildingDmg: 5, target: "tile/player route", blurb: "Fast nuisance deployable. Science-only craft; threatens routes without heavy structure damage." },
  { id: "popper", name: "Popper", glyph: "●", cost: BOMB_ITEM_COST, fuseMs: 10000, radius: 1, hp: 150, buildingDmg: 35, target: "tiles", blurb: "Classic 10s pressure. Science-only craft that clears a 3×3 ownership patch and dents buildings." },
  { id: "thumper", name: "Thumper", glyph: "⬤", cost: { sc: 4 }, fuseMs: 14000, radius: 1, hp: 300, buildingDmg: 80, target: "buildings", blurb: "Slow chunky deployable with more HP. Science-only craft for defended border structures." },
  { id: "cutter", name: "Line Cutter", glyph: "✦", cost: { sc: 5 }, fuseMs: 15000, radius: 1, hp: 220, buildingDmg: 45, target: "territory lines", blurb: "Science-only line breaker for long territory routes and disconnected recapture chances." },
  { id: "sapper", name: "Sapper Cart", glyph: "▣", cost: { sc: 7 }, fuseMs: 16000, radius: 1, hp: 260, buildingDmg: 180, target: "nearby building", blurb: "Focused science siege tool. Small blast ring, high damage to adjacent buildings." },
  { id: "breacher", name: "Breacher", glyph: "✷", cost: { sc: 10 }, fuseMs: 18000, radius: 2, hp: 380, buildingDmg: 130, target: "tiles/buildings", blurb: "Expensive science charge for Keep fights. Clears a wide claim ring and mauls structures." },
  { id: "quake", name: "Quake Engine", glyph: "✹", cost: { sc: 18 }, fuseMs: 26000, radius: 2, hp: 520, buildingDmg: 260, target: "city core", blurb: "Late-game science siege engine for heavy buildings and Wonders. Slow, loud, and visible." },
] as const;
export type DestroyToolId = typeof DESTROY_TOOLS[number]["id"];
export const DESTROY_BY_ID = Object.fromEntries(DESTROY_TOOLS.map((b) => [b.id, b])) as Record<string, typeof DESTROY_TOOLS[number]>;

// Legacy source identifiers are kept only so old saves/admin tools do not crash.
// Runtime coins now come from territory coin pickups, not scarce ruin/source fixtures.
export const GOLD_SOURCE_KIND = "goldsource";
export const GOLD_MINE_KIND = "goldmine";
export const BARB_CAMP_KIND = "barbcamp";
export const GOLD_SOURCE_RADIUS = 2;
export const GOLD_SOURCE_MIN = 0;
export const GOLD_SOURCE_MAX = 0;
export const GOLD_SOURCE_PLAYERS_PER = 999999;
export const GOLD_COIN_BASE_INTERVAL_MS = 5000;
export const GOLD_COIN_SOLO_INTERVAL_MS = 12000;
export const GOLD_COIN_LOWPOP_INTERVAL_MS = 8000;
export const GOLD_COIN_TAX_PCT = 0.20;
export const GOLD_COIN_MAX_WORLD = 80;
export const GOLD_COIN_TERRITORY_DIVISOR = 10;
export const GOLD_CYCLE_BASE = 500;
export const GOLD_CYCLE_PER_ACTIVE = 7;
export const GOLD_MINE_STORAGE_CAP = 2000;
export const GOLD_MINE_BASE_HP = 500;
export const GOLD_MINE_BASE_COST = { w: 80, s: 60 } as const;
export const GOLD_SOURCE_CAMP_HP = 0;
export const GOLD_PER_CRAFTS_FIXED = 1000;
export const CRAFTS_PER_GOLD_FIXED = 1 / GOLD_PER_CRAFTS_FIXED;
export function desiredGoldSourceCount(activePlayers: number) {
  return Math.max(GOLD_SOURCE_MIN, Math.min(GOLD_SOURCE_MAX, 2 + Math.ceil(Math.max(0, activePlayers || 0) / GOLD_SOURCE_PLAYERS_PER)));
}
export function goldCycleBudget(activePlayers: number) {
  return Math.max(GOLD_CYCLE_BASE, GOLD_CYCLE_BASE + Math.max(0, activePlayers || 0) * GOLD_CYCLE_PER_ACTIVE);
}
export const TELEPORT_MS = ECONOMY_RULES.teleportMs;
export const TELEPORT_COST = ECONOMY_RULES.teleportEnergy;
export const TOWER_RADIUS = 2.5;
export const TOWER_DMG_CUT = 0.5; // watchtower halves incoming raid damage
export const VIEW_RADIUS = 18; // server sends entities within this Chebyshev range of the view anchor
export const ANCHOR_STEP = 6;  // snapshot view anchor quantization — world payload only changes
export const ANCHOR_PAD = ANCHOR_STEP + 2; // when the anchor moves or worldRev bumps
export const MAX_LEVEL = 5;
export const REPAIR_COST_E = ECONOMY_RULES.repairEnergy;
export const REDEEM_MIN_GOLD = ECONOMY_RULES.redeemMinGold; // minimum purse coins redemption ticket
export const ENERGY_POOL_PER_PLAYER = ECONOMY_RULES.energyCap;
export const BUILDING_REWARD_MS = ECONOMY_RULES.rewardCycleMs;
export const BUILDING_REWARD_POOL = 0; // superseded by fee-backed reward pool in engine

export type ResKey = "w" | "p" | "s" | "f" | "g" | "sh" | "sc";
export const RES_KEYS: ResKey[] = ["w", "p", "s", "f", "g", "sh", "sc"];
export const COSTI: Record<string, string> = { e: "⚡", w: "🪵", p: "📦", s: "🪨", f: "🌾", g: "🪙", sh: "◈", sc: "🔬" };
export const RES_NAMES: Record<ResKey, string> = { w: "🪵 wood", p: "📦 planks", s: "🪨 stone", f: "🌾 food", g: "🪙 coins", sh: "◈ shards", sc: "🔬 science" };

export type Inv = Record<ResKey, number>;
export const START_INV: Inv = { w: 60, p: 0, s: 40, f: 0, g: 0, sh: 0, sc: 0 };
export const emptyInv = (): Inv => ({ w: 0, p: 0, s: 0, f: 0, g: 0, sh: 0, sc: 0 });

/* ---------- gear ---------- */
export type Slot = "hat" | "cape" | "armor" | "hand" | "boots";
export const SLOTS: Slot[] = ["hat", "cape", "armor", "hand", "boots"];
export const SLOT_LABEL: Record<Slot, string> = { hat: "Helmet", cape: "Cape", armor: "Armor", hand: "Hand", boots: "Boots" };

export interface GearDef { id: string; slot: Slot; name: string; glyph: string; atk?: number; def?: number; spd?: number; color?: number; } // atk is siege power, not player damage
export const GEAR: GearDef[] = [
  { id: "straw", slot: "hat", name: "Field Cap", glyph: "🧢", def: 1 },
  { id: "crown", slot: "hat", name: "Sun Crown", glyph: "👑", def: 1 },
  { id: "mage", slot: "hat", name: "Mage Hat", glyph: "🎩", atk: 1 },
  { id: "hood", slot: "hat", name: "Ranger Hood", glyph: "🧢", def: 1 },
  { id: "miner", slot: "hat", name: "Miner Helm", glyph: "⛑", def: 1 },
  { id: "cape_r", slot: "cape", name: "Crimson Cape", glyph: "🟥", color: 0xd64545, def: 1 },
  { id: "cape_t", slot: "cape", name: "Tide Cape", glyph: "🟩", color: 0x14b58c, def: 1 },
  { id: "cape_v", slot: "cape", name: "Void Cape", glyph: "🟪", color: 0x8a5fe8, def: 1 },
  { id: "cape_g", slot: "cape", name: "Dawn Cape", glyph: "🟨", color: 0xe0b54a, def: 1 },
  { id: "pads", slot: "armor", name: "Leather Pads", glyph: "🟤", def: 2 },
  { id: "plate", slot: "armor", name: "Shard Plate", glyph: "🛡", def: 4 },
  { id: "lantern", slot: "hand", name: "Lantern", glyph: "🏮" },
  { id: "staff", slot: "hand", name: "Shard Staff", glyph: "🪄", atk: 2 },
  { id: "sword", slot: "hand", name: "Sol Sword", glyph: "🗡", atk: 3 },
  { id: "shield", slot: "hand", name: "Oak Shield", glyph: "🛡️", def: 2 },
  { id: "swift", slot: "boots", name: "Swift Boots", glyph: "👟", spd: 1 },
  { id: "trek", slot: "boots", name: "Trek Boots", glyph: "🥾", def: 1 },
];
export const GEAR_BY_ID: Record<string, GearDef> = Object.fromEntries(GEAR.map((g) => [g.id, g]));
export type Equip = Partial<Record<Slot, string | null>>;
export const gearStat = (equip: Equip, k: "atk" | "def" | "spd") =>
  SLOTS.reduce((a, s) => a + ((equip[s] && (GEAR_BY_ID[equip[s] as string] as any)?.[k]) || 0), 0);

export const USE_ITEMS = {
  focus_elixir: { id: "focus_elixir", name: "Focus Elixir", glyph: "🧪", blurb: "Use with 7 / backpack to restore 18 energy during a siege or mint push.", out: { e: 18 } },
  ward_elixir: { id: "ward_elixir", name: "Ward Elixir", glyph: "🛡️", blurb: "Use with 7 / backpack to restore health before defending territory or a mint.", heal: 16 },
} as const;
export type UseItemId = keyof typeof USE_ITEMS;
export type PackItem = { t: "gear"; id: string } | { t: "relic"; n: string } | { t: "bomb"; id: DestroyToolId } | { t: "use"; id: UseItemId } | null;
export const RELICS = ["Ancient Coin", "Sun Idol", "Glass Compass", "Drowned Crown", "Saltglass Lens", "Ledger Fragment"];

/* ---------- buildings (economy side only) ----------
   `use`  — what pressing the Use action beside it does
   `prod` — passive accumulation, collected with Use
   All buildings occupy exactly ONE cell in the minimal MMO-bar build. */
export interface UseDef { k: "rest" | "energy" | "heal" | "convert" | "craft" | "trade" | "bomb"; amt?: number; cd?: number; inp?: Partial<Record<ResKey, number>>; out?: Partial<Record<ResKey | "e", number>>; e?: number; label: string; }
export interface BuildingDef {
  id: string; name: string; glyph: string; baseC: number; blurb: string;
  cost: Partial<Record<ResKey | "e", number>>;
  regen: number; maxE?: number; unlock: number;
  hp?: number;            // base structure HP (default 12)
  prod?: Partial<Record<ResKey, number>>;
  use?: UseDef;
  protect?: number;
  decor?: boolean;
  weapon?: boolean;
  storage?: boolean;
  storageBonus?: number;
  foodStorageBonus?: number;
  tileCapBonus?: number;
  defenseBonus?: boolean;
  passableOwner?: boolean;
  blocksMovement?: boolean;
  effect?: string;
}
export const LIBRARY: BuildingDef[] = [
  { id: "road", name: "Road", glyph: "═", baseC: 0xc49a5a, cost: { w: 1 }, regen: 0, unlock: 0, hp: 9999, decor: true, passableOwner: true, blocksMovement: false,
    blurb: "Legacy path tile. New settlements use open terrain instead of roads.", effect: "Legacy only." },
  { id: "foundation", name: "Foundation", glyph: "▱", baseC: 0xd9c28a, cost: { w: 4, s: 1 }, regen: 0, unlock: 0, hp: 80,
    blurb: "A prepared building pad. Inspect it, then choose the final structure for this spot.", effect: "Choose House, Lumber Camp, Mine, Farm, or Market from its panel." },
  { id: "cottage", name: "House", glyph: "⌂", baseC: 0xf6e7c8, cost: { w: 16, s: 6 }, regen: 0.06, maxE: 5, unlock: 0,
    use: { k: "rest", cd: 20, label: "Rest — restore ♥" }, blurb: "A simple home that expands your settlement and gives settlers a place to recover.", effect: "Restores HP when used nearby." },
  { id: "well", name: "Stone Well", glyph: "◍", baseC: 0xa8aeb4, cost: { w: 12, s: 4 }, regen: 0.1, unlock: 0,
    use: { k: "energy", amt: 10, cd: 20, label: "Draw water +10⚡" }, blurb: "Cool water. Drink for a burst of energy.", effect: "Use for a burst of energy." },
  { id: "farm", name: "Farm Plot", glyph: "🌾", baseC: 0x86c95e, cost: { w: 16, s: 6 }, regen: 0.12, unlock: 0,
    prod: { f: 0.08 }, blurb: "Grows food over time — harvest it with E.", effect: "Produces food every cycle." },
  { id: "lumber", name: "Lumber Camp", glyph: "🪓", baseC: 0xb0793f, cost: { w: 16, s: 6 }, regen: 0.08, unlock: 0,
    prod: { w: 0.06 }, blurb: "Workers replant useful trees around the camp every cycle. Upgrades improve wood yield from every tree on your owned territory.", effect: "Spawns trees; upgrades increase owned-territory tree wood." },
  { id: "quarry", name: "Mine", glyph: "⛏", baseC: 0x8d897f, cost: { w: 6, s: 2 }, regen: 0.06, unlock: 0,
    prod: { s: 0.05 }, blurb: "Opens fresh stone around the mine every cycle. Upgrades improve stone yield from rocks on your territory.", effect: "Spawns rocks; upgrades increase owned-territory rock stone." },
  { id: "sawmill", name: "Sawmill", glyph: "🪚", baseC: 0xc97a3d, cost: { w: 12, s: 4 }, regen: 0.08, unlock: 0,
    use: { k: "convert", inp: { w: 4 }, out: { p: 1 }, e: 1, label: "Saw 4🪵 → 1📦" }, blurb: "Turns raw wood into planks for crafting and city upgrades.", effect: "Converts wood into planks." },
  { id: "market", name: "Market", glyph: "᯼", baseC: 0xe8b94e, cost: { w: 24, s: 12 }, regen: 0.2, unlock: 0,
    use: { k: "trade", label: "Trade goods" }, blurb: "Player offer board and fixed-rate $CRAFTS mint access when near a Coin Mint.", effect: "Opens trade, bank, and offers." },
  { id: "vault", name: "Vault", glyph: "🏦", baseC: 0xd0b15c, cost: { w: 90, s: 90 }, regen: 0, unlock: 0, hp: 300, storage: true,
    blurb: "Stores raidable coins beyond your safe strongbox. High-value storage with real raid risk.", effect: "Raidable coin storage." },
  { id: "forge", name: "Forge", glyph: "🔥", baseC: 0x4a4f5a, cost: { s: 12, p: 4, g: 10 }, regen: 0.08, unlock: 30, hp: 18,
    use: { k: "craft", inp: { p: 4, s: 4, g: 15 }, label: "Forge gear 4📦 4🪨 15🪙" }, blurb: "Unlocks advanced crafted tools and gear near the forge.", effect: "Required for advanced crafting." },
  { id: "tavern", name: "Tavern", glyph: "🍺", baseC: 0xf0e2c2, cost: { w: 10, p: 2 }, regen: 0.2, maxE: 5, unlock: 0,
    use: { k: "heal", inp: { g: 5 }, label: "Hot meal 5🪙 → full ♥" }, blurb: "Warm hearth, cold drinks. Buy a meal to heal.", effect: "Spend coins to heal." },
  { id: "shrine", name: "Shrine", glyph: "✦", baseC: 0x8a5fe8, cost: { s: 8, g: 20 }, regen: 0.12, unlock: 0,
    use: { k: "convert", inp: { g: 25 }, out: { sh: 1 }, label: "Offer 25🪙 → 1◈" }, blurb: "Offer coins to the old spirits for rare shards.", effect: "Converts coins into shards." },
  { id: "watchtower", name: "Watchtower", glyph: "𐂃", baseC: 0xc2b29a, cost: { w: 14, s: 10 }, regen: 0.08, maxE: 5, unlock: 0, hp: 20,
    protect: TOWER_RADIUS, blurb: "Counters destroy tools and braces nearby buildings against siege damage.", effect: "Damages enemy destroy tools and reduces nearby structure damage." },
  { id: "granary", name: "Granary", glyph: "◫", baseC: 0xe8c79c, cost: { w: 10, p: 2 }, regen: 0.1, maxE: 15, unlock: 0, foodStorageBonus: GRANARY_FOOD_CAP_BONUS,
    blurb: "Stores food and supplies so farms can keep producing instead of hitting the food cap.", effect: `+${GRANARY_FOOD_CAP_BONUS}🌾 food storage.` },
  { id: "windmill", name: "Windmill", glyph: "𖣘", baseC: 0xf2e6c8, cost: { w: 8, p: 4, s: 2 }, regen: 0.4, unlock: 0,
    blurb: "Marks a powered district for future production bonuses.", effect: "Future production district bonus." },
  { id: "fountain", name: "Fountain", glyph: "❉", baseC: 0xa8aeb4, cost: { s: 8 }, regen: 0.2, unlock: 0,
    use: { k: "energy", amt: 5, cd: 15, label: "Splash +5⚡" }, blurb: "Cool mist refreshes anyone walking past.", effect: "Use for a small energy refresh." },
  { id: "garden", name: "Garden", glyph: "✿", baseC: 0x78c96b, cost: { w: 4, f: 4 }, regen: 0.15, unlock: 0,
    blurb: "Flowers and shade. Mostly decorative city beauty.", effect: "Decorative comfort." },
  { id: "flowerbed", name: "Flower Bed", glyph: "❀", baseC: 0xff8ab3, cost: { w: 2, f: 1 }, regen: 0.01, unlock: 0, decor: true,
    blurb: "A clean color marker for your camp." },
  { id: "waterfall", name: "Waterfall", glyph: "≋", baseC: 0x5ed6ff, cost: { s: 6 }, regen: 0.04, unlock: 0, decor: true,
    blurb: "A little falling water and mist. Peaceful, mostly decorative." },
  { id: "pond", name: "Pond", glyph: "◌", baseC: 0x4fb6d8, cost: { s: 3 }, regen: 0.02, unlock: 0, decor: true,
    blurb: "Still water with soft reflections." },
  { id: "statue", name: "Statue", glyph: "♙", baseC: 0xc8c1b1, cost: { s: 8 }, regen: 0.01, unlock: 0, hp: 16, decor: true,
    blurb: "A quiet monument. Looks important, does almost nothing." },
  { id: "lantern", name: "Lantern", glyph: "✺", baseC: 0xffc857, cost: { w: 2, g: 1 }, regen: 0.01, unlock: 0, decor: true,
    blurb: "Warm night light for paths and plazas." },
  { id: "bench", name: "Bench", glyph: "▱", baseC: 0xb0793f, cost: { w: 4 }, regen: 0.01, unlock: 0, decor: true,
    blurb: "A place to sit. No promises anyone will." },
  { id: "campfire", name: "Campfire", glyph: "♨", baseC: 0xff7a45, cost: { w: 4, s: 1 }, regen: 0.02, unlock: 0, decor: true,
    blurb: "Small flame, good vibes." },
  { id: "arch", name: "Stone Arch", glyph: "∩", baseC: 0xb8b1a0, cost: { s: 6 }, regen: 0.01, unlock: 0, hp: 16, decor: true,
    blurb: "A clean entrance marker for your land." },
  { id: "obelisk", name: "Obelisk", glyph: "♦", baseC: 0x8a5fe8, cost: { s: 10, g: 4 }, regen: 0.02, unlock: 0, hp: 18, decor: true,
    blurb: "Mysterious. Mostly decorative, slightly dramatic." },
  { id: "hedge", name: "Hedge", glyph: "▥", baseC: 0x4f9c54, cost: { w: 2, f: 1 }, regen: 0.01, unlock: 0, decor: true,
    blurb: "A soft green divider." },
  { id: "signpost", name: "Signpost", glyph: "↱", baseC: 0xc08a4b, cost: { w: 3 }, regen: 0.01, unlock: 0, decor: true,
    blurb: "Point people somewhere. Or nowhere." },
  { id: "crystal", name: "Crystal", glyph: "◇", baseC: 0x9a7cff, cost: { s: 4, g: 3 }, regen: 0.03, unlock: 0, hp: 14, decor: true,
    blurb: "A glowing shard for pretty corners." },
  { id: "alchemy", name: "Alchemy Shop", glyph: "⚗", baseC: 0x9a7cff, cost: { w: 58 }, regen: 0, unlock: 0, hp: 240,
    blurb: "Brews travel and siege elixirs from food, stone, and shards.", effect: "Unlocks Focus and Ward elixirs." },
  { id: "academy", name: "Academy", glyph: "🎓", baseC: 0x7dcfe8, cost: { w: 80, s: 44, p: 6 }, regen: 0, unlock: 0, hp: 260,
    prod: { sc: ACADEMY_SCIENCE_RATE }, blurb: "Scholars passively generate 🔬 science up to your science cap. Science is spent on bombs and future inventions.", effect: `Produces 🔬 science up to ${SCIENCE_BASE_CAP}+${SCIENCE_CAP_PER_ACADEMY} per Academy.` },
  { id: "workshop", name: "Workshop", glyph: "⚙", baseC: 0x7dcfe8, cost: { w: 64, s: 46 }, regen: 0, unlock: 0, hp: 240,
    blurb: "Unlocks advanced recipes and heavy siege craft like Thumpers.", effect: "Unlocks advanced Craft recipes and heavy tools." },
  { id: "warehouse", name: "Warehouse", glyph: "▤", baseC: 0xc79337, cost: { w: 72, s: 38 }, regen: 0, unlock: 0, hp: 260, storageBonus: WAREHOUSE_RESOURCE_CAP_BONUS,
    blurb: "A logistics building that increases wood, stone, plank, and shard storage.", effect: `+${WAREHOUSE_RESOURCE_CAP_BONUS} resource storage.` },
  { id: "barracks", name: "Barracks", glyph: "🛡", baseC: 0x5f6876, cost: { w: 86, s: 70 }, regen: 0, unlock: 0, hp: 280, defenseBonus: true,
    blurb: "A defensive district that trains your towers to hit destroy tools harder and farther.", effect: "Boosts Watchtower range, damage, and bomb resistance." },
  { id: "townhall", name: "Town Hall", glyph: "🏛", baseC: 0xf3ead7, cost: { w: 140, s: 120 }, regen: 0, unlock: 24, hp: 420, tileCapBonus: TOWNHALL_TILE_CAP_BONUS, storageBonus: TOWNHALL_STORAGE_BONUS,
    blurb: "Settlement core. Expands your city capacity and storage while making the city feel official.", effect: `+${TOWNHALL_TILE_CAP_BONUS} tile capacity and +${TOWNHALL_STORAGE_BONUS} storage.` },
  { id: "worldwonder", name: "World Wonder", glyph: "★", baseC: 0xfff0a8, cost: {}, regen: 0, unlock: 0, hp: 5000, tileCapBonus: 250, storageBonus: 1000,
    blurb: "A permanent AI-shaped monument. Spend coins from territory pickups and Keep sieges to found a unique 9×9 Wonder plaza anywhere in the frontier.", effect: "+250 tile capacity, +1000 storage, permanent teleport anchor." },
  { id: "goldmine", name: "Coin Mint", glyph: "⛏", baseC: 0xffd76e, cost: { ...GOLD_MINE_BASE_COST }, regen: 0, unlock: 0, hp: GOLD_MINE_BASE_HP, storage: true,
    blurb: "City mint and redemption office. Territory coins spawn on claimed land; upgrades improve coins from owned-territory pickups and taxes.", effect: "Enables redemption; upgrades increase territory coin and tax income." },
  { id: "barbcamp", name: "Deprecated Coin Ruin", glyph: "⚔", baseC: 0x7b4a35, cost: {}, regen: 0, unlock: 0, hp: GOLD_SOURCE_CAMP_HP, decor: true,
    blurb: "Deprecated. Coins now appear as territory coin pickups instead of ruin/source fixtures." },
  { id: "bomb", name: "Border Bomb", glyph: "●", baseC: 0x22242c, cost: { s: 6, g: 4 }, regen: 0, unlock: 0, hp: 10, weapon: true,
    use: { k: "bomb", e: BOMB_ARM_COST, label: "Arm tool" }, blurb: "Craft it first, then use Deploy to place it on any empty claimed tile.", effect: "Clears territory and damages structures after its fuse." },
  { id: "keep", name: "Stone Keep", glyph: "♜", baseC: 0xc6bba5, cost: { s: 20, p: 10, g: 50, sh: 1 }, regen: 0.6, maxE: 25, unlock: 48, hp: 36,
    prod: { sh: 0.003 }, blurb: "Seat of power. Slowly mints ◈ shards — collect with E." },
];

const SIMPLE_BUILDING_COSTS: Record<string, Partial<Record<ResKey | "e", number>>> = {
  road: { w: 1 },
  cottage: { w: 30 }, well: { w: 24 }, farm: { w: 24 }, lumber: { w: 32 }, quarry: { w: 36 },
  sawmill: { w: 38 }, market: { w: 70 }, vault: { w: 90 }, goldmine: { w: 120 }, watchtower: { w: 80 },
  tavern: { w: 55 }, forge: { w: 75 }, shrine: { w: 65 }, granary: { w: 44 }, windmill: { w: 60 },
  fountain: { w: 30 }, garden: { w: 18 }, flowerbed: { w: 8 }, waterfall: { w: 20 }, pond: { w: 14 },
  statue: { w: 24 }, lantern: { w: 8 }, bench: { w: 10 }, campfire: { w: 8 }, arch: { w: 22 },
  obelisk: { w: 28 }, hedge: { w: 8 }, signpost: { w: 8 }, crystal: { w: 22 },
  workshop: { w: 60 }, academy: { w: 92 }, alchemy: { w: 58 }, warehouse: { w: 80 }, barracks: { w: 90 }, townhall: { w: 140 },
  worldwonder: {},
};
const DECOR_COST = { w: 24, s: 12 } as const;
function woodOnlyBuildCost(cost: Partial<Record<ResKey | "e", number>>, fallback = 40): Partial<Record<ResKey | "e", number>> {
  const currentWood = Math.max(0, Math.ceil(Number(cost?.w || 0)));
  return { w: currentWood || fallback };
}
for (const b of LIBRARY) {
  // Player-facing construction is intentionally simple: every normal building costs wood only.
  // Science, coins, stone, planks, shards, and food stay useful for crafting/raids/upgrades,
  // but they must not block basic city building such as Academy or Workshop.
  const baseBuildCost = SIMPLE_BUILDING_COSTS[b.id] || (b.decor ? { w: 12 } : { w: 40 });
  b.cost = b.id === "worldwonder" ? {} : woodOnlyBuildCost(baseBuildCost, b.decor ? 12 : 40);
  b.regen = 0;
  delete b.maxE;
  if (b.id === "farm") b.prod = { f: 0.04 };
  else if (b.id === "academy") b.prod = { sc: ACADEMY_SCIENCE_RATE };
  else delete b.prod; // Wood/stone come only from harvested tree/rock pickups; camps spawn nodes, not stockpiles.
  if (!["market", "cottage", "tavern", "bomb", "well", "sawmill", "forge", "shrine", "fountain"].includes(b.id)) delete b.use;
  if (b.decor && b.hp == null) b.hp = 120;
  if (!b.decor && b.hp == null) b.hp = 220;
  if (b.id === "vault") b.hp = 300;
  if (b.id === "goldmine") b.hp = GOLD_MINE_BASE_HP;
  if (b.id === "barbcamp") b.hp = GOLD_SOURCE_CAMP_HP;
  if (b.id === "watchtower") b.hp = 450;
  if (b.id === "workshop" || b.id === "warehouse" || b.id === "academy") b.hp = 260;
  if (b.id === "barracks") b.hp = 280;
  if (b.id === "townhall") b.hp = 420;
  if (b.id === "statue" || b.id === "obelisk" || b.id === "keep") b.hp = 600;
  if (b.id === "worldwonder") b.hp = 5000;
}


for (const b of LIBRARY) {
  if (b.id === "cottage") {
    b.name = "House";
    b.tileCapBonus = 2;
    b.blurb = "A permanent home. Levels set your main land limit; Houses add a small amount of local support.";
    b.effect = "+2 tile support.";
  }
  if (b.id === "warehouse") {
    b.storageBonus = WAREHOUSE_RESOURCE_CAP_BONUS;
    b.blurb = "Stores more wood, stone, planks, shards, and supplies for long frontier building.";
    b.effect = `+${WAREHOUSE_RESOURCE_CAP_BONUS} resource storage.`;
  }
  if (b.id === "townhall") {
    b.tileCapBonus = TOWNHALL_TILE_CAP_BONUS;
    b.storageBonus = TOWNHALL_STORAGE_BONUS;
    b.blurb = "Settlement center. Houses grow borders; Town Hall makes a serious city.";
    b.effect = `+${TOWNHALL_TILE_CAP_BONUS} tile capacity and +${TOWNHALL_STORAGE_BONUS} storage.`;
  }
  if (b.id === "academy") {
    b.blurb = `Passively generates 🔬 science up to your science cap. Science is spent crafting bombs and later inventions.`;
    b.effect = `Produces science; +${SCIENCE_CAP_PER_ACADEMY} science cap.`;
  }
  if (b.id === "workshop") {
    b.blurb = "Turns gathered materials and Academy science into siege bombs. Bombs are needed to breach Keeps for coins.";
    b.effect = "Unlocks bomb crafting and repair kits.";
  }
  if (b.id === "alchemy") {
    b.blurb = "Brews elixirs for travel, energy, and defense.";
    b.effect = "Unlocks Focus and Ward elixirs.";
  }
  if (b.id === "worldwonder") {
    b.cost = {};
    b.blurb = `A permanent prompt-built AI district anchor. Costs ${WORLD_WONDER_GOLD_COST}🪙, reserves a protected plaza, shapes nearby roads, and seeds district coin pickups.`;
    b.effect = "Configurable plaza, road/coin district anchor, teleport point, +250 tile capacity, +1000 storage.";
  }
}

export const LIB_BY_ID: Record<string, BuildingDef> = Object.fromEntries(LIBRARY.map((b) => [b.id, b]));

/* ---------- levels / HP — shared math so client predictions match server ---------- */
export const lvlMul = (level: number) => 1 + 0.35 * (Math.max(1, level) - 1); // prod & regen multiplier
export const buildMaxHp = (def: BuildingDef | undefined, level: number) => {
  const base = def?.hp ?? (def?.decor ? 120 : 220);
  return Math.floor(base * (1 + 0.55 * (Math.max(1, level) - 1)));
};
export function upgradeCost(def: BuildingDef, level: number): Partial<Record<ResKey | "e", number>> {
  const out: Partial<Record<ResKey | "e", number>> = {};
  for (const [k, v] of Object.entries(def.cost || {})) {
    if (k === "e") continue;
    const n = Math.ceil((v || 0) * 0.75 * Math.pow(Math.max(1, level), 1.4));
    if (n) out[k as ResKey | "e"] = n;
  }
  return out;
}
export function repairCost(missingHp: number): Partial<Record<ResKey | "e", number>> {
  const units = Math.ceil(Math.max(0, missingHp) / 25);
  return { w: units, s: units };
}

/* ---------- XP, levels & skills ---------- */
export const xpForLevel = (lvl: number) => Math.floor(40 * Math.pow(Math.max(1, lvl), 1.55));
export const XP = { chop: 5, mine: 5, build: 15, craft: 10, trade: 3, claim: 4, capture: 8, raidKill: 22, fight: 4 } as const;

export interface SkillDef { id: string; name: string; glyph: string; max: number; blurb: string; }
export const SKILLS: SkillDef[] = [
  { id: "gather", name: "Gathering", glyph: "🪓", max: 5, blurb: "+1 resource per harvest, per level." },
  { id: "haste", name: "Efficiency", glyph: "⏱", max: 5, blurb: "Harvest 0.2s faster per level." },
  { id: "vigor", name: "Vigor", glyph: "⚡", max: 5, blurb: "+5 max energy & +0.1 regen per level." },
  { id: "mason", name: "Masonry", glyph: "🧱", max: 5, blurb: "+4 building HP per level." },
  { id: "warrior", name: "Siegecraft", glyph: "⚔", max: 5, blurb: "+1 siege power and +1 defense per 2 levels." },
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export type Skills = Record<string, number>;
export const skillLvl = (skills: Skills | undefined, id: string) => (skills && skills[id]) || 0;
export const harvestMs = (skills: Skills | undefined, kind: "tree" | "rock" = "tree") => Math.max(1000, (kind === "rock" ? ECONOMY_RULES.mineMs : ECONOMY_RULES.chopMs) - skillLvl(skills, "haste") * 200);
export const gatherBonus = (skills: Skills | undefined) => skillLvl(skills, "gather");
export const vigorRegen = (skills: Skills | undefined) => skillLvl(skills, "vigor") * 0.1;
export const vigorMax = (skills: Skills | undefined) => skillLvl(skills, "vigor") * 5;
export const masonHp = (skills: Skills | undefined) => skillLvl(skills, "mason") * 4;
export const skillAtk = (skills: Skills | undefined) => Math.floor(skillLvl(skills, "warrior") / 2);
export const skillDef = (skills: Skills | undefined) => Math.floor(skillLvl(skills, "warrior") / 2);

/* ---------- crafting recipes (deterministic, unlike the forge's random gear) ---------- */
export interface Recipe {
  id: string; name: string; glyph: string; blurb: string;
  out: { t: "gear" | "res" | "use"; id: string; n?: number };
  cost: Partial<Record<ResKey | "e", number>>;
  needForge?: boolean;
  needWorkshop?: boolean;
  needAlchemy?: boolean;
  reqSkill?: { id: string; lvl: number };
}
export const RECIPES: Recipe[] = [
  { id: "r_plank", name: "Planks", glyph: "📦", out: { t: "res", id: "p", n: 1 }, cost: { w: 4 }, blurb: "Saw 4 wood into a plank — anywhere." },
  { id: "r_miner", name: "Miner Helm", glyph: "⛑", out: { t: "gear", id: "miner" }, cost: { w: 5, s: 4 }, blurb: "+1 defense. A practical helmet for territory pushes, not a random straw hat." },
  { id: "r_swift", name: "Swift Boots", glyph: "👟", out: { t: "gear", id: "swift" }, cost: { w: 4, f: 4 }, blurb: "+1 movement flair." },
  { id: "r_shield", name: "Oak Shield", glyph: "🛡️", out: { t: "gear", id: "shield" }, cost: { w: 8, p: 2 }, blurb: "+2 defense." },
  { id: "r_pads", name: "Leather Pads", glyph: "🟤", out: { t: "gear", id: "pads" }, cost: { w: 6, f: 6 }, blurb: "+2 defense armor." },
  { id: "r_hood", name: "Ranger Hood", glyph: "🧢", out: { t: "gear", id: "hood" }, cost: { w: 5, f: 3 }, blurb: "+1 defense." },
  { id: "r_sword", name: "Sol Sword", glyph: "🗡", out: { t: "gear", id: "sword" }, cost: { p: 4, s: 6, g: 10 }, needForge: true, blurb: "+3 siege power. Needs a Forge nearby." },
  { id: "r_staff", name: "Shard Staff", glyph: "🪄", out: { t: "gear", id: "staff" }, cost: { w: 6, sh: 2, g: 8 }, needForge: true, blurb: "+2 siege power. Needs a Forge." },
  { id: "r_plate", name: "Shard Plate", glyph: "🛡", out: { t: "gear", id: "plate" }, cost: { p: 6, s: 10, sh: 2, g: 20 }, needForge: true, needWorkshop: true, reqSkill: { id: "mason", lvl: 2 }, blurb: "+4 defense. Needs Forge + Workshop + Masonry 2." },
  { id: "r_ledger", name: "Trade Ledger", glyph: "📜", out: { t: "res", id: "sh", n: 1 }, cost: { p: 3, g: 20 }, needForge: true, needWorkshop: true, blurb: "Turns city records into one shard. Needs Forge + Workshop." },
  { id: "r_supply", name: "Supply Crate", glyph: "📦", out: { t: "res", id: "f", n: 8 }, cost: { w: 6, s: 2 }, blurb: "A compact food bundle for long territory pushes." },
  { id: "r_focus", name: "Focus Elixir", glyph: "🧪", out: { t: "use", id: "focus_elixir" }, cost: { f: 4, sh: 1 }, needAlchemy: true, blurb: "Backpack item. Brew in an Alchemy Shop, then use to restore energy." },
  { id: "r_ward", name: "Ward Elixir", glyph: "🛡️", out: { t: "use", id: "ward_elixir" }, cost: { f: 5, s: 3 }, needAlchemy: true, blurb: "Backpack item. Brew in an Alchemy Shop before defending a route or Keep push." },
  { id: "r_repair", name: "Repair Kit", glyph: "🔧", out: { t: "res", id: "p", n: 3 }, cost: { w: 8, s: 4 }, needWorkshop: true, blurb: "Prepared materials for structure repairs. Needs a Workshop." },
];
const SCIENCE_ONLY_RECIPE_COSTS: Record<string, number> = {
  r_plank: 1, r_miner: 1, r_swift: 1, r_shield: 2, r_pads: 2, r_hood: 1,
  r_sword: 3, r_staff: 3, r_plate: 5, r_ledger: 4, r_supply: 2,
  r_focus: 3, r_ward: 3, r_repair: 2,
};
for (const r of RECIPES as any[]) {
  // Crafting is intentionally science-only: Academy produces science, science crafts tools/supplies.
  // Buildings remain wood-only, while coins are for Wonders/Keep rewards.
  r.cost = { sc: Math.max(1, Number(SCIENCE_ONLY_RECIPE_COSTS[r.id] || 1)) };
  delete r.needForge;
  delete r.needWorkshop;
  delete r.needAlchemy;
  delete r.reqSkill;
  const cleaned = String(r.blurb || "")
    .replace(/s*Needs[^.]*./g, ".")
    .replace(/s*Brew in an Alchemy Shop,?s*/g, "")
    .replace(/s*Prepared materials for structure repairs.s*/g, "")
    .replace(/.s*./g, ".")
    .trim();
  r.blurb = `${cleaned}${cleaned.endsWith(".") ? "" : "."} Science-only craft.`;
}

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const NPC_TRADES = [] as const;


export const COLOR_CHOICES: (string | null)[] = [null, "#f6e7c8", "#d6604f", "#3f8ab5", "#35b87a", "#e0b54a", "#9263c4", "#14f195", "#9945ff", "#7dcfe8", "#f08bb0", "#4a4f5a"];
export const BODY_COLORS = [0x6a5ae0, 0x3f8ab5, 0xd6604f, 0x35b87a, 0xe0b54a, 0x9263c4];
export const HAT_COLORS = [0x14f195, 0x9945ff, 0xd6604f, 0xf5d76e, 0xf0ece0, 0x2e9bb0];

/* ---------- deterministic world generation ----------
   Doodads (trees/rocks) exist procedurally on every cell; the
   DB stores only exceptions (chopped or planted). Same hash on
   server & client = same world, zero terrain storage. */
export const hrand = (x: number, z: number, s = 0) => {
  const n = Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

export const BIOMES = [
  { id: "meadow", name: "Sun Meadow", terrain: "grass", treeChance: 0.095, rockChance: 0.025, tint: 0x7ccf75 },
  { id: "forest", name: "Deepwood", terrain: "forest", treeChance: 0.18, rockChance: 0.025, tint: 0x4f9c54 },
  { id: "stone", name: "Stone Fields", terrain: "rocky", treeChance: 0.035, rockChance: 0.14, tint: 0xaaa69a },
  { id: "desert", name: "Glass Dunes", terrain: "sand", treeChance: 0.025, rockChance: 0.055, tint: 0xd8b56a },
  { id: "swamp", name: "Mossfen", terrain: "moss", treeChance: 0.12, rockChance: 0.035, tint: 0x6a8f54 },
  { id: "crystal", name: "Shardlands", terrain: "mint", treeChance: 0.045, rockChance: 0.09, tint: 0x7dcfe8 },
  { id: "void", name: "Violet Rift", terrain: "purple", treeChance: 0.04, rockChance: 0.07, tint: 0x9945ff },
] as const;
export type BiomeId = typeof BIOMES[number]["id"];
export function biomeAt(x: number, z: number) {
  const nx = Math.floor(x / 24);
  const nz = Math.floor(z / 24);
  const a = hrand(nx, nz, 21);
  const far = Math.min(1, Math.sqrt(x * x + z * z) / 900);
  const r = (a + far * 0.22 + hrand(nx, nz, 22) * 0.18) % 1;
  const idx =
    r < 0.22 ? 0 :
    r < 0.39 ? 1 :
    r < 0.54 ? 2 :
    r < 0.68 ? 3 :
    r < 0.80 ? 4 :
    r < 0.92 ? 5 : 6;
  return BIOMES[idx];
}
export function biomeTerrainAt(x: number, z: number) {
  return biomeAt(x, z).terrain;
}
export type DoodadType = "tree" | "rock" | null;
export function naturalDoodad(x: number, z: number): DoodadType {
  if (capitalBlocksNaturalResource(x, z)) return null;
  const b = biomeAt(x, z);
  const r = hrand(x, z, 2);
  if (r < b.treeChance) return "tree";
  if (r < b.treeChance + b.rockChance) return "rock";
  return null;
}

export type ProceduralKeep = { id: string; x: number; z: number; biome: string; name: string; hp: number; gold: number };
export const PROCEDURAL_KEEP_STEP = 30;
const KEEP_LANE_NAME: Record<string, string> = { northeast: "Northeast", southeast: "Southeast", southwest: "Southwest", northwest: "Northwest" };
function proceduralKeepFromCross(x: number, z: number): ProceduralKeep | null {
  const k = keepCrossIndexAt(x, z);
  if (!k) return null;
  const biome = biomeAt(x, z);
  const tier = Math.max(1, Math.min(6, k.index + 1));
  const laneName = KEEP_LANE_NAME[k.lane] || "Frontier";
  return {
    id: `keep:${k.lane}:${k.index}`,
    x, z,
    biome: biome.id,
    name: `${laneName} Gate Keep ${k.index + 1}`,
    hp: 95 + tier * 35,
    gold: 45 + tier * 35,
  };
}
export function proceduralKeepAt(x: number, z: number): ProceduralKeep | null {
  return proceduralKeepFromCross(x, z);
}
export function proceduralKeepCandidatesAround(x: number, z: number, radius: number): ProceduralKeep[] {
  return keepCrossPositionsInBox(x, z, radius)
    .map((p) => proceduralKeepFromCross(p.x, p.z))
    .filter(Boolean) as ProceduralKeep[];
}

export type ProceduralNpcRole = "wanderer" | "traveler" | "trader" | "warrior";
export type ProceduralNpc = { id: string; x: number; z: number; biome: string; role: ProceduralNpcRole; name: string; title: string; hp: number; coins: number; resource: "w" | "s" | "f"; resourceAmount: number; attack: number };
export function proceduralNpcAt(x: number, z: number): ProceduralNpc | null {
  if (Math.abs(x) < 14 && Math.abs(z) < 14) return null;
  const step = 38;
  const cx = Math.floor(x / step);
  const cz = Math.floor(z / step);
  if (hrand(cx, cz, 51) > 0.34) return null;
  const px = cx * step + 5 + Math.floor(hrand(cx, cz, 52) * (step - 10));
  const pz = cz * step + 5 + Math.floor(hrand(cx, cz, 53) * (step - 10));
  if (px !== x || pz !== z) return null;
  const biome = biomeAt(x, z);
  const roll = hrand(cx, cz, 54);
  const role: ProceduralNpcRole = roll > 0.82 ? "warrior" : roll > 0.58 ? "trader" : roll > 0.30 ? "traveler" : "wanderer";
  const titles: Record<ProceduralNpcRole, string> = {
    wanderer: "Wanderer",
    traveler: "Traveler",
    trader: "Trader",
    warrior: "Warrior",
  };
  const biomeTags: Record<string, string> = {
    meadow: "Meadow",
    forest: "Forest",
    stone: "Hill",
    desert: "Dune",
    swamp: "Mire",
    crystal: "Crystal",
    void: "Rift",
  };
  const title = titles[role] || "Wanderer";
  const name = `${biomeTags[biome.id] || biome.name || "Frontier"} ${title}`;
  const hp = role === "warrior" ? 48 : role === "trader" ? 36 : role === "traveler" ? 30 : 24;
  const coins = role === "warrior" ? 18 : role === "trader" ? 26 : role === "traveler" ? 12 : 8;
  const resource: "w" | "s" | "f" = role === "trader" ? "f" : biome.id === "stone" ? "s" : "w";
  const resourceAmount = role === "trader" ? 10 : role === "warrior" ? 6 : 4;
  const attack = role === "warrior" ? 7 : role === "trader" ? 4 : 3;
  return { id: `npc:${cx}:${cz}`, x, z, biome: biome.id, role, name, title, hp, coins, resource, resourceAmount, attack };
}

export const key = (x: number, z: number) => `${x},${z}`;
export const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
export const cheb = (ax: number, az: number, bx: number, bz: number) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));
export const anchorOf = (x: number, z: number): [number, number] =>
  [Math.round(x / ANCHOR_STEP) * ANCHOR_STEP, Math.round(z / ANCHOR_STEP) * ANCHOR_STEP];

/* Public trade posts are deterministic map fixtures: everyone sees the same
   small merchant camps without storing them in the DB. Stand beside one to
   sell resources or redeem coins. */
export const TRADE_POST_STEP = 54;
const posMod = (n: number, m: number) => ((n % m) + m) % m;
export function tradePostAt(x: number, z: number): boolean {
  if (Math.abs(x) <= SPAWN_HALF && Math.abs(z) <= SPAWN_HALF) return false;
  return posMod(x, TRADE_POST_STEP) === Math.floor(TRADE_POST_STEP / 2) && posMod(z, TRADE_POST_STEP) === Math.floor(TRADE_POST_STEP / 2);
}
export function nearTradePost(x: number, z: number): boolean {
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (tradePostAt(x + dx, z + dz)) return true;
  }
  return false;
}

/* spawn plots go on a square spiral so everyone shares one map
   with breathing room between starter plots */
export const CAPITAL_CENTER: [number, number] = [0, 0];
export const CAPITAL_RESERVED_RADIUS = 15;
export const SETTLEMENT_SPAWN_STEP = CAPITAL_SETTLEMENT_SPAWN_STEP;

export function spawnOrigin(index: number): [number, number] {
  // Settlements use four fair road arms around the capital. Every group of four
  // players gets an equivalent distance from the center, while the road itself
  // stays open for travel and future capital services.
  const p = settlementSpawnPoint(index);
  return [p.x, p.z];
}

/* ---------- walkthrough milestones — teach the full loop ---------- */
export interface MsState { treesChopped: number; planksMade: number; tradesDone: number; equippedOnce: boolean; territory: number; gearCrafted: number; buildIds: string[]; }
export const MILESTONES: { text: string; done: (s: MsState) => boolean }[] = [
  { text: "Gather resources — select Wood (2) for trees or Stone (3) for rocks, then pick up dropped piles", done: (s) => s.treesChopped >= 1 },
  { text: "Capture frontier around your camp — select Capture (4) and stand on highlighted land", done: (s) => s.territory >= 13 },
  { text: "Build a Lumber Camp or Quarry to make nearby resources respawn", done: (s) => s.buildIds.includes("lumber") || s.buildIds.includes("quarry") },
  { text: "Build a Workshop so advanced tools and city logistics unlock", done: (s) => s.buildIds.includes("workshop") },
  { text: "Craft a destroy tool — Craft (1) makes deployables, Deploy (6) places one on any unoccupied territory", done: (s) => s.gearCrafted >= 1 },
  { text: "Collect territory coins — coins spawn on claimed tiles and pay tax to that tile's owner", done: (s) => s.tradesDone >= 1 || s.buildIds.includes("goldmine") },
  { text: "Build a Coin Mint so purse coins can be exchanged into $CRAFTS", done: (s) => s.buildIds.includes("goldmine") },
  { text: "Protect your mint with towers, warehouses, vaults, and good street spacing", done: (s) => s.buildIds.includes("watchtower") || s.buildIds.includes("vault") || s.buildIds.includes("warehouse") },
];
export const FINAL_TEXT = "World of SolCrafts: claim territory, collect taxed coins, defend city infrastructure, and exchange coins into $CRAFTS.";

/* ---------- the economy loop, single source of copy ---------- */
export const ECONOMY = {
  intro: "World of SolCrafts is a Solana MMORPG economy: Energy, Wood, Stone, Coins, Science, Territory, Destroy tools, and $CRAFTS all connect.",
  energy: `Energy fuels movement, gathering, claiming, sieging, and destroying. Movement costs ${ECONOMY_RULES.moveEnergy}⚡ per tile and refills quickly, while the Return Scroll is infinite with a cast delay. Everyone has a ${ECONOMY_RULES.energyCap} energy bar. Refills use a concave $CRAFTS holding curve: citizens get a real floor, committed holders get more throughput, and whales hit a hard cap.`,
  crafts: `The refill curve is absolute, not rank-griefable: ${ECONOMY_RULES.energyRegenBasePerMinute}⚡/min floor plus a capped ${ECONOMY_RULES.energyRegenBonusPerMinute}⚡/min bonus at ${ECONOMY_RULES.energyRefHold.toLocaleString()} $CRAFTS.`,
  resources: `Wood and stone are gathered from adjacent trees and rocks. Buildings cost only resources, not energy. Destroy tools are crafted first, then deployed from the Deploy action. Crafting spends science only; defusing enemy tools costs energy.`,
  gold: `Coins spawn on claimed territory. Anyone can pick them up by walking over them; when a coin is picked up on someone else's land, that land owner receives a tax fee. More claimed land means more possible spawn locations.`,
  redeem: `At an active Coin Mint, purse coins can be exchanged at the fixed launch rate of ${GOLD_PER_CRAFTS_FIXED}🪙 = 1 $CRAFTS. The channel takes ${ECONOMY_RULES.withdrawMs / 1000}s.`,
  land: "Claims take empty connected land and can recapture enemy tiles that are cut off from that owner’s flag. Connected enemy land still needs siege pressure before it changes hands.",
} as const;

/* ---------- wire types (API payloads) ---------- */
export interface WirePlayer { id: number; name: string; body: number; hat: number; x: number; z: number; hp: number; equip: Equip; ts: number; faceImage?: string | null; appearance?: any; level?: number; xp?: number; }
export interface WireLeaderboard { id: number; name: string; body: number; buildings: number; territory: number; score?: number; goldReward: number; }
export interface WireBuilding { uid: number; owner: number; ownerName: string; ownerBody: number; ownerFace?: string | null; kind: string; x: number; z: number; nm: string | null; cl: string | null; acc: number; accAt: number; cdUntil: number; constructAt?: number; constructUntil?: number; usedAt?: number; level: number; hp: number; maxHp: number; stored?: number; }
export interface WireTile { x: number; z: number; owner: number; ownerBody: number; ownerName?: string; }
export interface WireDoodad { x: number; z: number; type: "tree" | "rock" | "gone"; }
export interface WireLoot { id: number; x: number; z: number; kind: string; gid: string | null; }
export interface WireGoldSource { id: string; x: number; z: number; state: "barb" | "cleared" | "mining" | "ruined"; owner?: number; hp?: number; maxHp?: number; mineUid?: number | null; stored?: number; cap?: number; output?: number; }
export interface WireChat { id: number; name: string; msg: string; ts: number; }
export interface WireOffer { id: number; byId: number; byName: string; gRes: ResKey; gAmt: number; wRes: ResKey; wAmt: number; }
export interface MeWire {
  id: number; name: string; body: number; hat: number; x: number; z: number; spawnX: number; spawnZ: number; appearance?: any;
  energy: number; maxE: number; regen: number; hp: number; wallet: string | null; faceImage?: string | null; tokenBalance?: number; strongbox?: number; vaultGold?: number;
  inv: Inv; pack: PackItem[]; equip: Equip; scienceCap?: number;
  xp: number; level: number; skillPts: number; skills: Skills; skillXp?: Record<string, number>;
  territory: number; built: number; msIndex: number; tileCap?: number; storageCap?: Partial<Record<ResKey, number>>; buildKinds?: string[];
  treesChopped: number; planksMade: number; gearCrafted: number; tradesDone: number; equippedOnce: boolean;
  clientVersion?: string; requiredVersion?: string; updateReason?: string; profileDone?: boolean; spectator?: boolean; biome?: string; wonders?: { uid: number; x: number; z: number; name: string | null }[];
}
/* world payload is OPTIONAL: the server omits it entirely when
   nothing changed (same worldRev) AND the client's view anchor
   has not moved — this is what makes 100+ concurrent pollers cheap */
export interface WorldWire {
  rev: number; ax: number; az: number;
  tiles: WireTile[];
  buildings: WireBuilding[];
  doodads: WireDoodad[]; // exceptions only (gone / planted)
  loot: WireLoot[];
  offers: WireOffer[];
  map?: { rev?: number; tiles: WireTile[]; buildings: Pick<WireBuilding, "uid" | "owner" | "kind" | "x" | "z" | "ownerBody">[]; loot: WireLoot[]; players?: { id: number; name: string; body: number; x: number; z: number; spawnX: number; spawnZ: number; lastSeen?: number }[] };
  goldSources?: WireGoldSource[];
}
export interface Snapshot {
  now: number;
  me: MeWire;
  players: WirePlayer[];                       // always sent, view-filtered
  chat: WireChat[];                            // only entries newer than the client's last chat id
  events: { kind: string; msg: string; ts: number }[];
  leaderboard?: WireLeaderboard[];
  requiredVersion?: string;
  updateReason?: string;
  world?: WorldWire;                           // omitted when unchanged
}