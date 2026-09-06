import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateDisputeResponse } from "@/lib/p4/response-generator";
import { fetchEvidencePackage } from "@/lib/p4/api-client";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  disputeId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { disputeId } = parsed.data;
    const evidence = await fetchEvidencePackage(disputeId);
    const responseText = await generateDisputeResponse(evidence);

    return NextResponse.json({ responseText });
  } catch (error) {
    console.error("[P4 generate-response] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate dispute response",
      },
      { status: 500 }
    );
  }
}
