export function coordKey(x: number, z: number): string { return `${x | 0},${z | 0}`; }
export function buildingKey(b: any): number { return Number(b?.uid || b?.id || 0); }
export function playerKey(p: any): number { return Number(p?.id || 0); }
