import type { IncidentContext } from "../types";
import { distanceKm } from "../geo";

// TODO: CAL FIRE does not have a stable free public JSON API.
// For demo MVP, we return empty array and log a note.
// Possible future sources: ArcGIS REST endpoints, NIFC IRWIN,
// or scraping https://www.fire.ca.gov/incidents/

export async function fetchCalFireIncidents(
  lat: number,
  lon: number
): Promise<IncidentContext[]> {
  try {
    // Attempt NIFC IRWIN public endpoint (best available free source)
    const url =
      "https://opendata.arcgis.com/datasets/5da472c6d27b4b67970acc7b5044c862_0.geojson";
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return [];

    const data = await resp.json();
    const features = data?.features ?? [];

    return (features as Array<Record<string, unknown>>)
      .map((f) => {
        const props = f.properties as Record<string, unknown>;
        const geom = f.geometry as { coordinates: [number, number] } | null;
        if (!geom) return null;
        const [fLon, fLat] = geom.coordinates;
        return {
          name: (props.IncidentName as string) ?? "Unknown Incident",
          lat: fLat,
          lon: fLon,
          acres: (props.DailyAcres as number) ?? null,
          containment: (props.PercentContained as number) ?? null,
          updatedAt: (props.ModifiedOnDateTime_dt as string) ?? null,
          distanceKm: distanceKm(lat, lon, fLat, fLon),
          raw: props,
        } as IncidentContext;
      })
      .filter((inc): inc is IncidentContext => inc !== null)
      .filter((inc) => (inc.distanceKm ?? 9999) < 500)
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
      .slice(0, 5);
  } catch {
    // Not critical — return empty
    return [];
  }
}
