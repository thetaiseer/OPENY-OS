"use client";

import { useState, useMemo } from "react";
import {
  BarChart2,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Download,
  CalendarDays,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Client } from "@/lib/types";

type Period = "today" | "week" | "month";

function periodFilter(dateStr: string, period: Period): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  if (period === "today") {
    return d.toDateString() === now.toDateString();
  }
  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function ReportWidget({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20` }}
        >
          <Icon size={17} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ClientReportRow({
  client,
  contentItems,
  tasks,
  approvals,
}: {
  client: Client & { monthlyPostQuota?: number };
  contentItems: Array<{ id: string; status: string; clientId: string; scheduledDate?: string }>;
  tasks: Array<{ id: string; status: string; dueDate: string }>;
  approvals: Array<{ id: string; status: string; clientId: string }>;
}) {
  const { t } = useLanguage();
  const quota = client.monthlyPostQuota ?? 30;
  const clientContent = contentItems.filter((c) => c.clientId === client.id);
  const published = clientContent.filter((c) => c.status === "published").length;
  const pct = Math.min(100, Math.round((published / quota) * 100));
  const pendingA = approvals.filter(
    (a) => a.clientId === client.id && a.status.startsWith("pending"),
  ).length;
  const today = new Date();
  const overdueTasks = tasks.filter((task) => {
    if (task.status === "done") return false;
    return new Date(task.dueDate) < today;
  }).length;
  const color =
    pct >= 100 ? "var(--error)" : pct >= 80 ? "var(--warning)" : "var(--success)";

  return (
    <div
      className="flex items-center gap-4 p-4"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
        style={{ background: client.color }}
      >
        {client.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {client.name}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
          {client.company}
        </p>
      </div>
      {/* Quota bar */}
      <div className="w-24 hidden sm:block">
        <div
          className="flex justify-between text-xs mb-1"
          style={{ color: "var(--text-muted)" }}
        >
          <span>{published}</span>
          <span>/{quota}</span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--surface-3)" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
      <div className="gap-4 text-center hidden md:flex">
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: pendingA > 0 ? "var(--warning)" : "var(--text-primary)" }}
          >
            {pendingA}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("reports.pendingApprovals")}
          </p>
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: overdueTasks > 0 ? "var(--error)" : "var(--text-primary)" }}
          >
            {overdueTasks}
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("reports.overdueTasks")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useLanguage();
  const { clients, tasks } = useAppStore();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();

  const [period, setPeriod] = useState<Period>("month");
  const [filterClient, setFilterClient] = useState("all");

  const filteredContent = useMemo(
    () =>
      contentItems.filter((c) => {
        const matchPeriod = periodFilter(c.createdAt, period);
        const matchClient = filterClient === "all" || c.clientId === filterClient;
        return matchPeriod && matchClient;
      }),
    [contentItems, period, filterClient],
  );

  const postsPlanned = filteredContent.length;
  const postsPublished = filteredContent.filter((c) => c.status === "published").length;
  const pendingApprovals = approvals.filter((a) => a.status.startsWith("pending")).length;
  const approvedItems = approvals.filter((a) => a.status === "approved").length;
  const today = new Date();
  const overdueTasks = tasks.filter(
    (task) => task.status !== "done" && new Date(task.dueDate) < today,
  ).length;
  const overdueContent = contentItems.filter((c) => {
    if (c.status === "published") return false;
    return c.scheduledDate && new Date(c.scheduledDate) < today;
  }).length;
  const nearQuota = clients.filter((c) => {
    const extC = c as Client & { monthlyPostQuota?: number };
    const quota = extC.monthlyPostQuota ?? 30;
    const used = contentItems.filter(
      (ci) => ci.clientId === c.id && ci.status === "published",
    ).length;
    return used / quota >= 0.8;
  }).length;

  const handleExportCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ["Posts Planned", postsPlanned],
      ["Posts Published", postsPublished],
      ["Pending Approvals", pendingApprovals],
      ["Approved Items", approvedItems],
      ["Overdue Tasks", overdueTasks],
      ["Overdue Content", overdueContent],
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
    <div>
      <SectionHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        icon={BarChart2}
        action={
          <Button variant="secondary" icon={Download} onClick={handleExportCsv}>
            {t("reports.exportCsv")}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div
          className="flex gap-1 rounded-xl p-1"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {(
            [
              { key: "today" as const, label: t("reports.today") },
              { key: "week" as const, label: t("reports.thisWeek") },
              { key: "month" as const, label: t("reports.thisMonth") },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: period === key ? "var(--surface-3)" : "transparent",
                color: period === key ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="all">{t("reports.filterClient")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Widgets grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <ReportWidget
          label={t("reports.postsPlanned")}
          value={postsPlanned}
          icon={TrendingUp}
          color="var(--accent)"
        />
        <ReportWidget
          label={t("reports.postsPublished")}
          value={postsPublished}
          icon={CheckCircle2}
          color="var(--success)"
        />
        <ReportWidget
          label={t("reports.pendingApprovals")}
          value={pendingApprovals}
          icon={Clock}
          color="var(--warning)"
        />
        <ReportWidget
          label={t("reports.overdueTasks")}
          value={overdueTasks}
          icon={AlertTriangle}
          color="var(--error)"
        />
        <ReportWidget
          label={t("reports.approvedItems")}
          value={approvedItems}
          icon={CheckCircle2}
          color="var(--success)"
        />
        <ReportWidget
          label={t("reports.totalContent")}
          value={contentItems.length}
          icon={CalendarDays}
          color="var(--accent)"
        />
        <ReportWidget
          label={t("reports.overdueContent")}
          value={overdueContent}
          icon={AlertTriangle}
          color="var(--warning)"
        />
        <ReportWidget
          label={t("reports.nearQuotaLimit")}
          value={nearQuota}
          sub={t("reports.clientsNearLimit")}
          icon={Users}
          color="var(--error)"
        />
      </div>

      {/* Client breakdown */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="px-4 py-3"
          style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("reports.clientReport")}
          </p>
        </div>
        <div style={{ background: "var(--surface-1)" }}>
          {clients.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("reports.noDataForPeriod")}
              </p>
            </div>
          ) : (
            clients.map((client) => (
              <ClientReportRow
                key={client.id}
                client={client as Client & { monthlyPostQuota?: number }}
                contentItems={contentItems}
                tasks={tasks}
                approvals={approvals}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
