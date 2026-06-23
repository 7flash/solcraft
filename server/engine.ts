/*
 * Legacy engine removed from the production path.
 *
 * server/backend.ts exports ecsBackend only. This file remains as a tombstone so
 * stale imports fail loudly instead of silently running a second gameplay model.
 */
export function legacyEngineRemoved(): never {
  throw new Error("Legacy engine is removed. Use @server/backend or @server/ecsBackend.");
}
