/**
 * Berkeley end-to-end test — runs the full pipeline with mock data.
 * Run: USE_MOCK_DATA=true npx tsx scripts/testBerkeley.ts
 */
process.env.USE_MOCK_DATA = "true";

import { geocode } from "../lib/geocode";
import { fetchAirNowByLatLon } from "../lib/officialData/airnow";
import { fetchFirmsActiveFires } from "../lib/officialData/firms";
import { fetchNwsWind } from "../lib/officialData/nws";
import { runPlumeModel } from "../lib/plume";
import { computeRiskScore, getRecommendation, getSummaryText } from "../lib/risk";

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  FireScout — Berkeley End-to-End Test (Mock Mode)");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Geocode Berkeley
  const loc = await geocode("Berkeley");
  console.log(`1. Geocode: ${loc?.name} → (${loc?.lat}, ${loc?.lon})\n`);
  if (!loc) throw new Error("Geocode failed");

  // 2. AirNow (mock: AQI 112, Unhealthy for Sensitive Groups)
  const airQuality = await fetchAirNowByLatLon(loc.lat, loc.lon);
  console.log(`2. AirNow:`);
  console.log(`   AQI: ${airQuality.aqi}`);
  console.log(`   Category: ${airQuality.category}`);
  console.log(`   PM2.5: ${airQuality.pm25Value} μg/m³\n`);

  // 3. NWS Wind (mock: 240° at 4.5 m/s = SW wind, smoke goes NE)
  const wind = await fetchNwsWind(loc.lat, loc.lon);
  console.log(`3. NWS Wind:`);
  console.log(`   Speed: ${wind.windSpeedMps} m/s`);
  console.log(`   Direction: ${wind.windDirectionDeg}° (FROM)`);
  console.log(`   Smoke transport toward: ${((wind.windDirectionDeg ?? 0) + 180) % 360}°\n`);

  // 4. NASA FIRMS (mock: 2 fire detections NE of Berkeley)
  const fires = await fetchFirmsActiveFires(loc.lat, loc.lon, 150);
  console.log(`4. NASA FIRMS:`);
  console.log(`   ${fires.length} active fire detections`);
  for (const f of fires) {
    console.log(`   • ${f.source} at (${f.lat.toFixed(3)}, ${f.lon.toFixed(3)}) — ${f.distanceKm?.toFixed(0)} km away`);
  }
  console.log();

  // 5. Gaussian plume model
  const plume = runPlumeModel(
    loc.lat, loc.lon,
    fires,
    wind.windSpeedMps ?? 4.5,
    wind.windDirectionDeg ?? 240
  );
  console.log(`5. Plume Model:`);
  console.log(`   Plume at user score: ${plume.plumeAtUserScore} / 100`);
  console.log(`   Max plume score: ${plume.maxPlumeScore}`);
  console.log(`   GeoJSON features: ${plume.plumeGeoJson.features.length}`);
  console.log(`   Smoke direction: ${plume.metadata.smokeTransportDirection}°`);
  console.log(`   Note: ${plume.metadata.note}\n`);

  // 6. Risk computation
  const riskComponents = computeRiskScore({
    airQuality,
    fires,
    plumeAtUserScore: plume.plumeAtUserScore,
    activity: "outdoor running",
  });
  console.log(`6. Risk Score:`);
  console.log(`   AQI score: ${riskComponents.aqiScore} × 0.45 = ${(riskComponents.aqiScore * 0.45).toFixed(1)}`);
  console.log(`   Plume score: ${riskComponents.plumeScore} × 0.25 = ${(riskComponents.plumeScore * 0.25).toFixed(1)}`);
  console.log(`   Fire proximity: ${riskComponents.fireProximityScore} × 0.10 = ${(riskComponents.fireProximityScore * 0.10).toFixed(1)}`);
  console.log(`   Activity (running): ${riskComponents.activityScore} × 0.05 = ${(riskComponents.activityScore * 0.05).toFixed(1)}`);
  console.log(`   ────────────────────────────`);
  console.log(`   Final risk score: ${riskComponents.finalRisk}`);
  console.log(`   Risk level: ${riskComponents.riskLevel}`);
  console.log(`   Main driver: ${riskComponents.mainDriver}`);
  console.log(`   Confidence: ${riskComponents.confidence}\n`);

  // 7. Generate report text
  const recommendation = getRecommendation(riskComponents.riskLevel, "outdoor running");
  const sources = ["AirNow (mock)", "NASA FIRMS (mock)", "NWS (mock)", "FireScout plume model"];
  const reportText = getSummaryText(
    loc.name,
    riskComponents.riskLevel,
    riskComponents.mainDriver,
    "outdoor running",
    null,
    riskComponents.confidence,
    sources
  );

  console.log("7. Generated Report:\n");
  console.log("─".repeat(50));
  console.log(reportText);
  console.log("─".repeat(50));
  console.log("\n✓ Berkeley test complete.\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
