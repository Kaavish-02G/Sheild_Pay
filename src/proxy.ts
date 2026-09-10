import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname;
    if (path.startsWith('/api/core/webhooks') || path.startsWith('/api/core/auth/callback')) return NextResponse.next();
    if (path === '/api/core/deadline-check' && process.env.CRON_SECRET && equal(req.headers.get('authorization') || '', 'Bearer ' + process.env.CRON_SECRET)) return NextResponse.next();
    const password = process.env.SHIELDPAY_ADMIN_PASSWORD;
    if (!password) { if (process.env.SHIELDPAY_DEMO_MODE === 'false') return NextResponse.json({ error: 'Configure SHIELDPAY_ADMIN_PASSWORD before enabling live merchant mode.' }, { status: 503 }); return NextResponse.next(); }
    const auth = req.headers.get('authorization') || '';
    const basic = 'Basic ' + Buffer.from('admin:' + password).toString('base64');
    const internal = process.env.SHIELDPAY_INTERNAL_TOKEN;
    if (equal(auth, basic) || (internal && equal(auth, 'Bearer ' + internal))) return NextResponse.next();
    return new NextResponse('Merchant authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="ShieldPay merchant desk", charset="UTF-8"' } });
}
export const config = { matcher: ['/dashboard/:path*', '/api/workspace', '/api/core/:path*', '/api/p2/:path*', '/api/p3/:path*', '/api/p4/:path*'] };
