export type SpatialEntity = { x: number; z: number; group?: { visible?: boolean } | null };
function cellKey(x: number, z: number, cellSize: number) { return `${Math.floor(Number(x || 0) / cellSize)},${Math.floor(Number(z || 0) / cellSize)}`; }
export class SpatialGridCache<T extends SpatialEntity> {
  private grid = new Map<string, Set<T>>();
  private itemKey = new WeakMap<T, string>();
  constructor(private readonly cellSize = 16) {}
  clear() { this.grid.clear(); this.itemKey = new WeakMap(); }
  upsert(entity: T) {
    this.remove(entity);
    const k = cellKey(entity.x, entity.z, this.cellSize);
    let set = this.grid.get(k); if (!set) { set = new Set(); this.grid.set(k, set); }
    set.add(entity); this.itemKey.set(entity, k);
  }
  remove(entity: T) { const k = this.itemKey.get(entity); if (!k) return; this.grid.get(k)?.delete(entity); this.itemKey.delete(entity); }
  query(x: number, z: number, radius: number): Set<T> {
    const out = new Set<T>();
    const minX = Math.floor((x - radius) / this.cellSize), maxX = Math.floor((x + radius) / this.cellSize);
    const minZ = Math.floor((z - radius) / this.cellSize), maxZ = Math.floor((z + radius) / this.cellSize);
    for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) for (const e of this.grid.get(`${cx},${cz}`) || []) out.add(e);
    return out;
  }
}
