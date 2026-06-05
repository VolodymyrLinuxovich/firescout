import type { FireDetection } from "../types";
import { distanceKm } from "../geo";
import { config } from "../config";

function mockFires(lat: number, lon: number): FireDetection[] {
  // Place mock fires NE of location (typical CA fire scenario)
  return [
    {
      provider: "NASA_FIRMS",
      source: "VIIRS_SNPP_NRT",
      lat: lat + 0.8,
      lon: lon + 0.6,
      brightness: 320,
      frp: 45.2,
      confidence: "high",
      satellite: "S-NPP",
      acquiredAt: new Date(Date.now() - 3600000).toISOString(),
      distanceKm: distanceKm(lat, lon, lat + 0.8, lon + 0.6),
      raw: { source: "MOCK_DATA" },
    },
    {
      provider: "NASA_FIRMS",
      source: "VIIRS_SNPP_NRT",
      lat: lat + 1.2,
      lon: lon + 0.9,
      brightness: 298,
      frp: 28.7,
      confidence: "nominal",
      satellite: "S-NPP",
      acquiredAt: new Date(Date.now() - 7200000).toISOString(),
      distanceKm: distanceKm(lat, lon, lat + 1.2, lon + 0.9),
      raw: { source: "MOCK_DATA" },
    },
  ];
}

// FIRMS API: area search by bounding box
export async function fetchFirmsActiveFires(
  lat: number,
  lon: number,
  radiusKm = 150
): Promise<FireDetection[]> {
  if (!config.nasaFirmsMapKey) {
    if (config.useMockData) return mockFires(lat, lon);
    throw new Error("NASA_FIRMS_MAP_KEY not set. Set USE_MOCK_DATA=true to use mock data.");
  }

  // Approximate degree offset for radius
  const degLat = radiusKm / 110.54;
  const degLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lon - degLon},${lat - degLat},${lon + degLon},${lat + degLat}`;

  // Try VIIRS first, then MODIS as fallback
  for (const source of ["VIIRS_SNPP_NRT", "MODIS_NRT"]) {
    try {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${config.nasaFirmsMapKey}/${source}/${bbox}/1`;
      const resp = await fetch(url);
      if (!resp.ok) continue;

      const text = await resp.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) continue;

      const headers = lines[0].split(",").map(h => h.trim());
      const detections: FireDetection[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",");
        if (values.length < headers.length) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? ""; });

        const fireLat = parseFloat(row.latitude ?? row.lat ?? "0");
        const fireLon = parseFloat(row.longitude ?? row.lon ?? "0");

        detections.push({
          provider: "NASA_FIRMS",
          source,
          lat: fireLat,
          lon: fireLon,
          brightness: parseFloat(row.bright_ti4 ?? row.brightness ?? "0") || null,
          frp: parseFloat(row.frp ?? "0") || null,
          confidence: row.confidence ?? null,
          satellite: row.satellite ?? null,
          acquiredAt: row.acq_date
            ? `${row.acq_date}T${row.acq_time?.slice(0, 2) ?? "00"}:${row.acq_time?.slice(2) ?? "00"}Z`
            : null,
          distanceKm: distanceKm(lat, lon, fireLat, fireLon),
          raw: row,
        });
      }

      if (detections.length > 0) return detections;
    } catch {
      // Try next source
    }
  }

  return [];
}
