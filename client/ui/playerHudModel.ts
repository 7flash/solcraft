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
  if (!text) return { lead: "Goal", rest: "claim territory · build producers · collect taxed coins" };
  const parts = text.split(" — ");
  return { lead: parts[0] || text, rest: parts.length > 1 ? parts.slice(1).join(" — ") : "" };
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
      short: tileRatio >= 0.96 ? "Build before claiming" : "Near territory cap",
      body: "Build any normal building for more tile capacity. At 24 claimed tiles build Town Hall (+75). At 100 tiles build World Wonder (+250).",
    });
  }

  const resourceRows: Array<[string, string, string, string]> = [
    ["w", "Wood", "🪵", "Warehouse raises wood/stone/plank/shard storage. Lumber Camp helps create more tree nodes."],
    ["s", "Stone", "🪨", "Warehouse raises wood/stone/plank/shard storage. Quarry helps create more rock nodes."],
    ["p", "Planks", "📦", "Warehouse raises plank storage. Craft planks from wood and protect your supply."],
    ["f", "Food", "🌾", "Granary raises food storage. Farms produce food over time."],
    ["sh", "Shards", "◈", "Warehouse raises shard storage. Stone Keep slowly creates shards later."],
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
  if (!rows.length) return "Limits are healthy. Claim outward, build producers, and keep collecting loose tokens.";
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
