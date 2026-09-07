"use client";

import type { Dispute, VerifiedEvidencePackage } from "@/shared/schemas";

interface MockEvidenceScreenshotsProps {
  dispute: Dispute;
  evidence: VerifiedEvidencePackage;
  gatewayReference?: string;
}

function fieldValue(evidence: VerifiedEvidencePackage, key: string): string | undefined {
  return evidence.evidence.find((f) => f.key === key)?.value;
}

export default function MockEvidenceScreenshots({
  dispute,
  evidence,
  gatewayReference,
}: MockEvidenceScreenshotsProps) {
  const orderTotal =
    fieldValue(evidence, "order_total") ?? `${dispute.currency} ${dispute.amount.toFixed(2)}`;
  const paymentStatus = fieldValue(evidence, "payment_status") ?? "captured";
  const tracking = fieldValue(evidence, "tracking_number") ?? "—";
  const delivery = fieldValue(evidence, "delivery_status") ?? "delivered";
  const orderId = fieldValue(evidence, "order_id") ?? dispute.orderId;
  const paidAt = new Date(dispute.createdAt ?? Date.now()).toLocaleString();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="dash-card overflow-hidden">
        <div className="border-b border-[var(--dash-line)] bg-[var(--dash-sidebar)] px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f4efe8]">
            Mock payment receipt
          </p>
        </div>
        <div className="space-y-2 p-4 font-mono text-xs">
          <div className="flex justify-between border-b border-dashed border-[var(--dash-line)] pb-2">
            <span>PROCESSOR</span>
            <span className="text-[var(--dash-ok)]">PAID</span>
          </div>
          <p>Order #{orderId}</p>
          <p>Amount: {orderTotal}</p>
          <p>Status: {paymentStatus}</p>
          <p>AVS: match · CVV: match</p>
          <p>Date: {paidAt}</p>
          {gatewayReference && (
            <p className="mt-2 rounded border border-[var(--dash-line)] px-2 py-1">
              PG Ref: {gatewayReference}
            </p>
          )}
        </div>
      </div>

      <div className="dash-card overflow-hidden">
        <div className="border-b border-[var(--dash-line)] bg-[var(--dash-accent)] px-4 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dash-paper)]">
            Mock delivery proof
          </p>
        </div>
        <div className="space-y-2 p-4 text-xs">
          <div className="rounded-md bg-[var(--dash-paper)] p-3">
            <p className="font-semibold">Carrier tracking</p>
            <p className="mt-1 font-mono">{tracking}</p>
            <p className="mt-2 capitalize text-[var(--dash-ok)]">{delivery}</p>
          </div>
          <div className="rounded-md border border-dashed border-[var(--dash-line-strong)] p-3">
            <p className="dash-muted">Placeholder: package delivered to billing address</p>
            <div className="mt-2 h-16 rounded bg-[linear-gradient(135deg,var(--dash-line),var(--dash-paper))]" />
          </div>
        </div>
      </div>

      <div className="dash-card overflow-hidden sm:col-span-2">
        <div className="border-b border-[var(--dash-line)] px-4 py-2">
          <p className="dash-kicker">Evidence pack sent to payment gateway</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {evidence.evidence.map((field) => (
            <div key={field.key} className="rounded border border-[var(--dash-line)] px-3 py-2">
              <p className="dash-muted text-[10px] uppercase">{field.label}</p>
              <p className="text-xs font-medium">{field.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
