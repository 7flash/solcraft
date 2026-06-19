/* ============================================================
   SOLCRAFT client meshes — pure visuals. Economy data lives in
   game/shared.ts; this file only knows how things LOOK.
   ============================================================ */
import * as THREE from "three";
import { GEAR_BY_ID, LIB_BY_ID, hrand, type Equip } from "../game/shared";
import { texturedMaterial } from "./textures";
import { buildDollBillboard, activeHeldToolFromEquip } from "./dolls";
import { makeWonderGroup } from "./wonderMeshes";

export const M = (color: number, opts: any = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
export const ME = (color: number, glow: number, intensity = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: glow, emissiveIntensity: intensity });

export function addBox(g: THREE.Object3D, w: number, h: number, d: number, mat: any, x: number, y: number, z: number, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === "number" ? M(mat) : mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  g.add(m); return m;
}
export function addCyl(g: THREE.Object3D, rt: number, rb: number, h: number, mat: any, x: number, y: number, z: number, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof mat === "number" ? M(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  g.add(m); return m;
}
export function addCone(g: THREE.Object3D, r: number, h: number, mat: any, x: number, y: number, z: number, seg = 4, ry = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), typeof mat === "number" ? M(mat) : mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = m.receiveShadow = true;
  g.add(m); return m;
}
export function addSphere(g: THREE.Object3D, r: number, mat: any, x: number, y: number, z: number, seg = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), typeof mat === "number" ? M(mat) : mat);
  m.position.set(x, y, z); m.castShadow = true;
  g.add(m); return m;
}
export function buildTree(g: THREE.Object3D, x: number, z: number, s = 1) {
  addCyl(g, 0.04 * s, 0.06 * s, 0.26 * s, 0x7a5230, x, 0.13 * s, z, 6);
  addCone(g, 0.2 * s, 0.34 * s, 0x3f9148, x, 0.4 * s, z, 7);
  addCone(g, 0.15 * s, 0.28 * s, 0x52ad58, x, 0.62 * s, z, 7);
}
export function buildRock(g: THREE.Object3D) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), M(0x9d9a90));
  rock.position.y = 0.1; rock.scale.y = 0.7;
  rock.castShadow = rock.receiveShadow = true;
  g.add(rock);
}
export function buildStall(g: THREE.Object3D, cx: number, cz: number, awn: number, ry = 0, sc = 1) {
  const s = new THREE.Group();
  addBox(s, 0.7, 0.3, 0.6, 0xe8d6ae, 0, 0.15, 0);
  for (let i = 0; i < 4; i++)
    addBox(s, 0.175, 0.07, 0.7, i % 2 ? 0xfbf3e0 : awn, -0.26 + i * 0.175, 0.5, 0.05);
  addBox(s, 0.05, 0.46, 0.05, 0x5d4430, -0.3, 0.27, 0.3);
  addBox(s, 0.05, 0.46, 0.05, 0x5d4430, 0.3, 0.27, 0.3);
  addBox(s, 0.16, 0.12, 0.16, 0xc49a5e, 0.16, 0.36, -0.1, 0.5);
  addBox(s, 0.13, 0.1, 0.13, 0xa97844, -0.15, 0.35, -0.05, 0.2);
  s.position.set(cx, 0, cz); s.rotation.y = ry; s.scale.setScalar(sc);
  g.add(s);
}
export function buildBanner(g: THREE.Object3D, color: number, ctx?: any) {
  addCyl(g, 0.025, 0.035, 1.2, 0x5d4430, 0, 0.6, 0, 6);
  const flag = addBox(g, 0.42, 0.24, 0.02, color, 0.23, 1.05, 0);
  if (ctx?.wavers) ctx.wavers.push(flag);
}

