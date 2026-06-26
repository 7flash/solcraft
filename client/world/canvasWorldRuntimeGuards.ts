// @ts-nocheck
/**
 * Runtime safety layer for the Canvas 2D world migration.
 *
 * The renderer swap removed Three.js objects from the live world. During the
 * migration, page.client.tsx still exercises many old interaction paths.  This
 * guard makes renderer failures visible without taking down the whole tradjs
 * mount: pick failures become terrain picks, minimap failures become empty
 * snapshots, and one-off visual helpers become no-ops.
 */

export type CanvasGuardReporter = (event: { method: string; error: any; count: number }) => void;

const FALLBACKS: Record<string, any> = {
  pickFromEvent: (_ev: any) => ({ primary: "terrain", cell: { x: 0, z: 0 }, raw: { x: 0, z: 0 } }),
  cellFromEvent: (_ev: any) => ({ x: 0, z: 0 }),
  buildingFromEvent: () => null,
  doodadFromEvent: () => null,
  tradePostFromEvent: () => null,
  npcFromEvent: () => null,
  playerFromEvent: () => null,
  minimapSnapshot: () => ({ tiles: [], buildings: [], loot: [], players: [] }),
  visibleCells: () => [],
  movementState: () => ({ inFlight: 0, pending: 0, canIssueMove: false }),
  capitalBearing: () => ({ dx: 0, dz: 0, dist: 0, label: "here" }),
  canIssueMove: () => false,
  tryMoveDelta: () => false,
  pathTo: () => false,
  pathToNear: () => false,
  worldToScreen: () => ({ x: 0, y: 0 }),
  screenToWorldPoint: () => ({ wx: 0, wz: 0 }),
  buildPoolAt: () => null,
  doodadVisible: () => false,
  doodadAtCell: () => null,
  resolveDoodadCell: (_x: number, _z: number) => null,
  tileOwner: new Map(),
  buildPool: new Map(),
  lootPool: new Map(),
  cells: new Map(),
};

function methodFallback(name: string) {
  return Object.prototype.hasOwnProperty.call(FALLBACKS, name) ? FALLBACKS[name] : (() => undefined);
}

export function formatCanvasGuardError(method: string, error: any) {
  const msg = String(error?.message || error || "unknown canvas world error");
  return `[canvas world] ${method} failed: ${msg}`;
}

export function createCanvasGuardOverlay(host: HTMLElement | null) {
  let el: HTMLDivElement | null = null;
  function enabled() {
    try {
      return /(?:\?|&)canvasDebug=1(?:&|$)/.test(location.search) || localStorage.getItem("solcraft.debug.canvas") === "1";
    } catch { return false; }
  }
  function ensure() {
    if (!enabled() || !host) return null;
    if (!el) {
      el = document.createElement("div");
      el.className = "sc-canvas-guard-debug";
      el.style.cssText = "position:absolute;left:10px;bottom:10px;z-index:45;pointer-events:none;background:rgba(42,14,20,.86);color:#ffe3c2;border:1px solid rgba(255,210,130,.25);border-radius:10px;padding:7px 9px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:360px;white-space:pre-wrap";
      host.appendChild(el);
    }
    return el;
  }
  return {
    report(method: string, error: any, count: number) {
      const node = ensure();
      if (!node) return;
      node.textContent = `${formatCanvasGuardError(method, error)}\ncount: ${count}`;
    },
    remove() { try { el?.remove(); } catch {} el = null; },
  };
}

export function guardCanvasWorld<T extends Record<string, any>>(world: T, host?: HTMLElement | null, reporter?: CanvasGuardReporter): T {
  const counts = new Map<string, number>();
  const overlay = createCanvasGuardOverlay(host || null);
  const report = (method: string, error: any) => {
    const n = (counts.get(method) || 0) + 1;
    counts.set(method, n);
    try { overlay.report(method, error, n); } catch {}
    try { reporter?.({ method, error, count: n }); } catch {}
    if (n <= 3) {
      try { console.warn(formatCanvasGuardError(method, error), error); } catch {}
    }
  };

  return new Proxy(world || {}, {
    get(target, prop, receiver) {
      if (prop === "__canvasGuardCounts") return counts;
      if (prop === "dispose") {
        const raw = Reflect.get(target, prop, receiver);
        return (...args: any[]) => {
          try { overlay.remove(); } catch {}
          try { return typeof raw === "function" ? raw.apply(target, args) : undefined; }
          catch (e) { report("dispose", e); return undefined; }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value ?? FALLBACKS[String(prop)];
      return (...args: any[]) => {
        try { return value.apply(target, args); }
        catch (e) {
          const name = String(prop);
          report(name, e);
          const fb = methodFallback(name);
          return typeof fb === "function" ? fb(...args) : fb;
        }
      };
    },
  }) as T;
}

export function canvasGuardErrorCount(world: any, method?: string) {
  const counts: Map<string, number> | undefined = world?.__canvasGuardCounts;
  if (!counts) return 0;
  if (method) return counts.get(method) || 0;
  let total = 0; for (const n of counts.values()) total += n;
  return total;
}
