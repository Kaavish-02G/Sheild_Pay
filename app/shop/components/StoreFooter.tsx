import Link from "next/link";

export default function StoreFooter() {
  return (
    <footer className="shop-footer">
      <div className="shop-footer-inner">
        <div>
          <p className="shop-brand">Northline</p>
          <p>
            Demo store for ShieldPay. Checkout, then file a dispute from your order.
          </p>
        </div>
        <div>
          <p className="shop-kicker">Shop</p>
          <ul>
            <li>
              <Link href="/shop/products?collection=apparel">Apparel</Link>
            </li>
            <li>
              <Link href="/shop/products?collection=home">Home</Link>
            </li>
            <li>
              <Link href="/shop/products?collection=tech">Tech</Link>
            </li>
            <li>
              <Link href="/shop/products?collection=accessories">Accessories</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="shop-kicker">Help</p>
          <ul>
            <li>
              <Link href="/shop/shipping">Shipping</Link>
            </li>
            <li>
              <Link href="/shop/returns">Returns</Link>
            </li>
            <li>
              <Link href="/shop/contact">Contact</Link>
            </li>
            <li>
              <Link href="/shop/about">About</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="shop-kicker">Payments</p>
          <p>Visa · Mastercard · Amex · RuPay</p>
          <p>hello@northline.shop</p>
        </div>
      </div>
    </footer>
  );
}