/* ---------- avatar ---------- */
export function addHat(g: THREE.Object3D, hat: string | null | undefined, hatColor: number, oy = 0) {
  if (!hat) addCone(g, 0.165, 0.2, hatColor, 0, 0.74 + oy, 0, 10);
  else if (hat === "straw") { addSphere(g, 0.145, hatColor, 0, 0.59 + oy, 0, 10).scale.y = 0.68; addCyl(g, 0.13, 0.13, 0.018, hatColor, 0.04, 0.61 + oy, 0.1, 12).scale.x = 1.45; }
  else if (hat === "crown") addCyl(g, 0.1, 0.105, 0.09, ME(0xf2cc4e, 0xffc83d, 0.6), 0, 0.7 + oy, 0, 8);
  else if (hat === "mage") { addCyl(g, 0.2, 0.2, 0.02, 0x5a3f9e, 0, 0.66 + oy, 0, 12); addCone(g, 0.12, 0.3, 0x7351d6, 0, 0.82 + oy, 0, 9); addSphere(g, 0.03, ME(0x14f195, 0x14f195, 1.2), 0, 0.98 + oy, 0, 6); }
  else if (hat === "hood") { const h = addSphere(g, 0.16, 0x3f6e48, 0, 0.58 + oy, -0.015, 10); h.scale.z = 1.15; }
  else if (hat === "miner") { addSphere(g, 0.155, 0xd6bd57, 0, 0.58 + oy, 0, 10).scale.y = 0.8; addBox(g, 0.05, 0.045, 0.03, ME(0xfff4cf, 0xfff0b8, 1.8), 0, 0.62 + oy, 0.15); }
}
function cssHexToNum(v: any, fallback: number) {
  const s = String(v || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return parseInt(s.slice(1), 16);
  return fallback;
}

function buildLegacyRig(body: number, hatColor: number, equip: Equip, { lit = false, palette = null as any, dollParts = null as any } = {}) {
  const g = new THREE.Group();
  const skin = cssHexToNum(palette?.skin, 0xf0c8a0);
  const hair = cssHexToNum(palette?.hair, 0x4b2e1c);
  const clothB = cssHexToNum(palette?.secondaryCloth, new THREE.Color(body).multiplyScalar(0.78).getHex());
  const dark = new THREE.Color(body).multiplyScalar(0.72).getHex();
  const bootC = equip.boots === "swift" ? 0x4fd6c0 : equip.boots === "trek" ? 0x6e4a2f : cssHexToNum(palette?.leather, dark);
  addCyl(g, 0.05, 0.065, 0.14, bootC, -0.07, 0.07, 0, 7);
  addCyl(g, 0.05, 0.065, 0.14, bootC, 0.07, 0.07, 0, 7);
  addCyl(g, 0.13, 0.17, 0.3, body, 0, 0.28, 0, 10);
  addBox(g, 0.16, 0.035, 0.18, clothB, 0, 0.13, 0.02);
  if (equip.armor === "pads") {
    addBox(g, 0.1, 0.07, 0.12, 0x8a5a30, -0.15, 0.41, 0);
    addBox(g, 0.1, 0.07, 0.12, 0x8a5a30, 0.15, 0.41, 0);
    addBox(g, 0.24, 0.08, 0.2, 0x7a4f2a, 0, 0.33, 0.02);
  } else if (equip.armor === "plate") {
    addBox(g, 0.11, 0.08, 0.13, 0x9aa3b0, -0.155, 0.41, 0);
    addBox(g, 0.11, 0.08, 0.13, 0x9aa3b0, 0.155, 0.41, 0);
    addBox(g, 0.26, 0.16, 0.21, 0xaeb7c4, 0, 0.32, 0.02);
    addBox(g, 0.1, 0.04, 0.02, ME(0x9945ff, 0x9945ff, 0.9), 0, 0.36, 0.13);
  }
  addCyl(g, 0.035, 0.045, 0.2, dark, -0.17, 0.33, 0, 6);
  addCyl(g, 0.035, 0.045, 0.2, dark, 0.17, 0.33, 0, 6);
  addSphere(g, 0.14, skin, 0, 0.55, 0, 12);
  if ((dollParts?.hair ?? 0) >= 0) {
    const hairCap = addSphere(g, 0.145, hair, 0, 0.60, -0.02, 12);
    hairCap.scale.set(1.04, 0.62, 0.92);
    addSphere(g, 0.035, hair, -0.09, 0.56, 0.1, 7);
    addSphere(g, 0.035, hair, 0.09, 0.56, 0.1, 7);
  }
  if (dollParts?.showHat !== false) addHat(g, equip.hat as string, hatColor, 0);
  if (dollParts?.showBack) {
    const pack = addBox(g, 0.22, 0.28, 0.05, cssHexToNum(palette?.leather, 0x6a4124), 0, 0.34, -0.17);
    pack.rotation.x = 0.12;
  }
  if (equip.cape) {
    const c = GEAR_BY_ID[equip.cape as string];
    const cape = addBox(g, 0.3, 0.36, 0.025, c?.color ?? 0x888888, 0, 0.3, -0.15);
    cape.rotation.x = 0.18;
  }
  if (equip.hand === "lantern") {
    addCyl(g, 0.008, 0.008, 0.12, 0x4a3b2c, 0.22, 0.42, 0.08, 5);
    addBox(g, 0.07, 0.09, 0.07, 0x3a3128, 0.22, 0.32, 0.08);
    addSphere(g, 0.03, ME(0xffd9a0, 0xffb45e, 1.7), 0.22, 0.32, 0.08, 7);
    if (lit) { const pl = new THREE.PointLight(0xffc88a, 0.7, 3.2); pl.position.set(0.22, 0.36, 0.08); g.add(pl); }
  } else if (equip.hand === "staff") {
    addCyl(g, 0.014, 0.018, 0.55, 0x5d4430, 0.21, 0.3, 0, 6);
    const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), ME(0x14f195, 0x14f195, 1.3));
    oct.position.set(0.21, 0.62, 0); oct.castShadow = true; g.add(oct);
  } else if (equip.hand === "sword") {
    addBox(g, 0.025, 0.34, 0.025, 0xd7dde6, 0.22, 0.5, 0.05).rotation.z = 0.16;
    addBox(g, 0.1, 0.03, 0.03, 0xe0b54a, 0.245, 0.35, 0.05);
    addCyl(g, 0.016, 0.016, 0.09, 0x5d4430, 0.255, 0.29, 0.05, 6);
  } else if (equip.hand === "shield") {
    const sh = addCyl(g, 0.13, 0.13, 0.035, 0x8a5e34, -0.22, 0.34, 0.06, 12);
    sh.rotation.x = Math.PI / 2;
    const boss = addSphere(g, 0.045, 0xb8b1a0, -0.22, 0.34, 0.09, 8);
    boss.scale.z = 0.5;
  }
  return g;
}


export function buildRig(body: number, hatColor: number, equip: Equip = {} as any, opts: any = {}) {
  const palette = {
    ...(opts?.palette || {}),
    primaryCloth: opts?.palette?.primaryCloth || `#${(Number(body) || 0x31507d).toString(16).padStart(6, "0").slice(-6)}`,
    secondaryCloth: opts?.palette?.secondaryCloth || `#${(Number(hatColor) || 0xd6aa54).toString(16).padStart(6, "0").slice(-6)}`,
  };

  // The current visual rule is billboard-first: players are composed from the Doll
  // atlas into one stable sprite. The legacy mesh stays available for emergency
  // fallback/tests by passing { legacyRig: true }.
  if (!opts?.legacyRig) {
    const heldTool = opts?.heldTool || activeHeldToolFromEquip(equip || {});
    const g = buildDollBillboard({
      name: opts?.name,
      body,
      hat: hatColor,
      equip: equip || {},
      lit: !!opts?.lit,
      palette,
      dollParts: opts?.dollParts || {},
      heldTool,
    });
    g.userData = { ...(g.userData || {}), atlasRig: true, heldTool, name: opts?.name || "" };
    return g;
  }

  return buildLegacyRig(body, hatColor, equip || ({} as any), opts || {});
}

export function makeLabel(text: string, sub?: string) {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 64;
  const c = cv.getContext("2d")!;
  c.font = "600 28px monospace";
  c.textAlign = "center"; c.textBaseline = "middle";
  c.fillStyle = "rgba(10,16,24,.7)";
  const w = Math.min(244, c.measureText(text).width + 26);
  if ((c as any).roundRect) { c.beginPath(); (c as any).roundRect(128 - w / 2, 8, w, 48, 12); c.fill(); }
  else c.fillRect(128 - w / 2, 8, w, 48);
  c.fillStyle = sub || "#e9fff4";
  c.fillText(text, 128, 34);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(1.7, 0.42, 1);
  sp.position.y = 1.15;
  return sp;
}

/* ============================================================
   BUILDING VISUALS — distinct silhouette per id, all within
   one cell; `c` is the (customizable) primary color
   ============================================================ */
type Ctx = { spinners: THREE.Object3D[]; spinsY: THREE.Object3D[]; wavers: THREE.Object3D[]; bobbers: THREE.Object3D[]; flickers: THREE.Mesh[] };
type Builder = (ctx: Ctx, c: number) => THREE.Group;

