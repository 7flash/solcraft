import { db, metaGet, metaSet } from "./db";
import { getPlayer, refreshPlayer } from "./playerStore";
import { deleteBuilding, getBuilding, refreshBuilding } from "./buildingStore";
import { insertLoot, lootAt } from "./lootStore";
import { adjustReputation, reputationDeltaFor, reputationDeltaText, reputationSummaryForWire, storageCapsForPlayer } from "./reputationRules";
import { removedFeatureResponse } from "./removedFeatures";
import { bumpEcsWorldRev, mirrorLegacyToEcsTables } from "./ecsDbAdapter";
import { BASE_MAX, ECONOMY_RULES, GOLD_MINE_KIND, LIBRARY, MAX_HP, RAID_COST, RES_KEYS, RES_NAMES, TELEPORT_COST, TELEPORT_MS, XP, biomeAt, cheb, harvestMs, naturalDoodad, proceduralNpcAt } from "./shared";

export type EcsGameplayResult = { handled: boolean; result?: any };

type PlayerRow = Record<string, any>;
type BuildingRow = Record<string, any>;
type ResBag = Record<string, number>;

const SWORD_COST = Math.max(1, Number(process.env.SOLCRAFT_SWORD_ENERGY_COST || 4) || 4);
const RESOURCE_KEYS = new Set<string>(RES_KEYS as any);
const DIRECT_ACTIONS = new Set([
  "claim",
  "harvestStart",
  "harvestFinish",
  "harvestCancel",
  "pickup",
  "repair",
  "customize",
  "customizerAccess",
  "use",
  "talkNpc",
  "attackNpc",
  "donateNpc",
  "donateKeep",
  "raid",
  "attack",
  "fight",
  "home",
  "homeStart",
  "homeFinish",
  "homeCancel",
  "houseStart",
  "houseFinish",
  "houseCancel",
  "wonderStart",
  "wonderFinish",
  "wonderCancel",
  "wallet",
]);

const channels = new Map<number, { type: "home" | "house" | "wonder" | "harvest"; x: number; z: number; until: number; uid?: number; tx?: number; tz?: number; kind?: "tree" | "rock" | "food" }>();

function now() { return Date.now(); }
function ok(extra: Record<string, any> = {}) { return { ok: true, ...extra, backend: "ecs" }; }
function err(msg: string, reasonCode = "ECS_GAMEPLAY_FAILED", extra: Record<string, any> = {}) { return { ok: false, msg, reasonCode, ...extra, backend: "ecs" }; }
function int(v: any, fallback = 0) { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : fallback; }
function cleanHex(v: any) { const s = String(v || "").trim(); return /^#[0-9a-fA-F]{6}$/.test(s) ? s : ""; }
function invOf(p: PlayerRow): ResBag { const inv = p.inv && typeof p.inv === "object" ? p.inv : {}; p.inv = inv; return inv as ResBag; }
function have(p: PlayerRow, res: string) { return Math.max(0, Number(invOf(p)[res] || 0)); }
function materialUsed(inv: any) { return Math.max(0, Math.floor(Number(inv?.w || 0) + Number(inv?.s || 0) + Number(inv?.f || 0))); }
function materialCap(p: PlayerRow) { return Math.max(0, Math.floor(Number(storageCapsForPlayer(p)?.total || 0))); }
function materialFree(p: PlayerRow) { const cap = materialCap(p); return cap > 0 ? Math.max(0, cap - materialUsed(invOf(p))) : 999999; }
function addResource(p: PlayerRow, res: string, amount: any) {
  const key = String(res || "");
  const want = Math.max(0, Math.floor(Number(amount || 0)));
  const inv = invOf(p);
  if (!want || !RESOURCE_KEYS.has(key)) return { added: 0, rejected: want, inv };
  if (key === "w" || key === "s" || key === "f") {
    const add = Math.min(want, materialFree(p));
    if (add > 0) inv[key] = Math.max(0, Number(inv[key] || 0) + add);
    return { added: add, rejected: want - add, inv };
  }
  inv[key] = Math.max(0, Number(inv[key] || 0) + want);
  return { added: want, rejected: 0, inv };
}
function gain(p: PlayerRow, bag: Record<string, any>) { for (const [k, v] of Object.entries(bag || {})) addResource(p, k, v); return invOf(p); }
function missing(p: PlayerRow, bag: Record<string, any>) { return Object.entries(bag || {}).filter(([k, v]) => RESOURCE_KEYS.has(k) && have(p, k) < Number(v || 0)).map(([k, v]) => `${Math.ceil(Number(v || 0))}${String((RES_NAMES as any)[k] || k)}`); }
function spend(p: PlayerRow, bag: Record<string, any>) { const miss = missing(p, bag); if (miss.length) return miss; const inv = invOf(p); for (const [k, v] of Object.entries(bag || {})) if (RESOURCE_KEYS.has(k)) inv[k] = Math.max(0, Number(inv[k] || 0) - Number(v || 0)); return [] as string[]; }
function spendEnergy(p: PlayerRow, amount: number) { const n = Math.max(0, Number(amount || 0)); p.energy = Math.max(0, Number(p.energy ?? BASE_MAX) - n); p.energyAt = now(); }
function addXp(p: PlayerRow, amount: number) {
  const n = Math.max(0, Math.floor(Number(amount || 0)));
  if (!n) return;
  p.xp = Math.max(0, Number(p.xp || 0) + n);
  const level = Math.max(1, Math.floor(1 + Math.sqrt(Number(p.xp || 0) / 80)));
  if (level > Number(p.level || 1)) {
    p.skillPts = Math.max(0, Number(p.skillPts || 0)) + (level - Number(p.level || 1));
    p.level = level;
  }
}
function bump(reason = "ecs-gameplay") {
  bumpEcsWorldRev();
  try { metaSet("solcraft:ecs:lastGameplayMutation:v1", JSON.stringify({ at: now(), reason })); } catch {}
}
function libById(kind: string) { return (LIBRARY as any[]).find((b) => String(b?.id || "") === String(kind || "")) || null; }
function isUnderConstruction(b: BuildingRow) { return Number(b?.cdUntil || 0) > now(); }
function markUsed(b: BuildingRow) { b.usedAt = now(); refreshBuilding(b); }
function maxHpFor(b: BuildingRow, def: any = libById(b?.kind)) { return Math.max(10, Number(b?.maxHp || def?.hp || 18) + Math.max(0, Number(b?.level || 1) - 1) * 6); }
function playerNear(p: PlayerRow, x: any, z: any, r = 1) { return cheb(int(p.x), int(p.z), int(x), int(z)) <= r; }
function markNpcGone(x: number, z: number) {
  const row = db.doodads.select().where({ x, z }).first() as any;
  if (row) row.state = "gone";
  else db.doodads.insert({ x, z, state: "gone" });
}
function npcAlreadyGone(x: number, z: number) { return !!db.doodads.select().where({ x, z, state: "gone" }).first(); }
function lootSpot(x: number, z: number, idx: number) {
  const spots = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
  const [dx, dz] = spots[idx % spots.length];
  return { x: x + dx, z: z + dz };
}
function scatterLoot(x: number, z: number, kind: string, amount: number) {
  const n = Math.max(1, Math.min(120, Math.floor(Number(amount || 1))));
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    const s = lootSpot(x, z, i);
    try { insertLoot({ x: s.x, z: s.z, kind, gid: null }); dropped++; } catch {}
  }
  return dropped;
}
function npcGatheredBonus(npc: any) {
  const res = npc?.resource;
  const infra = res === "w" ? "lumber" : res === "s" ? "quarry" : res === "f" ? "farm" : "";
  if (!infra) return { bonus: 0, source: "" };
  const near = (db.buildings.select().where({ kind: infra }).all() as any[]).filter((b) => cheb(Number(b.x), Number(b.z), Number(npc.x), Number(npc.z)) <= 8);
  const bonus = near.reduce((sum, b) => sum + Math.max(1, Math.floor(Number(b.level || 1))), 0);
  return { bonus: Math.min(12, bonus), source: infra === "lumber" ? "nearby Lumber Camp" : infra === "quarry" ? "nearby Quarry" : "nearby Farm" };
}
function completionChannel(p: PlayerRow, kind: "home" | "house" | "wonder") {
  const ch = channels.get(Number(p.id));
  if (!ch || ch.type !== kind) return null;
  return ch;
}


