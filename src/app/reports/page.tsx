"use client";

import { useState, useMemo } from "react";
import {
  BarChart2, TrendingUp, CheckCircle2, AlertTriangle, Clock, Users,
  Download, CalendarDays, FileText, Activity, Target, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
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
  if (period === "today") return d.toDateString() === now.toDateString();
  if (period === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return d >= weekAgo;
  }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function ReportWidget({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-xs font-medium mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
      </div>
    </motion.div>
  );
}

function ClientReportRow({ client, contentItems, tasks, approvals }: {
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
  const pendingA = approvals.filter((a) => a.clientId === client.id && a.status.startsWith("pending")).length;
  const today = new Date();
  const overdueTasks = tasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < today).length;
  const color = pct >= 100 ? "var(--error)" : pct >= 80 ? "var(--warning)" : "var(--success)";

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-[var(--surface-2)] transition-colors"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
        style={{ background: client.color }}>
        {client.initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{client.name}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{client.company}</p>
      </div>
      <div className="w-28 hidden sm:block">
        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--text-muted)" }}>
          <span className="font-medium" style={{ color }}>{published}</span>
          <span>/ {quota}</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
          <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }} style={{ background: color }} />
        </div>
      </div>
      <div className="gap-6 text-center hidden md:flex">
        <div>
          <p className="text-sm font-bold" style={{ color: pendingA > 0 ? "var(--warning)" : "var(--text-primary)" }}>{pendingA}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("reports.pendingApprovals")}</p>
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: overdueTasks > 0 ? "var(--error)" : "var(--text-primary)" }}>{overdueTasks}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("reports.overdueTasks")}</p>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "#64748b", in_review: "#f59e0b", approved: "#10b981",
  scheduled: "#6366f1", published: "#22c55e", archived: "#94a3b8",
};

