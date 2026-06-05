/**
 * RocketRide adapter — core workflow orchestration.
 * Uses RocketRide SDK when available; falls back to local pipeline runner.
 * Pipeline spec files in /pipelines/ are always real and documented.
 */
import { config as appConfig } from "../config";
import type { RocketRidePipelineResult } from "../types";
import fs from "fs";
import path from "path";

// Try to load RocketRide SDK
let rocketRideClient: unknown = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require("@rocketride/sdk");
  if (sdk && appConfig.butterbaseApiKey) {
    rocketRideClient = new sdk.RocketRideClient({ apiKey: appConfig.butterbaseApiKey });
  }
} catch {
  // SDK not installed — local fallback
}

function loadPipelineSpec(name: string): Record<string, unknown> | null {
  try {
    const specPath = path.join(process.cwd(), "pipelines", `${name}.pipe.json`);
    const content = fs.readFileSync(specPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Local pipeline executor — runs steps in sequence using local functions
async function runLocalPipeline(
  name: string,
  input: Record<string, unknown>
): Promise<RocketRidePipelineResult> {
  const spec = loadPipelineSpec(name);
  console.info(`[RocketRide LOCAL] Running pipeline: ${name}`, { hasSpec: !!spec, inputKeys: Object.keys(input) });

  // Delegate to named pipeline handlers
  switch (name) {
    case "firescout_message_router":
      return runMessageRouter(input);
    case "official_data_ingestion":
      return runDataIngestion(input);
    case "wind_plume_model":
      return runWindPlumeModel(input);
    case "map_generation":
      return runMapGeneration(input);
    case "risk_brief":
      return runRiskBrief(input);
    case "what_changed":
      return runWhatChanged(input);
    default:
      return { success: false, output: {}, error: `Unknown pipeline: ${name}` };
  }
}

export async function runPipeline(
  name: string,
  input: Record<string, unknown>
): Promise<RocketRidePipelineResult> {
  // Try RocketRide SDK first
  if (rocketRideClient) {
    try {
      const client = rocketRideClient as { run: (name: string, input: Record<string, unknown>) => Promise<unknown> };
      const result = await client.run(name, input);
      return { success: true, output: result as Record<string, unknown> };
    } catch (err) {
      console.warn(`[RocketRide] SDK run failed for ${name}, using local fallback:`, err);
    }
  }
  return runLocalPipeline(name, input);
}

// ── Pipeline handler stubs — actual logic in workflow files ──────────────────

async function runMessageRouter(input: Record<string, unknown>): Promise<RocketRidePipelineResult> {
  const { classifyIntent } = await import("../formatters");
  const text = (input.text as string) ?? "";
  const { intent, entities } = classifyIntent(text);
  return {
    success: true,
    output: {
      intent,
      entities,
      workflowName: intentToWorkflow(intent),
    },
  };
}

function intentToWorkflow(intent: string): string {
  const map: Record<string, string> = {
    add_location: "add_location",
    current_risk: "risk_brief",
    show_map: "map_generation",
    what_changed: "what_changed",
    explain_science: "explain_science",
    update_preferences: "update_preferences",
    daily_brief: "risk_brief",
    unknown: "risk_brief",
  };
  return map[intent] ?? "risk_brief";
}

async function runDataIngestion(input: Record<string, unknown>): Promise<RocketRidePipelineResult> {
  const { fetchAirNowByLatLon } = await import("../officialData/airnow");
  const { fetchFirmsActiveFires } = await import("../officialData/firms");
  const { fetchNwsWind } = await import("../officialData/nws");
  const { fetchCalFireIncidents } = await import("../officialData/calfire");

  const lat = input.lat as number;
  const lon = input.lon as number;

  const [airQuality, fires, wind, incidents] = await Promise.allSettled([
    fetchAirNowByLatLon(lat, lon),
    fetchFirmsActiveFires(lat, lon, (input.radiusKm as number) ?? 150),
    fetchNwsWind(lat, lon),
    fetchCalFireIncidents(lat, lon),
  ]);

  return {
    success: true,
    output: {
      airQuality: airQuality.status === "fulfilled" ? airQuality.value : null,
      fires: fires.status === "fulfilled" ? fires.value : [],
      wind: wind.status === "fulfilled" ? wind.value : null,
      incidents: incidents.status === "fulfilled" ? incidents.value : [],
      sourceMetadata: {
        airQualityOk: airQuality.status === "fulfilled",
        firesOk: fires.status === "fulfilled",
        windOk: wind.status === "fulfilled",
      },
    },
  };
}

async function runWindPlumeModel(input: Record<string, unknown>): Promise<RocketRidePipelineResult> {
  const { runPlumeModel } = await import("../plume");
  const plumeRun = runPlumeModel(
    input.lat as number,
    input.lon as number,
    (input.fires as []) ?? [],
    (input.windSpeedMps as number) ?? 3,
    (input.windDirectionDeg as number) ?? 270
  );
  return { success: true, output: { plumeRun } };
}

async function runMapGeneration(input: Record<string, unknown>): Promise<RocketRidePipelineResult> {
  const reportId = (input.reportId as string) ?? "unknown";
  const mapUrl = `${appConfig.appUrl}/map/${reportId}`;
  return {
    success: true,
    output: {
      interactiveMapUrl: mapUrl,
      staticPngUrl: null,
      geojsonUrl: null,
      layerSummary: "User marker, fire detections, wind arrow, plume heatmap, satellite toggle",
    },
  };
}

async function runRiskBrief(input: Record<string, unknown>): Promise<RocketRidePipelineResult> {
  // Orchestration handled in /api/brief route — this is a no-op stub for the pipeline runner
  return { success: true, output: input };
}

async function runWhatChanged(input: Record<string, unknown>): Promise<RocketRidePipelineResult> {
  return { success: true, output: input };
}
