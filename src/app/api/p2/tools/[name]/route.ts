import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  EVIDENCE_TOOL_NAMES,
  invokeEvidenceTool,
  type EvidenceToolName,
} from "@/lib/p2/evidence-tools";
import { SchemaValidationError } from "@/lib/p2/validate";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  orderId: z.string().min(1),
});

const toolNameSet = new Set<string>(EVIDENCE_TOOL_NAMES);

function isEvidenceToolName(name: string): name is EvidenceToolName {
  return toolNameSet.has(name);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await context.params;
    if (!isEvidenceToolName(name)) {
      return NextResponse.json(
        {
          error: `Unknown evidence tool: ${name}`,
          available: EVIDENCE_TOOL_NAMES,
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await invokeEvidenceTool(name, parsed.data.orderId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SchemaValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          schema: error.schemaName,
          details: error.issues,
        },
        { status: 500 }
      );
    }

    console.error(`[P2 tools/${(await context.params).name}] Error:`, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Evidence tool call failed",
      },
      { status: 500 }
    );
  }
}
