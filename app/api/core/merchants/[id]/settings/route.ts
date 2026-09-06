import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getMerchant,
  toMerchantSettingsResponse,
  updateMerchantSettings,
} from "@/lib/core/models";
import { MerchantSettingsSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const merchant = await getMerchant(context.params.id);
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

    const { reviewAmountLimit: _ignored, ...coreSettings } = parsed.data;
    const updated = await updateMerchantSettings(context.params.id, coreSettings);
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
