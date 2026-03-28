"use client";

// ============================================================
// OPENY OS – Publishing Readiness Badge Component
// Phase 4: Publishing Workflow
// ============================================================
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import type { PublishingReadiness } from "@/lib/types";

interface Props {
  readiness: PublishingReadiness;
  size?: "sm" | "md";
}

const CONFIG: Record<
  PublishingReadiness,
  { label: string; labelAr: string; icon: typeof CheckCircle2; bg: string; color: string }
> = {
  ready_to_publish: {
    label: "Ready to Publish",
    labelAr: "جاهز للنشر",
    icon: CheckCircle2,
    bg: "rgba(52,211,153,0.15)",
    color: "#34d399",
  },
  ready_to_schedule: {
    label: "Ready to Schedule",
    labelAr: "جاهز للجدولة",
    icon: Clock,
    bg: "rgba(79,142,247,0.15)",
    color: "#4f8ef7",
  },
  needs_attention: {
    label: "Needs Attention",
    labelAr: "يحتاج مراجعة",
    icon: AlertCircle,
    bg: "rgba(251,191,36,0.15)",
    color: "#fbbf24",
  },
  not_ready: {
    label: "Not Ready",
    labelAr: "غير جاهز",
    icon: XCircle,
    bg: "rgba(248,113,113,0.15)",
    color: "#f87171",
  },
};

export function PublishingReadinessBadge({ readiness, size = "sm" }: Props) {
  const cfg = CONFIG[readiness];
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
