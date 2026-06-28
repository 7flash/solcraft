// @ts-nocheck
/**
 * Runtime safety layer for the Canvas 2D world migration.
 *
 * Product decision: Canvas remains the owner of world rendering, picking, and
 * depth ordering. We deliberately do not add a parallel WebGL world renderer
 * because duplicate depth/picking systems are a common source of split-brain
 * bugs. A future WebGL layer is acceptable only for narrow, non-authoritative
 * overlays such as bloom, screen-space particles, or water shimmer.
 *
 * This guard prevents one renderer failure from unmounting the whole game, but
 * it must not hide graphics regressions. The first few failures are logged, and
 * draw/tick/applyWorld failures show a small badge even without canvasDebug=1.
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
  let sticky = false;
  function enabled(force = false) {
    if (force || sticky) return true;
    try {
      return /(?:\?|&)canvasDebug=1(?:&|$)/.test(location.search) || localStorage.getItem("solcraft.debug.canvas") === "1";
    } catch { return false; }
  }
  function ensure(force = false) {
    if (!enabled(force) || !host) return null;
    sticky = sticky || force;
    if (!el) {
      el = document.createElement("div");
      el.className = "sc-canvas-guard-debug";
      el.style.cssText = "position:absolute;left:10px;bottom:10px;z-index:45;pointer-events:none;background:rgba(42,14,20,.88);color:#ffe3c2;border:1px solid rgba(255,210,130,.35);border-radius:10px;padding:7px 9px;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;max-width:420px;white-space:pre-wrap";
      host.appendChild(el);
    }
    return el;
  }
  return {
    report(method: string, error: any, count: number) {
      const visualFailure = /^(tick|draw|applyWorld|applyMe|applyPlayers|refreshWindow|refreshCameraZoom|refreshEnvironment)$/i.test(String(method));
      const node = ensure(visualFailure);
      if (!node) return;
      node.textContent = `${formatCanvasGuardError(method, error)}\ncount: ${count}\nSet ?canvasDebug=1 or localStorage solcraft.debug.canvas=1 for persistent canvas diagnostics.`;
    },
    remove() { try { el?.remove(); } catch {} el = null; sticky = false; },
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
      try { console.error(formatCanvasGuardError(method, error), error); } catch {}
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
