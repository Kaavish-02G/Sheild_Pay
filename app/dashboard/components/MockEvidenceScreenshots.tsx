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
  const orderTotal = fieldValue(evidence, "order_total") ?? `${dispute.currency} ${dispute.amount.toFixed(2)}`;
  const paymentStatus = fieldValue(evidence, "payment_status") ?? "captured";
  const tracking = fieldValue(evidence, "tracking_number") ?? "—";
  const delivery = fieldValue(evidence, "delivery_status") ?? "delivered";
  const orderId = fieldValue(evidence, "order_id") ?? dispute.orderId;
  const paidAt = new Date(dispute.createdAt ?? Date.now()).toLocaleString();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md dark:border-slate-600 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-2 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            Mock Payment Receipt
          </p>
        </div>
        <div className="space-y-2 p-4 font-mono text-xs text-slate-700 dark:text-slate-300">
          <div className="flex justify-between border-b border-dashed border-slate-200 pb-2 dark:border-slate-700">
            <span>STRIPE PAYMENTS</span>
            <span className="text-emerald-600">PAID</span>
          </div>
          <p>Order #{orderId}</p>
          <p>Amount: {orderTotal}</p>
          <p>Status: {paymentStatus}</p>
          <p>AVS: match · CVV: match</p>
          <p>Date: {paidAt}</p>
          {gatewayReference && (
            <p className="mt-2 rounded bg-emerald-50 px-2 py-1 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              PG Ref: {gatewayReference}
            </p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md dark:border-slate-600 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-blue-900 px-4 py-2 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            Mock Delivery Proof
          </p>
        </div>
        <div className="space-y-2 p-4 text-xs text-slate-700 dark:text-slate-300">
          <div className="rounded-md bg-slate-100 p-3 dark:bg-slate-800">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Carrier Tracking</p>
            <p className="mt-1 font-mono">{tracking}</p>
            <p className="mt-2 capitalize text-emerald-700 dark:text-emerald-400">{delivery}</p>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-600">
            <p className="text-slate-500">Screenshot: package delivered to billing address</p>
            <div className="mt-2 h-16 rounded bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-md sm:col-span-2 dark:border-slate-600 dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-violet-900 px-4 py-2 dark:border-slate-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-white">
            Evidence Pack Sent to Payment Gateway
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {evidence.evidence.map((field) => (
            <div
              key={field.key}
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <p className="text-[10px] uppercase text-slate-400">{field.label}</p>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{field.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
