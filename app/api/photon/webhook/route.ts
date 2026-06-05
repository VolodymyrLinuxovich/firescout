import { NextRequest, NextResponse } from "next/server";
import { normalizeIncomingMessage, sendMessage, verifyWebhookSecret, QUICK_ACTIONS } from "@/lib/integrations/photon";
import { handleMessage } from "@/lib/workflow";
import * as BB from "@/lib/integrations/butterbase";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-photon-signature") ?? req.headers.get("x-slack-signature");

  // Validate webhook signature
  if (!verifyWebhookSecret(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Slack URL verification challenge
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  const msg = normalizeIncomingMessage(body);
  if (!msg) {
    return NextResponse.json({ ok: true }); // Ignore non-message events
  }

  // Store inbound message
  const ownerType = msg.groupId ? "group" : "user";
  const ownerId = msg.groupId ?? msg.userId;
  await BB.saveMessage({
    ownerType,
    ownerId,
    platform: msg.platform,
    inboundText: msg.text,
  }).catch(() => {});

  // Process message through FireScout workflow
  let result;
  try {
    result = await handleMessage({
      userId: msg.userId,
      groupId: msg.groupId,
      platform: msg.platform,
      text: msg.text,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    result = { text: `FireScout encountered an error: ${errMsg}. Please try again.` };
  }

  // Store outbound message
  await BB.saveMessage({
    ownerType,
    ownerId,
    platform: msg.platform,
    inboundText: msg.text,
    outboundText: result.text,
    reportId: result.reportId,
  }).catch(() => {});

  // Send response via Photon
  await sendMessage({
    channelId: msg.channelId,
    userId: msg.userId,
    platform: msg.platform,
    text: result.text,
    mapUrl: result.mapUrl ?? undefined,
    imageUrl: result.imageUrl ?? undefined,
    quickActions: result.reportId ? QUICK_ACTIONS : undefined,
  });

  return NextResponse.json({ ok: true });
}

// GET for health check
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "Photon webhook endpoint active" });
}
