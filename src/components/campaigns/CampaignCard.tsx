"use client";

import type { Campaign, Client } from "@/lib/types";
import { useLanguage } from "@/lib/LanguageContext";
import { CalendarDays, FileText, CheckSquare } from "lucide-react";

const STATUS_STYLES: Record<Campaign["status"], { bg: string; color: string }> = {
  draft:     { bg: "var(--surface-3)",  color: "var(--text-muted)" },
  planned:   { bg: "#3b82f620",         color: "#3b82f6" },
  active:    { bg: "#10b98120",         color: "#10b981" },
  paused:    { bg: "#f59e0b20",         color: "#f59e0b" },
  completed: { bg: "#8b5cf620",         color: "#8b5cf6" },
  archived:  { bg: "#6b728020",         color: "#6b7280" },
};

const STATUS_LABEL_KEYS: Record<Campaign["status"], string> = {
  draft:     "campaigns.statusDraft",
  planned:   "campaigns.statusPlanned",
  active:    "campaigns.statusActive",
  paused:    "campaigns.statusPaused",
  completed: "campaigns.statusCompleted",
  archived:  "campaigns.statusArchived",
};

const PLATFORM_COLORS: Record<string, string> = {
  Facebook:  "#3b82f6",
  Instagram: "#e1306c",
  TikTok:    "#000000",
  LinkedIn:  "#0a66c2",
  X:         "#1d9bf0",
  Snapchat:  "#fffc00",
  YouTube:   "#ff0000",
};

interface CampaignCardProps {
  campaign: Campaign;
  clients: Client[];
  onClick: () => void;
}

export function CampaignCard({ campaign, clients, onClick }: CampaignCardProps) {
  const { t } = useLanguage();
  const client = clients.find((c) => c.id === campaign.clientId);
  const statusStyle = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft;

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {campaign.name}
          </p>
          {client && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
              {client.name}
            </p>
          )}
        </div>
        <span
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0"
          style={{ background: statusStyle.bg, color: statusStyle.color }}
        >
          {t(STATUS_LABEL_KEYS[campaign.status] as Parameters<typeof t>[0])}
        </span>
      </div>

      {/* Objective */}
      {campaign.objective && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
          {campaign.objective}
        </p>
      )}

      {/* Platforms */}
      {campaign.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {campaign.platforms.map((p) => (
            <span
              key={p}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium"
              style={{
                background: (PLATFORM_COLORS[p] ?? "#888") + "20",
                color: PLATFORM_COLORS[p] ?? "#888",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Date range */}
      <div className="flex items-center gap-1.5 mb-3" style={{ color: "var(--text-muted)" }}>
        <CalendarDays size={12} />
        <span className="text-xs">
          {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
        </span>
      </div>

      {/* Footer counts */}
      <div className="flex items-center gap-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <FileText size={12} />
          <span className="text-xs">{campaign.linkedContentCount} {t("campaigns.linkedContent")}</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <CheckSquare size={12} />
          <span className="text-xs">{campaign.linkedTaskCount} {t("campaigns.linkedTasks")}</span>
        </div>
      </div>
    </div>
  );
}
