'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, FolderOpen, AlertCircle, Send, X } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Task, Asset, PublishingSchedule } from '@/lib/types';
import { PLATFORMS, POST_TYPES } from '@/components/publishing/SchedulePublishingModal';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function priorityColor(p: string): string {
  if (p === 'high')   return '#dc2626';
  if (p === 'medium') return '#d97706';
  return '#2563eb';
}

function approvalColor(s?: string | null): string {
  if (s === 'approved')  return '#16a34a';
  if (s === 'rejected')  return '#dc2626';
  if (s === 'scheduled') return '#7c3aed';
  if (s === 'published') return '#0891b2';
  return '#6b7280';
}

function scheduleStatusColor(s?: string): string {
  if (s === 'published')      return '#0891b2';
  if (s === 'approved')       return '#16a34a';
  if (s === 'pending_review') return '#d97706';
  if (s === 'missed')         return '#dc2626';
  if (s === 'cancelled')      return '#6b7280';
  if (s === 'draft')          return '#9ca3af';
  return '#7c3aed'; // scheduled (default)
}

function platformLabel(value: string): string {
  const p = PLATFORMS.find(pl => pl.value === value);
  return p ? p.label : value;
}

function postTypeLabel(value: string): string {
  const pt = POST_TYPES.find(t => t.value === value);
  return pt ? pt.label : value;
}

// ── Component ──────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;

