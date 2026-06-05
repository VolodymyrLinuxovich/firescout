/**
 * Core workflow engine — orchestrates all FireScout pipelines.
 * Called by API routes and the Photon webhook handler.
 */
import { geocode, extractLocationFromText } from "./geocode";
import { classifyIntent } from "./formatters";
import { runPlumeModel } from "./plume";
import { computeRiskScore, getRecommendation, getSummaryText, riskLevelFromScore } from "./risk";
import { confirmLocationMessage, scienceExplanation, aqiCategoryDelta, formatDelta } from "./formatters";
import { fetchAirNowByLatLon } from "./officialData/airnow";
import { fetchFirmsActiveFires } from "./officialData/firms";
import { fetchNwsWind } from "./officialData/nws";
import { getNasaGibsTileLayer, todayDateString } from "./officialData/nasaGibs";
import * as BB from "./integrations/butterbase";
import * as XT from "./integrations/xtrace";
import { config } from "./config";
import type { RiskReport, AirQualityObservation, FireDetection, WindSnapshot, MapLayers, Location } from "./types";

export interface WorkflowResult {
  text: string;
  reportId?: string;
  riskLevel?: string;
  riskScore?: number;
  mapUrl?: string;
  imageUrl?: string | null;
}

export async function handleMessage(params: {
  userId: string;
  groupId?: string;
  platform: string;
  text: string;
}): Promise<WorkflowResult> {
  const { userId, groupId, platform, text } = params;
  const ownerType = groupId ? "group" : "user";
  const ownerId = groupId ?? userId;

  // Ensure user exists in Butterbase
  await BB.upsertUser({ photonUserId: userId, platform }).catch(() => {});

  const { intent, entities } = classifyIntent(text);

  switch (intent) {
    case "add_location":
      return handleAddLocation({ ownerType, ownerId, text, entities });
    case "show_map":
      return handleShowMap({ ownerType, ownerId, entities });
    case "what_changed":
      return handleWhatChanged({ ownerType, ownerId, entities });
    case "explain_science":
      return { text: scienceExplanation() };
    case "update_preferences":
      return { text: "To update your preferences, tell me your location and activity. Example: _'Monitor Berkeley for outdoor running.'_" };
    case "current_risk":
    case "daily_brief":
    case "unknown":
    default:
      return handleCurrentRisk({ ownerType, ownerId, entities });
  }
}

async function handleAddLocation(params: {
  ownerType: string;
  ownerId: string;
  text: string;
  entities: Record<string, string>;
}): Promise<WorkflowResult> {
  const { ownerType, ownerId, text, entities } = params;

  const locationName = entities.location ?? extractLocationFromText(text);
  const activity = entities.activity ?? null;

  if (!locationName) {
    return { text: "Which location would you like to monitor? Example: _'Monitor Berkeley for outdoor running.'_" };
  }

  const loc = await geocode(locationName);
  if (!loc) {
    return { text: `I couldn't find "${locationName}". Try a city name like Berkeley, Oakland, or San Francisco.` };
  }

  await BB.saveLocation({ ownerType, ownerId, name: loc.name, lat: loc.lat, lon: loc.lon }).catch(() => {});

  await XT.writeUserMemory(ownerId, `User monitors ${loc.name}.`, { location: loc.name, lat: loc.lat, lon: loc.lon });
  if (activity) {
    await XT.writeUserMemory(ownerId, `User cares about ${activity} when asking about smoke risk.`, { activity });
  }

  return { text: confirmLocationMessage(loc.name, activity ?? undefined) };
}

async function resolveLocation(
  ownerType: string,
  ownerId: string,
  entities: Record<string, string>
): Promise<{ loc: Location; locationId: string } | null> {
  // Check memory for saved location
  const savedLocations = await BB.getActiveLocations(ownerType, ownerId);
  const explicitName = entities.location;

  let loc: Location | null = null;
  let locationId = "default";

  if (explicitName) {
    loc = await geocode(explicitName);
  } else if (savedLocations.length > 0) {
    const saved = savedLocations[0];
    loc = {
      id: saved.id as string,
      name: saved.name as string,
      lat: saved.lat as number,
      lon: saved.lon as number,
      radiusKm: (saved.radius_km as number) ?? 150,
    };
    locationId = saved.id as string ?? "default";
  } else {
    // Check XTrace memory for a location
    const memFacts = await XT.getUserMemory(ownerId, "monitors");
    for (const fact of memFacts) {
      const match = fact.match(/monitors ([A-Z][^.]+)/);
      if (match) {
        loc = await geocode(match[1].trim());
        if (loc) break;
      }
    }
  }

  if (!loc) {
    // Default to Berkeley for demo
    loc = { name: "Berkeley", lat: 37.8715, lon: -122.2730, radiusKm: 150 };
  }

  return { loc, locationId };
}

