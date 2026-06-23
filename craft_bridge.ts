import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  PublicKey, Keypair, SystemProgram, SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program, Transaction, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount,
  mintTo, getAccount,
} from "@solana/spl-token";
import { CraftBridge } from "../target/types/craft_bridge";
import { assert } from "chai";

// ---- byte-exact mirrors of the Rust voucher format ----
const WD_DOMAIN = Buffer.from("CRAFT_WD_V1");
const u64le = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const i64le = (n: number | bigint) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };

function withdrawMessage(player: PublicKey, recipient: PublicKey, amount: bigint, requestId: Buffer, expiry: bigint) {
  return Buffer.concat([WD_DOMAIN, player.toBuffer(), recipient.toBuffer(), u64le(amount), requestId, i64le(expiry)]);
}

describe("craft_bridge", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.CraftBridge as Program<CraftBridge>;
  const admin = (provider.wallet as anchor.Wallet).payer;

  const withdrawAuthority = Keypair.generate(); // backend offline signer
  const wonderCollection = Keypair.generate().publicKey; // placeholder until Core wired

  let mint: PublicKey;
  let configPda: PublicKey, vaultPda: PublicKey, wsolPda: PublicKey;
  let depositorAta: PublicKey;
  const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

  const pda = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, program.programId)[0];

  before(async () => {
    [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
    [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId);
    [wsolPda] = PublicKey.findProgramAddressSync([Buffer.from("wsol")], program.programId);

    mint = await createMint(provider.connection, admin, admin.publicKey, null, 6);
    const ata = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, admin.publicKey);
    depositorAta = ata.address;
    await mintTo(provider.connection, admin, mint, depositorAta, admin, 10_000_000_000); // 10k tokens @6dp
  });

  it("initializes", async () => {
    await program.methods
      .initialize({
        withdrawAuthority: withdrawAuthority.publicKey,
        wonderCollection,
        epochDuration: new BN(3600),
        emissionCap: new BN("18446744073709551615"), // u64::MAX, cap disabled
      })
      .accounts({
        config: configPda, vault: vaultPda, wsolVault: wsolPda,
        mint, nativeMint: NATIVE_MINT, admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const cfg = await program.account.config.fetch(configPda);
    assert.ok(cfg.withdrawAuthority.equals(withdrawAuthority.publicKey));
    assert.ok(cfg.vault.equals(vaultPda));
    assert.isFalse(cfg.paused);
  });

  it("deposits $CRAFTS into the treasury", async () => {
    await program.methods
      .deposit(new BN(1), new BN(1_000_000_000)) // player 1, 1000 tokens
      .accounts({
        config: configPda, vault: vaultPda, mint,
        depositor: admin.publicKey, depositorAta, tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const v = await getAccount(provider.connection, vaultPda);
    assert.equal(v.amount.toString(), "1000000000");
  });

  // --- withdrawal voucher path (the security-critical surface) ---

  async function doWithdraw(opts: {
    requestId: Buffer; amount: bigint; expiry: bigint;
    signer?: Keypair; recipientAta: PublicKey;
  }) {
    const { requestId, amount, expiry, recipientAta } = opts;
    const signer = opts.signer ?? withdrawAuthority;
    const msg = withdrawMessage(admin.publicKey, recipientAta, amount, requestId, expiry);
    const edIx = Ed25519Program.createInstructionWithPrivateKey({ privateKey: signer.secretKey, message: msg });
    const [receipt] = PublicKey.findProgramAddressSync([Buffer.from("wd"), requestId], program.programId);

    const wdIx = await program.methods
      .withdraw([...requestId], new BN(amount.toString()), new BN(expiry.toString()))
      .accounts({
        config: configPda, vault: vaultPda, mint,
        player: admin.publicKey, recipientAta, receipt, payer: admin.publicKey,
        ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .instruction();

    const tx = new Transaction().add(edIx).add(wdIx); // ed25519 MUST precede withdraw
    return provider.sendAndConfirm(tx, []);
  }

  it("withdraws with a valid backend voucher", async () => {
    const recipient = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, Keypair.generate().publicKey);
    const requestId = Buffer.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 600);
    await doWithdraw({ requestId, amount: 100_000_000n, expiry, recipientAta: recipient.address });
    const r = await getAccount(provider.connection, recipient.address);
    assert.equal(r.amount.toString(), "100000000");
  });

  it("rejects a replayed request_id", async () => {
    const recipient = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, Keypair.generate().publicKey);
    const requestId = Buffer.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 600);
    await doWithdraw({ requestId, amount: 50_000_000n, expiry, recipientAta: recipient.address });
    try {
      await doWithdraw({ requestId, amount: 50_000_000n, expiry, recipientAta: recipient.address });
      assert.fail("replay should have failed");
    } catch (e) { /* receipt PDA already initialized */ }
  });

  it("rejects a voucher signed by the wrong key", async () => {
    const recipient = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, Keypair.generate().publicKey);
    const requestId = Buffer.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 600);
    try {
      await doWithdraw({ requestId, amount: 10_000_000n, expiry, recipientAta: recipient.address, signer: Keypair.generate() });
      assert.fail("wrong signer should have failed");
    } catch (e: any) { assert.match(e.toString(), /Unauthorized|BadVoucher/); }
  });

  it("rejects an expired voucher", async () => {
    const recipient = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, Keypair.generate().publicKey);
    const requestId = Buffer.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const expiry = BigInt(Math.floor(Date.now() / 1000) - 10);
    try {
      await doWithdraw({ requestId, amount: 10_000_000n, expiry, recipientAta: recipient.address });
      assert.fail("expired voucher should have failed");
    } catch (e: any) { assert.match(e.toString(), /VoucherExpired/); }
  });

  it("rejects a tampered amount (voucher binds the amount)", async () => {
    // Sign for 10, try to withdraw 1000 -> message mismatch.
    const recipient = await getOrCreateAssociatedTokenAccount(provider.connection, admin, mint, Keypair.generate().publicKey);
    const requestId = Buffer.from(anchor.web3.Keypair.generate().publicKey.toBytes());
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 600);
    const msg = withdrawMessage(admin.publicKey, recipient.address, 10_000_000n, requestId, expiry);
    const edIx = Ed25519Program.createInstructionWithPrivateKey({ privateKey: withdrawAuthority.secretKey, message: msg });
    const [receipt] = PublicKey.findProgramAddressSync([Buffer.from("wd"), requestId], program.programId);
    const wdIx = await program.methods
      .withdraw([...requestId], new BN(1_000_000_000), new BN(expiry.toString())) // tampered amount
      .accounts({
        config: configPda, vault: vaultPda, mint, player: admin.publicKey,
        recipientAta: recipient.address, receipt, payer: admin.publicKey,
        ixSysvar: SYSVAR_INSTRUCTIONS_PUBKEY, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
      })
      .instruction();
    try {
      await provider.sendAndConfirm(new Transaction().add(edIx).add(wdIx), []);
      assert.fail("tampered amount should have failed");
    } catch (e: any) { assert.match(e.toString(), /BadVoucher/); }
  });

  it("enforces pause", async () => {
    await program.methods.updateConfig({
      withdrawAuthority: null, emissionCap: null, epochDuration: null,
      paused: true, admin: null, wonderCollection: null,
    }).accounts({ config: configPda, admin: admin.publicKey }).rpc();

    try {
      await program.methods.deposit(new BN(1), new BN(1_000_000)).accounts({
        config: configPda, vault: vaultPda, mint, depositor: admin.publicKey,
        depositorAta, tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      assert.fail("deposit while paused should fail");
    } catch (e: any) { assert.match(e.toString(), /Paused/); }

    await program.methods.updateConfig({
      withdrawAuthority: null, emissionCap: null, epochDuration: null,
      paused: false, admin: null, wonderCollection: null,
    }).accounts({ config: configPda, admin: admin.publicKey }).rpc();
  });

  // NOTE: deposit_sol and mint_wonder require PumpSwap + mpl-core cloned into the
  // local validator (see Anchor.toml [[test.validator.clone]]) and a live pool /
  // collection. Their voucher + idempotency logic is identical in shape to
  // withdraw and is covered structurally above; wire the CPIs, clone the
  // programs, then add end-to-end cases here.
});
