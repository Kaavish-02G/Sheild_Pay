import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/core/db';
import { getDispute, upsertMockMerchant, getMerchant, saveEvidencePackage } from '@/lib/core/models';
import { normalizeDisputeReason } from '@/lib/core/normalization/reasons';
import { startAutonomousDisputePipeline } from '@/lib/core/pipeline';
import { products } from '@/lib/shop';
import type { CardNetwork } from '@/shared/schemas';
export const DEMO_MERCHANT = 'demo-merchant';
export async function localOrderBundle(id: string) {
    const [o] = await db.select().from(orders).where(eq(orders.orderId, id)); if (!o) throw Error('Local order not found');
    const createdAt = o.createdAt.toISOString(); const totalAmount = o.totalAmount / 100;
    return {
        orderId: o.orderId, customerId: `cust-${id}`, items: o.items, totalAmount, currency: 'USD', createdAt,
        customer: { customerId: `cust-${id}`, email: o.email, totalOrders: 1, accountCreatedAt: createdAt },
        fulfillment: { orderId: id, status: 'unfulfilled' as const, trackingNumber: null, carrier: null, shippedAt: null, deliveredAt: null },
        tracking: { orderId: id, carrier: null, trackingNumber: null, status: 'pending' as const, lastUpdate: createdAt, deliveredAt: null, events: [] },
        refunds: { orderId: id, refunds: [], totalRefunded: 0 },
        payment: { orderId: id, paymentId: `demo_payment_${id}`, status: 'captured' as const, amount: totalAmount, currency: 'USD', method: 'demo_card', avsResult: null, cvvResult: null, gateway: 'stripe' as const, cardNetwork: o.cardNetwork as CardNetwork, capturedAt: createdAt }
    };
}
export async function openLocalDispute(order: typeof orders.$inferSelect, reason: string, run = true) {
    const merchant = await upsertMockMerchant(DEMO_MERCHANT); const disputeId = `sim-${order.orderId}`;
    const store = await getDb(); const canonicalReason = normalizeDisputeReason('stripe', reason === 'Item not received' ? 'product_not_received' : reason === 'Item not as described' ? 'product_unacceptable' : reason === 'Duplicate charge' ? 'duplicate' : 'general');
    const existing = await getDispute(disputeId);
    await store.collection('disputes').findOneAndUpdate({ disputeId }, { $setOnInsert: { disputeId, orderId: order.orderId, merchantId: merchant._id.toString(), reason, amount: order.totalAmount / 100, currency: 'USD', deadline: new Date(Date.now() + 7 * 86400000).toISOString(), status: 'investigating', createdAt: new Date(), gateway: 'stripe', cardNetwork: order.cardNetwork, platform: 'mock_commerce', canonicalReason, rawReason: reason } }, { upsert: true, returnDocument: 'after' });
    await db.update(orders).set({ disputeId, disputeReason: existing?.reason ?? reason, status: 'Dispute opened' }).where(eq(orders.orderId, order.orderId));
    if (run && (!existing || existing.status === 'investigating')) startAutonomousDisputePipeline(disputeId);
    return disputeId;
}
let initialized: Promise<void> | undefined;
export function ensureDemo() {
    return initialized ??= (async () => {
        if (process.env.SHIELDPAY_DEMO_MODE === 'false') return;
        const merchant = await getMerchant(DEMO_MERCHANT); if (!merchant) { await upsertMockMerchant(DEMO_MERCHANT); const store = await getDb(); await store.collection('merchants').findOneAndUpdate({ shopDomain: DEMO_MERCHANT }, { $set: { settings: { autoSubmitThreshold: 85, minEvidenceScore: 25, reviewAmountLimit: 500, requireApprovalHighValue: true, requireApprovalWeakEvidence: true, requireApprovalMissingDeliveryProof: true, paymentProcessor: 'stripe', statementDescriptor: 'NORTHLINE', mockAlertsEnabled: true } } }); }
        const names = ['Olivia Rhye', 'Phoenix Baker', 'Lana Steiner', 'Demi Wilkinson', 'Drew Cano', 'Natali Craig', 'Andi Lane', 'Orlando Diggs'];
        for (let i = 0; i < names.length; i++) {
            const p = products[i % products.length], orderId = `NL-${1048 - i}`; const date = new Date(Date.now() - (i * 2 + 1) * 86400000);
            const [order] = await db.insert(orders).values({ orderId, email: names[i].toLowerCase().replace(' ', '.') + '@example.com', name: names[i], items: [{ productId: p.id, name: p.title, quantity: i === 4 ? 2 : 1, price: p.price, variant: `Men’s US 9 / ${p.color}`, image: p.image }], subtotal: p.price * 100 * (i === 4 ? 2 : 1), shippingAmount: 0, totalAmount: p.price * 100 * (i === 4 ? 2 : 1), cardNetwork: ['visa', 'mastercard', 'visa', 'amex'][i % 4], last4: '4242', shipping: { name: names[i], address1: '123 Alpine Road', city: 'Boulder', region: 'CO', postalCode: '80301', country: 'US' }, sessionId: 'demo-seed-private', createdAt: date }).onConflictDoNothing().returning();
            if (!order) continue;
            const reason = ['Item not received', 'Item not as described', 'Duplicate charge'][i % 3]; const disputeId = await openLocalDispute(order, reason, false); const status = i === 2 || i === 5 ? 'submitted' : i === 4 ? 'insufficient' : 'review'; const score = i === 2 || i === 5 ? 91 : i === 4 ? 32 : 64 + i;
            const responseText = `DEMO EVIDENCE RESPONSE — ${orderId}\n\nThis simulated case concerns ${p.title}, ordered by ${names[i]}, for USD ${order.totalAmount / 100}. The local store records a demo card payment. No live payment, delivery, or bank submission has occurred. Delivery proof is unavailable. Merchant review is required before relying on this response. Sample score and outcome are illustrative.`;
            const store = await getDb(); await store.collection('disputes').findOneAndUpdate({ disputeId }, { $set: { status, createdAt: date, deadline: new Date(Date.now() + (i % 4 + 1) * 86400000).toISOString(), responseText } });
            await saveEvidencePackage(disputeId, { disputeId, disputeReason: reason, confidenceScore: score, evidence: [{ key: 'order_id', label: 'Order ID', value: orderId, source: 'Local store (sample)' }, { key: 'order_total', label: 'Order total', value: `${order.totalAmount / 100} USD`, source: 'Local store (sample)' }, { key: 'payment', label: 'Demo payment', value: `${order.cardNetwork} •••• 4242`, source: 'Simulated checkout' }, { key: 'delivery', label: 'Delivery proof', value: 'Not available — no physical shipment', source: 'Local store' }], ledger: [{ timestamp: date.toISOString(), tool: 'sample_fixture', reasoning: 'Preview sample, not a live investigation.', resultSummary: 'Loaded stored order and simulated payment. Delivery proof unavailable.' }], generatedAt: date.toISOString() });
        }
    })().catch(e => { initialized = undefined; throw e; });
}
