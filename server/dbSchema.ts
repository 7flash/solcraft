export const DB_SCHEMA_VERSION = 7;

export function applyProductionDbSchema(db: { exec(sql: string): unknown }) {
  // Coordinates and ownership: current hot range queries plus future ECS/chunk adapters.
  db.exec("CREATE INDEX IF NOT EXISTS idx_tiles_owner_xz ON tiles(owner, x, z)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_owner_kind ON buildings(owner, kind)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_owner_xz ON buildings(owner, x, z)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_owner_kind_xz ON buildings(owner, kind, x, z)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_kind_owner ON buildings(kind, owner)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_kind_xz ON buildings(kind, x, z)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_buildings_kind_cdUntil ON buildings(kind, cdUntil)");

  // Runtime maintenance and low-churn world objects.
  db.exec("CREATE INDEX IF NOT EXISTS idx_doodads_state_updated ON doodads(state, updatedAt)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_loot_kind_xz ON loot(kind, x, z)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_loot_createdAt ON loot(createdAt)");

  // Player/session/admin/account screens.
  db.exec("CREATE INDEX IF NOT EXISTS idx_players_lastSeen ON players(lastSeen)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_players_wallet_lastSeen ON players(wallet, lastSeen)");

  // Feed/ring/order queries. These are additive and safe on existing DB files.
  db.exec("CREATE INDEX IF NOT EXISTS idx_chat_createdAt_id ON chat(createdAt, id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_offers_open ON offers(open)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_offers_open_createdAt ON offers(open, createdAt)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_events_target_id ON events(target, id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_redemptions_player_status ON redemptions(player, status)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_redemptions_status_createdAt ON redemptions(status, createdAt)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_wallet_challenges_wallet_used ON walletChallenges(wallet, used)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_wallet_challenges_wallet_used_createdAt ON walletChallenges(wallet, used, createdAt)");
}
