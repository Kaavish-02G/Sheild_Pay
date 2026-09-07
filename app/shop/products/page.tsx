import { Suspense } from "react";
import CatalogClient from "./CatalogClient";
import { listShopProducts } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listShopProducts();
  return (
    <Suspense fallback={<p className="shop-muted">Loading catalog…</p>}>
      <CatalogClient initialProducts={products} />
    </Suspense>
  );
}
