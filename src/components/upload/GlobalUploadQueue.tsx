'use client';

/**
 * GlobalUploadQueue — Fixed-position upload progress panel.
 *
 * Mounted once in the app layout so it stays visible across all routes.
 * Shows the current upload queue with per-file progress and action buttons
 * (pause, resume, retry, remove).  The panel can be minimised to a compact
 * status bar.
 */

import { useState } from 'react';
import {
  Upload, ChevronDown, ChevronUp, CheckCircle, AlertCircle,
  Loader2, Pause, Play, RotateCcw, Trash2, File, FileImage,
  FileText, FileVideo, FileAudio,
} from 'lucide-react';
import { useUpload, type UploadQueueItem, type UploadStatus } from '@/lib/upload-context';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isImageFile(name: string, type?: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) ||
    (type?.startsWith('image/') ?? false);
}

function getDisplayName(item: UploadQueueItem): string {
  const base = item.uploadName.trim();
  const originalName = item.file?.name ?? item.renamedFileName ?? 'Unknown file';
  const ext = originalName.includes('.')
    ? `.${originalName.split('.').pop()!.toLowerCase()}`
    : '';
  if (!base) return originalName;
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

function FileTypeIcon({ item }: { item: UploadQueueItem }) {
  const name = item.file?.name ?? item.renamedFileName ?? '';
  const type = item.file?.type;
  const sz = 13;
  if (isImageFile(name, type))
    return <FileImage size={sz} style={{ color: '#3b82f6' }} />;
  if (/\.pdf$/i.test(name) || type === 'application/pdf')
    return <FileText size={sz} style={{ color: '#ef4444' }} />;
  if (/\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name) || type?.startsWith('video/'))
    return <FileVideo size={sz} style={{ color: '#8b5cf6' }} />;
  if (type?.startsWith('audio/'))
    return <FileAudio size={sz} style={{ color: '#06b6d4' }} />;
  return <File size={sz} style={{ color: 'var(--text-secondary)' }} />;
}

const STATUS_LABEL: Record<UploadStatus, string> = {
  queued:    'Queued',
  uploading: 'Uploading',
  paused:    'Paused',
  saving:    'Saving…',
  success:   'Complete',
  failed:    'Failed',
};

const STATUS_COLOR: Record<UploadStatus, string> = {
  queued:    'var(--text-secondary)',
  uploading: 'var(--accent)',
  paused:    '#f59e0b',
  saving:    'var(--accent)',
  success:   '#16a34a',
  failed:    '#ef4444',
};

// ── Per-item row ──────────────────────────────────────────────────────────────

