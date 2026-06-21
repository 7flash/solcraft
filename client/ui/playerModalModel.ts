const DEFAULT_MAX_HP = 100;

export type PlayerModalInput = {
  player?: any;
  target?: any;
  worldPlayer?: any;
};

function chebyshev(ax: any, az: any, bx: any, bz: any) {
  return Math.max(Math.abs(Number(ax) - Number(bx)), Math.abs(Number(az) - Number(bz)));
}

function hexFromColorNumber(value: any, fallback = "#f29c72") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `#${Math.max(0, Math.min(0xffffff, Math.trunc(n))).toString(16).padStart(6, "0")}`;
}

export function playerModalViewModel(input: PlayerModalInput = {}) {
  const q = input.target || {};
  const me = input.worldPlayer || input.player || {};
  const adjacent = Number.isFinite(Number(q.x)) && Number.isFinite(Number(q.z)) && Number.isFinite(Number(me.x)) && Number.isFinite(Number(me.z))
    ? chebyshev(q.x, q.z, me.x, me.z) <= 2
    : false;
  return {
    name: String(q.name || "Player"),
    level: Number(q.level || 1) || 1,
    hpNow: Math.max(0, Math.ceil(Number(q.hp ?? DEFAULT_MAX_HP))),
    hpMax: DEFAULT_MAX_HP,
    adjacent,
    bodyHex: hexFromColorNumber(q.body, "#f29c72"),
    spectator: !!q.spectator,
  };
}

export function gearStatFromEquip() { return 0; }
export function equippedGearRows() { return []; }