function doodadAt(x: number, z: number): "tree" | "rock" | "food" | "" {
  const row = (db.doodads.select().where({ x, z }).first() as any) || null;
  const state = String(row?.state || "");
  if (state === "gone") return "";
  if (state === "tree" || state === "rock" || state === "food") return state as any;
  const nat = String(naturalDoodad(x, z) || "");
  return nat === "tree" || nat === "rock" || nat === "food" ? nat as any : "";
}
function markDoodadGone(x: number, z: number) {
  const row = (db.doodads.select().where({ x, z }).first() as any) || null;
  if (row) row.state = "gone";
  else db.doodads.insert({ x, z, state: "gone" });
}
function dropHarvestLoot(x: number, z: number, kind: "wood" | "stone", amount: number) {
  const spots = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const;
  let left = Math.max(1, Math.floor(Number(amount || 1)));
  let dropped = 0;
  for (const [dx, dz] of spots) {
    if (left <= 0) break;
    const lx = x + dx, lz = z + dz;
    if (lootAt(lx, lz)) continue;
    const n = Math.min(left, kind === "wood" ? 5 : 4);
    insertLoot({ x: lx, z: lz, kind, gid: String(n) });
    left -= n; dropped += n;
  }
  return dropped;
}
function capitalReserved(x: number, z: number) { return Math.max(Math.abs(x), Math.abs(z)) <= 6; }
function actionClaimAnyFreeTile(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  if (capitalReserved(x, z)) return err("The capital plaza is public land. Claim outside the service ring.", "CAPITAL_RESERVED");
  const existing = (db.tiles.select().where({ x, z }).first() as any) || null;
  if (existing && Number(existing.owner || 0) === Number(p.id)) return ok({ note: `Already yours: ${x},${z}.` });
  if (existing && Number(existing.owner || 0)) return err("That tile is already claimed.", "TILE_TAKEN");
  if (existing) existing.owner = Number(p.id); else db.tiles.insert({ x, z, owner: Number(p.id) });
  addXp(p, 4); refreshPlayer(p); bump("claim-any-free"); mirrorLegacyToEcsTables("claim-any-free");
  return ok({ note: `Claimed ${x},${z}.`, x, z });
}
function actionHarvestStart(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  if (!playerNear(p, x, z)) return err("Walk next to it first.", "TOO_FAR");
  const kind = doodadAt(x, z);
  if (!kind) return err("Nothing to harvest there.", "NO_HARVEST_TARGET");
  const cost = kind === "food" ? 0 : kind === "tree" ? Math.max(0, Number((ECONOMY_RULES as any).chopEnergy || 1)) : Math.max(0, Number((ECONOMY_RULES as any).mineEnergy || 1));
  if (cost > 0 && Number(p.energy ?? BASE_MAX) < cost) return err("Rest a moment before harvesting.", "NO_HARVEST_ENERGY");
  if (cost > 0) spendEnergy(p, cost);
  const ms = kind === "food" ? 900 : Math.max(650, Math.floor(Number(harvestMs((p.skills || {}) as any, kind as any)) || 1300));
  channels.set(Number(p.id), { type: "harvest", x, z, until: now() + ms, kind } as any);
  refreshPlayer(p);
  return ok({ ms, kind, note: kind === "tree" ? "Chopping…" : kind === "rock" ? "Mining…" : "Harvesting…" });
}
function actionHarvestFinish(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  const ch = channels.get(Number(p.id)) as any;
  if (!ch || ch.type !== "harvest" || int(ch.x) !== x || int(ch.z) !== z) return err("Not harvesting that.", "NO_HARVEST_CHANNEL");
  if (now() < Number(ch.until || 0) - 200) return err("Still working…", "HARVEST_PENDING");
  channels.delete(Number(p.id));
  if (!playerNear(p, x, z)) return err("Moved away.", "HARVEST_MOVED");
  const kind = doodadAt(x, z) || ch.kind;
  if (!kind) return err("Already gone.", "HARVEST_GONE");
  markDoodadGone(x, z);
  let note = "Harvested.";
  if (kind === "tree") {
    const amount = Math.max(2, Math.floor(Number((ECONOMY_RULES as any).treeWood || 5)));
    const dropped = dropHarvestLoot(x, z, "wood", amount);
    p.treesChopped = Math.max(0, Number(p.treesChopped || 0)) + 1;
    addXp(p, (XP as any).chop || 8);
    note = `Chopped tree: ${dropped} wood 🪵 dropped nearby.`;
  } else if (kind === "rock") {
    const amount = Math.max(2, Math.floor(Number((ECONOMY_RULES as any).rockStone || 4)));
    const dropped = dropHarvestLoot(x, z, "stone", amount);
    addXp(p, (XP as any).mine || 8);
    note = `Mined rock: ${dropped} stone ⛏ dropped nearby.`;
  } else {
    const amount = 3;
    gain(p, { f: amount });
    addXp(p, 4);
    note = `Harvested crops: +${amount} food 🌾.`;
  }
  refreshPlayer(p); bump("harvest-channel"); mirrorLegacyToEcsTables("harvest-channel");
  return ok({ note, inv: p.inv, kind, x, z });
}
function actionHarvestCancel(p: PlayerRow) { channels.delete(Number(p.id)); return ok(); }
function keepChatCard(b: any) {
  const uid = int(b?.id || b?.uid || 0); const x = int(b?.x), z = int(b?.z);
  const hp = Math.max(0, Math.floor(Number(b?.hp || 0))); const maxHp = Math.max(0, Math.floor(Number(b?.maxHp || 0))); const coins = Math.max(0, Math.floor(Number(b?.stored || b?.coins || 0)));
  return `[[sc:keep|uid=${uid}|x=${x}|z=${z}|label=${encodeURIComponent(`Keep ${x},${z}`)}|hp=${hp}|maxHp=${maxHp}|coins=${coins}]]`;
}
function addSystemChat(msg: string) { try { db.chat.insert({ name: "", msg, sys: 1 }); } catch {} }


