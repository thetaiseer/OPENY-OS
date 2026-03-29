"use client";

import { Filter, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";
import type { ContentPlatform, ContentStatus, ApprovalStatus, ContentItem } from "@/lib/types";
import { STATUS_ORDER } from "./contentUtils";

export interface ContentFiltersState {
  clientId: string;
  platform: ContentPlatform | "";
  status: ContentStatus | "";
  assignedTo: string;
  approvalStatus: ApprovalStatus | "";
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: ContentFiltersState = {
  clientId: "",
  platform: "",
  status: "",
  assignedTo: "",
  approvalStatus: "",
  dateFrom: "",
  dateTo: "",
};

interface ContentFiltersProps {
  filters: ContentFiltersState;
  onChange: (f: ContentFiltersState) => void;
}

const PLATFORMS: ContentPlatform[] = ["Facebook", "Instagram", "TikTok", "LinkedIn", "X", "Snapchat", "YouTube"];
const APPROVAL_STATUSES: ApprovalStatus[] = ["pending_internal", "pending_client", "approved", "rejected"];

export function ContentFilters({ filters, onChange }: ContentFiltersProps) {
  const { t } = useLanguage();
  const { clients, members } = useAppStore();

  const set = (key: keyof ContentFiltersState, val: string) =>
    onChange({ ...filters, [key]: val });

  const hasActive = Object.values(filters).some((v) => v !== "");

  const selectStyle = {
    background: "var(--surface-3)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    borderRadius: "10px",
    fontSize: "12px",
    padding: "6px 10px",
    outline: "none",
    cursor: "pointer",
  } as React.CSSProperties;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <Filter size={13} />
        <span className="text-xs font-medium">Filters</span>
      </div>

      {/* Client filter */}
      <select
        value={filters.clientId}
        onChange={(e) => set("clientId", e.target.value)}
        style={selectStyle}
      >
        <option value="">{t("content.filterClient")}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Platform filter */}
      <select
        value={filters.platform}
        onChange={(e) => set("platform", e.target.value)}
        style={selectStyle}
      >
        <option value="">{t("content.filterPlatform")}</option>
        {PLATFORMS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={(e) => set("status", e.target.value)}
        style={selectStyle}
      >
        <option value="">{t("content.filterStatus")}</option>
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {t(("content.status" + s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")) as Parameters<typeof t>[0])}
          </option>
        ))}
      </select>

      {/* Assignee filter */}
      <select
        value={filters.assignedTo}
        onChange={(e) => set("assignedTo", e.target.value)}
        style={selectStyle}
      >
        <option value="">{t("content.filterAssignee")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      {/* Approval filter */}
      <select
        value={filters.approvalStatus}
        onChange={(e) => set("approvalStatus", e.target.value)}
        style={selectStyle}
      >
        <option value="">{t("content.filterApproval")}</option>
        {APPROVAL_STATUSES.map((a) => (
          <option key={a} value={a}>
            {t(("content.approval" + a.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")) as Parameters<typeof t>[0])}
          </option>
        ))}
      </select>

      {/* Date range */}
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => set("dateFrom", e.target.value)}
        style={{ ...selectStyle, padding: "5px 10px" }}
      />
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>–</span>
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => set("dateTo", e.target.value)}
        style={{ ...selectStyle, padding: "5px 10px" }}
      />

      {/* Clear */}
      {hasActive && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all"
          style={{ color: "var(--error)", background: "var(--surface-3)", border: "1px solid var(--border)" }}
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
}

// ── Filter application helper ─────────────────────────────────

export function applyFilters(items: ContentItem[], filters: ContentFiltersState): ContentItem[] {
  return items.filter((item) => {
    if (filters.clientId && item.clientId !== filters.clientId) return false;
    if (filters.platform && item.platform !== filters.platform) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.assignedTo && item.assignedTo !== filters.assignedTo) return false;
    if (filters.approvalStatus && item.approvalStatus !== filters.approvalStatus) return false;
    if (filters.dateFrom && item.scheduledDate && item.scheduledDate < filters.dateFrom) return false;
    if (filters.dateTo && item.scheduledDate && item.scheduledDate > filters.dateTo) return false;
    return true;
  });
}
