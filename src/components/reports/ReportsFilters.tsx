"use client";

import { useState } from "react";
import { Filter } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export interface ReportFiltersState {
  clientId: string;
  dateRange: "today" | "week" | "month" | "custom";
  campaignId: string;
  memberId: string;
}

interface ReportsFiltersProps {
  clients: { id: string; name: string }[];
  campaigns: { id: string; name: string }[];
  members: { id: string; name: string }[];
  filters: ReportFiltersState;
  onChange: (filters: ReportFiltersState) => void;
}

export function ReportsFilters({
  clients,
  campaigns,
  members,
  filters,
  onChange,
}: ReportsFiltersProps) {
  const { t } = useLanguage();

  const set = <K extends keyof ReportFiltersState>(key: K, val: ReportFiltersState[K]) =>
    onChange({ ...filters, [key]: val });

  const selectStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
        <Filter size={14} />
        <span className="text-xs font-medium">Filters</span>
      </div>

      {/* Date range */}
      <select
        value={filters.dateRange}
        onChange={(e) => set("dateRange", e.target.value as ReportFiltersState["dateRange"])}
        className="rounded-xl px-3 py-2 text-sm outline-none"
        style={selectStyle}
      >
        <option value="today">{t("reports.today")}</option>
        <option value="week">{t("reports.thisWeek")}</option>
        <option value="month">{t("reports.thisMonth")}</option>
        <option value="custom">{t("reports.customRange")}</option>
      </select>

      {/* Client */}
      <select
        value={filters.clientId}
        onChange={(e) => set("clientId", e.target.value)}
        className="rounded-xl px-3 py-2 text-sm outline-none"
        style={selectStyle}
      >
        <option value="">{t("reports.filterClient")}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Campaign */}
      <select
        value={filters.campaignId}
        onChange={(e) => set("campaignId", e.target.value)}
        className="rounded-xl px-3 py-2 text-sm outline-none"
        style={selectStyle}
      >
        <option value="">{t("reports.filterCampaign")}</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Member */}
      <select
        value={filters.memberId}
        onChange={(e) => set("memberId", e.target.value)}
        className="rounded-xl px-3 py-2 text-sm outline-none"
        style={selectStyle}
      >
        <option value="">{t("reports.filterMember")}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </div>
  );
}
