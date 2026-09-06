import type { Metadata } from "next";
import DashboardNav from "./components/DashboardNav";
import { ThemeProvider } from "./components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShieldPay Dashboard",
  description: "AI-powered chargeback and dispute automation",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <DashboardNav />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </ThemeProvider>
  );
}
