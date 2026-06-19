const DEFAULT_MAX_HP = 100;

export type PlayerModalInput = {
  player?: any;
  target?: any;
  worldPlayer?: any;
  gearById?: Record<string, any>;
};

function chebyshev(ax: any, az: any, bx: any, bz: any) {
  return Math.max(Math.abs(Number(ax) - Number(bx)), Math.abs(Number(az) - Number(bz)));
}

function hexFromColorNumber(value: any, fallback = "#f29c72") {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return `#${Math.max(0, Math.min(0xffffff, Math.trunc(n))).toString(16).padStart(6, "0")}`;
}

export function gearStatFromEquip(equip: any = {}, gearById: Record<string, any> = {}, stat: "atk" | "def" | "spd" = "atk") {
  let total = 0;
  for (const id of Object.values(equip || {})) {
    if (!id) continue;
    total += Number(gearById[String(id)]?.[stat] || 0);
  }
  return total;
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
    attack: gearStatFromEquip(q.equip || {}, input.gearById || {}, "atk"),
    defense: gearStatFromEquip(q.equip || {}, input.gearById || {}, "def"),
    adjacent,
    bodyHex: hexFromColorNumber(q.body, "#f29c72"),
    spectator: !!q.spectator,
  };
}

export function equippedGearRows(target: any, slots: readonly string[], slotLabels: Record<string, string>, gearById: Record<string, any>) {
  return slots.map((slot) => {
    const id = target?.equip?.[slot];
    const gear = id ? gearById[id] : null;
    return {
      slot,
      label: slotLabels[slot] || slot,
      text: gear ? `${gear.glyph || ""} ${gear.name || id}`.trim() : "—",
      empty: !gear,
    };
  });
}
