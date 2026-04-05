'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, FolderOpen, AlertCircle } from 'lucide-react';
import supabase from '@/lib/supabase';
import type { Task, Asset } from '@/lib/types';

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

// ── Component ──────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;

export default function CalendarPage() {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks,  setTasks]  = useState<Task[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const pad = (n: number) => String(n).padStart(2, '0');
        const startDate = `${year}-${pad(month + 1)}-01`;
        const endDate   = `${year}-${pad(month + 1)}-${pad(getDaysInMonth(year, month))}`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), FETCH_TIMEOUT_MS),
        );

        const settled = await Promise.race([
          Promise.allSettled([
            supabase.from('tasks').select('*').gte('due_date', startDate).lte('due_date', endDate),
            supabase.from('assets')
              .select('id, name, publish_date, approval_status, content_type, client_name')
              .gte('publish_date', startDate)
              .lte('publish_date', endDate),
          ]),
          timeoutPromise,
        ]);

        const [tasksRes, assetsRes] = settled;

        if (tasksRes.status === 'fulfilled' && !tasksRes.value.error) {
          setTasks((tasksRes.value.data ?? []) as Task[]);
        } else {
          const err = tasksRes.status === 'rejected' ? tasksRes.reason : tasksRes.value.error;
          console.error('[calendar] tasks fetch error:', err);
          setTasks([]);
        }
        if (assetsRes.status === 'fulfilled' && !assetsRes.value.error) {
          setAssets((assetsRes.value.data ?? []) as Asset[]);
        } else {
          const err = assetsRes.status === 'rejected' ? assetsRes.reason : assetsRes.value.error;
          console.error('[calendar] assets fetch error:', err);
          setAssets([]);
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
      } finally {
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

  const selectedTasks  = selectedDay ? (tasksByDay[selectedDay]  ?? []) : [];
  const selectedAssets = selectedDay ? (assetsByDay[selectedDay] ?? []) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Calendar</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            View tasks and assets by date
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
                  const isSelected   = selectedDay === day;
                  const dayTasks     = tasksByDay[day]  ?? [];
                  const dayAssets    = assetsByDay[day] ?? [];
                  const totalVisible = dayTasks.length + dayAssets.length;

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
                        {dayTasks.slice(0, 2).map(t => (
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
                        {dayAssets.slice(0, Math.max(0, 2 - dayTasks.length)).map(a => (
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

                {selectedTasks.length === 0 && selectedAssets.length === 0 ? (
                  <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>
                    Nothing scheduled for this day
                  </p>
                ) : (
                  <>
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
    </div>
  );
}
