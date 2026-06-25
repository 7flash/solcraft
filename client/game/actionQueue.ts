
import type { ClientAction, ClientAuth } from "./types.ts";
import { sendAction } from "./api.ts";

export type QueuedAction = ClientAction & { clientId: string; queuedAt: number; startedAt?: number };
export type ActionQueueOptions = {
  /** Keep default 1 for strict ordering; set 2-4 only for deterministic idempotent actions. */
  maxInFlight?: number;
  /** Optional classifier lets movement/claim callers pipeline while bank/admin stay serial. */
  canPipeline?: (action: QueuedAction) => boolean;
};

function makeClientId() {
  try { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
  catch { return `${Date.now()}-${Math.random()}`; }
}

export class ActionQueue {
  private q: QueuedAction[] = [];
  private inFlight = new Set<QueuedAction>();
  private readonly auth: ClientAuth;
  private readonly onResult: (action: QueuedAction, result: any) => void;
  private readonly maxInFlight: number;
  private readonly canPipeline: (action: QueuedAction) => boolean;

  constructor(auth: ClientAuth, onResult: (action: QueuedAction, result: any) => void = () => {}, options: ActionQueueOptions = {}) {
    this.auth = auth;
    this.onResult = onResult;
    this.maxInFlight = Math.max(1, Math.min(8, Number(options.maxInFlight || 1) || 1));
    this.canPipeline = options.canPipeline || (() => false);
  }

  enqueue(action: ClientAction): QueuedAction {
    const item: QueuedAction = { ...action, clientId: makeClientId(), queuedAt: Date.now() };
    this.q.push(item);
    void this.flush();
    return item;
  }

  pending(): readonly QueuedAction[] { return [...this.inFlight, ...this.q]; }
  queued(): readonly QueuedAction[] { return this.q; }
  active(): readonly QueuedAction[] { return [...this.inFlight]; }
  busy(): boolean { return this.inFlight.size > 0 || this.q.length > 0; }

  async flush() {
    while (this.q.length && this.inFlight.size < this.maxInFlight) {
      const next = this.q[0];
      // Preserve legacy ordering unless the caller explicitly marks this item as pipeline-safe.
      if (this.inFlight.size > 0 && !this.canPipeline(next)) return;
      const item = this.q.shift()!;
      item.startedAt = Date.now();
      this.inFlight.add(item);
      void this.runOne(item);
    }
  }

  private async runOne(item: QueuedAction) {
    try {
      const result = await sendAction(this.auth, item);
      this.onResult(item, result);
      if (result?.ok === false && result?.reasonCode === "AUTH") this.q.length = 0;
    } catch (e: any) {
      this.onResult(item, { ok: false, msg: e?.message || "action failed", reasonCode: "NETWORK" });
    } finally {
      this.inFlight.delete(item);
      void this.flush();
    }
  }
}
