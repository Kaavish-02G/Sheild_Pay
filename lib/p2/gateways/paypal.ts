import type { GatewayAdapter, SubmissionResult, VerifiedEvidencePackage } from "@/shared/schemas";
import {
  buildEvidenceText,
  normalizeGatewayError,
  withRetry,
} from "./utils";

function getPayPalConfig(): {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
} | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  const mode = process.env.PAYPAL_MODE ?? "sandbox";
  const baseUrl =
    mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  return { clientId, clientSecret, baseUrl };
}

async function getPayPalAccessToken(
  config: NonNullable<ReturnType<typeof getPayPalConfig>>
): Promise<string> {
  return withRetry("paypal.oauth", async () => {
    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64");
    const res = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PayPal OAuth failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  });
}

export const paypalGateway: GatewayAdapter = {
  async submitEvidence(
    disputeId: string,
    pkg: VerifiedEvidencePackage
  ): Promise<SubmissionResult> {
    const config = getPayPalConfig();
    if (!config) {
      return {
        success: false,
        error: "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured",
      };
    }

    try {
      const token = await getPayPalAccessToken(config);
      const evidenceText = buildEvidenceText(pkg);

      const res = await withRetry("paypal.provide-evidence", async () => {
        const response = await fetch(
          `${config.baseUrl}/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-evidence`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              notes: evidenceText,
              evidence_type: "OTHER",
            }),
          }
        );
        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `PayPal provide-evidence failed (${response.status}): ${body}`
          );
        }
        return response;
      });

      const data = (await res.json()) as { links?: Array<{ href: string }> };
      return {
        success: true,
        gatewayReference: data.links?.[0]?.href ?? disputeId,
      };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },

  async checkStatus(disputeId: string): Promise<SubmissionResult> {
    const config = getPayPalConfig();
    if (!config) {
      return {
        success: false,
        error: "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured",
      };
    }

    try {
      const token = await getPayPalAccessToken(config);
      const res = await withRetry("paypal.get-dispute", async () => {
        const response = await fetch(
          `${config.baseUrl}/v1/customer/disputes/${encodeURIComponent(disputeId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `PayPal get-dispute failed (${response.status}): ${body}`
          );
        }
        return response;
      });

      const data = (await res.json()) as { status?: string; id?: string };
      const status = data.status ?? "UNKNOWN";
      return {
        success: status !== "LOST" && status !== "CLOSED",
        gatewayReference: data.id ?? disputeId,
        error:
          status === "LOST" || status === "CLOSED"
            ? `Dispute status: ${status}`
            : undefined,
      };
    } catch (error) {
      return { success: false, error: normalizeGatewayError(error) };
    }
  },
};
