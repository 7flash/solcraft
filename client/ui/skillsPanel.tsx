// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { SKILLS, skillLvl } from "@server/shared";
import { skillsPanelRows } from "./skillsPanelModel";

export function SkillsPanelView(props: any) {
  const m = props.player;
  if (!m) return <div />;
  const rows = skillsPanelRows(m, SKILLS as any, skillLvl as any);
  return <div className="mini-list">
    {rows.map((row) => <div className="skill-mini">
      <div className="utility-row"><b>{row.glyph} {row.name}</b><span className="stat">Lv {row.level}/{row.max}</span></div>
      <div className="mini-bar"><i style={{ width: `${row.pct.toFixed(0)}%` }} /></div>
      <div className="tiny">{row.blurb}</div>
    </div>)}
  </div>;
}
