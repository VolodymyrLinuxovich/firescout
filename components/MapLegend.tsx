"use client";

export default function MapLegend() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.95)",
      border: "1px solid #d1d5db",
      borderRadius: 10,
      padding: "12px 16px",
      fontSize: 12,
      minWidth: 200,
      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>FireScout Legend</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>Risk Levels</div>
        {[
          { label: "CLEAR", color: "#16a34a" },
          { label: "WATCH", color: "#ca8a04" },
          { label: "ACT", color: "#ea580c" },
          { label: "CRITICAL", color: "#dc2626" },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: "#374151" }}>Layers</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 16 }}>⭐</span><span>Your location</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ef4444", border: "2px solid #7f1d1d" }} />
          <span>NASA FIRMS fire detection</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 14, color: "#7c3aed" }}>→</span><span>Smoke transport direction</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "rgba(251,146,60,0.5)", border: "1px solid #ea580c" }} />
          <span>Plume transport estimate</span>
        </div>
      </div>

      <div style={{
        borderTop: "1px solid #e5e7eb",
        paddingTop: 8,
        fontSize: 10,
        color: "#6b7280",
        lineHeight: 1.4,
      }}>
        <div>Plume layer is a <strong>modeled estimate</strong></div>
        <div>AQI badge = official AirNow measurements</div>
        <div>Not an emergency authority</div>
      </div>
    </div>
  );
}
