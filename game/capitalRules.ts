export const CAPITAL_CENTER = { x: 0, z: 0 } as const;
export const CAPITAL_CORE_RADIUS = 8;
export const CAPITAL_SERVICE_RADIUS = 12;

// The map shape is intentionally simple and fair:
// - the capital owns the middle square;
// - players settle on four equal road arms around it;
// - neutral Keeps live in the diagonal wilderness between those arms.
export const SETTLEMENT_SPAWN_MIN_RADIUS = 28;
export const SETTLEMENT_SPAWN_STEP = 16;
export const SETTLEMENT_LANE_OFFSET = 9;
export const KEEP_CROSS_START_RADIUS = 42;
export const KEEP_CROSS_STEP = 28;

export type CapitalZone = "core" | "service" | "frontier";
export type SettlementLane = "east" | "south" | "west" | "north";
export type KeepLane = "northeast" | "southeast" | "southwest" | "northwest";

export function capitalDistance(x: number, z: number) {
  return Math.max(Math.abs(Math.trunc(Number(x) || 0) - CAPITAL_CENTER.x), Math.abs(Math.trunc(Number(z) || 0) - CAPITAL_CENTER.z));
}

export function capitalZoneAt(x: number, z: number): CapitalZone {
  const d = capitalDistance(x, z);
  if (d <= CAPITAL_CORE_RADIUS) return "core";
  if (d <= CAPITAL_SERVICE_RADIUS) return "service";
  return "frontier";
}

export function isCapitalCoreZone(x: number, z: number) {
  return capitalZoneAt(x, z) === "core";
}

export function isCapitalServiceZone(x: number, z: number) {
  return capitalZoneAt(x, z) !== "frontier";
}

export function capitalBlocksPlayerTerritory(x: number, z: number) {
  return isCapitalCoreZone(x, z);
}

export function capitalBlocksNaturalResource(x: number, z: number) {
  return isCapitalServiceZone(x, z);
}

export function settlementSpawnAllowed(x: number, z: number) {
  return capitalDistance(x, z) >= SETTLEMENT_SPAWN_MIN_RADIUS;
}

export function settlementSpawnPoint(indexRaw: number): { lane: SettlementLane; ring: number; x: number; z: number } {
  const index = Math.max(0, Math.trunc(Number(indexRaw) || 0));
  const ring = Math.floor(index / 4);
  const laneIndex = index % 4;
  const d = SETTLEMENT_SPAWN_MIN_RADIUS + ring * SETTLEMENT_SPAWN_STEP;
  // Alternate the perpendicular side every ring so the road itself stays open.
  const side = ring % 2 === 0 ? SETTLEMENT_LANE_OFFSET : -SETTLEMENT_LANE_OFFSET;
  if (laneIndex === 0) return { lane: "east", ring, x: d, z: side };
  if (laneIndex === 1) return { lane: "south", ring, x: -side, z: d };
  if (laneIndex === 2) return { lane: "west", ring, x: -d, z: -side };
  return { lane: "north", ring, x: side, z: -d };
}

export function settlementSpawnPositions(count: number) {
  const n = Math.max(0, Math.trunc(Number(count) || 0));
  return Array.from({ length: n }, (_, i) => settlementSpawnPoint(i));
}

export function keepCrossIndexAt(xRaw: number, zRaw: number): { lane: KeepLane; index: number; distance: number } | null {
  const x = Math.trunc(Number(xRaw) || 0);
  const z = Math.trunc(Number(zRaw) || 0);
  const ax = Math.abs(x);
  const az = Math.abs(z);
  // Keeps occupy diagonal wilderness corridors between the player settlement arms.
  if (ax !== az || ax === 0) return null;
  const dist = ax;
  if (dist < KEEP_CROSS_START_RADIUS) return null;
  const offset = dist - KEEP_CROSS_START_RADIUS;
  if (offset % KEEP_CROSS_STEP !== 0) return null;
  const index = Math.floor(offset / KEEP_CROSS_STEP);
  if (x > 0 && z < 0) return { lane: "northeast", index, distance: dist };
  if (x > 0 && z > 0) return { lane: "southeast", index, distance: dist };
  if (x < 0 && z > 0) return { lane: "southwest", index, distance: dist };
  if (x < 0 && z < 0) return { lane: "northwest", index, distance: dist };
  return null;
}

export function keepCrossPosition(lane: KeepLane, index = 0) {
  const d = KEEP_CROSS_START_RADIUS + Math.max(0, Math.trunc(Number(index) || 0)) * KEEP_CROSS_STEP;
  if (lane === "northeast") return { x: d, z: -d };
  if (lane === "southeast") return { x: d, z: d };
  if (lane === "southwest") return { x: -d, z: d };
  return { x: -d, z: -d };
}

export function keepCrossPositionsInBox(ax: number, az: number, radius: number) {
  const r = Math.max(0, Math.trunc(Number(radius) || 0));
  const maxDist = Math.max(Math.abs(ax) + r, Math.abs(az) + r, KEEP_CROSS_START_RADIUS);
  const maxIndex = Math.max(0, Math.ceil((maxDist - KEEP_CROSS_START_RADIUS) / KEEP_CROSS_STEP) + 1);
  const lanes: KeepLane[] = ["northeast", "southeast", "southwest", "northwest"];
  const out: Array<{ lane: KeepLane; index: number; x: number; z: number; distance: number }> = [];
  for (let index = 0; index <= maxIndex; index++) {
    for (const lane of lanes) {
      const p = keepCrossPosition(lane, index);
      if (Math.max(Math.abs(p.x - ax), Math.abs(p.z - az)) <= r) out.push({ lane, index, x: p.x, z: p.z, distance: Math.max(Math.abs(p.x), Math.abs(p.z)) });
    }
  }
  return out;
}
