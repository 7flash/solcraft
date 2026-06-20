export type ObjectPreviewKind = "tree" | "rock" | "food" | "trade" | "npc" | "tile" | "shared" | "keep";

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
  if (p.kind === "trade") return "Capital exchange";
  if (p.kind === "npc") return "Frontier visitor";
  if (p.kind === "keep") return "Shared keep";
  if (p.kind === "shared") return "Shared location";
  return "Frontier tile";
}

export function objectPreviewGlyph(p: ObjectPreview | null | undefined): string {
  if (!p) return "◇";
  if (p.kind === "tree") return "🌳";
  if (p.kind === "rock") return "🪨";
  if (p.kind === "food") return "🌾";
  if (p.kind === "trade") return "↔";
  if (p.kind === "npc") return "☻";
  if (p.kind === "keep") return "⚔";
  if (p.kind === "shared") return "⌖";
  return "◇";
}

export function objectPreviewDescription(p: ObjectPreview | null | undefined): string {
  if (!p) return "";
  if (p.kind === "tree") return "A harvestable tree. Select the axe from the bottom toolbelt if you want to chop it.";
  if (p.kind === "rock") return "A harvestable rock. Select the pickaxe from the bottom toolbelt if you want to mine it.";
  if (p.kind === "food") return "A crop patch grown by a nearby farm. Food restores health over time and can be harvested when you stand beside it.";
  if (p.kind === "trade") return "A public exchange point. In the capital this becomes the natural place for bank, deposit, withdrawal, and trade actions.";
  if (p.kind === "npc") return `${p.biome || "Frontier"} visitor. NPC services should eventually live in capital/city buildings instead of permanent HUD menus.`;
  if (p.kind === "keep") return "A shared raid target. Coordinate in chat, walk there together, and attack before the keep regenerates too much health.";
  if (p.kind === "shared") return "A place shared in chat. Open it here, then walk toward it when your group is ready.";
  return "Open ground. With no tool selected, clicking walkable land moves your character.";
}

export function objectPreviewPrimaryAction(p: ObjectPreview | null | undefined): string {
  if (!p) return "walk";
  if (p.kind === "food") return "harvest-food";
  if (p.kind === "trade") return "open-trade";
  if (p.kind === "npc") return "walk-near";
  if (p.kind === "tree" || p.kind === "rock") return "walk-near";
  if (p.kind === "keep" || p.kind === "shared") return "walk-near";
  return "walk";
}

export function objectPreviewActionLabel(action: string): string {
  if (action === "harvest-food") return "Harvest food";
  if (action === "open-trade") return "Open exchange";
  if (action === "walk-near") return "Walk near";
  return "Walk here";
}

export function objectPreviewShouldShowPrimary(p: ObjectPreview | null | undefined): boolean {
  if (!p) return false;
  return p.kind === "food" || p.kind === "trade" || p.kind === "npc" || p.kind === "tile" || p.kind === "shared" || p.kind === "keep";
}
