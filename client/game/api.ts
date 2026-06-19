import type { ClientAction, ClientAuth } from "./types.ts";

export async function joinGame(name: string, extra: Record<string, unknown> = {}) {
  return postJson("/api/join", { name, ...extra });
}

export async function sendAction(auth: ClientAuth, action: ClientAction) {
  return postJson("/api/action", { pid: auth.id, secret: auth.secret, ...action });
}

export async function fetchState(auth: ClientAuth, q: { rev?: number; ax?: number; az?: number; chat?: number; mapRev?: number } = {}) {
  const url = new URL("/api/state", location.origin);
  url.searchParams.set("pid", String(auth.id));
  url.searchParams.set("secret", auth.secret);
  for (const [k, v] of Object.entries(q)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { cache: "no-store" });
  return res.json();
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
