import type { Metadata } from "next";
import { CartProvider } from "./components/CartProvider";
import StoreHeader from "./components/StoreHeader";
import StoreFooter from "./components/StoreFooter";
import ShopLightTheme from "./components/ShopLightTheme";
import "./shop.css";

export const metadata: Metadata = {
  title: "Northline — Modern essentials",
  description: "Shop apparel, home, and tech. File a dispute from your order.",
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <ShopLightTheme />
      <div className="shop-shell">
        <StoreHeader />
        <main className="shop-main">{children}</main>
        <StoreFooter />
      </div>
    </CartProvider>
  );
}
