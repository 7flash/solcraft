export type LimitAdviceRow = {
  key: string;
  glyph: string;
  cls: "warn" | "bad" | string;
  title: string;
  short: string;
  body: string;
};

export type PlayerHudInput = {
  player?: any;
  liveEnergy?: number;
  maxHp?: number;
  xpNeeded?: number;
  visiblePlayers?: number;
  activePlayers?: number;
  gameplayHint?: string;
};

export function capRatio(value: any, cap: any): number {
  const c = Number(cap || 0);
  if (!Number.isFinite(c) || c <= 0) return 0;
  const n = Number(value || 0);
  return Math.max(0, Math.min(1, n / c));
}

export function playerInitial(name: any): string {
  const s = String(name || "?").trim();
  return (s.slice(0, 1) || "?").toUpperCase();
}

export function pct(value: any, max: any): number {
  const m = Number(max || 0);
  if (!Number.isFinite(m) || m <= 0) return 0;
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, 100 * n / m));
}

export function splitGameplayHint(hint: any): { lead: string; rest: string } {
  const text = String(hint || "").trim();
  if (!text) return { lead: "", rest: "" };
  const parts = text.split(" — ");
  return { lead: parts[0] || text, rest: parts.length > 1 ? parts.slice(1).join(" — ") : "" };
}
export function storageUsed(inv: any = {}) {
  return Math.max(0, Math.floor(Number(inv.w || 0) + Number(inv.s || 0) + Number(inv.f || 0) + Number(inv.p || 0)));
}
export function storageLimit(cap: any = {}) {
  return Math.max(0, Math.floor(Number(cap.w || 0) + Number(cap.s || 0) + Number(cap.f || 0) + Number(cap.p || 0)));
}

export function limitAdviceRows(m: any): LimitAdviceRow[] {
  if (!m) return [];
  const rows: LimitAdviceRow[] = [];
  const inv = m.inv || {};
  const caps = m.storageCap || {};
  const tileCap = Number(m.tileCap || 0);
  const tileRatio = capRatio(m.territory || 0, tileCap);
  if (tileCap && (tileRatio >= 0.80 || tileCap - Number(m.territory || 0) <= 8)) {
    rows.push({
      key: "tiles",
      glyph: "◇",
      cls: tileRatio >= 0.96 ? "bad" : "warn",
      title: `Tile limit ${m.territory || 0}/${tileCap}`,
      short: tileRatio >= 0.96 ? "Tile limit full" : "Near tile limit",
      body: "Build settlement structures or expand from another captured tile when you need more room.",
    });
  }

  const resourceRows: Array<[string, string, string, string]> = [
    ["w", "Wood", "🪵", "Storage is limited. Build settlement infrastructure before gathering too much wood."],
    ["s", "Stone", "🪨", "Storage is limited. Stone fuels capture and construction."],
    ["f", "Food", "🌾", "Food restores health after raids and dangerous fights."],
    ["g", "Coins", "🪙", "Coins come from pickups, markets, and Keep raids."],
  ];

  for (const [key, name, glyph, body] of resourceRows) {
    const cap = Number(caps[key] || 0);
    const have = Number(inv[key] || 0);
    const ratio = capRatio(have, cap);
    if (cap && (ratio >= 0.85 || cap - have <= 12)) {
      rows.push({
        key,
        glyph,
        cls: ratio >= 0.96 ? "bad" : "warn",
        title: `${name} cap ${have}/${cap}`,
        short: ratio >= 0.96 ? `${name} storage full` : `${name} near cap`,
        body,
      });
    }
  }

  return rows.slice(0, 4);
}

export function limitAdviceSummary(m: any): string {
  const rows = limitAdviceRows(m);
  if (!rows.length) return "Limits are healthy. Claim outward, build producers, and keep collecting coins.";
  return rows.map((r) => `${r.title}: ${r.body}`).join(" ");
}

export function playerHudViewModel(input: PlayerHudInput) {
  const m = input.player || {};
  const maxHp = Math.max(1, Number(input.maxHp || 100));
  const xpNeeded = Math.max(1, Number(input.xpNeeded || 1));
  const eNow = Math.max(0, Number(input.liveEnergy ?? m.e ?? 0));
  const hpNow = Math.max(0, Math.ceil(Number(m.hp || 0)));
  const visiblePlayers = Math.max(0, Number(input.visiblePlayers || 0));
  const activePlayers = Math.max(visiblePlayers, Number(input.activePlayers || visiblePlayers));
  const hint = splitGameplayHint(input.gameplayHint);
  const usedStorage = storageUsed(m.inv || {});
  const maxStorage = storageLimit(m.storageCap || {});

  return {
    initial: playerInitial(m.name),
    level: Number(m.level || 1),
    name: String(m.name || "Settler"),
    gold: Math.floor(Number(m.inv?.g || 0)),
    science: Math.floor(Number(m.inv?.sc || 0)),
    scienceCap: Number(m.scienceCap || 0),
    territory: Number(m.territory || 0),
    tileCap: m.tileCap || "?",
    built: Number(m.built || 0),
    storageUsed: usedStorage,
    storageLimit: maxStorage || "?",
    visiblePlayers,
    activePlayers,
    energyNow: Math.floor(eNow),
    energyRaw: eNow,
    maxEnergy: Math.max(1, Number(m.maxE || 1)),
    energyPct: pct(eNow, m.maxE || 1),
    hpNow,
    maxHp,
    hpPct: pct(hpNow, maxHp),
    xp: Number(m.xp || 0),
    xpNeeded,
    xpPct: pct(m.xp || 0, xpNeeded),
    limitRows: limitAdviceRows(m),
    limitSummary: limitAdviceSummary(m),
    hintLead: hint.lead,
    hintRest: hint.rest,
    spectator: !!m.spectator,
  };
}
