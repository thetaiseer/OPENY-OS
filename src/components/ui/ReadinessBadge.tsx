"use client";

import type { ContentItem } from "@/lib/types";

interface ReadinessBadgeProps {
  item: ContentItem;
  approvedExternally?: boolean;
}

type ReadinessState = "incomplete" | "almost" | "ready";

function computeReadiness(item: ContentItem, approvedExternally?: boolean): ReadinessState {
  const checks = [
    !!item.title?.trim(),
    !!item.caption?.trim(),
    !!item.platform,
    !!item.scheduledDate,
    !!item.assignedTo,
    approvedExternally !== undefined
      ? approvedExternally
      : item.approvalStatus === "approved",
  ];
  const passed = checks.filter(Boolean).length;
  if (passed === checks.length) return "ready";
  if (passed >= checks.length - 2) return "almost";
  return "incomplete";
}

const READINESS_CONFIG: Record<ReadinessState, { bg: string; color: string; label: string }> = {
  incomplete: { bg: "#ef444420", color: "#ef4444", label: "Incomplete" },
  almost:     { bg: "#f59e0b20", color: "#f59e0b", label: "Almost Ready" },
  ready:      { bg: "#10b98120", color: "#10b981", label: "Ready to Publish" },
};

export function ReadinessBadge({ item, approvedExternally }: ReadinessBadgeProps) {
  const state = computeReadiness(item, approvedExternally);
  const config = READINESS_CONFIG[state];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  );
}
