"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MOCK_ALERT_DISCLAIMER } from "@/shared/schemas";

export default function OrderPage() {
  const params = useParams();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);

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
  const shieldpay = order.shieldpay as
    | {
        disputeId?: string | null;
        alert?: { outcome?: string; message?: string };
        scenario?: { label?: string; reason?: string } | null;
      }
    | undefined;
  const disputeId = shieldpay?.disputeId;

  return (
    <div className="shop-narrow">
      {disputeId ? (
        <>
          <p className="shop-kicker">Chargeback alert</p>
          <h1 className="shop-page-title">{String(order.orderId)}</h1>
        </>
      ) : (
        <>
          <p className="shop-kicker">Payment successful</p>
          <h1 className="shop-page-title">Thank you for your order</h1>
        </>
      )}
      <p className="shop-lede">
        Paid with {(payment?.cardNetwork ?? "card").toUpperCase()} ···· {payment?.last4 ?? "••••"} ·
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

      {disputeId ? (
        <section className="shop-alert-banner">
          <h2>Chargeback case opened</h2>
          <p>
            This payment triggered a simulated pre-dispute signal and a{" "}
            {shieldpay?.scenario?.label ?? "dispute"} case for the merchant.
          </p>
          {shieldpay?.alert?.message ? (
            <p style={{ marginTop: 8 }}>Mock Alerts: {shieldpay.alert.message}</p>
          ) : null}
          <p className="shop-muted" style={{ marginTop: 8, fontSize: 13 }}>
            {MOCK_ALERT_DISCLAIMER}
          </p>
          <Link
            href={`/dashboard/disputes/${encodeURIComponent(disputeId)}?preview=1`}
            className="shop-btn-primary"
            style={{ marginTop: 20 }}
          >
            View merchant case
          </Link>
        </section>
      ) : (
        <section className="shop-success-banner">
          <h2>Payment successful</h2>
          <p>
            Your order is confirmed. We&apos;ll send tracking updates as your package moves.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
            <Link href="/shop/products" className="shop-btn-primary">
              Continue shopping
            </Link>
            <Link href="/shop/account" className="shop-btn-secondary">
              View orders
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
