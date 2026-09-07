"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../components/CartProvider";
import { formatCardNumber, inferCardNetwork } from "@/shared/shop/test-cards";

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardNetwork, setCardNetwork] = useState("visa");

  const shipping = subtotal >= 75 ? 0 : 8;
  const total = subtotal + shipping;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lines.length === 0) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
          cardNetwork,
          cardNumber: form.get("cardNumber"),
          expMonth: form.get("expMonth"),
          expYear: form.get("expYear"),
          cvc: form.get("cvc"),
          shipping: {
            name: form.get("name"),
            address1: form.get("address1"),
            city: form.get("city"),
            region: form.get("region"),
            postalCode: form.get("postalCode"),
            country: "US",
          },
          items: lines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            variant: line.variant,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      const orderId = data.order?.orderId;
      localStorage.setItem("northline-last-email", String(form.get("email") ?? ""));
      clear();
      router.push(`/shop/orders/${encodeURIComponent(orderId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="shop-card shop-pad">
        <p className="shop-muted">Your cart is empty.</p>
        <a href="/shop/products" className="shop-btn-primary" style={{ marginTop: 16 }}>
          Shop catalog
        </a>
      </div>
    );
  }

  return (
    <div className="shop-split shop-split-checkout">
      <form onSubmit={onSubmit} className="shop-form-stack" style={{ gap: "1.5rem" }}>
        <h1 className="shop-page-title">Checkout</h1>
        <section className="shop-card shop-pad">
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Contact</h2>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="shop-field"
            style={{ marginTop: 8 }}
          />
        </section>
        <section className="shop-card shop-pad">
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Shipping</h2>
          <div className="shop-form-2" style={{ marginTop: 8 }}>
            <input required name="name" autoComplete="name" placeholder="Full name" className="shop-field shop-span-2" />
            <input required name="address1" autoComplete="street-address" placeholder="Address" className="shop-field shop-span-2" />
            <input required name="city" autoComplete="address-level2" placeholder="City" className="shop-field" />
            <input required name="region" autoComplete="address-level1" placeholder="State" className="shop-field" />
            <input required name="postalCode" autoComplete="postal-code" placeholder="ZIP" className="shop-field shop-span-2" />
          </div>
        </section>
        <section className="shop-card shop-pad">
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Payment</h2>
          <p className="shop-muted" style={{ marginTop: 6 }}>
            Enter your card details to complete the order.
          </p>
          <div className="shop-form-2" style={{ marginTop: 8 }}>
            <select
              name="cardNetwork"
              value={cardNetwork}
              onChange={(event) => setCardNetwork(event.target.value)}
              className="shop-field"
            >
              <option value="visa">Visa</option>
              <option value="mastercard">Mastercard</option>
              <option value="amex">Amex</option>
              <option value="rupay">RuPay</option>
            </select>
            <input
              required
              name="cardNumber"
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="Card number"
              value={cardNumber}
              onChange={(event) => {
                const next = formatCardNumber(event.target.value);
                setCardNumber(next);
                setCardNetwork(inferCardNetwork(next, cardNetwork));
              }}
              className="shop-field"
            />
            <input
              required
              name="expMonth"
              inputMode="numeric"
              autoComplete="cc-exp-month"
              placeholder="MM"
              maxLength={2}
              className="shop-field"
            />
            <input
              required
              name="expYear"
              inputMode="numeric"
              autoComplete="cc-exp-year"
              placeholder="YYYY"
              maxLength={4}
              className="shop-field"
            />
            <input
              required
              name="cvc"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="CVC"
              maxLength={4}
              className="shop-field shop-span-2"
            />
          </div>
        </section>
        {error && <p style={{ color: "#b91c1c", fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={busy} className="shop-btn-primary shop-btn-full">
          {busy ? "Processing…" : `Pay $${total.toFixed(2)}`}
        </button>
      </form>
      <aside className="shop-card shop-pad">
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Order summary</h2>
        <ul style={{ listStyle: "none", margin: "1rem 0 0", padding: 0, fontSize: 14 }}>
          {lines.map((line) => (
            <li key={`${line.productId}-${line.variant}`} className="shop-row">
              <span>
                {line.title} × {line.quantity}
              </span>
              <span>${(line.price * line.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 16, borderTop: "1px solid #e7e5e4", paddingTop: 16, fontSize: 14 }}>
          <p className="shop-row">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
          </p>
          <p className="shop-row" style={{ marginTop: 8, fontWeight: 650 }}>
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </p>
        </div>
      </aside>
    </div>
  );
}
