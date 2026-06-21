// @ts-nocheck
import { t } from "../i18n";

export function npcTalkLine(p: any) {
  const name = p?.name || p?.title || t("objectPreview.roles.wanderer", "Wanderer");
  const carrying = Number(p?.resourceAmount || 0) > 0 && p?.resource
    ? t("npc.carryingResource", " I am carrying {amount} {resource} from the frontier.", { amount: Math.floor(Number(p.resourceAmount || 0)), resource: String(p.resource) })
    : Number(p?.coins || 0) > 0
      ? t("npc.carryingCoins", " I have {coins} coins for the road.", { coins: Math.floor(Number(p.coins || 0)) })
      : t("npc.watchingRoad", " I am watching the road between the capital and the settlements.");
  if (p?.role === "trader") return t("npc.trader", "{name}: Donate supplies to earn trust with the Empire, or leave me to gather resources.{carrying}", { name, carrying });
  if (p?.role === "warrior") return t("npc.warrior", "{name}: Keep your blade sheathed unless you want the Empire to remember it.{carrying}", { name, carrying });
  if (p?.role === "traveler") return t("npc.traveler", "{name}: Roads, camps, and Wonders draw travelers like me.{carrying}", { name, carrying });
  return t("npc.default", "{name}: The frontier is busy today.{carrying}", { name, carrying });
}
