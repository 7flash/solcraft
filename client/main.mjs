import * as THREE from '/vendor/three.module.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const tradeEl = document.getElementById('trade');
const feedEl = document.getElementById('feed');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e8);
scene.fog = new THREE.Fog(0x87b8e8, 260, 820);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1600);
let camYaw = Math.PI * 0.78;
let camPitch = 0.58;
let camDist = 82;
let camDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

const hemi = new THREE.HemisphereLight(0xf8e6bd, 0x41506a, 1.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2cf, 1.7);
sun.position.set(120, 180, 80);
scene.add(sun);

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const shipMats = {
  player: new THREE.MeshLambertMaterial({ color: 0xd19b55 }),
  playerDark: new THREE.MeshLambertMaterial({ color: 0x7a4b28 }),
  balloon: new THREE.MeshLambertMaterial({ color: 0xdac18e }),
  enemy: new THREE.MeshLambertMaterial({ color: 0xb24b3f }),
  merchant: new THREE.MeshLambertMaterial({ color: 0x5790c8 }),
  friendly: new THREE.MeshLambertMaterial({ color: 0x65c780 }),
  glow: new THREE.MeshLambertMaterial({ color: 0x6affc8 }),
  cannon: new THREE.MeshLambertMaterial({ color: 0x25242a })
};
const bulletMat = new THREE.MeshLambertMaterial({ color: 0x1b1612 });
const lootMat = new THREE.MeshLambertMaterial({ color: 0xffd36f });
const cargoMat = new THREE.MeshLambertMaterial({ color: 0x8ef1ff });
const buildMat = new THREE.MeshLambertMaterial({ color: 0x68d887, vertexColors: false });
const claimCoreMat = new THREE.MeshLambertMaterial({ color: 0xff4b5d });

const islandMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const tmpObj = new THREE.Object3D();
const tmpColor = new THREE.Color();

let ws = null;
let myId = null;
let snapshot = null;
let selectedGoodNames = ['ore', 'food', 'aether'];
let connected = false;

const key = new Set();
const pressed = new Set();
let repulsePressed = false;
let firePressed = false;
let repulseVec = { x: 0, z: 1 };

const players = new Map();
const npcs = new Map();
const bullets = new Map();
const loot = new Map();
const islands = new Map();
const islandMeshes = new Map();
const buildMeshes = new Map();

const groundGrid = new THREE.GridHelper(1000, 50, 0x33516d, 0x476581);
groundGrid.position.y = -18;
scene.add(groundGrid);

const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), new THREE.MeshLambertMaterial({ color: 0x4b87b5, transparent: true, opacity: 0.18 }));
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = -22;
scene.add(ocean);

