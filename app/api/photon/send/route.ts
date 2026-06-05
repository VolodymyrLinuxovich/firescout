import { NextRequest, NextResponse } from "next/server";
import { sendMessage } from "@/lib/integrations/photon";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { text, platform, channelId } = await req.json() as {
    text: string;
    platform?: string;
    channelId?: string;
  };
  if (!text?.trim()) {
    return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
  }
  try {
    const sent = await sendMessage({
      platform: platform ?? "whatsapp",
      channelId: channelId ?? "firescout-demo",
      text,
    });
    return NextResponse.json({ ok: sent }, { status: sent ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
