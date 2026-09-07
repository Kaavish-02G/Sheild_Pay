import { Suspense } from "react";
import DisputeDetailPage from "./DisputeDetailClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="dash-muted text-sm">Opening case…</div>
      }
    >
      <DisputeDetailPage />
    </Suspense>
  );
}
