/**
 * Deterministic per-order mock values so different order IDs produce
 * different totals and tracking numbers in demo mode.
 */

const ORDER_TOTALS = [29.99, 49.99, 79.99, 99.99, 149.99, 199.99, 249.99];

function hashOrderId(orderId: string): number {
  return orderId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function mockOrderTotal(orderId: string): number {
  return ORDER_TOTALS[hashOrderId(orderId) % ORDER_TOTALS.length];
}

export function mockTrackingNumber(orderId: string): string {
  const digits = orderId.replace(/\D/g, "").padStart(8, "0").slice(-8);
  return `1Z999AA10${digits}`;
}

export function mockPaymentId(orderId: string): string {
  const suffix = orderId.replace(/\W/g, "").slice(-6).toUpperCase() || "1042";
  return `pay_mock_${suffix}`;
}
