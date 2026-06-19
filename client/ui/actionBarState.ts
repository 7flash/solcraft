export type ActionBarSnapshot = {
  mode?: string | null;
  tool?: string | null;
  panel?: string | null;
};

export function isBuildRibbonOpen(s: ActionBarSnapshot): boolean {
  return s.mode === "build" || s.mode === "place" || s.tool === "build";
}

export function isAxeActive(s: ActionBarSnapshot): boolean {
  return s.tool === "wood";
}

export function isPickaxeActive(s: ActionBarSnapshot): boolean {
  return s.tool === "stone";
}

export function isCaptureActive(s: ActionBarSnapshot): boolean {
  return s.tool === "claim";
}

export function isDemolishActive(s: ActionBarSnapshot): boolean {
  return s.mode === "demolish" || s.tool === "demolish";
}

// Kept for legacy callers/tests while teleport moves out of the bottom toolbelt.
export function isTeleportRibbonOpen(s: ActionBarSnapshot): boolean {
  return s.mode === "teleport" || s.tool === "teleport";
}

// Kept for legacy callers/tests while the nested Tools ribbon is no longer primary UI.
export function isToolsRibbonOpen(s: ActionBarSnapshot): boolean {
  return s.mode === "tools" || s.tool === "use" || s.tool === "spawn" || s.mode === "spawn" || s.mode === "spawnPlace";
}

export function isMorePanelOpen(s: ActionBarSnapshot): boolean {
  return s.panel === "more";
}

/**
 * UI-only active-state reducer for the bottom toolbelt.
 */
export function actionBarActive(s: ActionBarSnapshot): Record<string, boolean> {
  return {
    "gather-wood": isAxeActive(s),
    "gather-stone": isPickaxeActive(s),
    "select-build": isBuildRibbonOpen(s),
    "demolish-tool": isDemolishActive(s),
    "capture-tool": isCaptureActive(s),

    // legacy keys stay false/derived so older test/import call-sites do not crash
    "explore-mode": (s.mode || "explore") === "explore" && (s.tool || "none") === "none",
    "tools-toggle": isToolsRibbonOpen(s),
    claim: isCaptureActive(s),
    "teleport-toggle": isTeleportRibbonOpen(s),
    "use-tool": s.tool === "use",
    "open-more": isMorePanelOpen(s),
    "open-options": isMorePanelOpen(s),
  };
}
