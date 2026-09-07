"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MOCK_ALERT_DISCLAIMER,
  type Dispute,
  type MerchantSettings,
  type MockAlertRecord,
} from "@/shared/schemas";
import {
  fetchDisputes,
  fetchMerchantSettings,
  updateMerchantSettings,
} from "@/lib/p4/api-client";

const MERCHANT_ID = "demo-merchant";

function dollars(amount: number): number {
  return amount >= 100 ? amount / 100 : amount;
}

function outcomeLabel(outcome: MockAlertRecord["outcome"]): string {
  if (outcome === "refunded") return "Auto-refund";
  if (outcome === "skipped") return "Contesting";
  return "Already handled";
}

export default function MockAlertsPanel() {
  const [alerts, setAlerts] = useState<MockAlertRecord[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [settings, setSettings] = useState<MerchantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [processor, setProcessor] = useState<"stripe" | "paypal" | "razorpay">("stripe");
  const [descriptor, setDescriptor] = useState("NORTHLINE");
  const [extraDescriptor, setExtraDescriptor] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [alertRes, disputeList, merchant] = await Promise.all([
        fetch("/api/core/mock-alerts").then((res) => res.json()),
        fetchDisputes(),
        fetchMerchantSettings(MERCHANT_ID),
      ]);
      setAlerts(alertRes.alerts ?? []);
      setDisputes(disputeList);
      setSettings(merchant.settings);
      setProcessor(merchant.settings.paymentProcessor ?? "stripe");
      setDescriptor(merchant.settings.statementDescriptor ?? "NORTHLINE");
      setExtraDescriptor(merchant.settings.extraDescriptor ?? "");
      setShowExtra(Boolean(merchant.settings.extraDescriptor));
      setEnabled(merchant.settings.mockAlertsEnabled !== false);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disputeByOrder = useMemo(() => {
    const map: Record<string, string> = {};
    for (const dispute of disputes) {
      map[dispute.orderId] = dispute.disputeId;
    }
    return map;
  }, [disputes]);

  const metrics = useMemo(() => {
    const groups = {
      refunded: { count: 0, total: 0 },
      skipped: { count: 0, total: 0 },
      already_handled: { count: 0, total: 0 },
    };
    for (const alert of alerts) {
      groups[alert.outcome].count += 1;
      groups[alert.outcome].total += dollars(alert.amount);
    }
    return groups;
  }, [alerts]);

  const spark = useMemo(() => {
    const recent = [...alerts].reverse().slice(-12);
    return recent.map((alert) =>
      alert.outcome === "refunded" ? 28 : alert.outcome === "skipped" ? 16 : 8
    );
  }, [alerts]);

  async function saveProcessor() {
    setSaving(true);
    const result = await updateMerchantSettings(MERCHANT_ID, {
      ...(settings ?? {}),
      paymentProcessor: processor,
      statementDescriptor: descriptor,
      extraDescriptor: extraDescriptor || undefined,
      mockAlertsEnabled: enabled,
    });
    setSettings(result.settings);
    setConnected(true);
    setSaving(false);
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    const result = await updateMerchantSettings(MERCHANT_ID, {
      ...(settings ?? {}),
      mockAlertsEnabled: next,
    });
    setSettings(result.settings);
  }

  const points =
    spark.length > 1
      ? spark
          .map((y, i) => `${(i / (spark.length - 1)) * 220},${36 - y}`)
          .join(" ")
      : "0,20 220,20";

  return (
    <section>
      <div className="dash-banner dash-banner-info text-sm leading-6">
        {MOCK_ALERT_DISCLAIMER}
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="dash-kicker">ShieldPay Mock Alerts</p>
          <h2 className="dash-title mt-2">Simulated pre-dispute</h2>
          <p className="dash-muted mt-2 max-w-xl text-sm leading-6">
            Auto-refunds weak cases before a chargeback is filed. Strong delivery proof is
            left for the dispute desk to contest.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">Mock Alerts</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => void toggleEnabled()}
            className="dash-switch"
          >
            <span />
          </button>
          <button type="button" onClick={() => void load()} className="dash-btn-ghost">
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["Auto-refunded", metrics.refunded],
            ["Contesting", metrics.skipped],
            ["Already handled", metrics.already_handled],
          ] as const
        ).map(([label, data]) => (
          <div key={label} className="dash-card p-5">
            <p className="dash-muted text-sm">{label}</p>
            <p className="dash-serif mt-2 text-4xl tabular">{data.count}</p>
            <p className="dash-muted mt-1 text-sm tabular">${data.total.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="dash-card p-6">
          <h3 className="text-sm font-semibold">How it works</h3>
          <ol className="dash-muted mt-4 space-y-4 text-sm leading-6">
            {[
              "Checkout emits a simulated pre-dispute signal.",
              "ShieldPay matches the Northline order and scores tracking.",
              "Weak evidence auto-refunds; strong evidence is contested on the dispute.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--dash-line-strong)] text-[11px] text-[var(--dash-ink)]">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="dash-card p-6">
          <h3 className="text-sm font-semibold">Prevention trend</h3>
          <p className="dash-muted mt-1 text-xs">Auto-refunds vs contesting (recent alerts)</p>
          <svg viewBox="0 0 220 40" className="mt-4 h-24 w-full" aria-hidden>
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              points={points}
              className="text-[var(--dash-gold)]"
            />
            <polygon
              fill="currentColor"
              className="text-[var(--dash-gold)] opacity-15"
              points={`0,40 ${points} 220,40`}
            />
          </svg>
          {alerts.some((a) => a.outcome === "refunded") ? (
            <p className="dash-banner dash-banner-warn mt-3 text-xs leading-5">
              Auto-refunds in this demo prevented follow-on chargebacks for weak-evidence orders.
            </p>
          ) : (
            <p className="dash-muted mt-2 text-xs">
              Place a Northline order to plot simulated prevention data.
            </p>
          )}
        </div>
      </div>

      <div className="dash-card mt-6 p-6">
        <h3 className="dash-serif text-2xl">Payment processors</h3>
        <p className="dash-muted mt-1 text-sm leading-6">
          Select the processor ShieldPay should use when submitting evidence. Demo Connect
          stores the choice only — no live OAuth.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-medium">
            Payment processor *
            <select
              value={processor}
              onChange={(e) =>
                setProcessor(e.target.value as "stripe" | "paypal" | "razorpay")
              }
              className="dash-select mt-1"
            >
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="razorpay">Razorpay</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void saveProcessor()}
            disabled={saving}
            className="dash-btn-primary self-end"
          >
            {saving ? "Saving…" : connected ? "Connected" : "Connect"}
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium">
          Statement descriptor *
          <p className="dash-muted mt-1 font-normal text-xs">
            Short name that appears on the customer&apos;s card statement for this demo store.
          </p>
          <input
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            className="dash-input mt-2"
          />
        </label>
        {showExtra ? (
          <input
            value={extraDescriptor}
            onChange={(e) => setExtraDescriptor(e.target.value)}
            placeholder="Second descriptor"
            className="dash-input mt-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowExtra(true)}
            className="mt-3 text-sm font-medium text-[var(--dash-gold)]"
          >
            + Add descriptor
          </button>
        )}
      </div>

      <div className="dash-card mt-6 p-6">
        <h3 className="text-sm font-semibold">Recent Mock Alerts</h3>
        {loading ? (
          <p className="dash-muted mt-4 text-sm">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="dash-muted mt-4 text-sm">
            No simulated signals yet. Place an order in the Northline store.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--dash-line)]">
            {alerts.map((alert) => {
              const disputeId = disputeByOrder[alert.orderId];
              return (
                <li
                  key={alert.idempotencyKey}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-sm font-medium">{alert.orderId}</p>
                    <p className="dash-muted text-xs">
                      {alert.riskReason} · ${dollars(alert.amount).toFixed(2)} ·{" "}
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                    <p className="dash-muted mt-1 text-xs leading-5">{alert.message}</p>
                    {disputeId ? (
                      <Link
                        href={`/dashboard/disputes/${encodeURIComponent(disputeId)}`}
                        className="mt-1 inline-block text-xs font-medium text-[var(--dash-gold)]"
                      >
                        Open dispute
                      </Link>
                    ) : null}
                  </div>
                  <span
                    className={
                      alert.outcome === "refunded"
                        ? "dash-chip dash-chip-ok"
                        : alert.outcome === "skipped"
                          ? "dash-chip"
                          : "dash-chip dash-chip-warn"
                    }
                  >
                    {outcomeLabel(alert.outcome)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
