"use client";

import { useCallback, useEffect, useState } from "react";
import type { MerchantSettings } from "@/shared/schemas";
import {
  fetchMerchantSettings,
  getDefaultMerchantId,
  updateMerchantSettings,
} from "@/lib/p4/api-client";

export default function SettingsPage() {
  const merchantId = getDefaultMerchantId();
  const [settings, setSettings] = useState<MerchantSettings | null>(null);
  const [persisted, setPersisted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const result = await fetchMerchantSettings(merchantId);
    setSettings(result.settings);
    setPersisted(result.persisted);
    setLoading(false);
  }, [merchantId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setSaved(false);
    const result = await updateMerchantSettings(merchantId, settings);
    setSettings(result.settings);
    setPersisted(result.persisted);
    setSaving(false);
    setSaved(true);
  };

  if (loading || !settings) {
    return (
      <div className="text-center text-slate-400 dark:text-slate-500">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        Automation Settings
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        ShieldPay runs fully agentic by default. Disputes are auto-investigated,
        responded to, and submitted without merchant action — unless they exceed
        your review amount limit.
      </p>

      {!persisted && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          Settings could not be loaded from the server — showing defaults.
          Changes may not persist until P1 exposes{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">
            GET/PATCH /api/core/merchants/:id/settings
          </code>
          .
        </div>
      )}

      <form onSubmit={handleSave} className="mt-8 space-y-8">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20">
          <label className="block text-sm font-semibold text-blue-900 dark:text-blue-200">
            Review Amount Limit
          </label>
          <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
            Disputes at or below this amount are fully automated (investigate →
            respond → submit). Above this limit, you receive a notification and
            must approve before submission.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-blue-800 dark:text-blue-300">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={settings.reviewAmountLimit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  reviewAmountLimit: Number(e.target.value),
                })
              }
              className="w-full max-w-xs rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-blue-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Auto-Submit Threshold: {settings.autoSubmitThreshold}
          </label>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Scores below this require merchant approval before submission. Set to
            35 to intervene on weaker cases while still allowing the AI to investigate.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.autoSubmitThreshold}
            onChange={(e) =>
              setSettings({
                ...settings,
                autoSubmitThreshold: Number(e.target.value),
              })
            }
            className="mt-3 w-full max-w-md accent-blue-600"
          />
          <div className="mt-1 flex max-w-md justify-between text-xs text-slate-400">
            <span>0 (always review)</span>
            <span>35</span>
            <span>100 (always auto)</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Minimum Evidence Score: {settings.minEvidenceScore}
          </label>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Disputes below this confidence score are flagged as insufficient and
            escalated — never auto-submitted.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.minEvidenceScore}
            onChange={(e) =>
              setSettings({ ...settings, minEvidenceScore: Number(e.target.value) })
            }
            className="mt-3 w-full max-w-md accent-blue-600"
          />
          <div className="mt-1 flex max-w-md justify-between text-xs text-slate-400">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/50">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            How confidence scores are calculated
          </h2>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            The AI agent scores evidence from 0–100 using a weighted checklist during
            investigation:
          </p>
          <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            <li>Delivery confirmed — up to +30</li>
            <li>Tracking matches fulfillment — up to +20</li>
            <li>Clean customer history — up to +15</li>
            <li>Payment captured with AVS/CVV match — up to +15</li>
            <li>No prior refunds on order — +10</li>
            <li>Complete fulfillment record — +10</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Below <strong>{settings.minEvidenceScore}</strong> = insufficient (escalated).
            Between <strong>{settings.minEvidenceScore}</strong> and{" "}
            <strong>{settings.autoSubmitThreshold}</strong> = merchant review required.
            At or above <strong>{settings.autoSubmitThreshold}</strong> = eligible for
            auto-submit (if amount is within your review limit).
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              {persisted ? "Settings saved." : "Saved locally (not persisted to server)."}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
