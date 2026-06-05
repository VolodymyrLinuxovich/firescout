/**
 * Messaging adapter.
 * Primary: LoopMessage (real iMessage delivery to +13417669597)
 * Fallback: CallMeBot WhatsApp (if WHATSAPP_APIKEY set)
 * Console: always logs the formatted message
 */
import { createHmac, timingSafeEqual } from "node:crypto";
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

// ── LoopMessage iMessage delivery ─────────────────────────────────────────────
// Sign up at https://loopmessage.com → grab your API key → add LOOPMESSAGE_API_KEY
async function sendViaLoopMessage(text: string): Promise<boolean> {
  const { loopMessageApiKey, imessageNumber } = config;
  if (!loopMessageApiKey || !imessageNumber) return false;

  const recipient = normalizePhone(imessageNumber);

  try {
    const resp = await fetch("https://a.loopmessage.com/api/v1/message/send/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": loopMessageApiKey,
      },
      body: JSON.stringify({ contact: recipient, text, channel: "imessage" }),
      signal: AbortSignal.timeout(10000),
    });

    const body = await resp.text().catch(() => "");
    if (resp.ok) {
      console.log(`[iMessage → LoopMessage] Queued to ${recipient}: ${body.slice(0, 200)}`);
      return true;
    }
    console.warn(`[iMessage → LoopMessage] ${resp.status}: ${body.slice(0, 1000)}`);
    return false;
  } catch (e) {
    console.warn("[iMessage → LoopMessage] fetch failed:", String(e).slice(0, 100));
    return false;
  }
}

// ── Local macOS Messages.app fallback for development ─────────────────────────
async function sendViaMacMessages(text: string): Promise<boolean> {
  if (process.platform !== "darwin" || !config.imessageNumber) return false;

  const recipient = normalizePhone(config.imessageNumber);
  const script = `
on run argv
  set targetAddress to item 1 of argv
  set messageText to item 2 of argv
  tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy targetAddress of targetService
    send messageText to targetBuddy
  end tell
end run`;

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    await promisify(execFile)("osascript", ["-e", script, recipient, text], { timeout: 10000 });
    console.log(`[iMessage → Messages.app] Delivered to ${recipient}`);
    return true;
  } catch (e) {
    console.warn("[iMessage → Messages.app] failed:", String(e).slice(0, 120));
    return false;
  }
}

// ── WhatsApp via CallMeBot (fallback) ─────────────────────────────────────────
async function sendViaWhatsApp(text: string): Promise<boolean> {
  const { whatsappNumber, whatsappApiKey } = config;
  if (!whatsappNumber || !whatsappApiKey) return false;
  try {
    const params = new URLSearchParams({ phone: whatsappNumber, text, apikey: whatsappApiKey });
    const resp = await fetch(`https://api.callmebot.com/whatsapp.php?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const body = await resp.text();
    const ok = resp.ok && !body.toLowerCase().includes("error");
    if (ok) console.log(`[WhatsApp → CallMeBot] Delivered to ${whatsappNumber}`);
    else console.warn(`[WhatsApp → CallMeBot] ${body.slice(0, 120)}`);
    return ok;
  } catch (e) {
    console.warn("[WhatsApp → CallMeBot] failed:", String(e).slice(0, 80));
    return false;
  }
}

// ── Format plain text for mobile ─────────────────────────────────────────────
function formatMobileText(msg: OutboundMessage): string {
  let text = msg.text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
  if (msg.mapUrl) text += `\n\n🗺 Map: ${msg.mapUrl}`;
  return text;
}

function normalizePhone(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function sendMessage(msg: OutboundMessage): Promise<boolean> {
  const text = formatMobileText(msg);

  const imsgOk = await sendViaLoopMessage(text) || await sendViaMacMessages(text);
  const waOk = await sendViaWhatsApp(text);

  // Always log so the demo console shows delivery even without keys
  if (!imsgOk && !waOk) {
    console.log(`[iMessage STDOUT] → ${msg.platform}/${msg.channelId}`);
    console.log(`  ${text.replace(/\n/g, "\n  ")}`);
    if (msg.mapUrl) console.log(`  Map: ${msg.mapUrl}`);
  }

  return imsgOk || waOk;
}

// ── Incoming webhook normalizer (kept for Photon webhook route) ───────────────
export function normalizeIncomingMessage(body: Record<string, unknown>): NormalizedMessage | null {
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

export function verifyWebhookSecret(rawBody: string, signature: string | null): boolean {
  if (!config.photonWebhookSecret || !signature) return true;
  const expected = "sha256=" + createHmac("sha256", config.photonWebhookSecret)
    .update(rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const QUICK_ACTIONS = [
  { label: "What changed?", value: "what changed since last report" },
  { label: "Show map", value: "show me the smoke risk map" },
  { label: "Explain", value: "why is smoke bad" },
  { label: "Track location", value: "track this location" },
];
