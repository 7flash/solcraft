import { t } from "../i18n";

export type CoreAction = {
  key: number;
  icon: string;
  atlas: string;
  label: string;
  click: string;
  help: string;
  cursor: "axe" | "pickaxe" | "hammer" | "shovel" | "capture" | "sword";
};

/**
 * Bottom HUD contract: this is a toolbelt, not a menu/action drawer.
 * Each slot directly changes the active cursor/tool. Hammer opens tile-first
 * building flow through the right-side panel; Sword is the active attack tool.
 */
export const CORE_ACTIONS: CoreAction[] = [
  { key: 1, icon: "🪓", atlas: "wood", label: t("toolbelt.axe.label", "Axe"), click: "gather-wood", cursor: "axe", help: t("toolbelt.axe.help", "Axe cursor: click trees to chop wood.") },
  { key: 2, icon: "⛏", atlas: "stone", label: t("toolbelt.pickaxe.label", "Pickaxe"), click: "gather-stone", cursor: "pickaxe", help: t("toolbelt.pickaxe.help", "Pickaxe cursor: click rocks to mine stone.") },
  { key: 3, icon: "🔨", atlas: "build", label: t("toolbelt.hammer.label", "Hammer"), click: "select-build", cursor: "hammer", help: t("toolbelt.hammer.help", "Hammer cursor: click a captured tile, then choose a building in the right panel.") },
  { key: 4, icon: "▰", atlas: "use", label: t("toolbelt.shovel.label", "Shovel"), click: "demolish-tool", cursor: "shovel", help: t("toolbelt.shovel.help", "Shovel cursor: click one of your buildings to demolish it.") },
  { key: 5, icon: "⚑", atlas: "capture", label: t("toolbelt.capture.label", "Capture"), click: "capture-tool", cursor: "capture", help: t("toolbelt.capture.help", "Capture cursor: click any free non-capital tile to claim it.") },
  { key: 6, icon: "⚔", atlas: "sword", label: t("toolbelt.sword.label", "Sword"), click: "siege-tool", cursor: "sword", help: t("toolbelt.sword.help", "Sword cursor: attack Keeps, buildings, or nearby settlers.") },
];