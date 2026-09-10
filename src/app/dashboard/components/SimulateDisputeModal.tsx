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
      <button type="button" onClick={() => setOpen(true)} className="dash-btn-ghost">
        Simulate incoming dispute
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="dash-card w-full max-w-md p-6">
            <h2 className="dash-serif text-2xl">Simulate incoming dispute</h2>
            <p className="dash-muted mt-1 text-sm leading-6">
              Creates a case without shopping — leftover admin path for tests.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium">Order ID</label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="1042"
                  className="dash-input mt-1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Reason</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="dash-select mt-1"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Order total</label>
                <div className="dash-muted mt-1 rounded-lg border border-[var(--dash-line)] px-3 py-2 text-sm">
                  {loadingOrder
                    ? "Loading order…"
                    : orderTotal != null
                      ? `${currency} ${orderTotal.toFixed(2)}`
                      : "Enter an order ID to load the total"}
                </div>
                <p className="dash-muted mt-1 text-xs">
                  Amount is taken from the mock-commerce (or Shopify) order.
                </p>
              </div>

              {error && <p className="dash-banner dash-banner-warn text-sm">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="dash-btn-ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || loadingOrder || orderTotal == null}
                  className="dash-btn-primary"
                >
                  {loading ? "Creating…" : "Create & watch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