export default function ReportsPage() {
  const { t } = useLanguage();
  const { clients, tasks, members, activities } = useAppStore();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();

  const [period, setPeriod] = useState<Period>("month");
  const [filterClient, setFilterClient] = useState("all");

  const filteredContent = useMemo(() =>
    contentItems.filter((c) => {
      const matchPeriod = periodFilter(c.createdAt, period);
      const matchClient = filterClient === "all" || c.clientId === filterClient;
      return matchPeriod && matchClient;
    }), [contentItems, period, filterClient]);

  const postsPlanned = filteredContent.length;
  const postsPublished = filteredContent.filter((c) => c.status === "published").length;
  const pendingApprovals = approvals.filter((a) => a.status.startsWith("pending")).length;
  const approvedItems = approvals.filter((a) => a.status === "approved").length;
  const today = new Date();
  const overdueTasks = tasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < today).length;
  const overdueContent = contentItems.filter((c) => {
    if (c.status === "published") return false;
    return c.scheduledDate && new Date(c.scheduledDate) < today;
  }).length;
  const nearQuota = clients.filter((c) => {
    const extC = c as Client & { monthlyPostQuota?: number };
    const quota = extC.monthlyPostQuota ?? 30;
    const used = contentItems.filter((ci) => ci.clientId === c.id && ci.status === "published").length;
    return used / quota >= 0.8;
  }).length;

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const totalTasks = tasks.length;
  const taskPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const circumference = 2 * Math.PI * 36;
  const dashOffset = circumference - (taskPct / 100) * circumference;

  const statusGroups = ["draft","in_review","approved","scheduled","published","archived"].map((status) => ({
    status, count: filteredContent.filter((c) => c.status === status).length,
  }));
  const maxCount = Math.max(...statusGroups.map((s) => s.count), 1);

  const memberWorkload = (members ?? []).map((m: { id: string; name: string }) => ({
    name: m.name,
    count: tasks.filter((t) => (t as { assigneeId?: string }).assigneeId === m.id && t.status !== "done").length,
  })).filter((m) => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 6);
  const maxWork = Math.max(...memberWorkload.map((m) => m.count), 1);

  const recentActivities = (activities ?? []).slice(0, 5);

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
      <SectionHeader title={t("reports.title")} subtitle={t("reports.subtitle")} icon={BarChart2}
        action={<Button variant="secondary" icon={Download} onClick={handleExportCsv}>{t("reports.exportCsv")}</Button>} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {([
            { key: "today" as const, label: t("reports.today") },
            { key: "week" as const, label: t("reports.thisWeek") },
            { key: "month" as const, label: t("reports.thisMonth") },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setPeriod(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: period === key ? "var(--accent)" : "transparent", color: period === key ? "white" : "var(--text-muted)" }}>
              {label}
            </button>
          ))}
        </div>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
          <option value="all">{t("reports.filterClient")}</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <ReportWidget label={t("reports.postsPlanned")} value={postsPlanned} icon={TrendingUp} color="var(--accent)" />
        <ReportWidget label={t("reports.postsPublished")} value={postsPublished} icon={CheckCircle2} color="var(--success)" />
        <ReportWidget label={t("reports.pendingApprovals")} value={pendingApprovals} icon={Clock} color="var(--warning)" />
        <ReportWidget label={t("reports.approvedItems")} value={approvedItems} icon={CheckCircle2} color="var(--success)" />
        <ReportWidget label={t("reports.overdueTasks")} value={overdueTasks} icon={AlertTriangle} color="var(--error)" />
        <ReportWidget label={t("reports.overdueContent")} value={overdueContent} icon={AlertTriangle} color="var(--warning)" />
        <ReportWidget label={t("reports.totalContent")} value={contentItems.length} icon={CalendarDays} color="var(--accent)" />
        <ReportWidget label={t("reports.nearQuotaLimit")} value={nearQuota} sub={t("reports.clientsNearLimit")} icon={Users} color="var(--error)" />
      </div>

      {/* Middle row: Content status chart + Task ring + Team workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Content Output by Status */}
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={16} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Content by Status</p>
          </div>
          <div className="flex flex-col gap-3">
            {statusGroups.map(({ status, count }) => {
              const color = STATUS_COLORS[status] ?? "var(--accent)";
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-20 flex-shrink-0 capitalize" style={{ color: "var(--text-secondary)" }}>
                    {status.replace("_", " ")}
                  </span>
                  <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: "var(--surface-3)" }}>
                    <motion.div className="h-full rounded-lg flex items-center px-2"
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                      style={{ background: color, minWidth: count > 0 ? "24px" : "0" }}>
                      {count > 0 && <span className="text-white text-[10px] font-bold">{count}</span>}
                    </motion.div>
                  </div>
                  <span className="text-xs font-bold w-6 text-right flex-shrink-0" style={{ color: "var(--text-muted)" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task Completion Ring */}
        <div className="rounded-2xl p-5 flex flex-col" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Target size={16} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Task Completion</p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="relative w-24 h-24">
              <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                <circle cx="48" cy="48" r="36" fill="none" strokeWidth="8" stroke="var(--surface-3)" />
                <motion.circle cx="48" cy="48" r="36" fill="none" strokeWidth="8"
                  stroke="var(--success)" strokeLinecap="round"
                  strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: dashOffset }} transition={{ duration: 1, ease: "easeOut" }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{taskPct}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{doneTasks} / {totalTasks}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tasks done</p>
            </div>
          </div>

          {/* Team Workload (mini) */}
          {memberWorkload.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={13} style={{ color: "var(--warning)" }} />
                <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Active Workload</p>
              </div>
              <div className="flex flex-col gap-2">
                {memberWorkload.slice(0, 4).map((m) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <span className="text-[10px] w-16 truncate flex-shrink-0" style={{ color: "var(--text-muted)" }}>{m.name}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-3)" }}>
                      <motion.div className="h-full rounded-full" style={{ background: "var(--warning)" }}
                        initial={{ width: 0 }} animate={{ width: `${(m.count / maxWork) * 100}%` }}
                        transition={{ duration: 0.6 }} />
                    </div>
                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "var(--text-muted)" }}>{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Client breakdown + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Breakdown */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <FileText size={15} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("reports.clientReport")}</p>
          </div>
          <div style={{ background: "var(--surface-1)" }}>
            {clients.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("reports.noDataForPeriod")}</p>
              </div>
            ) : (
              clients.map((client) => (
                <ClientReportRow key={client.id}
                  client={client as Client & { monthlyPostQuota?: number }}
                  contentItems={contentItems} tasks={tasks} approvals={approvals} />
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
            <Activity size={15} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Activity</p>
          </div>
          <div style={{ background: "var(--surface-1)" }}>
            {recentActivities.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No recent activity</p>
              </div>
            ) : (
              recentActivities.map((activity: { id: string; description?: string; action?: string; createdAt?: string; timestamp?: string }, i: number) => (
                <div key={activity.id} className="flex gap-3 p-3 items-start"
                  style={{ borderBottom: i < recentActivities.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: "var(--accent-dim)" }}>
                    <Activity size={12} style={{ color: "var(--accent)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {activity.description ?? activity.action ?? "Activity"}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(activity.createdAt ?? activity.timestamp ?? "").toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