export default function CalendarPage() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [assets,    setAssets]    = useState<Asset[]>([]);
  const [schedules, setSchedules] = useState<PublishingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  // Selected schedule for detail view
  const [selectedSchedule, setSelectedSchedule] = useState<PublishingSchedule | null>(null);
  const [markingPublished, setMarkingPublished] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        const pad = (n: number) => String(n).padStart(2, '0');
        const startDate = `${year}-${pad(month + 1)}-01`;
        const endDate   = `${year}-${pad(month + 1)}-${pad(getDaysInMonth(year, month))}`;

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS);
        });

        const settled = await Promise.race([
          Promise.allSettled([
            supabase.from('tasks').select('*').gte('due_date', startDate).lte('due_date', endDate),
            supabase.from('assets')
              .select('id, name, publish_date, approval_status, content_type, client_name')
              .gte('publish_date', startDate)
              .lte('publish_date', endDate),
            supabase.from('publishing_schedules')
              .select('*, asset:assets(id, name, content_type, preview_url)')
              .gte('scheduled_date', startDate)
              .lte('scheduled_date', endDate)
              .neq('status', 'cancelled')
              .order('scheduled_time', { ascending: true }),
          ]),
          timeoutPromise,
        ]);

        const [tasksRes, assetsRes, schedulesRes] = settled;

        if (tasksRes.status === 'fulfilled' && !tasksRes.value.error) {
          setTasks((tasksRes.value.data ?? []) as Task[]);
        } else {
          console.error('[calendar] tasks fetch error:', tasksRes.status === 'rejected' ? tasksRes.reason : tasksRes.value.error);
          setTasks([]);
        }
        if (assetsRes.status === 'fulfilled' && !assetsRes.value.error) {
          setAssets((assetsRes.value.data ?? []) as Asset[]);
        } else {
          console.error('[calendar] assets fetch error:', assetsRes.status === 'rejected' ? assetsRes.reason : assetsRes.value.error);
          setAssets([]);
        }
        if (schedulesRes.status === 'fulfilled' && !schedulesRes.value.error) {
          setSchedules((schedulesRes.value.data ?? []) as PublishingSchedule[]);
        } else {
          // publishing_schedules table may not exist yet — non-fatal
          console.warn('[calendar] schedules fetch error:', schedulesRes.status === 'rejected' ? schedulesRes.reason : schedulesRes.value.error);
          setSchedules([]);
        }
      } catch (err) {
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
        const msg = isTimeout
          ? 'Calendar data took too long to load. Please try again.'
          : 'Failed to load calendar data.';
        console.error('[calendar] load error:', err);
        setError(msg);
        setTasks([]);
        setAssets([]);
        setSchedules([]);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    load();
  }, [year, month]);

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

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
    const map: Record<number, Asset[]> = {};
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

  const selectedTasks     = selectedDay ? (tasksByDay[selectedDay]     ?? []) : [];
  const selectedAssets    = selectedDay ? (assetsByDay[selectedDay]    ?? []) : [];
  const selectedSchedules = selectedDay ? (schedulesByDay[selectedDay] ?? []) : [];

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
        setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, status: 'published' } : s));
        setSelectedSchedule(prev => prev?.id === schedule.id ? { ...prev, status: 'published' } : prev);
      }
    } finally {
      setMarkingPublished(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Calendar</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            View tasks, assets, and publishing schedules by date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <ChevronLeft size={16} style={{ color: 'var(--text)' }} />
          </button>
          <span
            className="text-sm font-semibold px-2 min-w-[9rem] text-center"
            style={{ color: 'var(--text)' }}
          >
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <ChevronRight size={16} style={{ color: 'var(--text)' }} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#2563eb' }} />Tasks</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#7c3aed' }} />Publishing schedules</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#6b7280' }} />Assets</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Error banner */}
        {error && (
          <div
            className="lg:col-span-3 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
              {DAY_NAMES.map(d => (
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
                    className="h-24 border-r border-b animate-pulse"
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
                    className="h-24 border-r border-b"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)', opacity: 0.4 }}
                  />
                ))}

                {/* Day cells */}
                {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const isToday = (
                    year  === today.getFullYear() &&
                    month === today.getMonth() &&
                    day   === today.getDate()
                  );
                  const isSelected    = selectedDay === day;
                  const dayTasks      = tasksByDay[day]      ?? [];
                  const dayAssets     = assetsByDay[day]     ?? [];
                  const daySchedules  = schedulesByDay[day]  ?? [];
                  const totalVisible  = dayTasks.length + dayAssets.length + daySchedules.length;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className="h-24 border-r border-b p-1 cursor-pointer overflow-hidden transition-colors"
                      style={{
                        borderColor: 'var(--border)',
                        background:  isSelected ? 'var(--accent-soft)' : 'var(--surface)',
                      }}
                    >
                      <div
                        className="text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1"
                        style={{
                          background: isToday ? 'var(--accent)' : 'transparent',
                          color:      isToday ? 'white' : 'var(--text)',
                        }}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5 overflow-hidden">
                        {daySchedules.slice(0, 2).map(s => (
                          <div
                            key={s.id}
                            className="text-xs px-1 py-0.5 rounded truncate flex items-center gap-0.5"
                            style={{
                              background: `${scheduleStatusColor(s.status)}20`,
                              color:      scheduleStatusColor(s.status),
                            }}
                          >
                            <Send size={8} className="shrink-0" />
                            <span className="truncate">{s.client_name ?? s.asset?.name ?? 'Schedule'}</span>
                          </div>
                        ))}
                        {dayTasks.slice(0, Math.max(0, 2 - daySchedules.length)).map(t => (
                          <div
                            key={t.id}
                            className="text-xs px-1 py-0.5 rounded truncate"
                            style={{
                              background: `${priorityColor(t.priority)}20`,
                              color:      priorityColor(t.priority),
                            }}
                          >
                            {t.title}
                          </div>
                        ))}
                        {dayAssets.slice(0, Math.max(0, 2 - daySchedules.length - dayTasks.length)).map(a => (
                          <div
                            key={a.id}
                            className="text-xs px-1 py-0.5 rounded truncate"
                            style={{
                              background: `${approvalColor(a.approval_status)}20`,
                              color:      approvalColor(a.approval_status),
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
          </div>
        </div>

        {/* Detail panel */}
        <div>
          <div
            className="rounded-2xl border p-5 space-y-4 sticky top-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {selectedDay ? (
              <>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {MONTH_NAMES[month]} {selectedDay}, {year}
                </h3>

                {selectedTasks.length === 0 && selectedAssets.length === 0 && selectedSchedules.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>
                    Nothing scheduled for this day
                  </p>
                ) : (
                  <>
                    {/* Publishing schedules */}
                    {selectedSchedules.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Send size={14} style={{ color: '#7c3aed' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            PUBLISHING ({selectedSchedules.length})
                          </span>
                        </div>
                        <div className="space-y-2">
                          {selectedSchedules.map(s => (
                            <button
                              key={s.id}
                              onClick={() => setSelectedSchedule(s)}
                              className="w-full rounded-lg p-2.5 text-left transition-opacity hover:opacity-80"
                              style={{ background: 'var(--surface-2)', border: selectedSchedule?.id === s.id ? '1.5px solid var(--accent)' : '1.5px solid transparent' }}
                            >
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                {s.asset?.name ?? 'Asset'}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ background: `${scheduleStatusColor(s.status)}20`, color: scheduleStatusColor(s.status) }}
                                >
                                  {s.status}
                                </span>
                                {s.platforms.slice(0, 2).map(p => (
                                  <span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                                    {platformLabel(p)}
                                  </span>
                                ))}
                                {s.post_types.slice(0, 2).map(pt => (
                                  <span key={pt} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                                    {postTypeLabel(pt)}
                                  </span>
                                ))}
                              </div>
                              {s.scheduled_time && (
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                                  🕐 {s.scheduled_time.slice(0, 5)} {s.timezone !== 'UTC' ? s.timezone : ''}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTasks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckSquare size={14} style={{ color: 'var(--accent)' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            TASKS
                          </span>
                        </div>
                        <div className="space-y-2">
                          {selectedTasks.map(t => (
                            <div
                              key={t.id}
                              className="rounded-lg p-2.5"
                              style={{ background: 'var(--surface-2)' }}
                            >
                              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.title}</p>
                              <div className="flex gap-2 mt-1">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: `${priorityColor(t.priority)}20`,
                                    color:      priorityColor(t.priority),
                                  }}
                                >
                                  {t.priority}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {t.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedAssets.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen size={14} style={{ color: 'var(--accent)' }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            ASSETS
                          </span>
                        </div>
                        <div className="space-y-2">
                          {selectedAssets.map(a => (
                            <div
                              key={a.id}
                              className="rounded-lg p-2.5"
                              style={{ background: 'var(--surface-2)' }}
                            >
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                {a.name}
                              </p>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: `${approvalColor(a.approval_status)}20`,
                                    color:      approvalColor(a.approval_status),
                                  }}
                                >
                                  {a.approval_status ?? 'pending'}
                                </span>
                                {a.client_name && (
                                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {a.client_name}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar size={28} className="mb-3 opacity-40" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Click a day to see scheduled items
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule detail sheet */}
      {selectedSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setSelectedSchedule(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border shadow-2xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Send size={16} style={{ color: '#7c3aed' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>Publishing Schedule</span>
              </div>
              <button onClick={() => setSelectedSchedule(null)} className="opacity-60 hover:opacity-100 transition-opacity">
                <X size={16} style={{ color: 'var(--text)' }} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Asset name */}
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>ASSET</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {selectedSchedule.asset?.name ?? 'Unknown asset'}
                </p>
              </div>
              {/* Client */}
              {selectedSchedule.client_name && (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>CLIENT</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{selectedSchedule.client_name}</p>
                </div>
              )}
              {/* Date / Time */}
              <div className="flex gap-4">
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>DATE</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{selectedSchedule.scheduled_date}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>TIME</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{selectedSchedule.scheduled_time?.slice(0, 5)} {selectedSchedule.timezone !== 'UTC' ? selectedSchedule.timezone : 'UTC'}</p>
                </div>
              </div>
              {/* Status */}
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>STATUS</p>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium capitalize"
                  style={{ background: `${scheduleStatusColor(selectedSchedule.status)}20`, color: scheduleStatusColor(selectedSchedule.status) }}
                >
                  {selectedSchedule.status}
                </span>
              </div>
              {/* Platforms */}
              {selectedSchedule.platforms.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>PLATFORMS</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSchedule.platforms.map(p => (
                      <span key={p} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
                        {platformLabel(p)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Post types */}
              {selectedSchedule.post_types.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>POST TYPES</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSchedule.post_types.map(pt => (
                      <span key={pt} className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
                        {postTypeLabel(pt)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Caption */}
              {selectedSchedule.caption && (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>CAPTION</p>
                  <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text)' }}>{selectedSchedule.caption}</p>
                </div>
              )}
              {/* Notes */}
              {selectedSchedule.notes && (
                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>NOTES</p>
                  <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{selectedSchedule.notes}</p>
                </div>
              )}
              {/* Actions */}
              {selectedSchedule.status !== 'published' && selectedSchedule.status !== 'cancelled' && (
                <button
                  onClick={() => void handleMarkPublished(selectedSchedule)}
                  disabled={markingPublished}
                  className="w-full h-10 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#0891b2' }}
                >
                  {markingPublished ? 'Marking…' : '✓ Mark as Published'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
