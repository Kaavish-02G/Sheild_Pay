import 'dotenv/config';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createHmac } from 'node:crypto';
import { paymentWebhook } from '../src/lib/core/verified-webhook';
import { normalizeShop } from '../src/lib/adapters/shopify/oauth';
import { proxy } from '../src/proxy';
import { pool } from '../src/db';
async function main() {
    assert.equal(normalizeShop('store.myshopify.com'), 'store.myshopify.com'); assert.equal(normalizeShop('evil.com/path.myshopify.com'), null); assert.equal(normalizeShop('a@other.myshopify.com'), null);
    const body = JSON.stringify({ id: 'evt_signature_unit', type: 'ignored.event' }); const secret = 'whsec_' + crypto.randomUUID(); process.env.STRIPE_WEBHOOK_SECRET = secret; const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
    assert.equal((await paymentWebhook(new NextRequest('http://localhost/api/core/webhooks/stripe', { method: 'POST', body, headers: { 'stripe-signature': header } }), 'stripe')).status, 200);
    assert.equal((await paymentWebhook(new NextRequest('http://localhost/api/core/webhooks/stripe', { method: 'POST', body: body + ' ', headers: { 'stripe-signature': header, 'x-mock-commerce': 'true' } }), 'stripe')).status, 401);
    const razorSecret = crypto.randomUUID(); process.env.RAZORPAY_WEBHOOK_SECRET = razorSecret; const signature = createHmac('sha256', razorSecret).update(body).digest('hex'); assert.equal((await paymentWebhook(new NextRequest('http://localhost/api/core/webhooks/razorpay', { method: 'POST', body, headers: { 'x-razorpay-signature': signature } }), 'razorpay')).status, 200); assert.equal((await paymentWebhook(new NextRequest('http://localhost/api/core/webhooks/razorpay', { method: 'POST', body: body + ' ', headers: { 'x-razorpay-signature': signature } }), 'razorpay')).status, 401);
    const password = crypto.randomUUID(); process.env.SHIELDPAY_ADMIN_PASSWORD = password; assert.equal(proxy(new NextRequest('http://localhost/dashboard')).status, 401); assert.equal(proxy(new NextRequest('http://localhost/dashboard', { headers: { authorization: 'Basic ' + Buffer.from('admin:' + password).toString('base64') } })).status, 200); delete process.env.SHIELDPAY_ADMIN_PASSWORD; process.env.SHIELDPAY_DEMO_MODE = 'false'; assert.equal(proxy(new NextRequest('http://localhost/dashboard')).status, 503); console.log('PASS: Stripe and Razorpay raw-body signature validation, tamper rejection, no mock-header bypass, strict Shopify domains, merchant authentication, live-mode fail-closed.'); await pool.end();
} main().catch(async e => { console.error(e); await pool.end(); process.exitCode = 1; });
