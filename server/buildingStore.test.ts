import { beforeAll, describe, expect, it } from "bun:test";

process.env.SOLCRAFT_DB = ":memory:";

let store: typeof import("./buildingStore");

beforeAll(async () => {
  store = await import("./buildingStore");
  store.hydrateBuildingStore(true);
});

describe("buildingStore", () => {
  it("keeps exact-cell lookups in sync with insert/delete helpers", () => {
    const b = store.insertBuilding({ owner: 7, kind: "cottage", x: 11, z: -4, level: 1, hp: 12, maxHp: 12 });
    expect(Number(b.id || 0)).toBeGreaterThan(0);
    expect(store.buildingAt(11, -4)?.id).toBe(b.id);
    expect(store.getBuilding(Number(b.id))?.kind).toBe("cottage");
    expect(store.hasBuildingAt(11, -4)).toBe(true);

    expect(store.deleteBuilding(b)).toBe(true);
    expect(store.buildingAt(11, -4)).toBeNull();
    expect(store.getBuilding(Number(b.id))).toBeNull();
  });

  it("can rebuild the cache from SQLite rows", () => {
    const b = store.insertBuilding({ owner: 8, kind: "lumber", x: -2, z: 3, level: 1, hp: 12, maxHp: 12 });
    const before = store.buildingCacheStats();
    expect(before.ids).toBeGreaterThan(0);

    store.invalidateBuildingStore();
    const after = store.hydrateBuildingStore(true);
    expect(after.ids).toBeGreaterThan(0);
    expect(store.buildingAt(-2, 3)?.id).toBe(b.id);
    store.deleteBuilding(b);
  });
});
