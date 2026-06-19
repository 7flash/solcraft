// @ts-nocheck
/** @jsxImportSource tradjs/client */

/**
 * The minimap corner is intentionally kept clean. Game-wide controls now live
 * in the Esc pause/settings panel so the minimap can stay a pure world affordance.
 */
export function TopChromeView(props: any) {
  const { playing = false } = props;
  if (!playing) return <div />;
  return <div className="chrome-actions ui2-top-chrome is-empty" data-ui-region="top-chrome" aria-hidden="true" />;
}
