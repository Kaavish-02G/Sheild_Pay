"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    const stored = localStorage.getItem("northline-last-email") ?? "alex@northline.shop";
    setEmail(stored);
  }, []);

  async function load(event?: FormEvent) {
    event?.preventDefault();
    const res = await fetch(`/api/shop/orders?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
  }

  useEffect(() => {
    if (!email) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  return (
    <div>
      <h1 className="shop-page-title">Your orders</h1>
      <form onSubmit={load} className="shop-actions shop-lookup">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="shop-field"
        />
        <button type="submit" className="shop-btn-primary">
          Look up
        </button>
      </form>
      <ul style={{ listStyle: "none", margin: "2rem 0 0", padding: 0 }}>
        {orders.map((order) => (
          <li key={String(order.orderId)} className="shop-row shop-cart-line">
            <div>
              <p className="shop-product-title">{String(order.orderId)}</p>
              <p className="shop-muted">
                {String(order.status)} · ${Number(order.totalAmount).toFixed(2)}
              </p>
            </div>
            <Link href={`/shop/orders/${encodeURIComponent(String(order.orderId))}`} className="shop-muted-link">
              View / dispute
            </Link>
          </li>
        ))}
      </ul>
      {orders.length === 0 && (
        <p className="shop-muted" style={{ marginTop: "2rem" }}>
          No orders for this email yet. Check out first.
        </p>
      )}
    </div>
  );
}
