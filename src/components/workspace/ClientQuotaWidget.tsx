"use client";

import { AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface ClientQuotaWidgetProps {
  quota: number;
  used: number;
  label?: string;
}

export function ClientQuotaWidget({ quota, used, label }: ClientQuotaWidgetProps) {
  const { t } = useLanguage();
  const pct = quota > 0 ? Math.min(Math.round((used / quota) * 100), 100) : 0;
  const isCritical = pct >= 100;
  const isWarning = pct >= 80 && !isCritical;

  const barColor = isCritical
    ? "var(--error)"
    : isWarning
    ? "var(--warning, #fbbf24)"
    : "var(--accent)";

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: isCritical
          ? "rgba(248,113,113,0.08)"
          : isWarning
          ? "rgba(251,191,36,0.08)"
          : "var(--surface-2)",
        border: `1px solid ${
          isCritical
            ? "rgba(248,113,113,0.3)"
            : isWarning
            ? "rgba(251,191,36,0.3)"
            : "var(--border)"
        }`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <XCircle size={15} color="var(--error)" />
          ) : isWarning ? (
            <AlertTriangle size={15} color="#fbbf24" />
          ) : (
            <CheckCircle size={15} color="var(--accent)" />
          )}
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {label ?? t("workspace.quotaUsed")}
          </span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: isCritical
              ? "rgba(248,113,113,0.15)"
              : isWarning
              ? "rgba(251,191,36,0.15)"
              : "var(--accent-dim)",
            color: isCritical ? "var(--error)" : isWarning ? "#fbbf24" : "var(--accent)",
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Bar */}
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {used} {t("workspace.postsUsed")}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {Math.max(quota - used, 0)} {t("workspace.postsRemaining")} / {quota}
        </span>
      </div>

      {isCritical && (
        <p className="mt-2 text-[11px] font-medium" style={{ color: "var(--error)" }}>
          {t("workspace.quotaCritical")}
        </p>
      )}
      {isWarning && (
        <p className="mt-2 text-[11px] font-medium" style={{ color: "#fbbf24" }}>
          {t("workspace.quotaWarning")}
        </p>
      )}
    </div>
  );
}
