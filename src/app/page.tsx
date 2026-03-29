"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, CheckSquare, ClipboardCheck, FileText,
  ArrowRight, Plus, Calendar, Zap, UserPlus,
  TrendingUp, Clock,
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

// ── Animation helpers ─────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};

// ── Bar chart ────────────────────────────────────────────────

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_AR = ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"];

function BarChart({ data, isRTL }: { data: number[]; isRTL: boolean }) {
  const max = Math.max(...data, 1);
  const days = isRTL ? DAYS_AR : DAYS_EN;
  const peak = data.indexOf(Math.max(...data));

  return (
    <div className="flex items-end gap-2 h-32" style={{ direction: "ltr" }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <motion.div
            className="w-full rounded-t-lg"
            style={{
              background: i === peak
                ? "linear-gradient(180deg, var(--accent) 0%, rgba(79,142,247,0.4) 100%)"
                : "rgba(255,255,255,0.07)",
              minHeight: 4,
              boxShadow: i === peak ? "0 0 14px rgba(79,142,247,0.4)" : "none",
            }}
            initial={{ height: 0 }}
            animate={{ height: `${(v / max) * 100}%` }}
            transition={{ duration: 0.55, delay: i * 0.05, ease: [0.34, 1.1, 0.64, 1] }}
          />
          <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Donut chart ──────────────────────────────────────────────

interface DonutSegment { value: number; color: string; label: string }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const size = 96;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={11} />
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
              strokeWidth={11}
              strokeDasharray={`${dashArray} ${circumference - dashArray}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${dashArray} ${circumference - dashArray}` }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold leading-none" style={{ color: "var(--text-primary)" }}>{total}</span>
        <span className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>total</span>
      </div>
    </div>
  );
}

// ── Activity color map ────────────────────────────────────────

const activityColors: Record<ActivityType, string> = {
  client_added:             "#4f8ef7",
  client_updated:           "#4f8ef7",
  client_deleted:           "#f87171",
  task_completed:           "#34d399",
  task_created:             "#a78bfa",
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

// ── Utility helpers ───────────────────────────────────────────

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

function formatDueDate(iso: string): string {
  if (!iso || iso === "TBD") return "TBD";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function priorityColor(p: string): "red" | "yellow" | "blue" | "gray" {
  if (p === "high") return "red";
  if (p === "medium") return "yellow";
  if (p === "low") return "blue";
  return "gray";
}

// ── Content pipeline statuses ─────────────────────────────────

const PIPELINE_STAGES: { key: string; label: string; color: string }[] = [
  { key: "idea",            label: "Idea",      color: "#8888a0" },
  { key: "draft",           label: "Draft",     color: "#a78bfa" },
  { key: "copywriting",     label: "Writing",   color: "#4f8ef7" },
  { key: "design",          label: "Design",    color: "#06b6d4" },
  { key: "internal_review", label: "Review",    color: "#fbbf24" },
  { key: "approved",        label: "Approved",  color: "#34d399" },
  { key: "scheduled",       label: "Scheduled", color: "#10b981" },
  { key: "published",       label: "Published", color: "#22c55e" },
];

// ── Main dashboard ───────────────────────────────────────────

export default function DashboardPage() {
  const {
    clients,
    tasks,
    members,
    activities,
    openTaskCount,
  } = useAppStore();
  const { t, isRTL, language } = useLanguage();
  const { approvals } = useApprovals();
  const { contentItems } = useContentItems();

  const [period, setPeriod] = useState<"week" | "month">("week");

  // ── Greeting ───────────────────────────────────────────────
  const hour = new Date().getHours();
  const greetingEmoji = hour < 12 ? "☀️" : hour < 17 ? "🌤️" : "🌙";
  const greetingKey =
    hour < 12 ? "dashboard.greeting_morning"
    : hour < 17 ? "dashboard.greeting_afternoon"
    : "dashboard.greeting_evening";
  const today = new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // ── KPI derived data ───────────────────────────────────────
  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === "pending_internal" || a.status === "pending_client"),
    [approvals],
  );

  // ── Task chart data ────────────────────────────────────────
  const { weekData, monthData } = useMemo(() => {
    const doneTasks = tasks.filter((task) => task.status === "done" && task.completedAt);
    const monday = getMondayOf(new Date());
    const weekCounts = [0, 0, 0, 0, 0, 0, 0];
    doneTasks.forEach((task) => {
      const offset = Math.floor(
        (new Date(task.completedAt!).getTime() - monday.getTime()) / 86_400_000,
      );
      if (offset >= 0 && offset < 7) weekCounts[offset]++;
    });
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 27);
    cutoff.setHours(0, 0, 0, 0);
    const monthCounts = [0, 0, 0, 0, 0, 0, 0];
    doneTasks.forEach((task) => {
      const d = new Date(task.completedAt!);
      if (d >= cutoff) monthCounts[(d.getDay() + 6) % 7]++;
    });
    return { weekData: weekCounts, monthData: monthCounts };
  }, [tasks]);

  const chartData = period === "week" ? weekData : monthData;
  const chartTotal = chartData.reduce((s, v) => s + v, 0);
  const chartAvg = chartTotal ? (chartTotal / 7).toFixed(1) : "0";
  const peakDayLabel = getPeakDayLabel(chartData, isRTL);

  // ── Content stats ──────────────────────────────────────────
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
    { value: contentStats.published, color: "#34d399", label: "Published" },
    { value: contentStats.scheduled, color: "#4f8ef7", label: "Scheduled" },
    { value: contentStats.inReview,  color: "#fbbf24", label: "In Review" },
    { value: contentStats.drafts,    color: "#8888a0", label: "Drafts"    },
  ];

  // ── Pipeline stage counts ──────────────────────────────────
  const pipelineCounts = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => ({
      ...stage,
      count: contentItems.filter((c) => c.status === stage.key).length,
    }));
  }, [contentItems]);

  const pipelineTotal = pipelineCounts.reduce((s, s2) => s + s2.count, 0);

  // ── Recent activities ──────────────────────────────────────
  const recentActivities = useMemo(
    () =>
      [...activities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8),
    [activities],
  );

  // ── Upcoming tasks (sorted by dueDate, open only) ─────────
  const upcomingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "done" && task.dueDate && task.dueDate !== "TBD")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5),
    [tasks],
  );

  // ── Approval queue ─────────────────────────────────────────
  const approvalQueue = useMemo(() => pendingApprovals.slice(0, 4), [pendingApprovals]);

  // ── This week's scheduled content ─────────────────────────
  const thisWeekContent = useMemo(() => {
    const now = new Date();
    const monday = getMondayOf(now);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return contentItems
      .filter((c) => {
        if (!c.scheduledDate) return false;
        const d = new Date(c.scheduledDate);
        return d >= monday && d <= sunday;
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 5);
  }, [contentItems]);

  // ── Team workload ──────────────────────────────────────────
  const teamWorkload = useMemo(() => {
    return members.map((member) => {
      const count = tasks.filter(
        (task) => task.status !== "done" && (task.assigneeId === member.id || task.assignedTo === member.id),
      ).length;
      return { ...member, taskCount: count };
    }).sort((a, b) => b.taskCount - a.taskCount);
  }, [members, tasks]);

  const maxWorkload = Math.max(...teamWorkload.map((m) => m.taskCount), 1);

  // ── Client name lookup ─────────────────────────────────────
  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients],
  );

  // ── Content item lookup ────────────────────────────────────
  const contentMap = useMemo(
    () => Object.fromEntries(contentItems.map((c) => [c.id, c.title])),
    [contentItems],
  );

  return (
    <div className="space-y-6 pb-8">
      {/* ── Page Header ───────────────────────────────────────── */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pt-2"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
            {greetingEmoji} {t(greetingKey)}, Alex.
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Here&apos;s what&apos;s happening in your workspace today.
          </p>
          <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>
            {today}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/content"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "rgba(79,142,247,0.15)",
              border: "1px solid rgba(79,142,247,0.3)",
              color: "var(--accent)",
            }}
          >
            <Plus size={14} /> New Content
          </Link>
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <Plus size={14} /> New Task
          </Link>
        </div>
      </motion.div>

      {/* ── KPI Stats Row ─────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {[
          {
            label: t("dashboard.totalClients"),
            value: clients.length,
            icon: Users,
            change: `+${clients.length}`,
            positive: true,
            accent: true,
          },
          {
            label: t("dashboard.openTasks"),
            value: openTaskCount,
            icon: CheckSquare,
            change: `${openTaskCount}`,
            positive: openTaskCount === 0,
          },
          {
            label: t("dashboard.pendingApprovals"),
            value: pendingApprovals.length,
            icon: ClipboardCheck,
            change: `${pendingApprovals.length}`,
            positive: pendingApprovals.length === 0,
          },
          {
            label: "Total Content",
            value: contentStats.total,
            icon: FileText,
            change: `${contentStats.total}`,
            positive: true,
          },
        ].map((card) => (
          <motion.div key={card.label} variants={itemVariants}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </motion.div>

      {/* ── Main two-column layout ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* ── LEFT COLUMN (3/5) ──────────────────────────────── */}
        <motion.div
          className="xl:col-span-3 space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >

          {/* Content Pipeline */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Content Pipeline
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {pipelineTotal} items across all stages
                  </p>
                </div>
                <Link
                  href="/content"
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  View all <ArrowRight size={11} />
                </Link>
              </div>

              {pipelineTotal === 0 ? (
                <div className="py-6 text-center">
                  <FileText size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No content items yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-px">
                    {pipelineCounts.filter((s) => s.count > 0).map((stage) => (
                      <motion.div
                        key={stage.key}
                        title={`${stage.label}: ${stage.count}`}
                        style={{ background: stage.color, flexBasis: `${(stage.count / pipelineTotal) * 100}%` }}
                        initial={{ scaleX: 0, originX: isRTL ? 1 : 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.6, delay: 0.1, ease: [0.34, 1.1, 0.64, 1] }}
                      />
                    ))}
                  </div>
                  {/* Labels row */}
                  <div className="grid grid-cols-4 gap-2">
                    {pipelineCounts.filter((s) => s.count > 0).slice(0, 8).map((stage) => (
                      <div key={stage.key} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                        <span className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>
                          {stage.label}
                        </span>
                        <span className="text-[10px] font-semibold ml-auto" style={{ color: "var(--text-primary)" }}>
                          {stage.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Task Activity Chart */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {t("dashboard.activityOverview")}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Tasks completed this{" "}
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
                  { label: `Total this ${period}`, value: chartTotal },
                  { label: t("dashboard.avgPerDay"),  value: chartAvg },
                  { label: t("dashboard.peakDay"),    value: peakDayLabel, accent: true },
                ].map(({ label, value, accent }) => (
                  <div key={label}>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</p>
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

          {/* Recent Activity Feed */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("dashboard.recentActivity")}
                </p>
                <Link
                  href="/activities"
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  View all <ArrowRight size={11} />
                </Link>
              </div>

              {recentActivities.length === 0 ? (
                <div className="py-8 text-center">
                  <TrendingUp size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    No activity yet — things will show up here as your team works.
                  </p>
                </div>
              ) : (
                <motion.div className="space-y-0" variants={containerVariants} initial="hidden" animate="show">
                  {recentActivities.map((item, i) => (
                    <motion.div
                      key={item.id}
                      variants={itemVariants}
                      className="flex items-start gap-3 py-2.5"
                      style={{
                        borderBottom: i < recentActivities.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                        style={{ background: `${activityColors[item.type] ?? "#8888a0"}20` }}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: activityColors[item.type] ?? "#8888a0" }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-tight" style={{ color: "var(--text-primary)" }}>
                          {item.message}
                        </p>
                        {item.detail && (
                          <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            {item.detail}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] flex-shrink-0 pt-0.5" style={{ color: "var(--text-muted)" }}>
                        {relativeTime(item.timestamp, t)}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </Card>
          </motion.div>
        </motion.div>

        {/* ── RIGHT COLUMN (2/5) ─────────────────────────────── */}
        <motion.div
          className="xl:col-span-2 space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >

          {/* Upcoming Tasks */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(167,139,250,0.15)" }}>
                    <Clock size={14} style={{ color: "#a78bfa" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Upcoming Tasks</p>
                </div>
                <Link href="/tasks" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                  All <ArrowRight size={11} />
                </Link>
              </div>

              {upcomingTasks.length === 0 ? (
                <div className="py-6 text-center">
                  <CheckSquare size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No upcoming tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl"
                      style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5"
                        style={{ borderColor: "var(--border-strong)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-snug truncate" style={{ color: "var(--text-primary)" }}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {clientMap[task.clientId ?? ""] && (
                            <span className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                              {clientMap[task.clientId ?? ""]}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>·</span>
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {formatDueDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                      <Badge label={task.priority} color={priorityColor(task.priority)} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Approval Queue */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(251,191,36,0.15)" }}>
                    <ClipboardCheck size={14} style={{ color: "#fbbf24" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Approval Queue</p>
                </div>
                <Link href="/approvals" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                  All <ArrowRight size={11} />
                </Link>
              </div>

              {approvalQueue.length === 0 ? (
                <div className="py-6 text-center">
                  <ClipboardCheck size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>No pending approvals 🎉</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {approvalQueue.map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl"
                      style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center"
                        style={{ background: "rgba(251,191,36,0.15)" }}
                      >
                        <ClipboardCheck size={12} style={{ color: "#fbbf24" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {contentMap[approval.contentItemId] ?? "Content item"}
                        </p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {clientMap[approval.clientId] ?? "Unknown client"}
                        </p>
                      </div>
                      <Badge
                        label={approval.status === "pending_internal" ? "Internal" : "Client"}
                        color={approval.status === "pending_internal" ? "blue" : "yellow"}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Content Calendar Preview */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(6,182,212,0.15)" }}>
                    <Calendar size={14} style={{ color: "#06b6d4" }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>This Week</p>
                </div>
                <Link href="/content" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                  Calendar <ArrowRight size={11} />
                </Link>
              </div>

              {thisWeekContent.length === 0 ? (
                <div className="py-6 text-center">
                  <Calendar size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nothing scheduled this week</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {thisWeekContent.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl"
                      style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: "rgba(6,182,212,0.15)", color: "#06b6d4" }}
                      >
                        {item.platform.slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {item.title}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {item.platform} · {formatDueDate(item.scheduledDate)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Quick Actions Panel */}
          <motion.div variants={itemVariants}>
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(79,142,247,0.15)" }}>
                  <Zap size={14} style={{ color: "var(--accent)" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("dashboard.quickActions")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "New Client",    href: "/clients",   icon: Users,         color: "#4f8ef7" },
                  { label: "New Content",   href: "/content",   icon: FileText,      color: "#06b6d4" },
                  { label: "New Task",      href: "/tasks",     icon: CheckSquare,   color: "#a78bfa" },
                  { label: "Invite Member", href: "/team",      icon: UserPlus,      color: "#34d399" },
                ].map(({ label, href, icon: Icon, color }) => (
                  <motion.div
                    key={label}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Link
                      href={href}
                      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl w-full text-center"
                      style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon size={14} style={{ color }} />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>
                        {label}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Bottom Row ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Team Workload */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(251,191,36,0.15)" }}>
                  <Users size={14} style={{ color: "#fbbf24" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Team Workload</p>
              </div>
              <Link href="/team" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                All <ArrowRight size={11} />
              </Link>
            </div>

            {teamWorkload.length === 0 ? (
              <div className="py-6 text-center">
                <Users size={24} className="mx-auto mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No team members yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamWorkload.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                      style={{ background: member.color ?? "var(--accent)", color: "#fff" }}
                    >
                      {member.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {member.name}
                        </p>
                        <span className="text-[10px] font-semibold flex-shrink-0 ml-2" style={{ color: "var(--text-muted)" }}>
                          {member.taskCount} tasks
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-4)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: member.color ?? "var(--accent)" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(member.taskCount / maxWorkload) * 100}%` }}
                          transition={{ duration: 0.6, ease: [0.34, 1.1, 0.64, 1] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Content Status Donut */}
        <motion.div variants={itemVariants}>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(52,211,153,0.15)" }}>
                  <FileText size={14} style={{ color: "#34d399" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("dashboard.contentOverview")}
                </p>
              </div>
              <Link href="/content" className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                {t("dashboard.viewAll")} <ArrowRight size={11} />
              </Link>
            </div>
            <div className="flex items-center gap-6">
              <DonutChart segments={donutSegments} total={contentStats.total} />
              <div className="flex-1 space-y-2.5">
                {donutSegments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: seg.color }} />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{seg.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: contentStats.total > 0 ? `${Math.max((seg.value / contentStats.total) * 60, 4)}px` : "4px",
                          background: seg.color,
                          opacity: 0.5,
                        }}
                      />
                      <span className="text-xs font-semibold w-5 text-right" style={{ color: "var(--text-primary)" }}>
                        {seg.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
