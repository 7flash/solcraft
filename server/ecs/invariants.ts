export function assertPlayerPositionInteger(pos: { x: number; z: number }) {
  if (!Number.isInteger(pos.x) || !Number.isInteger(pos.z)) {
    throw Object.assign(new Error("Player position must be integer grid coordinates"), {
      reasonCode: "MOVEMENT_INVARIANT_NON_INTEGER_POSITION",
      details: pos,
    });
  }
}

export function assertNoNegativeEnergy(energy: { value: number }) {
  if (!Number.isFinite(energy.value) || energy.value < 0) {
    throw Object.assign(new Error("Energy cannot be negative"), {
      reasonCode: "ENERGY_INVARIANT_NEGATIVE",
      details: energy,
    });
  }
}

export function assertMoveStepAllowed(from: { x: number; z: number }, to: { x: number; z: number }, maxChebStep = 1) {
  const d = Math.max(Math.abs(to.x - from.x), Math.abs(to.z - from.z));
  if (d > maxChebStep) {
    throw Object.assign(new Error("Move exceeds allowed step"), {
      reasonCode: "MOVEMENT_INVARIANT_STEP_TOO_FAR",
      details: { from, to, maxChebStep },
    });
  }
}
