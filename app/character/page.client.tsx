// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { render } from "tradjs/client";
import * as THREE from "three";
import {
  buildDollBillboard,
  dollTexture,
  type DollHeldTool,
} from "../../client/dolls";
import {
  defaultCharacterProfile,
  loadCharacterProfile,
  saveCharacterProfile,
  type CharacterProfile,
} from "../../client/dollProfile";

const rootId = "world-character-lab";
let mounted = false;

const PART_ROWS = [
  "head",
  "torso",
  "legs",
  "back",
];

const PART_LABELS: Record<string, string> = {
  head: "Head / alien",
  torso: "Outfit",
  legs: "Lower body",
  back: "Back item",
};

const TOOL_OPTIONS: DollHeldTool[] = [
  "none",
  "axe",
  "pickaxe",
  "staff",
  "sword",
  "hammer",
  "shovel",
  "spear",
  "sickle",
];

const COLOR_KEYS = ["skin", "hair", "primaryCloth", "secondaryCloth", "leather", "metal"];
const COLOR_PRESETS = [
  { id: "solana", name: "Solana", skin: "#f0b887", hair: "#f4f0dd", primaryCloth: "#31507d", secondaryCloth: "#14f195", leather: "#6a4124", metal: "#b8c2cc" },
  { id: "forest", name: "Forest", skin: "#c68f63", hair: "#2f2118", primaryCloth: "#2f6b46", secondaryCloth: "#8fbf6a", leather: "#5a3a22", metal: "#b0b9b5" },
  { id: "sunforge", name: "Sunforge", skin: "#a96b4d", hair: "#f2c35b", primaryCloth: "#8e3d26", secondaryCloth: "#e0b54a", leather: "#6a3e20", metal: "#ffe0a6" },
  { id: "tide", name: "Tide", skin: "#8cc7d8", hair: "#17384a", primaryCloth: "#1e5f86", secondaryCloth: "#7dcfe8", leather: "#38516a", metal: "#d6f2ff" },
  { id: "violet", name: "Violet", skin: "#d5a5ff", hair: "#33204a", primaryCloth: "#56359b", secondaryCloth: "#9945ff", leather: "#4b315f", metal: "#dec8ff" },
  { id: "rose", name: "Rose", skin: "#f0b8a0", hair: "#5b2434", primaryCloth: "#8f3049", secondaryCloth: "#f08bb0", leather: "#6a3b35", metal: "#ffd5dc" },
  { id: "ash", name: "Ash", skin: "#d2c4ad", hair: "#2a2e35", primaryCloth: "#4a4f5a", secondaryCloth: "#9aa3ad", leather: "#37312d", metal: "#cbd1d8" },
  { id: "mint", name: "Mint", skin: "#f2d2ad", hair: "#0f332d", primaryCloth: "#146b5a", secondaryCloth: "#14f195", leather: "#4b3a22", metal: "#dbfff1" },
];
function normHex(value: any) {
  const s = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}
function presetActive(palette: any, preset: any) {
  return COLOR_KEYS.every((k) => normHex(palette?.[k]) === normHex(preset[k]));
}

function clamp(n: number, min = 0, max = 7) {
  return Math.max(min, Math.min(max, Math.trunc(Number(n) || 0)));
}

