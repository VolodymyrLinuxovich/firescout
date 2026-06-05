/**
 * Photon/Spectrum messaging adapter.
 * Supports Slack first. Abstracts delivery for WhatsApp/iMessage later.
 */
import { config } from "../config";
import type { NormalizedMessage } from "../types";

export interface OutboundMessage {
  channelId: string;
  userId?: string;
  platform: string;
  text: string;
  mapUrl?: string;
  imageUrl?: string | null;
  quickActions?: Array<{ label: string; value: string }>;
}

// Normalize an incoming Photon/Slack webhook payload
export function normalizeIncomingMessage(body: Record<string, unknown>): NormalizedMessage | null {
  // Slack Event API format
  if (body.type === "event_callback") {
    const event = body.event as Record<string, unknown>;
    if (!event) return null;
    return {
      platform: "slack",
      channelId: (event.channel as string) ?? "",
      userId: (event.user as string) ?? "",
      groupId: (event.channel as string)?.startsWith("C") ? (event.channel as string) : undefined,
      text: (event.text as string) ?? "",
      timestamp: (event.ts as string) ?? new Date().toISOString(),
    };
  }

  // Photon Spectrum normalized format
  if (body.platform && body.channelId && body.text) {
    return {
      platform: body.platform as string,
      channelId: body.channelId as string,
      userId: (body.userId as string) ?? "",
      groupId: body.groupId as string | undefined,
      text: body.text as string,
      timestamp: (body.timestamp as string) ?? new Date().toISOString(),
    };
  }

  // Slack slash command format
  if (body.command && body.text !== undefined) {
    return {
      platform: "slack",
      channelId: (body.channel_id as string) ?? "",
      userId: (body.user_id as string) ?? "",
      text: `${body.command} ${body.text}`,
      timestamp: new Date().toISOString(),
    };
  }

  return null;
}

async function sendViaPhotonApi(msg: OutboundMessage): Promise<boolean> {
  if (!config.photonApiKey) return false;
  try {
    const resp = await fetch("https://api.photon.sh/v1/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.photonApiKey}`,
      },
      body: JSON.stringify({
        platform: msg.platform,
        channel_id: msg.channelId,
        user_id: msg.userId,
        text: msg.text,
        attachments: msg.imageUrl ? [{ image_url: msg.imageUrl }] : undefined,
        blocks: buildSlackBlocks(msg),
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function buildSlackBlocks(msg: OutboundMessage): unknown[] | undefined {
  if (msg.platform !== "slack") return undefined;
  const blocks: unknown[] = [
    { type: "section", text: { type: "mrkdwn", text: msg.text } },
  ];
  if (msg.mapUrl) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `<${msg.mapUrl}|View Interactive Map>` },
    });
  }
  if (msg.quickActions?.length) {
    blocks.push({
      type: "actions",
      elements: msg.quickActions.map(a => ({
        type: "button",
        text: { type: "plain_text", text: a.label },
        value: a.value,
      })),
    });
  }
  return blocks;
}

export async function sendMessage(msg: OutboundMessage): Promise<boolean> {
  const sent = await sendViaPhotonApi(msg);
  if (!sent) {
    // Log to console as fallback (for local dev without Photon key)
    console.log(`[Photon STDOUT] → ${msg.platform}/${msg.channelId}: ${msg.text}`);
    if (msg.mapUrl) console.log(`  Map: ${msg.mapUrl}`);
  }
  return true;
}

export function verifyWebhookSecret(
  rawBody: string,
  signature: string | null
): boolean {
  if (!config.photonWebhookSecret || !signature) return true; // skip check if not configured
  // Simple HMAC check — real implementation uses crypto.createHmac
  const crypto = require("crypto") as typeof import("crypto");
  const expected = "sha256=" + crypto
    .createHmac("sha256", config.photonWebhookSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const QUICK_ACTIONS = [
  { label: "What changed?", value: "what changed since yesterday" },
  { label: "Show map", value: "show me the smoke risk map" },
  { label: "Explain", value: "why is smoke bad" },
  { label: "Track location", value: "track this location" },
];
