export type SkillRow = {
  id: string;
  glyph: string;
  name: string;
  blurb: string;
  level: number;
  max: number;
  xp: number;
  xpNeeded: number;
  pct: number;
};

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
}

export function skillsPanelRows(player: any, skills: readonly any[], skillLevel: (skills: any, id: string) => number): SkillRow[] {
  const xp = player?.skillXp || {};
  return (skills || []).map((sk: any) => {
    const level = Math.max(0, Number(skillLevel(player?.skills || {}, sk.id)) || 0);
    const xpNeeded = Math.max(1, 25 * (level + 1));
    const curXp = Math.max(0, Math.min(xpNeeded, Number(xp[sk.id] || 0)));
    return {
      id: String(sk.id || ""),
      glyph: sk.glyph || "★",
      name: sk.name || sk.id || "Skill",
      blurb: sk.blurb || "",
      level,
      max: Number(sk.max || 0) || 0,
      xp: curXp,
      xpNeeded,
      pct: clampPct(100 * curXp / xpNeeded),
    };
  });
}
