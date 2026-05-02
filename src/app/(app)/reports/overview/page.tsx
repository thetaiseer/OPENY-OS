'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Users2,
  CheckSquare,
  FolderOpen,
  TrendingUp,
  Send,
  AlertCircle,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageShell, PageHeader, SectionTitle } from '@/components/layout/PageLayout';
import { useLang } from '@/context/lang-context';

interface ClientStat {
  id: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalAssets: number;
}
interface TeamMemberStat {
  id: string;
  name: string;
  completedTasks: number;
  totalAssigned: number;
  completionRate: number;
  overdueTasks: number;
}
interface PlatformStat {
  platform: string;
  published: number;
  scheduled: number;
  missed: number;
}
interface MonthlyTrend {
  month: string;
  label: string;
  completedTasks: number;
  publishedPosts: number;
  newAssets: number;
}
interface ReportsSummary {
  totalClients: number;
  totalTasks: number;
  totalAssets: number;
  totalPublished: number;
  completionRate: number;
}
interface ReportsData {
  summary: ReportsSummary;
  clientStats: ClientStat[];
  teamStats: TeamMemberStat[];
  platformStats: PlatformStat[];
  monthlyTrends: MonthlyTrend[];
}

const CHART_COLORS = [
  'var(--text-secondary)',
  'var(--text-primary)',
  'var(--text-secondary)',
  'var(--text-primary)',
  'var(--text-secondary)',
  'var(--text-primary)',
  'var(--text-primary)',
];

