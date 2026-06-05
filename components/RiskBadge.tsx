"use client";
import type { RiskLevel } from "@/lib/types";

const COLORS: Record<RiskLevel, { bg: string; text: string; border: string }> = {
  CLEAR: { bg: "#16a34a", text: "#fff", border: "#15803d" },
  WATCH: { bg: "#ca8a04", text: "#fff", border: "#a16207" },
  ACT: { bg: "#ea580c", text: "#fff", border: "#c2410c" },
  CRITICAL: { bg: "#dc2626", text: "#fff", border: "#b91c1c" },
};

interface RiskBadgeProps {
  level: RiskLevel;
  score?: number;
  large?: boolean;
}

export default function RiskBadge({ level, score, large }: RiskBadgeProps) {
  const c = COLORS[level];
  const size = large ? { fontSize: 22, padding: "10px 22px", borderRadius: 12 } : { fontSize: 13, padding: "4px 12px", borderRadius: 8 };
  return (
    <span
      style={{
        backgroundColor: c.bg,
        color: c.text,
        border: `2px solid ${c.border}`,
        fontWeight: 700,
        letterSpacing: "0.05em",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        ...size,
      }}
    >
      {level}
      {score !== undefined && (
        <span style={{ fontWeight: 400, fontSize: large ? 16 : 11, opacity: 0.85 }}>
          ({score})
        </span>
      )}
    </span>
  );
}
