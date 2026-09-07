import { NextRequest, NextResponse } from "next/server";
import {
  CARD_NETWORKS,
  formatRulePackDisplay,
  getFullRuleBook,
  getNetworkRuleBook,
  loadRulePack,
} from "@/lib/core/rules";
import type { CanonicalDisputeReason, CardNetwork } from "@/shared/schemas";

export const dynamic = "force-dynamic";

function parseNetwork(value: string | null): CardNetwork | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return CARD_NETWORKS.includes(normalized as CardNetwork)
    ? (normalized as CardNetwork)
    : null;
}

export async function GET(request: NextRequest) {
  try {
    const network = parseNetwork(request.nextUrl.searchParams.get("network"));
    const reason = request.nextUrl.searchParams.get("reason") as CanonicalDisputeReason | null;

    if (network && reason) {
      return NextResponse.json({
        rulePack: formatRulePackDisplay(loadRulePack(network, reason)),
      });
    }

    if (network) {
      return NextResponse.json({
        network,
        ruleBook: getNetworkRuleBook(network),
      });
    }

    return NextResponse.json({
      networks: CARD_NETWORKS,
      ruleBook: getFullRuleBook(),
    });
  } catch (error) {
    console.error("[rules] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load rule book" },
      { status: 500 }
    );
  }
}
