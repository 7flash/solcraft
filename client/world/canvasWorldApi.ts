// @ts-nocheck
/**
 * Stable compatibility surface for the Canvas 2D world renderer.
 *
 * Decision: video-quality tiers were removed. The renderer now has one
 * max-detail Canvas path and relies on static caching, sprite caches, culling,
 * throttled UI paints, and adaptive polling for performance. Do not add a
 * legacy quality updater back to this contract; the only accepted visual
 * updater is applyVisualSettings(), which may change camera/time/motion
 * preferences while preserving the max-detail world path.
 */

export const CANVAS_WORLD_REQUIRED_KEYS = [
  "applyWorld", "applyPlayers", "applyMe",
  "me", "cellFromEvent", "buildingFromEvent", "pickFromEvent",
  "worldToScreen", "screenToWorldPoint", "visibleCells",
  "pathTo", "pathToNear", "tryMoveDelta", "canIssueMove",
  "buildPoolAt", "doodadVisible", "doodadAtCell", "resolveDoodadCell", "doodadFromEvent",
  "tradePostFromEvent", "npcFromEvent", "playerFromEvent",
  "burst", "floatText", "shockwave", "hoverMarker", "hardSnapMe",
  "markDoodadGone", "removeBuild", "removeLoot",
  "setHintCells", "hideBuildGhost", "showBuildGhost", "refreshWindow",
  "animateBuildingUse", "refreshConstructionProgress", "refreshOwnRig",
  "applyVisualSettings", "minimapSnapshot",
  "tileOwner", "buildPool", "lootPool", "cells",
  "updateMinimapInfo", "zoom", "walkQueueClear", "dispose", "setFacing", "setWalking",
] as const;

export type CanvasWorldApi = Record<(typeof CANVAS_WORLD_REQUIRED_KEYS)[number], any> & {
  rev?: number;
  ax?: number;
  az?: number;
  map?: any;
  offers?: any[];
  movementState?: () => any;
  capitalBearing?: () => any;
};

export function missingCanvasWorldKeys(world: any) {
  const missing: string[] = [];
  for (const key of CANVAS_WORLD_REQUIRED_KEYS) {
    if (world == null || !(key in world) || world[key as any] == null) missing.push(String(key));
  }
  return missing;
}

export function assertCanvasWorldApi(world: any): asserts world is CanvasWorldApi {
  const missing = missingCanvasWorldKeys(world);
  if (missing.length) {
    throw new Error(`[canvas world] missing compatibility keys: ${missing.join(", ")}`);
  }
}

export function createPickDebugOverlay(host: HTMLElement | null) {
  let el: HTMLDivElement | null = null;
  function enabled() {
    try {
      return /(?:\?|&)pickDebug=1(?:&|$)/.test(location.search) || localStorage.getItem("solcraft.debug.pick") === "1";
    } catch { return false; }
  }
  function ensure() {
    if (!enabled() || !host) return null;
    if (!el) {
      el = document.createElement("div");
      el.className = "sc-pick-debug";
      el.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:40;pointer-events:none;background:rgba(6,10,16,.78);color:#d7dfcf;border:1px solid rgba(215,223,207,.18);border-radius:10px;padding:7px 9px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:260px;white-space:pre-wrap";
      host.appendChild(el);
    }
    return el;
  }
  return {
    update(pick: any) {
      const node = ensure();
      if (!node) return;
      const c = pick?.cell || pick?.raw || {};
      const id = pick?.building?.uid || pick?.player?.player?.id || pick?.npc?.npc?.uid || pick?.trade?.trade?.uid || pick?.doodad?.kind || "";
      node.textContent = `pick: ${pick?.primary || "none"}\ncell: ${Math.trunc(Number(c.x || 0))},${Math.trunc(Number(c.z || 0))}\nid: ${String(id).slice(0, 80)}`;
    },
    remove() { try { el?.remove(); } catch {} el = null; },
  };
}
