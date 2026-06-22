import type { Coord, ResourceBag, ResKey } from "./types.ts";

export function key(x: number, z: number): string { return `${x},${z}`; }
export function cheb(a: Coord, b: Coord): number { return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)); }
export function manhattan(a: Coord, b: Coord): number { return Math.abs(a.x - b.x) + Math.abs(a.z - b.z); }
export function cloneBag(bag: ResourceBag = {}): ResourceBag { return { ...bag }; }

export function addBag(target: ResourceBag, delta: ResourceBag, caps: Partial<Record<ResKey, number>> & { total?: number; shared?: number } = {}): ResourceBag {
  const sharedKeys = new Set<ResKey>(["w", "p", "s", "f"]);
  const sharedCap = Number((caps as any).total ?? (caps as any).shared ?? 0) || 0;
  const sharedUsed = () => [...sharedKeys].reduce((sum, k) => sum + Math.max(0, Number(target[k] || 0)), 0);
  for (const [k, raw] of Object.entries(delta) as [ResKey, number][]) {
    let n = Number(raw || 0);
    if (!Number.isFinite(n) || n === 0) continue;
    if (n > 0 && sharedCap > 0 && sharedKeys.has(k)) n = Math.min(n, Math.max(0, sharedCap - sharedUsed()));
    const cap = caps[k];
    const next = Math.max(0, Number(target[k] || 0) + n);
    target[k] = Number.isFinite(Number(cap)) ? Math.min(Number(cap), next) : next;
  }
  return target;
}

export function canAfford(have: ResourceBag, cost: ResourceBag): true | string[] {
  const missing: string[] = [];
  for (const [k, raw] of Object.entries(cost) as [ResKey, number][]) {
    const need = Number(raw || 0);
    if (need <= 0) continue;
    const got = Number(have[k] || 0);
    if (got + 1e-9 < need) missing.push(`${k}:${Math.ceil(need - got)}`);
  }
  return missing.length ? missing : true;
}

export function spendBag(have: ResourceBag, cost: ResourceBag): true | string[] {
  const affordable = canAfford(have, cost);
  if (affordable !== true) return affordable;
  for (const [k, raw] of Object.entries(cost) as [ResKey, number][]) {
    const need = Number(raw || 0);
    if (need > 0) have[k] = Math.max(0, Number(have[k] || 0) - need);
  }
  return true;
}