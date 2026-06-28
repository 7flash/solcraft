export type ChatLine = { id?: number; sys?: boolean; n?: string; m?: string };

export function chatLineKey(line: ChatLine, index: number) {
  return String(line?.id ?? `${index}:${line?.n || ""}:${line?.m || ""}`);
}
export function chatMessageLooksLikeCard(message: any) {
  const text = String(message || "").trim();
  return /^\[\[sc:(?:location|building|keep)\|/i.test(text) || /^\[(?:loc|location|building|keep):/i.test(text);
}
export function chatLineClassName(line: ChatLine) {
  return `chat-line${line?.sys ? " sys" : ""}${chatMessageLooksLikeCard(line?.m) ? " has-link-card" : ""}`;
}