export const BUILD_VISUALS: Record<string, Builder> = {
  cottage: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.62, 0.42, 0.56, c, 0, 0.21, 0);
    addCone(g, 0.52, 0.36, 0xd6604f, 0, 0.6, 0, 4, Math.PI / 4);
    addBox(g, 0.09, 0.24, 0.09, 0x96826e, 0.17, 0.64, -0.1);
    addBox(g, 0.14, 0.2, 0.02, 0x5d4430, 0, 0.14, 0.29);
    addBox(g, 0.12, 0.12, 0.02, ME(0xffe2a8, 0xffc878, 0.9), 0.17, 0.26, 0.29);
    addBox(g, 0.12, 0.12, 0.02, ME(0xffe2a8, 0xffc878, 0.9), -0.17, 0.26, 0.29);
    return g;
  },
  well: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.26, 0.3, 0.3, c, 0, 0.15, 0);
    const water = addCyl(g, 0.2, 0.2, 0.06, ME(0x2e9bb0, 0x3ee6ff, 0.3), 0, 0.31, 0);
    (water as any).userData.baseY = 0.31; ctx.bobbers.push(water);
    addBox(g, 0.05, 0.5, 0.05, 0x7a5230, -0.22, 0.45, 0);
    addBox(g, 0.05, 0.5, 0.05, 0x7a5230, 0.22, 0.45, 0);
    addCone(g, 0.36, 0.22, 0x4f8a58, 0, 0.78, 0, 4, Math.PI / 4);
    return g;
  },
  farm: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.8, 0.1, 0.8, 0x7d5638, 0, 0.05, 0);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        addCone(g, 0.07, 0.2, c, -0.24 + i * 0.24, 0.18, -0.24 + j * 0.24, 6);
    for (const sx of [-0.42, 0.42]) addBox(g, 0.04, 0.22, 0.84, 0x9a7450, sx, 0.11, 0);
    return g;
  },
  lumber: (ctx, c) => {
    const g = new THREE.Group();
    const log = (x: number, y: number, z: number) => { addCyl(g, 0.08, 0.08, 0.6, c, x, y, z, 8).rotation.z = Math.PI / 2; };
    log(0, 0.09, -0.1); log(0, 0.09, 0.08); log(0, 0.24, -0.01);
    addCyl(g, 0.12, 0.14, 0.16, 0x8a5e34, 0.24, 0.08, 0.28, 8);
    addBox(g, 0.02, 0.2, 0.06, 0xd7dde6, 0.24, 0.26, 0.28, 0.4);
    buildTree(g, -0.28, 0.26, 0.8);
    return g;
  },
  quarry: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.78, 0.14, 0.78, c, 0, 0.07, 0);
    const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), M(0xaaa69a));
    r1.position.set(-0.14, 0.26, -0.1); r1.castShadow = true; g.add(r1);
    const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), M(0x99958a));
    r2.position.set(0.16, 0.21, 0.14); r2.castShadow = true; g.add(r2);
    addBox(g, 0.3, 0.04, 0.14, 0x7a5230, 0.1, 0.05, 0.3, 0.3);
    return g;
  },
  sawmill: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.6, 0.38, 0.5, c, -0.08, 0.19, -0.06);
    addCone(g, 0.48, 0.3, 0x6b4830, -0.08, 0.53, -0.06, 4, Math.PI / 4);
    addBox(g, 0.5, 0.08, 0.2, 0x8a5e34, 0.1, 0.3, 0.26);
    addCyl(g, 0.07, 0.07, 0.46, 0xb0793f, 0.02, 0.36, 0.26, 8).rotation.z = Math.PI / 2;
    const bw = new THREE.Group();
    bw.position.set(0.26, 0.36, 0.26);
    const blade = addCyl(bw, 0.16, 0.16, 0.025, 0xcfd6df, 0, 0, 0, 16);
    blade.rotation.x = Math.PI / 2;
    g.add(bw);
    ctx.spinners.push(bw);
    return g;
  },
  market: (ctx, c) => {
    const g = new THREE.Group();
    buildStall(g, 0, 0, c, 0, 0.95);
    const coin = addSphere(g, 0.06, ME(0xf2cc4e, 0xffcf4a, 0.7), 0.3, 0.58, 0.2, 7);
    (coin as any).userData.baseY = 0.58; ctx.bobbers.push(coin); ctx.spinsY.push(coin);
    return g;
  },
  forge: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.6, 0.4, 0.54, c, 0, 0.2, 0);
    addBox(g, 0.14, 0.4, 0.14, 0x3a3f48, 0.18, 0.6, -0.14);
    const ember = addBox(g, 0.2, 0.16, 0.02, ME(0xff8a3d, 0xff6a00, 1.4), 0, 0.18, 0.28);
    ctx.flickers.push(ember);
    addBox(g, 0.18, 0.1, 0.1, 0x6e7480, -0.3, 0.16, 0.3);
    addCyl(g, 0.05, 0.06, 0.12, 0x4a3b2c, -0.3, 0.06, 0.3, 6);
    return g;
  },
  tavern: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.68, 0.42, 0.5, c, 0, 0.21, 0);
    addBox(g, 0.72, 0.05, 0.54, 0x7a5230, 0, 0.45, 0);
    addCone(g, 0.5, 0.3, 0x9c5e42, 0, 0.62, 0, 4, Math.PI / 4).scale.z = 0.7;
    addBox(g, 0.14, 0.14, 0.02, ME(0xffe2a8, 0xffc878, 0.95), -0.18, 0.24, 0.26);
    addBox(g, 0.15, 0.24, 0.02, 0x5d4430, 0.14, 0.14, 0.26);
    addBox(g, 0.04, 0.4, 0.04, 0x5d4430, 0.4, 0.5, 0.2);
    addBox(g, 0.24, 0.12, 0.02, 0xd6604f, 0.4, 0.64, 0.2);
    addCyl(g, 0.09, 0.09, 0.16, 0xb0793f, -0.32, 0.08, 0.34, 9);
    return g;
  },
  shrine: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.3, 0.34, 0.1, 0xc2b29a, 0, 0.05, 0, 10);
    addCyl(g, 0.07, 0.09, 0.5, 0xd7d2c3, 0, 0.35, 0, 8);
    addBox(g, 0.06, 0.3, 0.06, 0xc2b29a, -0.26, 0.15, -0.2);
    addBox(g, 0.06, 0.3, 0.06, 0xc2b29a, 0.26, 0.15, 0.2);
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), ME(c, c, 1.2));
    orb.position.set(0, 0.78, 0); orb.castShadow = true;
    (orb as any).userData.baseY = 0.78;
    g.add(orb);
    ctx.bobbers.push(orb);
    ctx.spinsY.push(orb);
    return g;
  },
  watchtower: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.18, 0.26, 0.9, c, 0, 0.45, 0, 8);
    addCyl(g, 0.28, 0.24, 0.16, 0x96826e, 0, 0.96, 0, 8);
    addCone(g, 0.26, 0.3, 0xd6604f, 0, 1.17, 0, 8);
    addBox(g, 0.025, 0.34, 0.025, 0x7a5230, 0, 1.45, 0);
    ctx.wavers.push(addBox(g, 0.22, 0.12, 0.015, 0x14f195, 0.13, 1.54, 0));
    return g;
  },
  granary: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.66, 0.42, 0.5, c, 0, 0.21, 0);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 12, 1, false, 0, Math.PI), M(0xb05a44));
    roof.rotation.z = Math.PI / 2; roof.position.set(0, 0.42, 0);
    roof.castShadow = roof.receiveShadow = true; g.add(roof);
    addBox(g, 0.16, 0.22, 0.02, 0x7a5230, 0, 0.13, 0.26);
    return g;
  },
  windmill: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.24, 0.34, 0.85, c, 0, 0.42, 0, 10);
    addCone(g, 0.3, 0.26, 0x9c5e42, 0, 0.98, 0, 10);
    const hub = new THREE.Group();
    hub.position.set(0, 0.86, 0.32);
    for (let i = 0; i < 4; i++) {
      const wrap = new THREE.Group();
      wrap.rotation.z = (i * Math.PI) / 2;
      addBox(wrap, 0.09, 0.55, 0.02, 0xfbf3e0, 0, 0.3, 0);
      hub.add(wrap);
    }
    g.add(hub);
    ctx.spinners.push(hub);
    addBox(g, 0.13, 0.13, 0.02, ME(0xffe2a8, 0xffc878, 0.9), 0, 0.26, 0.33);
    return g;
  },
  fountain: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.34, 0.38, 0.16, c, 0, 0.1, 0, 16);
    addCyl(g, 0.28, 0.28, 0.04, ME(0x2e9bb0, 0x3ee6ff, 0.4), 0, 0.19, 0, 16);
    addCyl(g, 0.07, 0.09, 0.3, c, 0, 0.32, 0, 10);
    const orb = addCyl(g, 0.09, 0.09, 0.09, ME(0x6fd0e0, 0x4ec3da, 0.8), 0, 0.54, 0, 10);
    (orb as any).userData.baseY = 0.54;
    ctx.bobbers.push(orb);
    return g;
  },
  garden: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.8, 0.07, 0.8, 0x7d5638, 0, 0.035, 0);
    buildTree(g, -0.22, -0.18, 0.7);
    addCone(g, 0.12, 0.26, c, 0.26, 0.2, -0.2, 7);
    for (const [fx, fz, col] of [[-0.1, 0.28, 0xf08bb0], [0.18, 0.24, 0xf5d76e], [0.3, 0.06, 0xffffff]] as [number, number, number][]) {
      addCyl(g, 0.012, 0.012, 0.1, 0x4f8a58, fx, 0.12, fz, 5);
      const fl = addSphere(g, 0.035, col, fx, 0.18, fz, 6);
      (fl as any).userData.baseY = 0.18;
      ctx.bobbers.push(fl);
    }
    return g;
  },
  flowerbed: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.76, 0.06, 0.76, 0x6b4a34, 0, 0.03, 0);
    for (let i = 0; i < 9; i++) {
      const x = -0.24 + (i % 3) * 0.24, z = -0.24 + Math.floor(i / 3) * 0.24;
      addCyl(g, 0.01, 0.01, 0.08, 0x3f9148, x, 0.1, z, 5);
      const fl = addSphere(g, 0.035, i % 2 ? c : 0xf5d76e, x, 0.16, z, 6);
      ctx.bobbers.push(fl);
    }
    return g;
  },
  waterfall: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.72, 0.2, 0.28, 0x8d897f, 0, 0.1, -0.16);
    addBox(g, 0.6, 0.5, 0.12, 0x9d9a90, 0, 0.35, -0.22);
    const fall = addBox(g, 0.22, 0.52, 0.025, ME(c, 0x3ee6ff, 0.65), 0, 0.34, -0.13);
    ctx.flickers.push(fall);
    addCyl(g, 0.3, 0.34, 0.05, ME(0x2e9bb0, 0x3ee6ff, 0.35), 0, 0.08, 0.18, 16);
    return g;
  },
  pond: (ctx, c) => {
    const g = new THREE.Group();
    const rim = addCyl(g, 0.38, 0.42, 0.055, 0x9b8f7b, 0, 0.035, 0, 28);
    rim.scale.z = 0.72;
    const water = addCyl(g, 0.31, 0.31, 0.028, ME(0x6fb5bd, 0xa6e6e8, 0.18), 0, 0.076, 0, 32);
    water.scale.z = 0.68;
    (water as any).userData.baseY = 0.076;
    ctx.bobbers.push(water);
    const glint = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.18, 24), new THREE.MeshBasicMaterial({ color: 0xf6ead6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    glint.rotation.x = -Math.PI / 2; glint.position.y = 0.095; glint.scale.z = 0.55; g.add(glint);
    return g;
  },
  statue: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.45, 0.12, 0.45, c, 0, 0.06, 0);
    addCyl(g, 0.12, 0.16, 0.48, c, 0, 0.36, 0, 8);
    addSphere(g, 0.13, c, 0, 0.68, 0, 10);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.2, 24), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.82; g.add(halo); ctx.spinsY.push(halo);
    return g;
  },
  lantern: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.025, 0.035, 0.72, 0x5d4430, 0, 0.36, 0, 6);
    addBox(g, 0.24, 0.04, 0.04, 0x5d4430, 0.1, 0.72, 0);
    const l = addSphere(g, 0.09, ME(c, 0xffd76e, 1.4), 0.23, 0.62, 0, 9);
    ctx.flickers.push(l);
    return g;
  },
  bench: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.62, 0.08, 0.18, c, 0, 0.25, 0);
    addBox(g, 0.62, 0.08, 0.12, c, 0, 0.42, -0.1);
    for (const x of [-0.24, 0.24]) addCyl(g, 0.025, 0.025, 0.24, 0x5d4430, x, 0.12, 0.06, 6);
    return g;
  },
  campfire: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.28, 0.32, 0.06, 0x5d4430, 0, 0.03, 0, 8);
    for (const r of [-0.35, 0.35]) addCyl(g, 0.04, 0.04, 0.55, 0x7a5230, 0, 0.12, 0, 7).rotation.z = Math.PI / 2 + r;
    const flame = addCone(g, 0.13, 0.32, ME(c, 0xff6a00, 1.5), 0, 0.28, 0, 7);
    ctx.flickers.push(flame);
    return g;
  },
  arch: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.12, 0.62, 0.16, c, -0.24, 0.31, 0);
    addBox(g, 0.12, 0.62, 0.16, c, 0.24, 0.31, 0);
    addBox(g, 0.6, 0.14, 0.18, c, 0, 0.62, 0);
    return g;
  },
  obelisk: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.34, 0.1, 0.34, 0x8d897f, 0, 0.05, 0);
    const spike = addCone(g, 0.18, 0.9, ME(c, c, 0.55), 0, 0.55, 0, 4, Math.PI / 4);
    ctx.spinsY.push(spike);
    return g;
  },
  hedge: (ctx, c) => {
    const g = new THREE.Group();
    for (const z of [-0.24, 0, 0.24]) addBox(g, 0.68, 0.26, 0.16, c, 0, 0.13, z);
    return g;
  },
  signpost: (ctx, c) => {
    const g = new THREE.Group();
    addCyl(g, 0.025, 0.035, 0.62, 0x7a5230, 0, 0.31, 0, 6);
    addBox(g, 0.46, 0.16, 0.05, c, 0.16, 0.52, 0);
    return g;
  },
  crystal: (ctx, c) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), ME(c, c, 1.0));
    a.position.y = 0.32; a.scale.y = 1.45; a.castShadow = true; g.add(a); ctx.bobbers.push(a); ctx.spinsY.push(a);
    return g;
  },
  bomb: (ctx, c) => {
    const g = new THREE.Group();
    addSphere(g, 0.25, M(c, { roughness: 0.55, metalness: 0.15 }), 0, 0.26, 0, 14);
    addCyl(g, 0.035, 0.045, 0.14, 0x6e7480, 0.12, 0.48, 0, 8);
    const fuse = addBox(g, 0.04, 0.2, 0.04, ME(0xffd76e, 0xff6a00, 1.2), 0.15, 0.58, 0, 0.4);
    ctx.flickers.push(fuse);
    return g;
  },

  wall: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.92, 0.42, 0.18, c, 0, 0.21, 0);
    addBox(g, 0.92, 0.08, 0.22, 0xbdb6aa, 0, 0.46, 0);
    for (const x of [-0.32, 0, 0.32]) addBox(g, 0.14, 0.12, 0.24, 0xd0cabf, x, 0.56, 0);
    return g;
  },
  gate: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.18, 0.68, 0.22, c, -0.34, 0.34, 0);
    addBox(g, 0.18, 0.68, 0.22, c, 0.34, 0.34, 0);
    addBox(g, 0.86, 0.18, 0.24, 0xc8b28a, 0, 0.7, 0);
    addBox(g, 0.36, 0.38, 0.04, 0x6a4428, 0, 0.25, 0.12);
    addBox(g, 0.04, 0.34, 0.06, 0xe0b54a, 0, 0.29, 0.16);
    return g;
  },
  vault: (ctx, c) => {
    const g = new THREE.Group();
    // Coin vault: squat stone bank with gold-lit lock, so stored/purse buildings
    // are readable even before labels/tooltips appear.
    addBox(g, 0.76, 0.46, 0.62, c, 0, 0.23, 0);
    addBox(g, 0.84, 0.08, 0.7, 0xa89e8c, 0, 0.5, 0);
    addCone(g, 0.6, 0.28, 0xd0b15c, 0, 0.68, 0, 4, Math.PI / 4);
    addBox(g, 0.26, 0.22, 0.035, ME(0xffd76e, 0xffb72e, 0.95), 0, 0.22, 0.33);
    addSphere(g, 0.055, ME(0xf2cc4e, 0xffd76e, 1.1), 0, 0.47, 0.35, 8);
    addBox(g, 0.1, 0.24, 0.04, 0x6e7480, -0.24, 0.22, 0.34);
    addBox(g, 0.1, 0.24, 0.04, 0x6e7480, 0.24, 0.22, 0.34);
    return g;
  },
  alchemy: (ctx, c) => {
    const g = new THREE.Group();
    // Potion shop: compact hut, purple roof, bubbling flask on the counter.
    addBox(g, 0.68, 0.38, 0.56, c, 0, 0.19, 0);
    addCone(g, 0.54, 0.31, 0x5d3f8e, 0, 0.56, 0, 4, Math.PI / 4);
    addBox(g, 0.18, 0.22, 0.025, 0x5d4430, -0.16, 0.15, 0.29);
    addBox(g, 0.48, 0.08, 0.16, 0x7a5230, 0.06, 0.28, 0.33);
    const flask = addSphere(g, 0.095, ME(0x14f195, 0x14f195, 1.15), 0.2, 0.43, 0.34, 10);
    flask.scale.y = 1.18;
    (flask as any).userData.baseY = 0.43;
    ctx.bobbers.push(flask);
    ctx.flickers.push(flask);
    addCyl(g, 0.032, 0.04, 0.11, 0xcbd1d8, 0.2, 0.55, 0.34, 8);
    const sign = addBox(g, 0.22, 0.1, 0.015, ME(0x9945ff, 0x9945ff, 0.7), -0.33, 0.62, 0.19);
    ctx.wavers.push(sign);
    return g;
  },
  academy: (ctx, c) => {
    const g = new THREE.Group();
    // Academy: readable from isometric distance — blue observatory dome,
    // book plinth, mint science orb, and a small waving pennant.
    addBox(g, 0.78, 0.12, 0.72, 0x5b4730, 0, 0.06, 0);
    addBox(g, 0.62, 0.48, 0.56, c, 0, 0.3, 0);
    addCone(g, 0.5, 0.27, 0x3f6f8a, 0, 0.675, 0, 4, Math.PI / 4);
    addCyl(g, 0.22, 0.25, 0.3, 0xe8dcc8, 0, 0.9, 0, 14);
    const dome = addSphere(g, 0.25, ME(0x7dcfe8, 0x7dcfe8, 0.55), 0, 1.06, 0, 14);
    dome.scale.y = 0.55;
    addBox(g, 0.16, 0.22, 0.025, 0x5d4430, 0, 0.16, 0.29);
    addBox(g, 0.18, 0.11, 0.04, ME(0x14f195, 0x14f195, 0.85), -0.23, 0.38, 0.31, -0.22);
    addBox(g, 0.18, 0.11, 0.04, ME(0xf3ead7, 0xd6c7a0, 0.35), -0.08, 0.39, 0.31, 0.22);
    const orb = addSphere(g, 0.075, ME(0x14f195, 0x14f195, 1.25), 0.26, 0.58, 0.27, 9);
    (orb as any).userData.baseY = 0.58;
    ctx.bobbers.push(orb);
    ctx.spinsY.push(orb);
    ctx.flickers.push(orb);
    addCyl(g, 0.018, 0.022, 0.4, 0x7a5230, 0.32, 0.82, -0.2, 6);
    const flag = addBox(g, 0.18, 0.09, 0.014, 0x9945ff, 0.42, 0.98, -0.2);
    ctx.wavers.push(flag);
    return g;
  },
  workshop: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.68, 0.36, 0.58, c, 0, 0.18, 0);
    addCone(g, 0.54, 0.28, 0x3f6f8a, 0, 0.5, 0, 4, Math.PI / 4);
    const gear = new THREE.Group(); gear.position.set(0.28, 0.43, 0.28); g.add(gear);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; addBox(gear, 0.04, 0.12, 0.04, 0xd7dde6, Math.cos(a)*0.13, Math.sin(a)*0.13, 0); }
    const hub = addCyl(gear, 0.09, 0.09, 0.04, 0x7dcfe8, 0, 0, 0, 16); hub.rotation.x = Math.PI / 2;
    ctx.spinners.push(gear);
    return g;
  },
  warehouse: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.78, 0.46, 0.64, c, 0, 0.23, 0);
    addCone(g, 0.62, 0.3, 0x6b4830, 0, 0.61, 0, 4, Math.PI / 4);
    for (const x of [-0.23, 0, 0.23]) addBox(g, 0.16, 0.14, 0.12, 0xd0a05a, x, 0.11, 0.38);
    return g;
  },
  barracks: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.76, 0.34, 0.54, c, 0, 0.17, 0);
    addCone(g, 0.58, 0.32, 0x48505c, 0, 0.5, 0, 4, Math.PI / 4);
    addBox(g, 0.06, 0.46, 0.06, 0x7a5230, -0.28, 0.52, 0.2);
    addBox(g, 0.22, 0.14, 0.025, ME(0x14f195, 0x14f195, 0.8), -0.18, 0.7, 0.2);
    addBox(g, 0.16, 0.06, 0.08, 0xd7dde6, 0.26, 0.28, 0.28, 0.6);
    return g;
  },
  townhall: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.82, 0.5, 0.66, c, 0, 0.25, 0);
    addCone(g, 0.66, 0.34, 0xc79337, 0, 0.67, 0, 4, Math.PI / 4);
    for (const x of [-0.3, -0.1, 0.1, 0.3]) addCyl(g, 0.035, 0.04, 0.42, 0xf3ead7, x, 0.3, 0.36, 8);
    addBox(g, 0.7, 0.06, 0.12, 0xf3ead7, 0, 0.52, 0.36);
    return g;
  },
  goldmine: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.78, 0.16, 0.72, 0x5a4b35, 0, 0.08, 0);
    addBox(g, 0.42, 0.34, 0.36, 0x7b6542, -0.14, 0.32, -0.08);
    const nug = addSphere(g, 0.08, ME(0xffd76e, 0xffd76e, 1.2), 0.28, 0.28, 0.2, 8);
    ctx.bobbers.push(nug); ctx.spinsY.push(nug);
    addBox(g, 0.46, 0.08, 0.1, 0x8a5e34, 0.12, 0.52, -0.08, -0.4);
    addCyl(g, 0.04, 0.04, 0.32, 0xc8c1b1, 0.36, 0.18, -0.2, 8).rotation.z = Math.PI / 2;
    return g;
  },
  barbcamp: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.78, 0.18, 0.78, 0x4a2d22, 0, 0.09, 0);
    addCone(g, 0.42, 0.44, 0x7b4a35, 0, 0.42, 0, 5);
    addBox(g, 0.06, 0.42, 0.06, 0x301b13, 0.24, 0.38, 0.16);
    const flame = addBox(g, 0.12, 0.18, 0.06, ME(0xff7a45, 0xff4a22, 1.4), -0.22, 0.25, 0.2);
    ctx.flickers.push(flame);
    return g;
  },
  keep: (ctx, c) => {
    const g = new THREE.Group();
    addBox(g, 0.6, 0.7, 0.6, c, 0, 0.35, 0);
    addBox(g, 0.7, 0.1, 0.7, 0xa89e8c, 0, 0.75, 0);
    for (const [tx, tz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]] as [number, number][])
      addBox(g, 0.1, 0.12, 0.1, 0xa89e8c, tx, 0.86, tz);
    addCyl(g, 0.16, 0.18, 0.45, c, 0, 1.02, 0, 8);
    addCone(g, 0.22, 0.28, 0x3f8ab5, 0, 1.38, 0, 8);
    addBox(g, 0.12, 0.16, 0.02, ME(0xffe2a8, 0xffc878, 0.9), 0, 0.5, 0.31);
    addBox(g, 0.02, 0.3, 0.02, 0x7a5230, 0, 1.6, 0);
    ctx.wavers.push(addBox(g, 0.2, 0.1, 0.015, 0x14f195, 0.11, 1.7, 0));
    return g;
  },
};

