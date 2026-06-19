export type RibbonMode = "admin" | "wonder" | "build" | "tools" | "craft" | "spawn" | "use" | "teleport" | null;

export type RibbonModeSnapshot = {
  mode?: string | null;
  tool?: string | null;
  placing?: string | null;
};

/**
 * Pure selector for the secondary/top ribbon.
 * Stage 16 rule: the bottom HUD is a direct toolbelt. Axe, Pickaxe, Shovel,
 * and Capture do not open nested ribbons. Hammer/Build is the only primary
 * toolbelt slot that opens a selection ribbon by default.
 */
export function ribbonModeForState(s: RibbonModeSnapshot): RibbonMode {
  const mode = String(s.mode || "");
  const tool = String(s.tool || "");
  const placing = String(s.placing || "");

  if (mode === "admin" || tool === "admin") return "admin";
  if (mode === "wonder" || tool === "wonder" || placing === "worldwonder") return "wonder";
  if (mode === "build" || mode === "place" || tool === "build") return "build";
  if (mode === "teleport" || tool === "teleport") return "teleport";
  if (mode === "tools") return "tools";
  if (mode === "craft" || tool === "craft") return "craft";
  if (mode === "spawn" || mode === "spawnPlace" || tool === "spawn") return "spawn";
  if (tool === "use") return "use";
  return null;
}

export function ribbonNeedsHorizontalScroll(mode: RibbonMode): boolean {
  return mode === "build" || mode === "craft" || mode === "spawn" || mode === "use" || mode === "tools" || mode === "teleport";
}

export function ribbonIsAdvanced(mode: RibbonMode): boolean {
  return mode === "admin" || mode === "wonder" || mode === "craft" || mode === "spawn" || mode === "teleport" || mode === "tools";
}