function actionPickupLoot(p: PlayerRow, body: any) {
  const id = int(body.id || body.uid || 0);
  const x = int(body.x ?? p.x), z = int(body.z ?? p.z);
  let l: any = null;
  if (id) {
    try { l = (db.loot as any).get ? (db.loot as any).get(id) : null; } catch {}
    if (!l) {
      try { l = (db.loot.select().where({ id }).first() as any) || null; } catch {}
    }
  }
  if (!l) {
    try { l = (db.loot.select().where({ x, z }).first() as any) || null; } catch {}
  }
  if (!l) return err("That pickup was already collected.", "LOOT_GONE");
  if (!playerNear(p, l.x, l.z, 0)) return err("Stand on the pickup to collect it.", "TOO_FAR");
  let note = "Picked up.";
  const kind = String(l.kind || "");
  const materialMap: any = { wood: ["w", "wood 🪵", 5], stone: ["s", "stone 🪨", 4], food: ["f", "food 🌾", 3] };
  const material = materialMap[kind];
  if (material) {
    const [res, label, fallback] = material;
    const amount = Math.max(1, Math.floor(Number(l.gid || fallback) || fallback));
    const free = materialFree(p);
    if (free <= 0) return err("Shared storage is full. Build a Warehouse or spend materials before collecting more.", "STORAGE_FULL", { inv: p.inv, storageCap: storageCapsForPlayer(p) });
    const take = Math.min(amount, free);
    const added = addResource(p, res, take).added;
    const left = amount - added;
    if (left > 0) {
      try { l.gid = String(left); } catch {}
      try { db.query("update loot set gid = ? where id = ?").run(String(left), Number(l.id)); } catch {}
      note = `Picked up +${added} ${label}. Storage full — ${left} left on the ground.`;
    } else {
      try { (db.loot as any).delete?.(Number(l.id)); } catch {
        try { db.query("delete from loot where id = ?").run(Number(l.id)); } catch {}
      }
      note = `Picked up +${added} ${label}.`;
    }
  } else if (kind === "gold" || kind === "coin" || kind === "coins") {
    try { (db.loot as any).delete?.(Number(l.id)); } catch { try { db.query("delete from loot where id = ?").run(Number(l.id)); } catch {} }
    const amount = Math.max(1, Math.floor(Number(l.gid || 3) || 3));
    gain(p, { g: amount });
    note = `Picked up +${amount} coins 🪙.`;
  } else {
    try { (db.loot as any).delete?.(Number(l.id)); } catch { try { db.query("delete from loot where id = ?").run(Number(l.id)); } catch {} }
    const amount = Math.max(1, Math.floor(Number(l.gid || 1) || 1));
    gain(p, { g: amount });
    note = `Picked up +${amount} coins 🪙.`;
  }
  addXp(p, 1);
  refreshPlayer(p); bump("pickup"); mirrorLegacyToEcsTables("pickup");
  return ok({ note, lootGone: Number(l.id || 0), inv: p.inv, xp: p.xp, level: p.level });
}

