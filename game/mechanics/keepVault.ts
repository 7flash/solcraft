// @ts-nocheck
/**
 * Keep vault mechanics are intentionally kept outside game/engine.ts.
 * The engine owns database/auth/dispatch; this module owns the payout shape:
 * break one neutral Keep -> fill empty owned territory with loose coins -> spawn the next Keep.
 */

type TileLike = { id?: number; x: number; z: number; owner?: number };
type KeepLike = { id?: number; uid?: number; x: number; z: number; stored?: number; nm?: string; name?: string };
type PlayerLike = { id: number; name?: string; x?: number; z?: number };

type SpawnResult = { ok: boolean; uid?: number; x?: number; z?: number; name?: string; hp?: number; gold?: number; msg?: string };

export type KeepVaultContext = {
  ownedTilesFor(playerId: number): TileLike[];
  hasBuilding(x: number, z: number): boolean;
  hasLoot(x: number, z: number): boolean;
  hasDoodad(x: number, z: number): boolean;
  hasTradePost(x: number, z: number): boolean;
  insertCoinLoot(x: number, z: number, amount: number): boolean;
  spawnNeutralKeepAt(x: number, z: number, coins: number, hp: number, name?: string): SpawnResult;
  canSpawnNeutralKeepAt(x: number, z: number): string;
  random?: () => number;
};

export type KeepVaultResult = {
  stored: number;
  spawnedCoins: number;
  filledTiles: number;
  fallbackPiles: number;
  ownedSlotsSeen: number;
  nextKeep: SpawnResult | null;
  note: string;
};

function dist2(ax: number, az: number, bx: number, bz: number) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function cleanInt(v: any, fallback = 0, min = 0, max = 1000000) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function emptyOwnedTerritoryCoinSlots(ctx: KeepVaultContext, playerId: number, keep: KeepLike, maxSlots = 600) {
  const tiles = ctx.ownedTilesFor(playerId).filter((t) => {
    const x = cleanInt(t.x, 0, -1000000, 1000000);
    const z = cleanInt(t.z, 0, -1000000, 1000000);
    if (Number(t.owner || playerId) !== playerId) return false;
    if (ctx.hasBuilding(x, z)) return false;
    if (ctx.hasLoot(x, z)) return false;
    if (ctx.hasDoodad(x, z)) return false;
    if (ctx.hasTradePost(x, z)) return false;
    return true;
  });

  tiles.sort((a, b) => dist2(a.x, a.z, keep.x, keep.z) - dist2(b.x, b.z, keep.x, keep.z));
  return tiles.slice(0, Math.max(0, maxSlots));
}

export function spawnCoinsAcrossOwnedTerritory(ctx: KeepVaultContext, attacker: PlayerLike, keep: KeepLike, totalCoins: number) {
  let left = cleanInt(totalCoins, 0, 0, 1000000);
  const slots = emptyOwnedTerritoryCoinSlots(ctx, attacker.id, keep);
  let spawnedCoins = 0;
  let filledTiles = 0;

  if (left > 0 && slots.length) {
    const base = Math.max(1, Math.floor(left / slots.length));
    for (let i = 0; i < slots.length && left > 0; i++) {
      const remainingSlots = slots.length - i;
      const amount = Math.max(1, Math.min(left, i === slots.length - 1 ? left : Math.floor(left / remainingSlots) || base));
      if (ctx.insertCoinLoot(slots[i].x, slots[i].z, amount)) {
        spawnedCoins += amount;
        filledTiles += 1;
        left -= amount;
      }
    }
  }

  let fallbackPiles = 0;
  if (left > 0) {
    const spots = [[0,0], [1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,-1], [1,-1], [-1,1], [2,0], [-2,0], [0,2], [0,-2]];
    for (let i = 0; i < spots.length && left > 0; i++) {
      const [dx, dz] = spots[i];
      const x = keep.x + dx;
      const z = keep.z + dz;
      if (ctx.hasBuilding(x, z) || ctx.hasLoot(x, z) || ctx.hasTradePost(x, z)) continue;
      const amount = Math.max(1, Math.ceil(left / Math.max(1, spots.length - i)));
      if (ctx.insertCoinLoot(x, z, amount)) {
        spawnedCoins += amount;
        fallbackPiles += 1;
        left -= amount;
      }
    }
  }

  return { spawnedCoins, filledTiles, fallbackPiles, ownedSlotsSeen: slots.length };
}

export function findNextKeepSpot(ctx: KeepVaultContext, keep: KeepLike) {
  const rings = [8, 11, 14, 18, 23, 29];
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1],
    [2, 1], [-2, 1], [2, -1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2],
  ];

  for (const r of rings) {
    for (const [dx, dz] of dirs) {
      const x = cleanInt(keep.x + dx * r, 0, -1000000, 1000000);
      const z = cleanInt(keep.z + dz * r, 0, -1000000, 1000000);
      if (!ctx.canSpawnNeutralKeepAt(x, z)) return { x, z };
    }
  }
  return null;
}

export function resolveKeepVaultBreak(ctx: KeepVaultContext, attacker: PlayerLike, keep: KeepLike): KeepVaultResult {
  const stored = Math.max(20, cleanInt(keep.stored || 0, 40, 0, 1000000));
  const coins = spawnCoinsAcrossOwnedTerritory(ctx, attacker, keep, stored);
  const nextSpot = findNextKeepSpot(ctx, keep);
  const nextCoins = Math.max(40, Math.min(100000, Math.ceil(stored * 1.15)));
  const nextHp = Math.max(60, Math.min(3000, 120 + Math.ceil(nextCoins / 8)));
  const nextKeep = nextSpot ? ctx.spawnNeutralKeepAt(nextSpot.x, nextSpot.z, nextCoins, nextHp, "") : null;

  const note = nextKeep?.ok
    ? `♜ Keep breached. ${coins.spawnedCoins}🪙 spilled across ${coins.filledTiles} owned empty slot${coins.filledTiles === 1 ? "" : "s"}. A new Keep appeared with ${nextCoins}🪙.`
    : `♜ Keep breached. ${coins.spawnedCoins}🪙 spilled across ${coins.filledTiles} owned empty slot${coins.filledTiles === 1 ? "" : "s"}.`;

  return { stored, ...coins, nextKeep: nextKeep?.ok ? nextKeep : null, note };
}
