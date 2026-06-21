// @ts-nocheck

export function npcTalkLine(p: any) {
  const name = p?.name || p?.title || "Wanderer";
  const carrying = Number(p?.resourceAmount || 0) > 0 && p?.resource
    ? ` I am carrying ${Math.floor(Number(p.resourceAmount || 0))} ${String(p.resource)} from the frontier.`
    : Number(p?.coins || 0) > 0
      ? ` I have ${Math.floor(Number(p.coins || 0))} coins for the road.`
      : " I am watching the road between the capital and the settlements.";
  if (p?.role === "trader") return `${name}: Donate supplies to earn trust with the Empire, or leave me to gather resources.${carrying}`;
  if (p?.role === "warrior") return `${name}: Keep your blade sheathed unless you want the Empire to remember it.${carrying}`;
  if (p?.role === "traveler") return `${name}: Roads, camps, and Wonders draw travelers like me.${carrying}`;
  return `${name}: The frontier is busy today.${carrying}`;
}
