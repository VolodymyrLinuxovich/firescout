"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Particle { id: number; x: number; y: number; size: number; dur: number; delay: number; opacity: number }

// ─── Constants ───────────────────────────────────────────────────────────────
const ARCH = [
  {
    icon: "⚡",
    name: "RocketRide",
    role: "Pipeline Orchestration",
    color: "#22C55E",
    desc: "Every analysis runs as a named RocketRide pipeline. 12 stages — geocode, fetch AQI, pull FIRMS satellite fire data, run Gaussian plume, fuse risk score, persist, write memory, deliver alert. Each stage is traced, timed, and shown live.",
    badge: "ORCHESTRATION",
  },
  {
    icon: "🗄",
    name: "Butterbase",
    role: "Backend · Database · Model Gateway",
    color: "#38BDF8",
    desc: "All users, monitored locations, risk reports, air quality readings, fire detections, wind snapshots, plume runs, pipeline traces, and map artifacts persist through Butterbase. Also used as the AI model gateway for report generation.",
    badge: "BACKEND",
  },
  {
    icon: "🧠",
    name: "XTrace",
    role: "Persistent Self-Revising Memory",
    color: "#A78BFA",
    desc: "The agent reads XTrace memory before every analysis and writes new facts after. It remembers your monitored locations, past risk states, activity preferences, and prior reports. Ask 'what changed since last time?' — XTrace powers the answer.",
    badge: "MEMORY",
  },
  {
    icon: "💬",
    name: "Photon / Spectrum",
    role: "Messaging Delivery",
    color: "#FACC15",
    desc: "Smoke risk alerts are delivered as formatted messages through Photon. Supports Slack, WhatsApp, and Telegram. Every pipeline run ends with a Photon message containing the risk level, AQI, fire count, map link, and quick-action buttons.",
    badge: "MESSAGING",
  },
];

const PIPELINE_STEPS = [
  { stage: "01", label: "Parse message + location", color: "#38BDF8" },
  { stage: "02", label: "Geocode any city or coordinates", color: "#38BDF8" },
  { stage: "03", label: "XTrace read memory", color: "#A78BFA" },
  { stage: "04", label: "AirNow AQI fetch", color: "#22C55E" },
  { stage: "05", label: "NASA FIRMS fire detections", color: "#F97316" },
  { stage: "06", label: "NWS wind field", color: "#38BDF8" },
  { stage: "07", label: "Gaussian plume model", color: "#A78BFA" },
  { stage: "08", label: "Risk score fusion", color: "#FACC15" },
  { stage: "09", label: "Butterbase persist report", color: "#38BDF8" },
  { stage: "10", label: "XTrace write memory + artifact", color: "#A78BFA" },
  { stage: "11", label: "Map artifact generation", color: "#94A3B8" },
  { stage: "12", label: "Photon alert delivery", color: "#FACC15" },
];

const AGENT_CAPABILITIES = [
  "Monitor any location — city, region, or GPS coordinates",
  "Remember your locations, preferences, and past reports",
  "Compare today's conditions with any previous report",
  "Answer 'what changed since last time?' from memory",
  "Run multi-step analysis pipeline for every request",
  "Deliver actionable smoke risk alerts via messaging",
  "Explain Gaussian plume model output in plain English",
  "Track 18+ satellite fire detections in real time",
];

const DEMO_LOCATIONS = ["Berkeley, CA", "Los Angeles", "Athens, Greece", "Delhi, India", "Sydney, Australia", "Amazon rainforest", "Kyiv, Ukraine"];

