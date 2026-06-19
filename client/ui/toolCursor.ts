export type ToolCursorName = "default" | "axe" | "pickaxe" | "hammer" | "shovel" | "capture";

export type ToolCursorState = {
  screen?: string | null;
  mode?: string | null;
  tool?: string | null;
  placing?: string | null;
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

  return "default";
}
