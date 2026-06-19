export type NormalizedProductionOrigin = {
  ok: boolean;
  origin: string;
  msg: string;
};

export function normalizeProductionOrigin(value: unknown): NormalizedProductionOrigin {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, origin: "", msg: "Enter production origin first." };

  let candidate = raw.replace(/\/+$/g, "");
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) && !/^https?:\/\//i.test(candidate)) {
    return { ok: false, origin: "", msg: "Production origin must be http or https." };
  }
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, origin: "", msg: "Production origin must be http or https." };
    }
    return { ok: true, origin: url.origin, msg: "" };
  } catch {
    return { ok: false, origin: "", msg: "Production origin must be a full URL, like https://solcraft.fun." };
  }
}

export function formatWorldSyncCounts(counts: any = {}) {
  const n = (v: any) => Math.floor(Number(v || 0)).toLocaleString();
  return `${n(counts.players)} players · ${n(counts.tiles)} tiles · ${n(counts.buildings)} buildings`;
}
