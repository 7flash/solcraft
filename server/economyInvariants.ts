export function assertNonNegativeResources(row: Record<string, any>, fields = ["w", "s", "f", "g", "wood", "stone", "food", "gold", "coins"]) {
  for (const key of fields) {
    if (!(key in row)) continue;
    const n = Number(row[key] || 0);
    if (!Number.isFinite(n) || n < 0) {
      throw Object.assign(new Error(`Negative economy field: ${key}`), {
        reasonCode: "ECONOMY_INVARIANT_NEGATIVE_RESOURCE",
        key,
      });
    }
  }
}

export function assertNonNegativeInventory(inv: Record<string, any>) {
  assertNonNegativeResources(inv || {}, ["w", "s", "f", "g", "wood", "stone", "food", "gold", "coins"]);
}

export function assertBankDeltaBalanced(input: {
  before: bigint;
  after: bigint;
  debited?: bigint;
  credited?: bigint;
  fee?: bigint;
}) {
  const debited = input.debited || 0n;
  const credited = input.credited || 0n;
  const fee = input.fee || 0n;
  if (input.before - debited + credited - fee !== input.after) {
    throw Object.assign(new Error("Bank delta does not balance"), {
      reasonCode: "BANK_INVARIANT_UNBALANCED_DELTA",
    });
  }
}
