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
  "lumber",
  "quarry",
  "farm",
  "warehouse",
  "worldwonder",
] as const;

const FALLBACK_CLEAN_BUILD_CHOICES: CleanBuildChoice[] = [
  { id: "cottage", name: "House", icon: "🏠", role: "settlement", text: "First settlement anchor and teleport point between your homes." },
  { id: "lumber", name: "Lumber Camp", icon: "🪓", role: "resource", text: "Creates nearby tree work. Trees still need to be chopped and collected." },
  { id: "quarry", name: "Quarry", icon: "⛏", role: "resource", text: "Creates nearby rock work. Stone is used for buildings and Landmarks." },
  { id: "farm", name: "Farm", icon: "🌾", role: "resource", text: "Creates crop patches. Harvest food before fights and raids." },
  { id: "warehouse", name: "Warehouse", icon: "▤", role: "storage", text: "Only normal building that increases shared wood/stone/food storage." },
  { id: "worldwonder", name: "Landmark", icon: "★", role: "wonder", text: "Shared landmark built from wood and stone that boosts coin production for everyone." },
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