function actionCustomize(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b || Number(b.owner || 0) !== Number(p.id)) return err("Not your building.", "NOT_OWNER");
  if (body.nm !== undefined) b.nm = String(body.nm || "").trim().slice(0, 16) || null;
  if (body.cl !== undefined) {
    const color = cleanHex(body.cl);
    if (body.cl && !color) return err("Choose one of the safe building colors.", "BAD_COLOR");
    b.cl = color || null;
  }
  refreshBuilding(b); bump("customize");
  return ok({ note: "Building customized." });
}

function actionCustomizerAccess(p: PlayerRow, body: any) {
  const uid = int(body.uid || body.target || 0);
  const b = getBuilding(uid);
  if (!b) return err("Customizer building not found.", "BUILDING_NOT_FOUND");
  if (String(b.kind || "") !== "alchemy") return err("That building is not a character customizer.", "NOT_CUSTOMIZER");
  if (Number(b.owner || 0) !== Number(p.id) && Number(b.owner || 0) !== 0) return err("Use your own customizer or a capital tailor.", "NOT_OWNER");
  if (!playerNear(p, b.x, b.z, 1)) return err("Stand beside the customizer first.", "TOO_FAR");
  const cost = Math.max(0, Math.floor(Number(process.env.SOLCRAFT_CUSTOMIZER_COIN_COST || 1) || 1));
  if (cost > 0) {
    if (have(p, "g") < cost) return err(`Customizer access costs ${cost}🪙.`, "CUSTOMIZER_NEEDS_COINS", { cost: { g: cost } });
    spend(p, { g: cost });
  }
  const expiresAt = now() + 10 * 60_000;
  try { metaSet(`solcraft:customizer:access:${p.id}`, JSON.stringify({ uid: b.id, at: now(), expiresAt, cost })); } catch {}
  refreshPlayer(p); bump("customizer-access"); mirrorLegacyToEcsTables("customizer-access");
  return ok({ service: "customizer", access: { uid: b.id, expiresAt, cost }, inv: p.inv, note: cost ? `Customizer unlocked for ${cost}🪙.` : "Customizer unlocked." });
}

function actionRepair(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b || Number(b.owner || 0) !== Number(p.id)) return err("Not your building.", "NOT_OWNER");
  if (!playerNear(p, b.x, b.z)) return err("Walk next to it first.", "TOO_FAR");
  const maxHp = maxHpFor(b);
  const missingHp = maxHp - Number(b.hp || 0);
  if (missingHp <= 0) return err("Already in perfect shape.", "ALREADY_REPAIRED");
  const cost = { w: Math.max(1, Math.ceil(missingHp / 14)), s: Math.max(1, Math.ceil(missingHp / 10)) };
  const miss = spend(p, cost);
  if (miss.length) return err(`Repairs need: ${miss.join(", ")}.`, "REPAIR_COST");
  b.hp = maxHp; b.maxHp = maxHp;
  refreshPlayer(p); refreshBuilding(b); bump("repair");
  return ok({ note: `🔧 ${b.nm || libById(b.kind)?.name || "Building"} fully repaired.`, inv: p.inv, building: { uid: b.id, hp: b.hp, maxHp: b.maxHp } });
}

