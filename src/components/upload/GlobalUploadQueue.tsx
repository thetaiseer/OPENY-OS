'use client';

/**
 * GlobalUploadQueue — Fixed-position upload progress panel.
 *
 * Mounted once in the app layout so it stays visible across all routes.
 * Shows the current upload queue, per-file progress, and action buttons
 * (pause, resume, retry, remove).  The panel can be minimised to a compact
 * status bar.
 */

import { useState } from 'react';
import {
  Upload, X, ChevronDown, ChevronUp, CheckCircle, AlertCircle,
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

function FileIcon({ item }: { item: UploadQueueItem }) {
  const name = item.file?.name ?? item.renamedFileName ?? '';
  const type = item.file?.type;
  const sz   = 14;
  if (isImageFile(name, type)) return <FileImage size={sz} style={{ color: '#3b82f6' }} />;
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
  preparing: 'Preparing…',
  uploading: 'Uploading',
  paused:    'Paused',
  retrying:  'Retrying…',
  saving:    'Saving…',
  completed: 'Done',
  failed:    'Failed',
};

function statusColor(s: UploadStatus): string {
  if (s === 'completed') return '#16a34a';
  if (s === 'failed')    return '#ef4444';
  if (s === 'paused')    return '#f59e0b';
  return 'var(--accent)';
}

// ── Per-item row ──────────────────────────────────────────────────────────────

function QueueRow({ item }: { item: UploadQueueItem }) {
  const { pauseItem, resumeItem, retryItem, removeItem } = useUpload();
  const isActive   = ['preparing', 'uploading', 'retrying', 'saving'].includes(item.status);
  const isComplete = item.status === 'completed';
  const isFailed   = item.status === 'failed';
  const isPaused   = item.status === 'paused';
  const fileSize   = item.file?.size ?? 0;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl"
      style={{ background: 'var(--surface-2)' }}
    >
      {/* Thumbnail / icon */}
      <div
        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg overflow-hidden"
        style={{ background: 'var(--surface)' }}
      >
        {item.previewUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
          : <FileIcon item={item} />
        }
      </div>

      {/* Name + progress */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
          {getDisplayName(item)}
        </p>
        <div className="flex items-center gap-1.5">
          {fileSize > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {formatSize(fileSize)}
            </span>
          )}
          <span
            className="text-xs font-medium"
            style={{ color: statusColor(item.status) }}
          >
            {STATUS_LABEL[item.status]}
          </span>
          {isActive && (
            <span className="text-xs tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>
              {item.progress}%
            </span>
          )}
        </div>
        {/* Progress bar */}
        {(isActive || isPaused) && (
          <div className="w-full h-1 rounded-full" style={{ background: 'var(--border)' }}>
            <div
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: `${item.progress}%`,
                background: isPaused ? '#f59e0b' : 'var(--accent)',
              }}
            />
          </div>
        )}
        {isFailed && item.error && (
          <p className="text-xs truncate" style={{ color: '#ef4444' }}>{item.error}</p>
        )}
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-1 shrink-0">
        {isActive && (
          <button
            onClick={() => pauseItem(item.id)}
            title="Pause"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: 'var(--text)' }}
          >
            <Pause size={11} />
          </button>
        )}
        {isPaused && item.file && (
          <button
            onClick={() => resumeItem(item.id)}
            title="Resume"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: 'var(--accent)' }}
          >
            <Play size={11} />
          </button>
        )}
        {(isFailed || (isPaused && !item.file)) && (
          <button
            onClick={() => retryItem(item.id)}
            title="Retry"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: '#f59e0b' }}
          >
            <RotateCcw size={11} />
          </button>
        )}
        {isComplete && <CheckCircle size={14} style={{ color: '#16a34a' }} />}
        {isFailed && <AlertCircle size={14} style={{ color: '#ef4444' }} />}
        {isActive && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />}
        <button
          onClick={() => removeItem(item.id)}
          title="Remove"
          disabled={isActive}
          className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
        >
          <Trash2 size={11} />
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

  const completed   = queue.filter(i => i.status === 'completed').length;
  const failed      = queue.filter(i => i.status === 'failed').length;
  const active      = queue.filter(i => ['preparing', 'uploading', 'retrying', 'saving'].includes(i.status)).length;
  const overallPct  = queue.length > 0
    ? Math.round(queue.reduce((sum, i) => sum + i.progress, 0) / queue.length)
    : 0;

  const titleText = active > 0
    ? `Uploading ${active} file${active !== 1 ? 's' : ''}…`
    : `${completed}/${queue.length} uploaded${failed > 0 ? ` · ${failed} failed` : ''}`;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-80 rounded-2xl shadow-2xl border overflow-hidden"
      style={{
        background:   'var(--surface)',
        borderColor:  'var(--border)',
        maxHeight:    minimised ? 'auto' : '420px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
        style={{ background: 'var(--surface-2)', borderBottom: minimised ? 'none' : '1px solid var(--border)' }}
        onClick={() => setMinimised(m => !m)}
      >
        <Upload size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="flex-1 text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
          {titleText}
        </span>
        {!minimised && active > 0 && (
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
            {overallPct}%
          </span>
        )}
        <button
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: 'var(--text-secondary)' }}
          aria-label={minimised ? 'Expand upload queue' : 'Minimise upload queue'}
        >
          {minimised ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Overall progress bar (always visible when not minimised) */}
      {!minimised && active > 0 && (
        <div className="px-4 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {/* Queue list */}
      {!minimised && (
        <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 320 }}>
          {queue.map(item => <QueueRow key={item.id} item={item} />)}

          {completed > 0 && (
            <button
              onClick={e => { e.stopPropagation(); clearCompleted(); }}
              className="w-full text-xs py-1.5 rounded-lg hover:opacity-70 transition-opacity font-medium"
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
