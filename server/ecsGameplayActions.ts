import { db, metaGet, metaSet } from "./db";
import { getPlayer, refreshPlayer } from "./playerStore";
import { deleteBuilding, getBuilding, refreshBuilding } from "./buildingStore";
import { insertLoot } from "./lootStore";
import { adjustReputation, reputationDeltaFor, reputationDeltaText, reputationSummaryForWire } from "./reputationRules";
import { removedFeatureResponse } from "./removedFeatures";
import { bumpEcsWorldRev, mirrorLegacyToEcsTables } from "./ecsDbAdapter";
import { BASE_MAX, GOLD_MINE_KIND, LIBRARY, MAX_HP, RAID_COST, RES_KEYS, RES_NAMES, TELEPORT_COST, TELEPORT_MS, XP, biomeAt, cheb, proceduralNpcAt } from "./shared";

export type EcsGameplayResult = { handled: boolean; result?: any };

type PlayerRow = Record<string, any>;
type BuildingRow = Record<string, any>;
type ResBag = Record<string, number>;

const SWORD_COST = Math.max(1, Number(process.env.SOLCRAFT_SWORD_ENERGY_COST || 4) || 4);
const RESOURCE_KEYS = new Set<string>(RES_KEYS as any);
const DIRECT_ACTIONS = new Set([
  "harvestCancel",
  "repair",
  "customize",
  "use",
  "talkNpc",
  "attackNpc",
  "donateNpc",
  "donateKeep",
  "raid",
  "attack",
  "home",
  "homeStart",
  "homeFinish",
  "homeCancel",
  "wonderStart",
  "wonderFinish",
  "wonderCancel",
  "wallet",
]);

const channels = new Map<number, { type: "home" | "wonder"; x: number; z: number; until: number; uid?: number; tx?: number; tz?: number }>();

