"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "../components/ProductCard";
import type { ShopProduct } from "@/lib/shop/commerce";
import catalog from "@/shared/shop/catalog.json";

export default function CatalogClient({
  initialProducts,
}: {
  initialProducts: ShopProduct[];
}) {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<ShopProduct[]>(initialProducts);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [collection, setCollection] = useState(searchParams.get("collection") ?? "all");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "featured");

  useEffect(() => {
    const params = new URLSearchParams();
    if (collection) params.set("collection", collection);
    if (q) params.set("q", q);
    if (sort && sort !== "featured") params.set("sort", sort);
    fetch(`/api/shop/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setProducts(data.products ?? []));
  }, [q, collection, sort]);

  return (
    <div>
      <h1 className="shop-page-title">Catalog</h1>
      <p className="shop-lede">Search, filter, and add to cart.</p>

      <div className="shop-filters">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products"
          className="shop-field"
        />
        <select
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
          className="shop-field"
        >
          {catalog.collections.map((c) => (
            <option key={c.handle} value={c.handle}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="shop-field"
        >
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
      </div>

      <p className="shop-muted" style={{ marginTop: "1rem" }}>
        {products.length} products
      </p>
      <div className="shop-product-grid cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
