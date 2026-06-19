
export type AtlasId = "terrain" | "building" | "fx" | "ui" | "doll" | "tool";

export type AtlasCatalogEntry = {
  id: AtlasId;
  label: string;
  cols: number;
  rows: number;
  cells: number;
  runtimeFile: string;
  defaultMode: "atlas" | "procedural";
  slots: readonly string[];
  notes?: string;
};

const BASE_CELL_SLOTS = {
  terrain: ["grass", "forest", "dirt", "path", "sand", "cobble", "rocky", "soil", "farm", "water", "moss", "deck", "claimed", "mint", "purple", "plain"],
  building: ["wood", "darkwood", "stone", "marble", "cobble", "plaster", "roof", "slate", "thatch", "cloth", "purplecloth", "canvas", "metal", "rune", "banner", "carved"],
  fx: ["smallShadow", "bigShadow", "sparkle", "coin", "dust", "smoke", "woodchips", "stonechips", "harvest", "warn", "twinkle", "rune", "bank", "market", "lootbag", "impact"],
  ui: ["wood", "stone", "wheat", "fish", "gold", "gem", "energy", "heart", "shield", "sword", "backpack", "hammer", "food", "cottage", "market", "bank"],
  doll: ["skin0", "skin1", "skin2", "skin3", "skin4", "skin5", "skin6", "skin7", "hair0", "hair1", "hair2", "hair3", "hair4", "hair5", "hair6", "hair7", "hat0", "hat1", "hat2", "hat3", "hat4", "hat5", "hat6", "hat7", "torso0", "torso1", "torso2", "torso3", "torso4", "torso5", "torso6", "torso7", "legs0", "legs1", "legs2", "legs3", "legs4", "legs5", "legs6", "legs7", "back0", "back1", "back2", "back3", "back4", "back5", "back6", "back7"],
} as const;

export const TOOL_IDS = ["axe", "pickaxe", "hammer", "shovel", "capture"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const TOOL_ATLAS_ROWS = [
  { id: "bar", label: "Bottom toolbelt icons", slots: TOOL_IDS.map((id) => `bar.${id}`) },
  { id: "hand", label: "Character in-hand overlays", slots: TOOL_IDS.map((id) => `hand.${id}`) },
  { id: "cursor", label: "World cursor sprites", slots: TOOL_IDS.map((id) => `cursor.${id}`) },
  { id: "affordance", label: "Target/selection affordances", slots: TOOL_IDS.map((id) => `affordance.${id}`) },
] as const;

export const TOOL_ATLAS_SLOTS = TOOL_ATLAS_ROWS.flatMap((row) => row.slots);

export const ATLAS_CATALOG: Record<AtlasId, AtlasCatalogEntry> = {
  terrain: { id: "terrain", label: "Terrain", cols: 4, rows: 4, cells: 4, runtimeFile: "terrain_atlas_clean.png", defaultMode: "procedural", slots: BASE_CELL_SLOTS.terrain },
  building: { id: "building", label: "Building", cols: 4, rows: 4, cells: 4, runtimeFile: "building_atlas_clean.png", defaultMode: "atlas", slots: BASE_CELL_SLOTS.building },
  fx: { id: "fx", label: "FX", cols: 4, rows: 4, cells: 4, runtimeFile: "fx_atlas_clean.png", defaultMode: "atlas", slots: BASE_CELL_SLOTS.fx },
  ui: { id: "ui", label: "UI", cols: 4, rows: 4, cells: 4, runtimeFile: "ui_atlas_clean.png", defaultMode: "atlas", slots: BASE_CELL_SLOTS.ui },
  doll: { id: "doll", label: "Doll", cols: 8, rows: 6, cells: 8, runtimeFile: "doll_atlas_clean.png", defaultMode: "atlas", slots: BASE_CELL_SLOTS.doll },
  tool: {
    id: "tool",
    label: "Tools",
    cols: 5,
    rows: 4,
    cells: 5,
    runtimeFile: "tool_atlas_clean.png",
    defaultMode: "atlas",
    slots: TOOL_ATLAS_SLOTS,
    notes: "Dedicated atlas for bottom toolbelt icons, in-hand overlays, cursor sprites, and target affordances. Tool art no longer belongs in the doll atlas.",
  },
};

export const ATLAS_IDS = Object.keys(ATLAS_CATALOG) as AtlasId[];

export function atlasEntry(id: string | null | undefined): AtlasCatalogEntry | null {
  const key = String(id || "").toLowerCase() as AtlasId;
  return ATLAS_CATALOG[key] || null;
}

export function atlasEntries(): AtlasCatalogEntry[] {
  return ATLAS_IDS.map((id) => ATLAS_CATALOG[id]);
}

export function atlasRuntimeDefaults() {
  return Object.fromEntries(atlasEntries().map((entry) => [entry.id, entry.defaultMode])) as Record<AtlasId, "atlas" | "procedural">;
}

export function atlasLegacyRecord() {
  return Object.fromEntries(atlasEntries().map((entry) => [entry.id, {
    label: entry.label,
    cols: entry.cols,
    rows: entry.rows,
    cells: entry.cells,
    runtimeFile: entry.runtimeFile,
  }]));
}