export default function mount() {
  const root = document.getElementById(rootId);
  if (!root || mounted) return;
  mounted = true;

  root.className = "character-lab";
  root.replaceChildren();

  const worldEl = document.createElement("div");
  worldEl.className = "character-world";

  const uiEl = document.createElement("div");
  uiEl.className = "character-ui";

  root.append(worldEl, uiEl);

  const st: {
    profile: CharacterProfile;
    heldTool: DollHeldTool;
    character: THREE.Object3D | null;
    status: string;
  } = {
    profile: loadCharacterProfile(),
    heldTool: "none",
    character: null,
    status: "Loaded local character profile.",
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101a);

  const camera = new THREE.OrthographicCamera(-3, 3, 2.4, -2.4, 0.1, 100);
  camera.position.set(3.6, 3.2, 4.8);
  camera.lookAt(0, 0.58, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  worldEl.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x182614, 1.15));

  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  scene.add(key);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x152217,
    roughness: 1,
    metalness: 0,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(7, 7, 0x14f195, 0x2a3b34);
  grid.position.y = 0.006;
  scene.add(grid);

  function resize() {
    const w = worldEl.clientWidth || window.innerWidth;
    const h = worldEl.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);

    const aspect = w / Math.max(1, h);
    const zoom = 2.35;
    camera.left = -zoom * aspect;
    camera.right = zoom * aspect;
    camera.top = zoom;
    camera.bottom = -zoom;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  let saveT: any = null;
  let rebuildT: any = null;

  function currentDollConfig() {
    return {
      dollParts: st.profile.parts,
      palette: st.profile.palette,
      heldTool: st.heldTool,
    };
  }

  function rebuildCharacter() {
    const cfg = currentDollConfig();
    if (!st.character) {
      st.character = buildDollBillboard(cfg);
      st.character.position.set(0, 0.08, 0);
      st.character.scale.setScalar(1.55);
      scene.add(st.character);
      return;
    }

    // Keep the existing sprite mounted while changing parts/colors. Replacing the
    // whole object caused visible blinking while the async atlas texture resolved.
    const sprite = st.character.children.find((obj: any) => obj?.isSprite) as any;
    if (sprite?.material) {
      sprite.material.map = dollTexture(cfg, 384);
      sprite.material.needsUpdate = true;
      st.character.userData = { dollBillboard: true, config: cfg };
    }
  }

  function queueSave() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { st.profile = saveCharacterProfile(st.profile); }, 180);
  }

  function saveAndRebuild(msg = "Saved character locally.") {
    st.status = msg;
    queueSave();
    clearTimeout(rebuildT);
    rebuildT = setTimeout(() => rebuildCharacter(), 30);
    paint();
  }

  function setPart(key: string, value: number) {
    const v = clamp(value);
    st.profile.parts = {
      ...st.profile.parts,
      [key]: v,
    };

    if (key === "torso") st.profile.outfit.torso = v;
    if (key === "legs") st.profile.outfit.legs = v;
    if (key === "back") st.profile.outfit.back = v;
    if (key === "hat") st.profile.outfit.hat = v;

    saveAndRebuild(`Saved ${key} ${v}.`);
  }

  function setColor(key: string, value: string) {
    st.profile.palette = {
      ...st.profile.palette,
      [key]: value,
    };
    saveAndRebuild(`Saved ${key} color.`);
  }

  function applyColorPreset(id: string) {
    const preset = COLOR_PRESETS.find((p) => p.id === id) || COLOR_PRESETS[0];
    const next: any = {};
    for (const k of COLOR_KEYS) next[k] = (preset as any)[k];
    st.profile.palette = { ...st.profile.palette, ...next };
    st.profile.parts = { ...st.profile.parts, hair: 0, tool: 0, hat: 0, showHat: false } as any;
    (st.profile as any).showHat = false;
    saveAndRebuild(`Applied ${preset.name} colors.`);
  }

  function setFlag(key: "showHat" | "showBack", value: boolean) {
    st.profile[key] = value;
    st.profile.parts = {
      ...st.profile.parts,
      showHat: key === "showHat" ? value : st.profile.showHat,
      showBack: key === "showBack" ? value : st.profile.showBack,
    };
    saveAndRebuild(`Saved ${key}.`);
  }

  function randomize() {
    const pick = () => Math.floor(Math.random() * 8);
    st.profile.parts = {
      ...st.profile.parts,
      skin: pick(),
      hair: pick(),
      head: pick(),
      torso: pick(),
      legs: pick(),
      back: pick(),
    };
    st.profile.outfit = {
      torso: st.profile.parts.torso,
      legs: st.profile.parts.legs,
      back: st.profile.parts.back,
    };
    saveAndRebuild("Randomized character.");
  }

  function reset() {
    localStorage.removeItem("world-of-solcrafts:character:v1");
    localStorage.removeItem("solcraft:character:v1");
    localStorage.removeItem("world-of-solcrafts:doll:parts:v1");
    localStorage.removeItem("solcraft:doll:parts:v1");
    st.profile = defaultCharacterProfile();
    st.profile.parts = { ...st.profile.parts, hair: 0, tool: 0, hat: 0, showHat: false } as any;
    st.heldTool = "none";
    saveAndRebuild("Reset character.");
  }

  function onDelegatedClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement | null)?.closest?.("[data-character-action]") as HTMLElement | null;
    if (!el || !uiEl.contains(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = el.dataset.characterAction || "";
    if (action === "save") return saveAndRebuild("Saved character locally.");
    if (action === "randomize") return randomize();
    if (action === "reset") return reset();
    if (action === "preset") return applyColorPreset(String(el.dataset.preset || "solana"));
  }

  function onDelegatedInput(ev: Event) {
    const input = (ev.target as HTMLElement | null)?.closest?.("[data-character-input]") as HTMLInputElement | null;
    if (!input || !uiEl.contains(input)) return;
    const kind = String(input.dataset.characterInput || "");
    if (kind === "part") return setPart(String(input.dataset.key || "head"), Number(input.value));
    if (kind === "color") return setColor(String(input.dataset.key || "hair"), input.value);
  }

  function onDelegatedChange(ev: Event) {
    const input = (ev.target as HTMLElement | null)?.closest?.("[data-character-input]") as HTMLInputElement | HTMLSelectElement | null;
    if (!input || !uiEl.contains(input)) return;
    const kind = String((input as any).dataset.characterInput || "");
    if (kind === "show-back") return setFlag("showBack", !!(input as HTMLInputElement).checked);
    if (kind === "held-tool") {
      st.heldTool = (input as HTMLSelectElement).value as DollHeldTool;
      st.status = `Previewing ${st.heldTool}.`;
      rebuildCharacter();
      paint();
    }
  }

  uiEl.addEventListener("click", onDelegatedClick, true);
  uiEl.addEventListener("input", onDelegatedInput, true);
  uiEl.addEventListener("change", onDelegatedChange, true);

  function ControlsView() {
    const p = st.profile.parts;
    const pal = st.profile.palette;

    return <section>
      <p className="kicker">World of SolCrafts</p>
      <h1>Character Lab</h1>
      <p>Customize the player-facing billboard avatar with preset looks only. Hair style, hats, and tool silhouettes are hidden here so gameplay tools control the silhouette.</p>

      <div className="actions">
        <button className="primary" data-character-action="save">Save</button>
        <button data-character-action="randomize">Randomize</button>
        <button data-character-action="reset">Reset</button>
      </div>

      <h2>Parts</h2>
      {PART_ROWS.map((key) =>
        <div className="row">
          <label>{PART_LABELS[key] || key}</label>
          <input
            type="range"
            min="0"
            max="7"
            value={p[key]}
            data-character-input="part"
            data-key={key}
          />
          <b>{p[key]}</b>
        </div>
      )}

      <div className="check">
        <input id="show-back" type="checkbox" checked={!!st.profile.showBack} data-character-input="show-back" />
        <label for="show-back">show back item</label>
      </div>

      <h2>Color combinations</h2>
      <div className="preset-grid">
        {COLOR_PRESETS.map((preset) => {
          const on = presetActive(pal, preset);
          return <button className={"preset-card" + (on ? " on" : "")} data-character-action="preset" data-preset={preset.id} style={{ "--p1": preset.primaryCloth, "--p2": preset.secondaryCloth }}>
            <b>{preset.name}</b>
            <span className="preset-dots"><i style={{ background: preset.skin }} /><i style={{ background: preset.primaryCloth }} /><i style={{ background: preset.secondaryCloth }} /><i style={{ background: preset.leather }} /><i style={{ background: preset.metal }} /></span>
          </button>;
        })}
      </div>

      <div className="status">{st.status}</div>
      <div className="help">{`This page saves:
localStorage["world-of-solcrafts:character:v1"]

It also syncs the older Doll compositor parts storage so the main game can reuse the same appearance later.

Color fine-tuning, hair style selection, hats, and tool silhouette controls are intentionally hidden. Gameplay equipment should decide tools.`}</div>
    </section>;
  }

  function paint() {
    render(ControlsView(), uiEl);
  }

  function loop(t: number) {
    if (st.character) {
      st.character.rotation.y = Math.sin(t * 0.00055) * 0.12;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  rebuildCharacter();
  paint();
  requestAnimationFrame(loop);
}