function now() { return Date.now(); }
function ok(extra: Record<string, any> = {}) { return { ok: true, ...extra, backend: "ecs" }; }
function err(msg: string, reasonCode = "ECS_GAMEPLAY_FAILED", extra: Record<string, any> = {}) { return { ok: false, msg, reasonCode, ...extra, backend: "ecs" }; }
function int(v: any, fallback = 0) { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : fallback; }
function cleanHex(v: any) { const s = String(v || "").trim(); return /^#[0-9a-fA-F]{6}$/.test(s) ? s : ""; }
function invOf(p: PlayerRow): ResBag { const inv = p.inv && typeof p.inv === "object" ? p.inv : {}; p.inv = inv; return inv as ResBag; }
function have(p: PlayerRow, res: string) { return Math.max(0, Number(invOf(p)[res] || 0)); }
function gain(p: PlayerRow, bag: Record<string, any>) { const inv = invOf(p); for (const [k, v] of Object.entries(bag || {})) if (RESOURCE_KEYS.has(k)) inv[k] = Math.max(0, Number(inv[k] || 0) + Number(v || 0)); return inv; }
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
function completionChannel(p: PlayerRow, kind: "home" | "wonder") {
  const ch = channels.get(Number(p.id));
  if (!ch || ch.type !== kind) return null;
  return ch;
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
  if (!b) return err("Gone.", "BUILDING_NOT_FOUND");
  if (!playerNear(p, b.x, b.z)) return err("Walk next to it first.", "TOO_FAR");
  const def = libById(String(b.kind || ""));
  if (!def) return err("Unknown building.", "UNKNOWN_BUILDING");
  if (isUnderConstruction(b)) return err(`${b.nm || def.name || "Building"} is still under construction — ${Math.ceil((Number(b.cdUntil || 0) - now()) / 1000)}s left.`, "UNDER_CONSTRUCTION");
  markUsed(b);
  if (Number(b.owner || 0) !== Number(p.id)) return ok({ cosmetic: true, usedAt: b.usedAt, note: `${def.name || "Building"} responds, but only its owner can operate it.` });
  const prod = def.prod || def.produces || {};
  const first = Object.entries(prod).find(([, v]) => Number(v || 0) > 0) as [string, any] | undefined;
  if (first) {
    const elapsed = Math.max(0, now() - Number(b.accAt || now())) / 1000;
    const amount = Math.floor(Number(b.acc || 0) + elapsed * Number(first[1] || 0) * Math.max(1, Number(b.level || 1)));
    if (amount > 0) {
      gain(p, { [first[0]]: amount });
      b.acc = 0; b.accAt = now();
      refreshPlayer(p); refreshBuilding(b); bump("use-producer");
      return ok({ note: `Collected +${amount} ${String((RES_NAMES as any)[first[0]] || first[0])} from ${b.nm || def.name}.`, inv: p.inv });
    }
  }
  if (b.kind === "warehouse") return ok({ note: "Warehouse active — storage is online." });
  if (b.kind === "granary") return ok({ note: "Granary active — food storage is online." });
  if (b.kind === "townhall") return ok({ note: "Town Hall active — territory authority is online." });
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
  return ok({ npc, note: `${npc.name}: The roads are dangerous. Supplies buy goodwill; blades buy trouble.` });
}

function actionDonateNpc(p: PlayerRow, body: any) {
  const x = int(body.x), z = int(body.z);
  const npc = proceduralNpcAt(x, z);
  if (!npc || npcAlreadyGone(x, z)) return err("Nobody is there anymore.", "NPC_GONE");
  if (!playerNear(p, x, z)) return err("Stand beside the traveler first.", "TOO_FAR");
  const cost = have(p, "f") >= 2 ? { f: 2 } : have(p, "w") >= 3 ? { w: 3 } : null;
  if (!cost) return err("Donate 2 food or 3 wood.", "DONATION_NEEDS_SUPPLIES");
  spend(p, cost);
  p.hp = Math.min(MAX_HP, Math.max(1, Number(p.hp || MAX_HP)) + 3);
  addXp(p, 8);
  markNpcGone(x, z);
  const rep = adjustReputation(Number(p.id), reputationDeltaFor("npcDonate"), "npcDonate");
  refreshPlayer(p); bump("donate-npc"); mirrorLegacyToEcsTables("donate-npc");
  return ok({ note: `Donated supplies to ${npc.title || "traveler"}. +3♥ goodwill, +8 XP. ${reputationDeltaText(rep)}`, player: { hp: p.hp, maxHp: MAX_HP }, inv: p.inv, reputation: reputationSummaryForWire(Number(p.id)) });
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
  if (!b) return err("Gone.", "BUILDING_NOT_FOUND");
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
  return ok({ note, player: { hp: p.hp, energy: p.energy }, building: b.hp > 0 ? { uid: b.id, hp: b.hp, maxHp: b.maxHp } : null, inv: p.inv, reputation: reputationSummaryForWire(Number(p.id)) });
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
    if (type === "harvestCancel") return { handled: true, result: ok() };
    if (type === "customize") return { handled: true, result: actionCustomize(p, body) };
    if (type === "repair") return { handled: true, result: actionRepair(p, body) };
    if (type === "use") return { handled: true, result: actionUseBuilding(p, body) };
    if (type === "talkNpc") return { handled: true, result: actionTalkNpc(p, body) };
    if (type === "donateNpc") return { handled: true, result: actionDonateNpc(p, body) };
    if (type === "attackNpc") return { handled: true, result: actionAttackNpc(p, body) };
    if (type === "donateKeep") return { handled: true, result: actionDonateKeep(p, body) };
    if (type === "raid" || type === "attack") return { handled: true, result: actionRaidKeep(p, body) };
    if (type === "home" || type === "homeStart") return { handled: true, result: actionHomeStart(p) };
    if (type === "homeFinish") return { handled: true, result: actionHomeFinish(p) };
    if (type === "homeCancel") return { handled: true, result: actionHomeCancel(p) };
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
