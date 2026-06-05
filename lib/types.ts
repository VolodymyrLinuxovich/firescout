export type RiskLevel = "CLEAR" | "WATCH" | "ACT" | "CRITICAL";
export type OwnerType = "user" | "group";
export type Confidence = "High" | "Medium" | "Low";

export interface Location {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  ownerId?: string;
  ownerType?: OwnerType;
}

export interface AirQualityObservation {
  provider: "AirNow" | "Open-Meteo";
  aqi: number | null;
  category: string | null;
  pollutant: string | null;
  pm25Value?: number | null;
  ozoneValue?: number | null;
  observedAt?: string | null;
  raw?: unknown;
}

export interface FireDetection {
  provider: "NASA_FIRMS";
  source: string;
  lat: number;
  lon: number;
  brightness?: number | null;
  frp?: number | null;
  confidence?: string | number | null;
  satellite?: string | null;
  acquiredAt?: string | null;
  distanceKm?: number | null;
  raw?: unknown;
}

export interface WindSnapshot {
  provider: "NWS" | "Open-Meteo";
  windSpeedMps: number | null;
  windDirectionDeg: number | null;
  windGustMps?: number | null;
  validTime?: string | null;
  raw?: unknown;
}

export interface PlumeModelRun {
  modelVersion: string;
  plumeGeoJson: GeoJSON.FeatureCollection;
  maxPlumeScore: number;
  plumeAtUserScore: number;
  windSpeedMps: number;
  windDirectionDeg: number;
  metadata: Record<string, unknown>;
}

export interface RiskReport {
  id?: string;
  location: Location;
  riskLevel: RiskLevel;
  riskScore: number;
  mainDriver: string;
  whatChanged?: string;
  recommendation: string;
  confidence: Confidence;
  sourcesUsed: string[];
  airQuality?: AirQualityObservation;
  wind?: WindSnapshot;
  fires?: FireDetection[];
  plume?: PlumeModelRun;
  createdAt?: string;
  title?: string;
  summary?: string;
  why?: string;
  mapUrl?: string;
  imageUrl?: string | null;
}

export interface IncidentContext {
  name: string;
  lat: number;
  lon: number;
  acres?: number | null;
  containment?: number | null;
  updatedAt?: string | null;
  distanceKm?: number | null;
  raw?: unknown;
}

export interface SatelliteLayerConfig {
  provider: "NASA_GIBS";
  layerName: string;
  date: string;
  attribution: string;
  tileUrlTemplate: string;
  type: "wmts" | "wms" | "xyz";
  opacity: number;
}

export interface NormalizedMessage {
  platform: string;
  channelId: string;
  userId: string;
  groupId?: string;
  text: string;
  timestamp: string;
}

export interface RocketRidePipelineResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
}

export interface MapLayers {
  userLocation: { lat: number; lon: number; name: string };
  aqi: AirQualityObservation | null;
  fires: FireDetection[];
  wind: WindSnapshot | null;
  plumeGeoJson: GeoJSON.FeatureCollection | null;
  satelliteLayer: SatelliteLayerConfig | null;
}

export interface RiskScoreComponents {
  aqiScore: number;
  plumeScore: number;
  trendScore: number;
  fireProximityScore: number;
  activityScore: number;
  finalRisk: number;
  riskLevel: RiskLevel;
  mainDriver: string;
  confidence: Confidence;
}

export interface BriefRequestBody {
  ownerType: OwnerType;
  ownerId: string;
  locationName?: string;
  activity?: string;
  forceRefresh?: boolean;
}

// RocketRide pipeline trace
export interface PipelineStage {
  id: string;
  name: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  summary?: string;
  inputPreview?: unknown;
  outputPreview?: unknown;
}

export interface PipelineTrace {
  pipelineName: string;
  runId: string;
  startedAt: string;
  endedAt?: string;
  totalDurationMs?: number;
  stages: PipelineStage[];
}

export interface XTraceMemoryFact {
  fact: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface DeltaReport {
  riskLevelDelta: string | null;
  aqiCategoryDelta: string | null;
  pm25Delta: number | null;
  nearestFireDistanceDelta: number | null;
  activeFireCountDelta: number | null;
  windDirectionDelta: number | null;
  windSpeedDelta: number | null;
  plumeScoreDelta: number | null;
  summary: string;
}
