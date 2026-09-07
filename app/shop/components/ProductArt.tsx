import { productSwatch } from "@/lib/shop/commerce";

export default function ProductArt({
  image,
  title,
  className = "",
}: {
  image: string;
  title: string;
  className?: string;
}) {
  const swatch = productSwatch(image);
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`shop-art ${className}`}
      style={{ background: swatch.bg, color: swatch.ink }}
      aria-hidden
    >
      <span className="shop-art-initials">{initials}</span>
      <span className="shop-art-label">{title}</span>
    </div>
  );
}