function actionUseBuilding(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b) return err("That target is no longer there.", "BUILDING_NOT_FOUND");
  if (!playerNear(p, b.x, b.z)) return err("Walk next to it first.", "TOO_FAR");
  const def = libById(String(b.kind || ""));
  if (!def) return err("Unknown building.", "UNKNOWN_BUILDING");
  if (isUnderConstruction(b)) return err(`${b.nm || def.name || "Building"} is still under construction — ${Math.ceil((Number(b.cdUntil || 0) - now()) / 1000)}s left.`, "UNDER_CONSTRUCTION");
  markUsed(b);
  if (Number(b.owner || 0) && Number(b.owner || 0) !== Number(p.id)) return ok({ cosmetic: true, usedAt: b.usedAt, note: `${def.name || "Building"} responds, but only its owner can operate it.` });
  if (b.kind === "lumber") return ok({ note: "Lumber Camp is active — it spawns trees nearby. Cut and gather them manually." });
  if (b.kind === "quarry") return ok({ note: "Quarry is active — it exposes rocks nearby. Mine and gather them manually." });
  if (b.kind === "farm") return ok({ note: "Farm is active — it grows crops nearby. Cut and gather crops for food." });
  if (b.kind === "warehouse") return ok({ note: "Warehouse active — storage caps are online. If it falls, excess resources rot down to your cap." });
  if (b.kind === "vault") return ok({ service: "bank", note: "Bank vault active. Deposit and Withdraw live from the building preview when banking is enabled." });
  if (b.kind === "alchemy") return ok({ service: "customizer", cost: { g: 1 }, note: "Customizer active. Changing your doll costs 1 coin from this building." });
  if (b.kind === "market") return ok({ service: "market", note: "Market active. Player escrow is removed; clean market rates will be configured later." });
  if (b.kind === "townhall") return ok({ note: "Town Hall active — settlement authority is online." });
  return ok({ cosmetic: true, note: `${def.name || "Building"} responds.` });
}

function actionCollectGoldMine(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b || Number(b.owner || 0) !== Number(p.id)) return err("Not your building.", "NOT_OWNER");
  if (!playerNear(p, b.x, b.z)) return err("Walk next to it first.", "TOO_FAR");
  const stored = Math.max(0, Math.floor(Number(b.stored || 0)));
  const passive = Math.max(0, Math.floor((now() - Number(b.accAt || now())) / 15000) * Math.max(1, Number(b.level || 1)));
  const coins = Math.max(0, stored + passive);
  if (!coins) return err("No coins to collect yet.", "NO_COINS");
  gain(p, { g: coins });
  b.stored = 0; b.accAt = now(); markUsed(b);
  refreshPlayer(p); refreshBuilding(b); bump("collect-goldmine");
  return ok({ note: `Collected +${coins}🪙 from ${b.nm || "Gold Mine"}.`, inv: p.inv });
}

function actionTalkNpc(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  const npc = proceduralNpcAt(x, z);
  if (!npc || npcAlreadyGone(x, z)) return err("Nobody is there anymore.", "NPC_GONE");
  if (!playerNear(p, x, z)) return err("Stand beside the traveler first.", "TOO_FAR");
  return ok({ npc, note: `${npc.name}: The roads are dangerous. Coins buy goodwill; blades buy trouble.` });
}

function actionDonateNpc(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  const npc = proceduralNpcAt(x, z);
  if (!npc || npcAlreadyGone(x, z)) return err("Nobody is there anymore.", "NPC_GONE");
  if (!playerNear(p, x, z)) return err("Stand beside the traveler first.", "TOO_FAR");
  const coinCost = 5;
  if (have(p, "g") < coinCost) return err(`Donate ${coinCost}🪙 to earn reputation. Coins are separate from storage.`, "DONATION_NEEDS_COINS");
  spend(p, { g: coinCost });
  p.hp = Math.min(MAX_HP, Math.max(1, Number(p.hp || MAX_HP)) + 3);
  addXp(p, 8);
  markNpcGone(x, z);
  const rep = adjustReputation(Number(p.id), reputationDeltaFor("npcDonate"), "npcDonate");
  refreshPlayer(p); bump("donate-npc"); mirrorLegacyToEcsTables("donate-npc");
  return ok({ note: `Donated ${coinCost}🪙 to ${npc.title || "traveler"}. +3♥ goodwill, +8 XP. ${reputationDeltaText(rep)}`, player: { hp: p.hp, maxHp: MAX_HP }, inv: p.inv, reputation: reputationSummaryForWire(Number(p.id)) });
}

function actionAttackNpc(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  const npc = proceduralNpcAt(x, z);
  if (!npc || npcAlreadyGone(x, z)) return err("Nobody is there anymore.", "NPC_GONE");
  if (!playerNear(p, x, z)) return err("Stand beside the traveler first.", "TOO_FAR");
  if (Number(p.energy ?? BASE_MAX) < SWORD_COST) return err(`Need ${SWORD_COST}⚡ to swing your sword.`, "NO_ATTACK_ENERGY");
  if (Number(p.hp || MAX_HP) <= Math.max(2, Number(npc.attack || 3))) return err("Too hurt to risk that fight.", "LOW_HEALTH");
  spendEnergy(p, SWORD_COST);
  p.hp = Math.max(1, Number(p.hp || MAX_HP) - Math.max(1, Math.floor(Number(npc.attack || 3))));
  markNpcGone(x, z);
  const bonus = npcGatheredBonus(npc);
  const carried = Math.max(1, Math.floor(Number(npc.resourceAmount || 1) + bonus.bonus));
  const coins = scatterLoot(x, z, "gold", Number(npc.coins || 0));
  const resKind = npc.resource === "s" ? "stone" : npc.resource === "f" ? "food" : "wood";
  const resources = scatterLoot(x, z, resKind, carried);
  addXp(p, XP.fight || 4);
  const rep = adjustReputation(Number(p.id), reputationDeltaFor("npcKill"), "npcKill");
  refreshPlayer(p); bump("attack-npc"); mirrorLegacyToEcsTables("attack-npc");
  return ok({ note: `${npc.title || "Traveler"} defeated. Loot dropped nearby${bonus.bonus ? ` from ${bonus.source}` : ""}. ${reputationDeltaText(rep)}`, player: { hp: p.hp, maxHp: MAX_HP }, dropped: { coins, resources, kind: resKind }, npc: { id: npc.id, x, z }, reputation: reputationSummaryForWire(Number(p.id)) });
}

