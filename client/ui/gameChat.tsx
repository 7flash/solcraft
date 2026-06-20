// @ts-nocheck
/** @jsxImportSource tradjs/client */
import { chatCardCta, chatCardSubtitle, chatCardTitle, parseChatCard } from "./chatCards";
import { chatLineClassName, chatLineKey, type ChatLine } from "./gameChatModel";

export function ChatCardButton({ card }: any) {
  const glyph = card.kind === "keep" ? "⚔" : card.kind === "building" ? "⌂" : "⌖";
  return (
    <button
      type="button"
      className={`chat-card ${card.kind}`}
      data-click="chat-card-open"
      data-kind={card.kind}
      data-x={String(card.x)}
      data-z={String(card.z)}
      data-uid={card.uid ? String(card.uid) : undefined}
      data-label={card.label || undefined}
      data-hp={card.hp ? String(card.hp) : undefined}
      data-max-hp={card.maxHp ? String(card.maxHp) : undefined}
      data-coins={card.coins ? String(card.coins) : undefined}
    >
      <span>{glyph}</span>
      <strong>{chatCardTitle(card)}</strong>
      <small>{chatCardSubtitle(card)}</small>
      <em>{chatCardCta(card)}</em>
    </button>
  );
}

export function ChatLineView({ line }: { line: ChatLine }) {
  const card = parseChatCard(line?.m || "");
  if (card) {
    return (
      <div className={chatLineClassName(line)}>
        {line.n ? <b>{line.n}: </b> : null}
        <ChatCardButton card={card} />
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
        <input maxLength={120} placeholder="Chat… press Enter" onKeyDown={onKeyDown} data-chat-input="1" />
        <div className="chat-tools">
          <button type="button" data-click="chat-share-here" title="Share your current map location">Share here</button>
        </div>
      </div>
    </div>
  );
}
