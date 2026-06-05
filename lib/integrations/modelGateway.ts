/**
 * Model gateway — uses Butterbase AI model gateway if available,
 * falls back to template-based text generation.
 */
import { config } from "../config";
import type { RiskReport, AirQualityObservation, FireDetection, WindSnapshot } from "../types";

interface BriefContext {
  locationName: string;
  memory: string[];
  airQuality: AirQualityObservation | null;
  fires: FireDetection[];
  wind: WindSnapshot | null;
  plumeSummary: string;
  previousReport: Record<string, unknown> | null;
  activity?: string | null;
}

const SYSTEM_PROMPT = `You are FireScout, a wildfire-smoke health briefing agent.
Give short, practical advice. Do not provide evacuation orders.
Do not claim medical certainty. Always distinguish measured data from modeled estimates.
Mention official sources when relevant. Use plain English.
If risk is ACT or CRITICAL, remind user to follow local officials for emergency guidance.
Respond with JSON only.`;

export async function generateBriefWithGateway(ctx: BriefContext): Promise<Partial<RiskReport> | null> {
  if (!config.butterbaseApiKey) return null;

  const userMessage = JSON.stringify({
    location: ctx.locationName,
    userMemory: ctx.memory,
    airQuality: ctx.airQuality,
    activeFireCount: ctx.fires.length,
    nearestFireKm: ctx.fires.length
      ? Math.min(...ctx.fires.map(f => f.distanceKm ?? 9999))
      : null,
    wind: ctx.wind,
    plumeSummary: ctx.plumeSummary,
    previousReport: ctx.previousReport,
    activity: ctx.activity,
    instruction:
      'Return JSON with fields: title, riskLevel, summary, whatChanged, recommendation, why, confidence, sources',
  });

  try {
    const resp = await fetch("https://api.butterbase.com/v1/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.butterbaseApiKey}`,
        "X-Project-Id": config.butterbaseProjectId,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json() as { content?: string; choices?: Array<{ message: { content: string } }> };
    const raw = data.content ?? data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(raw) as Partial<RiskReport>;
  } catch {
    return null;
  }
}
