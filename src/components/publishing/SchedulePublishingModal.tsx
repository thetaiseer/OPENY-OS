'use client';

/**
 * SchedulePublishingModal
 *
 * A full-featured modal for scheduling an asset for social media publishing.
 * Can be opened from:
 *  - An asset card (existing asset)
 *  - The upload flow after a successful upload
 *
 * Supports:
 *  - Multi-select platforms
 *  - Multi-select post types
 *  - Date / time / timezone
 *  - Caption & notes
 *  - Optional assignee
 *  - Optional reminder
 */

import { useState, useEffect } from 'react';
import {
  Calendar, Clock, Globe,
  CheckCircle, AlertCircle, Loader2, Send,
} from 'lucide-react';
import SelectDropdown from '@/components/ui/SelectDropdown';
import AppModal from '@/components/ui/AppModal';
import type { Asset, Client, TeamMember, PublishingSchedule } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PLATFORMS = [
  { value: 'instagram',      label: 'Instagram',      color: '#e1306c',  displayColor: '#e1306c' },
  { value: 'facebook',       label: 'Facebook',       color: '#1877f2',  displayColor: '#1877f2' },
  { value: 'tiktok',         label: 'TikTok',         color: '#010101',  displayColor: '#010101' },
  { value: 'linkedin',       label: 'LinkedIn',       color: '#0077b5',  displayColor: '#0077b5' },
  { value: 'twitter',        label: 'X / Twitter',    color: '#1da1f2',  displayColor: '#1da1f2' },
  { value: 'snapchat',       label: 'Snapchat',       color: '#fffc00',  displayColor: '#f59e0b' },
  { value: 'youtube_shorts', label: 'YouTube Shorts', color: '#ff0000',  displayColor: '#ff0000' },
] as const;

/** Returns the display-safe background color for a platform (avoids near-white for Snapchat). */
export function getPlatformDisplayColor(value: string): string {
  const p = PLATFORMS.find(pl => pl.value === value);
  return p ? p.displayColor : '#7c3aed';
}

export const POST_TYPES = [
  { value: 'post',     label: 'Post',     desc: 'Regular feed post' },
  { value: 'reel',     label: 'Reel',     desc: 'Short-form video' },
  { value: 'carousel', label: 'Carousel', desc: 'Multi-image slideshow' },
  { value: 'story',    label: 'Story',    desc: '24h story format' },
] as const;

const STATUSES = [
  { value: 'draft',          label: 'Draft' },
  { value: 'scheduled',      label: 'Scheduled' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved',       label: 'Approved' },
] as const;

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '15', label: '15 minutes before' },
  { value: '30', label: '30 minutes before' },
  { value: '60', label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440', label: '1 day before' },
];

// ── Platform badge ─────────────────────────────────────────────────────────────

function PlatformBadge({ value }: { value: string }) {
  const p = PLATFORMS.find(pl => pl.value === value);
  if (!p) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium text-white"
      style={{ background: getPlatformDisplayColor(value) }}
    >
      {p.label}
    </span>
  );
}

function PostTypeBadge({ value }: { value: string }) {
  const pt = POST_TYPES.find(t => t.value === value);
  if (!pt) return null;
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent)' }}
    >
      {pt.label}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function guessTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all';
