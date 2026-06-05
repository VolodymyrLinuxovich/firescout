"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  riskLevel?: string;
  mapUrl?: string;
  ts: Date;
  status: "sending" | "delivered" | "failed";
}

interface ChatApiResponse {
  text?: string;
  riskLevel?: string;
  riskScore?: number;
  mapUrl?: string;
  reportId?: string;
  error?: string;
}

export interface ChatResult {
  riskLevel?: string;
  riskScore?: number;
  mapUrl?: string;
  reportId?: string;
}

interface Props {
  sessionId?: string;
  onResult?: (r: ChatResult) => void;
}

const RISK_COLORS: Record<string, string> = {
  CLEAR: "#22C55E", WATCH: "#FACC15", ACT: "#F97316", CRITICAL: "#EF4444",
};

const QUICK_REPLIES = [
  "Monitor Berkeley for smoke",
  "What changed since last report?",
  "Check Athens, Greece",
  "Check Delhi, India",
  "How bad is it right now?",
  "Explain the risk in plain English",
];

export default function PhotonChat({ sessionId = "imessage_demo", onResult }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hey — I'm FireScout 🔥\n\nI monitor wildfire smoke risk anywhere in the world. Try:\n\n• \"Monitor Berkeley for smoke\"\n• \"Check Athens, Greece\"\n• \"What changed since last report?\"",
      ts: new Date(),
      status: "delivered",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text: text.trim(),
      ts: new Date(),
      status: "sending",
    };
    setMessages(prev => [...prev, userMsg]);

    // mark delivered after short delay
    setTimeout(() => setMessages(prev =>
      prev.map(m => m.id === userMsg.id ? { ...m, status: "delivered" } : m)
    ), 400);

    // typing bubble
    const typingId = `typing_${Date.now()}`;
    setTimeout(() => setMessages(prev => [
      ...prev,
      { id: typingId, role: "agent", text: "__typing__", ts: new Date(), status: "delivered" },
    ]), 600);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), sessionId, platform: "imessage" }),
      });
      const data: ChatApiResponse = await res.json();

      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        {
          id: `a_${Date.now()}`,
          role: "agent",
          text: data.error ? `Error: ${data.error}` : (data.text ?? "No response"),
          riskLevel: data.riskLevel ?? undefined,
          mapUrl: data.mapUrl ?? undefined,
          ts: new Date(),
          status: "delivered",
        },
      ]);

      if (!data.error && onResult) {
        onResult({ riskLevel: data.riskLevel, riskScore: data.riskScore, mapUrl: data.mapUrl, reportId: data.reportId });
      }
    } catch (e) {
      setMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        {
          id: `err_${Date.now()}`,
          role: "agent",
          text: "Connection error — " + String(e),
          ts: new Date(),
          status: "failed",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [sending, sessionId, onResult]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#000",
      fontFamily: "-apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
    }}>
      <style>{`
        @keyframes typingBounce {
          0%,60%,100% { transform: translateY(0); opacity:0.4; }
          30% { transform: translateY(-4px); opacity:1; }
        }
        @keyframes bubbleIn {
          from { opacity:0; transform: scale(0.94) translateY(4px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* iMessage top bar */}
      <div style={{
        background: "linear-gradient(to bottom, #1C1C1E, #161618)",
        borderBottom: "1px solid #2C2C2E",
        padding: "10px 14px 10px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, #F97316 0%, #EF4444 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, flexShrink: 0,
        }}>🔥</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#F2F2F7", letterSpacing: "-0.01em" }}>
            FireScout
          </div>
          <div style={{ fontSize: 10, color: "#8E8E93", marginTop: 1 }}>
            {sending ? "typing…" : "Wildfire Intelligence · via Photon/iMessage"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E" }} />
          <span style={{ fontSize: 9, color: "#636366" }}>iMessage</span>
        </div>
      </div>

      {/* Message list */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 12px 8px",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        {/* Date header */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span style={{
            fontSize: 10, color: "#636366",
            background: "#1C1C1E", padding: "2px 10px", borderRadius: 10,
          }}>
            Today {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>

        {messages.map((msg, i) => (
          <MessageBubble key={msg.id} msg={msg} prev={messages[i - 1]} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div style={{
        padding: "6px 10px",
        display: "flex", gap: 5, overflowX: "auto",
        borderTop: "1px solid #1C1C1E", flexShrink: 0,
      }}>
        {QUICK_REPLIES.map(q => (
          <button key={q} onClick={() => send(q)} disabled={sending} style={{
            background: "transparent",
            border: "1px solid #0A84FF55",
            borderRadius: 14, padding: "4px 11px",
            color: "#0A84FF", fontSize: 10,
            cursor: sending ? "not-allowed" : "pointer",
            whiteSpace: "nowrap", flexShrink: 0,
            fontFamily: "inherit", opacity: sending ? 0.5 : 1,
          }}>
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div style={{
        background: "#1C1C1E",
        borderTop: "1px solid #2C2C2E",
        padding: "8px 10px",
        display: "flex", gap: 8, alignItems: "center", flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }}}
          placeholder="iMessage"
          disabled={sending}
          style={{
            flex: 1, background: "#2C2C2E", border: "none",
            borderRadius: 18, color: "#F2F2F7",
            fontSize: 13, padding: "8px 14px", outline: "none",
            fontFamily: "inherit", opacity: sending ? 0.6 : 1,
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || sending}
          style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0, border: "none",
            background: input.trim() && !sending ? "#0A84FF" : "#3A3A3C",
            cursor: input.trim() && !sending ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: "#fff", transition: "background 0.15s",
            lineHeight: 1,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, prev }: { msg: ChatMessage; prev?: ChatMessage }) {
  const isUser = msg.role === "user";
  const isTyping = msg.text === "__typing__";
  const showAvatar = !prev || prev.role !== msg.role;
  const riskColor = msg.riskLevel ? (RISK_COLORS[msg.riskLevel] ?? "#94A3B8") : null;

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      gap: 6,
      alignItems: "flex-end",
      marginTop: showAvatar ? 8 : 2,
      animation: "bubbleIn 0.18s ease both",
    }}>
      {/* Avatar — only show on first of a run */}
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          background: showAvatar ? "linear-gradient(135deg,#F97316,#EF4444)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13,
        }}>
          {showAvatar ? "🔥" : ""}
        </div>
      )}

      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 3, alignItems: isUser ? "flex-end" : "flex-start" }}>
        {/* Bubble */}
        <div style={{
          background: isUser ? "#0A84FF" : "#1C1C1E",
          borderRadius: isUser
            ? (showAvatar ? "18px 18px 4px 18px" : "18px 18px 4px 18px")
            : (showAvatar ? "4px 18px 18px 18px" : "18px 18px 18px 4px"),
          padding: isTyping ? "12px 16px" : "9px 13px",
          minWidth: isTyping ? 52 : undefined,
        }}>
          {isTyping ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center", height: 12 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#636366",
                  animation: `typingBounce 1.2s ${i * 0.18}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          ) : (
            <>
              {riskColor && msg.riskLevel && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 5,
                  background: `${riskColor}22`, border: `1px solid ${riskColor}55`,
                  borderRadius: 6, padding: "1px 8px",
                }}>
                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: riskColor }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: riskColor, letterSpacing: "0.05em" }}>
                    {msg.riskLevel}
                  </span>
                </div>
              )}
              <div style={{
                fontSize: 13, lineHeight: 1.5,
                color: isUser ? "#fff" : "#F2F2F7",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {msg.text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/_(.*?)_/g, "$1")}
              </div>
              {msg.mapUrl && (
                <a href={msg.mapUrl} target="_blank" rel="noreferrer" style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  marginTop: 7, padding: "5px 10px",
                  background: "rgba(10,132,255,0.15)", border: "1px solid rgba(10,132,255,0.35)",
                  borderRadius: 8, textDecoration: "none",
                  fontSize: 11, color: "#0A84FF", fontWeight: 500,
                }}>
                  🗺 View Smoke Map
                </a>
              )}
            </>
          )}
        </div>

        {/* Delivered / timestamp */}
        {isUser && (
          <div style={{ fontSize: 9, color: "#636366", paddingRight: 2 }}>
            {msg.status === "sending" ? "Sending…" : "Delivered"}
          </div>
        )}
      </div>
    </div>
  );
}
