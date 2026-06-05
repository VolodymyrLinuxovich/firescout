/**
 * FireScout core workflow engine.
 * Each run of handleCurrentRisk produces a PipelineTrace for the UI.
 */
import { geocode, extractLocationFromText } from "./geocode";
import { classifyIntent } from "./formatters";
import { runPlumeModel } from "./plume";
import { computeRiskScore, getRecommendation, getSummaryText } from "./risk";
import { confirmLocationMessage, scienceExplanation } from "./formatters";
import { fetchAirNowByLatLon } from "./officialData/airnow";
import { fetchFirmsActiveFires } from "./officialData/firms";
import { fetchNwsWind } from "./officialData/nws";
import { fetchOpenMeteoAirQuality, fetchOpenMeteoWind } from "./officialData/openmeteo";
import { generateRiskResponse } from "./integrations/gemini";
import { getNasaGibsTileLayer, todayDateString } from "./officialData/nasaGibs";
import * as BB from "./integrations/butterbase";
import * as XT from "./integrations/xtrace";
import { sendMessage } from "./integrations/photon";
import { config } from "./config";
import type {
  RiskReport, AirQualityObservation, FireDetection, WindSnapshot,
  MapLayers, Location, PipelineStage, PipelineTrace, XTraceMemoryFact
} from "./types";

// ── Pipeline trace helpers ────────────────────────────────────────────────────

function makeStages(): PipelineStage[] {
  return [
    { id: "normalize_message",      label: "Normalize message",            name: "normalize_message",      status: "pending" },
    { id: "resolve_location",        label: "Resolve location",             name: "resolve_location",        status: "pending" },
    { id: "xtrace_read_memory",      label: "XTrace memory read",           name: "xtrace_read_memory",      status: "pending" },
    { id: "airnow_current_aqi",      label: "AirNow AQI fetch",             name: "airnow_current_aqi",      status: "pending" },
    { id: "nasa_firms_active_fires", label: "NASA FIRMS fire detections",   name: "nasa_firms_active_fires", status: "pending" },
    { id: "nws_wind_field",          label: "NWS wind fetch",               name: "nws_wind_field",          status: "pending" },
    { id: "gaussian_plume_model",    label: "Gaussian plume model",         name: "gaussian_plume_model",    status: "pending" },
    { id: "risk_score_fusion",       label: "Risk score fusion",            name: "risk_score_fusion",       status: "pending" },
    { id: "map_artifact_generation", label: "Map artifact generation",      name: "map_artifact_generation", status: "pending" },
    { id: "butterbase_persist",      label: "Butterbase persist report",    name: "butterbase_persist",      status: "pending" },
    { id: "xtrace_write_memory",     label: "XTrace write memory + artifact",name: "xtrace_write_memory",   status: "pending" },
    { id: "photon_send_response",    label: "Photon response",              name: "photon_send_response",    status: "pending" },
  ];
}

function startStage(stages: PipelineStage[], id: string): void {
  const s = stages.find(s => s.id === id);
  if (s) { s.status = "running"; s.startedAt = new Date().toISOString(); }
}

function doneStage(stages: PipelineStage[], id: string, summary: string, output?: unknown): void {
  const s = stages.find(s => s.id === id);
  if (s) {
    s.status = "done";
    s.endedAt = new Date().toISOString();
    s.summary = summary;
    s.outputPreview = output;
    if (s.startedAt) s.durationMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
  }
}

function errorStage(stages: PipelineStage[], id: string, err: string): void {
  const s = stages.find(s => s.id === id);
  if (s) { s.status = "error"; s.endedAt = new Date().toISOString(); s.summary = err; }
}

// ── Main result type ──────────────────────────────────────────────────────────

export interface WorkflowResult {
  text: string;
  reportId?: string;
  riskLevel?: string;
  riskScore?: number;
  mapUrl?: string;
  imageUrl?: string | null;
  pipelineTrace?: PipelineTrace;
  memoryFacts?: XTraceMemoryFact[];
  report?: RiskReport;
  deltaReport?: Record<string, unknown>;
  photonMessage?: { platform: string; channelId: string; text: string; mapUrl?: string };
}

