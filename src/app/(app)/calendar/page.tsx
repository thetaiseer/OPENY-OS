'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckSquare,
  FolderOpen,
  AlertCircle,
  Send,
  FileText,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import type { Task, CalendarAsset, PublishingSchedule, ContentItem } from '@/lib/types';
import { PLATFORMS, POST_TYPES } from '@/components/features/publishing/SchedulePublishingModal';
import AppModal from '@/components/ui/AppModal';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function priorityColor(p: string): string {
  if (p === 'high') return '#dc2626';
  if (p === 'medium') return '#d97706';
  return '#2563eb';
}

function scheduleStatusColor(s?: string): string {
  if (s === 'published') return '#0891b2';
  if (s === 'approved') return '#16a34a';
  if (s === 'pending_review') return '#d97706';
  if (s === 'missed') return '#dc2626';
  if (s === 'cancelled') return '#6b7280';
  if (s === 'draft') return '#9ca3af';
  return '#7c3aed'; // scheduled (default)
}

function platformLabel(value: string): string {
  const p = PLATFORMS.find((pl) => pl.value === value);
  return p ? p.label : value;
}

function postTypeLabel(value: string): string {
  const pt = POST_TYPES.find((t) => t.value === value);
  return pt ? pt.label : value;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Selected schedule for detail view
  const [selectedSchedule, setSelectedSchedule] = useState<PublishingSchedule | null>(null);
  const [markingPublished, setMarkingPublished] = useState(false);

  const queryClient = useQueryClient();

  // React Query caches each month independently — switching months is instant
  // for previously-visited months, and navigating away/back to the calendar
  // shows cached data immediately without a loading skeleton.
  const {
    data: calendarData,
    isLoading: loading,
    error: calendarError,
  } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: async () => {
      const pad = (n: number) => String(n).padStart(2, '0');
      const startDate = `${year}-${pad(month + 1)}-01`;
      const endDate = `${year}-${pad(month + 1)}-${pad(getDaysInMonth(year, month))}`;

      const [tasksRes, assetsRes, schedulesRes, contentRes] = await Promise.allSettled([
        supabase
          .from('tasks')
          .select('*, client:clients(id, name, slug)')
          .gte('due_date', startDate)
          .lte('due_date', endDate),
        supabase
          .from('assets')
          .select('id, name, publish_date, content_type, client_name')
          .gte('publish_date', startDate)
          .lte('publish_date', endDate),
        supabase
          .from('publishing_schedules')
          .select(
            '*, asset:assets(id, name, content_type, preview_url), content_item:content_items(id, title, status)',
          )
          .gte('scheduled_date', startDate)
          .lte('scheduled_date', endDate)
          .neq('status', 'cancelled')
          .order('scheduled_time', { ascending: true }),
        supabase
          .from('content_items')
          .select('id, title, status, schedule_date, client_id, client:clients(id, name, slug)')
          .in('status', ['scheduled', 'approved'])
          .gte('schedule_date', startDate)
          .lte('schedule_date', endDate),
      ]);

      if (tasksRes.status === 'rejected')
        console.error('[calendar] tasks fetch rejected:', tasksRes.reason);
      else if (tasksRes.value.error)
        console.error('[calendar] tasks fetch error:', tasksRes.value.error);
      if (assetsRes.status === 'rejected')
        console.error('[calendar] assets fetch rejected:', assetsRes.reason);
      else if (assetsRes.value.error)
        console.error('[calendar] assets fetch error:', assetsRes.value.error);
      if (schedulesRes.status === 'rejected') {
        if (process.env.NODE_ENV === 'development')
          console.warn('[calendar] schedules fetch rejected:', schedulesRes.reason);
      } else if (schedulesRes.value.error) {
        if (process.env.NODE_ENV === 'development')
          console.warn('[calendar] schedules fetch error:', schedulesRes.value.error);
      }

      return {
        tasks:
          tasksRes.status === 'fulfilled' && !tasksRes.value.error
            ? ((tasksRes.value.data ?? []) as Task[])
            : [],
        assets:
          assetsRes.status === 'fulfilled' && !assetsRes.value.error
            ? ((assetsRes.value.data ?? []) as CalendarAsset[])
            : [],
        schedules:
          schedulesRes.status === 'fulfilled' && !schedulesRes.value.error
            ? ((schedulesRes.value.data ?? []) as PublishingSchedule[])
            : [],
        content:
          contentRes.status === 'fulfilled' && !contentRes.value.error
            ? ((contentRes.value.data ?? []) as Pick<
                ContentItem,
                'id' | 'title' | 'status' | 'schedule_date'
              >[])
            : [],
      };
    },
    // staleTime inherited from QueryClient defaults (2 minutes)
  });

  const tasks = calendarData?.tasks ?? [];
  const assets = calendarData?.assets ?? [];
  const schedules = calendarData?.schedules ?? [];
  const content = calendarData?.content ?? [];

  const error = calendarError ? (calendarError as Error).message : null;

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const tasksByDay = useMemo(() => {
    const map: Record<number, Task[]> = {};
    for (const t of tasks) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(t);
    }
    return map;
  }, [tasks]);

  const assetsByDay = useMemo(() => {
    const map: Record<number, CalendarAsset[]> = {};
    for (const a of assets) {
      if (!a.publish_date) continue;
      const d = new Date(a.publish_date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [assets]);

  const schedulesByDay = useMemo(() => {
    const map: Record<number, PublishingSchedule[]> = {};
    for (const s of schedules) {
      if (!s.scheduled_date) continue;
      const d = new Date(s.scheduled_date + 'T00:00:00').getDate();
      if (!map[d]) map[d] = [];
      map[d].push(s);
    }
    return map;
  }, [schedules]);

  const contentByDay = useMemo(() => {
    const map: Record<number, Pick<ContentItem, 'id' | 'title' | 'status' | 'schedule_date'>[]> =
      {};
    for (const c of content) {
      if (!c.schedule_date) continue;
      const d = new Date(c.schedule_date + 'T00:00:00').getDate();
      if (!map[d]) map[d] = [];
      map[d].push(c);
    }
    return map;
  }, [content]);

  const selectedTasks = selectedDay ? (tasksByDay[selectedDay] ?? []) : [];
  const selectedAssets = selectedDay ? (assetsByDay[selectedDay] ?? []) : [];
  const selectedSchedules = selectedDay ? (schedulesByDay[selectedDay] ?? []) : [];
  const selectedContent = selectedDay ? (contentByDay[selectedDay] ?? []) : [];

  // ── Mark as published ───────────────────────────────────────────────────────
  const handleMarkPublished = async (schedule: PublishingSchedule) => {
    setMarkingPublished(true);
    try {
      const res = await fetch(`/api/publishing-schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (res.ok) {
        // Optimistic update via React Query cache so the UI reflects the change
        // immediately and the update persists if the user navigates away and back.
        queryClient.setQueryData<typeof calendarData>(['calendar', year, month], (old) => {
          if (!old) return old;
          return {
            ...old,
            schedules: old.schedules.map((s) =>
              s.id === schedule.id ? { ...s, status: 'published' as const } : s,
            ),
          };
        });
        setSelectedSchedule((prev) =>
          prev?.id === schedule.id ? { ...prev, status: 'published' } : prev,
        );
      }
    } finally {
      setMarkingPublished(false);
    }
  };

  return (
    <PageShell className="max-w-6xl space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="View tasks, content, assets, and publishing schedules by date"
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" className="h-9 w-9 p-0" onClick={prevMonth}>
              <ChevronLeft size={16} className="text-[var(--text)]" />
            </Button>
            <span className="min-w-[9rem] px-2 text-center text-sm font-semibold text-[var(--text)]">
              {MONTH_NAMES[month]} {year}
            </span>
            <Button type="button" variant="secondary" className="h-9 w-9 p-0" onClick={nextMonth}>
              <ChevronRight size={16} className="text-[var(--text)]" />
            </Button>
          </div>
        }
      />

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#2563eb' }} />
          Tasks
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#7c3aed' }} />
          Publishing schedules
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#0891b2' }} />
          Content
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#6b7280' }} />
          Assets
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Error banner */}
        {error && (
          <Card className="border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] lg:col-span-3">
            <CardContent className="flex items-center gap-3 py-3 text-sm text-[var(--color-danger)]">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
              {DAY_NAMES.map((d) => (
                <div
                  key={d}
                  className="py-3 text-center text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7">
                {[...Array(35)].map((_, i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse border-b border-r"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Empty cells before month start */}
                {[...Array(firstDay)].map((_, i) => (
                  <div
                    key={`e-${i}`}
                    className="h-24 border-b border-r"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', opacity: 0.4 }}
                  />
                ))}

                {/* Day cells */}
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const isToday =
                    year === today.getFullYear() &&
                    month === today.getMonth() &&
                    day === today.getDate();
                  const isSelected = selectedDay === day;
                  const dayTasks = tasksByDay[day] ?? [];
                  const dayAssets = assetsByDay[day] ?? [];
                  const daySchedules = schedulesByDay[day] ?? [];
                  const dayContent = contentByDay[day] ?? [];
                  const totalVisible =
                    dayTasks.length + dayAssets.length + daySchedules.length + dayContent.length;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className="h-24 cursor-pointer overflow-hidden border-b border-r p-1 transition-colors"
                      style={{
                        borderColor: 'var(--border)',
                        background: isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                      }}
                    >
                      <div
                        className="mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                        style={{
                          background: isToday ? 'var(--accent)' : 'transparent',
                          color: isToday ? 'white' : 'var(--text)',
                        }}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {daySchedules.slice(0, 2).map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center gap-0.5 truncate rounded px-1 py-0.5 text-xs"
                            style={{
                              background: `${scheduleStatusColor(s.status)}20`,
                              color: scheduleStatusColor(s.status),
                            }}
                          >
                            <Send size={8} className="shrink-0" />
                            <span className="truncate">
                              {s.client_name ??
                                (s as unknown as { content_item?: { title: string } }).content_item
                                  ?.title ??
                                s.asset?.name ??
                                'Schedule'}
                            </span>
                          </div>
                        ))}
                        {dayContent.slice(0, Math.max(0, 2 - daySchedules.length)).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-0.5 truncate rounded px-1 py-0.5 text-xs"
                            style={{ background: 'rgba(8,145,178,0.12)', color: '#0891b2' }}
                          >
                            <FileText size={8} className="shrink-0" />
                            <span className="truncate">{c.title}</span>
                          </div>
                        ))}
                        {dayTasks
                          .slice(0, Math.max(0, 2 - daySchedules.length - dayContent.length))
                          .map((t) => (
                            <div
                              key={t.id}
                              className="truncate rounded px-1 py-0.5 text-xs"
                              style={{
                                background: `${priorityColor(t.priority)}20`,
                                color: priorityColor(t.priority),
                              }}
                            >
                              {t.title}
                            </div>
                          ))}
                        {dayAssets
                          .slice(
                            0,
                            Math.max(
                              0,
                              2 - daySchedules.length - dayContent.length - dayTasks.length,
                            ),
                          )
                          .map((a) => (
                            <div
                              key={a.id}
                              className="truncate rounded px-1 py-0.5 text-xs"
                              style={{
                                background: 'rgba(99,102,241,0.12)',
                                color: 'var(--accent)',
                              }}
                            >
                              {a.name}
                            </div>
                          ))}
                        {totalVisible > 2 && (
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            +{totalVisible - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Detail panel */}
        <div>
          <Card className="sticky top-6">
            <CardContent className="space-y-4">
              {selectedDay ? (
                <>
                  <h3 className="text-sm font-semibold text-[var(--text)]">
                    {MONTH_NAMES[month]} {selectedDay}, {year}
                  </h3>

                  {selectedTasks.length === 0 &&
                  selectedAssets.length === 0 &&
                  selectedSchedules.length === 0 &&
                  selectedContent.length === 0 ? (
                    <p className="py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Nothing scheduled for this day
                    </p>
                  ) : (
                    <>
                      {/* Publishing schedules */}
                      {selectedSchedules.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <Send size={14} style={{ color: '#7c3aed' }} />
                            <span
                              className="text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              PUBLISHING ({selectedSchedules.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {selectedSchedules.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => setSelectedSchedule(s)}
                                className="w-full rounded-lg p-2.5 text-left transition-opacity hover:opacity-80"
                                style={{
                                  background: 'var(--surface-2)',
                                  border:
                                    selectedSchedule?.id === s.id
                                      ? '1.5px solid var(--accent)'
                                      : '1.5px solid transparent',
                                }}
                              >
                                <p
                                  className="truncate text-sm font-medium"
                                  style={{ color: 'var(--text)' }}
                                >
                                  {s.asset?.name ?? 'Asset'}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                    style={{
                                      background: `${scheduleStatusColor(s.status)}20`,
                                      color: scheduleStatusColor(s.status),
                                    }}
                                  >
                                    {s.status}
                                  </span>
                                  {s.platforms.slice(0, 2).map((p) => (
                                    <span
                                      key={p}
                                      className="rounded px-1.5 py-0.5 text-[10px]"
                                      style={{
                                        background: 'var(--surface)',
                                        color: 'var(--text-secondary)',
                                      }}
                                    >
                                      {platformLabel(p)}
                                    </span>
                                  ))}
                                  {s.post_types.slice(0, 2).map((pt) => (
                                    <span
                                      key={pt}
                                      className="rounded px-1.5 py-0.5 text-[10px]"
                                      style={{
                                        background: 'rgba(99,102,241,0.1)',
                                        color: 'var(--accent)',
                                      }}
                                    >
                                      {postTypeLabel(pt)}
                                    </span>
                                  ))}
                                </div>
                                {s.scheduled_time && (
                                  <p
                                    className="mt-1 text-[10px]"
                                    style={{ color: 'var(--text-secondary)' }}
                                  >
                                    🕐 {s.scheduled_time.slice(0, 5)}{' '}
                                    {s.timezone !== 'UTC' ? s.timezone : ''}
                                  </p>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedTasks.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <CheckSquare size={14} style={{ color: 'var(--accent)' }} />
                            <span
                              className="text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              TASKS
                            </span>
                          </div>
                          <div className="space-y-2">
                            {selectedTasks.map((t) => {
                              const taskClient = (
                                t as unknown as { client?: { slug?: string; name?: string } }
                              ).client;
                              const taskLink = taskClient?.slug
                                ? `/clients/${taskClient.slug}/tasks`
                                : '/tasks/all';
                              return (
                                <Link
                                  key={t.id}
                                  href={taskLink}
                                  className="block rounded-lg p-2.5 transition-opacity hover:opacity-80"
                                  style={{ background: 'var(--surface-2)' }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p
                                      className="text-sm font-medium"
                                      style={{ color: 'var(--text)' }}
                                    >
                                      {t.title}
                                    </p>
                                    <ExternalLink
                                      size={11}
                                      className="mt-0.5 shrink-0"
                                      style={{ color: 'var(--text-secondary)' }}
                                    />
                                  </div>
                                  {taskClient?.name && (
                                    <p
                                      className="mt-0.5 text-xs"
                                      style={{ color: 'var(--accent)' }}
                                    >
                                      {taskClient.name}
                                    </p>
                                  )}
                                  <div className="mt-1 flex gap-2">
                                    <span
                                      className="rounded px-1.5 py-0.5 text-xs"
                                      style={{
                                        background: `${priorityColor(t.priority)}20`,
                                        color: priorityColor(t.priority),
                                      }}
                                    >
                                      {t.priority}
                                    </span>
                                    <span
                                      className="text-xs"
                                      style={{ color: 'var(--text-secondary)' }}
                                    >
                                      {t.status.replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {selectedAssets.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <FolderOpen size={14} style={{ color: 'var(--accent)' }} />
                            <span
                              className="text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              ASSETS
                            </span>
                          </div>
                          <div className="space-y-2">
                            {selectedAssets.map((a) => (
                              <Link
                                key={a.id}
                                href="/assets"
                                className="block rounded-lg p-2.5 transition-opacity hover:opacity-80"
                                style={{ background: 'var(--surface-2)' }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p
                                    className="truncate text-sm font-medium"
                                    style={{ color: 'var(--text)' }}
                                  >
                                    {a.name}
                                  </p>
                                  <ExternalLink
                                    size={11}
                                    className="mt-0.5 shrink-0"
                                    style={{ color: 'var(--text-secondary)' }}
                                  />
                                </div>
                                {a.client_name && (
                                  <p className="mt-0.5 text-xs" style={{ color: 'var(--accent)' }}>
                                    {a.client_name}
                                  </p>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedContent.length > 0 && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <FileText size={14} style={{ color: '#0891b2' }} />
                            <span
                              className="text-xs font-semibold"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              CONTENT ({selectedContent.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {selectedContent.map((c) => {
                              const contentClient = (
                                c as unknown as { client?: { slug?: string; name?: string } }
                              ).client;
                              const contentLink = contentClient?.slug
                                ? `/clients/${contentClient.slug}/content`
                                : '/content';
                              return (
                                <Link
                                  key={c.id}
                                  href={contentLink}
                                  className="block rounded-lg p-2.5 transition-opacity hover:opacity-80"
                                  style={{ background: 'var(--surface-2)' }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p
                                      className="truncate text-sm font-medium"
                                      style={{ color: 'var(--text)' }}
                                    >
                                      {c.title}
                                    </p>
                                    <ExternalLink
                                      size={11}
                                      className="mt-0.5 shrink-0"
                                      style={{ color: 'var(--text-secondary)' }}
                                    />
                                  </div>
                                  {contentClient?.name && (
                                    <p
                                      className="mt-0.5 text-xs"
                                      style={{ color: 'var(--accent)' }}
                                    >
                                      {contentClient.name}
                                    </p>
                                  )}
                                  <span
                                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                                    style={{ background: 'rgba(8,145,178,0.12)', color: '#0891b2' }}
                                  >
                                    {c.status.replace(/_/g, ' ')}
                                  </span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar
                    size={28}
                    className="mb-3 opacity-40"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Click a day to see scheduled items
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Schedule detail sheet */}
      {selectedSchedule && (
        <AppModal
          open
          onClose={() => setSelectedSchedule(null)}
          title="Publishing Schedule"
          subtitle={selectedSchedule.asset?.name ?? 'Unknown asset'}
          icon={<Send size={15} />}
          size="sm"
          bodyClassName="space-y-4"
          footer={
            selectedSchedule.status !== 'published' && selectedSchedule.status !== 'cancelled' ? (
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => void handleMarkPublished(selectedSchedule)}
                disabled={markingPublished}
              >
                {markingPublished ? 'Marking…' : '✓ Mark as Published'}
              </Button>
            ) : undefined
          }
        >
          {/* Asset name */}
          <div>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              ASSET
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {selectedSchedule.asset?.name ?? 'Unknown asset'}
            </p>
          </div>
          {/* Client */}
          {selectedSchedule.client_name && (
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                CLIENT
              </p>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {selectedSchedule.client_name}
              </p>
            </div>
          )}
          {/* Date / Time */}
          <div className="flex gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                DATE
              </p>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {selectedSchedule.scheduled_date}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                TIME
              </p>
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                {selectedSchedule.scheduled_time?.slice(0, 5)}{' '}
                {selectedSchedule.timezone !== 'UTC' ? selectedSchedule.timezone : 'UTC'}
              </p>
            </div>
          </div>
          {/* Status */}
          <div>
            <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              STATUS
            </p>
            <span
              className="rounded px-2 py-0.5 text-xs font-medium capitalize"
              style={{
                background: `${scheduleStatusColor(selectedSchedule.status)}20`,
                color: scheduleStatusColor(selectedSchedule.status),
              }}
            >
              {selectedSchedule.status}
            </span>
          </div>
          {/* Platforms */}
          {selectedSchedule.platforms.length > 0 && (
            <div>
              <p
                className="mb-1.5 text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                PLATFORMS
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedSchedule.platforms.map((p) => (
                  <span
                    key={p}
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                  >
                    {platformLabel(p)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Post types */}
          {selectedSchedule.post_types.length > 0 && (
            <div>
              <p
                className="mb-1.5 text-xs font-semibold"
                style={{ color: 'var(--text-secondary)' }}
              >
                POST TYPES
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedSchedule.post_types.map((pt) => (
                  <span
                    key={pt}
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
                  >
                    {postTypeLabel(pt)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Caption */}
          {selectedSchedule.caption && (
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                CAPTION
              </p>
              <p className="whitespace-pre-line text-sm" style={{ color: 'var(--text)' }}>
                {selectedSchedule.caption}
              </p>
            </div>
          )}
          {/* Notes */}
          {selectedSchedule.notes && (
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                NOTES
              </p>
              <p className="whitespace-pre-line text-sm" style={{ color: 'var(--text-secondary)' }}>
                {selectedSchedule.notes}
              </p>
            </div>
          )}
        </AppModal>
      )}
    </PageShell>
  );
}
