// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function ReferralSignupField(props: any) {
  const code = String(props?.code || "").toUpperCase();
  const disabled = !!props?.disabled;
  return <label className="profile-field referral-signup-field">
    <span>Invite code <em>optional</em></span>
    <input
      type="text"
      inputMode="latin"
      autocomplete="off"
      spellcheck={false}
      maxlength="32"
      placeholder="Enter invite code"
      value={code}
      disabled={disabled}
      data-input="referral-code"
    />
    <small>Enter an invite code while creating your character. Some alpha codes unlock a one-of-one character design. One code per character.</small>
  </label>;
}