"use client";
import { useMemo, useState } from "react";
import { Users, FolderOpen, CheckSquare, Activity, BarChart3, Plus, Zap, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { useAppStore } from "@/lib/AppContext";
import type { ActivityType } from "@/lib/types";

function MiniChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data) || 1;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
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
  task_completed:   "#34d399",
  task_created:     "#34d399",
  project_created:  "#a78bfa",
  project_updated:  "#a78bfa",
  member_joined:    "#fbbf24",
  report_generated: "#8888a0",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
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

  const [period, setPeriod] = useState<"week" | "month">("week");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

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
  const peakDayLabel = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][chartData.indexOf(Math.max(...chartData))] ?? "—";

  const recentActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5),
    [activities]
  );

  const degradedCount = systemStatuses.filter((s) => s.status !== "operational").length;

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
          {greeting}, Alex.
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {today} · {degradedCount === 0 ? "All systems operational" : `${degradedCount} service${degradedCount > 1 ? "s" : ""} degraded`}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Active Projects" value={activeProjectCount} icon={FolderOpen} change={`+${activeProjectCount}`} positive accent />
        <StatCard label="Total Clients"   value={totalClientCount}   icon={Users}       change={`+${totalClientCount}`}   positive />
        <StatCard label="Open Tasks"      value={openTaskCount}      icon={CheckSquare} change={openTaskCount > 0 ? `${openTaskCount}` : "0"} positive={openTaskCount === 0} />
        <StatCard label="Team Members"    value={teamMemberCount}    icon={Activity}    change={`+${teamMemberCount}`}    positive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Activity Overview</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tasks completed this {period}</p>
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
                  {p === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          </div>
          <MiniChart data={chartData} label="Completed tasks" />
          <div className="mt-4 pt-4 flex items-center gap-6" style={{ borderTop: "1px solid var(--border)" }}>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Total this {period}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{chartTotal}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Avg per day</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{chartAvg}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Peak day</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--accent)" }}>{peakDayLabel}</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Recent Activity</p>
          {recentActivities.length === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>No activity yet.</p>
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
                    {relativeTime(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "New Client",    href: "/clients",  icon: Users },
              { label: "New Project",   href: "/projects", icon: FolderOpen },
              { label: "New Task",      href: "/tasks",    icon: CheckSquare },
              { label: "Invite Member", href: "/team",     icon: Plus },
              { label: "View Reports",  href: "/projects", icon: BarChart3 },
              { label: "Settings",      href: "/settings", icon: Zap },
            ].map(({ label, href, icon: Icon }) => (
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
          <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>System Status</p>
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
                    <Badge label={ok ? "Operational" : warn ? "Degraded" : "Down"} color={ok ? "green" : warn ? "yellow" : "red"} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={13} style={{ color: degradedCount > 0 ? "var(--warning)" : "var(--success)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {degradedCount === 0 ? "All services operational" : `${degradedCount} service${degradedCount > 1 ? "s" : ""} degraded`} · Last check 30s ago
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