function actionDonateKeep(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b || Number(b.owner || 0) !== 0 || String(b.kind || "") !== "keep") return err("That is not a neutral Keep.", "NOT_KEEP");
  if (!playerNear(p, b.x, b.z)) return err("Walk beside the Keep first.", "TOO_FAR");
  const amount = Math.max(1, Math.min(50, int(body.amount || 10, 10)));
  if (have(p, "g") < amount) return err(`Keep tribute needs ${amount}🪙.`, "DONATION_NEEDS_COINS");
  spend(p, { g: amount });
  b.stored = Math.max(0, Math.floor(Number(b.stored || 0)) + amount);
  b.maxHp = maxHpFor(b);
  b.hp = Math.min(Number(b.maxHp || b.hp || 1), Math.max(1, Number(b.hp || 1)) + Math.max(1, Math.floor(amount / 2)));
  b.accAt = now(); markUsed(b); addXp(p, Math.max(4, Math.floor(amount / 2)));
  const rep = adjustReputation(Number(p.id), Math.max(1, reputationDeltaFor("keepDonate", Math.ceil(amount / 10))), "keepDonate");
  refreshPlayer(p); refreshBuilding(b); bump("donate-keep"); mirrorLegacyToEcsTables("donate-keep");
  return ok({ note: `Donated ${amount}🪙 to ${b.nm || "the Keep"}. ${reputationDeltaText(rep)}`, keep: { uid: b.id, hp: b.hp, maxHp: b.maxHp, stored: b.stored }, inv: p.inv, reputation: reputationSummaryForWire(Number(p.id)) });
}

function actionRaidKeep(p: PlayerRow, body: any) {
  const uid = int(body.uid || body.target || 0);
  const b = getBuilding(uid);
  if (!b) return err("That target is no longer there.", "BUILDING_NOT_FOUND");
  if (!playerNear(p, b.x, b.z)) return err("Stand beside it to attack it.", "TOO_FAR");
  if (Number(p.energy ?? BASE_MAX) < RAID_COST) return err(`Need ${RAID_COST}⚡ to attack.`, "NO_RAID_ENERGY");
  spendEnergy(p, RAID_COST);
  const isKeep = Number(b.owner || 0) === 0 && String(b.kind || "") === "keep";
  const damage = isKeep ? 12 : 6;
  b.hp = Math.max(0, Number(b.hp || maxHpFor(b)) - damage);
  let note = isKeep ? `Raid hit the Keep for ${damage} damage.` : `Siege hit for ${damage} damage.`;
  if (b.hp <= 0) {
    const stored = Math.max(0, Math.floor(Number(b.stored || 0)));
    if (stored > 0) gain(p, { g: stored });
    deleteBuilding(Number(b.id));
    const rep = adjustReputation(Number(p.id), reputationDeltaFor(isKeep ? "keepBreach" : "buildingAttack"), isKeep ? "keepBreach" : "buildingAttack");
    addXp(p, isKeep ? XP.raidKill || 22 : 8);
    note = `${isKeep ? "Keep breached" : "Building destroyed"}. ${stored ? `Recovered ${stored}🪙. ` : ""}${reputationDeltaText(rep)}`;
  } else {
    if (isKeep) {
      const coins = Math.min(Math.max(0, Math.floor(Number(b.stored || 0))), 3);
      if (coins) { b.stored = Math.max(0, Math.floor(Number(b.stored || 0)) - coins); gain(p, { g: coins }); note += ` Looted ${coins}🪙.`; }
      const rep = adjustReputation(Number(p.id), reputationDeltaFor("keepRaid"), "keepRaid");
      note += ` ${reputationDeltaText(rep)}`;
    }
    refreshBuilding(b);
  }
  refreshPlayer(p); bump("raid"); mirrorLegacyToEcsTables("raid");
  try { if (isKeep) addSystemChat(keepChatCard(b)); } catch {}
  return ok({ note, player: { hp: p.hp, energy: p.energy }, building: b.hp > 0 ? { uid: b.id, hp: b.hp, maxHp: b.maxHp } : null, inv: p.inv, reputation: reputationSummaryForWire(Number(p.id)) });
}

