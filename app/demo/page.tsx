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

type RightTab = "chat" | "pipeline" | "memory" | "model" | "sources" | "activity";

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

function ownerIdFor(place: string): string {
  return `agent_${place.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12)}`;
}

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
  const [reportId, setReportId] = useState<string | null>(null);
  const [pipelineTrace, setPipelineTrace] = useState<PipelineTraceType | null>(null);
  const [memoryFacts, setMemoryFacts] = useState<XTraceMemoryFact[]>([]);
  const [deltaReport, setDeltaReport] = useState<DeltaReport | null>(null);
  const [photonMsg, setPhotonMsg] = useState<PhotonMsg | null>(null);
  const [loading, setLoading] = useState(false);
  const [seedStatus, setSeedStatus] = useState<"idle" | "seeded">("idle");
  const [isMock, setIsMock] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("chat");
  const [log, setLog] = useState<{ id: number; text: string; color?: string }[]>([]);
  const logIdRef = useRef(0);

  const ownerId = ownerIdFor(location);

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

  const handleAnalyze = useCallback(async (target?: string) => {
    const place = (target ?? location).trim();
    if (!place) return;
    const ownerId = ownerIdFor(place);
    setLocation(place);
    setLoading(true);
    setPipelineTrace(null);
    setPhotonMsg(null);
    addLog(`▶ RocketRide: firescout_emergency_analysis`, "#22C55E");
    addLog(`  Location: ${place} · Owner: ${ownerId}`, "#38BDF8");
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerType: "user",
          ownerId,
          locationName: place,
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
      setReportId(data.reportId ?? data.report?.id ?? null);
      if (data.pipelineTrace) {
        setPipelineTrace(data.pipelineTrace);
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
  }, [location, addLog]);

  const riskLevel = report?.riskLevel ?? "WATCH";
  const mapLayers = report ? buildMapLayers(report) : null;

  const tabs: { id: RightTab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "pipeline", label: "Pipeline" },
    { id: "memory", label: "Memory" },
    { id: "model", label: "Model" },
    { id: "sources", label: "Sources" },
    { id: "activity", label: "Activity" },
  ];

  const openDrawer = (tab: RightTab) => {
    setRightTab(tab);
    setDrawerOpen(true);
  };

  return (
    <div className="fs-root">
      <style>{`
        @keyframes riskPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes running { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .fs-root {
          height: 100dvh; display: flex; flex-direction: column; overflow: hidden;
          background: #070A0F; color: #F8FAFC;
          font-family: var(--font-geist-sans), system-ui, sans-serif;
        }
        .fs-header {
          display: flex; align-items: center; gap: 16px; padding: 10px 20px;
          background: #050709; border-bottom: 1px solid #1E293B; flex-shrink: 0;
        }
        .fs-search { display: flex; gap: 8px; flex: 1; max-width: 560px; min-width: 0; }
        .fs-search input {
          flex: 1; min-width: 0; background: #0F172A; border: 1px solid #263241; border-radius: 8px;
          color: #F8FAFC; font-size: 14px; padding: 10px 14px; outline: none; font-family: inherit;
        }
        .fs-search input:focus { border-color: #38BDF8; }
        .fs-btn {
          border: none; border-radius: 8px; padding: 10px 18px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: inherit; white-space: nowrap;
        }
        .fs-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .fs-primary { background: #22C55E; color: #052E16; }
        .fs-ghost { background: #0F172A; color: #CBD5E1; border: 1px solid #263241; }
        .fs-ghost:hover { border-color: #475569; }
        .fs-main { flex: 1; position: relative; display: flex; overflow: hidden; }
        .fs-map { flex: 1; position: relative; min-width: 0; }
        .fs-card {
          position: absolute; top: 16px; left: 16px; z-index: 1100; width: 340px;
          max-height: calc(100% - 96px); overflow-y: auto; padding: 12px;
          background: rgba(10,13,18,0.94); border: 1px solid #1E293B; border-radius: 12px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.45);
        }
        .fs-card-actions { display: flex; gap: 8px; margin: 4px 0 10px; }
        .fs-card-actions .fs-btn { flex: 1; padding: 8px 10px; font-size: 13px; }
        .fs-delta {
          font-size: 13px; line-height: 1.5; color: #FDE68A; background: #42200655;
          border: 1px solid #FACC1544; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;
        }
        .fs-empty {
          height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 14px; padding: 24px; text-align: center;
        }
        .fs-empty h1 { font-size: 26px; font-weight: 700; margin: 0; }
        .fs-empty p { font-size: 15px; color: #94A3B8; margin: 0; max-width: 440px; line-height: 1.5; }
        .fs-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 520px; }
        .fs-chip {
          background: #0F172A; border: 1px solid #263241; color: #CBD5E1; border-radius: 999px;
          padding: 7px 14px; font-size: 13px; cursor: pointer; font-family: inherit;
        }
        .fs-chip:hover { border-color: #38BDF8; color: #38BDF8; }
        .fs-loading {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 1150;
          background: #0F172A; border: 1px solid #22C55E66; color: #86EFAC; border-radius: 999px;
          padding: 6px 14px; font-size: 13px; animation: running 1.2s infinite;
        }
        .fs-drawer {
          width: 380px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden;
          background: #0A0D12; border-left: 1px solid #1E293B;
        }
        .fs-drawer-head { display: flex; align-items: center; padding: 8px 8px 0; gap: 0; overflow-x: auto; border-bottom: 1px solid #1E293B; flex-shrink: 0; }
        .fs-tab {
          background: none; border: none; border-bottom: 2px solid transparent; color: #64748B;
          padding: 8px 9px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap;
        }
        .fs-tab[aria-selected="true"] { color: #F8FAFC; border-bottom-color: #38BDF8; }
        .fs-drawer-body { flex: 1; overflow-y: auto; padding: 14px; }
        .fs-log { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: 12px; line-height: 1.6; }
        @media (max-width: 820px) {
          .fs-header { flex-wrap: wrap; padding: 10px 16px; gap: 10px; }
          .fs-search { order: 3; flex-basis: 100%; max-width: none; }
          .fs-card { left: 12px; right: 12px; top: auto; bottom: 12px; width: auto; max-height: 42%; }
          .fs-drawer { position: absolute; inset: 0; width: auto; z-index: 1200; border-left: none; }
          .fs-empty h1 { font-size: 22px; }
        }
      `}</style>

      {/* Header: brand, one search box, details toggle */}
      <header className="fs-header">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <Image src="/firescout-logo.svg" alt="" width={26} height={26} style={{ borderRadius: 6 }} />
          <span style={{ fontWeight: 700, fontSize: 16, color: "#F8FAFC" }}>FireScout</span>
        </Link>

        <form
          className="fs-search"
          onSubmit={e => { e.preventDefault(); handleAnalyze(); }}
        >
          <input
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Search any city or region"
            aria-label="Location"
          />
          <button type="submit" className="fs-btn fs-primary" disabled={loading}>
            {loading ? "Checking…" : "Check risk"}
          </button>
        </form>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {isMock && (
            <span style={{ fontSize: 12, color: "#FACC15", border: "1px solid #FACC1544", borderRadius: 6, padding: "4px 8px" }}>
              Sample data
            </span>
          )}
          <button
            className="fs-btn fs-ghost"
            onClick={() => setDrawerOpen(o => !o)}
            aria-expanded={drawerOpen}
          >
            {drawerOpen ? "Hide details" : "Details"}
          </button>
        </div>
      </header>

      <div className="fs-main">
        <div className="fs-map">
          {loading && <div className="fs-loading">Analyzing {location}…</div>}

          {mapLayers ? (
            <>
              <FireScoutMap
                key={reportId ?? `${mapLayers.userLocation.lat},${mapLayers.userLocation.lon}`}
                fill
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

              {/* Floating risk summary */}
              <aside className="fs-card" aria-label="Risk summary">
                <div className="fs-card-actions">
                  <button className="fs-btn fs-ghost" onClick={() => openDrawer("chat")}>Ask FireScout</button>
                  {reportId && (
                    <a className="fs-btn fs-ghost" href={`/map/${reportId}`} target="_blank" rel="noreferrer"
                      style={{ textAlign: "center", textDecoration: "none" }}>
                      Full map ↗
                    </a>
                  )}
                </div>
                {deltaReport?.summary && (
                  <div className="fs-delta">
                    <strong>Since last check:</strong> {deltaReport.summary}
                  </div>
                )}
                <RiskPanel
                  report={report}
                  locationName={report?.location.name ?? location}
                  loading={loading}
                  isMock={isMock}
                />
              </aside>
            </>
          ) : (
            <div className="fs-empty">
              <div style={{ fontSize: 40 }}>🔥</div>
              <h1>Check wildfire smoke risk anywhere</h1>
              <p>
                Search a place above or pick one below. FireScout pulls live fire, air quality and wind data,
                estimates where the smoke is heading, and explains the risk in plain English.
              </p>
              <div className="fs-chips">
                {SUGGESTED_LOCATIONS.map(loc => (
                  <button key={loc} className="fs-chip" disabled={loading} onClick={() => handleAnalyze(loc)}>
                    {loc}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Details drawer: chat, pipeline, memory, model, sources, activity */}
        {drawerOpen && (
          <section className="fs-drawer" aria-label="Details">
            <div className="fs-drawer-head" role="tablist">
              {tabs.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  className="fs-tab"
                  aria-selected={rightTab === t.id}
                  onClick={() => setRightTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {rightTab === "chat" ? (
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <PhotonChat sessionId={ownerId} />
              </div>
            ) : (
              <div className="fs-drawer-body">
                {rightTab === "pipeline" && <PipelineTrace trace={pipelineTrace} loading={loading} />}
                {rightTab === "memory" && <XTracePanel facts={memoryFacts} connected={memoryFacts.length > 0} />}
                {rightTab === "model" && <ModelParamsCard report={report} />}
                {rightTab === "sources" && <DataProvenanceCard />}
                {rightTab === "activity" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button className="fs-btn fs-ghost" onClick={handleSeed} disabled={loading} style={{ fontSize: 13, padding: "8px 12px" }}>
                        Reset demo memory
                      </button>
                      {seedStatus === "seeded" && <span style={{ fontSize: 12, color: "#22C55E" }}>Demo reset</span>}
                    </div>
                    <div className="fs-log">
                      {log.length === 0 ? (
                        <div style={{ color: "#64748B" }}>Nothing yet. Run a check to see each step here.</div>
                      ) : log.map(e => (
                        <div key={e.id} style={{ color: e.color ?? "#94A3B8" }}>{e.text}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
