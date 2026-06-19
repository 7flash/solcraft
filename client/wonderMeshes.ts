// @ts-nocheck
import * as THREE from "three";

const TEX: Record<string, THREE.Texture> = {};

function mat(color: string | number, emissive?: string | number, metalness = 0.05, roughness = 0.82, extra: any = {}) {
  return new THREE.MeshStandardMaterial({
    color: typeof color === "number" ? color : new THREE.Color(color || "#fff0a8"),
    emissive: new THREE.Color(emissive || "#000000"),
    metalness,
    roughness,
    ...extra,
  });
}
function basic(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 0.9, side: THREE.DoubleSide });
}
function geo(kind: string) {
  if (kind === "cylinder") return new THREE.CylinderGeometry(0.5, 0.5, 1, 18);
  if (kind === "cone") return new THREE.ConeGeometry(0.5, 1, 18);
  if (kind === "sphere") return new THREE.SphereGeometry(0.5, 18, 12);
  if (kind === "torus") return new THREE.TorusGeometry(0.38, 0.11, 8, 24);
  if (kind === "octahedron") return new THREE.OctahedronGeometry(0.5, 0);
  return new THREE.BoxGeometry(1, 1, 1);
}
function auraColor(aura: string) {
  if (aura === "mint") return 0x14f195;
  if (aura === "violet") return 0x9945ff;
  if (aura === "blue") return 0x7dcfe8;
  return 0xffd76e;
}

function footprintSize(recipe: any) {
  const n = Math.trunc(Number(recipe?.footprint || 9));
  return [3, 5, 7, 9].includes(n) ? n : 9;
}
function footprintRadius(recipe: any) { return Math.max(1, Math.floor((footprintSize(recipe) - 1) / 2)); }

