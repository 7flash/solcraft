import { beforeAll, describe, expect, it } from "bun:test";

process.env.SOLCRAFT_DB = ":memory:";

let tiles: typeof import("./tileStore");
let loot: typeof import("./lootStore");

beforeAll(async () => {
  tiles = await import("./tileStore");
  loot = await import("./lootStore");
  tiles.hydrateTileStore(true);
  loot.hydrateLootStore(true);
});

describe("tileStore", () => {
  it("keeps exact-cell tile lookups in sync with insert/delete helpers", () => {
    const t = tiles.insertTile({ owner: 42, x: 5, z: -7 });
    expect(Number(t.id || 0)).toBeGreaterThan(0);
    expect(tiles.tileAt(5, -7)?.id).toBe(t.id);
    expect(tiles.getTile(Number(t.id))?.owner).toBe(42);
    expect(tiles.hasTileAt(5, -7)).toBe(true);

    expect(tiles.deleteTile(t)).toBe(true);
    expect(tiles.tileAt(5, -7)).toBeNull();
    expect(tiles.getTile(Number(t.id))).toBeNull();
  });

  it("can upsert a claimed tile and rebuild from SQLite rows", () => {
    const t = tiles.claimTileAt(-4, 9, 8);
    expect(tiles.tileAt(-4, 9)?.owner).toBe(8);
    tiles.claimTileAt(-4, 9, 13);
    expect(tiles.tileAt(-4, 9)?.owner).toBe(13);

    tiles.invalidateTileStore();
    const stats = tiles.hydrateTileStore(true);
    expect(stats.ids).toBeGreaterThan(0);
    expect(tiles.tileAt(-4, 9)?.id).toBe(t.id);
    expect(tiles.deleteTile(t)).toBe(true);
  });
});

describe("lootStore", () => {
  it("keeps exact-cell loot lookups in sync with insert/delete helpers", () => {
    const l = loot.insertLoot({ x: 2, z: 3, kind: "gold", gid: "5" });
    expect(Number(l.id || 0)).toBeGreaterThan(0);
    expect(loot.lootAt(2, 3)?.id).toBe(l.id);
    expect(loot.getLoot(Number(l.id))?.kind).toBe("gold");
    expect(loot.hasLootAt(2, 3)).toBe(true);

    expect(loot.deleteLoot(l)).toBe(true);
    expect(loot.lootAt(2, 3)).toBeNull();
    expect(loot.getLoot(Number(l.id))).toBeNull();
  });

  it("can rebuild the loot cache from SQLite rows", () => {
    const l = loot.insertLoot({ x: -8, z: -9, kind: "wood", gid: "3" });
    loot.invalidateLootStore();
    const stats = loot.hydrateLootStore(true);
    expect(stats.ids).toBeGreaterThan(0);
    expect(loot.lootAt(-8, -9)?.id).toBe(l.id);
    expect(loot.deleteLoot(l)).toBe(true);
  });
});
