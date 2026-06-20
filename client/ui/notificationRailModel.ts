export type NoticeKind = "info" | "warn" | "good" | "bad" | string;
export type NoticeItem = { id: number; text: string; kind?: NoticeKind; gone?: boolean };

export function noticeAmount(text: any) {
  return String(text || "").match(/[+]\d+(?:\.\d+)?\s*[^\s.]*/)?.[0] || "";
}
export function noticeRemainder(text: any, amount = noticeAmount(text)) {
  const raw = String(text || "").trim();
  return amount ? raw.replace(amount, "").trim() : raw;
}
export function noticeClassName(n: NoticeItem) {
  return `notice-item ${String(n?.kind || "info")}${n?.gone ? " gone" : ""}`;
}
