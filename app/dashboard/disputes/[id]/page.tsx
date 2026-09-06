import { Suspense } from "react";
import DisputeDetailPage from "./DisputeDetailClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-slate-400 dark:text-slate-500">
          Opening live agent view…
        </div>
      }
    >
      <DisputeDetailPage />
    </Suspense>
  );
}
