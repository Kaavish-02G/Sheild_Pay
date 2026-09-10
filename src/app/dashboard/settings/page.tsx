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
    return <div className="dash-muted text-sm">Loading settings…</div>;
  }

  return (
    <div className="max-w-2xl">
      <p className="dash-kicker">Automation</p>
      <h1 className="dash-title mt-2">Thresholds</h1>
      <p className="dash-muted mt-2 text-sm leading-6">
        ShieldPay investigates every case. Auto-submit only fires when score, evidence, and
        amount sit inside these limits.
      </p>

      {!persisted && (
        <div className="dash-banner dash-banner-warn mt-4 text-sm">
          Settings could not be loaded from the server — showing defaults.
        </div>
      )}

      <form onSubmit={handleSave} className="mt-8 space-y-8">
        <div className="dash-card p-5">
          <label className="block text-sm font-semibold">Review amount limit</label>
          <p className="dash-muted mt-1 text-xs leading-5">
            At or below this amount, qualifying cases auto-submit. Above it, the desk must
            approve.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm">$</span>
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
              className="dash-input max-w-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Auto-submit threshold: {settings.autoSubmitThreshold}
          </label>
          <p className="dash-muted mt-1 text-xs">
            Scores below this require merchant approval before submission.
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
            className="mt-3 w-full max-w-md accent-[var(--dash-ink)]"
          />
          <div className="dash-muted mt-1 flex max-w-md justify-between text-xs">
            <span>Always review</span>
            <span>Always auto</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">
            Minimum evidence score: {settings.minEvidenceScore}
          </label>
          <p className="dash-muted mt-1 text-xs">
            Below this, cases are marked insufficient and never auto-submitted.
          </p>
          <input
            type="range"
            min={0}
            max={100}
            value={settings.minEvidenceScore}
            onChange={(e) =>
              setSettings({ ...settings, minEvidenceScore: Number(e.target.value) })
            }
            className="mt-3 w-full max-w-md accent-[var(--dash-ink)]"
          />
        </div>

        <div className="dash-card p-5">
          <h2 className="text-sm font-semibold">How scores are calculated</h2>
          <ul className="dash-muted mt-3 space-y-1 text-xs leading-5">
            <li>Delivery confirmed — up to +30</li>
            <li>Tracking matches fulfillment — up to +20</li>
            <li>Clean customer history — up to +15</li>
            <li>Payment captured with AVS/CVV match — up to +15</li>
            <li>No prior refunds on order — +10</li>
            <li>Complete fulfillment record — +10</li>
          </ul>
          <p className="dash-muted mt-3 text-xs leading-5">
            Below <strong>{settings.minEvidenceScore}</strong> = insufficient. Between{" "}
            <strong>{settings.minEvidenceScore}</strong> and{" "}
            <strong>{settings.autoSubmitThreshold}</strong> = review. At or above{" "}
            <strong>{settings.autoSubmitThreshold}</strong> = eligible for auto-submit.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="dash-btn-primary">
            {saving ? "Saving…" : "Save settings"}
          </button>
          {saved && (
            <span className="text-sm text-[var(--dash-ok)]">
              {persisted ? "Saved." : "Saved locally (not persisted to server)."}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
