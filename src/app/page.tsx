"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, CheckSquare, Activity, BarChart3, Plus, Zap,
  AlertCircle, ClipboardCheck, Send, FileText, TrendingUp,
  ArrowRight, Circle,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import type { ActivityType } from "@/lib/types";

// ── Stagger animation helpers ────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};

// ── Animated bar chart ───────────────────────────────────────

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_AR = ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"];

function BarChart({ data, isRTL }: { data: number[]; isRTL: boolean }) {
  const max = Math.max(...data, 1);
  const days = isRTL ? DAYS_AR : DAYS_EN;
  const peak = data.indexOf(Math.max(...data));

  return (
    <div className="flex items-end gap-1.5 h-28" style={{ direction: "ltr" }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <motion.div
            className="w-full rounded-t-lg"
            style={{
              background: i === peak
                ? "linear-gradient(180deg, var(--accent) 0%, rgba(79,142,247,0.5) 100%)"
                : "var(--glass-overlay-border)",
              minHeight: 4,
              boxShadow: i === peak ? "0 0 12px rgba(79,142,247,0.35)" : "none",
            }}
            initial={{ height: 0 }}
            animate={{ height: `${(v / max) * 100}%` }}
            transition={{ duration: 0.5, delay: i * 0.05, ease: [0.34, 1.1, 0.64, 1] }}
          />
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut chart for content status ──────────────────────────

interface DonutSegment { value: number; color: string; label: string }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const size = 80;
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        {total === 0 ? null : segments.map((seg, i) => {
          const dashArray = (seg.value / total) * circumference;
          const dashOffset = circumference - offset;
          offset += dashArray;
          return (
            <motion.circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={10}
              strokeDasharray={`${dashArray} ${circumference - dashArray}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${dashArray} ${circumference - dashArray}` }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>{total}</span>
      </div>
    </div>
  );
}

// ── Activity colors ──────────────────────────────────────────

const activityColors: Record<ActivityType, string> = {
  client_added:             "#4f8ef7",
  client_updated:           "#4f8ef7",
  client_deleted:           "#f87171",
  task_completed:           "#34d399",
  task_created:             "#34d399",
  member_joined:            "#fbbf24",
  member_removed:           "#f87171",
  report_generated:         "#8888a0",
  invite_sent:              "#4f8ef7",
  invite_cancelled:         "#f87171",
  invite_accepted:          "#34d399",
  invite_expired:           "#8888a0",
  post_approved_by_client:  "#34d399",
  post_marked_published:    "#10b981",
  publishing_failed:        "#f87171",
  client_requested_changes: "#fbbf24",
  post_rescheduled:         "#a78bfa",
  approval_submitted:       "#4f8ef7",
  content_created:          "#06b6d4",
  content_status_changed:   "#06b6d4",
  publishing_simulated:     "#8888a0",
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

function getPeakDayLabel(data: number[], isRTL: boolean): string {
  const total = data.reduce((s, v) => s + v, 0);
  if (total === 0) return "—";
  const peakIndex = data.indexOf(Math.max(...data));
  const days = isRTL ? DAYS_AR : DAYS_EN;
  return days[peakIndex] ?? "—";
}

// ── Insight chip ─────────────────────────────────────────────

function InsightChip({ icon: Icon, text, color }: { icon: typeof Circle; text: string; color: string }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
      style={{ background: `${color}18`, border: `1px solid ${color}28`, color }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Icon size={13} />
      <span>{text}</span>
    </motion.div>
  );
}

// ── Main dashboard ───────────────────────────────────────────

export default function DashboardPage() {
  const {
    tasks,
    activities,
    systemStatuses,
    totalClientCount,
    openTaskCount,
    teamMemberCount,
  } = useAppStore();
  const { t, isRTL, language } = useLanguage();
  const { approvals } = useApprovals();
  const { contentItems } = useContentItems();

  const [period, setPeriod] = useState<"week" | "month">("week");

  const hour = new Date().getHours();
  const greetingKey =
    hour < 12 ? "dashboard.greeting_morning"
    : hour < 17 ? "dashboard.greeting_afternoon"
    : "dashboard.greeting_evening";
  const today = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  // ── Task chart data ────────────────────────────────────────
  const { weekData, monthData } = useMemo(() => {
    const doneTasks = tasks.filter((t) => t.status === "done" && t.completedAt);
    const monday = getMondayOf(new Date());
    const weekCounts = [0, 0, 0, 0, 0, 0, 0];
    doneTasks.forEach((t) => {
      const offset = Math.floor(
        (new Date(t.completedAt!).getTime() - monday.getTime()) / 86_400_000
      );
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

  // ── Content status breakdown ────────────────────────────────
  const DRAFT_STATUSES = ["draft", "idea", "copywriting", "design"] as const;
  const contentStats = useMemo(() => {
    const published   = contentItems.filter((c) => c.status === "published").length;
    const scheduled   = contentItems.filter((c) => c.status === "scheduled" || c.status === "publishing_ready").length;
    const inReview    = contentItems.filter((c) => c.status === "client_review" || c.status === "internal_review").length;
    const drafts      = contentItems.filter((c) => (DRAFT_STATUSES as readonly string[]).includes(c.status)).length;
    const total       = contentItems.length;
    return { published, scheduled, inReview, drafts, total };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentItems]);

  const donutSegments = [
    { value: contentStats.published,  color: "#34d399", label: "Published" },
    { value: contentStats.scheduled,  color: "#4f8ef7", label: "Scheduled" },
    { value: contentStats.inReview,   color: "#fbbf24", label: "In Review" },
    { value: contentStats.drafts,     color: "#8888a0", label: "Drafts" },
  ];

  // ── Recent activities ──────────────────────────────────────
  const recentActivities = useMemo(
    () =>
      [...activities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 6),
    [activities]
  );

  // ── System status ──────────────────────────────────────────
  const degradedCount = systemStatuses.filter((s) => s.status !== "operational").length;
  const pendingApprovals = approvals.filter(
    (a) => a.status === "pending_internal" || a.status === "pending_client"
  ).length;

  // ── Insights ───────────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: typeof Circle; text: string; color: string }[] = [];
    if (pendingApprovals > 0) {
      list.push({
        icon: ClipboardCheck,
        text: `${pendingApprovals} ${pendingApprovals > 1 ? t("dashboard.insightPendingApprovals") : t("dashboard.insightPendingApproval")}`,
        color: "#fbbf24",
      });
    }
    if (contentStats.inReview > 0) {
      list.push({ icon: FileText, text: `${contentStats.inReview} ${t("dashboard.insightContentInReview")}`, color: "#06b6d4" });
    }
    if (openTaskCount > 0) {
      list.push({
        icon: CheckSquare,
        text: `${openTaskCount} ${openTaskCount > 1 ? t("dashboard.insightOpenTasks") : t("dashboard.insightOpenTask")}`,
        color: "#4f8ef7",
      });
    }
    if (degradedCount > 0) {
      list.push({
        icon: AlertCircle,
        text: `${degradedCount} ${degradedCount > 1 ? t("dashboard.insightServicesDegraded") : t("dashboard.insightServiceDegraded")}`,
        color: "#f87171",
      });
    }
    if (list.length === 0) {
      list.push({ icon: TrendingUp, text: t("dashboard.insightAllHealthy"), color: "#34d399" });
    }
    return list;
  }, [pendingApprovals, contentStats.inReview, openTaskCount, degradedCount, t]);

  // ── Quick actions ──────────────────────────────────────────
  const quickActions = [
    { label: t("dashboard.newClient"),    href: "/clients",   icon: Users },
    { label: t("dashboard.newTask"),      href: "/tasks",     icon: CheckSquare },
    { label: t("dashboard.inviteMember"), href: "/team",      icon: Plus },
    { label: t("dashboard.viewReports"),  href: "/reports",   icon: BarChart3 },
    { label: t("nav.approvals"),          href: "/approvals", icon: ClipboardCheck },
    { label: t("dashboard.settingsLink"), href: "/settings",  icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="pt-2"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1
          className="text-3xl font-bold tracking-tight mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          {t(greetingKey)}.
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {today}
          {systemStatuses.length > 0
            ? ` · ${degradedCount === 0 ? t("dashboard.allOperational") : `${degradedCount} ${degradedCount > 1 ? t("dashboard.servicesDegraded") : t("dashboard.serviceDegraded")}`}`
            : ""}
        </p>
        {/* Insights row */}
        {insights.length > 0 && (
          <motion.div
            className="flex flex-wrap gap-2 mt-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {insights.map((ins, i) => (
              <motion.div key={i} variants={itemVariants}>
                <InsightChip icon={ins.icon} text={ins.text} color={ins.color} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {[
          { label: t("dashboard.totalClients"),    value: totalClientCount,  icon: Users,          change: `+${totalClientCount}`,  positive: true,  accent: true },
          { label: t("dashboard.openTasks"),        value: openTaskCount,     icon: CheckSquare,    change: `${openTaskCount}`,      positive: openTaskCount === 0 },
          { label: t("dashboard.pendingApprovals"), value: pendingApprovals,  icon: ClipboardCheck, change: `${pendingApprovals}`,   positive: pendingApprovals === 0 },
          { label: t("dashboard.teamMembers"),      value: teamMemberCount,   icon: Activity,       change: `+${teamMemberCount}`,   positive: true },
        ].map((card) => (
          <motion.div key={card.label} variants={itemVariants}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Task activity bar chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("dashboard.activityOverview")}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t("dashboard.tasksCompletedThis")}{" "}
                  {period === "week" ? t("dashboard.week").toLowerCase() : t("dashboard.month").toLowerCase()}
                </p>
              </div>
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
                {(["week", "month"] as const).map((p) => (
                  <motion.button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className="px-3 py-1 rounded-lg text-xs font-medium"
                    style={{
                      background: period === p ? "var(--surface-1)" : "transparent",
                      color: period === p ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {p === "week" ? t("dashboard.week") : t("dashboard.month")}
                  </motion.button>
                ))}
              </div>
            </div>
            <BarChart data={chartData} isRTL={isRTL} />
            <div
              className="mt-4 pt-4 flex items-center gap-6"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {[
                { label: `${t("dashboard.totalThis")} ${period === "week" ? t("dashboard.week").toLowerCase() : t("dashboard.month").toLowerCase()}`, value: chartTotal },
                { label: t("dashboard.avgPerDay"),  value: chartAvg },
                { label: t("dashboard.peakDay"),    value: peakDayLabel, accent: true },
              ].map(({ label, value, accent }) => (
                <div key={label}>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p
                    className="text-lg font-bold mt-0.5"
                    style={{ color: accent ? "var(--accent)" : "var(--text-primary)" }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Recent activity */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              {t("dashboard.recentActivity")}
            </p>
            {recentActivities.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                {t("dashboard.noActivity")}
              </p>
            ) : (
              <motion.div
                className="space-y-0"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {recentActivities.map((item, i) => (
                  <motion.div
                    key={item.id}
                    variants={itemVariants}
                    className="flex items-start gap-3 py-2.5"
                    style={{
                      borderBottom:
                        i < recentActivities.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: activityColors[item.type] ?? "#8888a0" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs font-medium leading-tight"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {item.message}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {item.detail}
                      </p>
                    </div>
                    <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {relativeTime(item.timestamp, t)}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* Content status + Quick actions */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Content breakdown donut */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {t("dashboard.contentOverview")}
              </p>
              <Link
                href="/content"
                className="flex items-center gap-1 text-xs"
                style={{ color: "var(--accent)" }}
              >
                {t("dashboard.viewAll")} <ArrowRight size={12} />
              </Link>
            </div>
            <div className="flex items-center gap-6">
              <DonutChart segments={donutSegments} total={contentStats.total} />
              <div className="flex-1 space-y-2">
                {donutSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {seg.label}
                      </span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      {seg.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Quick actions */}
        <motion.div variants={itemVariants}>
          <Card>
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              {t("dashboard.quickActions")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(({ label, href, icon: Icon }) => (
                <motion.div
                  key={label}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-full"
                    style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                  >
                    <Icon size={14} style={{ color: "var(--accent)" }} />
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {label}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* System status + Pending metrics */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* System status */}
        <motion.div variants={itemVariants}>
          <Card>
            <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              {t("dashboard.systemStatus")}
            </p>
            {systemStatuses.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                {t("dashboard.noStatusData")}
              </p>
            ) : (
              <div className="space-y-3">
                {systemStatuses.map(({ name, status, latency }) => {
                  const ok = status === "operational";
                  const warn = status === "degraded";
                  return (
                    <div key={name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <motion.div
                          className="w-2 h-2 rounded-full"
                          style={{ background: ok ? "var(--success)" : warn ? "var(--warning)" : "var(--error)" }}
                          animate={ok ? {} : { scale: [1, 1.4, 1] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {name}
                        </span>
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
            <div className="mt-4 pt-4 flex items-center gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <AlertCircle size={13} style={{ color: degradedCount > 0 ? "var(--warning)" : "var(--success)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {degradedCount === 0 && systemStatuses.length > 0
                  ? t("dashboard.allServicesOperational")
                  : systemStatuses.length === 0
                  ? t("dashboard.noStatusDataAvail")
                  : `${degradedCount} ${degradedCount > 1 ? t("dashboard.servicesDegraded") : t("dashboard.serviceDegraded")} ${t("dashboard.lastCheck")}`}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Pending actions */}
        <motion.div variants={itemVariants} className="grid grid-rows-2 gap-4">
          <motion.div whileHover={{ scale: 1.01, y: -1 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Link
              href="/approvals"
              className="rounded-2xl p-5 flex items-center gap-4 h-full"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#f59e0b20" }}
              >
                <ClipboardCheck size={20} style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {pendingApprovals}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t("nav.approvals")} — Pending
                </p>
              </div>
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.01, y: -1 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Link
              href="/publishing"
              className="rounded-2xl p-5 flex items-center gap-4 h-full"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#4f8ef720" }}
              >
                <Send size={20} style={{ color: "#4f8ef7" }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {contentStats.scheduled}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t("nav.publishing")} — Scheduled
                </p>
              </div>
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
