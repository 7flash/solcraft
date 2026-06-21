// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { t } from "../i18n";

export function HelpModalView() {
  return <div className="modal" style={{ width: "min(560px,94vw)" }}>
    <h2>{t("help.title", "How to play")}</h2>
    <p className="tiny">{t("help.intro", "Use the bottom bar like a city-builder hotbar: craft, gather with separate tools, capture, build, deploy crafted tools, and interact. Movement works in every action mode by clicking the world or using WASD, and each tile costs a tiny bit of energy that refills quickly. Tutorial objectives live in Quests.")}</p>
    <p><span className="kbd">1</span> {t("help.hotkeys", "craft · wood · stone · capture · build · deploy · use/scroll")}</p>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      <div className="card"><div className="card-title">{t("help.cards.gather.title", "Gather")}</div><div className="tiny">{t("help.cards.gather.text", "Select Wood or Stone, then click the matching highlighted resource. Drops become pickups on the ground instead of teleporting into your bag.")}</div></div>
      <div className="card"><div className="card-title">{t("help.cards.build.title", "Build")}</div><div className="tiny">{t("help.cards.build.text", "Press 5, scroll the row, read exact cost/purpose, then click a valid owned pad.")}</div></div>
      <div className="card"><div className="card-title">{t("help.cards.economy.title", "Coin Economy Goal")}</div><div className="tiny">{t("help.cards.economy.text", "Claim more territory to increase coin opportunities, tax visitors on your land, and defend your Coin Mint.")}</div></div>
      <div className="card"><div className="card-title">{t("help.cards.redeem.title", "Redeem")}</div><div className="tiny">{t("help.cards.redeem.text", "Your Phantom wallet is the account and payout wallet.")}</div></div>
    </div>
  </div>;
}
