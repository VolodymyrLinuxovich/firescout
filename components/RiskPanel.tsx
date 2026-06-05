"use client";
import type { RiskReport, RiskLevel } from "@/lib/types";

const RISK_COLORS: Record<RiskLevel, { bg: string; border: string; text: string; glow: string }> = {
  CLEAR:    { bg: "#052E16", border: "#22C55E", text: "#22C55E", glow: "rgba(34,197,94,0.2)" },
  WATCH:    { bg: "#422006", border: "#FACC15", text: "#FACC15", glow: "rgba(250,204,21,0.2)" },
  ACT:      { bg: "#431407", border: "#F97316", text: "#F97316", glow: "rgba(249,115,22,0.2)" },
  CRITICAL: { bg: "#450A0A", border: "#EF4444", text: "#EF4444", glow: "rgba(239,68,68,0.3)" },
};

interface Props {
  report: RiskReport | null;
  locationName: string;
  loading?: boolean;
  isMock?: boolean;
}

export default function RiskPanel({ report, locationName, loading, isMock }: Props) {
  const level = report?.riskLevel ?? "WATCH";
  const c = RISK_COLORS[level];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {isMock && (
        <div style={{ background: "#422006", border: "1px solid #FACC1566", borderRadius: 6, padding: "5px 10px", fontSize: 10, color: "#FACC15" }}>
          ⚠ MOCK DATA — Confidence: Low
        </div>
      )}

      {/* Location header */}
      <div style={{ background: "#111827", border: "1px solid #263241", borderRadius: 8, padding: "10px 14px" }}>
        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>Monitored Location</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#F8FAFC" }}>{locationName}</div>
        <div style={{ fontSize: 10, color: "#4B5563" }}>37.8715° N, 122.2730° W · 150 km radius</div>
      </div>

      {/* Risk level */}
      <div style={{
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 8, padding: "12px 14px",
        boxShadow: `0 0 20px ${c.glow}`,
      }}>
        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Risk Level {loading && <span style={{ color: "#38BDF8" }}>· UPDATING…</span>}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <div style={{
            fontSize: 32, fontWeight: 900, color: c.text, letterSpacing: "-0.02em",
            animation: level === "CRITICAL" || level === "ACT" ? "riskPulse 2s ease-in-out infinite" : "none",
          }}>
            {level}
          </div>
          {report && (
            <div style={{ fontSize: 20, fontWeight: 700, color: c.text, opacity: 0.6 }}>
              {report.riskScore}
            </div>
          )}
        </div>
        {report && (
          <div style={{ fontSize: 10, color: c.text, opacity: 0.7, marginTop: 3 }}>
            Driver: {report.mainDriver}
          </div>
        )}
      </div>

      {/* Data cards grid */}
      {report && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <DataCard
            label="AQI"
            value={report.airQuality?.aqi != null ? String(report.airQuality.aqi) : "—"}
            sub={report.airQuality?.category ?? "No data"}
            source="AirNow"
            color={aqiColor(report.airQuality?.aqi)}
          />
          <DataCard
            label="PM2.5"
            value={report.airQuality?.pm25Value != null ? `${report.airQuality.pm25Value}` : "—"}
            sub="μg/m³"
            source="AirNow"
            color="#38BDF8"
          />
          <DataCard
            label="Wind Speed"
            value={report.wind?.windSpeedMps != null ? `${report.wind.windSpeedMps.toFixed(1)}` : "—"}
            sub="m/s"
            source="NWS"
            color="#A78BFA"
          />
          <DataCard
            label="Wind Dir"
            value={report.wind?.windDirectionDeg != null ? `${report.wind.windDirectionDeg}°` : "—"}
            sub="FROM"
            source="NWS"
            color="#A78BFA"
          />
          <DataCard
            label="Active Fires"
            value={report.fires != null ? String(report.fires.length) : "—"}
            sub="detections"
            source="NASA FIRMS"
            color="#F97316"
          />
          <DataCard
            label="Nearest Fire"
            value={report.fires?.length ? `${Math.min(...report.fires.map(f => f.distanceKm ?? 9999)).toFixed(0)}` : "—"}
            sub="km"
            source="NASA FIRMS"
            color="#F97316"
          />
        </div>
      )}

      {/* Plume score */}
      {report?.plume && (
        <div style={{ background: "#111827", border: "1px solid #263241", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Plume Model Output</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <MiniStat label="At location" value={String(report.plume.plumeAtUserScore)} unit="/100" />
            <MiniStat label="Grid max" value={String(report.plume.maxPlumeScore)} unit="/100" />
            <MiniStat label="Smoke dir" value={`${((report.plume.windDirectionDeg + 180) % 360).toFixed(0)}°`} unit="" />
            <MiniStat label="Fires used" value={String((report.plume.metadata.fireCount as number) ?? report.fires?.length ?? 0)} unit="" />
          </div>
          <div style={{ marginTop: 6, fontSize: 9, color: "#4B5563", fontStyle: "italic" }}>
            Explainable wind-based estimate · Not an official forecast
          </div>
        </div>
      )}

      {/* Recommendation */}
      {report && (
        <div style={{ background: "#111827", border: "1px solid #263241", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>Recommendation</div>
          <div style={{ fontSize: 12, color: "#E2E8F0", lineHeight: 1.5 }}>{report.recommendation}</div>
        </div>
      )}

      {/* Confidence + sources */}
      {report && (
        <div style={{ background: "#0B0F14", border: "1px solid #1E293B", borderRadius: 6, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence</span>
            <span style={{ fontSize: 10, color: confidenceColor(report.confidence), fontWeight: 700 }}>{report.confidence}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {report.sourcesUsed.map(s => (
              <span key={s} style={{ fontSize: 9, background: "#1E293B", color: "#64748B", padding: "2px 6px", borderRadius: 4 }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: "#374151", lineHeight: 1.4, padding: "6px 0" }}>
        FireScout is decision support only. For evacuation or emergency guidance, follow local officials, CAL FIRE, NWS, and emergency alerts.
      </div>
    </div>
  );
}

function DataCard({ label, value, sub, source, color }: { label: string; value: string; sub: string; source: string; color: string }) {
  return (
    <div style={{ background: "#0B0F14", border: "1px solid #1E293B", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 8, color: "#4B5563", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 8, color: "#374151" }}>{sub}</div>
      <div style={{ fontSize: 8, color: "#263241", marginTop: 2 }}>{source}</div>
    </div>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 9, color: "#4B5563" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA" }}>{value}<span style={{ fontSize: 9, color: "#4B5563" }}>{unit}</span></span>
    </div>
  );
}

function aqiColor(aqi: number | null | undefined): string {
  if (aqi == null) return "#4B5563";
  if (aqi <= 50) return "#22C55E";
  if (aqi <= 100) return "#FACC15";
  if (aqi <= 150) return "#F97316";
  if (aqi <= 200) return "#EF4444";
  return "#A855F7";
}

function confidenceColor(c: string): string {
  if (c === "High") return "#22C55E";
  if (c === "Medium") return "#FACC15";
  return "#EF4444";
}
