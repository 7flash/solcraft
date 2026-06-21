import { describe, expect, test } from "bun:test";
import { db } from "./db";
import { getPlayer, hydratePlayerStore, insertPlayer, invalidatePlayerStore, playerByWallet, touchPlayerSeen } from "./playerStore";

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function basePlayer(wallet: string | null = null) {
  return {
    name: unique("StoreTester").slice(0, 18),
    secret: unique("secret"),
    body: 0x14f195,
    hat: 0x9945ff,
    x: 0,
    z: 0,
    spawnX: 0,
    spawnZ: 0,
    hp: 20,
    energy: 50,
    energyAt: Date.now(),
    wallet,
    inv: { w: 0, p: 0, s: 0, f: 0, g: 0, sh: 0, sc: 0 },
    pack: [],
    equip: {},
    xp: 0,
    level: 1,
    skillPts: 0,
    skills: {},
    profileDone: 1,
    lastSeen: 0,
  };
}

describe("playerStore", () => {
  test("insert/get/cache rebuild/playerByWallet", () => {
    const wallet = unique("wallet");
    const p = insertPlayer(basePlayer(wallet));
    expect(p.id).toBeGreaterThan(0);
    expect(getPlayer(p.id)?.id).toBe(p.id);
    expect(playerByWallet(wallet)?.id).toBe(p.id);

    invalidatePlayerStore();
    hydratePlayerStore(true);
    expect(getPlayer(p.id)?.id).toBe(p.id);
    expect(playerByWallet(wallet)?.id).toBe(p.id);

    db.players.delete(p.id);
    invalidatePlayerStore();
  });

  test("touchPlayerSeen throttles lastSeen writes", () => {
    const p = insertPlayer(basePlayer(null));
    const a = Date.now();
    touchPlayerSeen(p, a, 15000);
    const first = getPlayer(p.id)!;
    expect(Number(first.lastSeen || 0)).toBeGreaterThanOrEqual(a);

    touchPlayerSeen(first, a + 1000, 15000);
    const second = getPlayer(p.id)!;
    expect(Number(second.lastSeen || 0)).toBe(Number(first.lastSeen || 0));

    touchPlayerSeen(second, a + 20000, 15000);
    const third = getPlayer(p.id)!;
    expect(Number(third.lastSeen || 0)).toBeGreaterThan(Number(second.lastSeen || 0));

    db.players.delete(p.id);
    invalidatePlayerStore();
  });
});
