export type ObjectPreviewKind = "tree" | "rock" | "food" | "trade" | "npc" | "tile";

export type ObjectPreview = {
  kind: ObjectPreviewKind;
  x: number;
  z: number;
  name?: string;
  ownerName?: string;
  biome?: string;
};

export function objectPreviewTitle(p: ObjectPreview | null | undefined): string {
  if (!p) return "";
  if (p.name) return p.name;
  if (p.kind === "tree") return "Tree";
  if (p.kind === "rock") return "Rock";
  if (p.kind === "food") return "Crop patch";
  if (p.kind === "trade") return "Trade post";
  if (p.kind === "npc") return "Frontier visitor";
  return "Frontier tile";
}

export function objectPreviewGlyph(p: ObjectPreview | null | undefined): string {
  if (!p) return "◇";
  if (p.kind === "tree") return "🪓";
  if (p.kind === "rock") return "⛏";
  if (p.kind === "food") return "🌾";
  if (p.kind === "trade") return "↔";
  if (p.kind === "npc") return "☻";
  return "◇";
}

export function objectPreviewDescription(p: ObjectPreview | null | undefined): string {
  if (!p) return "";
  if (p.kind === "tree") return "A harvestable tree. Select the axe, stand beside it, then chop for wood.";
  if (p.kind === "rock") return "A harvestable rock. Select the pickaxe, stand beside it, then mine for stone.";
  if (p.kind === "food") return "A crop patch grown by a nearby farm. Harvest it for food, then food restores health over time.";
  if (p.kind === "trade") return "A public exchange point. Stand beside it to open exchange and trade actions.";
  if (p.kind === "npc") return `${p.biome || "Frontier"} visitor. More NPC interactions can attach to this preview panel later.`;
  return "Open ground. With no tool selected, clicking walkable land moves your character.";
}

export function objectPreviewPrimaryAction(p: ObjectPreview | null | undefined): string {
  if (!p) return "walk";
  if (p.kind === "tree") return "select-axe";
  if (p.kind === "rock") return "select-pickaxe";
  if (p.kind === "food") return "harvest-food";
  if (p.kind === "trade") return "open-trade";
  if (p.kind === "npc") return "walk-near";
  return "walk";
}
