import { NextRequest, NextResponse } from "next/server";
import { handleCurrentRisk, handleWhatChanged } from "@/lib/workflow";
import type { BriefRequestBody } from "@/lib/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: BriefRequestBody & { intent?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ownerType, ownerId, locationName, activity, forceRefresh } = body;
  if (!ownerType || !ownerId) {
    return NextResponse.json({ error: "ownerType and ownerId required" }, { status: 400 });
  }

  const entities: Record<string, string> = {};
  if (locationName) entities.location = locationName;
  if (activity) entities.activity = activity;

  const handler = body.intent === "what_changed" ? handleWhatChanged : handleCurrentRisk;
  let result;
  try {
    result = await handler({ ownerType, ownerId, entities, ...(body.intent !== "what_changed" ? { forceRefresh } : {}) });
  } catch (err) {
    console.error("[brief] workflow error:", err);
    return NextResponse.json({ error: "Analysis failed", detail: String(err) }, { status: 500 });
  }

  return NextResponse.json({
    reportId: result.reportId ?? null,
    riskLevel: result.riskLevel ?? "WATCH",
    riskScore: result.riskScore ?? 0,
    text: result.text,
    mapUrl: result.mapUrl ?? null,
    imageUrl: result.imageUrl ?? null,
    pipelineTrace: result.pipelineTrace ?? null,
    memoryFacts: result.memoryFacts ?? [],
    report: result.report ?? null,
    deltaReport: result.deltaReport ?? null,
    photonMessage: result.photonMessage ?? null,
  });
}
