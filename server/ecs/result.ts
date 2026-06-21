export type Ok<T = Record<string, unknown>> = { ok: true } & T;
export type Err = { ok: false; msg: string; reasonCode: string; details?: unknown };
export type Result<T = Record<string, unknown>> = Ok<T> | Err;

export function ok<T extends Record<string, unknown> = Record<string, unknown>>(extra?: T): Ok<T> {
  return { ok: true, ...(extra || {} as T) } as Ok<T>;
}

export function err(msg: string, reasonCode = "BAD_ACTION", details?: unknown): Err {
  return { ok: false, msg, reasonCode, ...(details === undefined ? {} : { details }) };
}