export default function LandingPage() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [demoLoc, setDemoLoc] = useState(0);

  useEffect(() => {
    setParticles(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        dur: 12 + Math.random() * 18,
        delay: Math.random() * 10,
        opacity: 0.04 + Math.random() * 0.1,
      }))
    );
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setActiveStep(s => (s + 1) % PIPELINE_STEPS.length);
    }, 700);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setDemoLoc(s => (s + 1) % DEMO_LOCATIONS.length);
    }, 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#070A0F",
      color: "#F8FAFC",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      overflowX: "hidden",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatSmoke {
          0%   { transform: translateY(0) translateX(0) scale(1); opacity: var(--op); }
          33%  { transform: translateY(-40px) translateX(12px) scale(1.3); opacity: calc(var(--op) * 0.6); }
          66%  { transform: translateY(-80px) translateX(-8px) scale(1.6); opacity: calc(var(--op) * 0.3); }
          100% { transform: translateY(-130px) translateX(5px) scale(2); opacity: 0; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(249,115,22,0.3), 0 0 40px rgba(249,115,22,0.1); }
          50%       { box-shadow: 0 0 30px rgba(249,115,22,0.5), 0 0 60px rgba(249,115,22,0.2); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(249,115,22,0.4); }
          50%       { border-color: rgba(249,115,22,0.9); }
        }
        @keyframes stepPing {
          0%   { transform: scale(1); opacity: 1; }
          50%  { transform: scale(1.15); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .arch-card:hover { transform: translateY(-3px); transition: transform 0.2s ease; }
        .cta-primary:hover { animation: glowPulse 1.5s ease-in-out infinite; }
        .cta-secondary:hover { border-color: rgba(148,163,184,0.5) !important; }
      `}</style>

      {/* ── Smoke particles ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        {particles.map(p => (
          <div key={p.id} style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: `rgba(249,115,22,${p.opacity})`,
            ["--op" as string]: p.opacity,
            animation: `floatSmoke ${p.dur}s ${p.delay}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: "1px solid #1E293B",
        background: "rgba(7,10,15,0.92)",
        backdropFilter: "blur(12px)",
        padding: "12px 40px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <Image src="/firescout-logo.svg" alt="FireScout" width={28} height={28} style={{ borderRadius: 7 }} />
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>FireScout</span>
        <span style={{ color: "#374151", fontSize: 11, fontWeight: 500 }}>Global Wildfire Smoke Intelligence Agent</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/demo" className="cta-primary" style={{
            background: "#F97316", color: "#fff",
            padding: "7px 18px", borderRadius: 6, fontWeight: 700, fontSize: 12,
            textDecoration: "none", display: "block",
            animation: "glowPulse 3s ease-in-out infinite",
          }}>
            Launch Agent
          </Link>
          <Link href="/api/health" style={{
            background: "#0F172A", color: "#4B5563", border: "1px solid #1E293B",
            padding: "7px 12px", borderRadius: 6, fontSize: 11, textDecoration: "none",
          }}>
            Status
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "100px 40px 80px",
        maxWidth: 900, margin: "0 auto", textAlign: "center",
        animation: "fadeUp 0.8s ease both",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#0F172A", border: "1px solid #F9731633",
          borderRadius: 20, padding: "4px 14px",
          fontSize: 10, color: "#F97316", fontWeight: 700, letterSpacing: "0.08em",
          marginBottom: 28,
        }}>
          AGENTIC AI SF HACKATHON · FIRESCOUT
        </div>

        <h1 style={{
          fontSize: "clamp(42px, 7vw, 72px)",
          fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.02,
          margin: "0 0 6px",
        }}>
          <span style={{ color: "#F97316" }}>Fire</span>Scout
        </h1>

        <div style={{
          fontSize: "clamp(18px, 3vw, 26px)",
          color: "#64748B", fontWeight: 600, marginBottom: 20, letterSpacing: "-0.01em",
        }}>
          Global Wildfire Smoke Intelligence Agent
        </div>

        <p style={{
          fontSize: 16, color: "#475569", maxWidth: 640, margin: "0 auto 16px", lineHeight: 1.7,
          animation: "fadeUp 0.8s 0.15s ease both",
        }}>
          An agentic AI system that monitors wildfire smoke risk worldwide,
          remembers what changed, runs multi-step analysis pipelines, and delivers
          actionable updates through messaging platforms.
        </p>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#0F172A", border: "1px solid #22C55E44",
          borderRadius: 8, padding: "6px 14px", marginBottom: 36,
          fontSize: 11, color: "#4B5563",
          animation: "fadeUp 0.8s 0.25s ease both",
        }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E" }} />
          <span>Monitoring: </span>
          <span style={{ color: "#F8FAFC", fontWeight: 600, transition: "opacity 0.3s" }}>
            {DEMO_LOCATIONS[demoLoc]}
          </span>
        </div>

        <div style={{
          display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap",
          animation: "fadeUp 0.8s 0.35s ease both",
        }}>
          <Link href="/demo" className="cta-primary" style={{
            background: "#F97316", color: "#fff",
            padding: "13px 28px", borderRadius: 8,
            fontWeight: 800, fontSize: 14, textDecoration: "none",
            letterSpacing: "-0.01em",
            animation: "glowPulse 3s ease-in-out infinite",
          }}>
            Run Global Demo →
          </Link>
          <Link href="/demo" className="cta-secondary" style={{
            background: "#0F172A", color: "#94A3B8",
            border: "1px solid #1E293B",
            padding: "13px 20px", borderRadius: 8,
            fontWeight: 600, fontSize: 13, textDecoration: "none",
          }}>
            Launch Agent Console
          </Link>
          <Link href="/demo#pipeline" className="cta-secondary" style={{
            background: "#0F172A", color: "#22C55E",
            border: "1px solid #22C55E33",
            padding: "13px 20px", borderRadius: 8,
            fontWeight: 600, fontSize: 13, textDecoration: "none",
          }}>
            ⚡ View RocketRide Pipeline
          </Link>
        </div>
      </section>

      {/* ── Quote ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "0 40px 60px", maxWidth: 700, margin: "0 auto", textAlign: "center",
        animation: "fadeUp 0.8s 0.4s ease both",
      }}>
        <div style={{
          background: "#0F172A",
          border: "1px solid #F9731633",
          borderRadius: 10, padding: "16px 24px",
          fontSize: 14, color: "#94A3B8", fontStyle: "italic", lineHeight: 1.6,
        }}>
          "FireScout is not a dashboard. It is a{" "}
          <span style={{ color: "#F97316", fontStyle: "normal", fontWeight: 700 }}>messaging-native</span>{" "}
          wildfire smoke intelligence agent."
        </div>
      </section>

      {/* ── Problem ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "40px 40px 60px", maxWidth: 900, margin: "0 auto",
        animation: "fadeUp 0.8s 0.5s ease both",
      }}>
        <div style={{
          background: "#0A0D12", border: "1px solid #1E293B",
          borderRadius: 12, padding: "36px 40px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32,
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#F97316", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>THE PROBLEM</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 14, letterSpacing: "-0.02em" }}>
              Wildfire smoke risk is global, fast-changing, and fragmented.
            </h2>
            <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.7 }}>
              AQI feeds, satellite fire detections, weather services, wind models —
              all siloed. People don&apos;t need another dashboard. They need an agent
              that monitors conditions, remembers history, and proactively tells them
              what changed.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Official data sources fused per analysis", value: "4+", color: "#38BDF8" },
              { label: "RocketRide pipeline stages per request", value: "12", color: "#22C55E" },
              { label: "Cities + coordinates supported", value: "Global", color: "#F97316" },
              { label: "Memory operations per session", value: "R+W", color: "#A78BFA" },
            ].map(m => (
              <div key={m.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: m.color, width: 60, flexShrink: 0 }}>{m.value}</div>
                <div style={{ fontSize: 12, color: "#4B5563" }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "0 40px 60px", maxWidth: 1100, margin: "0 auto",
      }}>
        <div style={{ textAlign: "center", marginBottom: 32, animation: "fadeUp 0.8s 0.55s ease both" }}>
          <div style={{ fontSize: 10, color: "#A78BFA", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>HACKATHON STACK</div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
            Built with RocketRide · Butterbase · XTrace · Photon
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {ARCH.map((a, i) => (
            <div key={a.name} className="arch-card" style={{
              background: "#0A0D12",
              border: `1px solid ${a.color}33`,
              borderRadius: 12,
              padding: "24px 26px",
              animation: `fadeUp 0.8s ${0.6 + i * 0.1}s ease both`,
              transition: "transform 0.2s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 22 }}>{a.icon}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: a.color }}>{a.name}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, color: a.color,
                      background: `${a.color}18`, padding: "2px 6px", borderRadius: 3, letterSpacing: "0.06em",
                    }}>{a.badge}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#4B5563", marginTop: 1 }}>{a.role}</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.65, margin: 0 }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pipeline animation ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "0 40px 60px", maxWidth: 1100, margin: "0 auto",
        animation: "fadeUp 0.8s 0.8s ease both",
      }}>
        <div style={{
          background: "#0A0D12", border: "1px solid #1E293B",
          borderRadius: 12, padding: "28px 32px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: "#22C55E", fontWeight: 700, letterSpacing: "0.1em" }}>ROCKETRIDE PIPELINE</div>
              <div style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600, marginTop: 2 }}>firescout_emergency_analysis · 12 stages</div>
            </div>
            <div style={{
              fontSize: 9, color: "#22C55E", fontWeight: 700,
              background: "#22C55E18", border: "1px solid #22C55E33",
              borderRadius: 4, padding: "3px 10px",
            }}>
              ◉ RUNNING
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {PIPELINE_STEPS.map((s, i) => {
              const isDone = i < activeStep;
              const isRunning = i === activeStep;
              return (
                <div key={s.stage} style={{
                  background: isDone ? `${s.color}18` : isRunning ? `${s.color}12` : "#070A0F",
                  border: `1px solid ${isDone || isRunning ? s.color + "44" : "#1E293B"}`,
                  borderRadius: 6, padding: "7px 10px",
                  animation: isRunning ? "stepPing 0.7s ease" : undefined,
                }}>
                  <div style={{ fontSize: 8, color: isDone || isRunning ? s.color : "#374151", fontWeight: 700 }}>
                    {isDone ? "✓" : isRunning ? "◉" : "○"} {s.stage}
                  </div>
                  <div style={{ fontSize: 9, color: isDone ? "#CBD5E1" : isRunning ? "#94A3B8" : "#374151", marginTop: 1, lineHeight: 1.3 }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Demo flow ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "0 40px 60px", maxWidth: 1100, margin: "0 auto",
        animation: "fadeUp 0.8s 0.9s ease both",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: "#F97316", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>DEMO FLOW</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>What the agent does in one request</h2>
        </div>
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {[
            { n: "1", icon: "💬", title: "User asks", desc: "\"Monitor Athens for smoke\"", color: "#38BDF8" },
            { n: "2", icon: "⚡", title: "RocketRide runs", desc: "12-stage analysis pipeline", color: "#22C55E" },
            { n: "3", icon: "🗄", title: "Butterbase saves", desc: "User, location, report, artifacts", color: "#38BDF8" },
            { n: "4", icon: "🧠", title: "XTrace reads + writes", desc: "Memory before and after", color: "#A78BFA" },
            { n: "5", icon: "💬", title: "Photon delivers", desc: "Alert via Slack / WhatsApp", color: "#FACC15" },
          ].map((step, i) => (
            <div key={step.n} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <div style={{
                flex: 1, background: "#0A0D12",
                border: `1px solid ${step.color}33`,
                borderRadius: 8, padding: "16px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{step.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: step.color, marginBottom: 3 }}>{step.n}. {step.title}</div>
                <div style={{ fontSize: 10, color: "#4B5563" }}>{step.desc}</div>
              </div>
              {i < 4 && (
                <div style={{ fontSize: 14, color: "#1E293B", flexShrink: 0, padding: "0 4px" }}>→</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
          {[
            { label: "Run Global Demo", href: "/demo", color: "#F97316", bg: "#F97316" },
            { label: "⚡ RocketRide Pipeline", href: "/demo", color: "#22C55E", bg: "transparent" },
            { label: "🧠 XTrace Memory", href: "/demo", color: "#A78BFA", bg: "transparent" },
            { label: "💬 Photon Alert", href: "/demo", color: "#FACC15", bg: "transparent" },
          ].map(b => (
            <Link key={b.label} href={b.href} style={{
              background: b.bg !== "transparent" ? b.bg : "#0F172A",
              color: b.bg !== "transparent" ? "#fff" : b.color,
              border: `1px solid ${b.color}44`,
              padding: "9px 20px", borderRadius: 7,
              fontWeight: 700, fontSize: 12, textDecoration: "none",
            }}>
              {b.label}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Agent capabilities ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "0 40px 60px", maxWidth: 900, margin: "0 auto",
        animation: "fadeUp 0.8s 1s ease both",
      }}>
        <div style={{
          background: "#0A0D12", border: "1px solid #1E293B",
          borderRadius: 12, padding: "28px 32px",
        }}>
          <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 16 }}>AGENT CAPABILITIES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AGENT_CAPABILITIES.map(c => (
              <div key={c} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#F97316", marginTop: 5, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Data sources ── */}
      <section style={{
        position: "relative", zIndex: 1,
        padding: "0 40px 60px", maxWidth: 900, margin: "0 auto",
        animation: "fadeUp 0.8s 1.05s ease both",
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { label: "RocketRide", color: "#22C55E", type: "ORCHESTRATION" },
            { label: "Butterbase", color: "#38BDF8", type: "BACKEND" },
            { label: "XTrace", color: "#A78BFA", type: "MEMORY" },
            { label: "Photon/Spectrum", color: "#FACC15", type: "MESSAGING" },
            { label: "AirNow", color: "#38BDF8", type: "AQI" },
            { label: "NASA FIRMS", color: "#F97316", type: "SATELLITE" },
            { label: "NWS", color: "#38BDF8", type: "WEATHER" },
            { label: "NASA GIBS", color: "#94A3B8", type: "IMAGERY" },
          ].map(b => (
            <div key={b.label} style={{
              background: "#0F172A", border: `1px solid ${b.color}33`,
              borderRadius: 8, padding: "6px 14px",
              display: "flex", flexDirection: "column", gap: 2, alignItems: "center",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{b.label}</div>
              <div style={{ fontSize: 8, color: "#374151", letterSpacing: "0.05em" }}>{b.type}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        position: "relative", zIndex: 1,
        padding: "24px 40px",
        borderTop: "1px solid #1E293B",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "#374151", marginBottom: 8 }}>
          Built for the{" "}
          <span style={{ color: "#F97316" }}>Agentic AI SF Hackathon</span>
          {" "}with RocketRide · Butterbase · XTrace · Photon
        </div>
        <div style={{ fontSize: 10, color: "#263241", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
          FireScout is decision support only. AirNow data is real-time/preliminary AQI reporting, not final AQS regulatory-certified data.
          For evacuation or emergency guidance, follow local officials, CAL FIRE, NWS, and emergency alerts.
        </div>
      </footer>
    </div>
  );
}
