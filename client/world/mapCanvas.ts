export type WorldMapView = {
  minX: number;
  minZ: number;
  scale: number;
  ox: number;
  oz: number;
  spanX: number;
  spanZ: number;
  margin: number;
  w: number;
  h: number;
};

export type WorldMapDrawData = {
  tiles?: any[];
  buildings?: any[];
  loot?: any[];
  players?: any[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type WorldMapDrawOptions = {
  me?: any;
  expanded?: boolean;
  nowMs?: number;
  districtRoads?: any[];
  wonderDistrictRadius?: (building: any) => number;
  wonderDistrictColorHex?: (building: any) => string;
};

export function hexFromColorNumber(value: any, fallback = "#f29c72") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const hex = Math.max(0, Math.min(0xffffff, Math.trunc(n))).toString(16).padStart(6, "0");
  return `#${hex}`;
}

export function worldMapCanvasView(data: WorldMapDrawData, width: number, height: number, expanded = false): WorldMapView {
  const minX = Number(data?.minX || 0);
  const maxX = Number(data?.maxX || minX);
  const minZ = Number(data?.minZ || 0);
  const maxZ = Number(data?.maxZ || minZ);
  const spanX = Math.max(1, maxX - minX + 1);
  const spanZ = Math.max(1, maxZ - minZ + 1);
  const margin = expanded ? 30 : 7;
  const scale = Math.max(1, Math.min((width - margin * 2) / spanX, (height - margin * 2) / spanZ));
  const ox = (width - spanX * scale) / 2;
  const oz = (height - spanZ * scale) / 2;
  return { minX, minZ, scale, ox, oz, spanX, spanZ, margin, w: width, h: height };
}

export function tileFromCanvasPoint(view: WorldMapView, canvasWidth: number, canvasHeight: number, rect: any, clientX: number, clientY: number) {
  if (!view || !rect) return null;
  const sx = canvasWidth / Math.max(1, Number(rect.width || 0));
  const sy = canvasHeight / Math.max(1, Number(rect.height || 0));
  const x = Math.round(view.minX + ((clientX - Number(rect.left || 0)) * sx - view.ox) / view.scale);
  const z = Math.round(view.minZ + ((clientY - Number(rect.top || 0)) * sy - view.oz) / view.scale);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}

export function tileFromCanvasEvent(view: WorldMapView, canvas: any, ev: any) {
  if (!view || !canvas || !ev) return null;
  const rect = typeof canvas.getBoundingClientRect === "function" ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: canvas.width, height: canvas.height };
  return tileFromCanvasPoint(view, Number(canvas.width || 0), Number(canvas.height || 0), rect, Number(ev.clientX), Number(ev.clientY));
}

