"use client";
import { useMemo, useState } from "react";
import { Users, FolderOpen, CheckSquare, Activity, BarChart3, Plus, Zap, AlertCircle, Megaphone, ClipboardCheck } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useCampaigns } from "@/lib/CampaignContext";
import { useApprovals } from "@/lib/ApprovalContext";
import type { ActivityType } from "@/lib/types";

function MiniChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data) || 1;
  const { t } = useLanguage();
  const days = [
    t("common.justNow").slice(0, 1) === "ا"
      ? ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ][0];
  const peak = data.indexOf(Math.max(...data));
  return (
    <div>
      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{label}</p>
      <div className="flex items-end gap-1.5 h-24">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${(v / max) * 80}px`,
                background: i === peak ? "var(--accent)" : "var(--surface-4)",
                minHeight: "4px",
              }}
            />
            <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const activityColors: Record<ActivityType, string> = {
  client_added:     "#4f8ef7",
  client_updated:   "#4f8ef7",
  client_deleted:   "#f87171",
  task_completed:   "#34d399",
  task_created:     "#34d399",
  project_created:  "#a78bfa",
  project_updated:  "#a78bfa",
  project_deleted:  "#f87171",
  member_joined:    "#fbbf24",
  member_removed:   "#f87171",
  report_generated: "#8888a0",
  invite_sent:      "#4f8ef7",
  invite_cancelled: "#f87171",
  invite_accepted:  "#34d399",
  invite_expired:   "#8888a0",
};

function relativeTime(iso: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("common.justNow");
  if (mins < 60) return `${mins}${t("common.minAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("common.hrAgo")}`;
  return `${Math.floor(hrs / 24)}${t("common.dayAgo")}`;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_AR = ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"];

function getPeakDayLabel(data: number[], isRTL: boolean): string {
  const total = data.reduce((s, v) => s + v, 0);
  if (total === 0) return "—";
  const peakIndex = data.indexOf(Math.max(...data));
  const days = isRTL ? DAYS_AR : DAYS_EN;
  return days[peakIndex] ?? "—";
}

function systemStatusMessage(degraded: number, hasStatuses: boolean, t: (k: string) => string): string {
  if (!hasStatuses) return t("dashboard.noStatusDataAvail");
  if (degraded === 0) return t("dashboard.allServicesOperational");
  return `${degraded} ${degraded > 1 ? t("dashboard.servicesDegraded") : t("dashboard.serviceDegraded")} ${t("dashboard.lastCheck")}`;
}

export default function DashboardPage() {
  const {
    tasks,
    activities,
    systemStatuses,
    activeProjectCount,
    totalClientCount,
    openTaskCount,
    teamMemberCount,
  } = useAppStore();
  const { t, isRTL, language } = useLanguage();
  const { campaigns } = useCampaigns();
  const { approvals } = useApprovals();

  const [period, setPeriod] = useState<"week" | "month">("week");

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "dashboard.greeting_morning" : hour < 17 ? "dashboard.greeting_afternoon" : "dashboard.greeting_evening";
  const today = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { weekday: "long", month: "long", day: "numeric" });

  const { weekData, monthData } = useMemo(() => {
    const doneTasks = tasks.filter((t) => t.status === "done" && t.completedAt);
    const monday = getMondayOf(new Date());
    const weekCounts = [0, 0, 0, 0, 0, 0, 0];
    doneTasks.forEach((t) => {
      const offset = Math.floor((new Date(t.completedAt!).getTime() - monday.getTime()) / 86_400_000);
      if (offset >= 0 && offset < 7) weekCounts[offset]++;
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 27);
    cutoff.setHours(0, 0, 0, 0);
    const monthCounts = [0, 0, 0, 0, 0, 0, 0];
    doneTasks.forEach((t) => {
      const d = new Date(t.completedAt!);
      if (d >= cutoff) monthCounts[(d.getDay() + 6) % 7]++;
    });
    return { weekData: weekCounts, monthData: monthCounts };
  }, [tasks]);

  const chartData = period === "week" ? weekData : monthData;
  const chartTotal = chartData.reduce((s, v) => s + v, 0);
  const chartAvg = chartTotal ? (chartTotal / 7).toFixed(1) : "0";
  const peakDayLabel = getPeakDayLabel(chartData, isRTL);

  const recentActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5),
    [activities]
  );

  const degradedCount = systemStatuses.filter((s) => s.status !== "operational").length;

  const quickActions = [
    { label: t("dashboard.newClient"),    href: "/clients",  icon: Users },
    { label: t("dashboard.newProject"),   href: "/projects", icon: FolderOpen },
    { label: t("dashboard.newTask"),      href: "/tasks",    icon: CheckSquare },
    { label: t("dashboard.inviteMember"), href: "/team",     icon: Plus },
    { label: t("dashboard.viewReports"),  href: "/projects", icon: BarChart3 },
    { label: t("dashboard.settingsLink"), href: "/settings", icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
          {t(greetingKey)}.
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {today}{systemStatuses.length > 0 ? ` · ${degradedCount === 0 ? t("dashboard.allOperational") : `${degradedCount} ${degradedCount > 1 ? t("dashboard.servicesDegraded") : t("dashboard.serviceDegraded")}`}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label={t("dashboard.activeProjects")} value={activeProjectCount} icon={FolderOpen} change={`+${activeProjectCount}`} positive accent />
        <StatCard label={t("dashboard.totalClients")}   value={totalClientCount}   icon={Users}       change={`+${totalClientCount}`}   positive />
        <StatCard label={t("dashboard.openTasks")}      value={openTaskCount}      icon={CheckSquare} change={openTaskCount > 0 ? `${openTaskCount}` : "0"} positive={openTaskCount === 0} />
        <StatCard label={t("dashboard.teamMembers")}    value={teamMemberCount}    icon={Activity}    change={`+${teamMemberCount}`}    positive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("dashboard.activityOverview")}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t("dashboard.tasksCompletedThis")} {period === "week" ? t("dashboard.week").toLowerCase() : t("dashboard.month").toLowerCase()}</p>
            </div>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
              {(["week", "month"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: period === p ? "var(--surface-1)" : "transparent",
                    color: period === p ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {p === "week" ? t("dashboard.week") : t("dashboard.month")}
                </button>
              ))}
            </div>
          </div>
          <MiniChart data={chartData} label={t("dashboard.completedTasks")} />
          <div className="mt-4 pt-4 flex items-center gap-6" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.totalThis")} {period === "week" ? t("dashboard.week").toLowerCase() : t("dashboard.month").toLowerCase()}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{chartTotal}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.avgPerDay")}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{chartAvg}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.peakDay")}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--accent)" }}>{peakDayLabel}</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{t("dashboard.recentActivity")}</p>
          {recentActivities.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>{t("dashboard.noActivity")}</p>
          ) : (
            <div className="space-y-0">
              {recentActivities.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 py-3"
                  style={{ borderBottom: i < recentActivities.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: activityColors[item.type] ?? "#8888a0" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-tight" style={{ color: "var(--text-primary)" }}>{item.message}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{item.detail}</p>
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    {relativeTime(item.timestamp, t)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{t("dashboard.quickActions")}</p>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
              >
                <Icon size={14} style={{ color: "var(--accent)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>{t("dashboard.systemStatus")}</p>
          {systemStatuses.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>{t("dashboard.noStatusData")}</p>
          ) : (
            <div className="space-y-3">
              {systemStatuses.map(({ name, status, latency }) => {
                const ok = status === "operational";
                const warn = status === "degraded";
                return (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: ok ? "var(--success)" : warn ? "var(--warning)" : "var(--error)" }} />
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{latency}</span>
                      <Badge
                        label={ok ? t("status.operational") : warn ? t("status.degraded") : t("status.down")}
                        color={ok ? "green" : warn ? "yellow" : "red"}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={13} style={{ color: degradedCount > 0 ? "var(--warning)" : "var(--success)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {systemStatusMessage(degradedCount, systemStatuses.length > 0, t)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Marketing widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/campaigns"
          className="rounded-2xl p-5 flex items-center gap-4 transition-all hover:scale-[1.01]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#3b82f620" }}>
            <Megaphone size={20} style={{ color: "#3b82f6" }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {campaigns.filter((c) => c.status === "active").length}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t("nav.campaigns")} — Active</p>
          </div>
        </Link>

        <Link
          href="/approvals"
          className="rounded-2xl p-5 flex items-center gap-4 transition-all hover:scale-[1.01]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f59e0b20" }}>
            <ClipboardCheck size={20} style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {approvals.filter((a) => a.status === "pending_internal" || a.status === "pending_client").length}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{t("nav.approvals")} — Pending</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

