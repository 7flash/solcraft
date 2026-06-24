export type IsoPoint = { x: number; y: number };
export type IsoProjectOptions = { originX: number; originY: number; tileWidth?: number; tileHeight?: number; heightScale?: number };
export type PrismDraw = { x: number; z: number; y?: number; width: number; depth: number; height: number; top: string; left: string; right: string };
function project(wx: number, wy: number, wz: number, opts: IsoProjectOptions): IsoPoint {
  const tw = opts.tileWidth ?? 16, th = opts.tileHeight ?? 8, vh = opts.heightScale ?? 16;
  return { x: opts.originX + (wx - wz) * tw, y: opts.originY + (wx + wz) * th - wy * vh };
}
function quad(ctx: CanvasRenderingContext2D, fill: string, a: IsoPoint, b: IsoPoint, c: IsoPoint, d: IsoPoint) { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); }
export function prismDepthKey(p: PrismDraw): number { return Number(p.x || 0) + Number(p.z || 0) + Number(p.y || 0) + Number(p.height || 0) * 0.01; }
export function sortPrismsBackToFront<T extends PrismDraw>(parts: readonly T[]): T[] { return [...parts].sort((a, b) => prismDepthKey(a) - prismDepthKey(b)); }
export function drawPrism(ctx: CanvasRenderingContext2D, prism: PrismDraw, opts: IsoProjectOptions) {
  const x0 = Number(prism.x || 0), y0 = Number(prism.y || 0), z0 = Number(prism.z || 0);
  const x1 = x0 + Number(prism.width || 0), y1 = y0 + Number(prism.height || 0), z1 = z0 + Number(prism.depth || 0);
  const at = project(x0, y1, z0, opts), bt = project(x1, y1, z0, opts), ct = project(x1, y1, z1, opts), dt = project(x0, y1, z1, opts);
  const b0 = project(x1, y0, z0, opts), c0 = project(x1, y0, z1, opts), d0 = project(x0, y0, z1, opts);
  quad(ctx, prism.left, d0, c0, ct, dt); quad(ctx, prism.right, c0, b0, bt, ct); quad(ctx, prism.top, at, bt, ct, dt);
}
