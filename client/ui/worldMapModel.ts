export type WorldMapStatsInput = {
  map?: {
    players?: unknown[];
    tiles?: unknown[];
    buildings?: unknown[];
  } | null;
  admin?: boolean;
};

export type WorldMapLegendItem = {
  id: "you" | "players" | "wonders" | "coins";
  label: string;
  dotClass: string;
};

export function worldMapCounts(input: WorldMapStatsInput = {}) {
  const map = input.map || {};
  return {
    players: Array.isArray(map.players) ? map.players.length : 0,
    tiles: Array.isArray(map.tiles) ? map.tiles.length : 0,
    buildings: Array.isArray(map.buildings) ? map.buildings.length : 0,
  };
}

export function worldMapLegendItems(): WorldMapLegendItem[] {
  return [
    { id: "you", label: "you", dotClass: "you" },
    { id: "players", label: "players", dotClass: "players" },
    { id: "wonders", label: "wonders", dotClass: "wonders" },
    { id: "coins", label: "coins", dotClass: "coins" },
  ];
}

export function worldMapModeHelp(admin = false) {
  return admin
    ? { label: "Admin:", text: "click any open map point to teleport there for debugging." }
    : { label: "Player:", text: "click nearby points to walk. Long-range teleport stays limited to Return Scroll and World Wonder teleports." };
}

export function worldMapSummary(input: WorldMapStatsInput = {}) {
  const counts = worldMapCounts(input);
  return `${counts.tiles} tiles · ${counts.buildings} buildings · ${counts.players} player markers`;
}
