'use client';

/**
 * NewTaskModal
 *
 * A comprehensive task-creation modal that adapts its fields based on
 * the selected task category. Supports:
 *   - All core task fields
 *   - Content / publishing conditional sections
 *   - Inline file upload to Supabase Storage (mapped to the selected client)
 *   - Smart automation (asset linking, activity log)
 */

import { useState, useEffect, useRef } from 'react';
import {
  X, Plus, Upload, Loader2, Check, AlertCircle,
  Calendar, Clock, Globe, User, Tag, Send,
  Paperclip, ChevronDown, FileText,
} from 'lucide-react';
import { PLATFORMS, POST_TYPES } from '@/components/publishing/SchedulePublishingModal';
import SelectDropdown from '@/components/ui/SelectDropdown';
import type { Client, TeamMember, TaskCategory, Task } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const TASK_CATEGORIES: { value: TaskCategory; label: string; description: string }[] = [
  { value: 'internal_task',    label: 'Internal Task',     description: 'Team work, meetings, internal processes' },
  { value: 'content_creation', label: 'Content Creation',  description: 'Writing, design, creative work for clients' },
  { value: 'design_task',      label: 'Design Task',       description: 'Visual design, branding, graphics' },
  { value: 'approval_task',    label: 'Approval Task',     description: 'Requires review and approval from stakeholders' },
  { value: 'publishing_task',  label: 'Publishing Task',   description: 'Social media scheduling and publishing' },
  { value: 'asset_upload_task',label: 'Asset Upload Task', description: 'File delivery and asset management' },
  { value: 'follow_up_task',   label: 'Follow-up Task',    description: 'Client follow-up, reminders, check-ins' },
];

const CONTENT_PURPOSES = [
  { value: 'awareness',       label: 'Awareness' },
  { value: 'engagement',      label: 'Engagement' },
  { value: 'promotion',       label: 'Promotion' },
  { value: 'branding',        label: 'Branding' },
  { value: 'lead_generation', label: 'Lead Generation' },
  { value: 'announcement',    label: 'Announcement' },
  { value: 'offer_campaign',  label: 'Offer / Campaign' },
];

const POST_CONTENT_TYPES = [
  { value: 'post',            label: 'Post' },
  { value: 'reel',            label: 'Reel' },
  { value: 'carousel',        label: 'Carousel' },
  { value: 'story',           label: 'Story' },
  { value: 'post_story',      label: 'Post + Story' },
  { value: 'reel_story',      label: 'Reel + Story' },
  { value: 'carousel_story',  label: 'Carousel + Story' },
];

const UPLOAD_MAIN_CATEGORIES = [
  { value: 'social-media', label: 'Social Media' },
  { value: 'videos',       label: 'Videos'       },
  { value: 'designs',      label: 'Designs'       },
  { value: 'documents',    label: 'Documents'     },
  { value: 'other',        label: 'Other'         },
] as const;

const UPLOAD_MAIN_CATEGORY_OPTIONS = UPLOAD_MAIN_CATEGORIES.map(c => ({ value: c.value, label: c.label }));

const COMMON_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Sao_Paulo', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowMonthKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const inputCls = 'w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]';
const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' };

