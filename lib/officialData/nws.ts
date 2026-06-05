import type { WindSnapshot } from "../types";
import { config } from "../config";

function mockWind(): WindSnapshot {
  return {
    provider: "NWS",
    windSpeedMps: 4.5,
    windDirectionDeg: 240, // wind FROM the SW, smoke goes NE
    windGustMps: 7.2,
    validTime: new Date().toISOString(),
    raw: { source: "MOCK_DATA" },
  };
}

// knots to m/s
function knotsToMps(knots: number): number {
  return knots * 0.514444;
}

export async function fetchNwsPointMetadata(lat: number, lon: number): Promise<Record<string, unknown>> {
  const url = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": config.nwsUserAgent },
  });
  if (!resp.ok) throw new Error(`NWS points API error: ${resp.status}`);
  const data = await resp.json();
  return data.properties as Record<string, unknown>;
}

export async function fetchNwsWind(lat: number, lon: number): Promise<WindSnapshot> {
  try {
    const meta = await fetchNwsPointMetadata(lat, lon);
    const forecastUrl = (meta.forecastHourly as string) ?? (meta.forecast as string);
    if (!forecastUrl) throw new Error("No forecast URL in NWS metadata");

    const fResp = await fetch(forecastUrl, {
      headers: { "User-Agent": config.nwsUserAgent },
    });
    if (!fResp.ok) throw new Error(`NWS forecast error: ${fResp.status}`);

    const fData = await fResp.json();
    const periods = fData?.properties?.periods as Array<Record<string, unknown>>;
    if (!periods?.length) throw new Error("No forecast periods");

    const current = periods[0];
    const windSpeedStr = (current.windSpeed as string) ?? "";
    const windDirStr = (current.windDirection as string) ?? "";

    // Parse speed: "10 mph" or "10 to 15 mph"
    const speedMatch = windSpeedStr.match(/(\d+)/);
    const speedMph = speedMatch ? parseFloat(speedMatch[1]) : null;
    const speedMps = speedMph !== null ? speedMph * 0.44704 : null;

    // Convert cardinal to degrees
    const cardinalToDeg: Record<string, number> = {
      N: 0, NNE: 22.5, NE: 45, ENE: 67.5,
      E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
      S: 180, SSW: 202.5, SW: 225, WSW: 247.5,
      W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
    };
    const windDirDeg = cardinalToDeg[windDirStr] ?? null;

    return {
      provider: "NWS",
      windSpeedMps: speedMps,
      windDirectionDeg: windDirDeg,
      windGustMps: null,
      validTime: (current.startTime as string) ?? new Date().toISOString(),
      raw: current,
    };
  } catch (err) {
    if (config.useMockData) return mockWind();
    throw err;
  }
}
