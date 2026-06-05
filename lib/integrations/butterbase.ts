/**
 * Butterbase adapter.
 * Uses fetch-based REST if no official SDK is available.
 * All writes keep raw_json for debugging.
 */
import { config } from "../config";
import type { RiskReport, AirQualityObservation, FireDetection, WindSnapshot, PlumeModelRun } from "../types";

const BASE_URL = "https://api.butterbase.com/v1";

let _bbAvailable: boolean | null = null;

async function bbFetch(path: string, options?: RequestInit): Promise<unknown> {
  if (!config.butterbaseApiKey) {
    throw new Error("BUTTERBASE_API_KEY not set");
  }
  const resp = await fetch(`${BASE_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.butterbaseApiKey}`,
      "X-Project-Id": config.butterbaseProjectId,
      ...(options?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Butterbase API error ${resp.status}: ${body}`);
  }
  return resp.json();
}

async function isReachable(): Promise<boolean> {
  if (_bbAvailable === false) return false;
  if (!config.butterbaseApiKey) return false;
  try {
    await fetch(`${BASE_URL}/health`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
      headers: { Authorization: `Bearer ${config.butterbaseApiKey}` },
    });
    _bbAvailable = true;
    return true;
  } catch {
    _bbAvailable = false;
    return false;
  }
}

// ── In-memory fallback store (used when BUTTERBASE_API_KEY is missing) ──────
const memStore: Record<string, Record<string, unknown>[]> = {};
function memInsert(table: string, row: Record<string, unknown>): Record<string, unknown> {
  if (!memStore[table]) memStore[table] = [];
  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = { id, ...row, created_at: new Date().toISOString() };
  memStore[table].push(record);
  return record;
}
function memQuery(table: string, filter?: (r: Record<string, unknown>) => boolean): Record<string, unknown>[] {
  return (memStore[table] ?? []).filter(r => !filter || filter(r));
}

function isAvailable(): boolean {
  return !!config.butterbaseApiKey && _bbAvailable !== false;
}

// ── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(params: {
  photonUserId: string;
  platform: string;
  displayName?: string;
}): Promise<Record<string, unknown>> {
  const existing = memQuery("users", r => r.photon_user_id === params.photonUserId);
  if (existing.length > 0) return existing[0];
  const memRow = memInsert("users", { photon_user_id: params.photonUserId, platform: params.platform, display_name: params.displayName ?? null });
  if (!isAvailable()) return memRow;
  try {
    const result = await bbFetch("/users/upsert", {
      method: "POST",
      body: JSON.stringify({ photon_user_id: params.photonUserId, platform: params.platform, display_name: params.displayName ?? null }),
    });
    return result as Record<string, unknown>;
  } catch { _bbAvailable = false; return memRow; }
}

// ── Locations ────────────────────────────────────────────────────────────────
export async function saveLocation(params: {
  ownerType: string;
  ownerId: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm?: number;
}): Promise<Record<string, unknown>> {
  const row = {
    owner_type: params.ownerType,
    owner_id: params.ownerId,
    name: params.name,
    lat: params.lat,
    lon: params.lon,
    radius_km: params.radiusKm ?? 150,
    is_active: true,
  };
  const memRow = memInsert("locations", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/locations", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

export async function getActiveLocations(ownerType: string, ownerId: string): Promise<Record<string, unknown>[]> {
  if (!isAvailable()) {
    return memQuery("locations", r => r.owner_type === ownerType && r.owner_id === ownerId && r.is_active !== false);
  }
  try {
    return await bbFetch(`/locations?owner_type=${ownerType}&owner_id=${ownerId}&is_active=true`) as Record<string, unknown>[];
  } catch {
    _bbAvailable = false;
    return memQuery("locations", r => r.owner_type === ownerType && r.owner_id === ownerId && r.is_active !== false);
  }
}

// ── Air quality ───────────────────────────────────────────────────────────────
export async function saveAirQuality(locationId: string, obs: AirQualityObservation): Promise<Record<string, unknown>> {
  const row = {
    location_id: locationId,
    provider: obs.provider,
    aqi: obs.aqi,
    category: obs.category,
    pollutant: obs.pollutant,
    pm25_value: obs.pm25Value ?? null,
    ozone_value: obs.ozoneValue ?? null,
    observed_at: obs.observedAt ?? null,
    raw_json: obs.raw,
  };
  const memRow = memInsert("air_quality_observations", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/air-quality", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

// ── Fire detections ───────────────────────────────────────────────────────────
export async function saveFireDetections(locationId: string, fires: FireDetection[]): Promise<void> {
  for (const fire of fires) {
    const row = {
      location_id: locationId,
      provider: fire.provider,
      source: fire.source,
      lat: fire.lat,
      lon: fire.lon,
      brightness: fire.brightness ?? null,
      frp: fire.frp ?? null,
      confidence: String(fire.confidence ?? ""),
      satellite: fire.satellite ?? null,
      acquired_at: fire.acquiredAt ?? null,
      distance_km: fire.distanceKm ?? null,
      raw_json: fire.raw,
    };
    memInsert("fire_detections", row);
    if (!isAvailable()) continue;
    try { await bbFetch("/fire-detections", { method: "POST", body: JSON.stringify(row) }); }
    catch { _bbAvailable = false; }
  }
}

// ── Wind ─────────────────────────────────────────────────────────────────────
export async function saveWind(locationId: string, wind: WindSnapshot): Promise<Record<string, unknown>> {
  const row = {
    location_id: locationId,
    provider: wind.provider,
    wind_speed_mps: wind.windSpeedMps,
    wind_direction_deg: wind.windDirectionDeg,
    wind_gust_mps: wind.windGustMps ?? null,
    valid_time: wind.validTime ?? null,
    raw_json: wind.raw,
  };
  const memRow = memInsert("wind_snapshots", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/wind", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

// ── Plume model runs ──────────────────────────────────────────────────────────
export async function savePlumeRun(locationId: string, plume: PlumeModelRun): Promise<Record<string, unknown>> {
  const row = {
    location_id: locationId,
    model_version: plume.modelVersion,
    wind_speed_mps: plume.windSpeedMps,
    wind_direction_deg: plume.windDirectionDeg,
    max_plume_score: plume.maxPlumeScore,
    plume_at_user_score: plume.plumeAtUserScore,
    plume_geojson: plume.plumeGeoJson,
    grid_bounds: plume.metadata,
  };
  const memRow = memInsert("plume_model_runs", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/plume-runs", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

// ── Risk reports ──────────────────────────────────────────────────────────────
export async function saveRiskReport(
  ownerType: string,
  ownerId: string,
  locationId: string,
  report: RiskReport
): Promise<Record<string, unknown>> {
  const row = {
    owner_type: ownerType,
    owner_id: ownerId,
    location_id: locationId,
    risk_level: report.riskLevel,
    risk_score: report.riskScore,
    main_driver: report.mainDriver,
    what_changed: report.whatChanged ?? null,
    recommendation: report.recommendation,
    confidence: report.confidence,
    sources_used: report.sourcesUsed,
  };
  const memRow = memInsert("risk_reports", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/risk-reports", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

export async function getLatestReport(
  ownerType: string,
  ownerId: string,
  locationId?: string
): Promise<Record<string, unknown> | null> {
  if (!isAvailable()) {
    const all = memQuery("risk_reports", r =>
      r.owner_type === ownerType &&
      r.owner_id === ownerId &&
      (!locationId || r.location_id === locationId)
    );
    if (!all.length) return null;
    return all.sort((a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    )[0];
  }
  const queryParams = new URLSearchParams({ owner_type: ownerType, owner_id: ownerId, limit: "1" });
  if (locationId) queryParams.set("location_id", locationId);
  try {
    const results = await bbFetch(`/risk-reports?${queryParams}`) as Record<string, unknown>[];
    return results?.[0] ?? null;
  } catch {
    _bbAvailable = false;
    const all = memQuery("risk_reports", r =>
      r.owner_type === ownerType &&
      r.owner_id === ownerId &&
      (!locationId || r.location_id === locationId)
    );
    if (!all.length) return null;
    return all.sort((a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
    )[0];
  }
}

export async function getReportById(reportId: string): Promise<Record<string, unknown> | null> {
  if (!isAvailable()) {
    return memQuery("risk_reports", r => r.id === reportId)?.[0] ?? null;
  }
  try { return await bbFetch(`/risk-reports/${reportId}`) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memQuery("risk_reports", r => r.id === reportId)?.[0] ?? null; }
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function saveMessage(params: {
  ownerType: string;
  ownerId: string;
  platform: string;
  inboundText: string;
  outboundText?: string;
  reportId?: string;
}): Promise<Record<string, unknown>> {
  const row = {
    owner_type: params.ownerType,
    owner_id: params.ownerId,
    platform: params.platform,
    inbound_text: params.inboundText,
    outbound_text: params.outboundText ?? null,
    report_id: params.reportId ?? null,
  };
  const memRow = memInsert("messages", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/messages", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

// ── Map artifacts ─────────────────────────────────────────────────────────────
export async function saveMapArtifact(params: {
  reportId: string;
  interactiveMapUrl?: string;
  staticPngUrl?: string;
  geojsonUrl?: string;
  satelliteLayerUsed?: string;
}): Promise<Record<string, unknown>> {
  const row = {
    report_id: params.reportId,
    interactive_map_url: params.interactiveMapUrl ?? null,
    static_png_url: params.staticPngUrl ?? null,
    geojson_url: params.geojsonUrl ?? null,
    satellite_layer_used: params.satelliteLayerUsed ?? null,
  };
  const memRow = memInsert("map_artifacts", row);
  if (!isAvailable()) return memRow;
  try { return await bbFetch("/map-artifacts", { method: "POST", body: JSON.stringify(row) }) as Record<string, unknown>; }
  catch { _bbAvailable = false; return memRow; }
}

// ── RocketRide traces ─────────────────────────────────────────────────────────
export async function saveRocketRideTrace(runId: string, trace: unknown): Promise<void> {
  const row = { run_id: runId, trace_json: trace };
  memInsert("rocketride_traces", row);
  if (!isAvailable()) return;
  try { await bbFetch("/rocketride-traces", { method: "POST", body: JSON.stringify(row) }); }
  catch { _bbAvailable = false; }
}

export async function getLatestTrace(ownerId: string): Promise<Record<string, unknown> | null> {
  if (!isAvailable()) {
    const all = memQuery("rocketride_traces");
    if (!all.length) return null;
    return all[all.length - 1];
  }
  try {
    const results = await bbFetch(`/rocketride-traces?owner_id=${ownerId}&limit=1`) as Record<string, unknown>[];
    return results?.[0] ?? null;
  } catch {
    _bbAvailable = false;
    const all = memQuery("rocketride_traces");
    return all.length ? all[all.length - 1] : null;
  }
}

export { isAvailable as isButterbaseAvailable, memStore as _memStore };
