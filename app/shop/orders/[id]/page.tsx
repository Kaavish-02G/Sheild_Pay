"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const REASONS = [
  { id: "product_not_received", label: "Item not received" },
  { id: "fraudulent", label: "I didn't authorize this" },
  { id: "duplicate", label: "Duplicate charge" },
  { id: "product_unacceptable", label: "Not as described" },
  { id: "credit_not_processed", label: "Refund not processed" },
];

export default function OrderPage() {
  const params = useParams();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState("product_not_received");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ disputeId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/shop/orders/${params.id}`)
      .then((res) => res.json())
      .then((data) => setOrder(data.order ?? null));
  }, [params.id]);

  if (!order) {
    return <p className="shop-muted">Loading order…</p>;
  }

  const items = (order.items as Array<{ name: string; quantity: number; price: number }>) ?? [];
  const payment = order.payment as { cardNetwork?: string; last4?: string } | undefined;
  const tracking = order.tracking as { trackingNumber?: string; status?: string } | undefined;

  async function fileDispute() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shop/orders/${params.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not file dispute");
      setResult({ disputeId: data.disputeId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file dispute");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shop-narrow">
      <p className="shop-kicker">Order confirmed</p>
      <h1 className="shop-page-title">{String(order.orderId)}</h1>
      <p className="shop-lede">
        Paid with {(payment?.cardNetwork ?? "visa").toUpperCase()} ···· {payment?.last4 ?? "4242"} ·
        UPS {tracking?.trackingNumber} ({tracking?.status})
      </p>

      <ul style={{ listStyle: "none", margin: "2rem 0 0", padding: 0, borderTop: "1px solid #e7e5e4" }}>
        {items.map((item) => (
          <li key={item.name} className="shop-row shop-cart-line">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 12, textAlign: "right", fontWeight: 650 }}>
        Total ${Number(order.totalAmount).toFixed(2)} {String(order.currency)}
      </p>

      <section className="shop-card shop-pad" style={{ marginTop: "2.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>File a chargeback dispute</h2>
        <p className="shop-lede">
          This is the customer-side filing. ShieldPay ingests it as a Stripe-shaped dispute and
          runs the Visa/Mastercard rule book on the merchant dashboard.
        </p>
        <label className="shop-kicker" style={{ display: "block", marginTop: 16 }}>
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="shop-field"
            style={{ marginTop: 8, textTransform: "none", letterSpacing: "normal" }}
          >
            {REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {error && <p style={{ marginTop: 12, color: "#b91c1c", fontSize: 14 }}>{error}</p>}
        {result ? (
          <p className="shop-lede">
            Dispute filed.{" "}
            <Link
              href={`/dashboard/disputes/${encodeURIComponent(result.disputeId)}?preview=1`}
              className="shop-muted-link"
            >
              Open in ShieldPay merchant dashboard
            </Link>
          </p>
        ) : (
          <button
            type="button"
            onClick={fileDispute}
            disabled={busy}
            className="shop-btn-primary"
            style={{ marginTop: 20 }}
          >
            {busy ? "Filing…" : "Draft and submit dispute"}
          </button>
        )}
      </section>
    </div>
  );
}
