export type ToolCursorName = "default" | "walk" | "inspect" | "interact" | "axe" | "pickaxe" | "hammer" | "shovel" | "capture";

export type ToolCursorState = {
  screen?: string | null;
  mode?: string | null;
  tool?: string | null;
  placing?: string | null;
  hover?: string | null;
};

/**
 * UI-only cursor selector. This is intentionally separate from the character's
 * held tool mesh: the mouse cursor is about the player's active intent, while
 * the doll rig can keep its own visual vocabulary.
 */
export function toolCursorForState(s: ToolCursorState): ToolCursorName {
  if (s.screen && s.screen !== "playing") return "default";
  const mode = String(s.mode || "");
  const tool = String(s.tool || "");

  if (tool === "wood") return "axe";
  if (tool === "stone") return "pickaxe";
  if (tool === "claim") return "capture";
  if (tool === "demolish" || mode === "demolish") return "shovel";
  if (tool === "build" || mode === "build" || mode === "place" || !!s.placing) return "hammer";

  const hover = String(s.hover || "");
  if (["inspect", "building", "object", "tree", "rock", "food"].includes(hover)) return "inspect";
  if (hover === "interact" || hover === "trade" || hover === "npc") return "interact";
  if (hover === "walk" || hover === "tile") return "walk";

  return "walk";
}
