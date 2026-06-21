// @ts-nocheck
/**
 * Neutral Keep raid tuning lives here so the MMO coordination loop is explicit
 * and testable outside the large engine dispatcher.
 *
 * Loop:
 * shared keep card -> group walks there -> repeated manual attacks -> keep
 * regenerates between hits -> every hit hurts the attacker -> coins are won by
 * chipping/breaching the Keep.
 */

export const KEEP_RAID_RULES = {
  baseDamage: 12,
  maxDamage: 80,
  regenIntervalMs: 5000,
  regenPerTick: 7,
  backlashMin: 7,
  backlashMax: 13,
  minHealthToRaid: 12,
  coinChipMin: 1,
  coinChipDivisor: 5,
} as const;

function cleanNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function cleanInt(v: any, fallback = 0, min = -100000000, max = 100000000) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function isNeutralKeepLike(b: any) {
  return !!b && String(b.kind || "") === "keep" && Number(b.owner || 0) === 0;
}

export function applyKeepRegen(keep: any, t = Date.now(), rules = KEEP_RAID_RULES) {
  if (!isNeutralKeepLike(keep)) return { ticks: 0, recovered: 0, hp: cleanNum(keep?.hp, 0) };
  const maxHp = Math.max(1, cleanInt(keep.maxHp || keep.hp || 1, 1));
  const hp0 = Math.max(0, Math.min(maxHp, cleanNum(keep.hp, maxHp)));
  const last = Math.max(0, cleanInt(keep.accAt == null ? t : keep.accAt, t));
  const elapsed = Math.max(0, cleanInt(t, Date.now()) - last);
  const ticks = Math.floor(elapsed / Math.max(1, rules.regenIntervalMs));
  if (ticks <= 0 || hp0 >= maxHp) return { ticks: 0, recovered: 0, hp: hp0 };
  const hp = Math.min(maxHp, hp0 + ticks * rules.regenPerTick);
  const recovered = Math.max(0, hp - hp0);
  keep.hp = hp;
  keep.accAt = last + ticks * rules.regenIntervalMs;
  return { ticks, recovered, hp };
}

export function keepRaidDamage(siegeBonus = 0, rules = KEEP_RAID_RULES) {
  return Math.max(1, Math.min(rules.maxDamage, rules.baseDamage + cleanInt(siegeBonus, 0, 0, 1000)));
}

export function keepBacklash(rand: any = Math.random, rules = KEEP_RAID_RULES) {
  const r = typeof rand === "function" ? Number(rand()) : Number(rand);
  const unit = Number.isFinite(r) ? Math.max(0, Math.min(0.999999, r)) : Math.random();
  return rules.backlashMin + Math.floor(unit * (rules.backlashMax - rules.backlashMin + 1));
}

export function keepCoinChip(stored: any, damage: any, rules = KEEP_RAID_RULES) {
  const left = cleanInt(stored, 0, 0, 100000000);
  if (left <= 0) return 0;
  const dmg = cleanInt(damage, 0, 0, 1000000);
  return Math.max(0, Math.min(left, Math.max(rules.coinChipMin, Math.floor(dmg / Math.max(1, rules.coinChipDivisor)))));
}

export function keepRaidHitPreview(input: any = {}, rules = KEEP_RAID_RULES) {
  const hp = cleanNum(input.playerHp, 0);
  if (hp <= rules.minHealthToRaid) {
    return { ok: false, reasonCode: "LOW_HEALTH", msg: "Too hurt to raid. Eat food and recover first." };
  }
  const damage = keepRaidDamage(input.siegeBonus || 0, rules);
  const backlash = keepBacklash(input.random ?? Math.random, rules);
  const coins = keepCoinChip(input.stored || 0, damage, rules);
  return {
    ok: true,
    damage,
    backlash,
    coins,
    playerHpAfter: Math.max(1, hp - backlash),
    storedAfter: Math.max(0, cleanInt(input.stored || 0) - coins),
  };
}

export function keepRaidNote(parts: any = {}) {
  const bits: string[] = [];
  if (parts.regenRecovered) bits.push(`The Keep recovered ${Math.floor(parts.regenRecovered)} HP before the hit.`);
  if (parts.baseNote) bits.push(String(parts.baseNote));
  if (parts.backlash) bits.push(`It struck back for ${Math.floor(parts.backlash)} health.`);
  if (parts.coins) bits.push(`+${Math.floor(parts.coins)} coins knocked loose.`);
  return bits.join(" ").trim();
}
