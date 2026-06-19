// @ts-nocheck
import { adminKeyHeaders, adminKeyQuery } from "./adminKey";

export const PLAYER_RESOURCE_FIELDS = [
  ["w", "Wood", "🪵"], ["s", "Stone", "🪨"], ["p", "Planks", "📦"], ["f", "Food", "🌾"],
  ["g", "Coins", "🪙"], ["sc", "Science", "🔬"], ["sh", "Shards", "◈"],
  ["energy", "Energy", "⚡"], ["hp", "HP", "❤"], ["xp", "XP", "★"], ["skillPts", "Skill pts", "✦"],
  ["tokenBalance", "Bank tokens", "$"], ["strongbox", "Strongbox", "▣"],
];

export const BOMB_VARIANTS = ["cracker", "snare", "popper", "thumper", "cutter", "sapper", "breacher", "quake"];

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(data?.msg || res.statusText || "request failed");
  return data;
}

export async function fetchPlayerResources(adminKey = "") {
  return readJson(await fetch(`/api/admin/player-resources${adminKeyQuery(adminKey)}`, {
    method: "GET",
    headers: adminKeyHeaders(adminKey),
    cache: "no-store",
  }));
}

export async function postPlayerResources(body: any, adminKey = "") {
  return readJson(await fetch("/api/admin/player-resources", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminKeyHeaders(adminKey) },
    body: JSON.stringify({ ...body, adminKey }),
  }));
}
