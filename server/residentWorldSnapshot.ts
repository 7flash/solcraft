import { promises as fs } from "fs";
import { existsSync, mkdirSync, renameSync, writeFileSync, readFileSync, copyFileSync } from "fs";
import path from "path";

export type ResidentWorldSnapshot = {
  schemaVersion: number;
  savedAt: number;
  rev: number;
  chunkSize: number;
  reason?: string;
  chunkRevs: Record<string, number>;
  players: any[];
  tiles: any[];
  buildings: any[];
  doodads: any[];
  loot: any[];
};

function worldDir() { return path.join(process.cwd(), process.env.SOLCRAFT_WORLD_DIR || "data", "world"); }
function currentFile() { return path.join(worldDir(), "resident-world.current.json"); }
function previousFile() { return path.join(worldDir(), "resident-world.previous.json"); }
function tempFile() { return path.join(worldDir(), `resident-world.${process.pid}.${Date.now()}.tmp`); }
function ensureDir() { const d = worldDir(); if (!existsSync(d)) mkdirSync(d, { recursive: true }); return d; }

export function saveResidentWorldSnapshot(snapshot: ResidentWorldSnapshot) {
  try {
    ensureDir();
    const current = currentFile();
    const prev = previousFile();
    const tmp = tempFile();
    const body = JSON.stringify(snapshot, null, process.env.SOLCRAFT_WORLD_PRETTY_JSON === "1" ? 2 : 0);
    if (existsSync(current)) {
      try { copyFileSync(current, prev); } catch {}
    }
    writeFileSync(tmp, body);
    renameSync(tmp, current);
    return { ok: true, file: current, bytes: Buffer.byteLength(body), savedAt: snapshot.savedAt, rev: snapshot.rev };
  } catch (e: any) {
    return { ok: false, msg: String(e?.message || e || "snapshot save failed"), reasonCode: "WORLD_SNAPSHOT_SAVE_FAILED" };
  }
}

export function loadResidentWorldSnapshot(): { ok: boolean; snapshot?: ResidentWorldSnapshot; file?: string; msg?: string; reasonCode?: string } {
  try {
    const current = currentFile();
    if (!existsSync(current)) return { ok: false, reasonCode: "WORLD_SNAPSHOT_MISSING", msg: "No resident world snapshot exists yet." };
    const raw = readFileSync(current, "utf8");
    const snapshot = JSON.parse(raw) as ResidentWorldSnapshot;
    if (!snapshot || !Array.isArray(snapshot.players)) return { ok: false, reasonCode: "WORLD_SNAPSHOT_INVALID", msg: "Resident world snapshot is invalid." };
    return { ok: true, snapshot, file: current };
  } catch (e: any) {
    return { ok: false, msg: String(e?.message || e || "snapshot load failed"), reasonCode: "WORLD_SNAPSHOT_LOAD_FAILED" };
  }
}

export async function listResidentWorldSnapshots() {
  const d = ensureDir();
  const files = await fs.readdir(d).catch(() => [] as string[]);
  return files.filter((f) => /resident-world\..+\.json$/i.test(f)).sort().map((f) => path.join(d, f));
}
