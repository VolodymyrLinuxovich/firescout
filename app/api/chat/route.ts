import { NextRequest, NextResponse } from "next/server";
import { handleMessage } from "@/lib/workflow";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { message: string; sessionId?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message, sessionId = "chat_default", platform = "imessage" } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  try {
    const result = await handleMessage({
      userId: sessionId,
      platform,
      text: message.trim(),
    });

    return NextResponse.json({
      text: result.text,
      reportId: result.reportId ?? null,
      riskLevel: result.riskLevel ?? null,
      riskScore: result.riskScore ?? null,
      mapUrl: result.mapUrl ?? null,
      pipelineTrace: result.pipelineTrace ?? null,
      memoryFacts: result.memoryFacts ?? [],
      report: result.report ?? null,
      photonMessage: result.photonMessage ?? null,
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return NextResponse.json({ error: "Agent error", detail: String(err) }, { status: 500 });
  }
}
