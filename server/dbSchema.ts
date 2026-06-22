export const DB_SCHEMA_VERSION = 63;
export const CURRENT_DB_SCHEMA_VERSION = DB_SCHEMA_VERSION;

function execIndex(db: any, sql: string) {
  try {
    db.exec(sql);
    return true;
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    // The clean/legacy cutover can boot against different DB shapes during tests,
    // migrations, and fresh RC init. Additive indexes must never make boot fail.
    if (/no such table|no such column|no such index|duplicate column/i.test(msg)) return false;
    throw e;
  }
}

export function applyProductionDbSchema(db: { exec(sql: string): unknown }) {
  const d: any = db;
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_tiles_owner_xz ON tiles(owner, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_tiles_xz_id ON tiles(x, z, id)',
    'CREATE INDEX IF NOT EXISTS idx_tiles_id_xz ON tiles(id, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_tiles_owner_id ON tiles(owner, id)',
    'CREATE INDEX IF NOT EXISTS idx_tiles_updatedAt ON tiles(updatedAt)',
    'CREATE INDEX IF NOT EXISTS idx_tiles_owner_updatedAt ON tiles(owner, updatedAt)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_kind ON buildings(owner, kind)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_xz ON buildings(owner, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_kind_xz ON buildings(owner, kind, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_kind_owner ON buildings(kind, owner)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_kind_xz ON buildings(kind, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_kind_cd ON buildings(kind, cdUntil)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_kind_cdUntil ON buildings(kind, cdUntil)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_xz_id ON buildings(x, z, id)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_id_xz ON buildings(id, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_updatedAt ON buildings(updatedAt)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_updatedAt ON buildings(owner, updatedAt)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_kind_updatedAt ON buildings(kind, updatedAt)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_kind_owner_level ON buildings(kind, owner, level)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_cdUntil ON buildings(owner, cdUntil)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_hp ON buildings(owner, hp)',
    'CREATE INDEX IF NOT EXISTS idx_buildings_owner_kind_hp ON buildings(owner, kind, hp)',
    'CREATE INDEX IF NOT EXISTS idx_doodads_xz_state ON doodads(x, z, state)',
    'CREATE INDEX IF NOT EXISTS idx_doodads_updatedAt_state ON doodads(updatedAt, state)',
    'CREATE INDEX IF NOT EXISTS idx_doodads_state_xz ON doodads(state, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_doodads_source_state_updated ON doodads(sourceBuilding, state, updatedAt)',
    'CREATE INDEX IF NOT EXISTS idx_loot_kind_xz ON loot(kind, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_loot_xz_id ON loot(x, z, id)',
    'CREATE INDEX IF NOT EXISTS idx_loot_id_xz ON loot(id, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_loot_kind_createdAt ON loot(kind, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_loot_kind_created_xz ON loot(kind, createdAt, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_players_lastSeen ON players(lastSeen)',
    'CREATE INDEX IF NOT EXISTS idx_players_name ON players(name)',
    'CREATE INDEX IF NOT EXISTS idx_players_wallet_lastSeen ON players(wallet, lastSeen)',
    'CREATE INDEX IF NOT EXISTS idx_players_id_lastSeen ON players(id, lastSeen)',
    'CREATE INDEX IF NOT EXISTS idx_players_wallet_id ON players(wallet, id)',
    'CREATE INDEX IF NOT EXISTS idx_players_spawn_xz ON players(spawnX, spawnZ)',
    'CREATE INDEX IF NOT EXISTS idx_players_profileDone_lastSeen ON players(profileDone, lastSeen)',
    'CREATE INDEX IF NOT EXISTS idx_players_level_xp_lastSeen ON players(level, xp, lastSeen)',
    'CREATE INDEX IF NOT EXISTS idx_players_reputation_lastSeen ON players(reputation, lastSeen)',
    'CREATE INDEX IF NOT EXISTS idx_chat_createdAt_id ON chat(createdAt, id)',
    'CREATE INDEX IF NOT EXISTS idx_events_target_id ON events(target, id)',
    'CREATE INDEX IF NOT EXISTS idx_redemptions_player_status ON redemptions(player, status)',
    'CREATE INDEX IF NOT EXISTS idx_redemptions_status_createdAt ON redemptions(status, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_redemptions_wallet_status ON redemptions(wallet, status)',
    'CREATE INDEX IF NOT EXISTS idx_wallet_challenges_wallet_used ON walletChallenges(wallet, used)',
    'CREATE INDEX IF NOT EXISTS idx_wallet_challenges_wallet_used_createdAt ON walletChallenges(wallet, used, createdAt)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_ecs_entities_legacy ON ecsEntities(legacyTable, legacyId)',
    'CREATE INDEX IF NOT EXISTS idx_ecs_entities_kind_active ON ecsEntities(kind, active)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_ecs_components_entity_kind ON ecsComponents(entity, kind)',
    'CREATE INDEX IF NOT EXISTS idx_ecs_components_kind_rev ON ecsComponents(kind, rev)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_ecs_snapshots_name ON ecsSnapshots(name)',
    'CREATE INDEX IF NOT EXISTS idx_ecs_action_log_player_createdAt ON ecsActionLog(player, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_ecs_action_log_action_createdAt ON ecsActionLog(action, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_ecs_action_log_reason_createdAt ON ecsActionLog(reasonCode, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_player_ts ON activityLog(playerId, ts)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_wallet_ts ON activityLog(wallet, ts)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_action_ts ON activityLog(action, ts)',
    'CREATE INDEX IF NOT EXISTS idx_activity_log_reason_ts ON activityLog(reasonCode, ts)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_deposits_player ON bankDeposits(playerId)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_deposits_address ON bankDeposits(address)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_scans_player ON bankScans(playerId)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_deposit_events_signature ON bankDepositEvents(signature)',
    'CREATE INDEX IF NOT EXISTS idx_bank_deposit_events_player_confirmed ON bankDepositEvents(playerId, confirmedAt)',
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_bank_withdrawals_withdrawalId ON bankWithdrawals(withdrawalId)',
    'CREATE INDEX IF NOT EXISTS idx_bank_withdrawals_player_status ON bankWithdrawals(playerId, status)',
    'CREATE INDEX IF NOT EXISTS idx_bank_withdrawals_wallet_status ON bankWithdrawals(wallet, status)',
    'CREATE INDEX IF NOT EXISTS idx_bank_withdrawals_status_created ON bankWithdrawals(status, createdAtMs)',
    'CREATE INDEX IF NOT EXISTS idx_bank_errors_action_created ON bankErrors(action, createdAtMs)',
    'CREATE INDEX IF NOT EXISTS idx_keeps_state_xz ON keeps(state, x, z)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_kind_lastStep ON npcs(kind, lastStepAt)',
    'CREATE INDEX IF NOT EXISTS idx_npcs_target ON npcs(targetX, targetZ)',
    'CREATE INDEX IF NOT EXISTS idx_wonders_owner_state ON wonders(owner, state)',
    'CREATE INDEX IF NOT EXISTS idx_coin_ledger_player_created ON coin_ledger(player, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_admin_config_history_name_created ON admin_config_history(name, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referralCodes(ownerPlayerId, active, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referralCodes(code)',
    'CREATE INDEX IF NOT EXISTS idx_referral_claims_referrer ON referralClaims(referrerPlayerId, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_referral_claims_referee ON referralClaims(refereePlayerId)',
    'CREATE INDEX IF NOT EXISTS idx_referral_claims_ip ON referralClaims(ipHash, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_gift_grants_player ON giftGrants(playerId, status, createdAt)',
    'CREATE INDEX IF NOT EXISTS idx_player_cosmetics_player ON playerCosmetics(playerId, equipped)',
    'CREATE INDEX IF NOT EXISTS idx_meta_runtime_prefix ON meta(k)',
  ];
  for (const sql of indexes) execIndex(d, sql);
}
