'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Eye, Download, Link, Trash2,
  File, FileText, FileImage, FileVideo, FileAudio,
  ThumbsUp, ThumbsDown, MessageSquare, Send, Calendar,
  Pencil, Check, X, Play,
} from 'lucide-react';
import { mainCategoryLabel, subCategoryLabel } from '@/lib/asset-utils';
import type { Asset } from '@/lib/types';

// ── File-type helpers ─────────────────────────────────────────────────────────

export function isImage(name: string, type?: string | null): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || (type?.startsWith('image/') ?? false);
}
export function isPdf(name: string, type?: string | null): boolean {
  return /\.pdf$/i.test(name) || type === 'application/pdf';
}
export function isVideo(name: string, type?: string | null): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name) || (type?.startsWith('video/') ?? false);
}
export function isAudio(name: string, type?: string | null): boolean {
  return /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(name) || (type?.startsWith('audio/') ?? false);
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatFileDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getFileTypeLabel(name: string, type?: string | null): string {
  if (type) { const sub = type.split('/')[1]?.toUpperCase(); if (sub) return sub; }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

/** Format a duration in seconds as MM:SS (or H:MM:SS for ≥ 1 hour). */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h     = Math.floor(total / 3600);
  const m     = Math.floor((total % 3600) / 60);
  const s     = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

export function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string | null; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf(name, type))   return <FileText  size={size} style={{ color: '#ef4444' }} />;
  if (isVideo(name, type)) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (isAudio(name, type)) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

const APPROVAL_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
  approved:  { bg: 'rgba(22,163,74,0.12)',   text: '#16a34a' },
  rejected:  { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626' },
  scheduled: { bg: 'rgba(124,58,237,0.12)',  text: '#7c3aed' },
  published: { bg: 'rgba(8,145,178,0.12)',   text: '#0891b2' },
};

function ApprovalBadge({ status }: { status?: string | null }) {
  const s = status ?? 'pending';
  const c = APPROVAL_COLORS[s] ?? APPROVAL_COLORS.pending;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: c.bg, color: c.text }}>
      {s}
    </span>
  );
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function monthLabel(mm: string): string {
  const idx = parseInt(mm, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return mm;
  return MONTH_NAMES[idx] ?? mm;
}

// ── Standalone helpers ────────────────────────────────────────────────────────

/** Trigger a browser download without relying on component state. */
function triggerDownload(url: string, filename: string): void {
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ── AssetCard ─────────────────────────────────────────────────────────────────

export interface AssetCardProps {
  asset: Asset;
  /** Permission flags */
  canDelete?: boolean;
  canApprove?: boolean;
  canRename?: boolean;
  /** Optional schedule summary */
  scheduleCount?: number;
  nextScheduleDate?: string | null;
  /** Selection mode */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Required action callbacks */
  onView: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  /** Optional action callbacks — button only shown when callback is provided */
  onApprove?: () => void;
  onReject?: () => void;
  onComments?: () => void;
  onRename?: (name: string) => Promise<void>;
  onSchedule?: () => void;
}

export function AssetCard({
  asset,
  canDelete = false,
  canApprove = false,
  canRename = false,
  scheduleCount,
  nextScheduleDate,
  selectable = false,
  selected = false,
  onToggleSelect,
  onView,
  onDelete,
  onCopyLink,
  onApprove,
  onReject,
  onComments,
  onRename,
  onSchedule,
}: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState(asset.name);
  const [renaming, setRenaming]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditName(asset.name); }, [asset.name]);

  const startEdit  = () => { setEditName(asset.name); setIsEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const cancelEdit = () => { setIsEditing(false); setEditName(asset.name); };
  const commitEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === asset.name || !onRename) { cancelEdit(); return; }
    setRenaming(true);
    try { await onRename(trimmed); setIsEditing(false); } finally { setRenaming(false); }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commitEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const effectiveMime = asset.file_type ?? asset.mime_type ?? undefined;
  const img     = isImage(asset.name, effectiveMime);
  const vid     = isVideo(asset.name, effectiveMime);
  const pdf     = isPdf(asset.name, effectiveMime);
  const downloadUrl = asset.download_url ?? asset.file_url;
  // For images: use thumbnail_url → preview_url → file_url.
  // For videos: use thumbnail_url only (a proper image thumbnail uploaded separately).
  // For PDFs: use preview_url (first-page render) if available.
  const imgThumbSrc = img ? (asset.thumbnail_url || asset.preview_url || asset.file_url || '') : '';
  const vidThumbSrc = vid ? (asset.thumbnail_url || '') : '';
  const pdfThumbSrc = pdf ? (asset.preview_url || asset.thumbnail_url || '') : '';
  const showImageThumb = img && !!imgThumbSrc;
  const showVideoThumb = vid && !!vidThumbSrc;
  const showPdfThumb   = pdf && !!pdfThumbSrc;

  const durationLabel = vid ? formatDuration(asset.duration_seconds) : null;

  return (
    <div
      className="group rounded-2xl border overflow-hidden flex flex-col"
      style={{
        background:   'var(--surface)',
        borderColor:  selected ? 'var(--accent)' : 'var(--border)',
        boxShadow:    selected ? '0 0 0 2px var(--accent)' : undefined,
        cursor:       selectable ? 'pointer' : undefined,
      }}
      onClick={selectable ? onToggleSelect : undefined}
    >
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }}
        onClick={selectable ? undefined : onView}
      >
        {/* Selection checkbox overlay */}
        {selectable && (
          <div
            role="checkbox"
            aria-checked={selected}
            tabIndex={0}
            className="absolute top-2 left-2 z-10 flex items-center justify-center w-5 h-5 rounded border-2 transition-colors"
            style={{
              background:  selected ? 'var(--accent)' : 'rgba(255,255,255,0.9)',
              borderColor: selected ? 'var(--accent)' : 'rgba(0,0,0,0.2)',
            }}
            onClick={e => { e.stopPropagation(); onToggleSelect?.(); }}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggleSelect?.(); } }}
          >
            {selected && <Check size={11} className="text-white" />}
          </div>
        )}
        {showImageThumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgThumbSrc}
              alt={asset.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
              <FileTypeIcon name={asset.name} type={effectiveMime} size={36} />
            </div>
          </>
        ) : showVideoThumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={vidThumbSrc}
              alt={asset.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            {/* Play icon overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              aria-hidden="true"
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
              >
                <Play size={18} className="text-white ml-0.5" />
              </div>
            </div>
            {/* Duration badge */}
            {durationLabel && (
              <div
                className="absolute bottom-1.5 right-1.5 pointer-events-none"
                aria-label={`Duration: ${durationLabel}`}
              >
                <span
                  className="text-xs font-medium tabular-nums px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(0,0,0,0.65)', color: '#fff', backdropFilter: 'blur(2px)' }}
                >
                  {durationLabel}
                </span>
              </div>
            )}
            <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
              <FileTypeIcon name={asset.name} type={effectiveMime} size={36} />
            </div>
          </>
        ) : showPdfThumb ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pdfThumbSrc}
              alt={asset.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={e => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
              <FileTypeIcon name={asset.name} type={effectiveMime} size={36} />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileTypeIcon name={asset.name} type={effectiveMime} size={36} />
          </div>
        )}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.35)', pointerEvents: selectable ? 'none' : 'auto', cursor: 'pointer' }}
          onClick={selectable ? undefined : onView}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-0.5 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={renaming}
              className="flex-1 text-sm font-medium rounded px-1 py-0.5 min-w-0 outline-none border"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--accent)' }}
            />
            <button onClick={() => void commitEdit()} disabled={renaming} title="Save" className="flex items-center justify-center h-6 w-6 rounded hover:opacity-70" style={{ color: '#16a34a' }}>
              <Check size={13} />
            </button>
            <button onClick={cancelEdit} disabled={renaming} title="Cancel" className="flex items-center justify-center h-6 w-6 rounded hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/name min-w-0">
            <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text)' }} title={asset.name}>{asset.name}</p>
            {canRename && onRename && (
              <button
                onClick={e => { e.stopPropagation(); startEdit(); }}
                title="Rename"
                className="opacity-0 group-hover/name:opacity-100 flex items-center justify-center h-5 w-5 rounded hover:opacity-70 shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Pencil size={11} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {getFileTypeLabel(asset.name, effectiveMime)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatFileSize(asset.file_size)}</span>
        </div>

        {(asset.main_category || asset.sub_category) && (
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {asset.main_category && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                {mainCategoryLabel(asset.main_category)}
              </span>
            )}
            {asset.sub_category && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                {subCategoryLabel(asset.main_category ?? '', asset.sub_category)}
              </span>
            )}
          </div>
        )}

        {(asset.client_name || asset.month_key) && (
          <div className="flex items-center gap-1 flex-wrap mt-0.5">
            {asset.client_name && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}>
                {asset.client_name}
              </span>
            )}
            {asset.month_key && asset.month_key.length >= 7 && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {monthLabel(asset.month_key.slice(5, 7))} {asset.month_key.slice(0, 4)}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <ApprovalBadge status={asset.approval_status} />
          {scheduleCount != null && scheduleCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
              <Send size={10} />{scheduleCount} scheduled
            </span>
          )}
          {nextScheduleDate && (
            <span className="text-xs flex items-center gap-0.5" style={{ color: '#7c3aed' }}>
              <Calendar size={10} />{new Date(nextScheduleDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatFileDate(asset.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
        <button
          onClick={onView}
          title="View"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <Eye size={13} /><span>View</span>
        </button>

        {onSchedule && (
          <button
            onClick={onSchedule}
            title="Schedule"
            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium hover:opacity-70"
            style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
          >
            <Send size={13} /><span>Schedule</span>
          </button>
        )}

        <a
          href={downloadUrl}
          download={asset.name}
          title="Download"
          className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <Download size={14} />
        </a>

        <button
          onClick={onCopyLink}
          title="Copy link"
          className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <Link size={14} />
        </button>

        {onComments && (
          <button
            onClick={onComments}
            title="Comments"
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <MessageSquare size={14} />
          </button>
        )}

        {canApprove && onApprove && asset.approval_status !== 'approved' && (
          <button
            onClick={onApprove}
            title="Approve"
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70"
            style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}
          >
            <ThumbsUp size={14} />
          </button>
        )}

        {canApprove && onReject && asset.approval_status !== 'rejected' && (
          <button
            onClick={onReject}
            title="Reject"
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70"
            style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}
          >
            <ThumbsDown size={14} />
          </button>
        )}

        {canDelete && (
          <button
            onClick={onDelete}
            title="Delete"
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70"
            style={{ background: 'var(--surface-2)', color: '#ef4444' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── AssetsGrid ────────────────────────────────────────────────────────────────

export interface AssetsGridProps {
  assets: Asset[];
  /** Permission flags */
  canDelete?: boolean;
  canApprove?: boolean;
  canRename?: boolean;
  /** Per-asset schedule summary — key is asset.id */
  scheduleCounts?: Record<string, { count: number; nextDate: string | null }>;
  /** Selection mode */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Required action callbacks */
  onView: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onCopyLink: (asset: Asset) => void;
  /** Optional callbacks — buttons only rendered when provided */
  onApprove?: (asset: Asset) => void;
  onReject?: (asset: Asset) => void;
  onComments?: (asset: Asset) => void;
  onRename?: (asset: Asset, name: string) => Promise<void>;
  onSchedule?: (asset: Asset) => void;
}

export function AssetsGrid({
  assets,
  canDelete = false,
  canApprove = false,
  canRename = false,
  scheduleCounts,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onView,
  onDelete,
  onCopyLink,
  onApprove,
  onReject,
  onComments,
  onRename,
  onSchedule,
}: AssetsGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {assets.map(asset => (
        <AssetCard
          key={asset.id}
          asset={asset}
          canDelete={canDelete}
          canApprove={canApprove}
          canRename={canRename}
          scheduleCount={scheduleCounts?.[asset.id]?.count}
          nextScheduleDate={scheduleCounts?.[asset.id]?.nextDate}
          selectable={selectable}
          selected={selectedIds?.has(asset.id) ?? false}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(asset.id) : undefined}
          onView={() => onView(asset)}
          onDelete={() => onDelete(asset)}
          onCopyLink={() => onCopyLink(asset)}
          onApprove={onApprove ? () => onApprove(asset) : undefined}
          onReject={onReject ? () => onReject(asset) : undefined}
          onComments={onComments ? () => onComments(asset) : undefined}
          onRename={onRename ? (name) => onRename(asset, name) : undefined}
          onSchedule={onSchedule ? () => onSchedule(asset) : undefined}
        />
      ))}
    </div>
  );
}
