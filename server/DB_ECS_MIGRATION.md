# Database + ECS migration plan

Stage 7 keeps SQLite as the durable source of truth, but makes the path to ECS more deliberate: schema changes are centralized, API writes are validated before dispatch, and ECS now has smoke/parity harness tests that can be expanded before switching authority.

## Current DB stance

- SQLite remains authoritative for durable game state.
- Runtime ECS worlds are derived views of DB rows until parity tests prove each action can own writes.
- Existing tables are not renamed or split in-place during gameplay patches.
- New indexes are additive and use `CREATE INDEX IF NOT EXISTS`, so live DB files migrate safely on boot.
- Transient toasts/events are memory-only; persistent chat remains in SQLite.

## Stage 7 schema foundation

Schema additions are centralized in `server/dbSchema.ts` and marked through `solcraft:db:schemaVersion` metadata.

Current additive index families:

- `tiles(owner, x, z)` for owned-territory counts/maps and future chunk exports.
- `buildings(owner, x, z)`, `buildings(owner, kind)`, `buildings(owner, kind, x, z)` for ownership summaries and future ECS adapters.
- `buildings(kind, x, z)`, `buildings(kind, owner)`, `buildings(kind, cdUntil)` for Keep/bomb/tower localized systems and maintenance.
- `doodads(state, updatedAt)` for regrowth maintenance.
- `loot(kind, x, z)`, `loot(createdAt)` for resource/coin pickups and cleanup.
- `players(lastSeen)`, `players(name)`, `players(wallet, lastSeen)` for active-player/admin/account views.
- `chat(createdAt, id)` for chat ring/order queries.
- `offers(open, createdAt)` for market queries.
- `redemptions(status, createdAt)`, `redemptions(player, status)` for bank/withdrawal screens.
- `walletChallenges(wallet, used, createdAt)` for login challenge cleanup/auth checks.

## Migration order

1. Centralize writes behind helpers.
   - `insertBuilding`, `updateBuilding`, `deleteBuilding`
   - `insertTile`, `setTileOwner`
   - `insertLoot`, `deleteLoot`

2. Add exact-cell cache after writes are centralized.
   - `buildingByCell`
   - `buildingById`
   - no radius spatial cache yet

3. Expand ECS tests before switching writes.
   - `bun run test:ecs` runs current ECS smoke/harness tests.
   - Add one parity fixture per migrated action.
   - Compare resources, positions, tiles, buildings, loot, transient events, and reason codes.

4. Migrate one action at a time.
   - movement
   - talk/read-only interactions
   - claim
   - harvest
   - simple place variants
   - upgrade/demolish
   - combat/keeps/wonders last

5. Only after parity and production soak, move durable state to normalized ECS-style tables.

## What not to do yet

- Do not replace all range queries with an in-memory radius spatial hash before write paths are centralized.
- Do not point `/api/action` directly at `engine.ecs-seam.ts` globally.
- Do not remove legacy columns used for compatibility, especially construction fields encoded through `accAt`/`cdUntil`.
- Do not persist transient toast events unless they become gameplay-affecting state.
