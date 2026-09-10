"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/dashboard", label: "Cases", view: "cases" as const },
  { href: "/dashboard?view=alerts", label: "Mock Alerts", view: "alerts" as const },
  { href: "/dashboard/settings", label: "Settings", view: null },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  return (
    <aside className="dash-sidebar flex w-full flex-col justify-between px-5 py-6 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
      <div>
        <Link href="/dashboard" className="block">
          <p className="dash-kicker text-[10px]" style={{ color: "#c4a066" }}>
            Merchant desk
          </p>
          <p className="dash-serif mt-1 text-[1.45rem] tracking-tight text-[#f4efe8]">
            ShieldPay
          </p>
        </Link>
        <p className="mt-3 max-w-[12rem] text-[12px] leading-5 text-[#8a8278]">
          Chargeback operations for Northline. Simulated alerts, scored evidence, gateway submit.
        </p>
        <nav className="mt-8 space-y-1">
          {NAV.map((item) => {
            const onSettings = pathname.startsWith("/dashboard/settings");
            const onCase = pathname.startsWith("/dashboard/disputes");
            const onDesk = pathname === "/dashboard";
            const active =
              item.view === "alerts"
                ? onDesk && view === "alerts"
                : item.view === "cases"
                  ? (onDesk && view !== "alerts") || onCase
                  : onSettings;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`dash-nav-link ${active ? "dash-nav-link-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-10 flex items-center justify-between gap-3 border-t border-white/10 pt-5">
        <Link href="/shop" className="text-[12px] text-[#c4a066] hover:text-[#f4efe8]">
          Northline store
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