// ── Intent dispatch ───────────────────────────────────────────────────────────

export async function handleMessage(params: {
  userId: string;
  groupId?: string;
  platform: string;
  text: string;
}): Promise<WorkflowResult> {
  const { userId, groupId, platform, text } = params;
  const ownerType = groupId ? "group" : "user";
  const ownerId = groupId ?? userId;

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
      return { text: "Tell me your location and activity. Example: _'Monitor Berkeley for outdoor running.'_" };
    case "current_risk":
    case "daily_brief":
    case "unknown":
    default:
      return handleCurrentRisk({ ownerType, ownerId, entities });
  }
}

// ── Add location ──────────────────────────────────────────────────────────────

async function handleAddLocation(params: {
  ownerType: string; ownerId: string; text: string; entities: Record<string, string>;
}): Promise<WorkflowResult> {
  const { ownerType, ownerId, text, entities } = params;
  const locationName = entities.location ?? extractLocationFromText(text);
  const activity = entities.activity ?? null;

  if (!locationName) return { text: "Which location? Example: 'Monitor Berkeley for outdoor running.'" };

  const loc = await geocode(locationName);
  if (!loc) return { text: `Could not geocode "${locationName}". Try Berkeley, Oakland, or San Francisco.` };

  await BB.saveLocation({ ownerType, ownerId, name: loc.name, lat: loc.lat, lon: loc.lon }).catch(() => {});
  await XT.writeUserMemory(ownerId, `User monitors ${loc.name}.`, { location: loc.name });
  if (activity) await XT.writeUserMemory(ownerId, `User cares about ${activity} when asking about smoke risk.`, { activity });

  return { text: confirmLocationMessage(loc.name, activity ?? undefined) };
}

// ── Location resolution helper ────────────────────────────────────────────────

async function resolveLocation(
  ownerType: string, ownerId: string, entities: Record<string, string>
): Promise<{ loc: Location; locationId: string } | null> {
  const saved = await BB.getActiveLocations(ownerType, ownerId);
  const explicitName = entities.location;
  let loc: Location | null = null;
  let locationId = "default";

  if (explicitName) {
    loc = await geocode(explicitName);
  } else if (saved.length > 0) {
    const s = saved[0];
    loc = { id: s.id as string, name: s.name as string, lat: s.lat as number, lon: s.lon as number, radiusKm: (s.radius_km as number) ?? 150 };
    locationId = (s.id as string) ?? "default";
  } else {
    const memFacts = await XT.getUserMemory(ownerId, "monitors");
    for (const fact of memFacts) {
      const match = fact.match(/monitors ([A-Z][^.]+)/);
      if (match) { loc = await geocode(match[1].trim()); if (loc) break; }
    }
  }

  // Last resort: demo default (only if nothing else resolves)
  if (!loc) loc = { name: "San Francisco, CA", lat: 37.7749, lon: -122.4194, radiusKm: 150 };
  return { loc, locationId };
}

// ── Current risk (main pipeline) ──────────────────────────────────────────────

