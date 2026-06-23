//! CRAFT Bridge — custodial $CRAFTS bank + SOL on-ramp + World Wonder NFTs.
//!
//! ECONOMIC MODEL (why this is solvent with no cap/float backstop):
//!   $CRAFTS is a FIXED 1B supply already live on PumpSwap. This program never
//!   mints. Coins enter the game ONLY via deposit; gameplay redistributes them,
//!   never creates them. On deposit the off-chain server credits 80% to the
//!   depositor and routes 20% into the world as keep/npc/ground loot — both
//!   halves are tokens already sitting in the treasury. Wonders BURN in-game
//!   coins (the treasury keeps the tokens), so:
//!
//!       Σ in-game coins  ≡  treasury token balance      (conserved)
//!       Σ withdrawable    ≤  treasury balance            (always)
//!
//!   => withdrawal can never exceed treasury. No emission cap or floating rate
//!      is needed for solvency. The optional epoch cap below exists only to
//!      bound the blast radius of a LEAKED WITHDRAW KEY (a different threat),
//!      and defaults to effectively off (u64::MAX).
//!
//! TRUST MODEL: custodial. The backend authorizes withdrawal amounts and wonder
//! mints via ed25519 vouchers. The program is a constrained, idempotent,
//! auditable valve; it does not verify game logic.
//!
//! TWO CPI SEAMS (pin to live IDLs before mainnet — could not compile here):
//!   - deposit_sol: PumpSwap `buy` CPI (WSOL -> $CRAFTS into treasury).
//!   - mint_wonder: Metaplex Core `CreateV2` CPI.
//! Both are bounded and marked TODO. Everything else is complete.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use anchor_spl::token::{self, Mint, SyncNative, Token, TokenAccount, TransferChecked};

declare_id!("CRAFTbridge11111111111111111111111111111111");