// Determines which categories need content/publishing fields
const NEEDS_CONTENT = new Set<TaskCategory>(['content_creation', 'publishing_task']);
const NEEDS_PLATFORMS = new Set<TaskCategory>(['publishing_task']);
const NEEDS_ASSET_UPLOAD = new Set<TaskCategory>(['asset_upload_task', 'publishing_task', 'content_creation']);
const INTERNAL_ONLY = new Set<TaskCategory>(['internal_task']);

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadState {
  file: File | null;
  mainCategory: string;
  uploading: boolean;
  uploadedAssetId: string | null;
  error: string | null;
}

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
  clients: Client[];
  team: TeamMember[];
  /** Pre-selected client id */
  initialClientId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewTaskModal({
  open, onClose, onCreated, clients, team, initialClientId = '',
}: NewTaskModalProps) {
  // ── Core fields ──────────────────────────────────────────────────────────
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [clientId, setClientId]   = useState(initialClientId);
  const [assignedTo, setAssigned] = useState('');
  const [priority, setPriority]   = useState('medium');
  const [status, setStatus]       = useState('todo');
  const [dueDate, setDueDate]     = useState(todayStr());
  const [dueTime, setDueTime]     = useState('');
  const [timezone, setTimezone]   = useState('UTC');
  const [taskCategory, setCategory] = useState<TaskCategory | ''>('');
  const [tags, setTags]           = useState('');

  // ── Content / publishing fields ───────────────────────────────────────────
  const [postContentType, setPostContentType] = useState('');
  const [contentPurpose, setContentPurpose]   = useState('');
  const [caption, setCaption]                 = useState('');
  const [selectedPlatforms, setPlatforms]     = useState<string[]>([]);
  const [selectedPostTypes, setPostTypes]     = useState<string[]>([]);

  // ── File upload ───────────────────────────────────────────────────────────
  const [uploadState, setUpload] = useState<UploadState>({
    file: null, mainCategory: 'social-media', uploading: false,
    uploadedAssetId: null, error: null,
  });
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Submission ────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setTitle(''); setDesc(''); setClientId(initialClientId);
      setAssigned(''); setPriority('medium'); setStatus('todo');
      setDueDate(todayStr()); setDueTime(''); setTimezone('UTC');
      setCategory(''); setTags('');
      setPostContentType(''); setContentPurpose('');
      setCaption(''); setPlatforms([]); setPostTypes([]);
      setUpload({ file: null, mainCategory: 'social-media', uploading: false, uploadedAssetId: null, error: null });
      setShowUpload(false); setSaving(false); setError(null);
    }
  }, [open, initialClientId]);

  // Auto-show upload section for asset-centric categories
  useEffect(() => {
    if (taskCategory && NEEDS_ASSET_UPLOAD.has(taskCategory as TaskCategory)) {
      setShowUpload(true);
    }
  }, [taskCategory]);

  if (!open) return null;

  const isInternal = taskCategory === 'internal_task';
  const needsContent = taskCategory && NEEDS_CONTENT.has(taskCategory as TaskCategory);
  const needsPlatforms = taskCategory && NEEDS_PLATFORMS.has(taskCategory as TaskCategory);
  const selectedClient = clients.find(c => c.id === clientId);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function togglePlatform(p: string) {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  function togglePostType(pt: string) {
    setPostTypes(prev => prev.includes(pt) ? prev.filter(x => x !== pt) : [...prev, pt]);
  }

  // ── File upload handler ───────────────────────────────────────────────────
  //
  // Uses the same presigned-URL architecture as the main upload queue:
  //   1. POST /api/upload/presign  → presigned PUT URL + storageKey + displayName
  //   2. PUT file directly to R2   → no bytes through the Next.js server
  //   3. POST /api/upload/complete → save metadata to DB → return asset id

  interface PresignResponse  { uploadUrl: string; storageKey: string; publicUrl: string; displayName: string }
  interface CompleteResponse { success: boolean; stage?: string; asset?: { id?: string }; error?: string }

  async function handleFileUpload(): Promise<string | null> {
    if (!uploadState.file) return null;
    if (!selectedClient) {
      setUpload(u => ({ ...u, error: 'Please select a client before uploading a file.' }));
      return null;
    }

    setUpload(u => ({ ...u, uploading: true, error: null }));

    const file      = uploadState.file;
    const monthKey  = nowMonthKey();

    try {
      // Phase 1 — obtain a presigned PUT URL from the server.
      const presignRes = await fetch('/api/upload/presign', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          fileName:     file.name,
          fileType:     file.type || 'application/octet-stream',
          fileSize:     file.size,
          clientName:   selectedClient.name,
          clientId,
          mainCategory: uploadState.mainCategory,
          monthKey,
        }),
      });

      if (!presignRes.ok) {
        let errMsg = `Failed to obtain upload URL (HTTP ${presignRes.status})`;
        try { const j = await presignRes.json() as { error?: string }; if (j.error) errMsg = j.error; } catch { /* ignore */ }
        setUpload(u => ({ ...u, uploading: false, error: errMsg }));
        return null;
      }

      const presign = await presignRes.json() as PresignResponse;

      // Phase 2 — upload file bytes directly to R2 (no server proxy).
      const putRes = await fetch(presign.uploadUrl, {
        method:  'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body:    file,
      });

      if (!putRes.ok) {
        setUpload(u => ({ ...u, uploading: false, error: `Upload to storage failed (HTTP ${putRes.status})` }));
        return null;
      }

      // Phase 3 — save asset metadata to the database.
      const completeRes = await fetch('/api/upload/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          storageKey:   presign.storageKey,
          displayName:  presign.displayName,
          clientName:   selectedClient.name,
          clientId,
          fileType:     file.type || 'application/octet-stream',
          fileSize:     file.size,
          mainCategory: uploadState.mainCategory,
          monthKey,
        }),
      });

      const complete = await completeRes.json() as CompleteResponse;

      if (complete.success && complete.asset?.id) {
        setUpload(u => ({ ...u, uploading: false, uploadedAssetId: complete.asset!.id! }));
        return complete.asset.id;
      }

      const errMsg = typeof complete.error === 'string' ? complete.error : 'Failed to save file in system';
      setUpload(u => ({ ...u, uploading: false, error: errMsg }));
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload error';
      setUpload(u => ({ ...u, uploading: false, error: msg }));
      return null;
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Task title is required'); return; }
    if (!dueDate) { setError('Due date is required'); return; }
    if (!isInternal && !clientId) { setError('Please select a client'); return; }
    if (!isInternal && !assignedTo) { setError('Please assign this task to a team member'); return; }

    setSaving(true);
    setError(null);

    // Upload file first if pending
    let assetIdToLink = uploadState.uploadedAssetId;
    if (uploadState.file && !uploadState.uploadedAssetId) {
      assetIdToLink = await handleFileUpload();
      if (!assetIdToLink && uploadState.file) {
        // upload error already set; abort task creation
        setSaving(false);
        return;
      }
    }

    const body: Record<string, unknown> = {
      title: title.trim(),
      status,
      priority,
      due_date: dueDate,
    };

    if (description.trim()) body.description = description.trim();
    if (clientId)            body.client_id   = clientId;
    if (assignedTo)          body.assigned_to = assignedTo;
    if (dueTime)             body.due_time    = dueTime;
    if (timezone)            body.timezone    = timezone;
    if (taskCategory)        body.task_category = taskCategory;
    if (contentPurpose)      body.content_purpose = contentPurpose;
    if (caption.trim())      body.caption = caption.trim();
    if (assetIdToLink)       body.asset_id = assetIdToLink;
    if (selectedClient)      body.client_name = selectedClient.name;

    if (selectedPlatforms.length > 0) body.platforms  = selectedPlatforms;
    if (selectedPostTypes.length > 0) body.post_types = selectedPostTypes;

    if (tags.trim()) {
      body.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    try {
      const res  = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { success: boolean; task?: Task; error?: string };

      if (!res.ok || !json.success) {
        setError(json.error ?? 'Failed to create task');
        setSaving(false);
        return;
      }

      onCreated(json.task!);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setSaving(false);
    }
  }

  // ── Category selector ────────────────────────────────────────────────────

  function CategoryPicker() {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Task Category</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TASK_CATEGORIES.map(cat => {
            const active = taskCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(active ? '' : cat.value)}
                title={cat.description}
                className="text-left px-3 py-2 rounded-lg text-xs font-medium transition-all border"
                style={{
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--text)',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Platform multi-select ─────────────────────────────────────────────────

  function PlatformPicker() {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
          <Send size={13} /> Target Platform(s)
        </label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => {
            const active = selectedPlatforms.includes(p.value);
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePlatform(p.value)}
                className="h-7 px-3 rounded-full text-xs font-medium transition-all border"
                style={{
                  background: active ? p.displayColor : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--text)',
                  borderColor: active ? p.displayColor : 'var(--border)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Post type multi-select ────────────────────────────────────────────────

  function PostTypePicker() {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Post Type(s)</label>
        <div className="flex flex-wrap gap-2">
          {POST_TYPES.map(pt => {
            const active = selectedPostTypes.includes(pt.value);
            return (
              <button
                key={pt.value}
                type="button"
                onClick={() => togglePostType(pt.value)}
                className="h-7 px-3 rounded-full text-xs font-medium transition-all border"
                style={{
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--text)',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {pt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── File upload section ───────────────────────────────────────────────────

  function UploadSection() {
    return (
      <div className="space-y-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
            <Paperclip size={13} /> Attach File to Task
          </span>
          <button
            type="button"
            onClick={() => setShowUpload(false)}
            className="p-1 rounded-lg hover:bg-[var(--surface)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={14} />
          </button>
        </div>

        {!selectedClient && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle size={12} /> Select a client first — file will be stored in their R2 storage folder.
          </p>
        )}

        {/* File picker */}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0] ?? null;
              setUpload(u => ({ ...u, file: f, uploadedAssetId: null, error: null }));
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="h-8 px-3 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--surface)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <Upload size={12} className="inline mr-1" />
            {uploadState.file ? 'Change File' : 'Choose File'}
          </button>
          {uploadState.file && (
            <span className="text-xs truncate max-w-[180px]" style={{ color: 'var(--text-secondary)' }}>
              {uploadState.file.name}
            </span>
          )}
          {uploadState.uploadedAssetId && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check size={12} /> Uploaded
            </span>
          )}
        </div>

        {/* Content type picker */}
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>File Category</label>
          <SelectDropdown
            fullWidth
            value={uploadState.mainCategory}
            onChange={v => setUpload(u => ({ ...u, mainCategory: v }))}
            options={UPLOAD_MAIN_CATEGORY_OPTIONS}
          />
        </div>

        {/* Storage path info */}
        {selectedClient && (
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            📁 Will be saved to: <strong>Clients / {selectedClient.name} / {new Date().getFullYear()} / ...</strong>
          </p>
        )}

        {uploadState.error && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={12} />{uploadState.error}
          </p>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>New Task</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Fill in the details below to create a connected task
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* ── Task Category ── */}
            <CategoryPicker />

            {/* ── Title ── */}
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Title *</label>
              <input
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                className={inputCls}
                style={inputStyle}
                placeholder="What needs to be done?"
              />
            </div>

            {/* ── Description ── */}
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
                style={inputStyle}
                placeholder="Provide additional context or instructions..."
              />
            </div>

            {/* ── Client + Assignee ── */}
            {!isInternal && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
                    <User size={12} /> Client {isInternal ? '' : '*'}
                  </label>
                  <SelectDropdown
                    fullWidth
                    value={clientId}
                    onChange={setClientId}
                    placeholder="— Select client —"
                    options={[
                      { value: '', label: '— Select client —' },
                      ...clients.map(c => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Assignee *</label>
                  <SelectDropdown
                    fullWidth
                    value={assignedTo}
                    onChange={setAssigned}
                    placeholder="— Unassigned —"
                    options={[
                      { value: '', label: '— Unassigned —' },
                      ...team.map(m => ({ value: m.id, label: m.full_name })),
                    ]}
                  />
                </div>
              </div>
            )}

            {/* For internal tasks: only show assignee */}
            {isInternal && (
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Assignee</label>
                <SelectDropdown
                  fullWidth
                  value={assignedTo}
                  onChange={setAssigned}
                  placeholder="— Unassigned —"
                  options={[
                    { value: '', label: '— Unassigned —' },
                    ...team.map(m => ({ value: m.id, label: m.full_name })),
                  ]}
                />
              </div>
            )}

            {/* ── Priority + Status ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Priority</label>
                <SelectDropdown
                  fullWidth
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: 'low',    label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high',   label: 'High' },
                  ]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Status</label>
                <SelectDropdown
                  fullWidth
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'todo',           label: 'To Do' },
                    { value: 'in_progress',    label: 'In Progress' },
                    { value: 'in_review',      label: 'In Review' },
                    { value: 'waiting_client', label: 'Waiting on Client' },
                    ...(taskCategory === 'publishing_task' ? [{ value: 'scheduled', label: 'Scheduled' }] : []),
                  ]}
                />
              </div>
            </div>

            {/* ── Due Date + Time + Timezone ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
                  <Calendar size={12} /> Due Date *
                </label>
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
                  <Clock size={12} /> Due Time
                </label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
                  <Globe size={12} /> Timezone
                </label>
                <SelectDropdown
                  fullWidth
                  value={timezone}
                  onChange={setTimezone}
                  options={COMMON_TIMEZONES.map(tz => ({ value: tz, label: tz }))}
                />
              </div>
            </div>

            {/* ── Tags ── */}
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
                <Tag size={12} /> Tags
              </label>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                className={inputCls}
                style={inputStyle}
                placeholder="design, urgent, social (comma-separated)"
              />
            </div>

            {/* ── CONTENT SECTION (conditional) ── */}
            {(needsContent || postContentType || contentPurpose) && (
              <div className="space-y-4 p-4 rounded-xl border" style={{ borderColor: 'var(--accent)', borderStyle: 'dashed' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                  Content Details
                </p>

                {/* Content type */}
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Content Format</label>
                  <div className="flex flex-wrap gap-2">
                    {POST_CONTENT_TYPES.map(ct => {
                      const active = postContentType === ct.value;
                      return (
                        <button
                          key={ct.value}
                          type="button"
                          onClick={() => setPostContentType(active ? '' : ct.value)}
                          className="h-7 px-3 rounded-full text-xs font-medium border transition-all"
                          style={{
                            background: active ? 'var(--accent)' : 'var(--surface-2)',
                            color: active ? '#fff' : 'var(--text)',
                            borderColor: active ? 'var(--accent)' : 'var(--border)',
                          }}
                        >
                          {ct.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content purpose */}
                <div className="space-y-1">
                  <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Content Purpose</label>
                  <SelectDropdown
                    fullWidth
                    value={contentPurpose}
                    onChange={setContentPurpose}
                    placeholder="— Select purpose —"
                    options={[
                      { value: '', label: '— Select purpose —' },
                      ...CONTENT_PURPOSES.map(cp => ({ value: cp.value, label: cp.label })),
                    ]}
                  />
                </div>

                {/* Caption */}
                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-1" style={{ color: 'var(--text)' }}>
                    <FileText size={12} /> Caption / Content Notes
                  </label>
                  <textarea
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]"
                    style={inputStyle}
                    placeholder="Draft caption, key messaging, hashtags..."
                  />
                </div>
              </div>
            )}

            {/* ── PLATFORMS SECTION (conditional) ── */}
            {(needsPlatforms || selectedPlatforms.length > 0) && (
              <div className="space-y-4 p-4 rounded-xl border" style={{ borderColor: '#7c3aed', borderStyle: 'dashed' }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7c3aed' }}>
                  Publishing Details
                </p>
                <PlatformPicker />
                <PostTypePicker />
              </div>
            )}

            {/* Show content fields toggle for relevant categories */}
            {taskCategory && !INTERNAL_ONLY.has(taskCategory as TaskCategory) && !needsContent && (
              <button
                type="button"
                onClick={() => setPostContentType('post')}
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Add content / post details
              </button>
            )}

            {/* Show publishing fields toggle */}
            {taskCategory && !needsPlatforms && !INTERNAL_ONLY.has(taskCategory as TaskCategory) && selectedPlatforms.length === 0 && (
              <button
                type="button"
                onClick={() => setPlatforms(['instagram'])}
                className="text-xs text-[#7c3aed] hover:underline flex items-center gap-1"
              >
                <Send size={12} /> Add publishing / platform details
              </button>
            )}

            {/* ── FILE UPLOAD SECTION ── */}
            {showUpload ? (
              <UploadSection />
            ) : (
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="text-xs hover:underline flex items-center gap-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Paperclip size={12} /> Attach a file (uploads to client&apos;s R2 storage)
              </button>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 bg-red-50">
                <AlertCircle size={14} />{error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between px-6 py-4 border-t shrink-0"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {taskCategory && (
                <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  {TASK_CATEGORIES.find(c => c.value === taskCategory)?.label}
                </span>
              )}
              {selectedClient && (
                <span className="px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  {selectedClient.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-lg text-sm font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-5 rounded-lg text-sm font-medium text-white disabled:opacity-60 flex items-center gap-2 transition-opacity"
                style={{ background: 'var(--accent)' }}
              >
                {saving ? (
                  <><Loader2 size={14} className="animate-spin" /> Creating…</>
                ) : (
                  <><Check size={14} /> Create Task</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
