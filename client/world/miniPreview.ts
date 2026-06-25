// @ts-nocheck
import { buildingRecipeFor, recipeVisibleParts } from "./buildingRecipes";
import { resourceRecipeFor } from "./resourceRecipes";
import { miniPreviewKey, miniPreviewLabel, normalizePreviewAccent } from "./miniPreviewModel";

export type MiniPreviewKind = "building" | "tree" | "rock" | "food" | "trade" | "npc" | "tile" | "foundation";

type PreviewState = { el: HTMLElement; key: string; img: HTMLImageElement };
type PreviewImage = { key: string; url: string; usedAt: number };

const byEl = new WeakMap<HTMLElement, PreviewState>();
const active = new Set<PreviewState>();
const imageCache = new Map<string, PreviewImage>();
const MAX_PREVIEW_IMAGES = 96;

export { miniPreviewKey, miniPreviewLabel, normalizePreviewAccent } from "./miniPreviewModel";

function touchImage(key: string, url: string) {
  imageCache.set(key, { key, url, usedAt: performance.now() });
  if (imageCache.size <= MAX_PREVIEW_IMAGES) return url;
  const victims = [...imageCache.values()].sort((a, b) => a.usedAt - b.usedAt).slice(0, imageCache.size - MAX_PREVIEW_IMAGES);
  for (const v of victims) imageCache.delete(v.key);
  return url;
}
function cachedImage(key: string) { const hit = imageCache.get(key); if (!hit) return ""; hit.usedAt = performance.now(); return hit.url; }
function cssHex(value: any, fallback = "#14f195") { const s=String(value||"").trim(); return /^#[0-9a-f]{6}$/i.test(s)?s:fallback; }
function hexToRgb(hex: string) { const h=cssHex(hex,"#000000").slice(1); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function shade(hex: string, a: number) { const c=hexToRgb(hex), t=a>=0?255:0, f=Math.abs(a); return `#${c.map(v=>Math.max(0,Math.min(255,Math.round(v+(t-v)*f))).toString(16).padStart(2,"0")).join("")}`; }
function numColor(value: any, fallback = "#14f195") { const s=normalizePreviewAccent(value); if (/^#[0-9a-f]{6}$/i.test(s)) return s; return fallback; }
function proj(cx:number, cy:number, cz:number, ox:number, oy:number) { return { x: ox + (cx-cz)*42, y: oy + (cx+cz)*21 - cy*44 }; }
function poly(ctx:any, pts:any[], fill:string, stroke="") { ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y); ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=0.8;ctx.stroke();} }
function drawPrism(ctx:any, x:number,z:number,y:number,w:number,d:number,h:number,top:string,left?:string,right?:string,ox=120,oy=112) {
  const topHex=cssHex(top,"#c59a45"), lHex=cssHex(left||shade(topHex,-0.24)), rHex=cssHex(right||shade(topHex,-0.36));
  const at=proj(x,y+h,z,ox,oy), bt=proj(x+w,y+h,z,ox,oy), ct=proj(x+w,y+h,z+d,ox,oy), dt=proj(x,y+h,z+d,ox,oy);
  const b0=proj(x+w,y,z,ox,oy), c0=proj(x+w,y,z+d,ox,oy), d0=proj(x,y,z+d,ox,oy);
  poly(ctx,[d0,c0,ct,dt],lHex,"rgba(0,0,0,.18)"); poly(ctx,[c0,b0,bt,ct],rHex,"rgba(0,0,0,.2)"); poly(ctx,[at,bt,ct,dt],topHex,"rgba(0,0,0,.15)");
}
function drawBuildingRecipe(ctx:any, kind:string, accent:string) {
  const recipe=recipeVisibleParts(buildingRecipeFor(kind,{color:accent,plinth:"#8f7b53"}),1);
  const scale=kind==="keep"||kind==="watchtower"?2.0:1.65;
  for(const part of recipe){ const w=part.w*scale,d=part.d*scale; drawPrism(ctx, part.x*scale-w/2, part.z*scale-d/2, part.y*scale, w,d,part.h*scale, part.top, part.left, part.right); }
}
function drawResourceRecipe(ctx:any, kind:string) {
  const scale=1.7;
  for(const part of resourceRecipeFor(kind,0)){ const w=part.w*scale,d=part.d*scale; drawPrism(ctx, part.ox*scale-w/2, part.oz*scale-d/2, part.y*scale, w,d,part.h*scale, part.top, part.left, part.right); }
}
function drawNpc(ctx:any) { ctx.fillStyle="#f1caa2"; ctx.beginPath(); ctx.arc(120,72,15,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#14f195"; ctx.beginPath(); ctx.roundRect(106,84,28,38,8); ctx.fill(); ctx.fillStyle="#7dcfe8"; ctx.beginPath(); ctx.arc(120,68,16,Math.PI,Math.PI*2); ctx.fill(); }
function renderPreviewImage(key: string, kind: string, buildingKind: string, accent: string) {
  const hit=cachedImage(key); if(hit)return hit;
  const cv=document.createElement("canvas"); cv.width=240; cv.height=180; const ctx=cv.getContext("2d")!;
  const bg=ctx.createLinearGradient(0,0,0,180); bg.addColorStop(0,"#10222a"); bg.addColorStop(1,"#071017"); ctx.fillStyle=bg; ctx.fillRect(0,0,240,180);
  ctx.fillStyle="rgba(255,255,255,.035)"; ctx.beginPath(); ctx.roundRect(14,14,212,152,18); ctx.fill();
  if(kind==="building") drawBuildingRecipe(ctx, buildingKind||"cottage", accent);
  else if(kind==="tree"||kind==="rock"||kind==="food") drawResourceRecipe(ctx, kind);
  else if(kind==="npc") drawNpc(ctx);
  else drawBuildingRecipe(ctx, kind==="foundation"?"foundation":"cottage", accent);
  return touchImage(key, cv.toDataURL("image/png"));
}
function createPreview(el: HTMLElement): PreviewState | null {
  const kind=String(el.dataset.previewKind||"tile"); const buildingKind=String(el.dataset.buildingKind||""); const rawAccent=normalizePreviewAccent(el.dataset.previewAccent||""); const accent=numColor(rawAccent);
  const key=miniPreviewKey(kind,buildingKind,rawAccent); const url=renderPreviewImage(key,kind,buildingKind,accent);
  if(!url){ el.classList.add("mini3d-preview-failed"); return null; }
  el.classList.remove("mini3d-preview-failed"); const img=document.createElement("img"); img.src=url; img.alt=miniPreviewLabel(kind,buildingKind); img.loading="lazy"; img.decoding="async"; img.style.width="100%"; img.style.height="100%"; img.style.objectFit="contain"; img.draggable=false; el.replaceChildren(img); el.setAttribute("aria-label",miniPreviewLabel(kind,buildingKind)); const state={el,key,img}; byEl.set(el,state); active.add(state); return state;
}
export function disposeMiniPreview(state: PreviewState | null | undefined) { if(!state)return; try{state.img.remove();}catch{} active.delete(state); }
export function disposeMiniPreviews() { Array.from(active).forEach(disposeMiniPreview); active.clear(); }
export function syncMiniPreviewPanels(root: ParentNode = document) { for(const state of Array.from(active)){ const nextKey=miniPreviewKey(state.el.dataset.previewKind,state.el.dataset.buildingKind,state.el.dataset.previewAccent); if(!state.el.isConnected||nextKey!==state.key)disposeMiniPreview(state); } const nodes=Array.from(root.querySelectorAll?.("[data-mini3d-preview]")||[]) as HTMLElement[]; for(const el of nodes){ if(!el.isConnected)continue; const state=byEl.get(el); if(!state||!active.has(state))createPreview(el); } }
