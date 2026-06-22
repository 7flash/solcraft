-- Stage 15 clean ECS schema proposal. This is for a fresh production reset DB.
-- The migration from legacy rows should be written later after the rules settle.
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  secret TEXT NOT NULL,
  wallet TEXT,
  x INTEGER NOT NULL DEFAULT 0,
  z INTEGER NOT NULL DEFAULT 0,
  spawnX INTEGER NOT NULL DEFAULT 0,
  spawnZ INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 20,
  energy REAL NOT NULL DEFAULT 50,
  energyAt INTEGER NOT NULL DEFAULT 0,
  reputation INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  appearance TEXT,
  profileDone INTEGER NOT NULL DEFAULT 0,
  lastSeen INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS inventories (
  player INTEGER NOT NULL,
  res TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  PRIMARY KEY(player, res)
);

CREATE TABLE IF NOT EXISTS tiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x INTEGER NOT NULL,
  z INTEGER NOT NULL,
  owner INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'owned',
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(x, z)
);

CREATE TABLE IF NOT EXISTS buildings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  x INTEGER NOT NULL,
  z INTEGER NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  hp INTEGER NOT NULL DEFAULT 12,
  maxHp INTEGER NOT NULL DEFAULT 12,
  storedCoins INTEGER NOT NULL DEFAULT 0,
  constructUntil INTEGER NOT NULL DEFAULT 0,
  usedAt INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  color TEXT,
  data TEXT,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(x, z)
);

CREATE TABLE IF NOT EXISTS doodads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x INTEGER NOT NULL,
  z INTEGER NOT NULL,
  kind TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'alive',
  sourceBuilding INTEGER NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 1,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(x, z)
);

CREATE TABLE IF NOT EXISTS loot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x INTEGER NOT NULL,
  z INTEGER NOT NULL,
  kind TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 1,
  data TEXT,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  UNIQUE(x, z, kind)
);

CREATE TABLE IF NOT EXISTS runtime_config (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  msg TEXT NOT NULL,
  sys INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS wallet_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet TEXT NOT NULL,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS bank_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player INTEGER NOT NULL,
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  wallet TEXT,
  sig TEXT,
  data TEXT,
  createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  updatedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet);
CREATE INDEX IF NOT EXISTS idx_players_lastSeen ON players(lastSeen);
CREATE INDEX IF NOT EXISTS idx_players_reputation ON players(reputation);
CREATE INDEX IF NOT EXISTS idx_tiles_owner_xz ON tiles(owner, x, z);
CREATE INDEX IF NOT EXISTS idx_buildings_owner_kind ON buildings(owner, kind);
CREATE INDEX IF NOT EXISTS idx_buildings_kind_xz ON buildings(kind, x, z);
CREATE INDEX IF NOT EXISTS idx_doodads_kind_state ON doodads(kind, state);
CREATE INDEX IF NOT EXISTS idx_doodads_sourceBuilding ON doodads(sourceBuilding);
CREATE INDEX IF NOT EXISTS idx_loot_kind_xz ON loot(kind, x, z);
CREATE INDEX IF NOT EXISTS idx_chat_createdAt ON chat(createdAt);
CREATE INDEX IF NOT EXISTS idx_bank_ledger_player_status ON bank_ledger(player, status);

-- Admin-tunable economy. Runtime code reads these JSON values from DB/meta so
-- balancing can be changed after simulation without editing code.
INSERT OR IGNORE INTO runtime_config(k, v) VALUES
  ('solcraft:clean:economyRuntime:v1', json_object(
    'tickMs', 1000,
    'storageRotFractionPerTick', 0.08,
    'storageRotMinPerTick', 1,
    'buildingRegenPerTick', 0.8,
    'buildingRegenPerLevel', 0.22,
    'capitalRegenPerTick', 12,
    'campSpawnIntervalMs', 28000,
    'campSpawnRadius', 3,
    'campMaxNodesPerLevel', 2,
    'campMaxTotalNodes', 12,
    'campSpawnChancePerTick', 0.72
  )),
  ('solcraft:clean:economyConfig:v1', json_object(
    'tileBase', 18,
    'tilePerLevel', 3,
    'tilePerReputation', 0.12,
    'warehouseBaseStorage', 80,
    'warehouseStoragePerLevel', 45
  ));

