export type RibbonMode = "admin" | "wonder" | "build" | "craft" | "spawn" | "use" | null;

export type RibbonModeSnapshot = {
  mode?: string | null;
  tool?: string | null;
  placing?: string | null;
};

/**
 * Pure selector for the secondary ribbon above the primary action bar.
 *
 * Priority matters because some legacy flows temporarily leave multiple state
 * fields set while transitioning. The most explicit/highest-risk modes win:
 * admin, wonder, build/place, craft, spawn/deploy, use.
 */
export function ribbonModeForState(s: RibbonModeSnapshot): RibbonMode {
  const mode = String(s.mode || "");
  const tool = String(s.tool || "");
  const placing = String(s.placing || "");

  if (mode === "admin" || tool === "admin") return "admin";
  if (mode === "wonder" || tool === "wonder" || placing === "worldwonder") return "wonder";
  if (mode === "build" || mode === "place") return "build";
  if (mode === "craft" || tool === "craft") return "craft";
  if (mode === "spawn" || mode === "spawnPlace" || tool === "spawn") return "spawn";
  if (tool === "use") return "use";
  return null;
}

export function ribbonNeedsHorizontalScroll(mode: RibbonMode): boolean {
  return mode === "build" || mode === "craft" || mode === "spawn" || mode === "use";
}

export function ribbonIsAdvanced(mode: RibbonMode): boolean {
  return mode === "admin" || mode === "wonder" || mode === "craft" || mode === "spawn";
}
