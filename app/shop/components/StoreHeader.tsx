"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "./CartProvider";

const NAV = [
  { href: "/shop", label: "Home" },
  { href: "/shop/products", label: "Catalog" },
  { href: "/shop/account", label: "Orders" },
  { href: "/shop/contact", label: "Contact" },
];

export default function StoreHeader() {
  const { count } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="shop-header">
      <p className="shop-banner">Free UPS ground on orders over $75 · 3–5 day delivery</p>
      <div className="shop-header-row">
        <button
          type="button"
          className="shop-btn-secondary shop-menu-btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
        >
          Menu
        </button>
        <Link href="/shop" className="shop-brand">
          Northline
        </Link>
        <nav className="shop-nav-desktop">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "is-active" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="shop-header-actions">
          <Link href="/dashboard" className="shop-merchant-link">
            Merchant
          </Link>
          <Link href="/shop/cart" className="shop-btn-secondary">
            Cart{count > 0 ? ` (${count})` : ""}
          </Link>
        </div>
      </div>
      {open && (
        <nav className="shop-nav-mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            Merchant dashboard
          </Link>
        </nav>
      )}
    </header>
  );
}
