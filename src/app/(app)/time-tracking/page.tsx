'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Plus, Clock, Trash2, X, Check } from 'lucide-react';
import type { TimeEntry, Task, Client } from '@/lib/types';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function fetchEntries(): Promise<TimeEntry[]> {
  const res = await fetch('/api/time-entries?limit=100');
  const json = await res.json() as { success: boolean; entries: TimeEntry[] };
  if (!json.success) throw new Error('Failed to load time entries');
  return json.entries;
}

async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks?limit=200');
  const json = await res.json() as { success: boolean; tasks?: Task[] } | Task[];
  if (Array.isArray(json)) return json;
  return (json as { tasks?: Task[] }).tasks ?? [];
}

async function fetchClients(): Promise<Client[]> {
  const { createClient } = await import('@/lib/supabase/client');
  const sb = createClient();
  const { data } = await sb.from('clients').select('id, name').order('name').limit(200);
  return (data ?? []) as Client[];
}

export default function TimeTrackingPage() {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading, refetch: refetchEntries } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries'],
    queryFn:  fetchEntries,
    // No polling - timer elapsed is tracked client-side; refetch only after mutations
    staleTime: 30_000,
  });

  const { data: tasks  = [] } = useQuery<Task[]>({ queryKey: ['tasks-select'], queryFn: fetchTasks });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['clients-list'], queryFn: fetchClients });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    description: '', task_id: '', client_id: '',
    duration_hours: '', duration_minutes: '', billable: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Live elapsed for running timer
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningEntry = entries.find(e => e.is_running);

  useEffect(() => {
    if (runningEntry) {
      const tick = () => {
        setElapsed(Math.floor((Date.now() - new Date(runningEntry.started_at).getTime()) / 1000));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [runningEntry?.id, runningEntry?.started_at]);

  const handleStartStop = async () => {
    if (runningEntry) {
      // Stop
      await fetch(`/api/time-entries/${runningEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_running: false }),
      });
    } else {
      // Start
      await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_running: true }),
      });
    }
    void queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    void refetchEntries();
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveErr(null);
    try {
      const durationSeconds = (parseInt(form.duration_hours || '0') * 3600) + (parseInt(form.duration_minutes || '0') * 60);
      if (durationSeconds <= 0) throw new Error('Duration must be greater than 0');

      const now      = new Date();
      const startedAt = new Date(now.getTime() - durationSeconds * 1000).toISOString();

      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description:      form.description || null,
          task_id:          form.task_id  || null,
          client_id:        form.client_id || null,
          started_at:       startedAt,
          ended_at:         now.toISOString(),
          duration_seconds: durationSeconds,
          is_running:       false,
          billable:         form.billable,
        }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to save entry');
      setModalOpen(false);
      setForm({ description: '', task_id: '', client_id: '', duration_hours: '', duration_minutes: '', billable: false });
      void queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this time entry?')) return;
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
    void queryClient.invalidateQueries({ queryKey: ['time-entries'] });
  };

  // Total today
  const todayKey = new Date().toISOString().split('T')[0];
  const todayTotal = entries
    .filter(e => e.started_at.startsWith(todayKey) && !e.is_running)
    .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Time Tracking</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Track time per task and client
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} /> Log Time
        </button>
      </div>

      {/* Timer card */}
      <div className="rounded-2xl border p-6 flex items-center gap-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>
            {runningEntry ? 'Timer running' : 'No active timer'}
          </p>
          <p className="text-4xl font-mono font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {formatDuration(runningEntry ? elapsed : 0)}
          </p>
          {runningEntry?.task?.title && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{runningEntry.task.title}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => void handleStartStop()}
            className="flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: runningEntry ? '#ef4444' : 'var(--accent)' }}
          >
            {runningEntry ? <><Square size={16} /> Stop</> : <><Play size={16} /> Start</>}
          </button>
          {todayTotal > 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Today: {formatDuration(todayTotal)}
            </p>
          )}
        </div>
      </div>

      {/* Entries list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
        </div>
      ) : entries.filter(e => !e.is_running).length === 0 ? (
        <div className="text-center py-16">
          <Clock size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No time entries yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            Recent Entries
          </div>
          {entries.filter(e => !e.is_running).map((entry, i, arr) => (
            <div
              key={entry.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--surface-2)] transition-colors group"
              style={{
                background: 'var(--surface)',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {entry.description ?? entry.task?.title ?? 'No description'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {entry.client?.name && <span className="mr-2">{entry.client.name}</span>}
                  {formatDate(entry.started_at)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {entry.billable && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>
                    Billable
                  </span>
                )}
                <span className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>
                  {formatDuration(entry.duration_seconds ?? 0)}
                </span>
                <button
                  onClick={() => void handleDelete(entry.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-500 hover:bg-[var(--surface)] transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual log modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Log Time Manually</h2>
              <button onClick={() => setModalOpen(false)} style={{ color: 'var(--text-secondary)' }}><X size={18} /></button>
            </div>
            <form onSubmit={e => void handleManualEntry(e)} className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What did you work on?"
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Hours</label>
                  <input
                    type="number" min="0" max="24"
                    value={form.duration_hours}
                    onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Minutes</label>
                  <input
                    type="number" min="0" max="59"
                    value={form.duration_minutes}
                    onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Task (optional)</label>
                <select
                  value={form.task_id}
                  onChange={e => setForm(f => ({ ...f, task_id: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <option value="">— No task —</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1" style={{ color: 'var(--text)' }}>Client (optional)</label>
                <select
                  value={form.client_id}
                  onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  <option value="">— No client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.billable}
                  onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm" style={{ color: 'var(--text)' }}>Billable time</span>
              </label>
              {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60 flex items-center gap-2"
                  style={{ background: 'var(--accent)' }}
                >
                  {saving ? 'Saving…' : <><Check size={14} /> Log Time</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
