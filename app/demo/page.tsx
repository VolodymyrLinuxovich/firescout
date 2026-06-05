"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import RiskPanel from "@/components/RiskPanel";
import PipelineTrace from "@/components/PipelineTrace";
import ModelParamsCard from "@/components/ModelParamsCard";
import XTracePanel from "@/components/XTracePanel";
import DataProvenanceCard from "@/components/DataProvenanceCard";
import PhotonChat from "@/components/PhotonChat";
import type {
  RiskReport, PipelineTrace as PipelineTraceType,
  XTraceMemoryFact, DeltaReport, MapLayers
} from "@/lib/types";

const FireScoutMap = dynamic(() => import("@/components/FireScoutMap"), { ssr: false });

type RightTab = "pipeline" | "photon" | "xtrace" | "model" | "provenance";

interface PhotonMsg { platform: string; channelId: string; text: string; mapUrl?: string }

interface BriefResponse {
  reportId: string;
  riskLevel: string;
  riskScore: number;
  text: string;
  mapUrl?: string;
  pipelineTrace?: PipelineTraceType;
  memoryFacts?: XTraceMemoryFact[];
  report?: RiskReport;
  deltaReport?: DeltaReport;
  photonMessage?: PhotonMsg;
  isMock?: boolean;
  error?: string;
}

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CLEAR:    { bg: "#052E16", border: "#22C55E", text: "#22C55E" },
  WATCH:    { bg: "#422006", border: "#FACC15", text: "#FACC15" },
  ACT:      { bg: "#431407", border: "#F97316", text: "#F97316" },
  CRITICAL: { bg: "#450A0A", border: "#EF4444", text: "#EF4444" },
};

const SUGGESTED_LOCATIONS = [
  "Berkeley, CA", "Los Angeles", "San Francisco",
  "Athens, Greece", "Sydney, Australia", "Delhi, India",
  "Kyiv, Ukraine", "Amazon rainforest", "Cape Town",
];

const AGENT_COMMANDS = [
  { id: "seed",    label: "Seed Demo State",              color: "#F97316", desc: "Reset with prior CLEAR state + XTrace memory" },
  { id: "analyze", label: "▶ Run RocketRide Analysis",    color: "#22C55E", desc: "12-stage pipeline → risk report" },
  { id: "delta",   label: "What Changed?",                color: "#FACC15", desc: "Compare with previous XTrace memory" },
  { id: "photon",  label: "💬 Photon Preview",            color: "#FACC15", desc: "Show prepared message delivery" },
  { id: "xtrace",  label: "🧠 XTrace Memory",             color: "#A78BFA", desc: "Read persisted memory facts" },
  { id: "map",     label: "Open Tactical Map",            color: "#94A3B8", desc: "Full-screen map in new tab" },
];

function buildMapLayers(report: RiskReport): MapLayers {
  return {
    userLocation: { lat: report.location.lat, lon: report.location.lon, name: report.location.name },
    aqi: report.airQuality ?? null,
    fires: report.fires ?? [],
    wind: report.wind ?? null,
    plumeGeoJson: report.plume?.plumeGeoJson ?? null,
    satelliteLayer: null,
  };
}

