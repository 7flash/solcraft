import { dbIntegrityReport } from "./dbIntegrity";

function expect(value: any) {
  return {
    toBeTruthy() { if (!value) throw new Error(`Expected truthy value, got ${value}`); },
    toBeType(type: string) { if (typeof value !== type) throw new Error(`Expected ${type}, got ${typeof value}`); },
  };
}

function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { console.error(`✗ ${name}`); throw e; }
}

test("db integrity report has stable shape", () => {
  const report = dbIntegrityReport({ sampleLimit: 3 });
  expect(report).toBeTruthy();
  expect(report.generatedAt).toBeType("number");
  expect(report.counts.players).toBeType("number");
  expect(report.summary.issueCount).toBeType("number");
  expect(Array.isArray(report.issues)).toBeTruthy();
});