function toCSV<T extends object>(rows: T[], headers: Array<keyof T>): string {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join(
    '\n',
  );
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ReportTab = 'overview' | 'clients' | 'team' | 'content';

const REPORT_TABS: { id: ReportTab; labelKey: string }[] = [
  { id: 'overview', labelKey: 'overview' },
  { id: 'clients', labelKey: 'reportsTabClients' },
  { id: 'team', labelKey: 'reportsTabTeam' },
  { id: 'content', labelKey: 'reportsTabContent' },
];

export default function ReportsPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<ReportTab>('overview');

  const { data, isLoading, error, refetch, isFetching } = useQuery<{
    success: boolean;
    data: ReportsData;
  }>({
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
    downloadCSV(
      toCSV<ClientStat>(report.clientStats, [
        'name',
        'totalTasks',
        'completedTasks',
        'pendingTasks',
        'overdueTasks',
        'totalAssets',
      ]),
      'openy-client-report.csv',
    );
  }
  function exportTeam() {
    if (!report) return;
    downloadCSV(
      toCSV<TeamMemberStat>(report.teamStats, [
        'name',
        'totalAssigned',
        'completedTasks',
        'completionRate',
        'overdueTasks',
      ]),
      'openy-team-report.csv',
    );
  }

  return (
    <PageShell className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('reportsPageTitle')}
        subtitle={t('reportsPageSubtitle')}
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? t('reportsRefreshing') : t('refresh')}
          </Button>
        }
      />

      {error && (
        <Card
          padding="md"
          className="border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]"
        >
          <div className="flex items-center gap-3 text-[var(--color-danger)]">
            <AlertCircle size={16} className="shrink-0" />
            <p className="text-sm">{t('reportsFailedLoad')}</p>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map(({ id, labelKey }) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? 'primary' : 'secondary'}
            className="h-9 rounded-full px-4"
            onClick={() => setTab(id)}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'overview' && report && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <StatCard
                  label={t('totalClients')}
                  value={report.summary.totalClients}
                  icon={<Users2 size={18} />}
                  color="blue"
                />
                <StatCard
                  label={t('reportsStatTotalTasks')}
                  value={report.summary.totalTasks}
                  icon={<CheckSquare size={18} />}
                  color="green"
                />
                <StatCard
                  label={t('reportsStatTotalAssets')}
                  value={report.summary.totalAssets}
                  icon={<FolderOpen size={18} />}
                  color="amber"
                />
                <StatCard
                  label={t('reportsStatPostsPublished')}
                  value={report.summary.totalPublished}
                  icon={<Send size={18} />}
                  color="violet"
                />
                <StatCard
                  label={t('reportsStatTaskCompletionRate')}
                  value={`${report.summary.completionRate}%`}
                  icon={<TrendingUp size={18} />}
                  color="cyan"
                  detail={
                    <span
                      className={
                        report.summary.completionRate >= 80
                          ? 'text-[var(--text-primary)]'
                          : report.summary.completionRate >= 50
                            ? 'text-[var(--text-secondary)]'
                            : 'text-[var(--text-primary)]'
                      }
                    >
                      {report.summary.completionRate >= 80
                        ? t('onTrackTitle')
                        : report.summary.completionRate >= 50
                          ? t('reportsCompletionNeedsAttention')
                          : t('reportsCompletionAtRisk')}
                    </span>
                  }
                />
              </div>

              <Card padding="md">
                <SectionTitle className="mb-5">{t('reportsChart6MonthTrend')}</SectionTitle>
                {report.monthlyTrends.length === 0 ? (
                  <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
                    {t('reportsNoTrendData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={report.monthlyTrends}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="gcT" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--text-secondary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--text-secondary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gcP" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--text-secondary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--text-secondary)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gcA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="completedTasks"
                        name={t('chartCompletedTasks')}
                        stroke="var(--text-secondary)"
                        fill="url(#gcT)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="publishedPosts"
                        name={t('chartPublishedPosts')}
                        stroke="var(--text-secondary)"
                        fill="url(#gcP)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="newAssets"
                        name={t('chartNewAssets')}
                        stroke="var(--text-primary)"
                        fill="url(#gcA)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {report.platformStats.length > 0 && (
                <Card padding="md">
                  <SectionTitle className="mb-5">{t('reportsPublishingByPlatform')}</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={report.platformStats}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="published"
                        name={t('chartPublished')}
                        fill="var(--text-secondary)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="scheduled"
                        name={t('chartScheduled')}
                        fill="var(--text-secondary)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="missed"
                        name={t('chartMissed')}
                        fill="var(--text-primary)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          )}

          {tab === 'clients' && report && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={exportClients}>
                  <Download size={14} /> {t('exportCsv')}
                </Button>
              </div>
              {report.clientStats.length === 0 ? (
                <Card padding="md" className="p-12 text-center">
                  <BarChart2
                    size={32}
                    className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30"
                  />
                  <p className="text-sm text-[var(--text-secondary)]">{t('reportsNoClientData')}</p>
                </Card>
              ) : (
                <Card padding="none" className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)]">
                        {[
                          t('reportsColClient'),
                          t('reportsColTotalTasks'),
                          t('reportsColCompleted'),
                          t('reportsColPending'),
                          t('reportsColOverdue'),
                          t('reportsColAssets'),
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 text-start font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.clientStats.map((c) => (
                        <tr key={c.id} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="px-4 py-3 font-medium text-[var(--text)]">{c.name}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{c.totalTasks}</td>
                          <td className="px-4 py-3">
                            <Badge variant="success">{c.completedTasks}</Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {c.pendingTasks}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={c.overdueTasks > 0 ? 'danger' : 'default'}>
                              {c.overdueTasks}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {c.totalAssets}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}

          {tab === 'team' && report && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button type="button" variant="secondary" onClick={exportTeam}>
                  <Download size={14} /> {t('exportCsv')}
                </Button>
              </div>
              {report.teamStats.length === 0 ? (
                <Card padding="md" className="p-12 text-center">
                  <Users2
                    size={32}
                    className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30"
                  />
                  <p className="text-sm text-[var(--text-secondary)]">{t('reportsNoTeamData')}</p>
                </Card>
              ) : (
                <>
                  <Card padding="md">
                    <SectionTitle as="h3" className="mb-4 text-sm">
                      {t('reportsCompletedTasksByMember')}
                    </SectionTitle>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={report.teamStats}
                        layout="vertical"
                        margin={{ top: 4, right: 20, left: 40, bottom: 0 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="completedTasks"
                          name={t('chartCompleted')}
                          fill="var(--text-secondary)"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card padding="none" className="overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)]">
                          {[
                            t('reportsColTeamMember'),
                            t('reportsColAssigned'),
                            t('reportsColCompleted'),
                            t('reportsColCompletionRate'),
                            t('reportsColOverdue'),
                          ].map((h) => (
                            <th key={h} className="px-4 py-3 text-start font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.teamStats.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-[var(--border)] last:border-b-0"
                          >
                            <td className="px-4 py-3 font-medium text-[var(--text)]">{m.name}</td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {m.totalAssigned}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {m.completedTasks}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${m.completionRate}%`,
                                      background:
                                        m.completionRate >= 80
                                          ? 'var(--text-primary)'
                                          : m.completionRate >= 50
                                            ? 'var(--text-secondary)'
                                            : 'var(--text-primary)',
                                    }}
                                  />
                                </div>
                                <span className="w-8 text-end text-xs text-[var(--text-secondary)]">
                                  {m.completionRate}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={m.overdueTasks > 0 ? 'danger' : 'default'}>
                                {m.overdueTasks}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </>
              )}
            </div>
          )}

          {tab === 'content' && report && (
            <div className="space-y-6">
              {report.platformStats.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card padding="md">
                    <SectionTitle as="h3" className="mb-4 text-sm">
                      {t('reportsPlatformDistribution')}
                    </SectionTitle>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={report.platformStats}
                          dataKey="published"
                          nameKey="platform"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(props) =>
                            `${(props as { platform?: string }).platform ?? ''} ${Math.round(((props as { percent?: number }).percent ?? 0) * 100)}%`
                          }
                          labelLine={false}
                        >
                          {report.platformStats.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card padding="md">
                    <SectionTitle as="h3" className="mb-4 text-sm">
                      {t('reportsPubVsSchedVsMissed')}
                    </SectionTitle>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={report.platformStats}
                        margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                      >
                        <XAxis dataKey="platform" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="published"
                          name={t('chartPublished')}
                          fill="var(--text-secondary)"
                          radius={[4, 4, 0, 0]}
                          stackId="a"
                        />
                        <Bar
                          dataKey="scheduled"
                          name={t('chartScheduled')}
                          fill="var(--text-secondary)"
                          stackId="a"
                        />
                        <Bar
                          dataKey="missed"
                          name={t('chartMissed')}
                          fill="var(--text-primary)"
                          radius={[4, 4, 0, 0]}
                          stackId="a"
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              ) : (
                <Card padding="md" className="p-12 text-center">
                  <Send
                    size={32}
                    className="mx-auto mb-3 text-[var(--text-secondary)] opacity-30"
                  />
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t('reportsNoPublishingData')}
                  </p>
                </Card>
              )}
              <Card padding="md">
                <SectionTitle as="h3" className="mb-4 text-sm">
                  {t('reportsMonthlyPublishingVelocity')}
                </SectionTitle>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={report.monthlyTrends}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="publishedPosts"
                      name={t('chartPublishedPosts')}
                      fill="var(--text-secondary)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="newAssets"
                      name={t('chartNewAssets')}
                      fill="var(--text-primary)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
