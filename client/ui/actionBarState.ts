export type ActionBarSnapshot = {
  mode?: string | null;
  tool?: string | null;
  panel?: string | null;
};

export function isBuildRibbonOpen(s: ActionBarSnapshot): boolean {
  return s.mode === "build" || s.mode === "place" || s.tool === "build";
}

export function isAxeActive(s: ActionBarSnapshot): boolean { return s.tool === "wood"; }
export function isPickaxeActive(s: ActionBarSnapshot): boolean { return s.tool === "stone"; }
export function isCaptureActive(s: ActionBarSnapshot): boolean { return s.tool === "claim"; }
export function isSwordActive(s: ActionBarSnapshot): boolean { return s.tool === "sword" || s.tool === "siege"; }
export function isDemolishActive(s: ActionBarSnapshot): boolean { return s.mode === "demolish" || s.tool === "demolish"; }
export function isTeleportRibbonOpen(s: ActionBarSnapshot): boolean { return s.mode === "teleport" || s.tool === "teleport"; }
export function isToolsRibbonOpen(s: ActionBarSnapshot): boolean { return s.mode === "tools" || s.tool === "use" || s.tool === "spawn" || s.mode === "spawn" || s.mode === "spawnPlace"; }
export function isMorePanelOpen(s: ActionBarSnapshot): boolean { return s.panel === "more"; }

export function actionBarActive(s: ActionBarSnapshot): Record<string, boolean> {
  return {
    "gather-wood": isAxeActive(s),
    "gather-stone": isPickaxeActive(s),
    "select-build": isBuildRibbonOpen(s),
    "demolish-tool": isDemolishActive(s),
    "capture-tool": isCaptureActive(s),
    "siege-tool": isSwordActive(s),
    "explore-mode": (s.mode || "explore") === "explore" && (s.tool || "none") === "none",
    "tools-toggle": isToolsRibbonOpen(s),
    claim: isCaptureActive(s),
    "teleport-toggle": isTeleportRibbonOpen(s),
    "use-tool": s.tool === "use",
    "open-more": isMorePanelOpen(s),
    "open-options": isMorePanelOpen(s),
  };
}
