import { captureLimitLine } from "./productionPolish";

export type PlayerHudInput = {
  player?: any;
  liveEnergy?: number;
  maxHp?: number;
  xpNeeded?: number;
  visiblePlayers?: number;
  activePlayers?: number;
  gameplayHint?: string;
  wondersBuilt?: number;
};

export function pct(value: any, max: any): number {
  const m = Number(max || 0);
  if (!Number.isFinite(m) || m <= 0) return 0;
  const n = Number(value || 0);
  return Math.max(0, Math.min(100, 100 * n / m));
}

export function storageUsed(inv: any = {}) {
  return Math.max(0, Math.floor(Number(inv.w || 0) + Number(inv.s || 0) + Number(inv.f || 0) + Number(inv.p || 0)));
}
export function storageLimit(cap: any = {}) {
  const explicit = Number(cap.total ?? cap.shared ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(0, Math.floor(explicit));
  const sum = Number(cap.w || 0) + Number(cap.s || 0) + Number(cap.f || 0) + Number(cap.p || 0);
  return Math.max(0, Math.floor(sum || 0));
}
export function reputationScore(m: any): number {
  const r = m?.reputation || {};
  return Math.floor(Number(r.score ?? r.value ?? r.reputation ?? m.rep ?? 0) || 0);
}
export function splitGameplayHint(hint: any): { lead: string; rest: string } {
  const text = String(hint || "").trim();
  if (!text) return { lead: "", rest: "" };
  const parts = text.split(" — ");
  return { lead: parts[0] || text, rest: parts.length > 1 ? parts.slice(1).join(" — ") : "" };
}

export function playerHudViewModel(input: PlayerHudInput) {
  const m = input.player || {};
  const maxHp = Math.max(1, Number(input.maxHp || 100));
  const eNow = Math.max(0, Number(input.liveEnergy ?? m.e ?? 0));
  const hpNow = Math.max(0, Math.ceil(Number(m.hp || maxHp)));
  const usedStorage = storageUsed(m.inv || {});
  const maxStorage = storageLimit(m.storageCap || {});
  const tileCap = Math.max(0, Number(m.tileCap || 0));
  const territory = Math.max(0, Number(m.territory || 0));
  const rep = reputationScore(m);
  const tileFree = Math.max(0, tileCap - territory);
  return {
    name: String(m.name || "Settler").slice(0, 18),
    gold: Math.floor(Number(m.inv?.g || 0)),
    territory,
    tileCap,
    tileFree,
    reputation: rep,
    captureLimitText: captureLimitLine({ ...m, territory, tileCap, reputation: { ...(m.reputation || {}), score: rep } }),
    storageUsed: usedStorage,
    storageLimit: maxStorage,
    storageFree: Math.max(0, maxStorage - usedStorage),
    storageText: maxStorage ? `${usedStorage}/${maxStorage} shared materials · ${Math.max(0, maxStorage - usedStorage)} free` : `${usedStorage} materials · storage cap loading`,
    wondersBuilt: Math.max(0, Number(input.wondersBuilt ?? m.wondersBuilt ?? 0) || 0),
    energyNow: Math.floor(eNow),
    maxEnergy: Math.max(1, Number(m.maxE || 1)),
    energyPct: pct(eNow, m.maxE || 1),
    hpNow,
    maxHp,
    hpPct: pct(hpNow, maxHp),
    hint: splitGameplayHint(input.gameplayHint),
    spectator: !!m.spectator,
    wood: Math.floor(Number(m.inv?.w || 0)),
    stone: Math.floor(Number(m.inv?.s || 0)),
    food: Math.floor(Number(m.inv?.f || 0)),
    woodCap: Math.floor(Number(m.storageCap?.w || 0)),
    stoneCap: Math.floor(Number(m.storageCap?.s || 0)),
    foodCap: Math.floor(Number(m.storageCap?.f || 0)),
  };
}