// Pin these to the live programs when wiring the CPIs.
pub const PUMPSWAP_PROGRAM_ID: Pubkey = pubkey!("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
pub const MPL_CORE_PROGRAM_ID: Pubkey = pubkey!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

pub const CONFIG_SEED: &[u8] = b"config";
pub const VAULT_SEED: &[u8] = b"vault";
pub const WSOL_SEED: &[u8] = b"wsol";
pub const WD_RECEIPT_SEED: &[u8] = b"wd";
pub const WONDER_RECEIPT_SEED: &[u8] = b"wonder";

// Domain tags keep vouchers from being replayed across message types.
pub const WD_DOMAIN: &[u8] = b"CRAFT_WD_V1";
pub const WONDER_DOMAIN: &[u8] = b"CRAFT_WONDER_V1";

#[program]
pub mod craft_bridge {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: InitParams) -> Result<()> {
        require!(params.epoch_duration > 0, BridgeError::BadParams);
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.withdraw_authority = params.withdraw_authority;
        cfg.mint = ctx.accounts.mint.key();
        cfg.vault = ctx.accounts.vault.key();
        cfg.wsol_vault = ctx.accounts.wsol_vault.key();
        cfg.wonder_collection = params.wonder_collection;
        cfg.paused = false;
        cfg.epoch_duration = params.epoch_duration;
        cfg.emission_cap = params.emission_cap; // u64::MAX disables
        cfg.epoch_start = Clock::get()?.unix_timestamp;
        cfg.emitted_in_epoch = 0;
        cfg.total_deposited = 0;
        cfg.total_withdrawn = 0;
        cfg.bump = ctx.bumps.config;
        cfg.vault_bump = ctx.bumps.vault;
        cfg.wsol_bump = ctx.bumps.wsol_vault;
        emit!(InitializedEvent { admin: cfg.admin, mint: cfg.mint, vault: cfg.vault });
        Ok(())
    }

    /// Admin: rotate hot withdraw key, retune cap/epoch, pause, hand off admin,
    /// set the wonder collection. `None` = unchanged.
    pub fn update_config(ctx: Context<AdminOnly>, p: UpdateParams) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        if let Some(a) = p.withdraw_authority { cfg.withdraw_authority = a; }
        if let Some(c) = p.emission_cap { cfg.emission_cap = c; }
        if let Some(d) = p.epoch_duration { require!(d > 0, BridgeError::BadParams); cfg.epoch_duration = d; }
        if let Some(b) = p.paused { cfg.paused = b; }
        if let Some(a) = p.admin { cfg.admin = a; }
        if let Some(col) = p.wonder_collection { cfg.wonder_collection = col; }
        emit!(ConfigUpdatedEvent {
            withdraw_authority: cfg.withdraw_authority,
            emission_cap: cfg.emission_cap,
            epoch_duration: cfg.epoch_duration,
            paused: cfg.paused,
            admin: cfg.admin,
        });
        Ok(())
    }

    /// Deposit $CRAFTS directly. Off-chain credits 80% to player, 20% to the
    /// world-spawn reserve. The program only conserves and records.
    pub fn deposit(ctx: Context<Deposit>, player_id: u64, amount: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, BridgeError::Paused);
        require!(amount > 0, BridgeError::ZeroAmount);
        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.depositor_ata.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        let cfg = &mut ctx.accounts.config;
        cfg.total_deposited = cfg.total_deposited.checked_add(amount).ok_or(BridgeError::Overflow)?;
        emit!(DepositEvent {
            player_id, source: DepositSource::Token,
            depositor: ctx.accounts.depositor.key(),
            amount, ts: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Deposit SOL, converted to $CRAFTS in-program via PumpSwap. The realized
    /// $CRAFTS amount (measured by vault balance delta — robust to PumpSwap's
    /// exact return shape) is what the off-chain server credits 80/20.
    pub fn deposit_sol(ctx: Context<DepositSol>, player_id: u64, lamports_in: u64, min_crafts_out: u64) -> Result<()> {
        require!(!ctx.accounts.config.paused, BridgeError::Paused);
        require!(lamports_in > 0, BridgeError::ZeroAmount);

        // 1. Wrap: move SOL into the program-owned WSOL account, then sync.
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.depositor.to_account_info(),
                    to: ctx.accounts.wsol_vault.to_account_info(),
                },
            ),
            lamports_in,
        )?;
        token::sync_native(CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SyncNative { account: ctx.accounts.wsol_vault.to_account_info() },
        ))?;

        // 2. Measure CRAFTS before the swap.
        ctx.accounts.vault.reload()?;
        let before = ctx.accounts.vault.amount;

        // 3. CPI PumpSwap `buy`: spend WSOL from wsol_vault (config PDA signs),
        //    receive $CRAFTS into vault.
        //
        // TODO(pin-to-pumpswap-idl): construct and invoke_signed the PumpSwap
        // buy instruction. Accounts (pool, global_config, base/quote mints,
        // pool token accounts, fee recipients, event authority, ...) are
        // version-specific — read them from the live PumpSwap IDL and pass via
        // ctx.remaining_accounts or explicit fields. The config PDA is the WSOL
        // authority and signs with seeds [CONFIG_SEED, bump]. Slippage is
        // enforced below by the realized-delta check, but also pass an on-CPI
        // max_quote/min_base for protection inside the swap itself.
        //
        //   let signer: &[&[&[u8]]] = &[&[CONFIG_SEED, &[ctx.accounts.config.bump]]];
        //   invoke_signed(&pumpswap_buy_ix, &account_infos, signer)?;

        // 4. Realized amount + slippage gate.
        ctx.accounts.vault.reload()?;
        let realized = ctx.accounts.vault.amount.checked_sub(before).ok_or(BridgeError::Overflow)?;
        require!(realized >= min_crafts_out, BridgeError::SlippageExceeded);

        let cfg = &mut ctx.accounts.config;
        cfg.total_deposited = cfg.total_deposited.checked_add(realized).ok_or(BridgeError::Overflow)?;
        emit!(DepositEvent {
            player_id, source: DepositSource::Sol,
            depositor: ctx.accounts.depositor.key(),
            amount: realized, ts: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Player-submitted withdrawal authorized by a backend ed25519 voucher.
    /// The voucher message = WD_DOMAIN || player || recipient || amount ||
    /// request_id || expiry, signed by config.withdraw_authority. The ed25519
    /// verify instruction MUST be the instruction immediately preceding this one.
    /// Idempotent via the request_id receipt PDA.
    pub fn withdraw(ctx: Context<Withdraw>, request_id: [u8; 32], amount: u64, expiry: i64) -> Result<()> {
        require!(!ctx.accounts.config.paused, BridgeError::Paused);
        require!(amount > 0, BridgeError::ZeroAmount);

        let now = Clock::get()?.unix_timestamp;
        require!(now <= expiry, BridgeError::VoucherExpired);

        // Bind the preceding ed25519 instruction to the exact authorized values.
        let msg = build_withdraw_message(
            &ctx.accounts.player.key(),
            &ctx.accounts.recipient_ata.key(),
            amount, &request_id, expiry,
        );
        verify_preceding_voucher(&ctx.accounts.ix_sysvar, &ctx.accounts.config.withdraw_authority, &msg)?;

        // Optional epoch cap (key-compromise backstop; u64::MAX = off).
        let bump = ctx.accounts.config.bump;
        {
            let cfg = &mut ctx.accounts.config;
            let window_end = cfg.epoch_start.checked_add(cfg.epoch_duration).ok_or(BridgeError::Overflow)?;
            if now >= window_end { cfg.epoch_start = now; cfg.emitted_in_epoch = 0; }
            let next = cfg.emitted_in_epoch.checked_add(amount).ok_or(BridgeError::Overflow)?;
            require!(next <= cfg.emission_cap, BridgeError::EpochCapExceeded);
            cfg.emitted_in_epoch = next;
            cfg.total_withdrawn = cfg.total_withdrawn.checked_add(amount).ok_or(BridgeError::Overflow)?;
        }

        let r = &mut ctx.accounts.receipt; // init => replay protection
        r.request_id = request_id;
        r.recipient = ctx.accounts.recipient_ata.key();
        r.amount = amount;
        r.ts = now;

        let signer: &[&[&[u8]]] = &[&[CONFIG_SEED, &[bump]]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.config.to_account_info(),
                },
                signer,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        emit!(WithdrawEvent { request_id, recipient: ctx.accounts.recipient_ata.key(), amount, ts: now });
        Ok(())
    }

    /// Player mints the NFT for a Wonder they already founded in-game (founding
    /// itself is off-chain: it just subtracts in-game coins). Authorized by a
    /// backend ed25519 voucher = WONDER_DOMAIN || owner || wonder_id ||
    /// recipe_hash || uri_hash || expiry. Idempotent via the wonder_id receipt.
    pub fn mint_wonder(ctx: Context<MintWonder>, params: MintWonderParams) -> Result<()> {
        require!(!ctx.accounts.config.paused, BridgeError::Paused);
        let now = Clock::get()?.unix_timestamp;
        require!(now <= params.expiry, BridgeError::VoucherExpired);

        let uri_hash = anchor_lang::solana_program::hash::hash(params.uri.as_bytes()).to_bytes();
        let msg = build_wonder_message(
            &ctx.accounts.owner.key(), params.wonder_id, &params.recipe_hash, &uri_hash, params.expiry,
        );
        verify_preceding_voucher(&ctx.accounts.ix_sysvar, &ctx.accounts.config.withdraw_authority, &msg)?;

        // Mint a Metaplex Core asset into the Wonders collection, owner = player.
        //
        // TODO(pin-to-mpl-core): CreateV2 CPI. The config PDA is the collection
        // update authority and signs with [CONFIG_SEED, bump]. Store traits via
        // the Attributes plugin (recipe_hash, wonder_id). Full mesh JSON lives at
        // params.uri (Arweave); uri_hash above binds it to the voucher.
        //
        //   CreateV2CpiBuilder::new(&ctx.accounts.mpl_core)
        //       .asset(&ctx.accounts.asset)
        //       .collection(Some(&ctx.accounts.collection))
        //       .authority(Some(&ctx.accounts.config.to_account_info()))
        //       .payer(&ctx.accounts.owner)
        //       .owner(Some(&ctx.accounts.owner))
        //       .system_program(&ctx.accounts.system_program)
        //       .name(params.name.clone())
        //       .uri(params.uri.clone())
        //       .plugins(/* Attributes: recipe_hash, wonder_id */)
        //       .invoke_signed(&[&[CONFIG_SEED, &[ctx.accounts.config.bump]]])?;

        let r = &mut ctx.accounts.receipt; // init => one mint per wonder_id
        r.wonder_id = params.wonder_id;
        r.asset = ctx.accounts.asset.key();
        r.owner = ctx.accounts.owner.key();
        r.recipe_hash = params.recipe_hash;
        r.ts = now;

        emit!(WonderMintedEvent {
            wonder_id: params.wonder_id,
            asset: ctx.accounts.asset.key(),
            owner: ctx.accounts.owner.key(),
            ts: now,
        });
        Ok(())
    }
}

// =====================================================================
// ed25519 voucher verification
// =====================================================================
//
// We do NOT verify the signature ourselves — the native Ed25519 program already
// did, in the preceding instruction. We bind it: confirm that instruction is an
// Ed25519 verify over (expected_authority, expected_message). The voucher must be
// a single self-contained ed25519 ix (offsets reference the current ix), which
// is what Ed25519Program.createInstructionWith{PrivateKey,PublicKey} produces.

fn verify_preceding_voucher(ix_sysvar: &AccountInfo, expected_signer: &Pubkey, expected_msg: &[u8]) -> Result<()> {
    let current = load_current_index_checked(ix_sysvar)?;
    require!(current >= 1, BridgeError::MissingVoucher);
    let ix = load_instruction_at_checked((current - 1) as usize, ix_sysvar)?;
    require!(ix.program_id == ed25519_program::ID, BridgeError::MissingVoucher);

    let d = &ix.data;
    require!(d.len() >= 16, BridgeError::BadVoucher);
    require!(d[0] == 1, BridgeError::BadVoucher); // exactly one signature

    let rd = |o: usize| -> usize { u16::from_le_bytes([d[o], d[o + 1]]) as usize };
    let pk_off = rd(6);
    let pk_ix = rd(8);
    let msg_off = rd(10);
    let msg_size = rd(12);
    let msg_ix = rd(14);
    let sig_ix = rd(4);
    // All data must live in THIS instruction (current ix marker = u16::MAX).
    require!(sig_ix == 0xFFFF && pk_ix == 0xFFFF && msg_ix == 0xFFFF, BridgeError::BadVoucher);
    require!(pk_off + 32 <= d.len(), BridgeError::BadVoucher);
    require!(msg_off + msg_size <= d.len(), BridgeError::BadVoucher);

    let signer = Pubkey::new_from_array(d[pk_off..pk_off + 32].try_into().unwrap());
    require!(&signer == expected_signer, BridgeError::Unauthorized);
    require!(&d[msg_off..msg_off + msg_size] == expected_msg, BridgeError::BadVoucher);
    Ok(())
}

fn build_withdraw_message(player: &Pubkey, recipient: &Pubkey, amount: u64, request_id: &[u8; 32], expiry: i64) -> Vec<u8> {
    let mut m = Vec::with_capacity(WD_DOMAIN.len() + 32 + 32 + 8 + 32 + 8);
    m.extend_from_slice(WD_DOMAIN);
    m.extend_from_slice(player.as_ref());
    m.extend_from_slice(recipient.as_ref());
    m.extend_from_slice(&amount.to_le_bytes());
    m.extend_from_slice(request_id);
    m.extend_from_slice(&expiry.to_le_bytes());
    m
}

fn build_wonder_message(owner: &Pubkey, wonder_id: u64, recipe_hash: &[u8; 32], uri_hash: &[u8; 32], expiry: i64) -> Vec<u8> {
    let mut m = Vec::with_capacity(WONDER_DOMAIN.len() + 32 + 8 + 32 + 32 + 8);
    m.extend_from_slice(WONDER_DOMAIN);
    m.extend_from_slice(owner.as_ref());
    m.extend_from_slice(&wonder_id.to_le_bytes());
    m.extend_from_slice(recipe_hash);
    m.extend_from_slice(uri_hash);
    m.extend_from_slice(&expiry.to_le_bytes());
    m
}

// =====================================================================
// Accounts
// =====================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, seeds = [VAULT_SEED], bump, token::mint = mint, token::authority = config)]
    pub vault: Account<'info, TokenAccount>,
    /// WSOL working account for the SOL on-ramp; authority = config PDA.
    #[account(init, payer = admin, seeds = [WSOL_SEED], bump, token::mint = native_mint, token::authority = config)]
    pub wsol_vault: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    /// CHECK: must be the native SOL mint So11111111111111111111111111111111111111112
    #[account(address = anchor_spl::token::spl_token::native_mint::ID)]
    pub native_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ BridgeError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = vault, has_one = mint)]
    pub config: Account<'info, Config>,
    #[account(mut, address = config.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = config.mint)]
    pub mint: Account<'info, Mint>,
    pub depositor: Signer<'info>,
    #[account(mut, token::mint = config.mint, token::authority = depositor)]
    pub depositor_ata: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = vault, has_one = wsol_vault, has_one = mint)]
    pub config: Account<'info, Config>,
    #[account(mut, address = config.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, address = config.wsol_vault)]
    pub wsol_vault: Account<'info, TokenAccount>,
    #[account(address = config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    /// CHECK: PumpSwap program, validated at CPI construction.
    #[account(address = PUMPSWAP_PROGRAM_ID)]
    pub pumpswap_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // Remaining accounts: the PumpSwap pool/fee/event accounts (pin to IDL).
}

