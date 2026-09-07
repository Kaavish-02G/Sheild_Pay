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
    | { disputeId?: string; alert?: { outcome?: string; message?: string } }
    | undefined;
  const disputeId = shieldpay?.disputeId;

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
        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Sent to the merchant</h2>
        <p className="shop-lede">
          Checkout automatically forwarded a simulated pre-dispute signal and a dispute case to
          ShieldPay. Nothing else to file from this page.
        </p>
        <p className="shop-muted" style={{ marginTop: 8 }}>
          {MOCK_ALERT_DISCLAIMER}
        </p>
        {shieldpay?.alert?.message ? (
          <p className="shop-lede">Mock Alerts: {shieldpay.alert.message}</p>
        ) : null}
        <Link
          href={
            disputeId
              ? `/dashboard/disputes/${encodeURIComponent(disputeId)}?preview=1`
              : "/dashboard"
          }
          className="shop-btn-primary"
          style={{ marginTop: 20 }}
        >
          Open merchant dashboard
        </Link>
      </section>
    </div>
  );
}
