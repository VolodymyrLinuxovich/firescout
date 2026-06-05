"use client";
import { useState } from "react";
import RiskBadge from "@/components/RiskBadge";
import type { RiskLevel } from "@/lib/types";

interface BriefResult {
  reportId: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  text: string;
  mapUrl: string | null;
  imageUrl: string | null;
}

export default function HomePage() {
  const [message, setMessage] = useState("");
  const [userId] = useState(() => `demo_${Math.random().toString(36).slice(2, 8)}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "bot"; text: string; mapUrl?: string }>>([]);

  async function handleSend() {
    if (!message.trim()) return;
    const userText = message.trim();
    setMessage("");
    setLoading(true);
    setChatHistory(h => [...h, { role: "user", text: userText }]);

    try {
      const resp = await fetch("/api/photon/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: "web",
          channelId: userId,
          userId,
          text: userText,
          timestamp: new Date().toISOString(),
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const briefResp = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerType: "user", ownerId: userId, forceRefresh: false }),
      });
      const briefData = briefResp.ok ? (await briefResp.json()) as BriefResult : null;

      if (briefData) {
        setResult(briefData);
        setChatHistory(h => [...h, { role: "bot", text: briefData.text, mapUrl: briefData.mapUrl ?? undefined }]);
      } else {
        setChatHistory(h => [...h, { role: "bot", text: "Message processed. Try asking 'How bad is it right now?' for a full report." }]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setChatHistory(h => [...h, { role: "bot", text: `Error: ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  }

  const demoButtons = [
    "Monitor Berkeley for outdoor running",
    "How bad is it right now?",
    "Show me the smoke risk map",
    "What changed since yesterday?",
    "Why is smoke bad?",
  ];

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "24px 32px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🔥</div>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>FireScout</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
            Wildfire smoke intelligence agent · AirNow + NASA FIRMS + NWS + Gaussian plume model
          </div>
        </div>
        {result && (
          <div style={{ marginLeft: "auto" }}>
            <RiskBadge level={result.riskLevel} score={result.riskScore} large />
          </div>
        )}
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: "calc(100vh - 89px)" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "24px 32px", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>Quick demo:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {demoButtons.map(btn => (
                <button
                  key={btn}
                  onClick={() => setMessage(btn)}
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 20,
                    padding: "6px 14px",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.85)",
                    cursor: "pointer",
                  }}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, minHeight: 300 }}>
            {chatHistory.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", marginTop: 40 }}>
                Ask FireScout about wildfire smoke in your area.
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%",
                  background: msg.role === "user" ? "#1d4ed8" : "rgba(255,255,255,0.1)",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 14px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.text}
                  {msg.mapUrl && (
                    <div style={{ marginTop: 8 }}>
                      <a href={msg.mapUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: 12, textDecoration: "underline" }}>
                        View Interactive Map →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                  FireScout is checking official data…
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && handleSend()}
              placeholder="Ask about air quality, fire risk, or your location…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 14,
                color: "#fff",
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              style={{
                background: loading ? "#374151" : "#1d4ed8",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                padding: "12px 20px",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "…" : "Send"}
            </button>
          </div>
        </div>

        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", padding: "24px 20px", overflowY: "auto", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Status</div>
          {result ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <RiskBadge level={result.riskLevel} score={result.riskScore} large />
              </div>
              {result.mapUrl && (
                <a href={result.mapUrl} style={{ display: "block", background: "#1d4ed8", color: "#fff", textAlign: "center", padding: "12px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", marginBottom: 16 }}>
                  View Interactive Map →
                </a>
              )}
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>Powered by</div>
                {["RocketRide", "Butterbase", "XTrace", "Photon/Spectrum", "AirNow", "NASA FIRMS", "NWS", "NASA GIBS"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.7 }}>
              <p>No active report yet.</p>
              <p>Try: <em>&ldquo;Monitor Berkeley for outdoor running&rdquo;</em></p>
              <div style={{ marginTop: 16, fontSize: 11, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12 }}>
                <div style={{ color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>Integration stack</div>
                {["RocketRide — workflow pipelines", "Butterbase — DB & storage", "XTrace — persistent memory", "Photon — messaging"].map(item => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
