import type { InvestigationToolName } from "./tools";

export function summarizeToolOutput(
  toolName: InvestigationToolName,
  output: Record<string, unknown>
): string {
  if ("error" in output && output.error) {
    return `${toolName} could not be retrieved: ${String(output.error)}.`;
  }

  switch (toolName) {
    case "getOrderDetails":
      return `Order ${output.orderId ?? "unknown"}: total ${output.totalAmount ?? "?"} ${output.currency ?? "USD"}.`;
    case "getPaymentDetails": {
      const parts = [
        `Payment status ${output.status ?? "unknown"}`,
        output.amount != null ? `amount ${output.amount} ${output.currency ?? "USD"}` : null,
        output.avsResult ? `AVS ${output.avsResult}` : null,
        output.cvvResult ? `CVV ${output.cvvResult}` : null,
      ].filter(Boolean);
      return parts.join(", ") + ".";
    }
    case "getCustomerHistory":
      return `Customer ${output.email ?? output.customerId ?? "unknown"}: ${output.totalOrders ?? 0} orders, ${output.disputeCount ?? 0} prior disputes.`;
    case "getFulfillmentDetails":
      return `Fulfillment ${output.status ?? "unknown"}${output.trackingNumber ? `, tracking ${output.trackingNumber}` : ""}${output.carrier ? ` via ${output.carrier}` : ""}.`;
    case "getTrackingStatus":
      return `Tracking ${output.trackingNumber ?? "unknown"}: status ${output.status ?? "unknown"}${output.deliveredAt ? `, delivered ${output.deliveredAt}` : ""}.`;
    case "getRefundHistory":
      return `Refunds on order: ${output.totalRefunded ?? 0} total refunded.`;
    default:
      return `${toolName} completed.`;
  }
}