-- Stage 16–24 observability and bank audit tables.
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  kind TEXT NOT NULL,
  requestId TEXT NOT NULL,
  playerId INTEGER NOT NULL DEFAULT 0,
  wallet TEXT,
  route TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  backend TEXT NOT NULL DEFAULT '',
  ok INTEGER NOT NULL DEFAULT 0,
  reasonCode TEXT,
  msg TEXT NOT NULL DEFAULT '',
  ms INTEGER NOT NULL DEFAULT 0,
  fieldsJson TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS bank_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playerId INTEGER NOT NULL,
  depositId TEXT NOT NULL,
  address TEXT NOT NULL,
  wallet TEXT NOT NULL,
  createdAtMs INTEGER NOT NULL,
  UNIQUE(playerId),
  UNIQUE(address)
);

CREATE TABLE IF NOT EXISTS bank_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playerId INTEGER NOT NULL,
  latestSignature TEXT,
  creditedRaw TEXT NOT NULL DEFAULT '0',
  scanned INTEGER NOT NULL DEFAULT 0,
  updatedAtMs INTEGER NOT NULL,
  signaturesJson TEXT NOT NULL DEFAULT '[]',
  UNIQUE(playerId)
);

CREATE TABLE IF NOT EXISTS bank_deposit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playerId INTEGER NOT NULL,
  signature TEXT NOT NULL,
  amountRaw TEXT NOT NULL DEFAULT '0',
  amountUi TEXT NOT NULL DEFAULT '0',
  slot INTEGER NOT NULL DEFAULT 0,
  confirmedAt INTEGER NOT NULL DEFAULT 0,
  UNIQUE(signature)
);

CREATE TABLE IF NOT EXISTS bank_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  withdrawalId TEXT NOT NULL,
  playerId INTEGER NOT NULL,
  wallet TEXT NOT NULL DEFAULT '',
  toWallet TEXT NOT NULL,
  token TEXT NOT NULL DEFAULT '',
  tokenAddress TEXT NOT NULL DEFAULT '',
  tokenLabel TEXT NOT NULL DEFAULT '$CRAFTS',
  amountRaw TEXT NOT NULL DEFAULT '0',
  amountUi TEXT NOT NULL DEFAULT '0',
  status TEXT NOT NULL DEFAULT 'pending',
  signature TEXT,
  sender TEXT NOT NULL DEFAULT 'rpc',
  error TEXT,
  createdAtMs INTEGER NOT NULL DEFAULT 0,
  debitedAt INTEGER NOT NULL DEFAULT 0,
  sentAt INTEGER NOT NULL DEFAULT 0,
  failedAt INTEGER NOT NULL DEFAULT 0,
  UNIQUE(withdrawalId)
);

CREATE TABLE IF NOT EXISTS bank_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  msg TEXT NOT NULL,
  extraJson TEXT NOT NULL DEFAULT '{}',
  createdAtMs INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_activity_log_player_ts ON activity_log(playerId, ts);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_ts ON activity_log(action, ts);
CREATE INDEX IF NOT EXISTS idx_activity_log_reason_ts ON activity_log(reasonCode, ts);
CREATE INDEX IF NOT EXISTS idx_bank_deposit_events_player_confirmed ON bank_deposit_events(playerId, confirmedAt);
CREATE INDEX IF NOT EXISTS idx_bank_withdrawals_player_status ON bank_withdrawals(playerId, status);
CREATE INDEX IF NOT EXISTS idx_bank_withdrawals_status_created ON bank_withdrawals(status, createdAtMs);
CREATE INDEX IF NOT EXISTS idx_bank_errors_action_created ON bank_errors(action, createdAtMs);

-- Stage 26 clean surface notes:
-- player_building_kind should be constrained by application code to:
-- cottage, warehouse, lumber, quarry, farm, market, vault, alchemy, townhall, worldwonder.
-- Keeps are system-spawned. Foundations, bombs, gold sources, old crafting/equipment,
-- escrow offers, and old redeem flows are not part of the clean schema.