function actionFightPlayer(p: PlayerRow, body: any) {
  const targetId = int(body.target || body.uid || body.id || body.playerId || 0);
  if (!targetId || targetId === Number(p.id)) return err("Choose another player to attack.", "BAD_TARGET");
  const target = getPlayer(targetId) as PlayerRow | null;
  if (!target) return err("That player is no longer nearby.", "PLAYER_NOT_FOUND");
  if (!playerNear(p, target.x, target.z, 1)) return err("Stand beside that player first.", "TOO_FAR");
  if (Number(p.hp || MAX_HP) <= 1) return err("You are too hurt to fight.", "LOW_HEALTH");
  p.hp = Math.max(1, Number(p.hp || MAX_HP) - 1);
  target.hp = Math.max(1, Number(target.hp || MAX_HP) - 1);
  spendEnergy(p, 1);
  const rep = adjustReputation(Number(p.id), reputationDeltaFor("playerAttack"), "playerAttack");
  refreshPlayer(p);
  refreshPlayer(target);
  bump("fight-player");
  mirrorLegacyToEcsTables("fight-player");
  return ok({
    note: `You sparred with ${target.name || "another settler"}. Both players lost 1♥. ${reputationDeltaText(rep)}`,
    player: { hp: p.hp, energy: p.energy },
    target: { id: target.id, hp: target.hp },
    reputation: reputationSummaryForWire(Number(p.id)),
  });
}

function actionHomeStart(p: PlayerRow) {
  if (int(p.x) === int(p.spawnX) && int(p.z) === int(p.spawnZ)) return err("Already at your flag.", "ALREADY_HOME");
  if (TELEPORT_COST > 0 && Number(p.energy ?? BASE_MAX) < TELEPORT_COST) return err(`Need ${TELEPORT_COST}⚡ to return to your flag.`, "NO_TELEPORT_ENERGY");
  if (TELEPORT_COST > 0) { spendEnergy(p, TELEPORT_COST); refreshPlayer(p); }
  channels.set(Number(p.id), { type: "home", x: int(p.x), z: int(p.z), until: now() + TELEPORT_MS });
  return ok({ ms: TELEPORT_MS, note: "Return Scroll casting… stand still until the flag answers." });
}
function actionHomeFinish(p: PlayerRow) {
  const ch = completionChannel(p, "home");
  if (!ch) return err("Not returning home.", "NO_TELEPORT_CHANNEL");
  if (now() < ch.until - 250) return err("Still returning…", "TELEPORT_PENDING");
  if (int(p.x) !== ch.x || int(p.z) !== ch.z) { channels.delete(Number(p.id)); return err("Teleport cancelled because you moved.", "TELEPORT_MOVED"); }
  p.x = int(p.spawnX); p.z = int(p.spawnZ); channels.delete(Number(p.id)); refreshPlayer(p); bump("home");
  return ok({ note: "Return Scroll complete. Back at your flag.", x: p.x, z: p.z });
}
function actionHomeCancel(p: PlayerRow) { channels.delete(Number(p.id)); return ok(); }

function houseLanding(x: number, z: number) { return { x: int(x) + 1, z: int(z) }; }
function actionHouseStart(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b || Number(b.owner || 0) !== Number(p.id) || !(String(b.kind || "") === "cottage" || String(b.kind || "") === "house")) return err("That House is not yours.", "NOT_HOUSE");
  if (playerNear(p, b.x, b.z, 1)) return err("Already at that House.", "ALREADY_THERE");
  channels.set(Number(p.id), { type: "house", x: int(p.x), z: int(p.z), until: now() + TELEPORT_MS, uid: Number(b.id), tx: int(b.x), tz: int(b.z) });
  return ok({ ms: TELEPORT_MS, note: `${b.nm || "House"} travel casting… stand still until the route opens.` });
}
function actionHouseFinish(p: PlayerRow) {
  const ch = completionChannel(p, "house");
  if (!ch) return err("Not travelling to a House.", "NO_TELEPORT_CHANNEL");
  if (now() < ch.until - 250) return err("Still travelling…", "TELEPORT_PENDING");
  if (int(p.x) !== ch.x || int(p.z) !== ch.z) { channels.delete(Number(p.id)); return err("Teleport cancelled because you moved.", "TELEPORT_MOVED"); }
  const b = getBuilding(Number(ch.uid || 0));
  if (!b || Number(b.owner || 0) !== Number(p.id) || !(String(b.kind || "") === "cottage" || String(b.kind || "") === "house")) { channels.delete(Number(p.id)); return err("That House is gone.", "HOUSE_GONE"); }
  const spot = houseLanding(Number(b.x), Number(b.z));
  p.x = spot.x; p.z = spot.z; channels.delete(Number(p.id)); refreshPlayer(p); bump("house-teleport");
  return ok({ note: `Arrived at ${b.nm || "House"}. Houses are your fast-travel points.`, x: p.x, z: p.z });
}
function actionHouseCancel(p: PlayerRow) { channels.delete(Number(p.id)); return ok(); }

