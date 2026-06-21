// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { chatCardTitle, parseChatCard } from "./chatCards";
import { chatLineClassName, chatLineKey, type ChatLine } from "./gameChatModel";

export function ChatCardInline({ card }: any) {
  const label = card.kind === "keep" ? "keep" : card.kind === "building" ? "building" : "location";
  return (
    <button
      type="button"
      className={`chat-link-card ${card.kind}`}
      data-click="chat-card-open"
      data-kind={card.kind}
      data-x={String(card.x)}
      data-z={String(card.z)}
      data-uid={card.uid ? String(card.uid) : undefined}
      data-label={card.label || undefined}
      data-hp={card.hp ? String(card.hp) : undefined}
      data-max-hp={card.maxHp ? String(card.maxHp) : undefined}
      data-coins={card.coins ? String(card.coins) : undefined}
      title={`${chatCardTitle(card)} · ${card.x},${card.z}`}
    >[{label}]</button>
  );
}

export function ChatLineView({ line }: { line: ChatLine }) {
  const card = parseChatCard(line?.m || "");
  if (card) {
    return (
      <div className={chatLineClassName(line)}>
        {line.n ? <b>{line.n}: </b> : null}
        <span>shared </span><ChatCardInline card={card} />
        <small> {card.x},{card.z}</small>
      </div>
    );
  }
  if (line.sys || !line.n) return <div className={chatLineClassName(line)}>{line.m}</div>;
  return <div className={chatLineClassName(line)}><b>{line.n}: </b>{line.m}</div>;
}

export function GameChatView({ lines = [], onKeyDown }: { lines: ChatLine[]; onKeyDown?: any }) {
  return (
    <div className="panel chat" style={{ display: "flex" }}>
      <div className="chat-log" data-chat-log="1">
        {lines.map((line, i) => <ChatLineView line={line} key={chatLineKey(line, i)} />)}
      </div>
      <div className="chat-form">
        <input maxLength={120} placeholder="Chat… /here shares your location" onKeyDown={onKeyDown} data-chat-input="1" />
      </div>
    </div>
  );
}
