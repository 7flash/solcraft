export type ChatLine = { id?: number; sys?: boolean; n?: string; m?: string };

export function chatLineKey(line: ChatLine, index: number) {
  return String(line?.id ?? `${index}:${line?.n || ""}:${line?.m || ""}`);
}
export function chatMessageLooksLikeCard(message: any) {
  return /\[\[sc:(location|building|keep)\|/i.test(String(message || "").trim()) || /^\[(loc|location|building|keep):/i.test(String(message || "").trim());
}
export function chatLineClassName(line: ChatLine) {
  return `chat-line${line?.sys ? " sys" : ""}${chatMessageLooksLikeCard(line?.m) ? " has-link-card" : ""}`;
}
