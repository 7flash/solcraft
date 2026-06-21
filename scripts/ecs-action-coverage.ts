import { db } from "../server/db";
import { backendStatus } from "../server/backend";

function safeRows(sql: string) {
  try { return (db as any).prepare?.(sql)?.all?.() || []; } catch { return []; }
}

const byAction = safeRows(`
  SELECT action, backend, ok, reasonCode, COUNT(*) as n
  FROM ecsActionLog
  GROUP BY action, backend, ok, reasonCode
  ORDER BY n DESC, action ASC
`);

const unsupported = safeRows(`
  SELECT action, COUNT(*) as n
  FROM ecsActionLog
  WHERE reasonCode = 'ECS_ACTION_NOT_IMPLEMENTED'
  GROUP BY action
  ORDER BY n DESC, action ASC
`);

console.log(JSON.stringify({ ok: true, status: backendStatus(), byAction, unsupported }, null, 2));
