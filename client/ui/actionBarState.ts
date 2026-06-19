export type ActionBarSnapshot = {
  mode?: string | null;
  tool?: string | null;
  panel?: string | null;
};

export function isBuildRibbonOpen(s: ActionBarSnapshot): boolean {
  return s.mode === "build" || s.mode === "place";
}

export function isMorePanelOpen(s: ActionBarSnapshot): boolean {
  return s.panel === "more";
}

/**
 * UI-only active-state reducer for the primary bottom action bar.
 * Keep it pure so the big client file can shrink without changing gameplay.
 */
export function actionBarActive(s: ActionBarSnapshot): Record<string, boolean> {
  const mode = s.mode || "explore";
  const tool = s.tool || "none";
  return {
    "explore-mode": mode === "explore" && tool === "none",
    "gather-wood": tool === "wood",
    "gather-stone": tool === "stone",
    claim: tool === "claim",
    "select-build": isBuildRibbonOpen(s),
    "use-tool": tool === "use",
    "open-more": isMorePanelOpen(s),
    "open-options": isMorePanelOpen(s),
  };
}
