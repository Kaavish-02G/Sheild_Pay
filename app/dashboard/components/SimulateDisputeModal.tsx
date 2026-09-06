"use client";

import { useState } from "react";
import { simulateDispute } from "@/lib/p4/api-client";

const REASONS = [
  { value: "fraudulent", label: "Fraudulent" },
  { value: "product_not_received", label: "Product Not Received" },
  { value: "duplicate", label: "Duplicate Charge" },
  { value: "unrecognized", label: "Unrecognized Charge" },
  { value: "product_unacceptable", label: "Product Unacceptable" },
];

interface SimulateDisputeModalProps {
  onSuccess: () => void;
}

export default function SimulateDisputeModal({ onSuccess }: SimulateDisputeModalProps) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("fraudulent");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await simulateDispute({
      orderId,
      reason,
      amount: parseFloat(amount),
    });

    setLoading(false);

    if (result.success) {
      setOpen(false);
      setOrderId("");
      setAmount("");
      onSuccess();
      if (result.disputeId) {
        const { runDisputeAutomation } = await import("@/lib/p4/api-client");
        runDisputeAutomation(result.disputeId).catch(() => {});
      }
    } else {
      setError(result.error ?? "Failed to simulate dispute");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        Simulate Incoming Dispute
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Simulate Incoming Dispute
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Creates a test dispute and triggers the AI investigation pipeline.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Order ID
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="e.g. #1042"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Amount
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="149.99"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create Dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
