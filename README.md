# CRAFT Bridge

Custodial $CRAFTS bank + SOL on-ramp + World Wonder NFTs for SolCraft.

> **Status:** reviewed, not yet compiled. No SBF toolchain was available in the
> authoring sandbox, so `anchor build` / `anchor test` have not been run here.
> Two CPIs (PumpSwap buy, Metaplex Core mint) are bounded seams marked `TODO`
> and must be pinned to the live IDLs. Everything else is complete, including the
> ed25519 voucher path, which the tests exercise end to end.

## Why it's solvent without a cap or floating rate

$CRAFTS is a **fixed 1B supply** already live on PumpSwap. This program never
mints. Coins enter the game **only** via deposit; gameplay redistributes them and
never creates them:

- On deposit the off-chain server credits **80%** to the depositor and routes
  **20%** into the world as keep/npc/ground loot. Both halves are tokens already
  sitting in the treasury — the 20% is not a fee, it's deposited tokens
  re-entering circulation as collectible loot.
- Donations to npcs/keeps recirculate coins to other players.
- Wonders **burn** in-game coins (the treasury keeps the tokens).

Therefore, at all times:

```
Σ in-game coins  ≡  treasury token balance      (conserved)
Σ withdrawable    ≤  treasury balance            (always)
```

Withdrawal can never exceed the treasury. No emission cap or floating rate is
needed for solvency — wonders only make the treasury *over*-collateralized.

The optional `emission_cap` (epoch leaky-bucket) is a **separate** safeguard: it
bounds the blast radius of a leaked withdraw-signing key, not economic
insolvency. It defaults to `u64::MAX` (disabled). Set a real per-epoch value if
you want a circuit breaker on key compromise.

## What's on-chain vs off-chain

| On-chain (this program) | Off-chain (game server) |
|---|---|
| treasury vault (PDA-owned) | the 80/20 split, spawn reserve, all gameplay |
| deposit ($CRAFTS) + deposit_sol (PumpSwap) | crediting in-game balance from DepositEvent |
| withdraw (backend voucher, idempotent) | computing each player's withdrawable balance |
| wonder NFT mint (backend voucher, idempotent) | founding wonders (subtract in-game coins) |

The program is a constrained, auditable valve. It does not verify game logic —
the backend authorizes amounts and mints via ed25519 vouchers.

## Instructions

- `initialize` — Config singleton, treasury vault, WSOL working vault.
- `update_config` — admin: rotate withdraw key, retune cap/epoch, pause, hand off
  admin, set the wonder collection.
- `deposit(player_id, amount)` — pull $CRAFTS into the treasury; emit DepositEvent.
- `deposit_sol(player_id, lamports_in, min_crafts_out)` — wrap SOL → WSOL, swap to
  $CRAFTS via PumpSwap into the treasury, credit the realized delta. **Seam.**
- `withdraw(request_id, amount, expiry)` — player-submitted, authorized by a
  backend ed25519 voucher; idempotent via the `request_id` receipt PDA; optional
  epoch cap.
- `mint_wonder(params)` — player mints the NFT for a wonder they founded in-game;
  backend voucher; idempotent via the `wonder_id` receipt PDA; Metaplex Core
  asset, owner = player. **Seam.**

## The ed25519 voucher (highest-review item)

Withdraw and mint are authorized by a message the backend signs offline with
`config.withdraw_authority`. The player submits a transaction containing the
Ed25519 verify instruction **immediately before** the program instruction. The
program does not verify the signature itself — the native Ed25519 program already
did — it *binds* it: confirms the preceding instruction is an Ed25519 verify over
`(expected_authority, expected_message)`.

Message layouts (byte-exact, little-endian):

```
withdraw: "CRAFT_WD_V1"     || player(32) || recipient_ata(32) || amount(u64) || request_id(32) || expiry(i64)
wonder:   "CRAFT_WONDER_V1" || owner(32)  || wonder_id(u64)    || recipe_hash(32) || uri_hash(32) || expiry(i64)
```

`recipe_hash` binds the on-chain NFT to the off-chain AI mesh (full JSON on
Arweave at `uri`; `uri_hash = sha256(uri)`). The voucher must be a single
self-contained ed25519 instruction (offsets reference the current instruction),
which `Ed25519Program.createInstructionWith{PrivateKey,PublicKey}` produces.

Backend signing sketch:

```ts
const msg = Buffer.concat([
  Buffer.from("CRAFT_WD_V1"),
  player.toBuffer(), recipientAta.toBuffer(),
  u64le(amount), requestId /*32*/, i64le(expiry),
]);
const edIx = Ed25519Program.createInstructionWithPrivateKey({ privateKey: withdrawAuthority.secretKey, message: msg });
// player builds: new Transaction().add(edIx).add(withdrawIx) and signs+submits
```

## Wonder NFT ↔ in-game ownership

One Metaplex Core asset per wonder, in a "SolCraft World Wonders" collection
whose update authority is the Config PDA. **The asset owner is the canonical
wonder owner** — trade it on any marketplace; your indexer watches transfers and
reassigns `wonder.owner` off-chain. Royalty plugin on the collection = your
in-game trade fee. Create the collection once via the Core SDK (config PDA as
update authority) before calling `mint_wonder`.

## Off-chain integration

See `integration.ts`. Two indexers:
- **DepositEvent** → credit 80% to `player_id`, add 20% to the spawn reserve.
  Dedup on signature (idempotent re-index).
- **Core asset transfers** → sync `wonder.owner`.

Pass integer raw token amounts end to end. Do not floor-on-credit / ceil-on-debit
(dust leak). The vault is the single source of truth for raw balances.

## Build / test / deploy

```bash
anchor build
anchor test          # spins a local validator; clones PumpSwap + Core (Anchor.toml)
anchor deploy --provider.cluster devnet
```

`anchor test` runs the suite in `tests/craft_bridge.ts`: initialize, deposit,
withdraw (valid voucher, replay, wrong signer, expired, tampered amount), pause.
`deposit_sol` and `mint_wonder` need the cloned programs + a live pool/collection
and are noted as `TODO` in the suite.

## Security checklist

- Treasury owned by the Config PDA — no keypair holds funds.
- `admin` (rotate/pause/upgrade) separate from `withdraw_authority` (hot signer);
  rotate the hot key on compromise without touching treasury or upgrade authority.
- Idempotency via receipt PDAs (`init` fails on duplicate) for both withdraw and
  wonder mint.
- Voucher binds the exact amount/recipient/expiry; tampering any field breaks the
  message match.
- `overflow-checks = true` in release; all arithmetic is checked.
- `deposit_sol` enforces slippage via realized vault-delta (robust to PumpSwap's
  return shape) in addition to any on-CPI minimum.
- Pausable.

## Open items before mainnet

1. Wire the **PumpSwap buy** CPI (pin accounts/discriminator to the live IDL).
2. Wire the **Metaplex Core CreateV2** CPI + create the Wonders collection.
3. Audit `verify_preceding_voucher` carefully — it is the trust boundary.
4. Decide a real `emission_cap` value (or keep it disabled).
