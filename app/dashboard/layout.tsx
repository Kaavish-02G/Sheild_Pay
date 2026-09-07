import type { Metadata } from "next";
import { Suspense } from "react";
import { Instrument_Serif, Source_Sans_3 } from "next/font/google";
import DashboardNav from "./components/DashboardNav";
import { ThemeProvider } from "./components/ThemeProvider";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-dash-sans",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dash-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ShieldPay — Merchant desk",
  description: "Chargeback automation, evidence scoring, and payment-gateway submit",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className={`${sans.variable} ${serif.variable} dash-root`}>
        <div className="flex min-h-screen flex-col md:flex-row">
          <Suspense fallback={<div className="dash-sidebar hidden md:block md:w-60" />}>
            <DashboardNav />
          </Suspense>
          <div className="min-w-0 flex-1">
            <header className="border-b border-[var(--dash-line)] px-6 py-3">
              <p className="text-[12px] text-[var(--dash-muted)]">
                Demo desk · Mock Alerts are simulated · not Ethoca / Verifi
              </p>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
