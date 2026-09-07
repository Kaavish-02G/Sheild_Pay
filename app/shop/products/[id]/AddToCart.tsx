"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "../../components/CartProvider";
import type { ShopProduct } from "@/lib/shop/commerce";

export default function AddToCart({ product }: { product: ShopProduct }) {
  const { add } = useCart();
  const router = useRouter();
  const [variant, setVariant] = useState(product.variants[0]?.name ?? "");
  const [added, setAdded] = useState(false);

  const line = {
    productId: product.id,
    handle: product.handle,
    title: product.title,
    price: product.price,
    image: product.image,
    variant,
  };

  return (
    <>
      <label className="shop-kicker" style={{ display: "block", marginTop: "2rem" }}>
        Variant
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          className="shop-field"
          style={{ marginTop: 8, textTransform: "none", letterSpacing: "normal" }}
        >
          {product.variants.map((v) => (
            <option key={v.id} value={v.name} disabled={!v.available}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <div className="shop-actions">
        <button
          type="button"
          onClick={() => {
            add(line);
            setAdded(true);
          }}
          className="shop-btn-primary"
        >
          {added ? "Added to cart" : "Add to cart"}
        </button>
        <button
          type="button"
          onClick={() => {
            add(line);
            router.push("/shop/checkout");
          }}
          className="shop-btn-secondary"
        >
          Buy now
        </button>
      </div>
    </>
  );
}