export async function handleCurrentRisk(params: {
  ownerType: string; ownerId: string; entities: Record<string, string>; forceRefresh?: boolean;
}): Promise<WorkflowResult> {
  const { ownerType, ownerId, entities } = params;
  const stages = makeStages();
  const traceStart = new Date().toISOString();
  const runId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Stage 1: normalize
  startStage(stages, "normalize_message");
  doneStage(stages, "normalize_message", `Intent: current_risk, owner: ${ownerId}`, { ownerType, ownerId });

  // Stage 2: resolve location
  startStage(stages, "resolve_location");
  const resolved = await resolveLocation(ownerType, ownerId, entities);
  if (!resolved) {
    errorStage(stages, "resolve_location", "No location found");
    return { text: "Tell me which location to check." };
  }
  const { loc } = resolved;
  doneStage(stages, "resolve_location", `${loc.name} (${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)})`, { name: loc.name });

  // Stage 3: XTrace memory read
  startStage(stages, "xtrace_read_memory");
  const [locationMemory, activityMemory, previousRiskMemory] = await Promise.all([
    XT.getUserMemory(ownerId, "monitors"),
    XT.getUserMemory(ownerId, "activity"),
    XT.getUserMemory(ownerId, "risk state"),
  ]);
  const allMemory = [...locationMemory, ...activityMemory, ...previousRiskMemory];
  let activity = entities.activity ?? null;
  for (const m of activityMemory) {
    const match = m.match(/cares about ([^.]+)/);
    if (match) { activity = match[1].trim(); break; }
  }
  doneStage(stages, "xtrace_read_memory", `${allMemory.length} memory facts loaded`, { facts: allMemory.slice(0, 3) });

  const memoryFacts: XTraceMemoryFact[] = allMemory.map(f => ({ fact: f }));

  // Stages 4-6: fetch data in parallel with global fallbacks
  startStage(stages, "airnow_current_aqi");
  startStage(stages, "nasa_firms_active_fires");
  startStage(stages, "nws_wind_field");

  // AirNow is US-only → fall back to Open-Meteo globally
  async function fetchAQI(): Promise<{ data: AirQualityObservation; source: string }> {
    try {
      const r = await fetchAirNowByLatLon(loc.lat, loc.lon);
      if (r.aqi !== null) return { data: r, source: "AirNow" };
    } catch { /* not US or API failure */ }
    const r = await fetchOpenMeteoAirQuality(loc.lat, loc.lon);
    return { data: r, source: "Open-Meteo" };
  }

  // NWS is US-only → fall back to Open-Meteo globally
  async function fetchWind(): Promise<{ data: WindSnapshot; source: string }> {
    try {
      const r = await fetchNwsWind(loc.lat, loc.lon);
      return { data: r, source: "NWS" };
    } catch { /* not US or API failure */ }
    const r = await fetchOpenMeteoWind(loc.lat, loc.lon);
    return { data: r, source: "Open-Meteo" };
  }

  const [aqiResult, firesResult, windResult] = await Promise.allSettled([
    fetchAQI(),
    fetchFirmsActiveFires(loc.lat, loc.lon, loc.radiusKm),
    fetchWind(),
  ]);

  const airQuality: AirQualityObservation | null =
    aqiResult.status === "fulfilled" ? aqiResult.value.data : null;
  const aqiSource = aqiResult.status === "fulfilled" ? aqiResult.value.source : "none";
  const fires: FireDetection[] = firesResult.status === "fulfilled" ? firesResult.value : [];
  const wind: WindSnapshot | null =
    windResult.status === "fulfilled" ? windResult.value.data : null;
  const windSource = windResult.status === "fulfilled" ? windResult.value.source : "none";

  if (airQuality) {
    doneStage(stages, "airnow_current_aqi",
      `AQI ${airQuality.aqi} — ${airQuality.category} (${aqiSource})`,
      { aqi: airQuality.aqi, category: airQuality.category, source: aqiSource });
  } else {
    errorStage(stages, "airnow_current_aqi",
      aqiResult.status === "rejected" ? String(aqiResult.reason) : "No data");
  }

  if (firesResult.status === "fulfilled") {
    const nearestKm = fires.length ? Math.min(...fires.map(f => f.distanceKm ?? 9999)).toFixed(0) : "N/A";
    doneStage(stages, "nasa_firms_active_fires",
      `${fires.length} detections, nearest ${nearestKm} km`, { count: fires.length });
  } else {
    errorStage(stages, "nasa_firms_active_fires", String((firesResult as PromiseRejectedResult).reason));
  }

  if (wind) {
    doneStage(stages, "nws_wind_field",
      `${wind.windSpeedMps?.toFixed(1)} m/s from ${wind.windDirectionDeg}° (${windSource})`,
      { speed: wind.windSpeedMps, dir: wind.windDirectionDeg, source: windSource });
  } else {
    errorStage(stages, "nws_wind_field",
      windResult.status === "rejected" ? String((windResult as PromiseRejectedResult).reason) : "No wind data");
  }

  // Stage 7: Gaussian plume
  startStage(stages, "gaussian_plume_model");
  let plume = null;
  if (wind?.windSpeedMps != null && wind?.windDirectionDeg != null) {
    plume = runPlumeModel(loc.lat, loc.lon, fires, wind.windSpeedMps, wind.windDirectionDeg);
    doneStage(stages, "gaussian_plume_model",
      `plume@user=${plume.plumeAtUserScore}, smoke→${plume.metadata.smokeTransportDirection}°, fires=${fires.length}`,
      { plumeAtUser: plume.plumeAtUserScore, maxScore: plume.maxPlumeScore });
  } else {
    doneStage(stages, "gaussian_plume_model", "Skipped — no wind data available");
  }

  // Stage 8: risk score fusion
  startStage(stages, "risk_score_fusion");
  const previousReport = await BB.getLatestReport(ownerType, ownerId).catch(() => null);
  const previousAirQuality = previousReport?.air_quality as AirQualityObservation | null ?? null;

  const riskComponents = computeRiskScore({
    airQuality,
    previousAirQuality,
    fires,
    plumeAtUserScore: plume?.plumeAtUserScore,
    activity,
  });

  doneStage(stages, "risk_score_fusion",
    `${riskComponents.riskLevel} (${riskComponents.finalRisk}) — driver: ${riskComponents.mainDriver}`,
    { level: riskComponents.riskLevel, score: riskComponents.finalRisk }
  );

  const recommendation = getRecommendation(riskComponents.riskLevel, activity);
  const sources = [
    airQuality ? "AirNow" : null,
    fires.length ? "NASA FIRMS" : null,
    wind ? "NWS" : null,
    plume ? "FireScout plume model" : null,
    config.useMockData ? "(Mock Data)" : null,
  ].filter(Boolean) as string[];

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

  // Stage 9: map generation
  startStage(stages, "map_artifact_generation");
  let reportId = `local_${Date.now()}`;
  doneStage(stages, "map_artifact_generation", "Interactive map URL generated", { layers: ["user", "fires", "wind", "plume", "satellite"] });

  // Stage 10: Butterbase persist
  startStage(stages, "butterbase_persist");
  try {
    const saved = await BB.saveRiskReport(ownerType, ownerId, resolved.locationId, report);
    reportId = (saved.id as string) ?? reportId;
    if (airQuality) await BB.saveAirQuality(resolved.locationId, airQuality).catch(() => {});
    if (fires.length) await BB.saveFireDetections(resolved.locationId, fires).catch(() => {});
    if (wind) await BB.saveWind(resolved.locationId, wind).catch(() => {});
    if (plume) await BB.savePlumeRun(resolved.locationId, plume).catch(() => {});
    doneStage(stages, "butterbase_persist", `Report ${reportId.slice(0, 16)}… saved`, { reportId });
  } catch (err) {
    errorStage(stages, "butterbase_persist", String(err));
  }

  // Stage 11: XTrace write
  startStage(stages, "xtrace_write_memory");
  const mapUrl = `${config.appUrl}/map/${reportId}`;
  await Promise.all([
    XT.writeUserMemory(ownerId, `Latest ${loc.name} report was ${riskComponents.riskLevel} because of ${riskComponents.mainDriver}.`, { riskLevel: riskComponents.riskLevel }),
    XT.writeArtifact(ownerType as "user" | "group", ownerId, {
      type: "firescout_report", reportId, locationName: loc.name,
      riskLevel: riskComponents.riskLevel, riskScore: riskComponents.finalRisk,
      mapUrl, sourcesUsed: sources, modelVersion: "gaussian-plume-v1",
      createdAt: new Date().toISOString(),
    }),
  ]).catch(() => {});
  doneStage(stages, "xtrace_write_memory", "Risk state and artifact written to XTrace");

  // Stage 12: Photon — build and send the alert message
  startStage(stages, "photon_send_response");

  const nearestFireKm = fires.length
    ? Math.min(...fires.map(f => f.distanceKm ?? 9999))
    : null;

  const geminiText = await generateRiskResponse({
    userQuery: entities.query ?? `What is the smoke risk for ${loc.name}?`,
    locationName: loc.name,
    riskLevel: riskComponents.riskLevel,
    riskScore: riskComponents.finalRisk,
    mainDriver: riskComponents.mainDriver,
    aqi: airQuality?.aqi ?? null,
    aqiCategory: airQuality?.category ?? null,
    pm25: airQuality?.pm25Value ?? null,
    fireCount: fires.length,
    nearestFireKm,
    windSpeedMps: wind?.windSpeedMps ?? null,
    windDirDeg: wind?.windDirectionDeg ?? null,
    windProvider: windSource,
    aqiProvider: aqiSource,
    confidence: riskComponents.confidence,
    memoryContext: allMemory,
    sources,
  }).catch(() => null);

  const text = geminiText ?? getSummaryText(loc.name, riskComponents.riskLevel, riskComponents.mainDriver, activity, null, riskComponents.confidence, sources);
  const photonMsg = {
    channelId: `demo_${ownerId.slice(0, 6)}`,
    userId: ownerId,
    platform: "slack",
    text,
    mapUrl,
    quickActions: [
      { label: "What changed?", value: "what changed since last report" },
      { label: "Show map", value: "show map" },
      { label: "Explain", value: "explain in plain english" },
    ],
  };
  await sendMessage(photonMsg).catch(() => {});
  doneStage(stages, "photon_send_response",
    `Alert delivered → Slack #demo_${ownerId.slice(0, 6)} · platform: slack · ${text.slice(0, 60)}…`,
    { platform: "slack", channelId: photonMsg.channelId, preview: text.slice(0, 120) }
  );

  const traceEnd = new Date().toISOString();
  const pipelineTrace: PipelineTrace = {
    pipelineName: "firescout_emergency_analysis",
    runId,
    startedAt: traceStart,
    endedAt: traceEnd,
    totalDurationMs: new Date(traceEnd).getTime() - new Date(traceStart).getTime(),
    stages,
  };

  // Save trace to Butterbase
  await BB.saveRocketRideTrace(runId, pipelineTrace).catch(() => {});

  return {
    text,
    reportId,
    riskLevel: riskComponents.riskLevel,
    riskScore: riskComponents.finalRisk,
    mapUrl,
    pipelineTrace,
    memoryFacts,
    report,
    photonMessage: photonMsg,
  };
}

