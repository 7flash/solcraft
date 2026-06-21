import { t } from "../i18n";

export type ObjectPreviewKind = "tree" | "rock" | "food" | "trade" | "npc" | "tile" | "buildTile" | "shared" | "keep";

export type ObjectPreview = {
  kind: ObjectPreviewKind;
  x: number;
  z: number;
  name?: string;
  ownerName?: string;
  biome?: string;
  role?: string;
  title?: string;
  hp?: number;
  maxHp?: number;
  coins?: number;
  attack?: number;
  resource?: string;
  resourceAmount?: number;
};

export function objectPreviewTitle(p: ObjectPreview | null | undefined): string {
  if (!p) return "";
  if (p.name) return p.name;
  if (p.kind === "tree") return t("objectPreview.title.tree", "Tree");
  if (p.kind === "rock") return t("objectPreview.title.rock", "Rock");
  if (p.kind === "food") return t("objectPreview.title.food", "Crop patch");
  if (p.kind === "trade") return t("objectPreview.title.trade", "Capital exchange");
  if (p.kind === "npc") return p.name || p.title || t("objectPreview.title.npc", "Wanderer");
  if (p.kind === "keep") return t("objectPreview.title.keep", "Shared keep");
  if (p.kind === "buildTile") return t("objectPreview.title.buildTile", "Build site");
  if (p.kind === "shared") return t("objectPreview.title.shared", "Shared location");
  return t("objectPreview.title.tile", "Frontier tile");
}

export function objectPreviewGlyph(p: ObjectPreview | null | undefined): string {
  if (!p) return "◇";
  if (p.kind === "tree") return "🌳";
  if (p.kind === "rock") return "🪨";
  if (p.kind === "food") return "🌾";
  if (p.kind === "trade") return "↔";
  if (p.kind === "npc") return p.role === "warrior" ? "⚔" : p.role === "trader" ? "🪙" : "◉";
  if (p.kind === "keep") return "⚔";
  if (p.kind === "buildTile") return "▦";
  if (p.kind === "shared") return "⌖";
  return "◇";
}

export function objectPreviewRoleLabel(role: string | undefined, title?: string): string {
  if (title) return title;
  if (role === "warrior") return t("objectPreview.roles.warrior", "Warrior");
  if (role === "trader") return t("objectPreview.roles.trader", "Trader");
  if (role === "traveler") return t("objectPreview.roles.traveler", "Traveler");
  return t("objectPreview.roles.wanderer", "Wanderer");
}

export function objectPreviewDescription(p: ObjectPreview | null | undefined): string {
  if (!p) return "";
  if (p.kind === "tree") return t("objectPreview.desc.tree", "A harvestable tree. Select the axe from the bottom toolbelt if you want to chop it.");
  if (p.kind === "rock") return t("objectPreview.desc.rock", "A harvestable rock. Select the pickaxe from the bottom toolbelt if you want to mine it.");
  if (p.kind === "food") return t("objectPreview.desc.food", "A crop patch grown by a nearby farm. Food restores health over time and can be harvested when you stand beside it.");
  if (p.kind === "trade") return t("objectPreview.desc.trade", "A public exchange point. In the capital this becomes the natural place for bank, deposit, withdrawal, and trade actions.");
  if (p.kind === "npc") {
    const role = objectPreviewRoleLabel(p.role, p.title);
    const coins = Number(p.coins || 0) > 0 ? t("objectPreview.desc.npcCoins", " They carry about {coins} coins.", { coins: Math.floor(Number(p.coins || 0)) }) : "";
    const danger = Number(p.attack || 0) > 0 ? t("objectPreview.desc.npcDanger", " If attacked, they fight back for about {attack} health.", { attack: Math.floor(Number(p.attack || 0)) }) : "";
    return `${t("objectPreview.desc.npcBase", "{role} crossing the frontier between the capital and player settlements.", { role })}${coins}${danger}`;
  }
  if (p.kind === "buildTile") return t("objectPreview.desc.buildTile", "An empty captured tile. Choose the building you want here; construction starts immediately and completes over time.");
  if (p.kind === "keep") {
    const hp = p.maxHp ? t("objectPreview.desc.keepHp", " Current rally note: {hp}/{maxHp} HP.", { hp: Math.max(0, Math.floor(Number(p.hp || 0))), maxHp: Math.floor(Number(p.maxHp || 0)) }) : "";
    const coins = p.coins ? t("objectPreview.desc.keepCoins", " Scouts report about {coins} coins inside.", { coins: Math.floor(Number(p.coins || 0)) }) : "";
    return `${t("objectPreview.desc.keep", "A shared raid target. Coordinate in chat, walk there together, and attack before the keep regenerates too much health.")}${hp}${coins}`;
  }
  if (p.kind === "shared") return t("objectPreview.desc.shared", "A place shared in chat. Open it here, then walk toward it when your group is ready.");
  return t("objectPreview.desc.tile", "Open ground. With no tool selected, clicking walkable land moves your character.");
}

export function objectPreviewPrimaryAction(p: ObjectPreview | null | undefined): string {
  if (!p) return "walk";
  if (p.kind === "food") return "harvest-food";
  if (p.kind === "trade") return "open-trade";
  if (p.kind === "npc") return "talk-npc";
  if (p.kind === "tree" || p.kind === "rock") return "walk-near";
  if (p.kind === "keep" || p.kind === "shared") return "walk-near";
  if (p.kind === "buildTile") return "choose-building";
  return "walk";
}

export function objectPreviewActionLabel(action: string): string {
  if (action === "harvest-food") return t("objectPreview.actions.harvest-food", "Harvest food");
  if (action === "open-trade") return t("objectPreview.actions.open-trade", "Open exchange");
  if (action === "walk-near") return t("objectPreview.actions.walk-near", "Walk near");
  if (action === "talk-npc") return t("objectPreview.actions.talk-npc", "Talk");
  if (action === "attack-npc") return t("objectPreview.actions.attack-npc", "Attack");
  if (action === "donate-npc") return t("objectPreview.actions.donate-npc", "Donate");
  if (action === "choose-building") return t("objectPreview.actions.choose-building", "Choose building");
  return t("objectPreview.actions.walk", "Walk here");
}

export function objectPreviewSummaryTitle(p: ObjectPreview | null | undefined): string {
  if (!p) return "";
  if (p.kind === "npc") return p.title || t("objectPreview.summary.npc", "Wanderer");
  if (p.kind === "food") return t("objectPreview.summary.food", "Farm crop");
  if (p.kind === "tile") return t("objectPreview.summary.tile", "Walkable ground");
  if (p.kind === "trade") return t("objectPreview.summary.trade", "World service");
  return t("objectPreview.summary.default", "World object");
}

export function objectPreviewShouldShowPrimary(p: ObjectPreview | null | undefined): boolean {
  if (!p) return false;
  return p.kind === "food" || p.kind === "trade" || p.kind === "npc" || p.kind === "tile" || p.kind === "buildTile" || p.kind === "shared" || p.kind === "keep";
}
