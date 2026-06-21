export type WorldSyncSnapshot = {
  ok?: boolean;
  kind?: string;
  version?: number;
  scope?: string;
  generatedAt?: number;
  counts?: Record<string, number>;
  players?: any[];
  tables?: Record<string, any[]>;
};

export type CapitalMigrationOptions = {
  capitalRadius?: number;
  firstSettlementRadius?: number;
  settlementSpacing?: number;
  settlementClampRadius?: number;
  keepFirstDistance?: number;
  keepSpacing?: number;
  keepsPerArm?: number;
  unsupportedBuildingMode?: "drop" | "foundation";
};

export type CapitalMigrationPlan = {
  ok: true;
  kind: "solcraft-capital-migration-plan";
  version: 1;
  generatedAt: number;
  options: Required<CapitalMigrationOptions>;
  capital: { x: 0; z: 0; radius: number };
  playerAnchors: Array<{ playerId: number; name: string; from: [number, number]; to: [number, number] }>;
  keepAnchors: Array<{ index: number; x: number; z: number; arm: "east" | "west" | "south" | "north" }>;
  buildingKindMap: Record<string, string>;
  report: {
    players: number;
    tilesMoved: number;
    buildingsMoved: number;
    buildingsDropped: number;
    buildingsConverted: number;
    neutralKeeps: number;
    unsupportedKinds: Record<string, number>;
    warnings: string[];
  };
};

const DEFAULTS: Required<CapitalMigrationOptions> = {
  capitalRadius: 18,
  firstSettlementRadius: 32,
  settlementSpacing: 22,
  settlementClampRadius: 10,
  keepFirstDistance: 56,
  keepSpacing: 28,
  keepsPerArm: 4,
  unsupportedBuildingMode: "drop",
};

export const BASIC_BUILDING_KIND_MAP: Record<string, string> = {
  house: "house",
  cottage: "house",
  home: "house",
  hut: "house",
  lumber: "lumber",
  sawmill: "lumber",
  quarry: "mine",
  mine: "mine",
  farm: "farm",
  market: "market",
  keep: "keep",
  foundation: "foundation",
};

function optsOf(options: CapitalMigrationOptions = {}): Required<CapitalMigrationOptions> {
  return {
    ...DEFAULTS,
    ...options,
    capitalRadius: Math.max(8, Math.trunc(Number(options.capitalRadius ?? DEFAULTS.capitalRadius) || DEFAULTS.capitalRadius)),
    firstSettlementRadius: Math.max(20, Math.trunc(Number(options.firstSettlementRadius ?? DEFAULTS.firstSettlementRadius) || DEFAULTS.firstSettlementRadius)),
    settlementSpacing: Math.max(10, Math.trunc(Number(options.settlementSpacing ?? DEFAULTS.settlementSpacing) || DEFAULTS.settlementSpacing)),
    settlementClampRadius: Math.max(4, Math.trunc(Number(options.settlementClampRadius ?? DEFAULTS.settlementClampRadius) || DEFAULTS.settlementClampRadius)),
    keepFirstDistance: Math.max(30, Math.trunc(Number(options.keepFirstDistance ?? DEFAULTS.keepFirstDistance) || DEFAULTS.keepFirstDistance)),
    keepSpacing: Math.max(12, Math.trunc(Number(options.keepSpacing ?? DEFAULTS.keepSpacing) || DEFAULTS.keepSpacing)),
    keepsPerArm: Math.max(1, Math.min(12, Math.trunc(Number(options.keepsPerArm ?? DEFAULTS.keepsPerArm) || DEFAULTS.keepsPerArm))),
    unsupportedBuildingMode: options.unsupportedBuildingMode === "foundation" ? "foundation" : "drop",
  };
}

