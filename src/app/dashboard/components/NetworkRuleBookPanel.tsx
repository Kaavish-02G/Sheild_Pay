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
      <section className="dash-card p-4">
        <p className="dash-muted text-sm">Loading card-network rule book…</p>
      </section>
    );
  }

  return (
    <section className="dash-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="dash-kicker">Rule book</p>
          <h3 className="dash-serif mt-1 text-2xl">
            {displayPack.network.toUpperCase()} requirements
          </h3>
          <p className="dash-muted mt-1 text-xs leading-5">
            Collection, scoring, and rebuttal run against this network pack.
          </p>
        </div>
        {!rulePack && !compact && (
          <label className="text-xs">
            Browse provider
            <select
              value={selectedNetwork}
              onChange={(event) => setSelectedNetwork(event.target.value)}
              className="dash-select mt-1 max-w-[10rem] text-xs"
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

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="dash-chip">{displayPack.network}</span>
        <span className="dash-chip">{formatReason(displayPack.canonicalReason)}</span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="dash-kicker">Required evidence</h4>
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
                  className="rounded-lg border border-[var(--dash-line)] px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{requirement.label}</p>
                      <p className="dash-muted text-xs">{requirement.id}</p>
                      {result?.value && (
                        <p className="dash-muted mt-1 text-xs">{result.value}</p>
                      )}
                    </div>
                    <span
                      className={
                        status === "pass"
                          ? "text-[var(--dash-ok)]"
                          : status === "fail"
                            ? "text-[var(--dash-bad)]"
                            : "dash-muted"
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
          <h4 className="dash-kicker">Evidence tools</h4>
          <ul className="mt-2 space-y-2">
            {displayPack.tools.map((tool) => (
              <li
                key={tool.name}
                className="rounded-lg border border-[var(--dash-line)] px-3 py-2 text-sm"
              >
                <p className="font-medium">{tool.label}</p>
                <p className="dash-muted text-xs">{tool.name}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {!compact && (
        <p className="dash-muted mt-4 text-xs">
          Source: shared/rules/network-rules.json
        </p>
      )}
    </section>
  );
}