const inputStyle = { background: 'var(--surface)', color: 'var(--text)', border: '1.5px solid var(--border)' };

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SchedulePublishingModalProps {
  /** The asset to schedule. Required. */
  asset: Asset;
  /** Pre-selected client (optional – taken from asset.client_id if absent) */
  clientId?: string;
  clientName?: string;
  /** Available clients for the selector */
  clients?: Client[];
  /** Available team members for assignee */
  team?: TeamMember[];
  /** Called after a schedule is successfully created */
  onCreated?: (schedule: PublishingSchedule) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SchedulePublishingModal({
  asset,
  clientId: initialClientId,
  clientName: initialClientName,
  clients = [],
  team = [],
  onCreated,
  onClose,
}: SchedulePublishingModalProps) {

  // ── Form state ─────────────────────────────────────────────────────────────
  const [platforms,        setPlatforms]        = useState<string[]>([]);
  const [postTypes,        setPostTypes]        = useState<string[]>([]);
  const [scheduledDate,    setScheduledDate]    = useState(todayIso());
  const [scheduledTime,    setScheduledTime]    = useState('09:00');
  const [timezone,         setTimezone]         = useState(guessTimezone);
  const [caption,          setCaption]          = useState('');
  const [notes,            setNotes]            = useState('');
  const [status,           setStatus]           = useState('scheduled');
  const [assignedTo,       setAssignedTo]       = useState('');
  const [reminderMinutes,  setReminderMinutes]  = useState('');
  const [clientId,         setClientId]         = useState(initialClientId ?? asset.client_id ?? '');
  const [clientNameVal,    setClientNameVal]    = useState(initialClientName ?? asset.client_name ?? '');

  // ── UI state ───────────────────────────────────────────────────────────────
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Sync client when prop changes (e.g. after asset loads)
  useEffect(() => {
    if (initialClientId)   setClientId(initialClientId);
    if (initialClientName) setClientNameVal(initialClientName);
  }, [initialClientId, initialClientName]);

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const togglePlatform = (value: string) =>
    setPlatforms(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]);

  const togglePostType = (value: string) =>
    setPostTypes(prev => prev.includes(value) ? prev.filter(p => p !== value) : [...prev, value]);

  const handleClientChange = (name: string) => {
    setClientNameVal(name);
    const found = clients.find(c => c.name === name);
    setClientId(found?.id ?? '');
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const canSubmit = platforms.length > 0 && postTypes.length > 0 && !!scheduledDate;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        asset_id:        asset.id,
        client_id:       clientId   || null,
        client_name:     clientNameVal || null,
        scheduled_date:  scheduledDate,
        scheduled_time:  scheduledTime ? `${scheduledTime}:00` : '09:00:00',
        timezone,
        platforms,
        post_types:      postTypes,
        caption:         caption  || null,
        notes:           notes    || null,
        status,
        assigned_to:     assignedTo || null,
        reminder_minutes: reminderMinutes ? parseInt(reminderMinutes, 10) : null,
        create_task:     true,
      };

      const res = await fetch('/api/publishing-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json() as { success: boolean; schedule?: PublishingSchedule; error?: string };

      if (!res.ok || !json.success) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }

      setSuccess(true);
      onCreated?.(json.schedule!);

      // Auto-close after brief success flash
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppModal
      open
      onClose={onClose}
      title="Schedule Publishing"
      subtitle={asset.name}
      icon={<Send size={15} />}
      size="md"
      bodyClassName="space-y-5"
      footer={!success ? (
        <>
          <button
            type="button"
            onClick={onClose}
            className="openy-modal-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || saving}
            className="openy-modal-btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : <><Send size={14} /> Schedule Publishing</>}
          </button>
        </>
      ) : undefined}
    >

        {/* Success state */}
        {success && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
            <CheckCircle size={40} style={{ color: '#16a34a' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              Publishing scheduled!
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              A task has been created automatically.
            </p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

            {/* Error */}
            {error && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Client */}
            {clients.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  CLIENT
                </label>
                <SelectDropdown
                  fullWidth
                  value={clientNameVal}
                  onChange={handleClientChange}
                  placeholder="— Select a client —"
                  options={[
                    { value: '', label: '— Select a client —' },
                    ...clients.map(c => ({ value: c.name, label: c.name })),
                  ]}
                />
              </div>
            )}

            {/* Platforms */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                PLATFORMS <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => {
                  const selected = platforms.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => togglePlatform(p.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                      style={{
                        background:   selected ? getPlatformDisplayColor(p.value) : 'var(--surface-2)',
                        color:        selected ? (p.value === 'tiktok' ? 'white' : p.value === 'snapchat' ? '#1a1a1a' : 'white') : 'var(--text)',
                        borderColor:  selected ? getPlatformDisplayColor(p.value) : 'var(--border)',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              {platforms.length === 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Select at least one platform
                </p>
              )}
            </div>

            {/* Post types */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                POST TYPE <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {POST_TYPES.map(pt => {
                  const selected = postTypes.includes(pt.value);
                  return (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => togglePostType(pt.value)}
                      className="flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all"
                      style={{
                        background:  selected ? 'rgba(99,102,241,0.12)' : 'var(--surface-2)',
                        borderColor: selected ? 'var(--accent)' : 'var(--border)',
                        minWidth: '90px',
                      }}
                    >
                      <span
                        className="text-xs font-semibold"
                        style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}
                      >
                        {pt.label}
                      </span>
                      <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {pt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected preview */}
            {(platforms.length > 0 || postTypes.length > 0) && (
              <div
                className="rounded-xl px-3 py-2.5 flex flex-wrap gap-1.5 items-center"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Publishing as:</span>
                {platforms.map(p => <PlatformBadge key={p} value={p} />)}
                {postTypes.map(pt => <PostTypeBadge key={pt} value={pt} />)}
              </div>
            )}

            {/* Date / Time / Timezone row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Calendar size={11} className="inline mr-1" />DATE <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  className={inputCls}
                  style={inputStyle}
                  value={scheduledDate}
                  min={todayIso()}
                  onChange={e => setScheduledDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Clock size={11} className="inline mr-1" />TIME
                </label>
                <input
                  type="time"
                  className={inputCls}
                  style={inputStyle}
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Globe size={11} className="inline mr-1" />TIMEZONE
                </label>
                <SelectDropdown
                  fullWidth
                  value={timezone}
                  onChange={setTimezone}
                  options={COMMON_TIMEZONES.map(tz => ({ value: tz, label: tz }))}
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                STATUS
              </label>
              <SelectDropdown
                fullWidth
                value={status}
                onChange={setStatus}
                options={STATUSES.map(s => ({ value: s.value, label: s.label }))}
              />
            </div>

            {/* Caption */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                CAPTION / NOTES
              </label>
              <textarea
                rows={3}
                placeholder="Write caption, hashtags, or notes for the publisher…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                style={inputStyle}
                value={caption}
                onChange={e => setCaption(e.target.value)}
              />
            </div>

            {/* Internal notes */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                INTERNAL NOTES (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Internal notes only visible to your team…"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-none"
                style={inputStyle}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Assignee */}
            {team.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  ASSIGN TO (optional)
                </label>
                <SelectDropdown
                  fullWidth
                  value={assignedTo}
                  onChange={setAssignedTo}
                  placeholder="— Unassigned —"
                  options={[
                    { value: '', label: '— Unassigned —' },
                    ...team.map(m => ({ value: m.id, label: m.full_name })),
                  ]}
                />
              </div>
            )}

            {/* Reminder */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                REMINDER (optional)
              </label>
              <SelectDropdown
                fullWidth
                value={reminderMinutes}
                onChange={setReminderMinutes}
                options={REMINDER_OPTIONS.map(r => ({ value: r.value, label: r.label }))}
              />
            </div>

          </div>
        )}

    </AppModal>
  );
}
