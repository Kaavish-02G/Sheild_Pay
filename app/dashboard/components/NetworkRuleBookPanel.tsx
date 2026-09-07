"use client";

import { useEffect, useMemo, useState } from "react";
import type { RulePackDisplay, VerifiedEvidencePackage } from "@/shared/schemas";

const NETWORKS = ["visa", "mastercard", "amex", "rupay"] as const;

interface NetworkRuleBookPanelProps {
  cardNetwork?: string;
  canonicalReason?: string;
  rulePack?: RulePackDisplay;
  validation?: VerifiedEvidencePackage["validation"];
  compact?: boolean;
}

function formatReason(reason?: string): string {
  return (reason ?? "ITEM_NOT_RECEIVED").replace(/_/g, " ");
}

export default function NetworkRuleBookPanel({
  cardNetwork = "visa",
  canonicalReason,
  rulePack,
  validation,
  compact = false,
}: NetworkRuleBookPanelProps) {
  const [selectedNetwork, setSelectedNetwork] = useState(
    (rulePack?.network ?? cardNetwork ?? "visa").toLowerCase()
  );
  const [browsePack, setBrowsePack] = useState<RulePackDisplay | null>(rulePack ?? null);

  const activeReason = rulePack?.canonicalReason ?? canonicalReason ?? "ITEM_NOT_RECEIVED";
  const displayPack = rulePack ?? browsePack;

  useEffect(() => {
    if (rulePack) {
      setBrowsePack(rulePack);
      setSelectedNetwork(rulePack.network);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams({
        network: selectedNetwork,
        reason: activeReason,
      });
      const res = await fetch(`/api/core/rules?${params.toString()}`, { cache: "no-store" });
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as { rulePack?: RulePackDisplay };
      if (data.rulePack && !cancelled) {
        setBrowsePack(data.rulePack);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [rulePack, selectedNetwork, activeReason]);

  const validationById = useMemo(() => {
    const map = new Map<string, { passed: boolean; value?: string }>();
    validation?.checks.forEach((check) => {
      map.set(check.id, { passed: check.passed, value: check.value });
    });
    return map;
  }, [validation]);

  if (!displayPack) {
    return (
      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-sm text-slate-500">Loading card-network rule book…</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100">
            Card Network Rule Book
          </h3>
          <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-300/80">
            AI strategy, evidence collection, and rebuttal run against these{" "}
            {displayPack.network.toUpperCase()} requirements.
          </p>
        </div>
        {!rulePack && !compact && (
          <label className="text-xs text-blue-900 dark:text-blue-200">
            Browse provider
            <select
              value={selectedNetwork}
              onChange={(event) => setSelectedNetwork(event.target.value)}
              className="ml-2 rounded-md border border-blue-200 bg-white px-2 py-1 text-xs dark:border-blue-800 dark:bg-slate-900"
            >
              {NETWORKS.map((network) => (
                <option key={network} value={network}>
                  {network.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-blue-100 px-2.5 py-1 font-semibold uppercase text-blue-900 dark:bg-blue-900/50 dark:text-blue-100">
          {displayPack.network}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-blue-900 dark:bg-slate-900 dark:text-blue-100">
          {formatReason(displayPack.canonicalReason)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-200">
            Required evidence
          </h4>
          <ul className="mt-2 space-y-2">
            {displayPack.requirements.map((requirement) => {
              const result = validationById.get(requirement.id);
              const status = result
                ? result.passed
                  ? "pass"
                  : "fail"
                : validation
                  ? "pending"
                  : "required";

              return (
                <li
                  key={requirement.id}
                  className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm dark:border-blue-900 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {requirement.label}
                      </p>
                      <p className="text-xs text-slate-500">{requirement.id}</p>
                      {result?.value && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {result.value}
                        </p>
                      )}
                    </div>
                    <span
                      className={
                        status === "pass"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : status === "fail"
                            ? "text-red-600 dark:text-red-400"
                            : "text-slate-500"
                      }
                    >
                      {status === "pass"
                        ? "Pass"
                        : status === "fail"
                          ? "Fail"
                          : validation
                            ? "Pending"
                            : "Required"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-900 dark:text-blue-200">
            Evidence tools (deterministic)
          </h4>
          <ul className="mt-2 space-y-2">
            {displayPack.tools.map((tool) => (
              <li
                key={tool.name}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm dark:border-blue-900 dark:bg-slate-900"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">{tool.label}</p>
                <p className="text-xs text-slate-500">{tool.name}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!compact && (
        <p className="mt-4 text-xs text-blue-900/80 dark:text-blue-200/80">
          Source: <code className="rounded bg-white/70 px-1 dark:bg-slate-900">shared/rules/network-rules.json</code>
        </p>
      )}
    </section>
  );
}
