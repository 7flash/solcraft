// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { UtilityShell } from "./utilityShell";
import { moreTileClass } from "./utilityPanelModel";

export function MorePanelView(props: any) {
  const { groups = [], activePanel = "" } = props;
  return <UtilityShell className="more-pop" title="More" sub="Secondary features stay here so the primary bar remains focused on move, gather, claim, build, and use.">
    {groups.map((group) => <div className="more-group" data-group={group.id}>
      <div className="more-group-head"><b>{group.title}</b><span>{group.text}</span></div>
      <div className="more-grid">
        {group.items.map((item) => <button className={moreTileClass(item, activePanel)} data-click={item.click} data-panel={item.panel || ""} data-tip-title={item.label} data-tip-body={item.text}>
          <span className="more-glyph">{item.glyph}</span>
          <span className="more-copy"><b>{item.label}</b><small>{item.text}</small></span>
        </button>)}
      </div>
    </div>)}
  </UtilityShell>;
}
