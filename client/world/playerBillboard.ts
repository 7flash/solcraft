import * as THREE from "three";

import {
  billboardColor,
  normalizeBillboardTool,
  type PlayerBillboardTool,
} from "./playerBillboardModel";

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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

  // simple handle
  ctx.strokeStyle = "#6b4528";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(164, 130);
  ctx.lineTo(205, 178);
  ctx.stroke();

  if (tool === "axe") {
    ctx.fillStyle = "#cfd8dc";
    ctx.strokeStyle = "#45515a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(190, 115);
    ctx.quadraticCurveTo(218, 118, 217, 141);
    ctx.quadraticCurveTo(200, 139, 184, 151);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (tool === "pickaxe") {
    ctx.strokeStyle = "#cfd8dc";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(174, 120);
    ctx.quadraticCurveTo(197, 100, 223, 126);
    ctx.stroke();
  } else if (tool === "hammer") {
    ctx.fillStyle = "#b9a06a";
    ctx.strokeStyle = "#4b3a24";
    ctx.lineWidth = 3;
    rounded(ctx, 184, 110, 38, 22, 6);
    ctx.fill();
    ctx.stroke();
  } else if (tool === "shovel") {
    ctx.fillStyle = "#cfd8dc";
    ctx.strokeStyle = "#45515a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(208, 182, 13, 19, -0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (tool === "capture") {
    ctx.strokeStyle = "#6b4528";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(176, 104);
    ctx.lineTo(176, 178);
    ctx.stroke();

    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(180, 108);
    ctx.lineTo(222, 120);
    ctx.lineTo(180, 137);
    ctx.closePath();
    ctx.fill();
  } else if (tool === "sword") {
    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(170, 166);
    ctx.lineTo(214, 105);
    ctx.stroke();

    ctx.strokeStyle = "#59636b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(170, 166);
    ctx.lineTo(214, 105);
    ctx.stroke();

    ctx.fillStyle = trim;
    rounded(ctx, 157, 155, 26, 9, 4);
    ctx.fill();
  } else {
    // wand/use tool
    ctx.strokeStyle = "#6b4528";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(168, 164);
    ctx.lineTo(205, 115);
    ctx.stroke();

    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.arc(208, 112, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // tiny mitten hand over tool
  ctx.fillStyle = "#f0b48f";
  ctx.strokeStyle = "#5c3824";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(165, 132, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

export function makePlayerBillboard(opts: any = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d")!;

  const dress = billboardColor(opts.palette?.primaryCloth || opts.body, "#6f8ed8");
  const trim = billboardColor(opts.palette?.secondaryCloth || opts.hat, "#ffd76e");
  const skin = billboardColor(opts.palette?.skin, "#f0b48f");
  const hair = billboardColor(opts.hat || opts.palette?.hair, "#6b4528");
  const shoe = "#3b2b24";
  const tool = normalizeBillboardTool(opts.heldTool || opts.tool);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(0, 6);

  // soft global shadow
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 5;

  // legs
  ctx.fillStyle = skin;
  rounded(ctx, 105, 165, 16, 42, 8);
  ctx.fill();

  rounded(ctx, 135, 165, 16, 42, 8);
  ctx.fill();

  // shoes
  ctx.fillStyle = shoe;
  rounded(ctx, 96, 198, 29, 14, 7);
  ctx.fill();

  rounded(ctx, 132, 198, 29, 14, 7);
  ctx.fill();

  // arms behind body
  ctx.fillStyle = skin;
  rounded(ctx, 72, 118, 22, 58, 11);
  ctx.fill();

  rounded(ctx, 162, 118, 22, 58, 11);
  ctx.fill();

  // doll body / simple dress
  ctx.fillStyle = dress;
  ctx.beginPath();
  ctx.moveTo(103, 112);
  ctx.lineTo(153, 112);
  ctx.quadraticCurveTo(170, 145, 176, 184);
  ctx.quadraticCurveTo(128, 201, 80, 184);
  ctx.quadraticCurveTo(86, 145, 103, 112);
  ctx.closePath();
  ctx.fill();

  // dress trim
  ctx.shadowColor = "transparent";
  ctx.fillStyle = trim;
  rounded(ctx, 98, 110, 60, 14, 7);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  rounded(ctx, 110, 132, 16, 45, 8);
  ctx.fill();

  // neck
  ctx.fillStyle = skin;
  rounded(ctx, 116, 96, 24, 24, 10);
  ctx.fill();

  // head
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 5;

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(128, 72, 38, 0, Math.PI * 2);
  ctx.fill();

  // ears
  ctx.beginPath();
  ctx.arc(90, 75, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(166, 75, 8, 0, Math.PI * 2);
  ctx.fill();

  // hair cap
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(128, 64, 39, Math.PI, 0);
  ctx.quadraticCurveTo(146, 83, 158, 64);
  ctx.quadraticCurveTo(144, 78, 128, 60);
  ctx.quadraticCurveTo(112, 78, 98, 64);
  ctx.closePath();
  ctx.fill();

  // face
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#2c201c";
  ctx.beginPath();
  ctx.arc(115, 78, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(141, 78, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7a4233";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(128, 88, 9, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // cheeks
  ctx.fillStyle = "rgba(255,120,120,0.25)";
  ctx.beginPath();
  ctx.arc(105, 88, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(151, 88, 7, 0, Math.PI * 2);
  ctx.fill();

  // simple left mitten
  ctx.fillStyle = skin;
  ctx.strokeStyle = "#5c3824";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(81, 173, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // right-side held tool
  drawTool(ctx, tool, trim);

  ctx.restore();

  const g = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.35, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );

  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.position.y = 0.78;
  sprite.scale.set(0.85, 0.85, 0.85);

  sprite.userData.dispose = () => {
    tex.dispose();
    mat.dispose();
  };

  g.add(shadow, sprite);
  g.userData.billboard = true;

  return g;
}
