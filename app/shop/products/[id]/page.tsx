import { notFound } from "next/navigation";
import ProductArt from "../../components/ProductArt";
import AddToCart from "./AddToCart";
import { getShopProduct } from "@/lib/shop/commerce";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getShopProduct(params.id);
  if (!product) notFound();

  return (
    <div className="shop-split shop-split-2">
      <ProductArt image={product.image} title={product.title} className="shop-art-lg" />
      <div>
        <p className="shop-kicker">{product.category}</p>
        <h1 className="shop-page-title">{product.title}</h1>
        <p className="shop-lede" style={{ fontSize: "1.1rem" }}>
          ${product.price.toFixed(2)}
          {product.compareAtPrice ? (
            <span className="shop-compare" style={{ marginLeft: 8 }}>
              ${product.compareAtPrice.toFixed(2)}
            </span>
          ) : null}
        </p>
        <p className="shop-muted" style={{ marginTop: 8 }}>
          {product.rating} ★ · {product.reviewCount} reviews · {product.inventory} in stock
        </p>
        <p className="shop-lede">{product.description}</p>
        <AddToCart product={product} />
      </div>
    </div>
  );
}
