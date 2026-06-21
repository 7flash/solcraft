export const CAPITAL_CENTER = { x: 0, z: 0 } as const;
export const CAPITAL_CORE_RADIUS = 8;
export const CAPITAL_SERVICE_RADIUS = 12;
export const SETTLEMENT_SPAWN_MIN_RADIUS = 16;
export const SETTLEMENT_SPAWN_STEP = 14;
export const KEEP_CROSS_START_RADIUS = 28;
export const KEEP_CROSS_STEP = 30;

export type CapitalZone = "core" | "service" | "frontier";
export type KeepLane = "north" | "south" | "east" | "west";

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

export function keepCrossIndexAt(xRaw: number, zRaw: number): { lane: KeepLane; index: number; distance: number } | null {
  const x = Math.trunc(Number(xRaw) || 0);
  const z = Math.trunc(Number(zRaw) || 0);
  if (x !== 0 && z !== 0) return null;
  const axis = x === 0 ? z : x;
  const dist = Math.abs(axis);
  if (dist < KEEP_CROSS_START_RADIUS) return null;
  const offset = dist - KEEP_CROSS_START_RADIUS;
  if (offset % KEEP_CROSS_STEP !== 0) return null;
  const index = Math.floor(offset / KEEP_CROSS_STEP);
  if (x === 0 && z < 0) return { lane: "north", index, distance: dist };
  if (x === 0 && z > 0) return { lane: "south", index, distance: dist };
  if (z === 0 && x > 0) return { lane: "east", index, distance: dist };
  if (z === 0 && x < 0) return { lane: "west", index, distance: dist };
  return null;
}

export function keepCrossPosition(lane: KeepLane, index = 0) {
  const d = KEEP_CROSS_START_RADIUS + Math.max(0, Math.trunc(index)) * KEEP_CROSS_STEP;
  if (lane === "north") return { x: 0, z: -d };
  if (lane === "south") return { x: 0, z: d };
  if (lane === "east") return { x: d, z: 0 };
  return { x: -d, z: 0 };
}

export function keepCrossPositionsInBox(ax: number, az: number, radius: number) {
  const r = Math.max(0, Math.trunc(Number(radius) || 0));
  const maxDist = Math.max(Math.abs(ax) + r, Math.abs(az) + r, KEEP_CROSS_START_RADIUS);
  const maxIndex = Math.max(0, Math.ceil((maxDist - KEEP_CROSS_START_RADIUS) / KEEP_CROSS_STEP) + 1);
  const lanes: KeepLane[] = ["north", "south", "east", "west"];
  const out: Array<{ lane: KeepLane; index: number; x: number; z: number; distance: number }> = [];
  for (let index = 0; index <= maxIndex; index++) {
    for (const lane of lanes) {
      const p = keepCrossPosition(lane, index);
      if (Math.max(Math.abs(p.x - ax), Math.abs(p.z - az)) <= r) out.push({ lane, index, x: p.x, z: p.z, distance: Math.max(Math.abs(p.x), Math.abs(p.z)) });
    }
  }
  return out;
}
