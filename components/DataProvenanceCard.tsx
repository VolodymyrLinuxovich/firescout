"use client";

interface Feed {
  name: string;
  desc: string;
  type: "measured" | "modeled" | "memory" | "pipeline";
  connected: boolean;
}

const FEEDS: Feed[] = [
  { name: "AirNow", desc: "Current AQI by lat/lon (EPA-approved methods)", type: "measured", connected: true },
  { name: "NASA FIRMS VIIRS/MODIS", desc: "Active thermal anomaly detections", type: "measured", connected: true },
  { name: "NWS", desc: "Wind speed + direction from gridpoint forecast", type: "measured", connected: true },
  { name: "NASA GIBS", desc: "MODIS/VIIRS satellite imagery tiles", type: "measured", connected: true },
  { name: "FireScout Gaussian plume", desc: "Wind-based smoke transport estimate", type: "modeled", connected: true },
  { name: "NIFC/IRWIN", desc: "CAL FIRE incident context (optional)", type: "measured", connected: false },
  { name: "Butterbase", desc: "Report persistence, artifact storage, model gateway", type: "pipeline", connected: true },
  { name: "XTrace", desc: "Persistent memory across sessions", type: "memory", connected: false },
  { name: "Photon/Spectrum", desc: "Messaging delivery (Slack / WhatsApp)", type: "pipeline", connected: false },
];

const TYPE_COLOR = {
  measured: "#38BDF8",
  modeled: "#A78BFA",
  memory: "#A78BFA",
  pipeline: "#22C55E",
};

const TYPE_LABEL = {
  measured: "MEASURED",
  modeled: "MODELED",
  memory: "MEMORY",
  pipeline: "PIPELINE",
};

export default function DataProvenanceCard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Data Provenance</div>
      {FEEDS.map(feed => (
        <div key={feed.name} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 8px", background: "#070A0F", border: "1px solid #1E293B", borderRadius: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: feed.connected ? "#22C55E" : "#374151", marginTop: 3, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 1 }}>
              <span style={{ fontSize: 10, color: "#CBD5E1", fontWeight: 600 }}>{feed.name}</span>
              <span style={{ fontSize: 8, color: TYPE_COLOR[feed.type], background: `${TYPE_COLOR[feed.type]}18`, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                {TYPE_LABEL[feed.type]}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "#4B5563" }}>{feed.desc}</div>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 4, padding: "6px 8px", background: "#070A0F", border: "1px solid #263241", borderRadius: 5, fontSize: 9, color: "#374151", lineHeight: 1.5 }}>
        <span style={{ color: "#38BDF8" }}>MEASURED</span> = official real-time data ·{" "}
        <span style={{ color: "#A78BFA" }}>MODELED</span> = FireScout estimate
        <br />AirNow = real-time/preliminary AQI reporting. Not final AQS regulatory-certified data.
      </div>
    </div>
  );
}
