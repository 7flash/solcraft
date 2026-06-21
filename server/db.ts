/* ============================================================
   SOLCRAFT db — sqlite-zod-orm, WAL mode, one shared world.
   Tables hold only authoritative mutable state; everything
   procedural (terrain, natural doodads) is derived from
   game/shared.ts hashes so the DB stays tiny.
   ============================================================ */
import { Database, z } from "sqlite-zod-orm";
import { DB_SCHEMA_VERSION, applyProductionDbSchema } from "./dbSchema";
import { applyStartupDataMigrations } from "./dbMigration";

export const db = new Database(process.env.SOLCRAFT_DB || "solcraft.db", {
  players: z.object({
    name: z.string(),
    secret: z.string(),
    body: z.number(),
    hat: z.number(),
    x: z.number().default(0),
    z: z.number().default(0),
    spawnX: z.number().default(0),
    spawnZ: z.number().default(0),
    hp: z.number().default(20),
    energy: z.number().default(50),
    energyAt: z.number().default(0), // ms timestamp of last energy settle
    wallet: z.union([z.string(), z.null()]).default(null), // Phantom/Solana identity + payout address
    faceImage: z.union([z.string(), z.null()]).default(null), // optional profile portrait shown on base/player inspect cards
    appearance: z.union([z.string(), z.null()]).default(null), // compact Doll atlas appearance JSON shared with other players
    tokenBalance: z.number().default(0), // synced/readable $CRAFTS balance, updated by distributor/RPC glue
    vault: z.number().default(0), // legacy safe banked gold; migrated into strongbox by engine helpers
    strongbox: z.number().default(0), // safe gold floor that cannot be raided
    inv: z.record(z.number()),
    pack: z.array(z.any()),
    equip: z.record(z.union([z.string(), z.null()])),
    xp: z.number().default(0),
    level: z.number().default(1),
    skillPts: z.number().default(0),
    skills: z.record(z.number()).default({}),
    treesChopped: z.number().default(0),
    planksMade: z.number().default(0),
    gearCrafted: z.number().default(0),
    tradesDone: z.number().default(0),
    equippedOnce: z.number().default(0),
    msIndex: z.number().default(0),
    lastSeen: z.number().default(0),
    profileDone: z.number().default(0),
  }),
  tiles: z.object({
    x: z.number(),
    z: z.number(),
    owner: z.number(), // players.id
  }),
  buildings: z.object({
    owner: z.number(),
    kind: z.string(), // LIBRARY id
    x: z.number(),
    z: z.number(),
    nm: z.union([z.string(), z.null()]).default(null),
    cl: z.union([z.string(), z.null()]).default(null),
    level: z.number().default(1),
    hp: z.number().default(12), // structure HP; raids damage, repair restores
    maxHp: z.number().default(12), // stored so masonry bonus & upgrades persist
    acc: z.number().default(0), // settled stockpile
    accAt: z.number().default(0), // ms timestamp of last settle
    cdUntil: z.number().default(0), // cooldown end, ms
    usedAt: z.number().default(0), // last successful/cosmetic use animation timestamp
    stored: z.number().default(0), // vault building gold storage
  }),
  /* exceptions to the procedural doodad field:
     state 'gone'  — natural tree/rock was harvested
     state 'tree'/'rock' — a planted node on a cell with no natural one */
  doodads: z.object({
    x: z.number(),
    z: z.number(),
    state: z.string(), // 'gone' | 'tree'
  }),
  loot: z.object({
    x: z.number(),
    z: z.number(),
    kind: z.string(), // wood|stone|food|gold|energy|shard|relic|gear
    gid: z.union([z.string(), z.null()]).default(null),
  }),
  chat: z.object({
    name: z.string(),
    msg: z.string(),
    sys: z.number().default(0),
  }),
  offers: z.object({
    byId: z.number(),
    byName: z.string(),
    gRes: z.string(),
    gAmt: z.number(),
    wRes: z.string(),
    wAmt: z.number(),
    open: z.number().default(1),
  }),
  /* per-player toast/event inbox, deleted on delivery */
  events: z.object({
    target: z.number(),
    kind: z.string(),
    msg: z.string(),
  }),
  /* one-use Phantom/Solana sign-in challenges */
  walletChallenges: z.object({
    wallet: z.string(),
    nonce: z.string(),
    message: z.string(),
    used: z.number().default(0),
  }),
  /* gold → $CRAFTS payout queue; an external processor reads
     'pending' rows, sends the SPL transfer, then marks 'paid' */
  redemptions: z.object({
    player: z.number(),
    wallet: z.string(),
    gold: z.number(),
    crafts: z.number().default(0), // assigned at cycle close by pro-rata fee-pool settlement
    status: z.string().default("pending"), // pending | paid | rejected
    sig: z.union([z.string(), z.null()]).default(null), // tx signature once paid
  }),
  meta: z.object({
    k: z.string(),
    v: z.string(),
  }),
}, {
  timestamps: true,
  /* NOTE: no `relations` on purpose — FK columns like tiles.owner
     would be shadowed by the ORM's navigation proxies when rows are
     serialized. Integrity is enforced in the engine instead. */
});

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA synchronous = NORMAL");
db.exec("PRAGMA busy_timeout = 4000");
db.exec("PRAGMA cache_size = -16000"); // 16 MB page cache — snapshots are read-heavy
// One tile/building/loot pile per coordinate. Startup migrations keep old DB
// files compatible with the hard coordinate indexes that back exact-cell stores.
applyStartupDataMigrations(db);
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uniq_tiles_xz ON tiles(x, z)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uniq_buildings_xz ON buildings(x, z)");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uniq_loot_xz ON loot(x, z)");
db.exec("CREATE INDEX IF NOT EXISTS idx_tiles_xz ON tiles(x, z)");
db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_xz ON buildings(x, z)");
db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_owner ON buildings(owner)");
db.exec("CREATE INDEX IF NOT EXISTS idx_tiles_owner ON tiles(owner)");
db.exec("CREATE INDEX IF NOT EXISTS idx_doodads_xz ON doodads(x, z)");
db.exec("CREATE INDEX IF NOT EXISTS idx_loot_xz ON loot(x, z)");
db.exec("CREATE INDEX IF NOT EXISTS idx_events_target ON events(target)");
db.exec("CREATE INDEX IF NOT EXISTS idx_redemptions_status ON redemptions(status)");
db.exec("CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet)");
db.exec("CREATE INDEX IF NOT EXISTS idx_wallet_challenges_wallet_nonce ON walletChallenges(wallet, nonce)");

// Stage 7 production schema: additive indexes only. Keep this centralized so
// ECS migrations and current SQLite query shapes evolve from one checklist.
applyProductionDbSchema(db);

export function metaGet(k: string, dflt = ""): string {
  const row = db.meta.select().where({ k }).first();
  return row ? row.v : dflt;
}
export function metaSet(k: string, v: string) {
  const row = db.meta.select().where({ k }).first();
  if (row) (row as any).v = v;
  else db.meta.insert({ k, v });
}

export const CURRENT_DB_SCHEMA_VERSION = DB_SCHEMA_VERSION;
export function ensureDbSchemaVersion() {
  const current = Number(metaGet("solcraft:db:schemaVersion", "0")) || 0;
  if (current < DB_SCHEMA_VERSION) metaSet("solcraft:db:schemaVersion", String(DB_SCHEMA_VERSION));
  return { current: Math.max(current, DB_SCHEMA_VERSION), target: DB_SCHEMA_VERSION };
}
ensureDbSchemaVersion();