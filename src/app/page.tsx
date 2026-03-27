"use client";
import { useState } from "react";
import { Users, FolderOpen, CheckSquare, Activity, BarChart3, Plus, Zap, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

function MiniChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <div className="flex items-end gap-1.5 h-24">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${(v / max) * 80}px`,
                background: i === data.length - 2 ? 'var(--accent)' : 'var(--surface-4)',
                minHeight: '4px',
              }}
            />
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const recentActivity = [
  { id: 1, action: "New client added", detail: "Nexus Corp", time: "2m ago", type: "client" },
  { id: 2, action: "Task completed", detail: "API integration review", time: "18m ago", type: "task" },
  { id: 3, action: "Project updated", detail: "Atlas Platform v2", time: "1h ago", type: "project" },
  { id: 4, action: "Team member joined", detail: "Sarah Kim — Designer", time: "3h ago", type: "team" },
  { id: 5, action: "Report generated", detail: "Monthly analytics", time: "5h ago", type: "report" },
];

const activityColors: Record<string, string> = {
  client: "#4f8ef7",
  task: "#34d399",
  project: "#a78bfa",
  team: "#fbbf24",
  report: "#8888a0",
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const weekData = [42, 58, 45, 70, 63, 38, 52];
  const monthData = [120, 145, 132, 168, 142, 178, 155];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'var(--text-primary)' }}>
          {greeting}, Alex.
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{today} · All systems operational</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard label="Active Projects" value="12" icon={FolderOpen} change="+2" positive accent />
        <StatCard label="Total Clients" value="34" icon={Users} change="+5" positive />
        <StatCard label="Open Tasks" value="68" icon={CheckSquare} change="-8" positive={false} />
        <StatCard label="Team Members" value="9" icon={Activity} change="+1" positive />
      </div>

      {/* Analytics + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Activity Overview</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Tasks completed this {period}</p>
            </div>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-3)' }}>
              {(["week", "month"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: period === p ? 'var(--surface-1)' : 'transparent',
                    color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {p === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
          </div>
          <MiniChart data={period === "week" ? weekData : monthData} label="Completed tasks" />
          <div className="mt-4 pt-4 flex items-center gap-6" style={{ borderTop: '1px solid var(--border)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total this {period}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {period === "week" ? "368" : "1,040"}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Avg per day</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {period === "week" ? "52.6" : "34.7"}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Peak day</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--accent)' }}>Thu</p>
            </div>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Activity</p>
          <div className="space-y-0">
            {recentActivity.map((item, i) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-3"
                style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: activityColors[item.type] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>{item.action}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.detail}</p>
                </div>
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{item.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quick Actions */}
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "New Client", href: "/clients", icon: Users },
              { label: "New Project", href: "/projects", icon: FolderOpen },
              { label: "New Task", href: "/tasks", icon: CheckSquare },
              { label: "Invite Member", href: "/team", icon: Plus },
              { label: "View Reports", href: "/projects", icon: BarChart3 },
              { label: "Settings", href: "/settings", icon: Zap },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
              >
                <Icon size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* System Status */}
        <Card>
          <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>System Status</p>
          <div className="space-y-3">
            {[
              { label: "API Gateway", status: "Operational", ok: true, latency: "42ms" },
              { label: "Database Cluster", status: "Operational", ok: true, latency: "8ms" },
              { label: "Auth Service", status: "Operational", ok: true, latency: "15ms" },
              { label: "Storage Layer", status: "Degraded", ok: false, latency: "320ms" },
            ].map(({ label, status, ok, latency }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: ok ? 'var(--success)' : 'var(--warning)' }}
                  />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{latency}</span>
                  <Badge label={status} color={ok ? "green" : "yellow"} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <AlertCircle size={13} style={{ color: 'var(--warning)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>1 service degraded · Last check 30s ago</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
