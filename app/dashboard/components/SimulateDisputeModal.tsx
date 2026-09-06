"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("1042");
  const [reason, setReason] = useState("fraudulent");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrderTotal = useCallback(async (id: string) => {
    if (!id.trim()) {
      setOrderTotal(null);
      return;
    }

    setLoadingOrder(true);
    setError(null);

    try {
      const res = await fetch(`/api/core/orders/${encodeURIComponent(id)}`);
      if (!res.ok) {
        throw new Error(`Order ${id} not found`);
      }
      const data = (await res.json()) as { totalAmount?: number; currency?: string };
      if (data.totalAmount == null) {
        throw new Error(`Order ${id} has no total amount`);
      }
      setOrderTotal(data.totalAmount);
      setCurrency(data.currency ?? "USD");
    } catch (err) {
      setOrderTotal(null);
      setError(err instanceof Error ? err.message : "Failed to load order");
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadOrderTotal(orderId);
  }, [open, orderId, loadOrderTotal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderTotal == null) {
      setError("Load a valid order before creating a dispute");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await simulateDispute({
      orderId,
      reason,
      amount: orderTotal,
    });

    setLoading(false);

    if (result.success && result.disputeId) {
      setOpen(false);
      onSuccess();
      router.push(`/dashboard/disputes/${result.disputeId}?live=1`);
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Simulate Incoming Dispute
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Creates a live dispute and opens the AI agent view — watch the 3-step loop run in real time.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Order ID
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="1042"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Order Total (from Shopify)
                </label>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                  {loadingOrder
                    ? "Loading order…"
                    : orderTotal != null
                      ? `${currency} ${orderTotal.toFixed(2)}`
                      : "Enter an order ID to load the total"}
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Dispute amount is always taken from the order — it updates when you change the order ID.
                </p>
              </div>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || loadingOrder || orderTotal == null}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Creating…" : "Create & Watch Live"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
