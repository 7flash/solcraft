import { NextRequest, NextResponse } from 'next/server';

function adminEnabled(req: NextRequest) {
  if (process.env.SOLCRAFT_ENABLE_ADMIN === '1' || process.env.NEXT_PUBLIC_SOLCRAFT_ENABLE_ADMIN === '1') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  const host = (req.headers.get('host') || '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]') || host.endsWith('.local')) return true;
  return false;
}

function disabledResponse(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/admin/')) {
    return NextResponse.json({ ok: false, reasonCode: 'ADMIN_DISABLED_IN_PRODUCTION', msg: 'Admin APIs are disabled in production. Edit locally and sync through the migration/deploy pipeline.' }, { status: 404 });
  }
  return new NextResponse('Admin is disabled in production. Edit locally and sync through the migration/deploy pipeline.', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'x-solcraft-admin-disabled': '1' },
  });
}

export function middleware(req: NextRequest) {
  if (!adminEnabled(req)) return disabledResponse(req);
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};