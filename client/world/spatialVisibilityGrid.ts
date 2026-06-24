export type SpatialEntity = {
  x: number;
  z: number;
  group?: { visible?: boolean } | null;
};

export type SpatialVisibilityOptions<T extends SpatialEntity> = {
  force?: boolean;
  predicate?: (entity: T) => boolean;
};

/**
 * Chunked visibility cache. It updates only chunks entering/leaving the current
 * horizon instead of scanning every active object on every movement/poll tick.
 */
export class SpatialVisibilityGrid<T extends SpatialEntity> {
  private grid = new Map<string, Set<T>>();
  private entityCell = new WeakMap<T, string>();
  private visibleCells = new Set<string>();

  constructor(private readonly cellSize = 8) {}

  private cellKey(x: number, z: number): string {
    const s = Math.max(1, this.cellSize);
    return `${Math.floor(Number(x || 0) / s)},${Math.floor(Number(z || 0) / s)}`;
  }

  private horizonKeys(x: number, z: number, radius: number): Set<string> {
    const s = Math.max(1, this.cellSize);
    const r = Math.max(0, Number(radius || 0));
    const minX = Math.floor((Number(x || 0) - r) / s);
    const maxX = Math.floor((Number(x || 0) + r) / s);
    const minZ = Math.floor((Number(z || 0) - r) / s);
    const maxZ = Math.floor((Number(z || 0) + r) / s);
    const out = new Set<string>();
    for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) out.add(`${cx},${cz}`);
    return out;
  }

  clear() {
    for (const set of this.grid.values()) for (const entity of set) if (entity.group) entity.group.visible = false;
    this.grid.clear();
    this.visibleCells.clear();
  }

  insert(entity: T) {
    if (!entity) return;
    this.remove(entity);
    const key = this.cellKey(entity.x, entity.z);
    let set = this.grid.get(key);
    if (!set) { set = new Set<T>(); this.grid.set(key, set); }
    set.add(entity);
    this.entityCell.set(entity, key);
    if (entity.group) entity.group.visible = this.visibleCells.has(key);
  }

  remove(entity: T) {
    if (!entity) return;
    const key = this.entityCell.get(entity) || this.cellKey(entity.x, entity.z);
    const set = this.grid.get(key);
    if (set) {
      set.delete(entity);
      if (!set.size) this.grid.delete(key);
    }
    this.entityCell.delete(entity);
  }

  update(entity: T) {
    const key = this.cellKey(entity.x, entity.z);
    if (this.entityCell.get(entity) === key) return;
    this.insert(entity);
  }

  refresh(x: number, z: number, radius: number, options: SpatialVisibilityOptions<T> = {}) {
    const next = this.horizonKeys(x, z, radius);
    const predicate = options.predicate || (() => true);

    if (options.force) {
      const all = new Set<string>([...this.visibleCells, ...next]);
      for (const key of all) this.setCellVisible(key, next.has(key), predicate);
      this.visibleCells = next;
      return;
    }

    for (const key of this.visibleCells) if (!next.has(key)) this.setCellVisible(key, false, predicate);
    for (const key of next) if (!this.visibleCells.has(key)) this.setCellVisible(key, true, predicate);
    this.visibleCells = next;
  }

  private setCellVisible(key: string, visible: boolean, predicate: (entity: T) => boolean) {
    const set = this.grid.get(key);
    if (!set) return;
    for (const entity of set) {
      if (!entity.group) continue;
      const want = visible && predicate(entity);
      if (entity.group.visible !== want) entity.group.visible = want;
    }
  }
}
