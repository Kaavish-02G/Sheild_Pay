import Link from "next/link";
import ProductCard from "./components/ProductCard";
import { listShopProducts } from "@/lib/shop/commerce";
import catalog from "@/shared/shop/catalog.json";

export const dynamic = "force-dynamic";

export default async function ShopHomePage() {
  const products = await listShopProducts();
  const featured = products.filter((p) => p.tags.includes("bestseller")).slice(0, 4);
  const rest = products.slice(0, 8);

  return (
    <div>
      <section className="shop-card shop-hero">
        <div>
          <p className="shop-kicker">Fall 2026</p>
          <h1>Quiet pieces for everyday use.</h1>
          <p className="shop-lede">
            {catalog.store.tagline} Shop, check out, then file a dispute from your order.
          </p>
          <div className="shop-actions">
            <Link href="/shop/products" className="shop-btn-primary">
              Shop the catalog
            </Link>
            <Link href="/shop/account" className="shop-btn-secondary">
              Track an order
            </Link>
          </div>
        </div>
        <div className="shop-grid-2">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="shop-section">
        <div className="shop-section-head">
          <h2>New & notable</h2>
          <Link href="/shop/products" className="shop-muted-link">
            View all
          </Link>
        </div>
        <div className="shop-product-grid">
          {rest.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
