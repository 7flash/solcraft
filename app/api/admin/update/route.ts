// @ts-nocheck
import { forceClientRefresh, clientRequiredVersion } from '@server/engine';
import { metaGet } from '@server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    requiredVersion: clientRequiredVersion(),
    reason: metaGet('solcraft:client:updateReason', ''),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason || 'Admin requested a tiny refresh');
  const out = forceClientRefresh(reason);
  return Response.json({ ok: true, requiredVersion: out.version, reason: out.reason });
}