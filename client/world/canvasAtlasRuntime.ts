// @ts-nocheck
/** Renderer-independent atlas runtime shim.
 * Canvas world does not need terrain/material atlases, but a few UI flows still
 * call loadAtlasRuntimeConfig() after settings changes.  Keep the async contract
 * and avoid importing the old Three.js texture module.
 */
let lastRuntime: any = null;

export async function loadAtlasRuntimeConfig(force = false) {
  if (!force && lastRuntime) return lastRuntime;
  try {
    const res = await fetch('/api/atlas-runtime', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    lastRuntime = json || { ok: false, atlases: {} };
  } catch {
    lastRuntime = { ok: false, atlases: {} };
  }
  return lastRuntime;
}

export function atlasRuntimeSnapshot() {
  return lastRuntime || { ok: false, atlases: {} };
}