function table(snapshot: WorldSyncSnapshot, name: string): any[] {
  return Array.isArray(snapshot?.tables?.[name]) ? snapshot.tables![name] : [];
}
function n(v: any, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function key(x: number, z: number) { return `${x},${z}`; }
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

export function spiralPoint(index: number, radius: number, spacing: number): [number, number] {
  if (index <= 0) return [radius, 0];
  const side = Math.max(1, Math.ceil(Math.sqrt(index + 1)));
  const ring = Math.max(1, Math.ceil(side / 2));
  const leg = ring * 2;
  const maxIndexInPrevRing = Math.max(0, (2 * ring - 1) ** 2 - 1);
  const p = index - maxIndexInPrevRing;
  let x = ring, z = -ring;
  if (p < leg) { x = ring - p; z = -ring; }
  else if (p < leg * 2) { x = -ring; z = -ring + (p - leg); }
  else if (p < leg * 3) { x = -ring + (p - leg * 2); z = ring; }
  else { x = ring; z = ring - (p - leg * 3); }
  return [x * spacing + Math.sign(x || 1) * radius, z * spacing + Math.sign(z || 1) * radius];
}

export function keepCrossAnchors(options: CapitalMigrationOptions = {}) {
  const o = optsOf(options);
  const arms = ["east", "west", "south", "north"] as const;
  const out: CapitalMigrationPlan["keepAnchors"] = [];
  for (const arm of arms) {
    for (let i = 0; i < o.keepsPerArm; i++) {
      const d = o.keepFirstDistance + i * o.keepSpacing;
      const x = arm === "east" ? d : arm === "west" ? -d : 0;
      const z = arm === "south" ? d : arm === "north" ? -d : 0;
      out.push({ index: out.length, x, z, arm });
    }
  }
  return out;
}

export function planCapitalMigration(snapshot: WorldSyncSnapshot, options: CapitalMigrationOptions = {}): CapitalMigrationPlan {
  if (!snapshot || !snapshot.tables) throw new Error("World snapshot with tables is required.");
  const o = optsOf(options);
  const players = table(snapshot, "players").slice().sort((a, b) => n(a.id) - n(b.id));
  const playerAnchors = players.map((p, i) => {
    const [x, z] = spiralPoint(i, o.firstSettlementRadius, o.settlementSpacing);
    return { playerId: n(p.id), name: String(p.name || `Player ${p.id || i + 1}`), from: [n(p.x), n(p.z)] as [number, number], to: [x, z] as [number, number] };
  });
  const byOwner = new Map(playerAnchors.map((a) => [a.playerId, a]));
  const unsupportedKinds: Record<string, number> = {};
  let buildingsMoved = 0, buildingsDropped = 0, buildingsConverted = 0;
  for (const b of table(snapshot, "buildings")) {
    const kind = String(b.kind || "").toLowerCase();
    const mapped = BASIC_BUILDING_KIND_MAP[kind];
    if (!mapped) {
      unsupportedKinds[kind || "(empty)"] = (unsupportedKinds[kind || "(empty)"] || 0) + 1;
      if (o.unsupportedBuildingMode === "foundation") buildingsConverted++; else buildingsDropped++;
    } else if (mapped !== kind) buildingsConverted++;
    if (byOwner.has(n(b.owner))) buildingsMoved++;
  }
  const tilesMoved = table(snapshot, "tiles").filter((t) => byOwner.has(n(t.owner))).length;
  const neutralKeeps = table(snapshot, "buildings").filter((b) => String(b.kind || "").toLowerCase() === "keep" && !n(b.owner)).length;
  const warnings: string[] = [];
  if (players.length === 0) warnings.push("No players found in snapshot.");
  if (Object.keys(unsupportedKinds).length) warnings.push("Some old building kinds are unsupported by the simplified building set.");
  if (!neutralKeeps) warnings.push("No neutral Keeps found; migration will create cross-arm Keeps.");
  return {
    ok: true,
    kind: "solcraft-capital-migration-plan",
    version: 1,
    generatedAt: Date.now(),
    options: o,
    capital: { x: 0, z: 0, radius: o.capitalRadius },
    playerAnchors,
    keepAnchors: keepCrossAnchors(o),
    buildingKindMap: BASIC_BUILDING_KIND_MAP,
    report: { players: players.length, tilesMoved, buildingsMoved, buildingsDropped, buildingsConverted, neutralKeeps, unsupportedKinds, warnings },
  };
}

function findOpenAround(x: number, z: number, used: Set<string>) {
  if (!used.has(key(x, z))) return [x, z] as [number, number];
  for (let r = 1; r < 80; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const nx = x + dx, nz = z + dz;
      if (!used.has(key(nx, nz))) return [nx, nz] as [number, number];
    }
  }
  return [x, z] as [number, number];
}

