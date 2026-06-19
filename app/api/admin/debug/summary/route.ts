// @ts-nocheck
import { economyStatus, clientRequiredVersion } from '../../../../../game/engine';
import { metaGet } from '../../../../../game/db';
import { publicLoginGateSettings, loginGateSettings, setLoginGateSettings } from '../../../../../game/login-gate';
import { bankAdminStatus, setBankSettings } from '../../../../../game/bank';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(){
  try {
    return Response.json({ ok:true, now:Date.now(), requiredVersion: clientRequiredVersion(), updateReason: metaGet('solcraft:client:updateReason',''), loginGate: { ...publicLoginGateSettings(), rpcEndpoint: loginGateSettings().rpcEndpoint }, bank: bankAdminStatus(), economy: economyStatus() });
  } catch (e:any) {
    return Response.json({ ok:false, msg:String(e?.message||e||'debug summary failed') }, { status:500 });
  }
}
export async function POST(req: Request){
  try {
    const body:any = await req.json().catch(()=>({}));
    if (body.action === 'save-login-gate') {
      const result = setLoginGateSettings(body.loginGate || {});
      return Response.json({ ok:true, ...result });
    }
    if (body.action === 'save-bank') {
      const result = setBankSettings(body.bank || {});
      return Response.json({ ok:true, ...result });
    }
    return Response.json({ ok:false, msg:'Unknown admin debug action', reasonCode:'UNKNOWN_ACTION' }, { status:400 });
  } catch (e:any) {
    return Response.json({ ok:false, msg:String(e?.message||e||'debug summary save failed') }, { status:500 });
  }
}