export const parseCol = (c: any, dflt = 0x999999): number => {
  if (typeof c === "number") return c;
  if (typeof c === "string") {
    const n = parseInt(c.replace("#", ""), 16);
    if (Number.isFinite(n)) return n;
  }
  return dflt;
};

type BuildingTheme = { primary: number; secondary: number; glow: number };
const BUILDING_THEMES: Record<string, { secondary: number; glow?: number }> = {
  "#f6e7c8": { secondary: 0xd6604f, glow: 0xfff0cf },
  "#3f8ab5": { secondary: 0x7dcfe8, glow: 0x9ee7ff },
  "#35b87a": { secondary: 0x14f195, glow: 0x8cffcf },
  "#e0b54a": { secondary: 0xffe0a6, glow: 0xffd76e },
  "#9263c4": { secondary: 0x9945ff, glow: 0xd9b8ff },
  "#f08bb0": { secondary: 0xd6604f, glow: 0xffd5dc },
  "#4a4f5a": { secondary: 0x7dcfe8, glow: 0xcbd1d8 },
  "#14f195": { secondary: 0x9945ff, glow: 0x14f195 },
  "#9945ff": { secondary: 0x14f195, glow: 0x9945ff },
};
function safeThemeHex(c: any) {
  const s = String(c || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}
function buildingThemeFromAccent(cl: any, primary: number): BuildingTheme | null {
  const hit = BUILDING_THEMES[safeThemeHex(cl)];
  if (!hit) return null;
  return { primary, secondary: hit.secondary, glow: hit.glow || hit.secondary };
}
function addBuildingThemeTrim(g: THREE.Group, theme: BuildingTheme | null, ctx: Ctx) {
  if (!theme) return;
  const line = ME(theme.secondary, theme.glow, 0.24);
  addBox(g, 0.92, 0.025, 0.045, line, 0, 0.075, -0.50);
  addBox(g, 0.92, 0.025, 0.045, line, 0, 0.075, 0.50);
  addBox(g, 0.045, 0.025, 0.92, line, -0.50, 0.075, 0);
  addBox(g, 0.045, 0.025, 0.92, line, 0.50, 0.075, 0);
  const pennant = addBox(g, 0.18, 0.09, 0.014, line, 0.48, 0.82, -0.24);
  pennant.rotation.y = 0.35;
  ctx.wavers.push(pennant);
}
function addConstructionOverlay(g: THREE.Group, progress: number, ctx: Ctx) {
  const p = Math.max(0, Math.min(1, Number(progress || 0)));
  const wood = 0xb98a52;
  const rope = 0xffe3a3;
  const h = 0.38 + p * 0.78;
  for (const [x, z] of [[-0.58,-0.58],[0.58,-0.58],[-0.58,0.58],[0.58,0.58]] as [number, number][]) addCyl(g, 0.025, 0.025, h, wood, x, h / 2, z, 6);
  addBox(g, 1.28, 0.026, 0.035, rope, 0, Math.min(1.05, h * 0.78), -0.58);
  addBox(g, 1.28, 0.026, 0.035, rope, 0, Math.min(1.05, h * 0.78), 0.58);
  addBox(g, 0.035, 0.026, 1.28, rope, -0.58, Math.min(1.05, h * 0.78), 0);
  addBox(g, 0.035, 0.026, 1.28, rope, 0.58, Math.min(1.05, h * 0.78), 0);
  const crate = addBox(g, 0.22, 0.16, 0.18, 0x7b5a36, -0.42, 0.08, 0.42, 0.2);
  const glow = addBox(g, 0.78 * Math.max(0.08, p), 0.018, 0.045, ME(0x14f195, 0x14f195, 0.5), 0, 0.082, 0.64);
  ctx.wavers.push(crate);
  ctx.flickers.push(glow);
}

export interface BuiltGroup { group: THREE.Group; parts: Ctx }
/* the one builder for every placed building: model + owner
   plinth + contact shadow + optional name label — ownership is
   readable at a glance from the plinth color */
export function makeBuildingGroup(kind: string, { nm = null as string | null, cl = null as string | null, plinth = 0x666666, wonder = null as any, buildProgress = 1, buildUntil = 0 } = {}): BuiltGroup {
  const parts: Ctx = { spinners: [], spinsY: [], wavers: [], bobbers: [], flickers: [] };
  const progress = Math.max(0, Math.min(1, Number(buildProgress ?? 1)));
  const leftSec = Math.max(0, Math.ceil((Number(buildUntil || 0) - Date.now()) / 1000));
  const progressLabel = `Building ${Math.max(1, Math.min(99, Math.round(progress * 100)))}%${leftSec ? ` · ${leftSec}s` : ""}`;
  if (kind === "worldwonder" && wonder?.parts?.length) {
    const group = makeWonderGroup(wonder, { progress, buildUntil });
    const labelY = Number(group.userData?.labelY || 6.3);
    if (nm) {
      const lb = makeLabel(nm, "#ffe9bd");
      lb.scale.set(1.35, 0.32, 1);
      lb.position.y = labelY;
      group.add(lb);
    }
    if (progress < 0.995) {
      const pb = makeLabel(progressLabel, "#9bffd9");
      pb.scale.set(1.0, 0.26, 1);
      pb.position.y = Math.max(1.35, labelY - 0.42);
      group.add(pb);
    }
    return { group, parts };
  }
  const def = LIB_BY_ID[kind];
  const builder = BUILD_VISUALS[kind];
  const color = cl != null ? parseCol(cl, def?.baseC ?? 0x999999) : (def?.baseC ?? 0x999999);
  const theme = buildingThemeFromAccent(cl, color);
  const g = builder ? builder(parts, color) : new THREE.Group();
  addBuildingThemeTrim(g, theme, parts);
  const plinthMat = texturedMaterial(kind === "goldmine" ? "marble" : "cobble", plinth, { repeat: 1.8, roughness: 0.92 });
  const lipMat = texturedMaterial("stone", new THREE.Color(plinth).multiplyScalar(0.58).getHex(), { repeat: 1.4, roughness: 1 });
  addBox(g, 1.05, 0.07, 1.05, plinthMat, 0, -0.006, 0);
  addBox(g, 1.12, 0.025, 1.12, lipMat, 0, -0.045, 0);
  if (progress < 0.995) addConstructionOverlay(g, progress, parts);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.026;
  g.add(blob);
  if (nm) {
    const lb = makeLabel(nm, "#ffe9bd");
    lb.scale.set(1.25, 0.3, 1);
    lb.position.y = progress < 0.995 ? 1.72 : 1.45;
    g.add(lb);
  }
  if (progress < 0.995) {
    const pb = makeLabel(progressLabel, "#9bffd9");
    pb.scale.set(0.86, 0.23, 1);
    pb.position.y = 1.38;
    g.add(pb);
  }
  return { group: g, parts };
}

/* ---------- loot meshes ---------- */
export function gearLootMesh(gid: string) {
  const g = new THREE.Group();
  const def = GEAR_BY_ID[gid];
  if (!def) return g;
  if (def.slot === "hat") {
    addHat(g, gid, 0xd6604f, -0.7);
    g.scale.setScalar(1.1);
  } else if (def.slot === "cape") {
    addBox(g, 0.22, 0.28, 0.03, def.color ?? 0x888888, 0, 0, 0).rotation.z = 0.2;
  } else if (def.slot === "armor") {
    addBox(g, 0.2, 0.16, 0.14, gid === "plate" ? 0xaeb7c4 : 0x8a5a30, 0, 0, 0);
    if (gid === "plate") addBox(g, 0.08, 0.04, 0.02, ME(0x9945ff, 0x9945ff, 0.9), 0, 0.03, 0.08);
  } else if (def.slot === "boots") {
    const bc = gid === "swift" ? 0x4fd6c0 : 0x6e4a2f;
    addCyl(g, 0.05, 0.065, 0.13, bc, -0.06, 0, 0, 7);
    addCyl(g, 0.05, 0.065, 0.13, bc, 0.06, 0, 0, 7);
  } else if (gid === "lantern") {
    addBox(g, 0.09, 0.11, 0.09, 0x3a3128, 0, 0, 0);
    addSphere(g, 0.04, ME(0xffd9a0, 0xffb45e, 1.6), 0, 0, 0, 7);
  } else if (gid === "staff") {
    addCyl(g, 0.015, 0.02, 0.4, 0x5d4430, 0, 0, 0, 6);
    const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), ME(0x14f195, 0x14f195, 1.3));
    oct.position.y = 0.24; g.add(oct);
  } else if (gid === "sword") {
    addBox(g, 0.03, 0.34, 0.03, 0xd7dde6, 0, 0.05, 0);
    addBox(g, 0.12, 0.03, 0.03, 0xe0b54a, 0, -0.1, 0);
  } else if (gid === "shield") {
    const sh = addCyl(g, 0.12, 0.12, 0.03, 0x8a5e34, 0, 0, 0, 12);
    sh.rotation.x = Math.PI / 2.2;
  }
  return g;
}
export function lootMesh(kind: string, gid: string | null) {
  if (kind === "gear" && gid) return gearLootMesh(gid);
  const g = new THREE.Group();
  if (kind === "wood") {
    addCyl(g, 0.05, 0.05, 0.3, 0xb0793f, 0, 0, 0, 7).rotation.z = Math.PI / 2;
    addCyl(g, 0.05, 0.05, 0.3, 0x9a6536, 0, 0.08, 0.03, 7).rotation.z = Math.PI / 2;
  } else if (kind === "stone") {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), M(0xaaa69a));
    m.castShadow = true; g.add(m);
  } else if (kind === "food") {
    addCone(g, 0.07, 0.2, 0xd7c653, -0.04, 0, 0, 6);
    addCone(g, 0.06, 0.18, 0xc9b347, 0.05, -0.01, 0.03, 6);
  } else if (kind === "gold") {
    const c1 = addCyl(g, 0.09, 0.09, 0.025, ME(0xf2cc4e, 0xb8902a, 0.5), 0, 0, 0, 14);
    c1.rotation.x = Math.PI / 2.3;
    const c2 = addCyl(g, 0.09, 0.09, 0.025, ME(0xf2cc4e, 0xb8902a, 0.5), 0.05, -0.04, 0.03, 14);
    c2.rotation.x = Math.PI / 2.1;
  } else if (kind === "energy") {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), ME(0x14f195, 0x14f195, 1.1));
    m.castShadow = true; g.add(m);
  } else if (kind === "shard") {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), ME(0x9945ff, 0x9945ff, 1.2));
    m.castShadow = true; g.add(m);
  } else if (kind === "relic") {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 8, 14), ME(0xf2cc4e, 0xb8902a, 0.5));
    m.rotation.x = Math.PI / 2.4; m.castShadow = true; g.add(m);
  }
  return g;
}

