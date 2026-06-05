import { config } from "../config";

export interface GeminiRiskContext {
  userQuery: string;
  locationName: string;
  riskLevel: string;
  riskScore: number;
  mainDriver: string;
  aqi: number | null;
  aqiCategory: string | null;
  pm25: number | null;
  fireCount: number;
  nearestFireKm: number | null;
  windSpeedMps: number | null;
  windDirDeg: number | null;
  windProvider: string;
  aqiProvider: string;
  confidence: string;
  memoryContext: string[];
  sources: string[];
}

const SYSTEM_PROMPT = `You are FireScout, a global wildfire smoke intelligence agent. You monitor air quality and wildfire smoke risk for any location on Earth using real satellite and sensor data.

Your style:
- Casual but data-precise. 2-4 short paragraphs max.
- Lead with the risk level and what matters most.
- Mention actual numbers (AQI, fire distances, wind speed).
- End with a single actionable recommendation.
- No markdown headers. No bullet points. Just plain conversational text.
- Never say "I don't have data" — use the data provided.
- For international cities (non-US), note if data came from Open-Meteo global sensors.`;

export async function generateRiskResponse(ctx: GeminiRiskContext): Promise<string | null> {
  const key = config.geminiApiKey;
  if (!key) return null;

  const fireDetail = ctx.fireCount > 0
    ? `${ctx.fireCount} active fire detection${ctx.fireCount > 1 ? "s" : ""}, nearest ${ctx.nearestFireKm?.toFixed(0) ?? "?"}km away`
    : "no active fire detections nearby";

  const windDetail = ctx.windSpeedMps != null
    ? `wind ${(ctx.windSpeedMps * 3.6).toFixed(1)} km/h from ${ctx.windDirDeg}° (${ctx.windProvider})`
    : "no wind data";

  const memCtx = ctx.memoryContext.length
    ? `\nPrevious session context: ${ctx.memoryContext.slice(0, 3).join("; ")}`
    : "";

  const userMessage = `User asked: "${ctx.userQuery}"

Current data for ${ctx.locationName}:
- Risk: ${ctx.riskLevel} (score ${ctx.riskScore}/100), main driver: ${ctx.mainDriver}
- Air quality: AQI ${ctx.aqi ?? "no data"} — ${ctx.aqiCategory ?? "unknown"}, PM2.5 ${ctx.pm25 ?? "n/a"} μg/m³ (source: ${ctx.aqiProvider})
- Fires: ${fireDetail}
- Wind: ${windDetail}
- Confidence: ${ctx.confidence}
- Data sources: ${ctx.sources.join(", ")}${memCtx}

Respond as FireScout.`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 400,
            candidateCount: 1,
          },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      console.warn("[Gemini] API error:", resp.status, err.slice(0, 200));
      return null;
    }

    const data = await resp.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    return text;
  } catch (err) {
    console.warn("[Gemini] fetch failed:", String(err).slice(0, 100));
    return null;
  }
}

export async function generateConversationalResponse(
  userQuery: string,
  agentContext: string,
  memoryContext: string[],
): Promise<string | null> {
  const key = config.geminiApiKey;
  if (!key) return null;

  const memCtx = memoryContext.length
    ? `\nWhat I know about this user: ${memoryContext.slice(0, 3).join("; ")}`
    : "";

  const userMessage = `User: "${userQuery}"

Context from my last analysis:
${agentContext}${memCtx}

Respond as FireScout (2-3 sentences, casual but data-precise, no markdown).`;

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 250 },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}
