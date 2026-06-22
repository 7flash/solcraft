// @ts-nocheck
/** @jsxImportSource tradjs/client */

export function ReferralSignupField(props: any) {
  const code = String(props?.code || "").toUpperCase();
  const disabled = !!props?.disabled;
  return <label className="profile-field referral-signup-field">
    <span>Referral / promo code <em>optional</em></span>
    <input
      type="text"
      inputMode="latin"
      autocomplete="off"
      spellcheck={false}
      maxlength="32"
      placeholder="IGOR-START"
      value={code}
      disabled={disabled}
      data-input="referral-code"
    />
    <small>Use a code while creating your character to receive its sponsor gift. One code per character.</small>
  </label>;
}
