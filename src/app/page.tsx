"use client";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, CheckSquare, BarChart3,
  ClipboardCheck, FileText, TrendingUp,
  Circle, Calendar, ChevronRight, Layers, Activity,
  ArrowRight, Plus, Zap, UserPlus, Clock,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import type { ActivityType, ContentPlatform } from "@/lib/types";

// ── Animation helpers ─────────────────────────────────────────

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 380, damping: 30 } },
};

// ── Day labels / Bar chart ────────────────────────────────────

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_AR = ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"];

// ── Animated bar chart ───────────────────────────────────────

function BarChart({ data, isRTL }: { data: number[]; isRTL: boolean }) {
  const max = Math.max(...data, 1);
  const days = isRTL ? DAYS_AR : DAYS_EN;
  const peak = data.indexOf(Math.max(...data));

  return (
    <div className="flex items-end gap-2 h-32" style={{ direction: "ltr" }}>
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full relative flex items-end" style={{ height: "100px" }}>
            <motion.div
              className="w-full rounded-t-md"
              style={{
                background: i === peak
                  ? "linear-gradient(180deg, var(--accent) 0%, rgba(79,142,247,0.45) 100%)"
                  : "rgba(255,255,255,0.07)",
                minHeight: 4,
                boxShadow: i === peak ? "0 0 14px rgba(79,142,247,0.4)" : "none",
              }}
              initial={{ height: 0 }}
              animate={{ height: `${(v / max) * 100}%` }}
              transition={{ duration: 0.55, delay: i * 0.05, ease: [0.34, 1.1, 0.64, 1] }}
            />
          </div>
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{days[i]}</span>
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

// ── Donut / ring chart ───────────────────────────────────────
// ── Donut chart ──────────────────────────────────────────────

interface DonutSegment { value: number; color: string; label: string }

function DonutChart({ segments, total }: { segments: DonutSegment[]; total: number }) {
  const size = 96;
  const radius = 36;
  const strokeWidth = 11;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={11} />
        {total === 0 ? null : segments.map((seg, i) => {
          if (seg.value === 0) return null;
          const dashArray = (seg.value / total) * circumference;
          const dashOffset = circumference - offset;
          offset += dashArray;
          return (
            <motion.circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeWidth={11}
              strokeDasharray={`${dashArray} ${circumference - dashArray}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${dashArray} ${circumference - dashArray}` }}
              transition={{ duration: 0.75, delay: i * 0.12, ease: "easeOut" }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: "easeOut" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{total}</span>
        <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>items</span>
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

// ── Platform colour badge ────────────────────────────────────

const PLATFORM_COLORS: Partial<Record<ContentPlatform, string>> = {
  Instagram:  "#e1306c",
  Facebook:   "#1877f2",
  YouTube:    "#ff0000",
  LinkedIn:   "#0a66c2",
  X:          "#1da1f2",
  TikTok:     "#69c9d0",
  Snapchat:   "#fbbf24",
};

function PlatformDot({ platform }: { platform: ContentPlatform }) {
  const color = PLATFORM_COLORS[platform] ?? "var(--text-secondary)";
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {platform[0]}
    </span>
  );
}

// ── Relative time ────────────────────────────────────────────
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

// ── Date helpers ─────────────────────────────────────────────

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

function formatScheduledDate(dateStr: string, timeStr: string, language: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(`${dateStr}${timeStr ? "T" + timeStr : ""}`);
    return d.toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

// ── Section header ───────────────────────────────────────────

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
          {linkLabel} <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

// ── Insight chip ─────────────────────────────────────────────

function InsightChip({ icon: Icon, text, color }: { icon: typeof Circle; text: string; color: string }) {
  return (
    <motion.div
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
      style={{ background: `${color}18`, border: `1px solid ${color}28`, color }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Icon size={12} />
      <span>{text}</span>
    </motion.div>
  );
}

// ── Due date formatter ────────────────────────────────────────

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
    totalClientCount,
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
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // ── Published this month ───────────────────────────────────
  const publishedThisMonth = useMemo(() => {
    const now = new Date();
    return contentItems.filter((c) => {
      if (c.status !== "published") return false;
      const ref = c.publishedAt || c.scheduledDate;
      if (!ref) return false;
      const d = new Date(ref);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [contentItems]);

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

  // ── Content pipeline status ────────────────────────────────
  // ── Content stats ──────────────────────────────────────────
  const DRAFT_STATUSES = ["draft", "idea", "copywriting", "design"] as const;
  const contentStats = useMemo(() => {
    const published   = contentItems.filter((c) => c.status === "published").length;
    const scheduled   = contentItems.filter((c) => c.status === "scheduled" || c.status === "publishing_ready").length;
    const inReview    = contentItems.filter((c) => c.status === "client_review" || c.status === "internal_review").length;
    const approved    = contentItems.filter((c) => c.status === "approved").length;
    const drafts      = contentItems.filter((c) => (DRAFT_STATUSES as readonly string[]).includes(c.status)).length;
    const inProgress  = contentItems.filter((c) => c.status === "in_progress").length;
    const total       = contentItems.length;
    return { published, scheduled, inReview, approved, drafts, inProgress, total };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentItems]);

  const donutSegments = [
    { value: contentStats.published,  color: "#34d399", label: t("dashboard.statusPublished") },
    { value: contentStats.scheduled,  color: "#4f8ef7", label: t("dashboard.statusScheduled") },
    { value: contentStats.approved,   color: "#10b981", label: t("dashboard.statusApproved") },
    { value: contentStats.inReview,   color: "#fbbf24", label: t("dashboard.statusInReview") },
    { value: contentStats.inProgress, color: "#a78bfa", label: t("dashboard.statusInProgress") },
    { value: contentStats.drafts,     color: "#8888a0", label: t("dashboard.statusDrafts") },
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
    [activities]
  );

  // ── Pending approvals ──────────────────────────────────────
  const pendingApprovalsList = useMemo(
    () => approvals.filter((a) => a.status === "pending_internal" || a.status === "pending_client").slice(0, 4),
    [approvals]
  );
  const pendingApprovalsCount = useMemo(
    () => approvals.filter((a) => a.status === "pending_internal" || a.status === "pending_client").length,
    [approvals]
  );

  // ── Upcoming tasks (next 7 days) ───────────────────────────
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86_400_000);
    return tasks
      .filter((t) => {
        if (t.status === "done") return false;
        if (!t.dueDate || t.dueDate === "TBD") return false;
        try {
          const d = new Date(t.dueDate);
          return d >= now && d <= in7;
        } catch { return false; }
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [tasks]);

  // ── Content queue (upcoming scheduled) ────────────────────
  const contentQueue = useMemo(() => {
    const now = new Date();
    return contentItems
      .filter((c) => {
        if (!c.scheduledDate) return false;
        try {
          const d = new Date(c.scheduledDate);
          return d >= now && (c.status === "scheduled" || c.status === "publishing_ready" || c.status === "approved");
        } catch { return false; }
      })
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 5);
  }, [contentItems]);

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

  // ── Insights row ───────────────────────────────────────────
  const insights = useMemo(() => {
    const list: { icon: typeof Circle; text: string; color: string }[] = [];
    if (pendingApprovalsCount > 0) {
      list.push({
        icon: ClipboardCheck,
        text: `${pendingApprovalsCount} ${pendingApprovalsCount > 1 ? t("dashboard.insightPendingApprovals") : t("dashboard.insightPendingApproval")}`,
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
    if (list.length === 0) {
      list.push({ icon: TrendingUp, text: t("dashboard.insightAllHealthy"), color: "#34d399" });
    }
    return list;
  }, [pendingApprovalsCount, contentStats.inReview, openTaskCount, t]);

  // ── Approval status label ──────────────────────────────────
  function approvalStatusLabel(status: string): string {
    if (status === "pending_internal") return t("dashboard.approvalPendingInternal");
    if (status === "pending_client")   return t("dashboard.approvalPendingClient");
    if (status === "approved")         return t("dashboard.approvalApproved");
    if (status === "rejected")         return t("dashboard.approvalRejected");
    if (status === "revision_requested") return t("dashboard.approvalRevision");
    return status;
  }

  function approvalStatusColor(status: string): "yellow" | "blue" | "green" | "red" | "gray" {
    if (status === "pending_internal") return "yellow";
    if (status === "pending_client")   return "blue";
    if (status === "approved")         return "green";
    if (status === "rejected")         return "red";
    return "gray";
  }

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

      {/* ── KPI Cards ───────────────────────────────────────── */}
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
            value: totalClientCount,
            icon: Users,
            change: `+${totalClientCount}`,
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
            value: pendingApprovalsCount,
            icon: ClipboardCheck,
            change: `${pendingApprovalsCount}`,
            positive: pendingApprovalsCount === 0,
          },
          {
            label: t("dashboard.publishedThisMonth"),
            value: publishedThisMonth,
            icon: Activity,
            change: `+${publishedThisMonth}`,
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

      {/* ── Charts row ──────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Activity bar chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {t("dashboard.activityOverview")}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t("dashboard.tasksCompletedThis")}{" "}
                  {period === "week" ? t("dashboard.week").toLowerCase() : t("dashboard.month").toLowerCase()}
                </p>
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

        {/* Content pipeline donut */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <SectionHeader title={t("dashboard.contentPipeline")} href="/content" linkLabel={t("dashboard.viewAll")} />
            <div className="flex items-center gap-5">
              <DonutChart segments={donutSegments} total={contentStats.total} />
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                {donutSegments.filter((s) => s.value > 0).map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                      <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{seg.label}</span>
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--text-primary)" }}>{seg.value}</span>
                  </div>
                ))}
                {contentStats.total === 0 && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("common.noData")}</p>
                )}
              </div>
            </div>
          </Card>
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

      {/* ── Recent Activity + Upcoming Tasks ────────────────── */}
      {/* ── Bottom Row ────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Recent Activity feed */}
        <motion.div variants={itemVariants}>
          <Card>
            <SectionHeader title={t("dashboard.recentActivity")} />
            {recentActivities.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.noActivity")}</p>
            ) : (
              <div className="space-y-0">
                {recentActivities.map((act, i) => {
                  const color = activityColors[act.type] ?? "#8888a0";
                  return (
                    <motion.div
                      key={act.id}
                      className="flex items-start gap-3 py-2.5"
                      style={{ borderBottom: i < recentActivities.length - 1 ? "1px solid var(--border)" : "none" }}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <span
                        className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: color, boxShadow: `0 0 6px ${color}55`, marginTop: "5px" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {act.message}
                        </p>
                        {act.detail && (
                          <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{act.detail}</p>
                        )}
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                        {relativeTime(act.timestamp, t)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Upcoming tasks */}
        <motion.div variants={itemVariants}>
          <Card>
            <SectionHeader title={t("dashboard.upcomingTasks")} href="/tasks" linkLabel={t("dashboard.viewAll")} />
            {upcomingTasks.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.noUpcomingTasks")}</p>
            ) : (
              <div className="space-y-0">
                {upcomingTasks.map((task, i) => (
                  <Link
                    key={task.id}
                    href="/tasks"
                    className="flex items-center gap-3 py-2.5 group"
                    style={{ borderBottom: i < upcomingTasks.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-primary)" }}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {task.assigneeName || task.assignee || t("tasks.assigneeUnassigned")}
                        </span>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>·</span>
                        <span className="flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          <Calendar size={10} />
                          {task.dueDate}
                        </span>
                      </div>
                    </div>
                    <Badge label={task.priority} color={priorityColor(task.priority)} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Approvals + Content Queue ────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Pending Approvals */}
        <motion.div variants={itemVariants}>
          <Card>
            <SectionHeader
              title={t("dashboard.pendingApprovalsSectionTitle")}
              href="/approvals"
              linkLabel={t("dashboard.viewAll")}
            />
            {pendingApprovalsList.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.noApprovals")}</p>
            ) : (
              <div className="space-y-0">
                {pendingApprovalsList.map((appr, i) => {
                  const linked = contentItems.find((c) => c.id === appr.contentItemId);
                  return (
                    <Link
                      key={appr.id}
                      href="/approvals"
                      className="flex items-center gap-3 py-2.5 group"
                      style={{ borderBottom: i < pendingApprovalsList.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: "var(--accent-dim)", border: "1px solid var(--accent-dim)" }}
                      >
                        <ClipboardCheck size={14} style={{ color: "var(--accent)" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate group-hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-primary)" }}>
                          {linked?.title ?? appr.contentItemId}
                        </p>
                         {linked && (
                          <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <PlatformDot platform={linked.platform} />
                            {linked.platform}
                          </p>
                        )}
                      </div>
                      <Badge label={approvalStatusLabel(appr.status)} color={approvalStatusColor(appr.status)} />
                    </Link>
                  );
                })}
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

        {/* Content Queue */}
        <motion.div variants={itemVariants}>
          <Card>
            <SectionHeader title={t("dashboard.contentQueue")} href="/content" linkLabel={t("dashboard.viewAll")} />
            {contentQueue.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("dashboard.noContentQueue")}</p>
            ) : (
              <div className="space-y-0">
                {contentQueue.map((item, i) => (
                  <Link
                    key={item.id}
                    href="/content"
                    className="flex items-center gap-3 py-2.5 group"
                    style={{ borderBottom: i < contentQueue.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--glass-overlay)", border: "1px solid var(--border)" }}
                    >
                      <PlatformDot platform={item.platform} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-[var(--accent)] transition-colors" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </p>
                      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Calendar size={10} />
                        {formatScheduledDate(item.scheduledDate, item.scheduledTime, language)}
                      </p>
                    </div>
                    <Badge label={item.contentType} color="gray" />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Quick Actions ────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <SectionHeader title={t("dashboard.quickActions")} />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {[
            { label: t("dashboard.newClient"),    href: "/clients",   icon: Users,         color: "var(--accent)" },
            { label: t("dashboard.newTask"),      href: "/tasks",     icon: CheckSquare,   color: "#34d399" },
            { label: t("dashboard.newContent"),   href: "/content",   icon: Layers,        color: "#a78bfa" },
            { label: t("dashboard.viewReports"),  href: "/reports",   icon: BarChart3,     color: "#fbbf24" },
          ].map((action) => (
            <motion.div key={action.label} variants={itemVariants}>
              <Link href={action.href} className="block">
                <motion.div
                  className="rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center cursor-pointer"
                  style={{
                    background: "var(--glass-card)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                  whileHover={{ y: -3, scale: 1.02, boxShadow: "var(--shadow-md)" }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${action.color}18`, border: `1px solid ${action.color}28` }}
                  >
                    <action.icon size={18} color={action.color} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {action.label}
                  </span>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