function drawLegend(ctx: any, width: number, height: number) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(5,8,14,.62)";
  ctx.fillRect(7, height - 25, Math.min(156, width - 14), 18);
  ctx.font = "800 9px Outfit, sans-serif";
  ctx.textBaseline = "middle";
  const y = height - 16;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(16, y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#9945ff"; ctx.fillRect(47, y - 3, 6, 6);
  ctx.fillStyle = "#d3aa63"; ctx.fillRect(91, y - 2, 10, 4);
  ctx.fillStyle = "#2f952f"; ctx.beginPath(); ctx.arc(132, y, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(243,234,215,.82)";
  ctx.fillText("you", 22, y);
  ctx.fillText("wonder", 58, y);
  ctx.fillText("road", 104, y);
  ctx.fillText("res", 138, y);
  ctx.restore();
}

function mapLootColor(kind: any) {
  const k = String(kind || "").toLowerCase();
  if (k === "gold" || k === "coins" || k === "coin") return "#ffd76e";
  if (k === "tree" || k === "wood") return "#2f952f";
  if (k === "rock" || k === "stone") return "#aeb8bd";
  if (k === "food" || k === "crop") return "#ceb443";
  return "#7dcfe8";
}

function buildingMapStyle(b: any, meId: any) {
  const k = String(b?.kind || "").toLowerCase();
  if (k === "worldwonder") return { color: "#9945ff", size: 1.15, shape: "rect" };
  if (k === "keep") return { color: "#ff705c", size: 1.00, shape: "rect" };
  if (k === "bomb") return { color: "#ffb36c", size: 0.82, shape: "rect" };
  if (k === "tradepost" || k === "trade") return { color: "#d3aa63", size: 0.82, shape: "diamond" };
  return { color: b?.owner === meId ? "#f6ead6" : "#37404b", size: 0.75, shape: "rect" };
}

export function renderKnownWorldMap(canvas: any, data: WorldMapDrawData, options: WorldMapDrawOptions = {}) {
  if (!canvas || !data) return null;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;
  const width = Number(canvas.width || 0);
  const height = Number(canvas.height || 0);
  if (width <= 0 || height <= 0) return null;

  const expanded = !!options.expanded;
  const view = worldMapCanvasView(data, width, height, expanded);
  const { minX, minZ, scale, ox, oz, spanX, spanZ } = view;
  const tiles = Array.isArray(data.tiles) ? data.tiles : [];
  const buildings = Array.isArray(data.buildings) ? data.buildings : [];
  const loot = Array.isArray(data.loot) ? data.loot : [];
  const players = Array.isArray(data.players) ? data.players : [];
  const meId = options.me?.id;
  const nowMs = Number(options.nowMs || Date.now());
  const wonderDistrictRadius = options.wonderDistrictRadius || (() => 0);
  const wonderDistrictColorHex = options.wonderDistrictColorHex || (() => "#14f195");
  const districtRoads = Array.isArray(options.districtRoads) ? options.districtRoads : [];
  const cell = Math.max(expanded ? 2 : 1, scale * 0.92);
  const px = (x: any) => ox + (Number(x) - minX) * scale;
  const pz = (z: any) => oz + (Number(z) - minZ) * scale;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#111821";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = expanded ? 0.18 : 0.10;
  ctx.strokeStyle = "#14f195";
  ctx.lineWidth = 1;
  const gridStep = expanded ? Math.max(1, Math.ceil(8 / Math.max(1, scale))) : Math.max(2, Math.ceil(18 / Math.max(1, scale)));
  for (let x = Math.ceil(minX / gridStep) * gridStep; x <= minX + spanX - 1; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(px(x), oz); ctx.lineTo(px(x), oz + spanZ * scale); ctx.stroke();
  }
  for (let z = Math.ceil(minZ / gridStep) * gridStep; z <= minZ + spanZ - 1; z += gridStep) {
    ctx.beginPath(); ctx.moveTo(ox, pz(z)); ctx.lineTo(ox + spanX * scale, pz(z)); ctx.stroke();
  }
  ctx.restore();

  for (const t of tiles) {
    ctx.fillStyle = hexFromColorNumber(t?.ownerBody, "#6f8057");
    ctx.globalAlpha = t?.owner === meId ? 0.92 : 0.42;
    ctx.fillRect(px(t?.x), pz(t?.z), cell, cell);
  }
  ctx.globalAlpha = 1;

  for (const w of buildings.filter((b: any) => b && b.kind === "worldwonder")) {
    const r = Math.max(0, Number(wonderDistrictRadius(w) || 0));
    const sx = px(Number(w.x) - r);
    const sz = pz(Number(w.z) - r);
    const sw = Math.max(2, (r * 2 + 1) * scale);
    const sh = Math.max(2, (r * 2 + 1) * scale);
    ctx.save();
    ctx.globalAlpha = expanded ? 0.18 : 0.11;
    ctx.strokeStyle = wonderDistrictColorHex(w);
    ctx.lineWidth = expanded ? 2 : 1;
    ctx.strokeRect(sx, sz, sw, sh);
    ctx.restore();
  }

  if (districtRoads.length) {
    ctx.save();
    ctx.globalAlpha = expanded ? 0.64 : 0.48;
    for (const r of districtRoads) {
      ctx.fillStyle = r?.color || "#d3aa63";
      const rr = Math.max(expanded ? 2 : 1.1, scale * 0.48);
      ctx.fillRect(px(r?.x) + scale * 0.26, pz(r?.z) + scale * 0.26, rr, rr);
    }
    ctx.restore();
  }

  for (const b of buildings) {
    const st = buildingMapStyle(b, meId);
    ctx.fillStyle = st.color;
    const s = Math.max(st.shape === "diamond" ? 2.5 : 2, scale * st.size);
    const x = px(b?.x) + scale * 0.5;
    const z = pz(b?.z) + scale * 0.5;
    if (st.shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(x, z - s * 0.62); ctx.lineTo(x + s * 0.62, z); ctx.lineTo(x, z + s * 0.62); ctx.lineTo(x - s * 0.62, z);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(px(b?.x) + scale * 0.12, pz(b?.z) + scale * 0.12, s, s);
    }
  }

  for (const l of loot) {
    ctx.fillStyle = mapLootColor(l?.kind);
    const r = Math.max(String(l?.kind || "") === "gold" ? 1.6 : 1.25, scale * (String(l?.kind || "") === "gold" ? 0.28 : 0.22));
    ctx.beginPath();
    ctx.arc(px(l.x) + scale * 0.5, pz(l.z) + scale * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const q of players) {
    const isMe = q?.id === meId;
    const seenAt = Number(q?.lastSeen || q?.ts || 0);
    const active = isMe || !seenAt || nowMs - seenAt <= 120000;
    const x = px(q?.x) + scale * 0.5;
    const z = pz(q?.z) + scale * 0.5;
    const ghost = !!q?.spectator;
    ctx.globalAlpha = ghost ? 0.58 : active ? 1 : 0.35;
    ctx.fillStyle = q?.npc ? "#ceb443" : isMe ? "#ffffff" : ghost ? "#9fdcff" : hexFromColorNumber(q?.body, "#f29c72");
    ctx.beginPath();
    const pr = isMe ? Math.max(4, scale * 0.55) : Math.max(2.4, scale * 0.42);
    if (q?.npc) { ctx.moveTo(x, z - pr); ctx.lineTo(x + pr * 0.9, z + pr * 0.72); ctx.lineTo(x - pr * 0.9, z + pr * 0.72); ctx.closePath(); }
    else ctx.arc(x, z, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isMe ? "#14f195" : ghost ? "rgba(189,238,255,.9)" : "rgba(255,255,255,.75)";
    ctx.lineWidth = isMe ? 2 : 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (!expanded) drawLegend(ctx, width, height);
  return view;
}