function hash32(a, b, c = 1337) {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519)) | 0;
  x = (x ^ (x >>> 13)) | 0;
  x = Math.imul(x, 1274126177);
  return (x ^ (x >>> 16)) >>> 0;
}
function rand01(seed) {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function addBox(group, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  group.add(m);
  return m;
}

function makeShipGroup(kind = 'player') {
  const g = new THREE.Group();
  const mat = kind === 'merchant' ? shipMats.merchant : kind === 'enemy' ? shipMats.enemy : shipMats.player;
  const dark = kind === 'merchant' ? shipMats.playerDark : kind === 'enemy' ? shipMats.playerDark : shipMats.playerDark;
  // hull voxels, local +Z is bow
  for (let z = -3; z <= 3; z++) {
    const w = z === 3 ? 1 : z === -3 ? 1 : 2;
    for (let x = -w; x <= w; x++) addBox(g, mat, x * 1.15, 0, z * 1.1, 0.95, 0.85, 0.95);
  }
  addBox(g, dark, 0, 0.55, 0.8, 2.8, 0.75, 1.9);
  addBox(g, shipMats.cannon, 0, 0.5, 4.35, 0.55, 0.55, 2.1);
  addBox(g, shipMats.glow, 0, 0.7, 5.65, 0.55, 0.55, 0.55);
  addBox(g, shipMats.balloon, 0, 3.15, -0.9, 4.7, 1.2, 2.7);
  addBox(g, shipMats.balloon, -2.6, 2.7, -0.8, 1.1, 0.8, 2.1);
  addBox(g, shipMats.balloon, 2.6, 2.7, -0.8, 1.1, 0.8, 2.1);
  addBox(g, mat, -3.0, -0.05, -1.2, 1.9, 0.35, 3.2);
  addBox(g, mat, 3.0, -0.05, -1.2, 1.9, 0.35, 3.2);
  addBox(g, dark, 0, 0.1, -4.15, 2.5, 0.45, 0.9);
  addBox(g, shipMats.glow, 0, 0.1, -5.1, 1.2, 0.35, 0.35);
  g.scale.setScalar(kind === 'player' ? 1.35 : 1.1);
  scene.add(g);
  return g;
}

function makeBullet() {
  const m = new THREE.Mesh(boxGeo, bulletMat);
  m.scale.set(1.6, 1.6, 1.6);
  scene.add(m);
  return m;
}
function makeLoot(kind) {
  const m = new THREE.Mesh(boxGeo, kind === 'cargo' ? cargoMat : lootMat);
  m.scale.set(1.8, 1.8, 1.8);
  scene.add(m);
  return m;
}

function makeIslandBlocks(isl) {
  const blocks = [];
  const step = 4;
  const r = Math.max(5, Math.floor(isl.radius / step));
  for (let x = -r; x <= r; x++) {
    for (let z = -r; z <= r; z++) {
      const rr = Math.sqrt(x * x + z * z) / r;
      const n = rand01(hash32(x + isl.seed, z - isl.seed, isl.seed));
      if (rr > 1.02 + n * 0.08) continue;
      const top = Math.floor((1 - rr) * isl.height + 1 + n * 2);
      for (let y = -Math.max(2, isl.height - top); y <= top; y++) {
        const shell = y === top || y <= -2 || Math.abs(rr - 1) < 0.16 || n > 0.82;
        if (!shell) continue;
        let color = 0x8c633e;
        if (y === top) color = 0x4d9252;
        if (n > 0.86 && y > -1 && y < top) color = 0xc98a42;
        if (isl.owner === 'pirate' && y === top && n > 0.75) color = 0x8e3340;
        if (isl.owner && isl.owner.startsWith('clan') && y === top && n > 0.72) color = 0x4aa96c;
        blocks.push({ x: isl.x + x * step, y: y * step, z: isl.z + z * step, s: step * 0.96, color });
      }
    }
  }
  // claim/base core
  blocks.push({ x: isl.x, y: (isl.height + 1) * 4, z: isl.z, s: 5.2, color: isl.owner === 'pirate' ? 0xff3350 : isl.owner?.startsWith('clan') ? 0x66ff8a : 0xffd36f });
  if (isl.baseLevel > 0) {
    for (let i = 0; i < isl.baseLevel * 4; i++) {
      const a = i * Math.PI * 0.5;
      blocks.push({ x: isl.x + Math.cos(a) * 8, y: (isl.height + 2 + i % 2) * 4, z: isl.z + Math.sin(a) * 8, s: 4.0, color: 0x66c789 });
    }
  }
  return blocks.slice(0, 420);
}

function createInstancedBlocks(blocks, material = islandMaterial) {
  const mesh = new THREE.InstancedMesh(boxGeo, material, Math.max(1, blocks.length));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    tmpObj.position.set(b.x, b.y, b.z);
    tmpObj.rotation.set(0, 0, 0);
    tmpObj.scale.set(b.s, b.s, b.s);
    tmpObj.updateMatrix();
    mesh.setMatrixAt(i, tmpObj.matrix);
    if (material.vertexColors !== false) mesh.setColorAt(i, tmpColor.setHex(b.color || 0xffffff));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function updateIslands(list) {
  const live = new Set();
  for (const isl of list) {
    live.add(isl.id);
    const sig = `${isl.owner}|${isl.baseLevel}|${isl.built?.length || 0}`;
    const old = islands.get(isl.id);
    islands.set(isl.id, { ...isl, sig });
    if (!old || old.sig !== sig || !islandMeshes.has(isl.id)) {
      if (islandMeshes.has(isl.id)) { scene.remove(islandMeshes.get(isl.id)); islandMeshes.get(isl.id).dispose?.(); }
      islandMeshes.set(isl.id, createInstancedBlocks(makeIslandBlocks(isl)));
    }
    const bid = `b:${isl.id}`;
    const built = (isl.built || []).map(b => ({ x: isl.x + b.x, y: b.y * 1, z: isl.z + b.z, s: 3.4, color: 0x75d88a }));
    if (!buildMeshes.has(bid) || buildMeshes.get(bid).count !== built.length) {
      if (buildMeshes.has(bid)) scene.remove(buildMeshes.get(bid));
      if (built.length > 0) buildMeshes.set(bid, createInstancedBlocks(built, new THREE.MeshLambertMaterial({ color: 0x75d88a })));
    }
  }
  for (const [id, mesh] of islandMeshes) if (!live.has(id)) { scene.remove(mesh); islandMeshes.delete(id); islands.delete(id); }
}

function syncShipMap(map, list, makeKind) {
  const live = new Set();
  for (const e of list) {
    live.add(e.id);
    let g = map.get(e.id);
    if (!g) { g = makeShipGroup(makeKind(e)); map.set(e.id, g); }
    g.userData.tx = e.x; g.userData.ty = e.y ?? 18; g.userData.tz = e.z; g.userData.tyaw = e.yaw || 0; g.userData.troll = e.roll || 0;
    if (!g.userData.initialized) {
      g.position.set(e.x, e.y ?? 18, e.z); g.rotation.y = e.yaw || 0; g.userData.initialized = true;
    }
  }
  for (const [id, g] of map) if (!live.has(id)) { scene.remove(g); map.delete(id); }
}

function syncSimpleMap(map, list, maker) {
  const live = new Set();
  for (const e of list) {
    live.add(e.id);
    let m = map.get(e.id);
    if (!m) { m = maker(e.kind); map.set(e.id, m); }
    m.userData.tx = e.x; m.userData.ty = e.y ?? 18; m.userData.tz = e.z;
    if (!m.userData.initialized) { m.position.set(e.x, e.y ?? 18, e.z); m.userData.initialized = true; }
  }
  for (const [id, m] of map) if (!live.has(id)) { scene.remove(m); map.delete(id); }
}

function animateObjects(dt) {
  const t = clamp(dt * 10, 0, 1);
  for (const map of [players, npcs]) for (const g of map.values()) {
    g.position.x = lerp(g.position.x, g.userData.tx, t);
    g.position.y = lerp(g.position.y, g.userData.ty, t);
    g.position.z = lerp(g.position.z, g.userData.tz, t);
    g.rotation.y = angleLerp(g.rotation.y, g.userData.tyaw, t);
    g.rotation.z = lerp(g.rotation.z, -(g.userData.troll || 0), t);
  }
  for (const map of [bullets, loot]) for (const m of map.values()) {
    m.position.x = lerp(m.position.x, m.userData.tx, t);
    m.position.y = lerp(m.position.y, m.userData.ty, t);
    m.position.z = lerp(m.position.z, m.userData.tz, t);
    m.rotation.x += dt * 4; m.rotation.y += dt * 3;
  }
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?name=${encodeURIComponent(localStorage.aetherName || '')}`);
  ws.addEventListener('open', () => { connected = true; statusEl.textContent = 'connected'; });
  ws.addEventListener('close', () => { connected = false; statusEl.textContent = 'disconnected, retrying...'; setTimeout(connect, 1000); });
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.t === 'welcome') { myId = msg.id; statusEl.textContent = `captain ${myId.slice(0, 4)}`; }
    if (msg.t === 'snapshot') {
      snapshot = msg;
      selectedGoodNames = msg.goods || selectedGoodNames;
      syncShipMap(players, msg.players, e => e.id === myId ? 'player' : 'player');
      syncShipMap(npcs, msg.npcs, e => e.kind === 'merchant' ? 'merchant' : 'enemy');
      syncSimpleMap(bullets, msg.bullets, makeBullet);
      syncSimpleMap(loot, msg.loot, makeLoot);
      updateIslands(msg.islands || []);
      for (const evn of msg.events || []) addFeed(evn.text || evn.type);
    }
  });
}
connect();

function addFeed(text) {
  const div = document.createElement('div');
  div.className = 'feedItem';
  div.textContent = text;
  feedEl.prepend(div);
  setTimeout(() => div.remove(), 4300);
}

function sendInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const msg = {
    t: 'input',
    w: key.has('KeyW'), s: key.has('KeyS'), a: key.has('KeyA'), d: key.has('KeyD'), shift: key.has('ShiftLeft') || key.has('ShiftRight'),
    harvest: key.has('Space'), build: key.has('KeyQ'), claim: key.has('KeyX'),
    landPressed: pressed.has('KeyL'), tradeNextPressed: pressed.has('Tab'), buyPressed: pressed.has('KeyB'), sellPressed: pressed.has('KeyN'),
    repulsePressed, firePressed,
    repulseX: repulseVec.x, repulseZ: repulseVec.z
  };
  ws.send(JSON.stringify(msg));
  pressed.clear(); repulsePressed = false; firePressed = false;
}
setInterval(sendInput, 1000 / 30);

window.addEventListener('keydown', e => {
  if (!key.has(e.code)) pressed.add(e.code);
  key.add(e.code);
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => key.delete(e.code));
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('mousedown', e => {
  if (e.button === 1) { camDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; e.preventDefault(); }
  if (e.button === 0) {
    repulsePressed = true;
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const nz = (0.55 - e.clientY / window.innerHeight) * 2;
    const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(-1);
    const dir = new THREE.Vector3().addScaledVector(right, nx).addScaledVector(forward, nz || 0.45).normalize();
    repulseVec = { x: dir.x, z: dir.z };
  }
  if (e.button === 2) firePressed = true;
});
window.addEventListener('mouseup', e => { if (e.button === 1) camDragging = false; });
window.addEventListener('mousemove', e => {
  if (camDragging) {
    const dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    camYaw -= dx * 0.006;
    camPitch = clamp(camPitch + dy * 0.004, 0.18, 1.18);
  }
});
window.addEventListener('wheel', e => { camDist = clamp(camDist + e.deltaY * 0.06, 38, 160); });
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

function updateCamera(dt) {
  const me = players.get(myId);
  if (!me) return;
  const target = me.position.clone();
  target.y += 5;
  const off = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch) * camDist,
    Math.sin(camPitch) * camDist,
    Math.cos(camYaw) * Math.cos(camPitch) * camDist
  );
  const desired = target.clone().add(off);
  camera.position.lerp(desired, clamp(dt * 5.5, 0, 1));
  camera.lookAt(target);
}

function updateHud() {
  if (!snapshot) return;
  const me = snapshot.players.find(p => p.id === myId);
  if (!me) return;
  const speed = Math.hypot(me.vx || 0, me.vz || 0);
  statsEl.innerHTML = `
    Hull: ${Math.max(0, me.hull | 0)} / ${me.hullMax | 0}<br>
    Energy: ${me.energy | 0}<br>
    Scrap: ${me.scrap | 0}<br>
    Speed: ${speed.toFixed(1)}<br>
    State: ${me.landed ? 'LANDED' : 'FLYING'}<br>
    Kills: ${me.kills} &nbsp; Deaths: ${me.deaths} &nbsp; Piracy: ${me.piracy}<br>
    Players: ${snapshot.players.length} &nbsp; NPCs nearby: ${snapshot.npcs.length}
  `;
  const good = selectedGoodNames[me.selectedGood || 0] || 'ore';
  const cargoTotal = Object.values(me.cargo || {}).reduce((a, b) => a + b, 0);
  tradeEl.innerHTML = `
    Selected cargo: <b>${good.toUpperCase()}</b> &nbsp; [Tab]<br>
    Cargo: ${cargoTotal} / 18 &nbsp; ore:${me.cargo.ore || 0} food:${me.cargo.food || 0} aether:${me.cargo.aether || 0}<br>
    Land on islands: B buy / N sell / Q build / X claim
  `;
}

let last = performance.now();
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  animateObjects(dt);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);