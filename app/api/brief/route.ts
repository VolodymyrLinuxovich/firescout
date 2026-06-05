import { NextRequest, NextResponse } from "next/server";
import { handleCurrentRisk } from "@/lib/workflow";
import { geocode } from "@/lib/geocode";
import type { BriefRequestBody } from "@/lib/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: BriefRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ownerType, ownerId, locationName, activity, forceRefresh } = body;
  if (!ownerType || !ownerId) {
    return NextResponse.json({ error: "ownerType and ownerId required" }, { status: 400 });
  }

  let entities: Record<string, string> = {};
  if (locationName) entities.location = locationName;
  if (activity) entities.activity = activity;

  const result = await handleCurrentRisk({ ownerType, ownerId, entities, forceRefresh });

  return NextResponse.json({
    reportId: result.reportId ?? null,
    riskLevel: result.riskLevel ?? "WATCH",
    riskScore: result.riskScore ?? 0,
    text: result.text,
    mapUrl: result.mapUrl ?? null,
    imageUrl: result.imageUrl ?? null,
  });
}