function relativeMoved(row: any, anchor: CapitalMigrationPlan["playerAnchors"][number], clampRadius: number, used: Set<string>) {
  const dx = Math.max(-clampRadius, Math.min(clampRadius, n(row.x) - anchor.from[0]));
  const dz = Math.max(-clampRadius, Math.min(clampRadius, n(row.z) - anchor.from[1]));
  const [x, z] = findOpenAround(anchor.to[0] + dx, anchor.to[1] + dz, used);
  used.add(key(x, z));
  return { ...row, x, z };
}

export function applyCapitalMigration(snapshot: WorldSyncSnapshot, plan: CapitalMigrationPlan): WorldSyncSnapshot {
  if (!plan || plan.kind !== "solcraft-capital-migration-plan") throw new Error("Capital migration plan is required.");
  const next = clone(snapshot);
  next.kind = "solcraft-world-export";
  next.generatedAt = Date.now();
  next.tables = next.tables || {};
  const anchorByPlayer = new Map(plan.playerAnchors.map((a) => [a.playerId, a]));
  const usedTiles = new Set<string>();
  const usedBuildings = new Set<string>();
  next.tables.players = table(next, "players").map((p) => {
    const a = anchorByPlayer.get(n(p.id));
    if (!a) return p;
    return { ...p, x: a.to[0], z: a.to[1] };
  });
  next.tables.tiles = table(next, "tiles")
    .filter((t) => anchorByPlayer.has(n(t.owner)))
    .map((t) => relativeMoved(t, anchorByPlayer.get(n(t.owner))!, plan.options.settlementClampRadius, usedTiles));
  const buildings: any[] = [];
  for (const b of table(next, "buildings")) {
    const owner = n(b.owner);
    const kind = String(b.kind || "").toLowerCase();
    const mapped = plan.buildingKindMap[kind];
    const isNeutralKeep = kind === "keep" && !owner;
    if (isNeutralKeep) continue;
    const anchor = anchorByPlayer.get(owner);
    if (!anchor) continue;
    if (!mapped) {
      if (plan.options.unsupportedBuildingMode !== "foundation") continue;
      buildings.push(relativeMoved({ ...b, kind: "foundation", level: 1 }, anchor, plan.options.settlementClampRadius, usedBuildings));
    } else {
      buildings.push(relativeMoved({ ...b, kind: mapped }, anchor, plan.options.settlementClampRadius, usedBuildings));
    }
  }
  let maxId = buildings.reduce((m, b) => Math.max(m, n(b.id)), table(next, "buildings").reduce((m, b) => Math.max(m, n(b.id)), 0));
  for (const k of plan.keepAnchors) {
    if (usedBuildings.has(key(k.x, k.z))) continue;
    usedBuildings.add(key(k.x, k.z));
    buildings.push({ id: ++maxId, x: k.x, z: k.z, owner: 0, kind: "keep", level: 1, hp: 120, maxHp: 120, createdAt: Date.now(), updatedAt: Date.now() });
  }
  next.tables.buildings = buildings;
  // Terrain should regenerate procedurally around the new ordered map. Clear volatile map objects.
  if (next.tables.doodads) next.tables.doodads = [];
  if (next.tables.loot) next.tables.loot = [];
  if (next.tables.events) next.tables.events = [...table(next, "events")];
  next.counts = Object.fromEntries(Object.entries(next.tables).map(([k, rows]) => [k, Array.isArray(rows) ? rows.length : 0]));
  next.players = next.tables.players;
  return next;
}
