import * as THREE from "three";

import { billboardColor, normalizeBillboardTool, type PlayerBillboardTool } from "./playerBillboardModel";

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawTool(ctx: CanvasRenderingContext2D, tool: PlayerBillboardTool, trim: string) {
  if (tool === "none") return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#4a3320";
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(150, 148); ctx.lineTo(194, 190); ctx.stroke();
  if (tool === "axe") {
    ctx.fillStyle = "#bac4c9"; ctx.strokeStyle = "#3d464a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(176, 122); ctx.quadraticCurveTo(210, 120, 214, 146); ctx.quadraticCurveTo(192, 148, 174, 166); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (tool === "pickaxe") {
    ctx.strokeStyle = "#bac4c9"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(162, 126); ctx.quadraticCurveTo(194, 104, 222, 126); ctx.stroke();
  } else if (tool === "hammer") {
    ctx.fillStyle = "#c9b58a"; ctx.strokeStyle = "#443a2a"; ctx.lineWidth = 4;
    rounded(ctx, 174, 116, 42, 24, 6); ctx.fill(); ctx.stroke();
  } else if (tool === "shovel") {
    ctx.fillStyle = "#ccd6dc"; ctx.strokeStyle = "#3e4850"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(204, 194, 15, 22, -0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (tool === "capture") {
    ctx.strokeStyle = "#4a3320"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(174, 112); ctx.lineTo(174, 190); ctx.stroke();
    ctx.fillStyle = trim;
    ctx.beginPath(); ctx.moveTo(176, 116); ctx.lineTo(220, 130); ctx.lineTo(176, 146); ctx.closePath(); ctx.fill();
  } else if (tool === "sword") {
    ctx.strokeStyle = "#f3ead7"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(170, 190); ctx.lineTo(220, 116); ctx.stroke();
    ctx.strokeStyle = "#3d464a"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(170, 190); ctx.lineTo(220, 116); ctx.stroke();
    ctx.fillStyle = "#ffd76e";
    rounded(ctx, 160, 178, 24, 10, 4); ctx.fill();
  } else {
    ctx.strokeStyle = trim; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(168, 116); ctx.lineTo(202, 188); ctx.stroke();
    ctx.fillStyle = "#fff0a8"; ctx.beginPath(); ctx.arc(166, 112, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function makePlayerBillboard(opts: any = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const body = billboardColor(opts.body, "#14f195");
  const skin = billboardColor(opts.palette?.skin, "#f0c08a");
  const hair = billboardColor(opts.palette?.hair, "#34251c");
  const cloth = billboardColor(opts.palette?.primaryCloth || opts.body, body);
  const trim = billboardColor(opts.palette?.secondaryCloth || opts.hat, "#ffd76e");
  const tool = normalizeBillboardTool(opts.heldTool || opts.tool);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(0, 4);
  ctx.shadowColor = "rgba(0,0,0,.38)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  ctx.strokeStyle = "rgba(5,8,14,.9)";
  ctx.lineWidth = 8;
  ctx.fillStyle = cloth;
  rounded(ctx, 88, 112, 82, 88, 22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = trim;
  rounded(ctx, 96, 124, 66, 16, 8); ctx.fill();

  ctx.fillStyle = "#25201e";
  rounded(ctx, 92, 196, 26, 34, 10); ctx.fill();
  rounded(ctx, 140, 196, 26, 34, 10); ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(129, 82, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(129, 58, 42, 24, 0, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#17110d";
  ctx.beginPath(); ctx.arc(116, 83, 4, 0, Math.PI * 2); ctx.arc(142, 83, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#8a5639"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(129, 93, 12, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

  drawTool(ctx, tool, trim);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.y = 0.76;
  sprite.scale.set(0.82, 0.82, 0.82);
  sprite.userData.dispose = () => { tex.dispose(); mat.dispose(); };

  const g = new THREE.Group();
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  g.add(shadow, sprite);
  g.userData.billboard = true;
  return g;
}
