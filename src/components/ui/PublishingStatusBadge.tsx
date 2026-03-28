"use client";

// ============================================================
// OPENY OS – Publishing Status Badge Component
// Phase 4: Publishing Workflow
// ============================================================
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Zap } from "lucide-react";
import type { PublishingStatus } from "@/lib/types";

interface Props {
  status: PublishingStatus;
  size?: "sm" | "md";
}

const CONFIG: Record<
  PublishingStatus,
  { label: string; icon: typeof CheckCircle2; bg: string; color: string }
> = {
  scheduled: {
    label: "Scheduled",
    icon: Clock,
    bg: "rgba(79,142,247,0.15)",
    color: "#4f8ef7",
  },
  due_now: {
    label: "Due Now",
    icon: Zap,
    bg: "rgba(251,191,36,0.15)",
    color: "#fbbf24",
  },
  published: {
    label: "Published",
    icon: CheckCircle2,
    bg: "rgba(52,211,153,0.15)",
    color: "#34d399",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    bg: "rgba(248,113,113,0.15)",
    color: "#f87171",
  },
  rescheduled: {
    label: "Rescheduled",
    icon: RefreshCw,
    bg: "rgba(167,139,250,0.15)",
    color: "#a78bfa",
  },
};

export function PublishingStatusBadge({ status, size = "sm" }: Props) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  const iconSize = size === "sm" ? 11 : 13;
  const fontSize = size === "sm" ? "10px" : "11px";

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-medium"
      style={{
        background: cfg.bg,
        color: cfg.color,
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        fontSize,
      }}
    >
      <Icon size={iconSize} />
      {cfg.label}
    </span>
  );
}
