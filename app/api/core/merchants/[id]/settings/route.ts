import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getMerchant,
  toMerchantSettingsResponse,
  updateMerchantSettings,
  upsertMerchant,
  upsertMockMerchant,
} from "@/lib/core/models";
import { MerchantSettingsSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

async function resolveMerchant(id: string) {
  let merchant = await getMerchant(id);
  if (merchant) {
    return merchant;
  }

  if (process.env.MOCK_COMMERCE_MODE === "true" || process.env.PLATFORM_MOCK_MODE === "true") {
    return upsertMockMerchant(id);
  }

  if (process.env.SHOPIFY_MOCK_MODE === "true" || process.env.NODE_ENV === "test") {
    merchant = await upsertMerchant(id, "mock-token");
    return merchant;
  }

  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const merchant = await resolveMerchant(context.params.id);
    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: MerchantSettingsSchema.parse(
        toMerchantSettingsResponse(merchant.settings)
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = MerchantSettingsSchema.partial().safeParse(body.settings ?? body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateMerchantSettings(context.params.id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    return NextResponse.json({
      settings: MerchantSettingsSchema.parse(
        toMerchantSettingsResponse(updated.settings)
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
