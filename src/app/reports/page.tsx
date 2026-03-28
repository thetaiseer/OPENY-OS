"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Megaphone,
  AlertTriangle,
  Users2,
  Download,
  Printer,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";
import { useCampaigns } from "@/lib/CampaignContext";
import { useContentItems } from "@/lib/ContentContext";
import { ReportWidget } from "@/components/reports/ReportWidget";
import { ReportsFilters, type ReportFiltersState } from "@/components/reports/ReportsFilters";
import { ClientQuotaWidget } from "@/components/workspace/ClientQuotaWidget";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";

function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function inDateRange(
  dateStr: string,
  range: ReportFiltersState["dateRange"]
): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  if (range === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (range === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && d <= now;
  }
  if (range === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const { clients, tasks, members } = useAppStore();
  const { campaigns } = useCampaigns();
  const { contentItems } = useContentItems();

  const [filters, setFilters] = useState<ReportFiltersState>({
    clientId: "",
    dateRange: "month",
    campaignId: "",
    memberId: "",
  });

  // Filter helpers
  const filteredContent = useMemo(
    () =>
      contentItems.filter((item) => {
        if (filters.clientId && item.clientId !== filters.clientId) return false;
        if (filters.campaignId && item.campaignId !== filters.campaignId) return false;
        if (filters.memberId && item.assignedTo !== filters.memberId) return false;
        return true;
      }),
    [contentItems, filters],
  );

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((c) => {
        if (filters.clientId && c.clientId !== filters.clientId) return false;
        return true;
      }),
    [campaigns, filters],
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (filters.memberId && task.assignedTo !== filters.memberId) return false;
        return true;
      }),
    [tasks, filters],
  );

  // Metrics
  const postsPlanned = filteredContent.length;
  const postsPublished = filteredContent.filter((i) => i.status === "published").length;
  const pendingApprovals = filteredContent.filter(
    (i) => i.approvalStatus === "pending_internal" || i.approvalStatus === "pending_client"
  ).length;
  const overdueContent = filteredContent.filter(
    (i) =>
      i.status !== "published" &&
      i.scheduledDate &&
      isOverdue(i.scheduledDate)
  ).length;
  const overdueTasks = filteredTasks.filter(
    (t) => t.status !== "done" && t.dueDate && isOverdue(t.dueDate)
  ).length;
  const activeCampaigns = filteredCampaigns.filter((c) => c.status === "active").length;
  const completedCampaigns = filteredCampaigns.filter((c) => c.status === "completed").length;

  // Clients near quota (use monthlyPostQuota from client)
  const clientsNearQuota = clients.filter((c) => {
    const quota = c.monthlyPostQuota ?? 0;
    if (quota === 0) return false;
    const used = contentItems.filter(
      (item) =>
        item.clientId === c.id &&
        (item.status === "published" || item.status === "scheduled")
    ).length;
    return used / quota >= 0.8;
  });

  // Team workload
  const memberWorkload = members.map((m) => ({
    member: m,
    openTasks: filteredTasks.filter((t) => t.assignedTo === m.id && t.status !== "done").length,
    contentItems: filteredContent.filter((i) => i.assignedTo === m.id).length,
  }));

  // CSV export
  const handleExportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      [t("reports.postsPlanned"), postsPlanned],
      [t("reports.postsPublished"), postsPublished],
      [t("reports.pendingApprovals"), pendingApprovals],
      [t("reports.overdueContent"), overdueContent],
      [t("reports.overdueTasks"), overdueTasks],
      [t("reports.activeCampaigns"), activeCampaigns],
      [t("reports.completedCampaigns"), completedCampaigns],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openy-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        icon={BarChart3}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={Download} onClick={handleExportCSV}>
              {t("reports.exportCSV")}
            </Button>
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
              {t("reports.printReport")}
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div
        className="rounded-2xl p-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <ReportsFilters
          clients={clients}
          campaigns={campaigns}
          members={members}
          filters={filters}
          onChange={setFilters}
        />
      </div>

      {/* Summary widgets */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          {t("reports.postingsSummary")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ReportWidget
            label={t("reports.postsPlanned")}
            value={postsPlanned}
            icon={Calendar}
            accent
          />
          <ReportWidget
            label={t("reports.postsPublished")}
            value={postsPublished}
            icon={CheckCircle2}
            color="var(--success, #34d399)"
          />
          <ReportWidget
            label={t("reports.pendingApprovals")}
            value={pendingApprovals}
            icon={ClipboardCheck}
            warning={pendingApprovals > 5}
          />
          <ReportWidget
            label={t("reports.overdueContent")}
            value={overdueContent}
            icon={AlertTriangle}
            critical={overdueContent > 0}
          />
        </div>
      </div>

      {/* Operations widgets */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          {t("reports.campaignOverview")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <ReportWidget
            label={t("reports.activeCampaigns")}
            value={activeCampaigns}
            icon={Megaphone}
            color="#a78bfa"
          />
          <ReportWidget
            label={t("reports.completedCampaigns")}
            value={completedCampaigns}
            icon={CheckCircle2}
            color="var(--success, #34d399)"
          />
          <ReportWidget
            label={t("reports.overdueTasks")}
            value={overdueTasks}
            icon={Clock}
            critical={overdueTasks > 0}
          />
          <ReportWidget
            label={t("reports.clientsNearQuota")}
            value={clientsNearQuota.length}
            icon={Users2}
            warning={clientsNearQuota.length > 0}
          />
        </div>
      </div>

      {/* Quota usage per client */}
      {clients.filter((c) => c.monthlyPostQuota).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            {t("reports.quotaUsage")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients
              .filter((c) => c.monthlyPostQuota)
              .filter((c) => !filters.clientId || c.id === filters.clientId)
              .map((client) => {
                const quota = client.monthlyPostQuota ?? 0;
                const used = contentItems.filter(
                  (item) =>
                    item.clientId === client.id &&
                    (item.status === "published" || item.status === "scheduled")
                ).length;
                return (
                  <div
                    key={client.id}
                    className="rounded-2xl p-4"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: client.color }}
                      >
                        {client.initials}
                      </div>
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {client.name}
                      </span>
                    </div>
                    <ClientQuotaWidget quota={quota} used={used} />
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Team workload */}
      {memberWorkload.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            {t("reports.teamWorkload")}
          </h2>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {memberWorkload.map(({ member, openTasks, contentItems: memberContent }, idx) => (
              <div
                key={member.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: member.color }}
                >
                  {member.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {member.name}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {member.role}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {openTasks}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {t("tasks.open")}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {memberContent}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {t("workspace.contentCount")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