function actionWonderStart(p: PlayerRow, body: any) {
  const b = getBuilding(int(body.uid));
  if (!b || Number(b.owner || 0) !== Number(p.id) || String(b.kind || "") !== "worldwonder") return err("That World Wonder is not yours.", "NOT_WONDER");
  if (playerNear(p, b.x, b.z, 2)) return err("Already at that World Wonder.", "ALREADY_THERE");
  channels.set(Number(p.id), { type: "wonder", x: int(p.x), z: int(p.z), until: now() + TELEPORT_MS, uid: Number(b.id), tx: int(b.x), tz: int(b.z) });
  return ok({ ms: TELEPORT_MS, note: `Wonder Scroll casting… ${b.nm || "World Wonder"} is answering.` });
}
function actionWonderFinish(p: PlayerRow) {
  const ch = completionChannel(p, "wonder");
  if (!ch) return err("Not travelling to a Wonder.", "NO_TELEPORT_CHANNEL");
  if (now() < ch.until - 250) return err("Still travelling…", "TELEPORT_PENDING");
  if (int(p.x) !== ch.x || int(p.z) !== ch.z) { channels.delete(Number(p.id)); return err("Teleport cancelled because you moved.", "TELEPORT_MOVED"); }
  p.x = int(ch.tx); p.z = int(ch.tz); channels.delete(Number(p.id)); refreshPlayer(p); bump("wonder-teleport");
  return ok({ note: "Wonder Scroll complete.", x: p.x, z: p.z });
}
function actionGuideVisit(p: PlayerRow, body: any) {
  const id = String(body.id || body.panel || "").trim().slice(0, 48);
  if (!id) return ok();
  const raw = String(metaGet(`solcraft:guide:visits:${p.id}`, "[]") || "[]");
  let arr: string[] = [];
  try { arr = JSON.parse(raw); } catch {}
  if (!arr.includes(id)) arr.push(id);
  metaSet(`solcraft:guide:visits:${p.id}`, JSON.stringify(arr.slice(-80)));
  return ok({ guideVisits: arr });
}
function actionWallet(p: PlayerRow, body: any) {
  const addr = String(body.addr || body.wallet || "").trim();
  if (!addr) return err("Wallet address is empty.", "BAD_WALLET");
  if (p.wallet && p.wallet !== addr) return err("Wallet is linked through Phantom sign-in. Log out and reconnect to change it.", "WALLET_BOUND");
  p.wallet = addr; refreshPlayer(p); return ok({ wallet: addr, note: "Wallet linked." });
}

export function ecsGameplaySupportedActionTypes() { return [...DIRECT_ACTIONS].sort(); }

export function dispatchEcsGameplayAction(playerLike: PlayerRow, body: any): EcsGameplayResult {
  const type = String(body?.type || "");
  const removed = removedFeatureResponse(type);
  if (removed) return { handled: true, result: err(removed.msg, removed.reasonCode, removed) };
  if (!DIRECT_ACTIONS.has(type)) return { handled: false };
  const p = getPlayer(playerLike?.id) as PlayerRow || playerLike;
  if (!p) return { handled: true, result: err("Unknown player", "PLAYER_NOT_FOUND") };
  try {
    if (type === "claim") return { handled: true, result: actionClaimAnyFreeTile(p, body) };
    if (type === "harvestStart") return { handled: true, result: actionHarvestStart(p, body) };
    if (type === "harvestFinish") return { handled: true, result: actionHarvestFinish(p, body) };
    if (type === "harvestCancel") return { handled: true, result: actionHarvestCancel(p) };
    if (type === "pickup") return { handled: true, result: actionPickupLoot(p, body) };
    if (type === "customize") return { handled: true, result: actionCustomize(p, body) };
    if (type === "customizerAccess") return { handled: true, result: actionCustomizerAccess(p, body) };
    if (type === "repair") return { handled: true, result: actionRepair(p, body) };
    if (type === "use") return { handled: true, result: actionUseBuilding(p, body) };
    if (type === "talkNpc") return { handled: true, result: actionTalkNpc(p, body) };
    if (type === "donateNpc") return { handled: true, result: actionDonateNpc(p, body) };
    if (type === "attackNpc") return { handled: true, result: actionAttackNpc(p, body) };
    if (type === "donateKeep") return { handled: true, result: actionDonateKeep(p, body) };
    if (type === "fight") return { handled: true, result: actionFightPlayer(p, body) };
    if (type === "raid" || type === "attack") return { handled: true, result: actionRaidKeep(p, body) };
    if (type === "home" || type === "homeStart") return { handled: true, result: actionHomeStart(p) };
    if (type === "homeFinish") return { handled: true, result: actionHomeFinish(p) };
    if (type === "homeCancel") return { handled: true, result: actionHomeCancel(p) };
    if (type === "houseStart") return { handled: true, result: actionHouseStart(p, body) };
    if (type === "houseFinish") return { handled: true, result: actionHouseFinish(p) };
    if (type === "houseCancel") return { handled: true, result: actionHouseCancel(p) };
    if (type === "wonderStart") return { handled: true, result: actionWonderStart(p, body) };
    if (type === "wonderFinish") return { handled: true, result: actionWonderFinish(p) };
    if (type === "wonderCancel") { channels.delete(Number(p.id)); return { handled: true, result: ok() }; }
    if (type === "wallet") return { handled: true, result: actionWallet(p, body) };
    return { handled: true, result: err(`ECS gameplay action missing: ${type}`, "ECS_GAMEPLAY_NOT_IMPLEMENTED") };
  } catch (e: any) {
    return { handled: true, result: err(String(e?.message || e || "ECS gameplay failed"), e?.reasonCode || "ECS_GAMEPLAY_EXCEPTION") };
  }
}

export function ecsGameplayStatus() {
  return {
    supported: ecsGameplaySupportedActionTypes(),
    channels: channels.size,
    lastMutation: (() => { try { return JSON.parse(metaGet("solcraft:ecs:lastGameplayMutation:v1", "{}") || "{}"); } catch { return {}; } })(),
    biomeAtOrigin: biomeAt(0, 0).id,
  };
}