export async function handleCurrentRisk(params: {
  ownerType: string;
  ownerId: string;
  entities: Record<string, string>;
  forceRefresh?: boolean;
}): Promise<WorkflowResult> {
  const { ownerType, ownerId, entities } = params;

  // Read XTrace memory before answering
  const [locationMemory, activityMemory, previousRiskMemory] = await Promise.all([
    XT.getUserMemory(ownerId, "monitors"),
    XT.getUserMemory(ownerId, "activity"),
    XT.getUserMemory(ownerId, "risk state"),
  ]);

  const allMemory = [...locationMemory, ...activityMemory, ...previousRiskMemory];

  // Extract activity from memory
  let activity = entities.activity ?? null;
  for (const m of activityMemory) {
    const match = m.match(/cares about ([^.]+)/);
    if (match) { activity = match[1].trim(); break; }
  }

  const resolved = await resolveLocation(ownerType, ownerId, entities);
  if (!resolved) return { text: "Tell me which location to check. Example: _'How bad is it in Berkeley?'_" };
  const { loc } = resolved;

  // Fetch all data
  const [airQualityResult, firesResult, windResult] = await Promise.allSettled([
    fetchAirNowByLatLon(loc.lat, loc.lon),
    fetchFirmsActiveFires(loc.lat, loc.lon, loc.radiusKm),
    fetchNwsWind(loc.lat, loc.lon),
  ]);

  const airQuality: AirQualityObservation | null =
    airQualityResult.status === "fulfilled" ? airQualityResult.value : null;
  const fires: FireDetection[] =
    firesResult.status === "fulfilled" ? firesResult.value : [];
  const wind: WindSnapshot | null =
    windResult.status === "fulfilled" ? windResult.value : null;

  // Run plume model
  let plume = null;
  if (wind?.windSpeedMps != null && wind?.windDirectionDeg != null) {
    plume = runPlumeModel(loc.lat, loc.lon, fires, wind.windSpeedMps, wind.windDirectionDeg);
  }

  // Load previous report for trend
  const previousReport = await BB.getLatestReport(ownerType, ownerId).catch(() => null);
  const previousAirQuality = previousReport?.air_quality
    ? (previousReport.air_quality as AirQualityObservation)
    : null;

  // Compute risk
  const riskComponents = computeRiskScore({
    airQuality,
    previousAirQuality,
    fires,
    plumeAtUserScore: plume?.plumeAtUserScore,
    activity,
  });

  const recommendation = getRecommendation(riskComponents.riskLevel, activity);
  const sources = [
    airQuality ? "AirNow" : null,
    fires.length ? "NASA FIRMS" : null,
    wind ? "NWS" : null,
    plume ? "FireScout plume model" : null,
  ].filter(Boolean) as string[];
  if (config.useMockData) sources.push("(Mock Data)");

  const report: RiskReport = {
    location: loc,
    riskLevel: riskComponents.riskLevel,
    riskScore: riskComponents.finalRisk,
    mainDriver: riskComponents.mainDriver,
    recommendation,
    confidence: riskComponents.confidence,
    sourcesUsed: sources,
    airQuality: airQuality ?? undefined,
    wind: wind ?? undefined,
    fires,
    plume: plume ?? undefined,
  };

  // Save to Butterbase
  let reportId = `local_${Date.now()}`;
  try {
    const saved = await BB.saveRiskReport(ownerType, ownerId, resolved.locationId, report);
    reportId = (saved.id as string) ?? reportId;
    if (airQuality) await BB.saveAirQuality(resolved.locationId, airQuality).catch(() => {});
    if (fires.length) await BB.saveFireDetections(resolved.locationId, fires).catch(() => {});
    if (wind) await BB.saveWind(resolved.locationId, wind).catch(() => {});
    if (plume) await BB.savePlumeRun(resolved.locationId, plume).catch(() => {});
  } catch {
    // Continue even if Butterbase is unavailable
  }

  // Write XTrace memory after answering
  await Promise.all([
    XT.writeUserMemory(ownerId, `Latest ${loc.name} report was ${riskComponents.riskLevel} because of ${riskComponents.mainDriver}.`, {
      riskLevel: riskComponents.riskLevel,
      riskScore: riskComponents.finalRisk,
      location: loc.name,
    }),
    XT.writeArtifact(ownerType as "user" | "group", ownerId, {
      reportId,
      location: loc.name,
      riskLevel: riskComponents.riskLevel,
      mapUrl: `${config.appUrl}/map/${reportId}`,
      sourcesUsed: sources,
    }),
  ]).catch(() => {});

  const mapUrl = `${config.appUrl}/map/${reportId}`;
  const text = getSummaryText(
    loc.name,
    riskComponents.riskLevel,
    riskComponents.mainDriver,
    activity,
    null,
    riskComponents.confidence,
    sources
  ) + `\n\n**Map:** ${mapUrl}`;

  return { text, reportId, riskLevel: riskComponents.riskLevel, riskScore: riskComponents.finalRisk, mapUrl };
}

