import {
  DisputeSchema,
  MerchantSettingsSchema,
  type Dispute,
  type MerchantSettings,
  type VerifiedEvidencePackage,
} from "@/shared/schemas";
import { toDashboardEvidencePackage } from "./evidence-adapter";
import { z } from "zod";
import disputesListMock from "@/shared/mocks/disputes_list.json";
import evidencePackageMock from "@/shared/mocks/evidence_package.json";

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export function getDefaultMerchantId(): string {
  return (
    process.env.NEXT_PUBLIC_MERCHANT_ID ??
    process.env.SHOPIFY_DEV_STORE ??
    "test-store.myshopify.com"
  );
}

// TODO: needs P1 route — GET /api/core/disputes
export async function fetchDisputes(): Promise<Dispute[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/core/disputes`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`P1 disputes returned ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.disputes;
    return z.array(DisputeSchema).parse(list);
  } catch (error) {
    console.error(
      "[P4] GET /api/core/disputes failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

// TODO: needs P1 route — GET /api/core/disputes/:id
export async function fetchDispute(id: string): Promise<Dispute | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/core/disputes/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`P1 dispute detail returned ${res.status}`);
    }
    const data = await res.json();
    return DisputeSchema.parse(data.dispute ?? data);
  } catch (error) {
    console.warn(
      `[P4] GET /api/core/disputes/${id} failed — checking mock fixture. TODO: needs P1 route`,
      error instanceof Error ? error.message : error
    );
    const disputes = z.array(DisputeSchema).parse(disputesListMock);
    return disputes.find((d) => d.disputeId === id) ?? null;
  }
}

export async function fetchDisputeSnapshot(id: string): Promise<{
  dispute: Dispute | null;
  evidence: VerifiedEvidencePackage | null;
}> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/core/disputes/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return { dispute: null, evidence: null };
    }
    const data = await res.json();
    const dispute = DisputeSchema.parse(data.dispute ?? data);
    const evidence = data.evidence
      ? toDashboardEvidencePackage(data.evidence, dispute.reason)
      : null;
    return { dispute, evidence };
  } catch {
    return { dispute: null, evidence: null };
  }
}

export async function fetchEvidencePackage(
  disputeId: string,
  disputeReason = "chargeback",
  options?: { storedOnly?: boolean }
): Promise<VerifiedEvidencePackage> {
  try {
    const stored = await fetch(`${getBaseUrl()}/api/core/disputes/${disputeId}`, {
      cache: "no-store",
    });
    if (stored.ok) {
      const storedData = await stored.json();
      if (storedData.evidence) {
        return toDashboardEvidencePackage(storedData.evidence, disputeReason);
      }
    }
  } catch {
    // fall through
  }

  if (options?.storedOnly) {
    return toDashboardEvidencePackage(
      { disputeId, evidence: {}, confidenceScore: 0, status: "insufficient", ledger: [] },
      disputeReason
    );
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/p3/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disputeId }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`P3 invoke returned ${res.status}`);
    }
    const data = await res.json();
    return toDashboardEvidencePackage(data.package ?? data, disputeReason);
  } catch (error) {
    console.warn(
      `[P4] Evidence fetch failed for ${disputeId} — using mock evidence package`,
      error instanceof Error ? error.message : error
    );
    return toDashboardEvidencePackage(
      { ...evidencePackageMock, disputeId },
      disputeReason
    );
  }
}

