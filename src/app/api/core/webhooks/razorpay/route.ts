import { NextRequest } from 'next/server';
import { paymentWebhook } from '@/lib/core/verified-webhook';
export const dynamic = 'force-dynamic';
export function POST(req: NextRequest) { return paymentWebhook(req, 'razorpay'); }
