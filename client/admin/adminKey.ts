// @ts-nocheck
export const ADMIN_KEY_STORAGE = "solcraft:adminKey.v1";

export function readAdminKey() {
  try { return String(localStorage.getItem(ADMIN_KEY_STORAGE) || ""); }
  catch { return ""; }
}

export function writeAdminKey(v: string) {
  try {
    const next = String(v || "");
    if (next) localStorage.setItem(ADMIN_KEY_STORAGE, next);
    else localStorage.removeItem(ADMIN_KEY_STORAGE);
  } catch {}
}

export function adminKeyHeaders(adminKey: string) {
  const key = String(adminKey || "").trim();
  return key ? { "x-solcraft-admin-key": key } : {};
}

export function adminKeyQuery(adminKey: string) {
  const key = String(adminKey || "").trim();
  return key ? `?adminKey=${encodeURIComponent(key)}` : "";
}

export function explainAdminError(raw: any) {
  const msg = String(raw?.message || raw || "");
  return msg.includes("Unauthorized admin key")
    ? "Admin key required or incorrect. Paste your local SOLCRAFT_ADMIN_KEY / ADMIN_KEY below, then click Reload."
    : msg;
}
