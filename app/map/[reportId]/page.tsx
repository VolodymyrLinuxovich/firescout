import MapPageClient from "@/components/MapPageClient";
import Link from "next/link";
import type { MapLayers, RiskLevel } from "@/lib/types";

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

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CLEAR:    { bg: "#052E16", border: "#22C55E", text: "#22C55E" },
  WATCH:    { bg: "#422006", border: "#FACC15", text: "#FACC15" },
  ACT:      { bg: "#431407", border: "#F97316", text: "#F97316" },
  CRITICAL: { bg: "#450A0A", border: "#EF4444", text: "#EF4444" },
};

export default async function MapPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const data = await fetchMapData(reportId);

  const report = data?.report ?? {};
  const layers: MapLayers = data?.layers ?? {
    userLocation: { lat: 37.8715, lon: -122.2730, name: "Berkeley" },
    aqi: null,
    fires: [],
    wind: null,
    plumeGeoJson: null,
    satelliteLayer: null,
  };

  const locationName = (layers.userLocation?.name) ?? "Berkeley";
  const riskLevel = ((report?.risk_level as RiskLevel) ?? (report?.riskLevel as RiskLevel) ?? "WATCH") as RiskLevel;
  const riskScore = (report?.risk_score as number) ?? (report?.riskScore as number) ?? 0;
  const mainDriver = (report?.main_driver as string) ?? (report?.mainDriver as string) ?? "AirNow AQI";
  const recommendation = (report?.recommendation as string) ?? "Check current conditions before going outside.";
  const whatChanged = (report?.what_changed as string) ?? (report?.whatChanged as string) ?? null;
  const rc = RISK_COLORS[riskLevel] ?? RISK_COLORS.WATCH;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070A0F",
      color: "#F8FAFC",
      fontFamily: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <header style={{
        background: "#050709",
        borderBottom: "1px solid #1E293B",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexShrink: 0,
      }}>
        <Link href="/demo" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 11 }}>
          ← Console
        </Link>
        <div style={{ width: 1, height: 16, background: "#1E293B" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#F8FAFC" }}>FireScout</span>
        <span style={{ fontSize: 10, color: "#4B5563" }}>·</span>
        <span style={{ fontSize: 10, color: "#4B5563" }}>{locationName} Tactical Map</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            background: rc.bg, border: `1px solid ${rc.border}`,
            borderRadius: 4, padding: "2px 10px",
            fontSize: 11, fontWeight: 800, color: rc.text,
          }}>
            {riskLevel} {riskScore > 0 && `· ${riskScore}`}
          </div>
          <span style={{ fontSize: 9, color: "#374151" }}>Report: {reportId.slice(0, 14)}…</span>
        </div>
      </header>

      {/* Map (full height) */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapPageClient layers={layers} riskLevel={riskLevel} />
      </div>

      {/* Footer bar */}
      <div style={{
        background: "#050709",
        borderTop: "1px solid #1E293B",
        padding: "8px 20px",
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: "#4B5563" }}>
          <span style={{ color: "#94A3B8", fontWeight: 700 }}>Driver: </span>{mainDriver}
        </div>
        {whatChanged && (
          <div style={{ fontSize: 10, color: "#4B5563" }}>
            <span style={{ color: "#FACC15", fontWeight: 700 }}>Δ </span>{whatChanged}
          </div>
        )}
        <div style={{ fontSize: 10, color: "#4B5563" }}>{recommendation}</div>
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#263241" }}>
          AirNow = real-time/preliminary AQI · FireScout is DECISION SUPPORT, not an emergency authority
        </div>
      </div>
    </div>
  );
}
