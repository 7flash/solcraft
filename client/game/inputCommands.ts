import type { ClientAction } from "./types.ts";

export function commandForTileClick(mode: string, tile: { x: number; z: number }, selected?: { kind?: string; uid?: number }): ClientAction {
  switch (mode) {
    case "claim": return { type: "claim", x: tile.x, z: tile.z };
    case "build": return { type: "place", kind: selected?.kind || "road", x: tile.x, z: tile.z };
    case "harvest": return { type: "harvestStart", x: tile.x, z: tile.z };
    default: return { type: "move", x: tile.x, z: tile.z };
  }
}

export function commandForBuildingClick(mode: string, building: { uid?: number; id?: number }): ClientAction {
  const uid = Number(building.uid || building.id || 0);
  switch (mode) {
    case "upgrade": return { type: "upgrade", uid };
    case "demolish": return { type: "demolish", uid };
    default: return { type: "use", uid };
  }
}