function hexToNum(hex: string, fallback = 0xfff0a8) {
  const s = String(hex || "").trim();
  return /^#[0-9a-f]{6}$/i.test(s) ? new THREE.Color(s).getHex() : fallback;
}
function addBox(g: THREE.Object3D, w: number, h: number, d: number, material: any, x: number, y: number, z: number, ry = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.rotation.y = ry;
  mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function addCyl(g: THREE.Object3D, rt: number, rb: number, h: number, material: any, x: number, y: number, z: number, seg = 18) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function addCone(g: THREE.Object3D, r: number, h: number, material: any, x: number, y: number, z: number, seg = 4, ry = Math.PI / 4) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), material);
  mesh.position.set(x, y, z); mesh.rotation.y = ry;
  mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function addSphere(g: THREE.Object3D, r: number, material: any, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function addTorus(g: THREE.Object3D, r: number, tube: number, material: any, x: number, y: number, z: number, rx = Math.PI / 2, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28), material);
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); return mesh;
}
function paletteFor(recipe: any) {
  const raw = Array.isArray(recipe?.palette) ? recipe.palette.filter((x: any) => /^#[0-9a-f]{6}$/i.test(String(x))) : [];
  const base = raw.length ? raw : ["#fff0a8", "#ffd76e", "#c79337", "#14f195", "#7dcfe8", "#9945ff"];
  while (base.length < 4) base.push(["#14f195", "#7dcfe8", "#9945ff", "#ffd76e"][base.length % 4]);
  return base.slice(0, 8);
}
function hashText(s: any) {
  const str = String(s || "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mixColor(hex: string | number, amt = 0.08) {
  const c = new THREE.Color(hex as any);
  const h = c.getHSL({ h: 0, s: 0, l: 0 });
  h.l = Math.max(0.08, Math.min(0.92, h.l + amt));
  c.setHSL(h.h, Math.max(0, Math.min(1, h.s * 0.94)), h.l);
  return `#${c.getHexString()}`;
}
function surfaceKindForPart(recipe: any, part: any, i: number) {
  const text = `${recipe?.name || ""} ${recipe?.prompt || ""}`.toLowerCase();
  const primitive = String(part?.primitive || "box");
  const sx = Math.abs(Number(part?.scale?.[0] || 1));
  const sy = Math.abs(Number(part?.scale?.[1] || 1));
  const sz = Math.abs(Number(part?.scale?.[2] || 1));
  const y = Number(part?.pos?.[1] || 0);
  if (primitive !== "box") return "solid";
  if (sy < 0.18 && (sx > 0.8 || sz > 0.8)) return "stone";
  if (/skyscraper|tower|glass|observatory|solar|crystal/.test(text) && sy > 0.45) return "windowGrid";
  if (/school|academy|campus|market|temple|hall|library/.test(text) && sy > 0.35 && i % 5 !== 0) return "brick";
  if (/roof|house|school|market|temple/.test(text) && y > 0.8 && (sx > 0.7 || sz > 0.7) && sy < 0.45) return "roof";
  if (sy > 0.7 && (i + hashText(text)) % 4 === 0) return "windowGrid";
  return (i + hashText(text)) % 3 === 0 ? "brick" : "stone";
}
function proceduralPartMaterial(recipe: any, part: any, i: number, color: string | number, built = true) {
  if (!built) return mat(color, part?.emissive, 0.02, 0.95, { transparent: true, opacity: 0.16, depthWrite: false, wireframe: true });
  const kind = surfaceKindForPart(recipe, part, i);
  if (kind === "solid") return mat(color, part?.emissive, part?.metalness, part?.roughness);
  const seed = hashText(`${recipe?.prompt || recipe?.name || "wonder"}:${i}:${kind}`);
  const accent = mixColor(color, ((seed % 17) - 8) / 100);
  const repeat: [number, number] = kind === "windowGrid" ? [1.0 + (seed % 3) * 0.25, 1.8 + (seed % 5) * 0.45] : kind === "roof" ? [1.2, 1.0] : [1.0 + (seed % 4) * 0.15, 1.0 + ((seed >> 3) % 4) * 0.15];
  return textureMat(kind, color, accent, part?.emissive, repeat, Number(part?.metalness ?? 0.05), Number(part?.roughness ?? 0.82));
}

function textureKey(kind: string, a: any, b: any = "", c: any = "") { return `${kind}:${a}:${b}:${c}`; }
function makeTexture(kind: string, base: string | number, accent?: string | number, extra?: string | number) {
  const key = textureKey(kind, base, accent, extra);
  if (TEX[key]) return TEX[key];
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const baseCol = new THREE.Color(base as any).getStyle();
  const accCol = new THREE.Color((accent || "#ffffff") as any).getStyle();
  const extCol = new THREE.Color((extra || "#111111") as any).getStyle();
  ctx.fillStyle = baseCol; ctx.fillRect(0, 0, 128, 128);
  if (kind === "brick") {
    ctx.fillStyle = "rgba(255,255,255,.05)"; for (let y = 0; y < 128; y += 24) ctx.fillRect(0, y, 128, 3);
    ctx.strokeStyle = accCol; ctx.lineWidth = 3;
    for (let y = 0; y < 128; y += 24) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke();
      for (let x = (y / 24) % 2 ? 0 : 32; x < 128; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 24); ctx.stroke(); }
    }
  } else if (kind === "windowGrid") {
    ctx.fillStyle = baseCol; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = extCol; ctx.lineWidth = 4;
    for (let x = 16; x < 128; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    for (let y = 16; y < 128; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    ctx.fillStyle = accCol;
    for (let x = 6; x < 128; x += 28) for (let y = 7; y < 128; y += 24) ctx.fillRect(x, y, 16, 10);
  } else if (kind === "roof") {
    ctx.fillStyle = baseCol; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = accCol;
    for (let y = 0; y < 128; y += 18) { ctx.fillRect(0, y, 128, 3); for (let x = 0; x < 128; x += 24) ctx.fillRect(x + ((y/18)%2)*12, y, 3, 18); }
  } else if (kind === "stone") {
    ctx.fillStyle = baseCol; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = accCol; ctx.lineWidth = 2;
    for (let x = 0; x <= 128; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    for (let y = 0; y <= 128; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.035)"; for (let i=0;i<24;i++) ctx.fillRect(Math.random()*128, Math.random()*128, 2, 2);
  } else if (kind === "plaza") {
    ctx.fillStyle = baseCol; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = accCol; ctx.lineWidth = 3;
    for (let x = 0; x <= 128; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    for (let y = 0; y <= 128; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  TEX[key] = tex;
  return tex;
}
function textureMat(kind: string, base: string | number, accent?: string | number, emissive?: string | number, repeat: [number, number] = [1, 1], metalness = 0.04, roughness = 0.78) {
  const tex = makeTexture(kind, base, accent || "#ffffff", "#1a2430").clone();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.needsUpdate = true;
  return mat(base, emissive || "#000000", metalness, roughness, { map: tex });
}
function addTextPlane(g: THREE.Object3D, text: string, x: number, y: number, z: number, w = 0.7, h = 0.22, color = "#f3ead7", bg = "#142033") {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96;
  const c = cv.getContext("2d")!;
  c.fillStyle = bg; c.fillRect(0,0,256,96);
  c.strokeStyle = "rgba(255,255,255,.34)"; c.lineWidth = 5; c.strokeRect(5,5,246,86);
  c.fillStyle = color; c.textAlign = "center"; c.textBaseline = "middle"; c.font = "900 34px ui-sans-serif, system-ui";
  c.fillText(String(text || "SCHOOL").slice(0,16).toUpperCase(),128,50);
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  mesh.position.set(x,y,z); mesh.rotation.x = 0; g.add(mesh); return mesh;
}

function makePlaza(g: THREE.Group, recipe: any, progress: number) {
  const finished = progress >= 0.995;
  const size = footprintSize(recipe);
  const r = footprintRadius(recipe);
  const half = r + 0.55;
  const plaza = new THREE.Group();
  // Warm readable stone plaza. Keep it subtle so the generated Wonder is the star, not a neon debug pad.
  const tileMatA = textureMat("plaza", 0xb9ad8f, 0x7e725d, undefined, [1, 1], 0.02, 0.92);
  const tileMatB = textureMat("plaza", 0xc8bb99, 0x887b64, undefined, [1, 1], 0.02, 0.92);
  const tileMatC = textureMat("plaza", 0x9f9277, 0x6e624f, undefined, [1, 1], 0.02, 0.94);
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const border = Math.abs(dx) === r || Math.abs(dz) === r;
    const diag = (dx + dz) % 2 === 0;
    const tile = addBox(plaza, 0.91, 0.04, 0.91, border ? tileMatC : diag ? tileMatA : tileMatB, dx, 0.025, dz);
    tile.receiveShadow = true;
  }
  const edgeMat = mat(0xd7bf72, 0x000000, 0.06, 0.78);
  addBox(plaza, size + 0.05, 0.065, 0.12, edgeMat, 0, 0.07, -half);
  addBox(plaza, size + 0.05, 0.065, 0.12, edgeMat, 0, 0.07, half);
  addBox(plaza, 0.12, 0.065, size + 0.05, edgeMat, -half, 0.07, 0);
  addBox(plaza, 0.12, 0.065, size + 0.05, edgeMat, half, 0.07, 0);
  const postMat = mat(0xf0dfaa, finished ? 0x2a210a : 0x000000, finished ? 0.08 : 0.02, 0.72);
  for (const [x, z] of [[-r,-r],[r,-r],[-r,r],[r,r]]) {
    addCyl(plaza, 0.08, 0.11, finished ? 0.34 : 0.22, postMat, x, finished ? 0.24 : 0.16, z, 12);
  }
  const motifOuter = Math.max(0.55, Math.min(1.05, r * 0.30));
  const motif = new THREE.Mesh(new THREE.RingGeometry(motifOuter * 0.90, motifOuter, 48), basic(0xf2d67b, finished ? 0.10 : 0.055));
  motif.rotation.x = -Math.PI / 2; motif.position.y = 0.083; plaza.add(motif);
  g.add(plaza);
}
function addScaffold(g: THREE.Group, recipe: any, progress: number) {
  if (progress >= 0.995) return;
  const wood = mat(0x8b6238, 0x000000, 0.02, 0.88);
  const r = footprintRadius(recipe);
  const edge = Math.max(1.6, r - 0.8);
  const h = 0.8 + progress * 2.0;
  for (const [x, z] of [[-edge,-edge],[edge,-edge],[-edge,edge],[edge,edge],[-edge,0],[edge,0]]) addCyl(g, 0.035, 0.045, h, wood, x, h / 2 + 0.08, z, 7);
  addBox(g, edge * 2.15, 0.045, 0.06, wood, 0, h + 0.08, -edge);
  addBox(g, edge * 2.15, 0.045, 0.06, wood, 0, h + 0.08, edge);
  addBox(g, 0.06, 0.045, edge * 2.0, wood, -edge, h * 0.72 + 0.08, 0);
  addBox(g, 0.06, 0.045, edge * 2.0, wood, edge, h * 0.72 + 0.08, 0);
}

function semanticText(recipe: any) { return `${recipe?.name || ""} ${recipe?.prompt || ""}`.toLowerCase(); }
function semanticKind(recipe: any) {
  const s = semanticText(recipe);
  if (/\b(school|schoolhouse|classroom|campus|academy)\b/.test(s)) return /\bacademy\b/.test(s) && !/\bschool\b/.test(s) ? "academy" : "school";
  if (/\b(skyscraper|high\s*rise|high-rise|tower|city tower|office)\b/.test(s)) return "skyscraper";
  if (/\b(market|bazaar|shop|trading|vendor)\b/.test(s)) return "market";
  if (/\b(temple|shrine|altar|sanctuary)\b/.test(s)) return "temple";
  if (/\b(observatory|telescope|moon|star|astronomy)\b/.test(s)) return "observatory";
  if (/\b(dish|plate|bowl|meal|food|restaurant|kitchen|soup|ramen|salad)\b/.test(s)) return "dish";
  if (/\b(fountain|waterfall|spring|pool)\b/.test(s)) return "fountain";
  if (/\b(garden|park|grove|tree|forest)\b/.test(s)) return "garden";
  return "";
}
function progressVisibleLimit(count: number, progress: number) { return progress >= 0.995 ? count : Math.max(2, Math.ceil(count * Math.max(0.16, progress))); }
function pushIfBuilt(model: THREE.Group, created: any[], obj: any, progress: number) {
  created.push(obj);
  const idx = created.length - 1;
  if (idx < progressVisibleLimit(created.length + 16, progress)) model.add(obj);
  else { obj.traverse?.((o: any) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.16; o.material.wireframe = true; o.material.depthWrite = false; }}); model.add(obj); }
}
function frontify(obj: any) { obj.rotation.y = 0; return obj; }
function addWindow(model: THREE.Group, x: number, y: number, z: number, w = 0.16, h = 0.18, c = 0xdff6ff) {
  return addBox(model, w, h, 0.035, mat(c, c, 0.05, 0.38), x, y, z);
}

function makeSchoolModel(recipe: any, progress: number) {
  const model = new THREE.Group(); const made: any[] = [];
  const pal = paletteFor(recipe);
  const brick = textureMat("brick", "#b96050", "#6d332b", undefined, [2.2, 1.6], 0.03, 0.84);
  const roof = textureMat("roof", pal[2] || "#31507d", "#1d2d46", undefined, [1.8, 1.2], 0.04, 0.72);
  const trim = mat("#f3ead7", "#000000", 0.04, 0.7);
  const glass = mat("#dff6ff", "#9beeff", 0.08, 0.28);
  const dark = mat("#261c18", "#000000", 0.04, 0.72);
  const gold = mat("#ffd76e", "#6a4a12", 0.08, 0.5);
  const green = mat("#14f195", "#063b2c", 0.04, 0.65);
  // recognizable school mass: long classroom body with two wings
  addBox(model, 1.48, 0.74, 0.72, brick, 0, 0.50, 0.02);
  addBox(model, 0.82, 0.60, 0.58, brick, -1.16, 0.42, 0.05);
  addBox(model, 0.82, 0.60, 0.58, brick, 1.16, 0.42, 0.05);
  addBox(model, 1.66, 0.16, 0.92, roof, 0, 0.96, 0.00);
  addBox(model, 0.98, 0.14, 0.72, roof, -1.16, 0.79, 0.04);
  addBox(model, 0.98, 0.14, 0.72, roof, 1.16, 0.79, 0.04);
  // front entrance, sign, steps
  addBox(model, 0.38, 0.46, 0.06, dark, 0, 0.30, -0.35);
  addBox(model, 0.90, 0.08, 0.28, trim, 0, 0.08, -0.62);
  addBox(model, 0.60, 0.08, 0.20, gold, 0, 0.16, -0.52);
  addTextPlane(model, "SCHOOL", 0, 0.86, -0.455, 0.68, 0.20, "#06120d", "#ffd76e");
  // clock/bell tower
  addBox(model, 0.48, 0.72, 0.42, brick, 0, 1.18, 0.05);
  addCone(model, 0.39, 0.48, roof, 0, 1.78, 0.05, 4, Math.PI / 4);
  addSphere(model, 0.135, gold, 0, 1.33, -0.19, 1, 1, 0.32);
  addCyl(model, 0.07, 0.08, 0.16, gold, 0, 1.52, -0.16, 14);
  // windows: lots of repeated school windows
  for (const x of [-0.56, -0.28, 0.28, 0.56]) addWindow(model, x, 0.54, -0.355, 0.13, 0.16);
  for (const x of [-1.36, -1.10, 1.10, 1.36]) addWindow(model, x, 0.48, -0.285, 0.13, 0.15);
  for (const x of [-0.15, 0.15]) addWindow(model, x, 1.15, -0.18, 0.10, 0.12, 0xfff0bf);
  // side windows to keep it readable when camera rotates
  for (const x of [-0.68, -0.34, 0.34, 0.68]) addWindow(model, x, 0.54, 0.385, 0.12, 0.14, 0xd6f6ff);
  // flag, playground, book/table props
  addCyl(model, 0.025, 0.032, 1.05, trim, -1.92, 0.62, -0.72, 8);
  addBox(model, 0.36, 0.19, 0.028, green, -1.72, 1.05, -0.72);
  addTorus(model, 0.25, 0.035, gold, 1.88, 0.27, -0.82, Math.PI / 2, 0, 0);
  addCyl(model, 0.035, 0.04, 0.32, trim, 1.88, 0.16, -0.82, 8);
  addBox(model, 0.44, 0.07, 0.18, roof, 1.60, 0.16, -1.12);
  addBox(model, 0.32, 0.06, 0.23, mat("#3a251d"), -1.70, 0.13, -1.08);
  addBox(model, 0.28, 0.035, 0.19, mat("#f3ead7"), -1.70, 0.19, -1.08, 0.2);
  return model;
}

function makeSkyscraperModel(recipe: any, progress: number) {
  const model = new THREE.Group();
  const pal = paletteFor(recipe);
  const glassA = textureMat("windowGrid", pal[0] || "#b8e9ff", "#ecfbff", undefined, [1.2, 3.6], 0.2, 0.34);
  const glassB = textureMat("windowGrid", pal[2] || "#31507d", "#dff6ff", undefined, [1.0, 2.4], 0.16, 0.42);
  const dark = mat("#102038", "#000000", 0.08, 0.62);
  const lobby = mat("#ffd76e", "#5d4210", 0.08, 0.45);
  addBox(model, 1.34, 0.22, 1.04, dark, 0, 0.13, 0);
  addBox(model, 0.86, 2.35, 0.68, glassA, 0, 1.40, 0);
  addBox(model, 0.68, 1.05, 0.54, glassB, 0.06, 3.08, 0.02);
  addBox(model, 0.48, 0.62, 0.38, glassA, -0.04, 3.88, 0.02);
  addCyl(model, 0.04, 0.055, 0.72, lobby, 0, 4.55, 0, 10);
  addBox(model, 0.46, 0.30, 0.08, lobby, 0, 0.36, -0.54);
  for (let y = 0.65; y < 3.82; y += 0.34) addBox(model, 0.96, 0.025, 0.72, mat("#ecfbff", "#7dcfe8", 0.02, 0.46), 0, y, 0);
  return model;
}
function makeTempleModel(recipe: any, progress: number) {
  const model = new THREE.Group();
  const pal = paletteFor(recipe); const stone = textureMat("stone", pal[5] || "#f3ead7", "#cbbd9c", undefined, [1.4, 1.0], 0.04, 0.84); const gold = mat(pal[1] || "#ffd76e", "#5a400f", 0.09, 0.5);
  addBox(model, 2.1, 0.22, 1.35, mat("#5a4322"), 0, 0.13, 0);
  addBox(model, 1.65, 0.12, 0.35, gold, 0, 0.30, -0.75);
  for (const x of [-0.75,-0.25,0.25,0.75]) addCyl(model, 0.09, 0.11, 0.92, stone, x, 0.80, -0.15, 16);
  addBox(model, 1.9, 0.20, 0.78, stone, 0, 1.28, -0.15);
  addCone(model, 1.08, 0.58, gold, 0, 1.66, -0.15, 4, Math.PI/4);
  addSphere(model, 0.18, gold, 0, 2.0, -0.15);
  return model;
}
function makeMarketModel(recipe: any, progress: number) {
  const model = new THREE.Group(); const pal = paletteFor(recipe); const wood = mat("#6d4323");
  addCyl(model, 0.52, 0.36, 0.32, mat("#c79337"), 0, 0.28, 0, 18); addSphere(model, 0.22, mat("#ffd76e", "#5a400f"), 0, 0.65, 0);
  let i = 0; for (const x of [-1.55, 1.55]) for (const z of [-1.2, 0, 1.2]) { const c = mat(pal[i++ % pal.length]); addBox(model, 0.50, 0.32, 0.36, wood, x, 0.22, z); addCone(model, 0.58, 0.35, c, x, 0.55, z, 4, Math.PI/4); addBox(model, 0.32, 0.09, 0.035, mat("#f3ead7"), x, 0.42, z - 0.21); }
  return model;
}
function makeObservatoryModel(recipe: any, progress: number) {
  const model = new THREE.Group(); const pal = paletteFor(recipe); const base = textureMat("stone", pal[5] || "#f3ead7", "#b8b1a0", undefined, [1.2, 1.2]); const dome = mat(pal[2] || "#31507d", "#000000", 0.14, 0.45); const sky = mat("#7dcfe8", "#7dcfe8", 0.12, 0.32);
  addCyl(model, 0.86, 0.92, 0.82, base, 0, 0.46, 0, 24); addSphere(model, 0.74, dome, 0, 1.10, 0, 1, 0.62, 1); const tube = addCyl(model, 0.08, 0.09, 0.76, sky, 0.55, 1.38, -0.55, 14); tube.rotation.set(0.78,0.18,-0.75); addSphere(model, 0.16, sky, 0.90, 1.70, -0.90); addBox(model, 0.9, 0.09, 0.28, base, 0, 0.13, -1.02); return model;
}
function makeAcademyModel(recipe: any, progress: number) {
  const model = new THREE.Group(); const pal = paletteFor(recipe); const body = textureMat("stone", pal[0] || "#f3ead7", "#b8a9d6", undefined, [1.3,1.1]); const roof = mat(pal[1] || "#9945ff", pal[1] || "#9945ff", 0.08, 0.55);
  addBox(model, 1.25, 0.78, 0.90, body, 0, 0.44, 0); addCone(model, 1.02, 0.44, roof, 0, 1.08, 0, 4, Math.PI/4); addSphere(model, 0.32, mat("#7dcfe8", "#7dcfe8", 0.12, 0.28), 0, 1.62, -0.1);
  for (const x of [-1.50,1.50]) { addCyl(model,0.28,0.30,1.10,mat("#24113f"),x,0.65,0.1,16); addCone(model,0.42,0.56,roof,x,1.40,0.1,4,Math.PI/4); }
  addTorus(model,0.42,0.045,mat("#7dcfe8","#7dcfe8"),0,1.43,-0.58,Math.PI/2,0,0); return model;
}
function makeDishModel(recipe: any, progress: number) {
  const model = new THREE.Group();
  const pal = paletteFor(recipe);
  const porcelain = mat("#f8fbef", "#000000", 0.04, 0.40);
  const rim = mat(pal[1] || "#ffd76e", "#2a1d06", 0.08, 0.48);
  const sauce = mat(pal[2] || "#c26a2f", "#381206", 0.04, 0.68);
  const greens = mat("#2fbf6a", "#062916", 0.02, 0.72);
  const cream = mat("#fff0c8", "#2a1a05", 0.03, 0.60);
  // literal plate / bowl silhouette, not an abstract tower
  addCyl(model, 1.15, 1.35, 0.16, porcelain, 0, 0.16, 0, 48);
  addTorus(model, 1.10, 0.07, rim, 0, 0.27, 0, Math.PI / 2, 0, 0);
  addCyl(model, 0.68, 0.92, 0.18, sauce, 0, 0.30, 0, 36);
  addSphere(model, 0.20, cream, -0.34, 0.44, -0.06, 1.35, 0.44, 0.86);
  addSphere(model, 0.18, mat("#f4b64a", "#3a1d04"), 0.10, 0.45, -0.16, 1.1, 0.50, 0.92);
  addSphere(model, 0.16, greens, 0.36, 0.42, 0.12, 1.2, 0.36, 0.80);
  addBox(model, 0.72, 0.045, 0.15, mat("#d8c5a6", "#000000", 0.16, 0.38), -0.76, 0.36, 0.58, -0.52);
  addSphere(model, 0.16, mat("#d8c5a6", "#000000", 0.16, 0.35), -1.08, 0.39, 0.80, 1.45, 0.18, 0.78);
  for (const [x,z,sy] of [[-0.12,0.38,0.60],[0.18,0.30,0.48],[0.02,0.52,0.42]]) {
    addCyl(model, 0.035, 0.015, sy as number, mat("#eafcff", "#b9ffff", 0.03, 0.35, { transparent: true, opacity: 0.62 }), x as number, 0.68 + Number(sy) * 0.30, z as number, 10);
  }
  addTextPlane(model, recipe?.name || "DISH", 0, 0.70, -1.08, 0.74, 0.18, "#2b1b10", "#fff0c8");
  return model;
}
function makeFountainModel(recipe: any, progress: number) {
  const model = new THREE.Group();
  const stone = textureMat("stone", "#c9c3ae", "#7e7563", undefined, [1.2, 1.2], 0.04, 0.76);
  const water = mat("#7dcfe8", "#7dcfe8", 0.02, 0.28, { transparent: true, opacity: 0.82 });
  addCyl(model, 1.05, 1.15, 0.28, stone, 0, 0.20, 0, 36);
  addCyl(model, 0.72, 0.78, 0.12, water, 0, 0.43, 0, 36);
  addCyl(model, 0.18, 0.25, 0.78, stone, 0, 0.82, 0, 20);
  addSphere(model, 0.20, water, 0, 1.30, 0, 1, 1.6, 1);
  for (const [x,z] of [[0.55,0],[-0.55,0],[0,0.55],[0,-0.55]]) addCyl(model,0.035,0.015,0.55,water,x,0.86,z,10);
  return model;
}
function makeGardenModel(recipe: any, progress: number) {
  const model = new THREE.Group(); const green = mat("#2f8f46", "#09230f", 0.02, 0.78); const path = textureMat("stone", "#c8bb99", "#7e725d", undefined, [1.0, 1.0]);
  addBox(model, 1.85, 0.05, 0.52, path, 0, 0.07, 0); addBox(model, 0.52, 0.05, 1.85, path, 0, 0.08, 0);
  for (const [x,z,s] of [[-0.8,-0.8,.7],[.8,-.7,.6],[-.75,.75,.55],[.78,.78,.65],[0,0,.8]]) { addCyl(model,0.18*s,0.22*s,0.35*s,mat("#6d4323"),x,0.23*s,z,10); addCone(model,0.44*s,0.76*s,green,x,0.78*s,z,12); }
  addCyl(model,0.26,0.32,0.28,mat("#f0dfaa"),0,0.22,-0.88,18); addSphere(model,0.20,mat("#ffd76e","#5a400f"),0,0.52,-0.88);
  return model;
}
function makeSemanticModel(recipe: any, progress: number) {
  const kind = semanticKind(recipe);
  if (kind === "school") return makeSchoolModel(recipe, progress);
  if (kind === "skyscraper") return makeSkyscraperModel(recipe, progress);
  if (kind === "temple") return makeTempleModel(recipe, progress);
  if (kind === "market") return makeMarketModel(recipe, progress);
  if (kind === "observatory") return makeObservatoryModel(recipe, progress);
  if (kind === "academy") return makeAcademyModel(recipe, progress);
  if (kind === "dish") return makeDishModel(recipe, progress);
  if (kind === "fountain") return makeFountainModel(recipe, progress);
  if (kind === "garden") return makeGardenModel(recipe, progress);
  return null;
}

function makeAiPartsModel(recipe: any, progress: number) {
  const pal = paletteFor(recipe);
  const parts = Array.isArray(recipe?.parts) ? recipe.parts.slice(0, 144) : [];
  const visibleLimit = progress >= 0.995 ? parts.length : Math.max(2, Math.ceil(parts.length * Math.max(0.12, progress)));
  const model = new THREE.Group();
  const cleanParts = parts.filter((p: any) => {
    const sx = Math.abs(Number(p?.scale?.[0] || 0));
    const sy = Math.abs(Number(p?.scale?.[1] || 0));
    const sz = Math.abs(Number(p?.scale?.[2] || 0));
    const wallish = String(p?.primitive || "") === "box" && sy > 0.9 && ((sx > 2.15 && sz < 0.24) || (sz > 2.15 && sx < 0.24));
    const tinyScatter = sx * sy * sz < 0.012;
    const hugeBlob = sx > 3.4 || sz > 3.4 || sy > 6.2;
    return !wallish && !tinyScatter && !hugeBlob;
  }).sort((a: any, b: any) => {
    const av = Math.abs(Number(a?.scale?.[0] || 1) * Number(a?.scale?.[1] || 1) * Number(a?.scale?.[2] || 1));
    const bv = Math.abs(Number(b?.scale?.[0] || 1) * Number(b?.scale?.[1] || 1) * Number(b?.scale?.[2] || 1));
    return bv - av;
  }).slice(0, 42);
  for (let i = 0; i < cleanParts.length; i++) {
    const p = cleanParts[i];
    const built = i < visibleLimit;
    const chosen = p?.color || pal[i % pal.length];
    const oneColorRecipe = parts.length > 8 && parts.slice(0, Math.min(parts.length, 12)).every((q: any) => String(q?.color || "").toLowerCase() === String(parts[0]?.color || "").toLowerCase());
    const color = oneColorRecipe && pal.length > 1 ? pal[i % pal.length] : chosen;
    const material = proceduralPartMaterial(recipe, p, i, color, built);
    const mesh = new THREE.Mesh(geo(String(p?.primitive || "box")), material);
    mesh.position.set(Number(p?.pos?.[0] || 0), Number(p?.pos?.[1] || 0) + 0.12, Number(p?.pos?.[2] || 0));
    mesh.scale.set(Number(p?.scale?.[0] || 1), Number(p?.scale?.[1] || 1), Number(p?.scale?.[2] || 1));
    mesh.rotation.set(Number(p?.rot?.[0] || 0), Number(p?.rot?.[1] || 0), Number(p?.rot?.[2] || 0));
    mesh.castShadow = true; mesh.receiveShadow = true; model.add(mesh);
  }
  return model;
}

export function makeWonderGroup(recipe: any, opts: any = {}) {
  const g = new THREE.Group();
  g.userData.wonder = recipe;
  const progress = Math.max(0, Math.min(1, Number(opts?.progress ?? opts?.buildProgress ?? 1)));
  makePlaza(g, recipe, progress);

  let model = makeSemanticModel(recipe, progress);
  if (!model) model = makeAiPartsModel(recipe, progress);
  const fp = footprintSize(recipe);
  // Semantic kits are already footprint-aware and readable; AI models still get scaled down.
  const semantic = !!semanticKind(recipe);
  model.scale.setScalar(semantic ? (fp >= 9 ? 1.0 : fp >= 7 ? 0.98 : fp >= 5 ? 0.94 : 0.86) : (fp >= 9 ? 0.70 : fp >= 7 ? 0.80 : fp >= 5 ? 0.90 : 1.0));
  g.add(model);
  addScaffold(g, recipe, progress);

  if (progress >= 0.995 && (recipe?.aura || "none") !== "none") {
    const c = auraColor(recipe?.aura || "gold");
    const ar = footprintRadius(recipe) + 0.35;
    for (const [x, z] of [[0,-ar],[ar,0],[0,ar],[-ar,0]]) {
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 8), mat(c, c, 0.18, 0.35));
      glow.position.set(x, 0.55, z); g.add(glow);
    }
  }
  g.userData.labelY = progress >= 0.995 ? (semanticKind(recipe) === "skyscraper" ? 5.4 : 3.4) : 3.0;
  g.userData.footprint = footprintSize(recipe);
  g.userData.semanticKind = semanticKind(recipe) || "ai";
  return g;
}
