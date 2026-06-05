"use client";
import type { XTraceMemoryFact } from "@/lib/types";

interface Props {
  facts: XTraceMemoryFact[];
  connected?: boolean;
}

export default function XTracePanel({ facts, connected }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? "#A78BFA" : "#374151" }} />
        <span style={{ fontSize: 9, color: connected ? "#A78BFA" : "#374151", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          XTrace Memory State {!connected && "· No API key"}
        </span>
      </div>

      {facts.length === 0 ? (
        <div style={{ background: "#070A0F", border: "1px solid #1E293B", borderRadius: 6, padding: "12px", fontSize: 10, color: "#374151" }}>
          No memory facts yet. Run analysis to populate.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {facts.map((f, i) => (
            <div key={i} style={{ background: "#070A0F", border: "1px solid #1E293B", borderRadius: 5, padding: "6px 10px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#A78BFA", marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: "#CBD5E1", lineHeight: 1.4 }}>{f.fact}</div>
                {f.timestamp && (
                  <div style={{ fontSize: 8, color: "#374151", marginTop: 1 }}>{new Date(f.timestamp).toLocaleTimeString()}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "#0B0F14", border: "1px solid #1E293B", borderRadius: 6, padding: "8px 10px", fontSize: 9, color: "#4B5563", lineHeight: 1.6 }}>
        <div style={{ color: "#A78BFA", fontWeight: 700, marginBottom: 3 }}>XTrace reads before / writes after each analysis</div>
        <div>Remembers: locations, activity preferences, previous risk states, report artifacts, group decisions</div>
      </div>
    </div>
  );
}
