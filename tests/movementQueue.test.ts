import test from "node:test";
import assert from "node:assert/strict";

class InFlightGate {
  inFlight = 0;
  constructor(public max = 4) {}
  canIssueMove() { return this.inFlight < this.max; }
  send() { if (!this.canIssueMove()) return false; this.inFlight++; return true; }
  ack() { this.inFlight = Math.max(0, this.inFlight - 1); }
}

test("movement gate stops consuming moves at in-flight cap", () => {
  const gate = new InFlightGate(2);
  assert.equal(gate.send(), true);
  assert.equal(gate.send(), true);
  assert.equal(gate.send(), false);
  gate.ack();
  assert.equal(gate.send(), true);
});