export default function DemoPage() {
  const [location, setLocation] = useState("Berkeley, CA");
  const [report, setReport] = useState<RiskReport | null>(null);
  const [pipelineTrace, setPipelineTrace] = useState<PipelineTraceType | null>(null);
  const [memoryFacts, setMemoryFacts] = useState<XTraceMemoryFact[]>([]);
  const [deltaReport, setDeltaReport] = useState<DeltaReport | null>(null);
  const [photonMsg, setPhotonMsg] = useState<PhotonMsg | null>(null);
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<"idle" | "seeded">("idle");
  const [isMock, setIsMock] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("pipeline");
  const [log, setLog] = useState<{ id: number; text: string; color?: string }[]>([]);
  const logIdRef = useRef(0);

  const ownerId = `agent_${location.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}`;

  const addLog = useCallback((text: string, color?: string) => {
    const id = ++logIdRef.current;
    setLog(prev => [...prev.slice(-30), { id, text, color }]);
  }, []);

  const handleSeed = useCallback(async () => {
    setLoading(true);
    addLog(`▶ Seeding demo state for ${location}…`, "#F97316");
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const data = await res.json();
      if (data.ok || data.success) {
        setSeedStatus("seeded");
        addLog(`✓ Demo seeded · Prior CLEAR state loaded · XTrace memory initialized`, "#22C55E");
      } else {
        addLog("⚠ Seed partial — in-memory state initialized", "#FACC15");
        setSeedStatus("seeded");
      }
    } catch (e) {
      addLog("✗ Seed error: " + String(e), "#EF4444");
    } finally {
      setLoading(false);
    }
  }, [location, addLog]);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setPipelineTrace(null);
    setPhotonMsg(null);
    addLog(`▶ RocketRide: firescout_emergency_analysis`, "#22C55E");
    addLog(`  Location: ${location} · Owner: ${ownerId}`, "#38BDF8");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType: "user",
          ownerId,
          locationName: location,
          activity: "outdoor",
          forceRefresh: true,
        }),
      });
      const data: BriefResponse = await res.json();

      if (data.error) {
        addLog(`✗ ${data.error}`, "#EF4444");
        return;
      }

      if (data.report) setReport(data.report);
      if (data.pipelineTrace) {
        setPipelineTrace(data.pipelineTrace);
        setRightTab("pipeline");
        const dur = data.pipelineTrace.totalDurationMs;
        addLog(`✓ Pipeline complete · ${data.pipelineTrace.stages.length} stages · ${dur}ms`, "#22C55E");
      }
      if (data.memoryFacts?.length) {
        setMemoryFacts(data.memoryFacts);
        addLog(`✓ XTrace: ${data.memoryFacts.length} memory facts read + written`, "#A78BFA");
      }
      if (data.deltaReport) {
        setDeltaReport(data.deltaReport);
        if (data.deltaReport.summary) addLog(`  Δ ${data.deltaReport.summary}`, "#FACC15");
      }
      if (data.photonMessage) {
        setPhotonMsg(data.photonMessage);
        addLog(`✓ Photon: alert prepared → ${data.photonMessage.platform}/#${data.photonMessage.channelId}`, "#FACC15");
        setRightTab("photon");
      }
      if (data.isMock) setIsMock(true);

      const level = data.riskLevel ?? data.report?.riskLevel ?? "—";
      const score = data.riskScore ?? data.report?.riskScore ?? "—";
      const aqi = data.report?.airQuality?.aqi ?? "—";
      const fires = data.report?.fires?.length ?? "—";
      addLog(`  Risk: ${level} (${score}) · AQI: ${aqi} · Fires: ${fires}`,
        RISK_COLORS[level]?.text ?? "#F8FAFC");
    } catch (e) {
      addLog("✗ Analysis error: " + String(e), "#EF4444");
    } finally {
      setLoading(false);
    }
  }, [location, ownerId, addLog]);

  const handleCommand = useCallback(async (id: string) => {
    switch (id) {
      case "seed": return handleSeed();
      case "analyze": return handleAnalyze();
      case "delta":
        if (deltaReport?.summary) {
          addLog(`Δ Delta: ${deltaReport.summary}`, "#FACC15");
        } else {
          addLog("Run analysis first — XTrace needs a prior report to compare.", "#94A3B8");
        }
        break;
      case "photon":
        setRightTab("photon");
        addLog("◉ Photon message panel", "#FACC15");
        break;
      case "xtrace":
        setRightTab("xtrace");
        addLog("◉ XTrace memory panel", "#A78BFA");
        break;
      case "map":
        if (report?.id) window.open(`/map/${report.id}`, "_blank");
        else addLog("Run analysis first to generate a map.", "#94A3B8");
        break;
    }
  }, [deltaReport, report, handleSeed, handleAnalyze, addLog]);

  const riskLevel = report?.riskLevel ?? "WATCH";
  const rc = RISK_COLORS[riskLevel] ?? RISK_COLORS.WATCH;
  const mapLayers = report ? buildMapLayers(report) : null;

  return (
    <div style={{
      height: "100vh",
      background: "#070A0F",
      color: "#F8FAFC",
      fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes riskPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes running { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* ═══ TOP STATUS BAR ═══ */}
      <div style={{
        height: 46, minHeight: 46,
        background: "#050709",
        borderBottom: "1px solid #1E293B",
        display: "flex", alignItems: "center", gap: 10, padding: "0 14px",
        flexShrink: 0,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none", flexShrink: 0 }}>
          <Image src="/firescout-logo.svg" alt="" width={22} height={22} style={{ borderRadius: 5 }} />
          <span style={{ fontWeight: 800, fontSize: 12, color: "#F8FAFC" }}>FireScout</span>
        </Link>

        <div style={{ width: 1, height: 18, background: "#1E293B", flexShrink: 0 }} />

        {/* Global location input */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, maxWidth: 340, minWidth: 0 }}>
          <span style={{ fontSize: 9, color: "#374151", flexShrink: 0 }}>LOCATION</span>
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Any city, region, or lat/lon…"
            style={{
              background: "#0F172A",
              border: "1px solid #263241",
              borderRadius: 5,
              color: "#F8FAFC",
              fontSize: 11,
              padding: "4px 10px",
              outline: "none",
              flex: 1,
              fontFamily: "inherit",
              minWidth: 0,
            }}
          />
        </div>

        {/* Suggested locations */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flexShrink: 0 }}>
          {SUGGESTED_LOCATIONS.slice(0, 4).map(loc => (
            <button
              key={loc}
              onClick={() => setLocation(loc)}
              style={{
                background: location === loc ? "#1E293B" : "transparent",
                border: "1px solid " + (location === loc ? "#38BDF8" : "#1E293B"),
                color: location === loc ? "#38BDF8" : "#374151",
                borderRadius: 4, padding: "2px 8px", fontSize: 9, cursor: "pointer",
                fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
              }}
            >
              {loc}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: "#1E293B", flexShrink: 0 }} />

        {/* Risk badge */}
        <div style={{
          background: rc.bg, border: `1px solid ${rc.border}`,
          borderRadius: 4, padding: "2px 8px",
          fontSize: 10, fontWeight: 800, color: rc.text, flexShrink: 0,
        }}>
          {riskLevel}{report ? ` · ${report.riskScore}` : ""}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {isMock && <div style={{ fontSize: 8, color: "#FACC15", background: "#42200644", border: "1px solid #FACC1544", borderRadius: 3, padding: "2px 6px" }}>MOCK</div>}
          {seedStatus === "seeded" && <div style={{ fontSize: 8, color: "#22C55E", background: "#05301644", border: "1px solid #22C55E44", borderRadius: 3, padding: "2px 6px" }}>SEEDED</div>}
          {["AirNow", "NASA", "NWS"].map(src => (
            <div key={src} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 8, color: "#374151" }}>{src}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#A78BFA" }} />
            <span style={{ fontSize: 8, color: "#374151" }}>XTrace</span>
          </div>
        </div>
      </div>

      {/* ═══ MAIN 3-COLUMN LAYOUT ═══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ─── LEFT: Risk Panel ─── */}
        <div style={{
          width: 255, minWidth: 255,
          background: "#0A0D12",
          borderRight: "1px solid #1E293B",
          overflowY: "auto", padding: "10px", flexShrink: 0,
        }}>
          <RiskPanel
            report={report}
            locationName={report?.location.name ?? location}
            loading={loading}
            isMock={isMock}
          />
        </div>

        {/* ─── CENTER: Tactical Map ─── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden", minWidth: 0 }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
            background: "linear-gradient(to bottom, rgba(5,7,9,0.95) 0%, transparent 100%)",
            padding: "8px 12px 20px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 9, color: "#4B5563", fontWeight: 700, letterSpacing: "0.08em" }}>
              TACTICAL MAP · CartoDB Dark + AirNow + NASA FIRMS + NWS + Gaussian Plume
            </span>
            {loading && (
              <span style={{ marginLeft: "auto", fontSize: 9, color: "#22C55E", fontWeight: 700, animation: "running 1s infinite" }}>
                ◉ ANALYZING
              </span>
            )}
          </div>

          {mapLayers ? (
            <FireScoutMap
              userLat={mapLayers.userLocation.lat}
              userLon={mapLayers.userLocation.lon}
              locationName={mapLayers.userLocation.name}
              fires={mapLayers.fires}
              wind={mapLayers.wind}
              plumeGeoJson={mapLayers.plumeGeoJson}
              airQuality={mapLayers.aqi}
              satelliteLayer={mapLayers.satelliteLayer}
              riskLevel={riskLevel}
            />
          ) : (
            <div style={{
              height: "100%", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12, color: "#374151",
            }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>🌍</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {loading ? "Running analysis…" : "Run analysis to load global smoke map"}
              </div>
              <div style={{ fontSize: 10, color: "#263241" }}>{location}</div>
              <button onClick={handleAnalyze} disabled={loading} style={{
                background: "#22C55E", color: "#fff", border: "none",
                borderRadius: 6, padding: "8px 20px", fontWeight: 700, fontSize: 11,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
                fontFamily: "inherit",
              }}>
                {loading ? "Running pipeline…" : "▶ Run RocketRide Analysis"}
              </button>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Intelligence Panel ─── */}
        <div style={{
          width: 300, minWidth: 300,
          background: "#0A0D12",
          borderLeft: "1px solid #1E293B",
          display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
        }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #1E293B", flexShrink: 0 }}>
            {([
              { id: "pipeline",   label: "PIPELINE",   color: "#22C55E" },
              { id: "photon",     label: "PHOTON",     color: "#FACC15" },
              { id: "xtrace",     label: "XTRACE",     color: "#A78BFA" },
              { id: "model",      label: "MODEL",      color: "#A78BFA" },
              { id: "provenance", label: "DATA",       color: "#38BDF8" },
            ] as { id: RightTab; label: string; color: string }[]).map(t => (
              <button key={t.id} onClick={() => setRightTab(t.id)} style={{
                flex: 1, padding: "6px 2px",
                background: rightTab === t.id ? "#111827" : "transparent",
                border: "none",
                borderBottom: rightTab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
                color: rightTab === t.id ? t.color : "#374151",
                fontSize: 8, fontWeight: 700, letterSpacing: "0.06em",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {rightTab === "photon" ? (
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <PhotonChat sessionId={ownerId} />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
              {rightTab === "pipeline" && <PipelineTrace trace={pipelineTrace} />}
              {rightTab === "xtrace" && <XTracePanel facts={memoryFacts} connected={memoryFacts.length > 0} />}
              {rightTab === "model" && <ModelParamsCard report={report} />}
              {rightTab === "provenance" && <DataProvenanceCard />}
            </div>
          )}
        </div>
      </div>

      {/* ═══ COMMAND BAR ═══ */}
      <div style={{ background: "#050709", borderTop: "1px solid #1E293B", flexShrink: 0 }}>
        {/* Command buttons */}
        <div style={{
          display: "flex", gap: 6, padding: "7px 12px", overflowX: "auto",
          borderBottom: "1px solid #0F1724",
        }}>
          {AGENT_COMMANDS.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => handleCommand(cmd.id)}
              disabled={loading && cmd.id !== "photon" && cmd.id !== "xtrace"}
              title={cmd.desc}
              style={{
                background: "#0F172A", border: `1px solid ${cmd.color}44`,
                color: cmd.color, borderRadius: 5, padding: "5px 12px",
                fontSize: 10, fontWeight: 700, cursor: "pointer",
                opacity: (loading && cmd.id !== "photon" && cmd.id !== "xtrace") ? 0.4 : 1,
                whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0,
              }}
            >
              {cmd.id === "analyze" && loading ? "◉ RUNNING PIPELINE…" : cmd.label}
            </button>
          ))}
        </div>

        {/* Ops log */}
        <div style={{
          height: 60, overflowY: "auto",
          padding: "4px 12px", display: "flex", flexDirection: "column", gap: 1,
        }}>
          {log.length === 0 ? (
            <div style={{ fontSize: 9, color: "#374151", paddingTop: 2 }}>
              FireScout Global Agent Console · Enter a location above, then click{" "}
              <span style={{ color: "#F97316" }}>Seed Demo State</span> →{" "}
              <span style={{ color: "#22C55E" }}>Run RocketRide Analysis</span>
            </div>
          ) : log.map(e => (
            <div key={e.id} style={{ fontSize: 9, color: e.color ?? "#64748B", lineHeight: 1.4, whiteSpace: "nowrap" }}>
              {e.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
