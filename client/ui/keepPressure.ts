export const KEEP_PRESSURE_UI_RULES = {
  baseDamage: 12,
  maxDamage: 80,
  regenIntervalMs: 5000,
  regenPerTick: 7,
  minHealthToRaid: 12,
  coinChipMin: 1,
  coinChipDivisor: 5,
} as const;

export type KeepPressureInput = {
  hp?: number;
  maxHp?: number;
  stored?: number;
  accAt?: number;
  now?: number;
  playerHp?: number;
  siegeBonus?: number;
};

function num(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function floor(v: any, fallback = 0) {
  return Math.floor(num(v, fallback));
}
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function keepPressureModel(input: KeepPressureInput = {}) {
  const now = Math.max(0, floor(input.now, Date.now()));
  const maxHp = Math.max(1, floor(input.maxHp || input.hp || 1, 1));
  const hp = Math.max(0, Math.min(maxHp, floor(input.hp, maxHp)));
  const stored = Math.max(0, floor(input.stored, 0));
  const playerHp = Math.max(0, floor(input.playerHp, 0));
  const hpPct = clamp01(hp / maxHp);
  const lastPressure = Math.max(0, floor(input.accAt, now));
  const elapsed = Math.max(0, now - lastPressure);
  const interval = Math.max(1, KEEP_PRESSURE_UI_RULES.regenIntervalMs);
  const nextRegenMs = hp >= maxHp ? 0 : Math.max(0, interval - (elapsed % interval));
  const damage = Math.max(1, Math.min(KEEP_PRESSURE_UI_RULES.maxDamage, KEEP_PRESSURE_UI_RULES.baseDamage + floor(input.siegeBonus, 0)));
  const coinChip = stored > 0 ? Math.max(0, Math.min(stored, Math.max(KEEP_PRESSURE_UI_RULES.coinChipMin, Math.floor(damage / Math.max(1, KEEP_PRESSURE_UI_RULES.coinChipDivisor))))) : 0;
  const hitsToBreak = Math.max(1, Math.ceil(hp / Math.max(1, damage)));
  const canRaid = playerHp > KEEP_PRESSURE_UI_RULES.minHealthToRaid;

  let pressure = "steady";
  let pressureLabel = "Holding";
  if (hpPct <= 0.25) { pressure = "critical"; pressureLabel = "Breach soon"; }
  else if (hpPct <= 0.55) { pressure = "weak"; pressureLabel = "Weakening"; }
  else if (hpPct >= 0.9) { pressure = "fresh"; pressureLabel = "Fresh"; }

  return {
    hp,
    maxHp,
    hpPct,
    hpLabel: `${hp} / ${maxHp}`,
    stored,
    storedLabel: stored ? `${stored} coins inside` : "No coins visible",
    damage,
    coinChip,
    coinChipLabel: coinChip ? `~${coinChip} coins per hit` : "Coins release on breach",
    hitsToBreak,
    hitsLabel: `${hitsToBreak} good hit${hitsToBreak === 1 ? "" : "s"}`,
    nextRegenMs,
    nextRegenLabel: hp >= maxHp ? "Fully recovered" : `${Math.ceil(nextRegenMs / 1000)}s to next recovery`,
    regenLabel: `+${KEEP_PRESSURE_UI_RULES.regenPerTick} HP every ${Math.ceil(KEEP_PRESSURE_UI_RULES.regenIntervalMs / 1000)}s`,
    canRaid,
    raidHealthLabel: canRaid ? "Healthy enough to raid" : "Recover health before raiding",
    pressure,
    pressureLabel,
  };
}