export async function handleShowMap(params: {
  ownerType: string;
  ownerId: string;
  entities: Record<string, string>;
}): Promise<WorkflowResult> {
  const { ownerType, ownerId, entities } = params;
  const previousReport = await BB.getLatestReport(ownerType, ownerId).catch(() => null);

  if (previousReport?.id) {
    const mapUrl = `${config.appUrl}/map/${previousReport.id}`;
    return {
      text: `Here is your latest map for **${previousReport.location_id ?? "your location"}**:\n\n**Map:** ${mapUrl}\n\nThe map shows your location, NASA FIRMS fire detections, wind direction, and the Gaussian plume transport estimate.\n\n_Plume layer is a modeled estimate. AQI badge shows official AirNow measurements._`,
      mapUrl,
    };
  }

  // Generate a fresh report to get map
  const result = await handleCurrentRisk({ ownerType, ownerId, entities });
  return result;
}

export async function handleWhatChanged(params: {
  ownerType: string;
  ownerId: string;
  entities: Record<string, string>;
}): Promise<WorkflowResult> {
  const { ownerType, ownerId, entities } = params;

  // Load previous report from Butterbase
  const previousReport = await BB.getLatestReport(ownerType, ownerId).catch(() => null);
  const previousMemory = await XT.getUserMemory(ownerId, "risk state").catch(() => [] as string[]);

  // Get current data
  const resolved = await resolveLocation(ownerType, ownerId, entities);
  if (!resolved) return { text: "Tell me which location to check. Example: _'What changed in Berkeley?'_" };
  const { loc } = resolved;

  const [airQualityResult, firesResult, windResult] = await Promise.allSettled([
    fetchAirNowByLatLon(loc.lat, loc.lon),
    fetchFirmsActiveFires(loc.lat, loc.lon, loc.radiusKm),
    fetchNwsWind(loc.lat, loc.lon),
  ]);

  const airQuality: AirQualityObservation | null = airQualityResult.status === "fulfilled" ? airQualityResult.value : null;
  const fires: FireDetection[] = firesResult.status === "fulfilled" ? firesResult.value : [];
  const wind: WindSnapshot | null = windResult.status === "fulfilled" ? windResult.value : null;

  let plume = null;
  if (wind?.windSpeedMps != null && wind?.windDirectionDeg != null) {
    plume = runPlumeModel(loc.lat, loc.lon, fires, wind.windSpeedMps, wind.windDirectionDeg);
  }

  // Compute deltas
  const prevAqi = previousReport?.aqi ?? (previousReport?.risk_score ? null : null);
  const prevRiskLevel = (previousReport?.risk_level as string) ?? null;
  const prevPlumeScore = (previousReport?.plume_at_user_score as number) ?? null;
  const prevFireCount = (previousReport?.fire_count as number) ?? null;

  const currRiskComponents = computeRiskScore({
    airQuality,
    previousAirQuality: null,
    fires,
    plumeAtUserScore: plume?.plumeAtUserScore,
    activity: null,
  });

  const deltas: string[] = [];

  if (prevRiskLevel && prevRiskLevel !== currRiskComponents.riskLevel) {
    deltas.push(`Risk level: **${prevRiskLevel}** → **${currRiskComponents.riskLevel}**`);
  }

  if (airQuality?.aqi != null) {
    const prevCatFact = previousMemory.find(m => m.includes("was CLEAR") || m.includes("was WATCH") || m.includes("was ACT") || m.includes("was CRITICAL"));
    if (prevCatFact) {
      deltas.push(`Previous state: ${prevCatFact}`);
    }
    deltas.push(`Current AQI: **${airQuality.aqi}** (${airQuality.category})`);
  }

  if (prevPlumeScore !== null && plume?.plumeAtUserScore !== null) {
    const delta = formatDelta("Plume transport score", prevPlumeScore, plume?.plumeAtUserScore);
    if (delta) deltas.push(delta);
  }

  if (fires.length > 0) {
    const nearestFire = Math.min(...fires.map(f => f.distanceKm ?? 9999));
    deltas.push(`Active fire detections: **${fires.length}** (nearest: ${nearestFire.toFixed(0)} km away)`);
  }

  if (wind) {
    deltas.push(`Wind: ${wind.windSpeedMps?.toFixed(1)} m/s from ${wind.windDirectionDeg}°`);
  }

  const whatChanged = deltas.length > 0
    ? deltas.join("\n")
    : "No significant changes detected since the last report.";

  if (!previousReport) {
    const noHistory = `I don't have a previous report for comparison. Here is the current status:\n\n` + (await handleCurrentRisk({ ownerType, ownerId, entities })).text;
    return { text: noHistory };
  }

  const sources = [airQuality ? "AirNow" : null, fires.length ? "NASA FIRMS" : null, wind ? "NWS" : null, plume ? "FireScout plume model" : null].filter(Boolean) as string[];
  const recommendation = getRecommendation(currRiskComponents.riskLevel, null);

  // Save new report
  let reportId = `local_${Date.now()}`;
  try {
    const report: RiskReport = {
      location: loc,
      riskLevel: currRiskComponents.riskLevel,
      riskScore: currRiskComponents.finalRisk,
      mainDriver: currRiskComponents.mainDriver,
      whatChanged,
      recommendation,
      confidence: currRiskComponents.confidence,
      sourcesUsed: sources,
    };
    const saved = await BB.saveRiskReport(ownerType, ownerId, resolved.locationId, report);
    reportId = (saved.id as string) ?? reportId;
  } catch { /* continue */ }

  // Revise XTrace memory
  await XT.reviseMemory(
    ownerType as "user" | "group",
    ownerId,
    `Latest ${loc.name} report: ${currRiskComponents.riskLevel}. ${whatChanged}`,
    prevRiskLevel ? `was ${prevRiskLevel}` : undefined
  ).catch(() => {});

  const mapUrl = `${config.appUrl}/map/${reportId}`;
  const text = `**FireScout — ${loc.name} — What Changed**\n\n${whatChanged}\n\n**Current level: ${currRiskComponents.riskLevel}**\n\n**Recommendation:** ${recommendation}\n\n**Confidence:** ${currRiskComponents.confidence}\n**Sources:** ${sources.join(", ")}\n\n**Map:** ${mapUrl}`;

  return { text, reportId, riskLevel: currRiskComponents.riskLevel, riskScore: currRiskComponents.finalRisk, mapUrl };
}

export async function getMapLayers(reportId: string): Promise<MapLayers | null> {
  const report = await BB.getReportById(reportId).catch(() => null);
  if (!report) return null;

  // If we have a cached report, reconstruct map layers from it
  // In production, these would be loaded from Butterbase storage
  return {
    userLocation: {
      lat: 37.8715,
      lon: -122.2730,
      name: "Berkeley",
    },
    aqi: null,
    fires: [],
    wind: null,
    plumeGeoJson: null,
    satelliteLayer: getNasaGibsTileLayer(todayDateString()),
  };
}
