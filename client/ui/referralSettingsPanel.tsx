// @ts-nocheck
/** @jsxImportSource tradjs/client */

function codeShareText(code: string) {
  return code ? `Share ${code}` : "Share code";
}

export function ReferralSettingsCard(props: any) {
  const status = props?.status || {};
  const codes = Array.isArray(status.codes) ? status.codes : [];
  const claim = status.claim || null;
  const defaults = status.defaults || { rewardAmount: 500, maxReward: 10000, maxUses: 250 };
  const busy = !!props?.busy;
  const draft = props?.draft || {};
  return <div className="settings-card wide referral-card">
    <div className="settings-card-head"><b>Referral gifts</b><span>{codes.length ? `${codes.length} code${codes.length === 1 ? "" : "s"}` : "No codes yet"}</span></div>
    <p className="settings-note">Create a code for new players. When they use it while naming their character, the coin gift is withdrawn from your purse and sent to them.</p>

    {claim ? <div className="referral-claim-ok">
      <b>Joined through {claim.code}</b>
      <span>{claim.message || `Gift received from ${claim.referrerName || "a sponsor"}.`}</span>
    </div> : <p className="settings-note">You have not used a referral code on this character.</p>}

    <div className="referral-create-grid">
      <label><span>Code</span><input data-input="referral-create-code" maxlength="32" value={String(draft.code || "").toUpperCase()} placeholder="AUTO" /></label>
      <label><span>Gift coins</span><input data-input="referral-create-amount" type="number" min="1" max={defaults.maxReward || 10000} step="1" value={Number(draft.rewardAmount || defaults.rewardAmount || 500)} /></label>
      <label><span>Uses</span><input data-input="referral-create-uses" type="number" min="1" max={defaults.maxUses || 250} step="1" value={Number(draft.maxUses || 1)} /></label>
      <label className="referral-note-input"><span>Note</span><input data-input="referral-create-note" maxlength="160" value={String(draft.note || "")} placeholder="Starter gift" /></label>
    </div>
    <button className="btn primary" data-click="referral-create" disabled={busy}>{busy ? "Creating…" : "Create referral code"}</button>

    <div className="referral-code-list">
      {codes.length ? codes.map((c: any) => <div className={"referral-code-row" + (Number(c.active || 0) ? "" : " off")}>
        <div><b>{c.code}</b><small>{Number(c.rewardAmount || 0)}🪙 · {Number(c.uses || 0)}/{Number(c.maxUses || 0) || "∞"} used</small></div>
        <div className="referral-code-actions"><button className="btn" data-click="referral-copy" data-code={c.code}>{codeShareText(c.code)}</button>{Number(c.active || 0) ? <button className="btn" data-click="referral-pause" data-code={c.code}>Pause</button> : null}</div>
      </div>) : <div className="empty-list">Create your first code to sponsor a new settler.</div>}
    </div>
  </div>;
}
