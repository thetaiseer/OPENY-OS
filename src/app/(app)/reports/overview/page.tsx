'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Users2, CheckSquare, FolderOpen, TrendingUp,
  Send, AlertCircle, Download, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';

interface ClientStat {
  id: string; name: string; totalTasks: number; completedTasks: number;
  pendingTasks: number; overdueTasks: number; totalAssets: number;
}
interface TeamMemberStat {
  id: string; name: string; completedTasks: number; totalAssigned: number;
  completionRate: number; overdueTasks: number;
}
interface PlatformStat { platform: string; published: number; scheduled: number; missed: number; }
interface MonthlyTrend { month: string; label: string; completedTasks: number; publishedPosts: number; newAssets: number; }
interface ReportsSummary {
  totalClients: number; totalTasks: number; totalAssets: number; totalPublished: number;
  completionRate: number;
}
interface ReportsData {
  summary: ReportsSummary;
  clientStats: ClientStat[];
  teamStats: TeamMemberStat[];
  platformStats: PlatformStat[];
  monthlyTrends: MonthlyTrend[];
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

function toCSV<T extends object>(rows: T[], headers: Array<keyof T>): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ].join('\n');
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, icon, color, sub }: { label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl border p-5 flex items-start gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
        {sub && <p className="text-xs mt-1 font-medium" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={active
        ? { background: 'var(--accent)', color: '#fff' }
        : { background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
    >
      {children}
    </button>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<'overview' | 'clients' | 'team' | 'content'>('overview');

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ success: boolean; data: ReportsData }>({
    queryKey: ['reports-overview'],
    queryFn: async () => {
      const res = await fetch('/api/reports/overview');
      if (!res.ok) throw new Error('Failed to load reports');
      return res.json() as Promise<{ success: boolean; data: ReportsData }>;
    },
    staleTime: 120_000,
  });

  const report = data?.data;

  function exportClients() {
    if (!report) return;
    downloadCSV(toCSV<ClientStat>(report.clientStats, ['name', 'totalTasks', 'completedTasks', 'pendingTasks', 'overdueTasks', 'totalAssets']), 'openy-client-report.csv');
  }
  function exportTeam() {
    if (!report) return;
    downloadCSV(toCSV<TeamMemberStat>(report.teamStats, ['name', 'totalAssigned', 'completedTasks', 'completionRate', 'overdueTasks']), 'openy-team-report.csv');
  }

  return (
    <div className="app-page-shell max-w-6xl mx-auto space-y-8">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">Reports & Analytics</h1>
          <p className="app-page-subtitle">Live data across clients, team, and publishing performance</p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Refreshing\u2026' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertCircle size={16} />
          <p className="text-sm">Failed to load report data. Please try again.</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(['overview', 'clients', 'team', 'content'] as const).map(t => (
          <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </TabBtn>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: 'var(--surface)' }} />)}
        </div>
      ) : (
        <>
          {tab === 'overview' && report && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <SummaryCard label="Total Clients"    value={report.summary.totalClients}    icon={<Users2 size={18} />}     color="#6366f1" />
                <SummaryCard label="Total Tasks"      value={report.summary.totalTasks}      icon={<CheckSquare size={18} />} color="#10b981" />
                <SummaryCard label="Total Assets"     value={report.summary.totalAssets}     icon={<FolderOpen size={18} />}  color="#f59e0b" />
                <SummaryCard label="Posts Published"  value={report.summary.totalPublished}  icon={<Send size={18} />}        color="#8b5cf6" />
                <SummaryCard
                  label="Task Completion Rate"
                  value={`${report.summary.completionRate}%`}
                  icon={<TrendingUp size={18} />}
                  color="#06b6d4"
                  sub={report.summary.completionRate >= 80 ? 'On track' : report.summary.completionRate >= 50 ? 'Needs attention' : 'At risk'}
                />
              </div>

              <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>6-Month Performance Trend</h2>
                {report.monthlyTrends.length === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: 'var(--text-secondary)' }}>No trend data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={report.monthlyTrends} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gcT" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gcP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gcA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="completedTasks" name="Completed Tasks" stroke="#6366f1" fill="url(#gcT)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="publishedPosts"  name="Published Posts" stroke="#8b5cf6" fill="url(#gcP)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="newAssets"       name="New Assets"      stroke="#10b981" fill="url(#gcA)" strokeWidth={2} dot={false} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {report.platformStats.length > 0 && (
                <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text)' }}>Publishing by Platform</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={report.platformStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="published" name="Published" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="scheduled" name="Scheduled" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="missed"    name="Missed"    fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {tab === 'clients' && report && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={exportClients} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {report.clientStats.length === 0 ? (
                <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <BarChart2 size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No client data yet</p>
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                        {['Client', 'Total Tasks', 'Completed', 'Pending', 'Overdue', 'Assets'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.clientStats.map(c => (
                        <tr key={c.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{c.name}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.totalTasks}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{c.completedTasks}</span></td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.pendingTasks}</td>
                          <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: c.overdueTasks > 0 ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)', color: c.overdueTasks > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{c.overdueTasks}</span></td>
                          <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{c.totalAssets}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'team' && report && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={exportTeam} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {report.teamStats.length === 0 ? (
                <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <Users2 size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No team task data yet. Assign tasks to team members to see performance.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Completed Tasks by Member</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={report.teamStats} layout="vertical" margin={{ top: 4, right: 20, left: 40, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="completedTasks" name="Completed" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: 11 }}>
                          {['Team Member', 'Assigned', 'Completed', 'Completion Rate', 'Overdue'].map(h => (
                            <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.teamStats.map(m => (
                          <tr key={m.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>{m.name}</td>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{m.totalAssigned}</td>
                            <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{m.completedTasks}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${m.completionRate}%`, background: m.completionRate >= 80 ? '#10b981' : m.completionRate >= 50 ? '#f59e0b' : '#ef4444' }} />
                                </div>
                                <span className="text-xs w-8 text-right" style={{ color: 'var(--text-secondary)' }}>{m.completionRate}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: m.overdueTasks > 0 ? 'rgba(239,68,68,0.1)' : 'var(--surface-2)', color: m.overdueTasks > 0 ? '#ef4444' : 'var(--text-secondary)' }}>{m.overdueTasks}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'content' && report && (
            <div className="space-y-8">
              {report.platformStats.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Platform Distribution</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={report.platformStats} dataKey="published" nameKey="platform" cx="50%" cy="50%" outerRadius={80} label={(props) => `${(props as { platform?: string }).platform ?? ''} ${Math.round(((props as { percent?: number }).percent ?? 0) * 100)}%`} labelLine={false}>
                          {report.platformStats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Published vs Scheduled vs Missed</h2>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={report.platformStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis dataKey="platform" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="published" name="Published" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="scheduled" name="Scheduled" fill="#8b5cf6" stackId="a" />
                        <Bar dataKey="missed"    name="Missed"    fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <Send size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No publishing data yet. Start scheduling posts to see analytics.</p>
                </div>
              )}
              <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Monthly Publishing Velocity</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={report.monthlyTrends} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="publishedPosts" name="Published Posts" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="newAssets"      name="New Assets"      fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
