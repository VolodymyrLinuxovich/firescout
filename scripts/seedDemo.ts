/**
 * Demo seed script — creates a demo user, location, prior report, and XTrace memory.
 * Run: npx tsx scripts/seedDemo.ts
 */
import * as BB from "../lib/integrations/butterbase";
import * as XT from "../lib/integrations/xtrace";

async function main() {
  console.log("[FireScout] Seeding demo data…\n");

  const DEMO_USER_ID = "demo_slack_user_001";
  const LOCATION_NAME = "Berkeley";
  const LOCATION_LAT = 37.8715;
  const LOCATION_LON = -122.2730;

  // 1. Create demo user
  const user = await BB.upsertUser({
    photonUserId: DEMO_USER_ID,
    platform: "slack",
    displayName: "Demo User",
  });
  console.log(`✓ User: ${user.id ?? "(in-memory)"}`);

  const ownerId = DEMO_USER_ID;
  const ownerType = "user";

  // 2. Save Berkeley as monitored location
  const location = await BB.saveLocation({
    ownerType,
    ownerId,
    name: LOCATION_NAME,
    lat: LOCATION_LAT,
    lon: LOCATION_LON,
    radiusKm: 150,
  });
  const locationId = (location.id as string) ?? "demo_loc_001";
  console.log(`✓ Location: ${LOCATION_NAME} (${LOCATION_LAT}, ${LOCATION_LON})`);

  // 3. Save a fake previous air quality observation (yesterday, Moderate)
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  await BB.saveAirQuality(locationId, {
    provider: "AirNow",
    aqi: 62,
    category: "Moderate",
    pollutant: "PM2.5",
    pm25Value: 19.2,
    ozoneValue: null,
    observedAt: yesterday,
    raw: { source: "DEMO_SEED" },
  });
  console.log(`✓ Previous air quality: AQI 62 / Moderate (yesterday)`);

  // 4. Save a fake previous risk report (CLEAR, yesterday)
  await BB.saveRiskReport(ownerType, ownerId, locationId, {
    location: { name: LOCATION_NAME, lat: LOCATION_LAT, lon: LOCATION_LON, radiusKm: 150 },
    riskLevel: "CLEAR",
    riskScore: 18,
    mainDriver: "AirNow / PM2.5 measurements",
    recommendation: "Outdoor running looks reasonable right now.",
    confidence: "Medium",
    sourcesUsed: ["AirNow", "NWS", "FireScout plume model"],
    createdAt: yesterday,
  });
  console.log(`✓ Previous risk report: CLEAR (yesterday)`);

  // 5. Write XTrace memory
  await XT.writeUserMemory(ownerId, `Demo user monitors Berkeley, California.`, { location: "Berkeley", lat: LOCATION_LAT, lon: LOCATION_LON });
  await XT.writeUserMemory(ownerId, `User cares about outdoor running when asking about smoke risk.`, { activity: "running" });
  await XT.writeUserMemory(ownerId, `Previous Berkeley risk state was CLEAR. AQI was Moderate (62) yesterday.`, { riskLevel: "CLEAR", previousAqi: 62 });
  console.log(`✓ XTrace memory: 3 facts written`);

  console.log(`
Demo seeding complete!

Seeded:
  User ID: ${DEMO_USER_ID}
  Location: Berkeley, CA (${LOCATION_LAT}, ${LOCATION_LON})
  Previous report: CLEAR
  Previous AQI: 62 (Moderate)
  XTrace facts: monitors Berkeley, cares about running, previous CLEAR state

Now run:
  npx tsx scripts/testBerkeley.ts
  — to test the full pipeline with mock data

Or start the server and send a message:
  POST /api/photon/webhook { userId: "${DEMO_USER_ID}", platform: "slack", channelId: "${DEMO_USER_ID}", text: "How bad is it right now?" }
`);
}

main().catch((err) => { console.error(err); process.exit(1); });