// TODO: needs P1 route — GET /api/core/merchants/:id/settings
export async function fetchMerchantSettings(
  merchantId: string
): Promise<{ settings: MerchantSettings; persisted: boolean }> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/core/merchants/${merchantId}/settings`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      throw new Error(`P1 merchant settings GET returned ${res.status}`);
    }
    const data = await res.json();
    return {
      settings: MerchantSettingsSchema.parse(data.settings ?? data),
      persisted: true,
    };
  } catch (error) {
    console.warn(
      `[P4] GET /api/core/merchants/${merchantId}/settings failed — using defaults. TODO: needs P1 route`,
      error instanceof Error ? error.message : error
    );
    return {
      settings: {
        autoSubmitThreshold: 35,
        minEvidenceScore: 25,
        reviewAmountLimit: 500,
        requireApprovalHighValue: true,
        requireApprovalWeakEvidence: true,
        requireApprovalMissingDeliveryProof: false,
        paymentProcessor: "stripe",
        statementDescriptor: "NORTHLINE",
        mockAlertsEnabled: true,
      },
      persisted: false,
    };
  }
}

export async function updateMerchantSettings(
  merchantId: string,
  settings: Partial<MerchantSettings>
): Promise<{ settings: MerchantSettings; persisted: boolean }> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/core/merchants/${merchantId}/settings`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }
    );
    if (!res.ok) {
      throw new Error(`P1 merchant settings PATCH returned ${res.status}`);
    }
    const data = await res.json();
    return {
      settings: MerchantSettingsSchema.parse(data.settings ?? data),
      persisted: true,
    };
  } catch (error) {
    console.warn(
      `[P4] PATCH /api/core/merchants/${merchantId}/settings failed — settings not persisted. TODO: needs P1 route`,
      error instanceof Error ? error.message : error
    );
    const defaults = await fetchMerchantSettings(merchantId);
    return {
      settings: { ...defaults.settings, ...settings },
      persisted: false,
    };
  }
}

export async function simulateDispute(body: {
  orderId: string;
  reason: string;
  amount: number;
}): Promise<{ success: boolean; disputeId?: string; error?: string }> {
  const res = await fetch(`${getBaseUrl()}/api/core/simulate-dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error ?? `Request failed (${res.status})` };
  }
  return { success: true, disputeId: data.disputeId };
}

export type SubmitResult =
  | { success: true; gatewayReference?: string }
  | { success: false; unavailable: true }
  | { success: false; error: string };

export async function submitDispute(
  disputeId: string,
  package_: VerifiedEvidencePackage
): Promise<SubmitResult> {
  const payload = { disputeId, package: package_ };
  try {
    const res = await fetch(`${getBaseUrl()}/api/p2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? `P2 submit returned ${res.status}`);
    }
    return { success: true, gatewayReference: data.gatewayReference };
  } catch (error) {
    console.warn(
      "[P4] POST /api/p2/submit failed:",
      error instanceof Error ? error.message : error
    );
    return { success: false, unavailable: true };
  }
}

export async function sendToPaymentGateway(
  disputeId: string,
  package_: VerifiedEvidencePackage
): Promise<SubmitResult> {
  return submitDispute(disputeId, package_);
}

export async function generateResponse(
  disputeId: string
): Promise<{ responseText: string }> {
  const res = await fetch(`${getBaseUrl()}/api/p4/generate-response`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Generate response failed (${res.status})`);
  }
  return { responseText: data.responseText };
}

export async function runDisputeAutomation(
  disputeId: string
): Promise<import("@/shared/schemas").AutomationResult> {
  const res = await fetch(`${getBaseUrl()}/api/p4/automate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Automation failed (${res.status})`);
  }
  return data;
}

export async function fetchPendingReviews(): Promise<
  import("@/shared/schemas").MerchantNotification[]
> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/p4/pending-reviews`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Pending reviews returned ${res.status}`);
    const data = await res.json();
    return data.notifications ?? [];
  } catch (error) {
    console.warn("[P4] Failed to fetch pending reviews", error);
    return [];
  }
}

export async function submitDisputeAfterReview(
  disputeId: string,
  package_: VerifiedEvidencePackage,
  responseText?: string
): Promise<SubmitResult> {
  const result = await submitDispute(disputeId, package_);
  if (result.success) {
    try {
      await fetch(`${getBaseUrl()}/api/p4/pending-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId }),
      });
    } catch {
      // non-fatal
    }
    console.info(
      `[P4] Merchant approved submission for ${disputeId}`,
      responseText ? "(with response)" : ""
    );
  }
  return result;
}