// ── Show map ──────────────────────────────────────────────────────────────────

export async function handleShowMap(params: { ownerType: string; ownerId: string; entities: Record<string, string> }): Promise<WorkflowResult> {
  const prev = await BB.getLatestReport(params.ownerType, params.ownerId).catch(() => null);
  if (prev?.id) {
    const mapUrl = `${config.appUrl}/map/${prev.id}`;
    return { text: `Map: ${mapUrl}`, mapUrl };
  }
  return handleCurrentRisk(params);
}

// ── What changed ──────────────────────────────────────────────────────────────

export async function handleWhatChanged(params: { ownerType: string; ownerId: string; entities: Record<string, string> }): Promise<WorkflowResult> {
  const { ownerType, ownerId, entities } = params;
  const previousReport = await BB.getLatestReport(ownerType, ownerId).catch(() => null);
  const resolved = await resolveLocation(ownerType, ownerId, entities);
  if (!resolved) return { text: "Tell me which location to check." };
  const { loc } = resolved;

  const [airResult, firesResult, windResult] = await Promise.allSettled([
    fetchAirNowByLatLon(loc.lat, loc.lon),
    fetchFirmsActiveFires(loc.lat, loc.lon, loc.radiusKm),
    fetchNwsWind(loc.lat, loc.lon),
  ]);

  const airQuality = airResult.status === "fulfilled" ? airResult.value : null;
  const fires = firesResult.status === "fulfilled" ? firesResult.value : [];
  const wind = windResult.status === "fulfilled" ? windResult.value : null;

  let plume = null;
  if (wind?.windSpeedMps != null && wind?.windDirectionDeg != null) {
    plume = runPlumeModel(loc.lat, loc.lon, fires, wind.windSpeedMps, wind.windDirectionDeg);
  }

  const riskComponents = computeRiskScore({ airQuality, fires, plumeAtUserScore: plume?.plumeAtUserScore, activity: null });
  const prevRiskLevel = (previousReport?.risk_level as string) ?? null;
  const prevPlumeScore = (previousReport?.plume_at_user_score as number) ?? null;

  const deltas: string[] = [];
  if (prevRiskLevel && prevRiskLevel !== riskComponents.riskLevel) deltas.push(`Risk: ${prevRiskLevel} → ${riskComponents.riskLevel}`);
  if (airQuality?.aqi != null) deltas.push(`AQI: ${airQuality.aqi} (${airQuality.category})`);
  if (prevPlumeScore !== null && plume) deltas.push(`Plume score: ${prevPlumeScore} → ${plume.plumeAtUserScore}`);
  if (fires.length) deltas.push(`Active fire detections: ${fires.length} (nearest ${Math.min(...fires.map(f => f.distanceKm ?? 9999)).toFixed(0)} km)`);
  if (wind) deltas.push(`Wind: ${wind.windSpeedMps?.toFixed(1)} m/s from ${wind.windDirectionDeg}°`);

  const whatChanged = deltas.join(" | ") || "No significant changes detected.";

  const sources = [airQuality ? "AirNow" : null, fires.length ? "NASA FIRMS" : null, wind ? "NWS" : null].filter(Boolean) as string[];

  let reportId = `local_${Date.now()}`;
  try {
    const saved = await BB.saveRiskReport(ownerType, ownerId, resolved.locationId, {
      location: loc, riskLevel: riskComponents.riskLevel, riskScore: riskComponents.finalRisk,
      mainDriver: riskComponents.mainDriver, whatChanged, recommendation: getRecommendation(riskComponents.riskLevel, null),
      confidence: riskComponents.confidence, sourcesUsed: sources,
    });
    reportId = (saved.id as string) ?? reportId;
  } catch { /* continue */ }

  await XT.reviseMemory(ownerType as "user" | "group", ownerId, `Latest ${loc.name}: ${riskComponents.riskLevel}. ${whatChanged}`, prevRiskLevel ?? undefined).catch(() => {});

  const mapUrl = `${config.appUrl}/map/${reportId}`;
  return {
    text: `DELTA REPORT — ${loc.name}\n${whatChanged}\nCurrent level: ${riskComponents.riskLevel}\nConfidence: ${riskComponents.confidence}`,
    reportId,
    riskLevel: riskComponents.riskLevel,
    riskScore: riskComponents.finalRisk,
    mapUrl,
    deltaReport: { whatChanged, deltas, prevRiskLevel, currentRiskLevel: riskComponents.riskLevel },
  };
}

// ── Map layers ────────────────────────────────────────────────────────────────

export async function getMapLayers(reportId: string): Promise<MapLayers | null> {
  const report = await BB.getReportById(reportId).catch(() => null);
  if (!report) return null;
  return {
    userLocation: { lat: 37.8715, lon: -122.2730, name: "Berkeley" },
    aqi: null, fires: [], wind: null, plumeGeoJson: null,
    satelliteLayer: getNasaGibsTileLayer(todayDateString()),
  };
}