function QueueRow({ item }: { item: UploadQueueItem }) {
  const { pauseItem, resumeItem, retryItem, removeItem } = useUpload();
  const isActive   = item.status === 'uploading' || item.status === 'saving';
  const isComplete = item.status === 'success';
  const isFailed   = item.status === 'failed';
  const isPaused   = item.status === 'paused';
  const fileSize   = item.file?.size ?? 0;

  const barColor = isFailed ? '#ef4444' : isPaused ? '#f59e0b' : 'var(--accent)';

  return (
    <div
      className="flex items-start gap-2.5 p-3 rounded-xl"
      style={{ background: 'var(--surface-2)' }}
    >
      {/* Thumbnail / icon */}
      <div
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden mt-0.5"
        style={{ background: 'var(--surface)' }}
      >
        {item.previewUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
          : <FileTypeIcon item={item} />
        }
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Name + status icon */}
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold truncate flex-1" style={{ color: 'var(--text)' }}>
            {getDisplayName(item)}
          </p>
          {isComplete && <CheckCircle size={13} style={{ color: '#16a34a', flexShrink: 0 }} />}
          {isFailed    && <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />}
          {isActive    && <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />}
        </div>

        {/* Size · status · progress% */}
        <div className="flex items-center gap-1.5 text-xs">
          {fileSize > 0 && (
            <span style={{ color: 'var(--text-secondary)' }}>{formatSize(fileSize)}</span>
          )}
          {fileSize > 0 && <span style={{ color: 'var(--border)' }}>·</span>}
          <span style={{ color: STATUS_COLOR[item.status], fontWeight: 600 }}>
            {STATUS_LABEL[item.status]}
          </span>
          {isActive && (
            <span className="tabular-nums font-bold ml-auto" style={{ color: 'var(--accent)' }}>
              {item.progress}%
            </span>
          )}
        </div>

        {/* Progress bar */}
        {(isActive || isPaused) && (
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${item.progress}%`, background: barColor }}
            />
          </div>
        )}

        {/* Error message */}
        {isFailed && item.error && (
          <p className="text-xs leading-tight line-clamp-2" style={{ color: '#ef4444', opacity: 0.85 }}>
            {item.error}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-1 shrink-0 mt-0.5">
        {isActive && (
          <button onClick={() => pauseItem(item.id)} title="Pause"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: 'var(--text)' }}>
            <Pause size={10} />
          </button>
        )}
        {isPaused && item.file && (
          <button onClick={() => resumeItem(item.id)} title="Resume"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: 'var(--accent)' }}>
            <Play size={10} />
          </button>
        )}
        {(isFailed || (isPaused && !item.file)) && (
          <button onClick={() => retryItem(item.id)} title="Retry"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: '#f59e0b' }}>
            <RotateCcw size={10} />
          </button>
        )}
        <button onClick={() => removeItem(item.id)} title="Remove"
          disabled={isActive}
          className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function GlobalUploadQueue() {
  const { queue, clearCompleted } = useUpload();
  const [minimised, setMinimised] = useState(false);

  if (queue.length === 0) return null;

  const completed  = queue.filter(i => i.status === 'success').length;
  const failed     = queue.filter(i => i.status === 'failed').length;
  const active     = queue.filter(i => i.status === 'uploading' || i.status === 'saving').length;
  const overallPct = queue.length > 0
    ? Math.round(queue.reduce((sum, i) => sum + i.progress, 0) / queue.length)
    : 0;

  const allDone = active === 0 && queue.every(i => i.status === 'success' || i.status === 'failed');

  const titleText = active > 0
    ? `Uploading ${active} file${active !== 1 ? 's' : ''}…`
    : allDone
    ? [
        completed > 0 && `${completed} uploaded`,
        failed > 0 && `${failed} failed`,
      ].filter(Boolean).join(' · ') || 'Done'
    : `${completed}/${queue.length} files`;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 rounded-2xl border overflow-hidden"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow:   '0 8px 32px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.10)',
        width:       320,
        maxHeight:   minimised ? 'auto' : 460,
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none"
        style={{
          background:   'var(--surface-2)',
          borderBottom: minimised ? 'none' : '1px solid var(--border)',
        }}
        onClick={() => setMinimised(m => !m)}
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
          style={{
            background: active > 0
              ? 'var(--accent-soft)'
              : allDone && failed === 0
              ? 'rgba(22,163,74,0.10)'
              : 'var(--surface)',
          }}
        >
          {active > 0
            ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
            : allDone && failed === 0
            ? <CheckCircle size={14} style={{ color: '#16a34a' }} />
            : <Upload size={14} style={{ color: 'var(--accent)' }} />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text)' }}>
            {titleText}
          </p>
          {!minimised && active > 0 && (
            <p className="text-xs tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>
              {overallPct}% overall
            </p>
          )}
        </div>

        <button
          className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={minimised ? 'Expand upload queue' : 'Minimise upload queue'}
          onClick={e => { e.stopPropagation(); setMinimised(m => !m); }}
        >
          {minimised ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Overall progress bar ── */}
      {!minimised && active > 0 && (
        <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {/* ── Queue list ── */}
      {!minimised && (
        <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 340 }}>
          {queue.map(item => <QueueRow key={item.id} item={item} />)}
          {completed > 0 && (
            <button
              onClick={e => { e.stopPropagation(); clearCompleted(); }}
              className="w-full text-xs py-2 rounded-xl font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)' }}
            >
              Clear {completed} completed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
