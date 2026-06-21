// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { t } from "../i18n";
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
      <span className="guide-chip ok">{t("guide.summaryComplete", "{done}/{total} complete", { done: summary.done, total: summary.total })}</span>
      <span className="guide-chip">{t("guide.summaryClaimed", "{claimed} claimed", { claimed: summary.claimed })}</span>
      {summary.claimable ? <span className="guide-chip wait">{t("guide.summaryRewardsReady", "{count} rewards ready", { count: summary.claimable })}</span> : null}
      <div className="meter"><i style={{ width: `${summary.pct}%` }} /></div>
    </div>
    <div className="guide-tabs">
      {tabs.map(([id, label]) => <button key={id} className={activeTab === id ? "btn primary" : "btn"} onClick={() => onTab(id)}>{label} {guideTabCount(rows, id)}</button>)}
    </div>
    <div className="guide-list">
      {visible.length ? visible.map((row) => <GuidePanelCard row={row} onClaim={onClaim} />) : <div className="tiny">{t("guide.emptySection", "No cards in this section yet.")}</div>}
    </div>
  </>;
}

function GuidePanelCard({ row, onClaim }: any) {
  const status = row.claimed ? t("guide.statusClaimed", "Claimed") : row.done ? t("guide.statusReady", "Ready") : t("guide.statusTodo", "To do");
  return <div className={"guide-card" + (row.done ? " done" : "") + (row.claimed ? " claimed" : "")}>
    <div className="guide-glyph">{row.glyph || "◇"}</div>
    <div>
      <h4>{row.title}</h4>
      <p className="tiny">{row.text}</p>
      <p className="guide-detail">{row.detail}</p>
      <div className="guide-meta">
        <span className={"guide-chip " + (row.done ? "ok" : "wait")}>{status}</span>
        <span className="guide-chip">{row.rewardText}</span>
        {row.done && !row.claimed ? <button className="btn primary" onClick={() => onClaim(row.id)}>{t("guide.claim", "Claim")}</button> : null}
        {row.claimed ? <span className="guide-chip ok">{t("guide.reward", "✓ reward")}</span> : null}
      </div>
    </div>
  </div>;
}
