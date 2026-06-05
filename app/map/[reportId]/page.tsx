import ReportCard from "@/components/ReportCard";
import MapPageClient from "@/components/MapPageClient";
import type { MapLayers, RiskLevel, Confidence } from "@/lib/types";

interface MapPageData {
  report: Record<string, unknown>;
  layers: MapLayers;
}

async function fetchMapData(reportId: string): Promise<MapPageData | null> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const resp = await fetch(`${base}/api/map/${reportId}`, { cache: "no-store" });
    if (!resp.ok) return null;
    return resp.json() as Promise<MapPageData>;
  } catch {
    return null;
  }
}

export default async function MapPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const data = await fetchMapData(reportId);

  const report = data?.report ?? {};
  const layers = data?.layers ?? {
    userLocation: { lat: 37.8715, lon: -122.2730, name: "Berkeley" },
    aqi: null,
    fires: [],
    wind: null,
    plumeGeoJson: null,
    satelliteLayer: null,
  };

  const locationName = (layers?.userLocation?.name as string) ?? "Berkeley";
  const riskLevel = (report?.risk_level as RiskLevel) ?? "WATCH";
  const riskScore = (report?.risk_score as number) ?? 0;
  const mainDriver = (report?.main_driver as string) ?? "AirNow / PM2.5 measurements";
  const recommendation = (report?.recommendation as string) ?? "Check current conditions before going outside.";
  const confidence = (report?.confidence as Confidence) ?? "Medium";
  const sourcesUsed = (report?.sources_used as string[]) ?? ["AirNow", "NASA FIRMS", "NWS"];
  const whatChanged = (report?.what_changed as string) ?? null;
  const createdAt = (report?.created_at as string) ?? undefined;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", background: "#f3f4f6", minHeight: "100vh" }}>
      <header style={{
        background: "linear-gradient(90deg, #1a1a2e 0%, #0f3460 100%)",
        color: "#fff",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <a href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 22 }}>🔥</a>
        <div>
          <span style={{ fontWeight: 700, fontSize: 18 }}>FireScout</span>
          <span style={{ margin: "0 8px", opacity: 0.5 }}>·</span>
          <span style={{ opacity: 0.8, fontSize: 14 }}>{locationName} Smoke Risk Map</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          Report: {reportId.slice(0, 12)}…
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 20, padding: 20, alignItems: "start" }}>
        <MapPageClient layers={layers} riskLevel={riskLevel} />

        <div>
          <ReportCard
            locationName={locationName}
            riskLevel={riskLevel}
            riskScore={riskScore}
            mainDriver={mainDriver}
            recommendation={recommendation}
            confidence={confidence}
            sourcesUsed={sourcesUsed}
            whatChanged={whatChanged}
            aqi={layers?.aqi?.aqi ?? null}
            aqiCategory={layers?.aqi?.category ?? null}
            pm25={layers?.aqi?.pm25Value ?? null}
            windSpeed={layers?.wind?.windSpeedMps ?? null}
            windDir={layers?.wind?.windDirectionDeg ?? null}
            fireCount={layers?.fires?.length ?? 0}
            createdAt={createdAt}
          />
        </div>
      </div>
    </div>
  );
}
