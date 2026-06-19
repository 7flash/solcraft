export type GuideRow = {
  id: string;
  category: string;
  glyph: string;
  title: string;
  text?: string;
  detail?: string;
  rewardText: string;
  done: boolean;
  claimed: boolean;
};

export function normalizeGuideRows(rows: any[], fallbackRows: any[] = []): GuideRow[] {
  const source = Array.isArray(rows) && rows.length ? rows : (Array.isArray(fallbackRows) ? fallbackRows : []);
  return source.map((r: any) => ({
    ...r,
    id: String(r?.id || ""),
    category: String(r?.category || "actions"),
    glyph: String(r?.glyph || "◇"),
    title: String(r?.title || r?.id || "Guide card"),
    text: String(r?.text || ""),
    detail: String(r?.detail || ""),
    rewardText: String(r?.rewardText || "Guide reward"),
    done: !!r?.done,
    claimed: !!r?.claimed,
  }));
}

export function visibleGuideRows(rows: GuideRow[], tab: string) {
  const active = String(tab || "actions");
  if (active === "done") return rows.filter((r) => r.done);
  return rows.filter((r) => r.category === active);
}

export function guideTabCount(rows: GuideRow[], tab: string) {
  return visibleGuideRows(rows, tab).length;
}

export function guideSummaryForRows(rows: GuideRow[]) {
  const total = rows.length;
  const done = rows.filter((r) => r.done).length;
  const claimed = rows.filter((r) => r.claimed).length;
  const claimable = rows.filter((r) => r.done && !r.claimed).length;
  return { rows, total, done, claimed, claimable, pct: total ? Math.round(done * 100 / total) : 100 };
}
