"use client";

import Link from "next/link";
import ProductArt from "../components/ProductArt";
import { useCart } from "../components/CartProvider";

export default function CartPage() {
  const { lines, subtotal, setQty, remove } = useCart();

  if (lines.length === 0) {
    return (
      <div className="shop-card shop-pad">
        <h1 className="shop-page-title">Your cart</h1>
        <p className="shop-lede">Nothing here yet.</p>
        <Link href="/shop/products" className="shop-btn-primary" style={{ marginTop: 24 }}>
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="shop-split shop-split-cart">
      <div>
        <h1 className="shop-page-title">Your cart</h1>
        <ul style={{ listStyle: "none", margin: "1.5rem 0 0", padding: 0 }}>
          {lines.map((line) => (
            <li key={`${line.productId}-${line.variant}`} className="shop-cart-line">
              <ProductArt image={line.image} title={line.title} className="shop-art-sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="shop-product-title">{line.title}</p>
                <p className="shop-muted">{line.variant}</p>
                <div className="shop-actions" style={{ marginTop: 8 }}>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setQty(line.productId, line.variant, Number(e.target.value))
                    }
                    className="shop-field"
                    style={{ width: 80 }}
                  />
                  <button
                    type="button"
                    onClick={() => remove(line.productId, line.variant)}
                    className="shop-muted-link"
                    style={{ background: "none", border: 0, cursor: "pointer" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="shop-price">${(line.price * line.quantity).toFixed(2)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="shop-card shop-pad">
        <p className="shop-muted">Subtotal</p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "1.85rem", fontFamily: "ui-serif, Georgia, serif" }}>
          ${subtotal.toFixed(2)}
        </p>
        <p className="shop-muted" style={{ marginTop: 8 }}>
          Free shipping over $75.
        </p>
        <Link href="/shop/checkout" className="shop-btn-primary shop-btn-full" style={{ marginTop: 24 }}>
          Checkout
        </Link>
      </aside>
    </div>
  );
}
