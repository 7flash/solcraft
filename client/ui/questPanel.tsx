// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { guideSummaryForRows, guideTabCount, visibleGuideRows } from "./questPanelModel";

export function QuestPanelView(props: any) {
  const rows = props.rows || [];
  const tabs = props.tabs || [];
  const activeTab = props.activeTab || "actions";
  const onTab = props.onTab || (() => {});
  const onClaim = props.onClaim || (() => {});
  const summary = guideSummaryForRows(rows);
  const visible = visibleGuideRows(rows, activeTab);

  return <>
    <div className="guide-summary">
      <span className="guide-chip ok">{summary.done}/{summary.total} complete</span>
      <span className="guide-chip">{summary.claimed} claimed</span>
      {summary.claimable ? <span className="guide-chip wait">{summary.claimable} rewards ready</span> : null}
      <div className="meter"><i style={{ width: `${summary.pct}%` }} /></div>
    </div>
    <div className="guide-tabs">
      {tabs.map(([id, label]) => <button key={id} className={activeTab === id ? "btn primary" : "btn"} onClick={() => onTab(id)}>{label} {guideTabCount(rows, id)}</button>)}
    </div>
    <div className="guide-list">
      {visible.length ? visible.map((row) => <GuidePanelCard row={row} onClaim={onClaim} />) : <div className="tiny">No cards in this section yet.</div>}
    </div>
  </>;
}

function GuidePanelCard({ row, onClaim }: any) {
  const status = row.claimed ? "Claimed" : row.done ? "Ready" : "To do";
  return <div className={"guide-card" + (row.done ? " done" : "") + (row.claimed ? " claimed" : "")}>
    <div className="guide-glyph">{row.glyph || "◇"}</div>
    <div>
      <h4>{row.title}</h4>
      <p className="tiny">{row.text}</p>
      <p className="guide-detail">{row.detail}</p>
      <div className="guide-meta">
        <span className={"guide-chip " + (row.done ? "ok" : "wait")}>{status}</span>
        <span className="guide-chip">{row.rewardText}</span>
        {row.done && !row.claimed ? <button className="btn primary" onClick={() => onClaim(row.id)}>Claim</button> : null}
        {row.claimed ? <span className="guide-chip ok">✓ reward</span> : null}
      </div>
    </div>
  </div>;
}
