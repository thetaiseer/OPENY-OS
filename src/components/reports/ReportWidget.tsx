"use client";

import { LucideIcon } from "lucide-react";

interface ReportWidgetProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  bgColor?: string;
  subLabel?: string;
  accent?: boolean;
  warning?: boolean;
  critical?: boolean;
}

export function ReportWidget({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  subLabel,
  accent,
  warning,
  critical,
}: ReportWidgetProps) {
  const resolvedColor = critical
    ? "var(--error)"
    : warning
    ? "#fbbf24"
    : accent
    ? "var(--accent)"
    : color ?? "var(--text-secondary)";

  const resolvedBg = critical
    ? "rgba(248,113,113,0.08)"
    : warning
    ? "rgba(251,191,36,0.08)"
    : accent
    ? "var(--accent-dim)"
    : bgColor ?? "var(--surface-2)";

  const resolvedBorder = critical
    ? "rgba(248,113,113,0.25)"
    : warning
    ? "rgba(251,191,36,0.25)"
    : accent
    ? "rgba(79,142,247,0.25)"
    : "var(--border)";

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: resolvedBg,
        border: `1px solid ${resolvedBorder}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${resolvedColor}22` }}
        >
          <Icon size={18} color={resolvedColor} />
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-bold tracking-tight"
          style={{ color: resolvedColor }}
        >
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        {subLabel && (
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            {subLabel}
          </p>
        )}
      </div>
    </div>
  );
}
