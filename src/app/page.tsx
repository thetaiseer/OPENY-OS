"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Users, CheckSquare, ClipboardCheck, UserCheck,
  Plus, FileText, BarChart3, FilePlus2,
  ArrowRight, Clock, TrendingUp, Layers,
  Activity, CheckCircle2, Circle, AlertCircle,
  Calendar, Star, Zap,
} from "lucide-react";
import { useAppStore } from "@/lib/AppContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Badge } from "@/components/ui/Badge";
import type { ActivityType } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function priorityColor(p: string): "red" | "yellow" | "gray" {
  if (p === "high") return "red";
  if (p === "medium") return "yellow";
  return "gray";
}

function activityIcon(type: ActivityType) {
  const map: Partial<Record<ActivityType, typeof CheckCircle2>> = {
    client_added: Users,
    client_updated: Users,
    client_deleted: Users,
    task_completed: CheckCircle2,
    task_created: CheckSquare,
    member_joined: UserCheck,
    member_removed: UserCheck,
    content_created: FileText,
    content_status_changed: Layers,
    approval_submitted: ClipboardCheck,
    post_approved_by_client: Star,
    post_marked_published: Zap,
  };
  return map[type] ?? Activity;
}

function activityColor(type: ActivityType): string {
  if (type.startsWith("client")) return "#4f8ef7";
  if (type.startsWith("task")) return "#34d399";
  if (type.startsWith("member")) return "#a78bfa";
  if (type.includes("approved") || type === "post_marked_published") return "#34d399";
  if (type.includes("failed")) return "#f87171";
  return "#8888a0";
}

// ── Animation variants ───────────────────────────────────────

const fade = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, type: "spring", stiffness: 360, damping: 30 },
  }),
};

// ── DonutChart ───────────────────────────────────────────────

function DonutChart({ done, total }: { done: number; total: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 0;
  const offset = circ * (1 - frac);
  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="108" height="108" viewBox="0 0 108 108">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
        <motion.circle
          cx="54" cy="54" r={r} fill="none"
          stroke="var(--accent)" strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 54 54)"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <text x="54" y="50" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--text-primary)">{done}</text>
        <text x="54" y="66" textAnchor="middle" fontSize="10" fill="var(--text-muted)">of {total}</text>
      </svg>
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />
          Done ({done})
        </span>
        <span className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--border)" }} />
          Open ({total - done})
        </span>
      </div>
    </div>
  );
}

// ── ContentBarChart ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: "#8888a0",
  copywriting: "#4f8ef7",
  design: "#a78bfa",
  internal_review: "#fbbf24",
  client_review: "#fb923c",
  approved: "#34d399",
  scheduled: "#22d3ee",
  published: "#059669",
};
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  copywriting: "Copy",
  design: "Design",
  internal_review: "Int. Review",
  client_review: "Client Rev.",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
};

