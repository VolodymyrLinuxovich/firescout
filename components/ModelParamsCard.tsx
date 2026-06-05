"use client";
import type { RiskReport } from "@/lib/types";

interface Props { report: RiskReport | null }

export default function ModelParamsCard({ report }: Props) {
  if (!report) return (
    <div style={{ color: "#374151", fontSize: 11, padding: "12px 0" }}>Run analysis to see model parameters.</div>
  );

  const plume = report.plume;
  const smokeDir = plume ? (plume.windDirectionDeg + 180) % 360 : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Gaussian equation */}
      <div style={{ background: "#070A0F", border: "1px solid #1E293B", borderRadius: 6, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Gaussian Plume Equation</div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#A78BFA", lineHeight: 1.7, overflowX: "auto", whiteSpace: "nowrap" }}>
          C(x,y,z) = Q/(2πuσ<sub>y</sub>σ<sub>z</sub>)
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#A78BFA", lineHeight: 1.7 }}>
          · exp(-y²/(2σ<sub>y</sub>²))
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: "#A78BFA", lineHeight: 1.7 }}>
          · [exp(-(z-H)²/(2σ<sub>z</sub>²)) + exp(-(z+H)²/(2σ<sub>z</sub>²))]
        </div>
        <div style={{ marginTop: 8, fontSize: 9, color: "#374151", lineHeight: 1.5 }}>
          Measured AQI anchors the final risk. The plume model estimates possible smoke transport from satellite fire detections and wind.
        </div>
      </div>

      {/* Parameters table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {[
          { label: "Wind speed (u)", value: plume ? `${plume.windSpeedMps.toFixed(1)} m/s` : "—", color: "#A78BFA" },
          { label: "Wind dir (FROM)", value: plume ? `${plume.windDirectionDeg}°` : "—", color: "#A78BFA" },
          { label: "Smoke transport", value: smokeDir != null ? `${smokeDir.toFixed(0)}°` : "—", color: "#F97316" },
          { label: "Fire detections", value: String(plume?.metadata?.fireCount ?? report.fires?.length ?? 0), color: "#F97316" },
          { label: "Grid resolution", value: `${plume?.metadata?.gridN ?? 40}×${plume?.metadata?.gridN ?? 40}`, color: "#38BDF8" },
          { label: "Grid radius", value: `${plume?.metadata?.gridRadiusKm ?? 100} km`, color: "#38BDF8" },
          { label: "Plume @ user", value: plume ? `${plume.plumeAtUserScore}/100` : "—", color: "#A78BFA" },
          { label: "AQI score", value: report.riskScore != null ? `${Math.round(report.riskScore / 0.45 * 0.45)}/100` : "—", color: "#FACC15" },
        ].map(p => (
          <div key={p.label} style={{ background: "#070A0F", border: "1px solid #1E293B", borderRadius: 4, padding: "6px 8px" }}>
            <div style={{ fontSize: 8, color: "#374151", marginBottom: 1 }}>{p.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.value}</div>
          </div>
        ))}
      </div>

      {/* Risk fusion weights */}
      <div style={{ background: "#070A0F", border: "1px solid #1E293B", borderRadius: 6, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Risk Fusion Weights</div>
        {[
          { label: "AQI (AirNow measured)", pct: 45, color: "#38BDF8" },
          { label: "Plume transport (modeled)", pct: 25, color: "#A78BFA" },
          { label: "Trend (vs previous)", pct: 15, color: "#FACC15" },
          { label: "Fire proximity", pct: 10, color: "#F97316" },
          { label: "Activity risk", pct: 5, color: "#94A3B8" },
        ].map(w => (
          <div key={w.label} style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: "#4B5563" }}>{w.label}</span>
              <span style={{ fontSize: 9, color: w.color, fontWeight: 700 }}>{w.pct}%</span>
            </div>
            <div style={{ height: 3, background: "#1E293B", borderRadius: 2 }}>
              <div style={{ height: 3, width: `${w.pct * 2}%`, background: w.color, borderRadius: 2, opacity: 0.8 }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 6, padding: "6px 8px", background: "#0F172A", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: "#4B5563" }}>Final risk score</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#F8FAFC" }}>{report.riskScore}</span>
        </div>
      </div>

      <div style={{ fontSize: 9, color: "#263241", lineHeight: 1.4 }}>
        <span style={{ color: "#38BDF8" }}>Measured</span> = AirNow official real-time data (EPA-approved methods) ·{" "}
        <span style={{ color: "#A78BFA" }}>Modeled</span> = Gaussian plume estimate from NASA FIRMS + NWS wind
      </div>
    </div>
  );
}