/* ---------- sfx ---------- */
export function makeSfx() {
  type SfxTheme = "classic" | "bright" | "soft" | "retro";
  let ac: AudioContext | null = null;
  let uiMuted = false, musicMuted = false;
  let uiVolume = 1;
  let musicVolume = 1;
  let theme: SfxTheme = "classic";
  let musicTimer: any = null, musicEl: HTMLAudioElement | null = null, musicUrl = "";
  const ctx = () => (ac ||= new (window.AudioContext || (window as any).webkitAudioContext)());
  const clamp01 = (n: any) => Math.max(0, Math.min(1, Number(n)));
  const themedType = (type: OscillatorType): OscillatorType => {
    if (theme === "retro") return type === "sine" ? "square" : type;
    if (theme === "soft") return type === "square" || type === "sawtooth" ? "triangle" : type;
    return type;
  };
  const themedVol = (vol: number, channel: "ui" | "music") => {
    const base = channel === "music" ? musicVolume : uiVolume;
    const t = theme === "bright" ? 1.18 : theme === "soft" ? 0.72 : theme === "retro" ? 0.92 : 1;
    return Math.max(0.0001, vol * base * t);
  };
  const tone = (f0: number, f1: number, dur: number, type: OscillatorType = "sine", vol = 0.12, delay = 0, channel: "ui" | "music" = "ui") => {
    if ((channel === "ui" && uiMuted) || (channel === "music" && musicMuted)) return;
    try {
      const c = ctx(), t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = themedType(type);
      o.frequency.setValueAtTime(Math.max(f0, 1), t);
      if (Math.abs(f1 - f0) < 0.001) o.frequency.setValueAtTime(Math.max(f1, 1), t + dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      const v = themedVol(vol, channel);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.03);
    } catch (e) {}
  };
  const noise = (dur: number, vol = 0.08, delay = 0, filter = 900, channel: "ui" | "music" = "ui") => {
    if ((channel === "ui" && uiMuted) || (channel === "music" && musicMuted)) return;
    try {
      const c = ctx(), t = c.currentTime + delay;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filter;
      const g = c.createGain();
      g.gain.setValueAtTime(themedVol(vol, channel), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination);
      src.start(t); src.stop(t + dur + 0.02);
    } catch (e) {}
  };
  const seq = (notes: number[], opts: { dur?: number; gap?: number; type?: OscillatorType; vol?: number } = {}) => {
    const dur = opts.dur ?? 0.08, gap = opts.gap ?? dur * 0.78;
    notes.forEach((f, i) => tone(f, f, dur, opts.type || "sine", opts.vol ?? 0.08, i * gap));
  };
  const tickMusic = () => {
    if (musicMuted || musicUrl) return;
    const bass = theme === "bright" ? 164.8 : 146.8;
    tone(bass, bass, 1.8, "sine", 0.012, 0, "music");
    tone(220, 220, 1.6, "sine", 0.008, 0.35, "music");
    if (theme === "bright") tone(329.6, 329.6, 1.2, "triangle", 0.005, 0.72, "music");
  };
  const ensureMusic = () => {
    if (musicMuted) return;
    if (musicUrl) {
      try {
        if (!musicEl) {
          musicEl = new Audio(musicUrl);
          musicEl.loop = true;
          musicEl.preload = "auto";
        }
        musicEl.volume = Math.max(0, Math.min(1, 0.38 * musicVolume));
        musicEl.play().catch(() => {});
      } catch (e) {}
      return;
    }
    if (musicTimer) return;
    tickMusic();
    musicTimer = setInterval(tickMusic, 4200);
  };
  const stopMusic = () => {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    try { if (musicEl) musicEl.pause(); } catch (e) {}
  };
  const setAudioConfig = (cfg: any = {}) => {
    if (cfg.uiVolume != null) uiVolume = clamp01(cfg.uiVolume);
    if (cfg.musicVolume != null) musicVolume = clamp01(cfg.musicVolume);
    if (["classic", "bright", "soft", "retro"].includes(String(cfg.theme || ""))) theme = String(cfg.theme) as SfxTheme;
    if (musicEl) musicEl.volume = Math.max(0, Math.min(1, 0.38 * musicVolume));
    if (!musicMuted) ensureMusic();
  };
  return {
    setMuted: (m: boolean) => { uiMuted = !!m; musicMuted = !!m; if (musicMuted) stopMusic(); else ensureMusic(); },
    setUiMuted: (m: boolean) => (uiMuted = !!m),
    setMusicMuted: (m: boolean) => { musicMuted = !!m; if (musicMuted) stopMusic(); else ensureMusic(); },
    setUiVolume: (v: number) => setAudioConfig({ uiVolume: v }),
    setMusicVolume: (v: number) => setAudioConfig({ musicVolume: v }),
    setTheme: (v: SfxTheme) => setAudioConfig({ theme: v }),
    setAudioConfig,
    setMusicUrl: (url: string) => { const next = String(url || ""); if (next === musicUrl) { if (!musicMuted) ensureMusic(); return; } stopMusic(); musicUrl = next; musicEl = null; if (!musicMuted) ensureMusic(); },
    resume: () => { try { ctx().resume(); ensureMusic(); } catch (e) {} },
    hop: () => { tone(220, 340, 0.045, "triangle", 0.045); tone(380, 280, 0.055, "sine", 0.025, 0.025); },
    claim: () => { seq([392, 523, 659], { dur: 0.09, gap: 0.07, type: "sine", vol: 0.085 }); noise(0.08, 0.018, 0.04, 1600); },
    build: () => { tone(210, 170, 0.06, "triangle", 0.07); noise(0.055, 0.045, 0.025, 720); tone(330, 392, 0.12, "triangle", 0.08, 0.08); tone(523, 523, 0.14, "sine", 0.055, 0.18); },
    demolish: () => { tone(150, 55, 0.34, "sawtooth", 0.075); noise(0.22, 0.075, 0.02, 360); },
    err: () => { tone(150, 96, 0.09, "sawtooth", 0.055); tone(96, 78, 0.12, "sawtooth", 0.045, 0.07); },
    coin: () => { seq([988, 1318, 1760], { dur: 0.05, gap: 0.045, type: "square", vol: 0.045 }); tone(2349, 1975, 0.08, "sine", 0.025, 0.12); },
    pickup: () => { tone(520, 820, 0.06, "triangle", 0.055); tone(820, 620, 0.08, "sine", 0.035, 0.05); },
    equip: () => { tone(392, 392, 0.05, "triangle", 0.06); tone(659, 659, 0.09, "sine", 0.055, 0.055); },
    chop: () => { noise(0.065, 0.08, 0, 520); tone(185, 112, 0.08, "square", 0.065, 0.01); noise(0.04, 0.035, 0.09, 900); },
    mine: () => { tone(520, 890, 0.035, "square", 0.045); tone(1060, 640, 0.055, "triangle", 0.035, 0.035); noise(0.05, 0.028, 0.02, 2200); },
    saw: () => { tone(300, 240, 0.13, "sawtooth", 0.045); tone(420, 300, 0.12, "sawtooth", 0.035, 0.085); },
    hit: () => { tone(210, 128, 0.09, "square", 0.07); noise(0.08, 0.035, 0.01, 520); },
    raid: () => { tone(196, 98, 0.22, "sawtooth", 0.075); tone(155, 77, 0.24, "square", 0.055, 0.11); tone(466, 311, 0.18, "triangle", 0.035, 0.19); },
    use: () => { seq([440, 554, 659], { dur: 0.07, gap: 0.055, type: "triangle", vol: 0.055 }); },
    milestone: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, "sine", 0.085, i * 0.09)),
  };
}