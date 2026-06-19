import type { ClientAction, ClientAuth } from "./types.ts";
import { sendAction } from "./api.ts";

export type QueuedAction = ClientAction & { clientId: string; queuedAt: number };

export class ActionQueue {
  private q: QueuedAction[] = [];
  private running = false;
  private readonly auth: ClientAuth;
  private readonly onResult: (action: QueuedAction, result: any) => void;

  constructor(auth: ClientAuth, onResult: (action: QueuedAction, result: any) => void = () => {}) {
    this.auth = auth;
    this.onResult = onResult;
  }

  enqueue(action: ClientAction): QueuedAction {
    const item: QueuedAction = { ...action, clientId: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, queuedAt: Date.now() };
    this.q.push(item);
    void this.flush();
    return item;
  }

  pending(): readonly QueuedAction[] { return this.q; }

  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.q.length) {
        const item = this.q[0];
        const result = await sendAction(this.auth, item);
        this.onResult(item, result);
        this.q.shift();
        if (result?.ok === false && result?.reasonCode === "AUTH") break;
      }
    } finally {
      this.running = false;
    }
  }
}
