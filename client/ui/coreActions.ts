export type CoreAction = {
  key: number;
  icon: string;
  atlas: string;
  label: string;
  click: string;
  help: string;
  cursor: "axe" | "pickaxe" | "hammer" | "shovel" | "capture";
};

/**
 * Bottom HUD contract: this is a toolbelt, not a menu/action drawer.
 * Each slot directly changes the active cursor/tool. Only Hammer opens the
 * building selection ribbon above the playfield.
 */
export const CORE_ACTIONS: CoreAction[] = [
  { key: 1, icon: "🪓", atlas: "wood", label: "Axe", click: "gather-wood", cursor: "axe", help: "Axe cursor: click trees to chop wood." },
  { key: 2, icon: "⛏", atlas: "stone", label: "Pickaxe", click: "gather-stone", cursor: "pickaxe", help: "Pickaxe cursor: click rocks to mine stone." },
  { key: 3, icon: "🔨", atlas: "build", label: "Hammer", click: "select-build", cursor: "hammer", help: "Hammer cursor: choose a building above, then click owned land to build." },
  { key: 4, icon: "▰", atlas: "use", label: "Shovel", click: "demolish-tool", cursor: "shovel", help: "Shovel cursor: click one of your buildings to demolish it." },
  { key: 5, icon: "⚑", atlas: "capture", label: "Capture", click: "capture-tool", cursor: "capture", help: "Capture cursor: click highlighted frontier tiles to claim them." },
];
