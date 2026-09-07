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
    <section className="mt-12">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
        {MOCK_ALERT_DISCLAIMER}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
            ShieldPay Mock Alerts
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            Simulated Pre-Dispute Alerts
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Auto-refunds weak cases before a chargeback is filed. Strong delivery proof is left
            for the dispute desk to contest.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-300">Mock Alerts</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => void toggleEnabled()}
            className={`relative h-7 w-12 rounded-full transition ${
              enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {(
          [
            ["Auto-refunded", metrics.refunded, "text-emerald-700 dark:text-emerald-300"],
            ["Contesting", metrics.skipped, "text-sky-700 dark:text-sky-300"],
            ["Already handled", metrics.already_handled, "text-slate-700 dark:text-slate-200"],
          ] as const
        ).map(([label, data, color]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{data.count}</p>
            <p className="mt-1 text-sm text-slate-500">${data.total.toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">How it works</h3>
          <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                1
              </span>
              Checkout emits a simulated pre-dispute signal.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                2
              </span>
              ShieldPay matches the Northline order and scores tracking.
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                3
              </span>
              Weak evidence auto-refunds; strong evidence is contested on the dispute.
            </li>
          </ol>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Prevention trend
          </h3>
          <p className="mt-1 text-xs text-slate-400">Auto-refunds vs contesting (recent alerts)</p>
          <svg viewBox="0 0 220 40" className="mt-4 h-24 w-full" aria-hidden>
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="3"
              points={points}
            />
            <polygon
              fill="rgba(37,99,235,0.12)"
              points={`0,40 ${points} 220,40`}
            />
          </svg>
          {alerts.some((a) => a.outcome === "refunded") ? (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
              Auto-refunds in this demo prevented follow-on chargebacks for weak-evidence orders.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Place a Northline order to plot simulated prevention data.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Setup your payment processors
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Select the processor ShieldPay should use when submitting evidence. Demo Connect stores
          the choice only — no live OAuth.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Payment processor *
            <select
              value={processor}
              onChange={(e) =>
                setProcessor(e.target.value as "stripe" | "paypal" | "razorpay")
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
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
            className="self-end rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : connected ? "Connected" : "Connect"}
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Statement descriptor *
          <p className="mt-1 font-normal text-xs text-slate-500">
            Short name that appears on the customer&apos;s card statement for this demo store.
          </p>
          <input
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        {showExtra ? (
          <input
            value={extraDescriptor}
            onChange={(e) => setExtraDescriptor(e.target.value)}
            placeholder="Second descriptor"
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowExtra(true)}
            className="mt-2 text-sm font-medium text-blue-600"
          >
            + Add descriptor
          </button>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent Mock Alerts</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No simulated signals yet. Place an order in the Northline store.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
            {alerts.map((alert) => {
              const disputeId = disputeByOrder[alert.orderId];
              return (
                <li
                  key={alert.idempotencyKey}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {alert.orderId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {alert.riskReason} · ${dollars(alert.amount).toFixed(2)} ·{" "}
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{alert.message}</p>
                    {disputeId ? (
                      <Link
                        href={`/dashboard/disputes/${encodeURIComponent(disputeId)}`}
                        className="mt-1 inline-block text-xs font-medium text-blue-600"
                      >
                        Open dispute
                      </Link>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      alert.outcome === "refunded"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : alert.outcome === "skipped"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    }`}
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
