import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import Stripe from 'stripe';
import { parseStripeDisputeWebhook, parsePayPalDisputeWebhook, parseRazorpayDisputeWebhook, ingestDisputeEvent } from './pg-ingest';
import { getMerchant } from './models';
const reject = (error: string, status: number) => NextResponse.json({ error }, { status });
export async function paymentWebhook(req: NextRequest, provider: 'stripe' | 'paypal' | 'razorpay') {
    const raw = await req.text(); let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return reject('Invalid JSON', 400); }
    try {
        if (provider === 'stripe') {
            const secret = process.env.STRIPE_WEBHOOK_SECRET; if (!secret) return reject('Stripe webhook signing secret is not configured', 503);
            const signature = req.headers.get('stripe-signature'); if (!signature) return reject('Missing Stripe signature', 401);
            // Signature verification is offline; no API credentials or request-body mutation.
            try { Stripe.webhooks.constructEvent(raw, signature, secret); } catch { return reject('Invalid Stripe signature', 401); }
        } else if (provider === 'razorpay') {
            const secret = process.env.RAZORPAY_WEBHOOK_SECRET; if (!secret) return reject('Razorpay webhook signing secret is not configured', 503);
            const signature = req.headers.get('x-razorpay-signature') ?? ''; const expected = createHmac('sha256', secret).update(raw).digest('hex');
            if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return reject('Invalid Razorpay signature', 401);
        } else {
            const webhookId = process.env.PAYPAL_WEBHOOK_ID, client = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_CLIENT_SECRET; if (!webhookId || !client || !secret) return reject('PayPal webhook verification is not configured', 503);
            const base = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'; const headers = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time']; if (headers.some(h => !req.headers.get(h))) return reject('Missing PayPal verification headers', 401);
            const tokenRes = await fetch(base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(client + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials', signal: AbortSignal.timeout(10000) }); if (!tokenRes.ok) return reject('PayPal authentication unavailable', 503); const token = await tokenRes.json();
            const res = await fetch(base + '/v1/notifications/verify-webhook-signature', { method: 'POST', headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ auth_algo: req.headers.get(headers[0]), cert_url: req.headers.get(headers[1]), transmission_id: req.headers.get(headers[2]), transmission_sig: req.headers.get(headers[3]), transmission_time: req.headers.get(headers[4]), webhook_id: webhookId, webhook_event: body }), signal: AbortSignal.timeout(10000) }); if (!res.ok) return reject('PayPal verification unavailable', 503); const result = await res.json(); if (result.verification_status !== 'SUCCESS') return reject('Invalid PayPal signature', 401);
        }
        const event = provider === 'stripe' ? parseStripeDisputeWebhook(body) : provider === 'paypal' ? parsePayPalDisputeWebhook(body) : parseRazorpayDisputeWebhook(body);
        if (!event) return NextResponse.json({ received: true, dispute: null });
        if (!event.orderId || !event.disputeId || !Number.isFinite(event.amount) || event.amount <= 0) return reject('Verified event needs an order ID and a positive amount', 422);
        // A configured merchant mapping is required. Never create/overwrite OAuth tokens from webhook payloads.
        const merchantId = process.env.SHIELDPAY_WEBHOOK_MERCHANT || process.env.SHOPIFY_DEV_STORE || event.merchantId;
        const merchant = await getMerchant(merchantId); if (!merchant) return reject('Connect the merchant and configure SHIELDPAY_WEBHOOK_MERCHANT', 422);
        event.merchantId = merchant._id.toString(); event.platform = merchant.platform;
        const result = await ingestDisputeEvent(event); return NextResponse.json({ received: true, disputeId: result.disputeId });
    } catch (e) { console.error('Webhook processing failed', e instanceof Error ? e.message : 'Unknown error'); return reject('Webhook processing temporarily unavailable', 503); }
}
