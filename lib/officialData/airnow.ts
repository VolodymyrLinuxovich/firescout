import type { AirQualityObservation } from "../types";
import { config } from "../config";

function mockAirNow(): AirQualityObservation {
  return {
    provider: "AirNow",
    aqi: 58,
    category: "Moderate",
    pollutant: "PM2.5",
    pm25Value: 18.4,
    ozoneValue: null,
    observedAt: new Date().toISOString(),
    raw: { source: "MOCK_DATA" },
  };
}

export async function fetchAirNowByLatLon(
  lat: number,
  lon: number
): Promise<AirQualityObservation> {
  if (!config.airnowApiKey) {
    if (config.useMockData) return mockAirNow();
    throw new Error("AIRNOW_API_KEY not set. Set USE_MOCK_DATA=true to use mock data.");
  }

  const url = new URL("https://www.airnowapi.org/aq/observation/latLong/current/");
  url.searchParams.set("format", "application/json");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("distance", "25");
  url.searchParams.set("API_KEY", config.airnowApiKey);

  const resp = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!resp.ok) {
    throw new Error(`AirNow API error: ${resp.status} ${resp.statusText}`);
  }

  const data: unknown[] = await resp.json();
  if (!Array.isArray(data) || data.length === 0) {
    // No observations nearby
    return {
      provider: "AirNow",
      aqi: null,
      category: null,
      pollutant: null,
      observedAt: new Date().toISOString(),
      raw: data,
    };
  }

  // Prefer PM2.5 observation; fall back to highest AQI
  const sorted = [...data].sort((a: unknown, b: unknown) => {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    const order = (r: Record<string, unknown>) =>
      (r.ParameterName as string) === "PM2.5" ? 0 : 1;
    return order(ra) - order(rb);
  });

  const obs = sorted[0] as Record<string, unknown>;
  const pm25Obs = (data as Record<string, unknown>[]).find(
    d => (d.ParameterName as string) === "PM2.5"
  );
  const ozoneObs = (data as Record<string, unknown>[]).find(
    d => (d.ParameterName as string) === "O3"
  );

  return {
    provider: "AirNow",
    aqi: (obs.AQI as number) ?? null,
    category: ((obs.Category as Record<string, unknown>)?.Name as string) ?? null,
    pollutant: (obs.ParameterName as string) ?? null,
    pm25Value: pm25Obs ? (pm25Obs.Value as number) ?? null : null,
    ozoneValue: ozoneObs ? (ozoneObs.Value as number) ?? null : null,
    observedAt: (obs.DateObserved as string)
      ? `${obs.DateObserved as string} ${obs.HourObserved as string}:00`
      : new Date().toISOString(),
    raw: data,
  };
}
