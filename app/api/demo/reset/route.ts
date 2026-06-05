import { NextResponse } from "next/server";
import * as BB from "@/lib/integrations/butterbase";
import * as XT from "@/lib/integrations/xtrace";

const DEMO_USER_ID = "demo_berkeley_01";

export async function POST(): Promise<NextResponse> {
  const errors: string[] = [];

  // 1. Upsert demo user
  await BB.upsertUser({ photonUserId: DEMO_USER_ID, platform: "web", displayName: "Berkeley Demo" }).catch(e => errors.push(`user: ${e}`));

  // 2. Save Berkeley location
  const loc = await BB.saveLocation({
    ownerType: "user", ownerId: DEMO_USER_ID,
    name: "Berkeley", lat: 37.8715, lon: -122.2730, radiusKm: 150,
  }).catch(e => { errors.push(`location: ${e}`); return null; });

  const locationId = (loc?.id as string) ?? "demo_loc";
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  // 3. Save previous AQI (Moderate — yesterday)
  await BB.saveAirQuality(locationId, {
    provider: "AirNow", aqi: 62, category: "Moderate",
    pollutant: "PM2.5", pm25Value: 19.2, ozoneValue: null,
    observedAt: yesterday, raw: { source: "DEMO_SEED" },
  }).catch(e => errors.push(`aqi: ${e}`));

  // 4. Save previous risk report (CLEAR — yesterday)
  await BB.saveRiskReport("user", DEMO_USER_ID, locationId, {
    location: { name: "Berkeley", lat: 37.8715, lon: -122.2730, radiusKm: 150 },
    riskLevel: "CLEAR", riskScore: 18,
    mainDriver: "AirNow / PM2.5 measurements",
    recommendation: "Outdoor running looks reasonable.",
    confidence: "Medium",
    sourcesUsed: ["AirNow", "NWS", "FireScout plume model"],
    createdAt: yesterday,
  }).catch(e => errors.push(`report: ${e}`));

  // 5. Seed XTrace memory
  await XT.writeUserMemory(DEMO_USER_ID, "User monitors Berkeley, California.", { location: "Berkeley" });
  await XT.writeUserMemory(DEMO_USER_ID, "User cares about outdoor running when asking about smoke risk.", { activity: "running" });
  await XT.writeUserMemory(DEMO_USER_ID, "Previous Berkeley risk state was CLEAR. AQI was Moderate (62) yesterday.", { riskLevel: "CLEAR", previousAqi: 62 });

  return NextResponse.json({
    ok: true,
    demoUserId: DEMO_USER_ID,
    message: "Demo state seeded: Berkeley location, previous CLEAR report, XTrace memory facts",
    errors: errors.length ? errors : undefined,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ demoUserId: DEMO_USER_ID });
}
