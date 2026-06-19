// @ts-nocheck
import { adminBroadcast, adminRemoveGoldSource, adminSpawnGoldSource, adminUpdateGoldSource, adminUpdateUser, creditCraftsFeePool, economyStatus, setEconomyControl, setGameTuning, reloadGameTuningFromAdmin, resyncBuildingHpDefaults, syncCraftsBalance, setQuestTuning } from '../../../../game/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ ok: true, ...economyStatus() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  if (action === 'creditFees') {
    const out = creditCraftsFeePool(Number(body.amount || 0));
    return Response.json({ ok: true, ...out });
  }
  if (action === 'syncBalance') {
    const ok = syncCraftsBalance(String(body.wallet || ''), Number(body.balance || 0));
    return Response.json({ ok });
  }
  if (action === 'setControl') {
    const out = setEconomyControl(String(body.name || ''), !!body.value);
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'setTuning') {
    const out = setGameTuning(body.tuning || body.fields || body.patch || {});
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'reloadTuning') {
    const out = reloadGameTuningFromAdmin();
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'resyncBuildingHp') {
    const out = resyncBuildingHpDefaults();
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'setQuests') {
    const out = setQuestTuning(body.quests || body.rows || []);
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'updateUser') {
    const out = adminUpdateUser(Number(body.id || 0), body.fields || {});
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'spawnGoldSource') {
    const out = adminSpawnGoldSource(Number(body.x || 0), Number(body.z || 0), String(body.state || 'barb'));
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'updateGoldSource') {
    const out = adminUpdateGoldSource(String(body.id || ''), body.fields || body.patch || {});
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'removeGoldSource') {
    const out = adminRemoveGoldSource(String(body.id || ''));
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  if (action === 'broadcast') {
    const out = adminBroadcast(String(body.msg || ''));
    return Response.json(out, { status: out.ok ? 200 : 400 });
  }
  return Response.json({ ok: false, msg: 'unknown economy action' }, { status: 400 });
}