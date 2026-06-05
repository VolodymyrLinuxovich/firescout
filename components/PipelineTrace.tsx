"use client";
import type { PipelineTrace, PipelineStage } from "@/lib/types";

const STATUS_COLOR: Record<PipelineStage["status"], { dot: string; text: string; bg: string }> = {
  pending: { dot: "#263241", text: "#4B5563", bg: "transparent" },
  running: { dot: "#38BDF8", text: "#38BDF8", bg: "rgba(56,189,248,0.06)" },
  done:    { dot: "#22C55E", text: "#86EFAC", bg: "transparent" },
  error:   { dot: "#EF4444", text: "#FCA5A5", bg: "rgba(239,68,68,0.06)" },
};

const STATUS_ICON: Record<PipelineStage["status"], string> = {
  pending: "○",
  running: "◉",
  done:    "✓",
  error:   "✗",
};

interface Props {
  trace: PipelineTrace | null;
  loading?: boolean;
}

export default function PipelineTrace({ trace, loading }: Props) {
  const stages = trace?.stages ?? getEmptyStages();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          RocketRide Pipeline
        </div>
        {trace && (
          <div style={{ fontSize: 10, color: "#4B5563" }}>
            {trace.totalDurationMs}ms · {trace.runId.slice(0, 12)}
          </div>
        )}
        {loading && (
          <div style={{ fontSize: 10, color: "#38BDF8", animation: "pulse 1s infinite" }}>● RUNNING</div>
        )}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 10, background: "#070A0F", border: "1px solid #1E293B", borderRadius: 6, overflow: "hidden" }}>
        <div style={{ padding: "6px 10px", background: "#0F172A", borderBottom: "1px solid #1E293B", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ color: "#38BDF8", fontWeight: 700 }}>firescout_emergency_analysis</span>
          {trace && <span style={{ color: "#4B5563" }}>·</span>}
          {trace && <span style={{ color: "#22C55E" }}>v1</span>}
        </div>

        {stages.map((stage, i) => {
          const c = STATUS_COLOR[stage.status];
          return (
            <div
              key={stage.id}
              style={{
                padding: "5px 10px",
                borderBottom: i < stages.length - 1 ? "1px solid #0F172A" : "none",
                background: c.bg,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              {/* connector line */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 1, flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: c.dot, border: `1.5px solid ${c.dot}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: stage.status === "pending" ? "#263241" : "#fff", fontWeight: 700, flexShrink: 0 }}>
                  {STATUS_ICON[stage.status]}
                </div>
                {i < stages.length - 1 && (
                  <div style={{ width: 1, height: 14, background: "#1E293B", marginTop: 2 }} />
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: c.text, fontWeight: stage.status === "done" ? 600 : 400 }}>
                    {String(i + 1).padStart(2, "0")}. {stage.label}
                  </span>
                  {stage.durationMs !== undefined && (
                    <span style={{ color: "#4B5563", fontSize: 9 }}>{stage.durationMs}ms</span>
                  )}
                </div>
                {stage.summary && (
                  <div style={{ color: "#4B5563", fontSize: 9, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    → {stage.summary}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {trace && (
        <div style={{ marginTop: 6, fontSize: 9, color: "#4B5563", display: "flex", gap: 12 }}>
          <span>started {new Date(trace.startedAt).toLocaleTimeString()}</span>
          {trace.endedAt && <span>finished {new Date(trace.endedAt).toLocaleTimeString()}</span>}
          <span style={{ color: "#22C55E" }}>● RocketRide executor</span>
        </div>
      )}
    </div>
  );
}

function getEmptyStages(): PipelineStage[] {
  return [
    "normalize_message", "resolve_location", "xtrace_read_memory",
    "airnow_current_aqi", "nasa_firms_active_fires", "nws_wind_field",
    "gaussian_plume_model", "risk_score_fusion", "map_artifact_generation",
    "butterbase_persist", "xtrace_write_memory", "photon_send_response",
  ].map((id, i) => ({
    id, name: id, status: "pending" as const,
    label: [
      "Normalize message", "Resolve location", "XTrace memory read",
      "AirNow AQI fetch", "NASA FIRMS fire detections", "NWS wind fetch",
      "Gaussian plume model", "Risk score fusion", "Map artifact generation",
      "Butterbase persist report", "XTrace write memory + artifact", "Photon response",
    ][i],
  }));
}
