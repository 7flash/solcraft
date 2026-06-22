# Stage 14 — ECS Clean Slate Product Rules

This release intentionally drops legacy parity. The new game has one social/economy axis: **Reputation**.

## Core loop

Walk → claim → gather → build → upgrade → help/attack NPCs → donate/raid Keeps → build Wonders → expand territory.

## Reputation

There are no factions. Reputation controls tile capacity and social trust.

Positive reputation comes from:
- donating supplies to NPCs;
- donating coins to Keeps;
- building World Wonders in the wild.

Negative reputation comes from:
- killing NPCs;
- raiding/destroying Keeps;
- attacking/destroying player tiles/buildings;
- future grief/war actions.

If owned tiles exceed capacity because reputation drops, the player is overextended. The first production behavior should be: building regeneration/auto-repair stops while overextended. Later, random owned buildings/tiles may deteriorate.

## Storage

Warehouses increase storage caps. If storage cap falls below held resources because a warehouse is destroyed, resources rot down to cap during world tick.

## Resources

Trees, rocks, and crops do not regenerate in the wild. Camps/quarries/farms spawn harvestable resources around the building, but do not directly credit inventory. Players still need to cut/gather/crop manually.

## Removed from client/release

- bombs and destroy tools;
- Gold Sources/Ruins/Gold Mine collection;
- legacy siege source system;
- old crafting/recipes/packs/equipment UI;
- escrow player market;
- old redeem actions;
- direct guide rewards/achievements progression;
- public admin commands;
- foundations.

## Kept but simplified

- attack/raid replaces bombs/siege;
- PvP remains possible but weak/expensive until stats/equipment return;
- banking stays, opened through capital/bank building preview;
- character customization stays, but should be a building action and cost coins later;
- equipment/skills/recipes migrate to ECS data but are not in the client until redesigned.

## Stage 15 mechanics update

Passive building production is removed. Camps, quarries, and farms are not income machines; they are local sources of harvestable work.

- Lumber Camps periodically spawn trees nearby.
- Quarries periodically spawn rocks nearby.
- Farms periodically spawn crops nearby, represented on the client as food/crop doodads.
- Wild trees and rocks stay exhausted after harvesting; camps are the renewable source.
- Warehouses define storage caps. When capacity falls below inventory, excess wood/stone/food/planks rot down toward the cap during world ticks.
- Reputation over-cap state does not immediately delete land. Instead, normal building regeneration stops, making overextended bases easier to attack.
- Capital/bank buildings are allowed to regenerate quickly so attacking them remains possible but rarely practical.
- All values are loaded from DB/meta JSON via `cleanEconomy.ts` and `reputationRules.ts` so admins can tune after economy simulation.

## Stage 16–24 consolidation update

This release now treats observability as part of the backend contract.

- Every public route should create a request context with `rid`, `uid`, route, action, and backend mode.
- `measure-fn` results must be short filtered objects, not raw snapshots or action results.
- Console logs are for operators. Activity logs are for the admin dashboard and are always scoped by user id when available.
- Sensitive fields (`secret`, `signature`, `challenge`, authorization headers, image blobs) must never be written to activity logs.
- `/api/admin/activity` exposes the in-memory activity ring for filtering by `playerId`, wallet, action, route, and kind.

Clean-economy maintenance no longer uses legacy territory coin rain by default. Coins should enter through NPC and Keep rewards; the old territory coin compatibility path is opt-in with `SOLCRAFT_ENABLE_TERRITORY_COINS=1` and uses bounded sampling instead of full tile scans.

Bank runtime data is moving away from meta JSON blobs into row tables: deposits, scans, deposit events, withdrawals, and errors. Meta JSON remains a fallback for old deployments, but table mode is the production path.

## Stage 26 clean gameplay surface

This release no longer treats legacy parity as a goal. The player-facing loop is:

1. select Hammer;
2. click an empty owned tile;
3. choose one of the clean building types from the right-side panel;
4. construction starts directly, with no foundation conversion step.

Player-buildable structures are intentionally limited to houses, warehouses, lumber camps, quarries, farms, markets, bank/vault, customizer, town hall, and World Wonders. Keeps are spawned by world rules. Bombs, foundations, old coin sources, old crafting, equipment/packs, player escrow, old redeem actions, guide rewards, and public admin actions are blocked at the backend surface.

Direct player-vs-player is allowed but intentionally weak for now: a `fight` action only removes 1 HP from each nearby player and applies a small reputation penalty to the attacker. Serious conflict remains focused on Keeps, buildings, NPCs, and reputation pressure.
