"use client";
import RiskBadge from "./RiskBadge";
import type { RiskLevel, Confidence } from "@/lib/types";

interface ReportCardProps {
  locationName: string;
  riskLevel: RiskLevel;
  riskScore: number;
  mainDriver: string;
  recommendation: string;
  confidence: Confidence;
  sourcesUsed: string[];
  whatChanged?: string | null;
  aqi?: number | null;
  aqiCategory?: string | null;
  pm25?: number | null;
  windSpeed?: number | null;
  windDir?: number | null;
  fireCount?: number;
  createdAt?: string;
  isMock?: boolean;
}

export default function ReportCard({
  locationName, riskLevel, riskScore, mainDriver, recommendation, confidence,
  sourcesUsed, whatChanged, aqi, aqiCategory, pm25, windSpeed, windDir,
  fireCount, createdAt, isMock,
}: ReportCardProps) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "20px 24px",
      maxWidth: 400,
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    }}>
      {isMock && (
        <div style={{ background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6, padding: "6px 10px", marginBottom: 12, fontSize: 12, color: "#92400e" }}>
          ⚠ Mock data mode — confidence: Low
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#111827" }}>FireScout — {locationName}</div>
          {createdAt && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{new Date(createdAt).toLocaleString()}</div>}
        </div>
        <RiskBadge level={riskLevel} score={riskScore} large />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {aqi != null && (
          <DataItem label="AQI" value={String(aqi)} sub={aqiCategory ?? undefined} />
        )}
        {pm25 != null && (
          <DataItem label="PM2.5" value={`${pm25} μg/m³`} />
        )}
        {windSpeed != null && (
          <DataItem label="Wind" value={`${windSpeed.toFixed(1)} m/s`} sub={windDir != null ? `from ${windDir}°` : undefined} />
        )}
        {fireCount !== undefined && (
          <DataItem label="Active Fires" value={String(fireCount)} sub="NASA FIRMS" />
        )}
      </div>

      {whatChanged && (
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: "#1e40af", marginBottom: 4 }}>What changed</div>
          <div style={{ fontSize: 13, color: "#1e3a8a" }}>{whatChanged}</div>
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 4 }}>Recommendation</div>
        <div style={{ fontSize: 13, color: "#374151" }}>{recommendation}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 12, color: "#374151", marginBottom: 4 }}>Main driver</div>
        <div style={{ fontSize: 13, color: "#4b5563" }}>{mainDriver}</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>
          Confidence: <strong>{confidence}</strong>
        </div>
        <div style={{ fontSize: 10, color: "#d1d5db", maxWidth: 200, textAlign: "right" }}>
          {sourcesUsed.join(", ")}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>
        FireScout is decision support, not an emergency authority. For emergency guidance follow local officials, CAL FIRE, and NWS.
      </div>
    </div>
  );
}

function DataItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}
