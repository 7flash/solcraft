// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { topChromeButtons } from "./topChromeModel";

function FallbackIcon({ fallback = "•" }: any) {
  return <span className="ui-ico"><span>{fallback}</span></span>;
}

export function TopChromeView(props: any) {
  const { playing = false, panel = "", muted = false, Icon = FallbackIcon } = props;
  if (!playing) return <div />;
  const buttons = topChromeButtons({ settingsOpen: panel === "settings", muted });
  return <div>
    <div className="chrome-actions ui2-top-chrome" data-ui-region="top-chrome">
      {buttons.map((b: any) => <button
        className={b.className}
        aria-label={b.ariaLabel}
        data-tip-title={b.tipTitle}
        data-tip-body={b.tipBody}
        data-click={b.click}
        data-panel={b.panel || undefined}
        data-chrome-action={b.id}
      >{b.icon ? <Icon name={b.icon} fallback={b.fallback} /> : b.text}</button>)}
    </div>
  </div>;
}