#[derive(Accounts)]
#[instruction(request_id: [u8; 32])]
pub struct Withdraw<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = vault, has_one = mint)]
    pub config: Account<'info, Config>,
    #[account(mut, address = config.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = config.mint)]
    pub mint: Account<'info, Mint>,
    /// The player submitting the withdrawal (pays gas). Bound into the voucher.
    pub player: Signer<'info>,
    #[account(mut, token::mint = config.mint)]
    pub recipient_ata: Account<'info, TokenAccount>,
    #[account(init, payer = payer, space = 8 + WithdrawalReceipt::INIT_SPACE,
              seeds = [WD_RECEIPT_SEED, request_id.as_ref()], bump)]
    pub receipt: Account<'info, WithdrawalReceipt>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Instructions sysvar, read for ed25519 voucher introspection.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub ix_sysvar: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(params: MintWonderParams)]
pub struct MintWonder<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = 8 + WonderReceipt::INIT_SPACE,
              seeds = [WONDER_RECEIPT_SEED, params.wonder_id.to_le_bytes().as_ref()], bump)]
    pub receipt: Account<'info, WonderReceipt>,
    /// CHECK: new Core asset (signer); validated by mpl-core CPI.
    #[account(mut)]
    pub asset: Signer<'info>,
    /// CHECK: Wonders collection; must match config.wonder_collection.
    #[account(mut, address = config.wonder_collection)]
    pub collection: UncheckedAccount<'info>,
    /// CHECK: mpl-core program, validated at CPI construction.
    #[account(address = MPL_CORE_PROGRAM_ID)]
    pub mpl_core: UncheckedAccount<'info>,
    /// CHECK: Instructions sysvar for ed25519 voucher introspection.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub ix_sysvar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

