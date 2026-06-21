export type ToolCursorName = "default" | "walk" | "inspect" | "interact" | "denied" | "select" | "axe" | "pickaxe" | "hammer" | "shovel" | "capture" | "sword";

export type ToolCursorState = {
  screen?: string | null;
  mode?: string | null;
  tool?: string | null;
  placing?: string | null;
  hover?: string | null;
};

export function toolCursorForState(s: ToolCursorState): ToolCursorName {
  if (s.screen && s.screen !== "playing") return "default";
  const mode = String(s.mode || "");
  const tool = String(s.tool || "");
  const hover = String(s.hover || "");

  if (tool === "wood") return "axe";
  if (tool === "stone") return "pickaxe";
  if (tool === "claim") return "capture";
  if (tool === "sword" || tool === "siege") return "sword";
  if (tool === "demolish" || mode === "demolish") return "shovel";
  if (tool === "build" || mode === "build" || mode === "place" || !!s.placing) return "hammer";

  if (hover === "building" || hover === "tree" || hover === "rock" || hover === "food" || hover === "npc" || hover === "trade") return "inspect";
  if (hover === "denied") return "denied";
  return "walk";
}
