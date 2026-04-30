'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Square, Plus, Clock, Trash2, Check } from 'lucide-react';
import type { TimeEntry, Task, Client } from '@/lib/types';
import FormModal from '@/components/ui/FormModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';

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
  const json = (await res.json()) as { success: boolean; entries: TimeEntry[] };
  if (!json.success) throw new Error('Failed to load time entries');
  return json.entries;
}

async function fetchTasks(): Promise<Task[]> {
  const res = await fetch('/api/tasks?limit=200');
  const json = (await res.json()) as { success: boolean; tasks?: Task[] } | Task[];
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

  const {
    data: entries = [],
    isLoading,
    refetch: refetchEntries,
  } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries'],
    queryFn: fetchEntries,
    // No polling - timer elapsed is tracked client-side; refetch only after mutations
    staleTime: 30_000,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks-select'],
    queryFn: fetchTasks,
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients-list'],
    queryFn: fetchClients,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    description: '',
    task_id: '',
    client_id: '',
    duration_hours: '',
    duration_minutes: '',
    billable: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<TimeEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState(false);

  // Live elapsed for running timer
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningEntry = entries.find((e) => e.is_running);

  useEffect(() => {
    if (runningEntry) {
      const tick = () => {
        setElapsed(Math.floor((Date.now() - new Date(runningEntry.started_at).getTime()) / 1000));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runningEntry]);

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
      const durationSeconds =
        parseInt(form.duration_hours || '0') * 3600 + parseInt(form.duration_minutes || '0') * 60;
      if (durationSeconds <= 0) throw new Error('Duration must be greater than 0');

      const now = new Date();
      const startedAt = new Date(now.getTime() - durationSeconds * 1000).toISOString();

      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description || null,
          task_id: form.task_id || null,
          client_id: form.client_id || null,
          started_at: startedAt,
          ended_at: now.toISOString(),
          duration_seconds: durationSeconds,
          is_running: false,
          billable: form.billable,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? 'Failed to save entry');
      setModalOpen(false);
      setForm({
        description: '',
        task_id: '',
        client_id: '',
        duration_hours: '',
        duration_minutes: '',
        billable: false,
      });
      void queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteEntry) return;
    setDeletingEntry(true);
    try {
      await fetch(`/api/time-entries/${pendingDeleteEntry.id}`, { method: 'DELETE' });
      void queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      setPendingDeleteEntry(null);
    } finally {
      setDeletingEntry(false);
    }
  };

  // Total today
  const todayKey = new Date().toISOString().split('T')[0];
  const todayTotal = entries
    .filter((e) => e.started_at.startsWith(todayKey) && !e.is_running)
    .reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Time Tracking
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Track time per task and client
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={16} /> Log Time
        </button>
      </div>

      {/* Timer card */}
      <div
        className="flex items-center gap-6 rounded-2xl border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex-1">
          <p
            className="mb-1 text-xs font-medium uppercase tracking-wide"
            style={{ color: 'var(--text-secondary)' }}
          >
            {runningEntry ? 'Timer running' : 'No active timer'}
          </p>
          <p className="font-mono text-4xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>
            {formatDuration(runningEntry ? elapsed : 0)}
          </p>
          {runningEntry?.task?.title && (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {runningEntry.task.title}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => void handleStartStop()}
            className="flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-[var(--accent-foreground)] transition-all hover:opacity-90"
            style={{ background: runningEntry ? 'var(--text-primary)' : 'var(--accent)' }}
          >
            {runningEntry ? (
              <>
                <Square size={16} /> Stop
              </>
            ) : (
              <>
                <Play size={16} /> Start
              </>
            )}
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
          <div
            className="h-6 w-6 animate-spin rounded-full border-2"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
          />
        </div>
      ) : entries.filter((e) => !e.is_running).length === 0 ? (
        <div className="py-16 text-center">
          <Clock
            size={36}
            className="mx-auto mb-3 opacity-30"
            style={{ color: 'var(--text-secondary)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No time entries yet.
          </p>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            Recent Entries
          </div>
          {entries
            .filter((e) => !e.is_running)
            .map((entry, i, arr) => (
              <div
                key={entry.id}
                className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                style={{
                  background: 'var(--surface)',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : undefined,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {entry.description ?? entry.task?.title ?? 'No description'}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {entry.client?.name && <span className="mr-2">{entry.client.name}</span>}
                    {formatDate(entry.started_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {entry.billable && (
                    <span
                      className="rounded px-1.5 py-0.5 text-xs"
                      style={{ background: 'var(--surface-muted)', color: 'var(--text-primary)' }}
                    >
                      Billable
                    </span>
                  )}
                  <span className="font-mono text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {formatDuration(entry.duration_seconds ?? 0)}
                  </span>
                  <button
                    onClick={() => setPendingDeleteEntry(entry)}
                    className="rounded p-1 text-red-500 opacity-0 transition-all hover:bg-[var(--surface)] group-hover:opacity-100"
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
        <FormModal
          open
          onClose={() => setModalOpen(false)}
          title="Log Time Manually"
          icon={<Clock size={15} />}
          size="sm"
          onSubmit={(e) => void handleManualEntry(e)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="openy-modal-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="openy-modal-btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  'Saving…'
                ) : (
                  <>
                    <Check size={14} /> Log Time
                  </>
                )}
              </button>
            </>
          }
        >
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What did you work on?"
              className="h-9 w-full rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
                Hours
              </label>
              <input
                type="number"
                min="0"
                max="24"
                value={form.duration_hours}
                onChange={(e) => setForm((f) => ({ ...f, duration_hours: e.target.value }))}
                placeholder="0"
                className="h-9 w-full rounded-lg px-3 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="0"
                className="h-9 w-full rounded-lg px-3 text-sm outline-none"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Task (optional)
            </label>
            <SelectDropdown
              fullWidth
              value={form.task_id}
              onChange={(v) => setForm((f) => ({ ...f, task_id: v }))}
              className="h-9 rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
              options={[
                { value: '', label: '— No task —' },
                ...tasks.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Client (optional)
            </label>
            <SelectDropdown
              fullWidth
              value={form.client_id}
              onChange={(v) => setForm((f) => ({ ...f, client_id: v }))}
              className="h-9 rounded-lg px-3 text-sm outline-none"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
              options={[
                { value: '', label: '— No client —' },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={form.billable}
              onChange={(e) => setForm((f) => ({ ...f, billable: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              Billable time
            </span>
          </label>
          {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
        </FormModal>
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteEntry)}
        title="Delete time entry"
        description="Delete this time entry? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        loading={deletingEntry}
        onCancel={() => {
          if (deletingEntry) return;
          setPendingDeleteEntry(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
