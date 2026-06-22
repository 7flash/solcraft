import { t, tArray } from "../i18n";

export type CleanBuildChoice = {
  id: string;
  name: string;
  icon: string;
  text: string;
  role: "settlement" | "storage" | "resource" | "service" | "wonder";
};

export const CLEAN_BUILDING_IDS = [
  "cottage",
  "warehouse",
  "lumber",
  "quarry",
  "farm",
  "market",
  "vault",
  "alchemy",
  "townhall",
  "worldwonder",
] as const;

const FALLBACK_CLEAN_BUILD_CHOICES: CleanBuildChoice[] = [
  { id: "cottage", name: "House", icon: "🏠", role: "settlement", text: "Attracts NPC traffic and supports settlement expansion." },
  { id: "warehouse", name: "Warehouse", icon: "▤", role: "storage", text: "Raises storage caps. If destroyed, excess resources rot down over time." },
  { id: "lumber", name: "Lumber Camp", icon: "🪓", role: "resource", text: "Spawns trees nearby. Trees still need to be cut and gathered manually." },
  { id: "quarry", name: "Quarry", icon: "⛏", role: "resource", text: "Spawns rocks nearby. Rocks still need to be mined and gathered manually." },
  { id: "farm", name: "Farm", icon: "🌾", role: "resource", text: "Spawns crop patches nearby. Cut crops, then gather food before raids." },
  { id: "market", name: "Market", icon: "🪙", role: "service", text: "Future clean market/rates building. Player escrow is removed." },
  { id: "vault", name: "Bank", icon: "🏦", role: "service", text: "Opens bank actions from the building preview: deposit and withdraw." },
  { id: "alchemy", name: "Customizer", icon: "🎨", role: "service", text: "Lets you change your character doll from a world building for 1 coin." },
  { id: "townhall", name: "Town Hall", icon: "🏛", role: "settlement", text: "High-trust settlement authority and larger storage for mature bases." },
  { id: "worldwonder", name: "World Wonder", icon: "★", role: "wonder", text: "Prompt-built reputation landmark founded in the wild outside your territory." },
];

export function cleanBuildChoices(): CleanBuildChoice[] {
  return tArray("build.cleanChoices", FALLBACK_CLEAN_BUILD_CHOICES) as CleanBuildChoice[];
}

export function cleanBuildChoiceById(id: string) {
  return cleanBuildChoices().find((b) => b.id === id) || null;
}

export function cleanBuildRoleLabel(role: CleanBuildChoice["role"] | string) {
  if (role === "resource") return t("build.role.resource", "Resource source");
  if (role === "storage") return t("build.role.storage", "Storage");
  if (role === "service") return t("build.role.service", "Service");
  if (role === "wonder") return t("build.role.wonder", "Wonder");
  return t("build.role.settlement", "Settlement");
}
