"use client";

import { Suspense } from "react";
import DashboardHome from "./DashboardHome";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="dash-muted text-sm">Opening merchant desk…</p>}>
      <DashboardHome />
    </Suspense>
  );
}
