import { NextRequest, NextResponse } from "next/server";
import {
  handleMockPreAlert,
  listMockAlerts,
  MOCK_ALERT_DISCLAIMER,
} from "@/lib/core/mock-alerts";
import { MockPreAlertEventSchema } from "@/shared/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = await listMockAlerts();
    return NextResponse.json({
      disclaimer: MOCK_ALERT_DISCLAIMER,
      alerts,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not list Mock Alerts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = MockPreAlertEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid simulated pre-dispute signal", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const alert = await handleMockPreAlert(parsed.data);
    return NextResponse.json({
      disclaimer: MOCK_ALERT_DISCLAIMER,
      alert,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mock Alerts ingest failed";
    const notFound = /not found|returned 404/i.test(message);
    return NextResponse.json({ error: message }, { status: notFound ? 404 : 500 });
  }
}
