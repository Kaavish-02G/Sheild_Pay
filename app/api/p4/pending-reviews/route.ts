import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dismissReviewNotification, getPendingReviews } from "@/lib/p4/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ notifications: getPendingReviews() });
}

const DismissSchema = z.object({ disputeId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = DismissSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  dismissReviewNotification(parsed.data.disputeId);
  return NextResponse.json({ success: true });
}
