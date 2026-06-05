/**
 * Open-Meteo — free, no API key, global coverage.
 * Used as fallback when AirNow (US-only) or NWS (US-only) has no data.
 */
import type { AirQualityObservation, WindSnapshot } from "../types";

export async function fetchOpenMeteoAirQuality(
  lat: number,
  lon: number
): Promise<AirQualityObservation> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "pm2_5,us_aqi,european_aqi");
  url.searchParams.set("timezone", "auto");

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Open-Meteo AQ ${resp.status}`);
  const data = await resp.json() as {
    current?: { pm2_5?: number; us_aqi?: number; european_aqi?: number };
  };

  const cur = data.current ?? {};
  const aqi = cur.us_aqi ?? cur.european_aqi ?? null;
  const pm25 = cur.pm2_5 ?? null;

  let category: string | null = null;
  if (aqi !== null) {
    if (aqi <= 50)       category = "Good";
    else if (aqi <= 100) category = "Moderate";
    else if (aqi <= 150) category = "Unhealthy for Sensitive Groups";
    else if (aqi <= 200) category = "Unhealthy";
    else if (aqi <= 300) category = "Very Unhealthy";
    else                 category = "Hazardous";
  }

  return {
    provider: "Open-Meteo",
    aqi,
    category,
    pollutant: pm25 !== null ? "PM2.5" : null,
    pm25Value: pm25,
    ozoneValue: null,
    observedAt: new Date().toISOString(),
    raw: data,
  };
}

export async function fetchOpenMeteoWind(
  lat: number,
  lon: number
): Promise<WindSnapshot> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "wind_speed_10m,wind_direction_10m,wind_gusts_10m");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "1");

  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Open-Meteo weather ${resp.status}`);
  const data = await resp.json() as {
    current?: { wind_speed_10m?: number; wind_direction_10m?: number; wind_gusts_10m?: number };
    current_units?: { wind_speed_10m?: string };
  };

  const cur = data.current ?? {};
  const units = data.current_units ?? {};

  // Open-Meteo returns km/h by default; convert to m/s
  const toMps = (units.wind_speed_10m === "mp/h") ? 0.44704 : (1 / 3.6);
  const speedMps = cur.wind_speed_10m != null ? cur.wind_speed_10m * toMps : null;
  const gustMps  = cur.wind_gusts_10m  != null ? cur.wind_gusts_10m  * toMps : null;

  return {
    provider: "Open-Meteo",
    windSpeedMps: speedMps,
    windDirectionDeg: cur.wind_direction_10m ?? null,
    windGustMps: gustMps,
    validTime: new Date().toISOString(),
    raw: data,
  };
}