function ContentBarChart({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({ key, label, count: counts[key] ?? 0 }))
    .filter(e => e.count > 0);
  const maxVal = Math.max(...entries.map(e => e.count), 1);
  if (entries.length === 0) return (
    <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No content yet</div>
  );
  return (
    <div className="flex flex-col gap-2">
      {entries.map(({ key, label, count }) => (
        <div key={key} className="flex items-center gap-3">
          <span style={{ width: 72, fontSize: 11, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>{label}</span>
          <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: STATUS_COLORS[key] ?? "var(--accent)" }}
              initial={{ width: 0 }}
              animate={{ width: `${(count / maxVal) * 100}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
          <span style={{ width: 20, fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function DashboardPage() {
  const { tasks, members, activities, loading: appLoading } = useAppStore();
  const { clients } = useAppStore();
  const { approvals, loading: approvalsLoading } = useApprovals();
  const { contentItems, loading: contentLoading } = useContentItems();
  const { isRTL } = useLanguage();

  const loading = appLoading || approvalsLoading || contentLoading;

  // KPI
  const openTasks = useMemo(() => tasks.filter(t => t.status !== "done"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.status === "done"), [tasks]);
  const pendingApprovals = useMemo(
    () => approvals.filter(a => a.status === "pending_internal" || a.status === "pending_client"),
    [approvals],
  );

  // Attention count
  const overdueCount = useMemo(() => {
    const now = new Date();
    return openTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;
  }, [openTasks]);
  const attentionCount = pendingApprovals.length + overdueCount;

  // Content pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of contentItems) {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
    }
    return counts;
  }, [contentItems]);

  const pipelineColumns = [
    { key: "draft", label: "Draft", color: "#8888a0" },
    { key: "in_review", label: "In Review", color: "#fbbf24", keys: ["internal_review", "client_review"] },
    { key: "approved", label: "Approved", color: "#34d399" },
    { key: "scheduled", label: "Scheduled", color: "#22d3ee" },
    { key: "published", label: "Published", color: "#059669" },
  ] as const;

  const pipelineCount = (col: typeof pipelineColumns[number]) => {
    if ("keys" in col) return [...col.keys].reduce((s, k) => s + (pipelineCounts[k] ?? 0), 0);
    return pipelineCounts[col.key] ?? 0;
  };

  // Content by status for bar chart
  const contentStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of contentItems) counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, [contentItems]);

  // Upcoming tasks
  const upcomingTasks = useMemo(
    () => [...openTasks]
      .filter(t => t.dueDate)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5),
    [openTasks],
  );

  // Pending approvals preview
  const pendingApprovalPreview = useMemo(() => pendingApprovals.slice(0, 3), [pendingApprovals]);

  // Recent activities
  const recentActivities = useMemo(() => activities.slice(0, 8), [activities]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 24px 48px", direction: isRTL ? "rtl" : "ltr" }}>
      {/* ── Two-column layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.9fr) minmax(0,1fr)", gap: 24, alignItems: "start" }}
        className="dashboard-grid">

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

          {/* A. Hero Greeting */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="premium-card"
            style={{
              padding: "28px 32px",
              background: "linear-gradient(135deg, var(--glass-card-elevated) 0%, var(--glass-card) 100%)",
              position: "relative", overflow: "hidden",
            }}
          >
            {/* Decorative glow */}
            <div style={{
              position: "absolute", top: -40, right: -40, width: 200, height: 200,
              borderRadius: "50%", background: "var(--accent)", opacity: 0.06, pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, marginBottom: 6, letterSpacing: 0.3 }}>
                {formatDate()}
              </p>
              <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                {getGreeting()}, Alex Chen 👋
              </h1>
              {attentionCount > 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  <span style={{ color: "var(--warning)", fontWeight: 600 }}>{attentionCount} item{attentionCount !== 1 ? "s" : ""}</span>
                  {" "}need{attentionCount === 1 ? "s" : ""} your attention today.
                </p>
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Everything looks great — you&apos;re all caught up! ✨</p>
              )}
            </div>
          </motion.div>

          {/* B. KPI Stats Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }} className="kpi-grid">
            {[
              { label: "Clients", value: clients.length, icon: Users, color: "#4f8ef7", bg: "rgba(79,142,247,0.12)" },
              { label: "Open Tasks", value: openTasks.length, icon: CheckSquare, color: "#34d399", bg: "rgba(52,211,153,0.12)" },
              { label: "Approvals", value: pendingApprovals.length, icon: ClipboardCheck, color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
              { label: "Team", value: members.length, icon: UserCheck, color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
            ].map(({ label, value, icon: Icon, color, bg }, i) => (
              <motion.div
                key={label}
                custom={i}
                variants={fade}
                initial="hidden"
                animate="show"
                className="stat-card"
                style={{ padding: "18px 16px" }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "var(--radius-md)",
                  background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 12,
                }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <p style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, marginBottom: 4 }}>{value}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</p>
              </motion.div>
            ))}
          </div>

          {/* C. Content Pipeline */}
          <motion.div custom={4} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Content Pipeline</h2>
              <Link href="/content" style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
              {pipelineColumns.map(col => {
                const count = pipelineCount(col);
                return (
                  <Link key={col.key} href="/content" style={{ textDecoration: "none", flexShrink: 0 }}>
                    <motion.div
                      whileHover={{ scale: 1.03, y: -2 }}
                      style={{
                        minWidth: 110, padding: "14px 16px", borderRadius: "var(--radius-md)",
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                        cursor: "pointer", textAlign: "center",
                      }}
                    >
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: col.color, margin: "0 auto 8px",
                      }} />
                      <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1, marginBottom: 4 }}>{count}</p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{col.label}</p>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* F. Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="charts-grid">
            {/* Donut - Task Completion */}
            <motion.div custom={5} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 24px" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Task Completion</h2>
              <DonutChart done={doneTasks.length} total={tasks.length} />
            </motion.div>

            {/* Bar - Content by Status */}
            <motion.div custom={6} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 24px" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 16 }}>Content by Status</h2>
              <ContentBarChart counts={contentStatusCounts} />
            </motion.div>
          </div>

          {/* G. Upcoming Tasks */}
          <motion.div custom={7} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Upcoming Tasks</h2>
              <Link href="/tasks" style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {upcomingTasks.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No upcoming tasks 🎉</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <AnimatePresence>
                  {upcomingTasks.map((task, i) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px", borderRadius: "var(--radius-md)",
                        background: "var(--surface-2)", border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: task.priority === "high" ? "var(--error)" : task.priority === "medium" ? "var(--warning)" : "var(--text-muted)",
                      }} />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </span>
                      <Badge label={task.priority} color={priorityColor(task.priority)} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={11} />
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.assigneeName ?? task.assignee ?? "—"}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>

          {/* D. Quick Actions */}
          <motion.div custom={1} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 20px" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>Quick Actions</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "New Content", href: "/content", icon: FilePlus2, color: "#4f8ef7", bg: "rgba(79,142,247,0.1)" },
                { label: "New Task", href: "/tasks", icon: Plus, color: "#34d399", bg: "rgba(52,211,153,0.1)" },
                { label: "New Client", href: "/clients", icon: Users, color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
                { label: "Reports", href: "/reports", icon: BarChart3, color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
              ].map(({ label, href, icon: Icon, color, bg }) => (
                <Link key={href} href={href} style={{ textDecoration: "none" }}>
                  <motion.div
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      padding: "14px 12px", borderRadius: "var(--radius-md)",
                      background: bg, border: `1px solid ${color}22`,
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={20} style={{ color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "center" }}>{label}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* E. Activity Feed */}
          <motion.div custom={2} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Activity</h2>
              <TrendingUp size={15} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              <AnimatePresence>
                {recentActivities.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No recent activity</p>
                ) : (
                  recentActivities.map((act, i) => {
                    const Icon = activityIcon(act.type);
                    const color = activityColor(act.type);
                    return (
                      <motion.div
                        key={act.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: "var(--radius-sm)",
                          background: `${color}18`, display: "flex", alignItems: "center",
                          justifyContent: "center", flexShrink: 0, marginTop: 1,
                        }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>{act.message}</p>
                          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={10} /> {timeAgo(act.timestamp)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* H. Pending Approvals Preview */}
          <motion.div custom={3} variants={fade} initial="hidden" animate="show" className="premium-card" style={{ padding: "20px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Pending Approvals</h2>
              <Link href="/approvals" style={{ fontSize: 12, color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {pendingApprovalPreview.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 size={28} style={{ color: "var(--success)", margin: "0 auto 8px" }} />
                <p style={{ color: "var(--text-muted)", fontSize: 12 }}>All approvals are up to date</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingApprovalPreview.map((approval, i) => (
                  <motion.div
                    key={approval.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.06 }}
                    style={{
                      padding: "10px 12px", borderRadius: "var(--radius-md)",
                      background: "var(--surface-2)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
                        {contentItems.find(ci => ci.id === approval.contentItemId)?.title ?? `#${approval.contentItemId.slice(0, 8)}`}
                      </p>
                      <Badge
                        label={approval.status === "pending_internal" ? "Internal" : "Client"}
                        color={approval.status === "pending_internal" ? "yellow" : "blue"}
                      />
                    </div>
                    <Link href="/approvals" style={{ textDecoration: "none" }}>
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        style={{
                          fontSize: 11, fontWeight: 600, color: "var(--accent)",
                          background: "rgba(79,142,247,0.1)", padding: "4px 10px",
                          borderRadius: "var(--radius-sm)", cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        Review
                      </motion.span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Attention summary card */}
          {attentionCount > 0 && (
            <motion.div custom={8} variants={fade} initial="hidden" animate="show"
              style={{
                padding: "14px 16px", borderRadius: "var(--radius-md)",
                background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <AlertCircle size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                <strong style={{ color: "var(--warning)" }}>{overdueCount} overdue task{overdueCount !== 1 ? "s" : ""}</strong>
                {overdueCount > 0 && pendingApprovals.length > 0 && " and "}
                {pendingApprovals.length > 0 && (
                  <strong style={{ color: "var(--warning)" }}>{pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? "s" : ""}</strong>
                )} require attention.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 900px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .charts-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 500px) {
          .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
