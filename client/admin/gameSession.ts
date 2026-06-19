// @ts-nocheck
/** Small admin/test-page helpers so every mechanics lab does not reimplement auth/state/action plumbing. */
export const AUTH_KEY = "solcraft:auth";

export function readSavedGameAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
  catch { return null; }
}

export async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) throw new Error(String(data?.msg || data?.reasonCode || res.statusText || "request failed"));
  return data;
}

export async function gameAction(auth: any, type: string, payload: any = {}) {
  if (!auth?.pid || !auth?.secret) throw new Error("No saved game auth. Open the game and join first.");
  return jsonFetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid: auth.pid, secret: auth.secret, type, ...payload }),
  });
}

export async function fetchGameState(auth: any, opts: any = {}) {
  if (!auth?.pid || !auth?.secret) throw new Error("No saved game auth. Open the game and join first.");
  const q = new URLSearchParams({
    pid: String(auth.pid),
    secret: String(auth.secret),
    rev: String(opts.rev ?? 0),
    mapRev: String(opts.mapRev ?? -1),
  });
  return jsonFetch(`/api/state?${q.toString()}`);
}

export function stateRoot(snap: any) { return snap?.snap || snap || {}; }
export function stateMe(snap: any) { return stateRoot(snap)?.me || null; }
export function stateWorld(snap: any) { return stateRoot(snap)?.world || {}; }
export function worldBuildings(snap: any) { const w = stateWorld(snap); return w?.buildings || w?.b || []; }
export function worldLoot(snap: any) { const w = stateWorld(snap); return w?.loot || w?.l || []; }
export function keepRows(snap: any) { return worldBuildings(snap).filter((b: any) => String(b.kind) === "keep").sort((a: any, b: any) => Number(a.uid || a.id) - Number(b.uid || b.id)); }
export function coinLootRows(snap: any) { return worldLoot(snap).filter((l: any) => String(l.kind) === "gold" || String(l.kind) === "coin"); }
export function invCount(me: any, key: string) { return Math.floor(Number(me?.inv?.[key] ?? me?.[key] ?? 0)); }