// =====================================================================
// State
// =====================================================================

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub withdraw_authority: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub wsol_vault: Pubkey,
    pub wonder_collection: Pubkey,
    pub paused: bool,
    pub epoch_duration: i64,
    pub emission_cap: u64,
    pub epoch_start: i64,
    pub emitted_in_epoch: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub bump: u8,
    pub vault_bump: u8,
    pub wsol_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct WithdrawalReceipt {
    pub request_id: [u8; 32],
    pub recipient: Pubkey,
    pub amount: u64,
    pub ts: i64,
}

#[account]
#[derive(InitSpace)]
pub struct WonderReceipt {
    pub wonder_id: u64,
    pub asset: Pubkey,
    pub owner: Pubkey,
    pub recipe_hash: [u8; 32],
    pub ts: i64,
}

// =====================================================================
// Params / enums
// =====================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitParams {
    pub withdraw_authority: Pubkey,
    pub wonder_collection: Pubkey,
    pub epoch_duration: i64,
    pub emission_cap: u64, // u64::MAX to disable
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UpdateParams {
    pub withdraw_authority: Option<Pubkey>,
    pub emission_cap: Option<u64>,
    pub epoch_duration: Option<i64>,
    pub paused: Option<bool>,
    pub admin: Option<Pubkey>,
    pub wonder_collection: Option<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MintWonderParams {
    pub wonder_id: u64,
    pub recipe_hash: [u8; 32],
    #[max_len(64)]
    pub name: String,
    #[max_len(200)]
    pub uri: String,
    pub expiry: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DepositSource { Token, Sol }

// =====================================================================
// Events
// =====================================================================

#[event]
pub struct InitializedEvent { pub admin: Pubkey, pub mint: Pubkey, pub vault: Pubkey }
#[event]
pub struct ConfigUpdatedEvent { pub withdraw_authority: Pubkey, pub emission_cap: u64, pub epoch_duration: i64, pub paused: bool, pub admin: Pubkey }
#[event]
pub struct DepositEvent { pub player_id: u64, pub source: DepositSource, pub depositor: Pubkey, pub amount: u64, pub ts: i64 }
#[event]
pub struct WithdrawEvent { pub request_id: [u8; 32], pub recipient: Pubkey, pub amount: u64, pub ts: i64 }
#[event]
pub struct WonderMintedEvent { pub wonder_id: u64, pub asset: Pubkey, pub owner: Pubkey, pub ts: i64 }

// =====================================================================
// Errors
// =====================================================================

#[error_code]
pub enum BridgeError {
    #[msg("Bridge is paused")] Paused,
    #[msg("Amount must be greater than zero")] ZeroAmount,
    #[msg("Arithmetic overflow")] Overflow,
    #[msg("Epoch emission cap exceeded")] EpochCapExceeded,
    #[msg("Unauthorized")] Unauthorized,
    #[msg("Invalid parameters")] BadParams,
    #[msg("Swap output below minimum")] SlippageExceeded,
    #[msg("Missing ed25519 voucher instruction")] MissingVoucher,
    #[msg("Malformed or mismatched voucher")] BadVoucher,
    #[msg("Voucher expired")] VoucherExpired,
}
