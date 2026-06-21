// @ts-nocheck
export function normalizeProductionOrigin(value: any) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Enter production origin first.");
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error("Production origin must be a full URL, like https://solcraft.fun"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Production origin must start with http:// or https://");
  return url.origin;
}

export function summarizeWorldSyncFailure(err: any) {
  const code = String(err?.data?.reasonCode || err?.reasonCode || "");
  const msg = String(err?.data?.msg || err?.message || err || "World sync failed");
  if (code === "SUMMARY_ONLY_EXPORT") return `${msg} This usually means production has an older world-sync route or you are hitting the status endpoint instead of the export endpoint.`;
  if (code === "REMOTE_EXPORT_FAILED" || /HTTP 401|HTTP 403/i.test(msg)) return `${msg} Check the production admin key.`;
  if (/HTTP 404/i.test(msg)) return `${msg} Production probably does not have the export route deployed yet. Use manual JSON import.`;
  return msg;
}
