import test from "node:test";
import assert from "node:assert/strict";

function withdrawable(deposited: bigint, withdrawn: bigint) {
  const remaining = deposited - withdrawn;
  return remaining > 0n ? remaining : 0n;
}

test("principal-bounded withdrawable never exceeds scanned deposits", () => {
  const cases: Array<[bigint, bigint]> = [[0n,0n],[10n,0n],[10n,3n],[10n,10n],[10n,20n]];
  for (const [deposited, withdrawn] of cases) {
    const w = withdrawable(deposited, withdrawn);
    assert.ok(w >= 0n);
    assert.ok(w <= deposited);
  }
});

test("failed/refunded withdrawals must not consume principal", () => {
  const rows = [
    { amountRaw: "4", status: "sent" },
    { amountRaw: "2", status: "failed" },
    { amountRaw: "1", status: "refunded" },
    { amountRaw: "3", status: "pending" },
  ];
  const nonFailed = rows.filter((r) => !["failed","refunded","refund","cancelled","canceled","rejected","void"].includes(String(r.status).toLowerCase()));
  const spent = nonFailed.reduce((s, r) => s + BigInt(r.amountRaw), 0n);
  assert.equal(spent, 7n);
  assert.equal(withdrawable(10n, spent), 3n);
});
