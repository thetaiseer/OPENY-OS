'use client';

/**
 * GlobalUploadQueue — Fixed-position upload progress panel.
 *
 * Each upload item card shows:
 *   - file name + icon
 *   - status label (Queued / Preparing / Uploading / Retrying / Completing /
 *     Saving to system / Completed / Failed)
 *   - uploaded bytes / total bytes (during upload)
 *   - ETA (during upload)
 *   - progress bar
 *   - cancel button (while actively uploading)
 *   - retry / reconcile buttons on failure
 *   - expandable technical error detail
 */

import { useState } from 'react';
import {
  Upload, ChevronDown, ChevronUp, CheckCircle, AlertCircle, AlertTriangle,
  Loader2, RotateCcw, RefreshCw, Trash2, X, File, FileImage,
  FileText, FileVideo, FileAudio, ChevronRight,
} from 'lucide-react';
import { useUpload, type UploadItem, type UploadStatus } from '@/lib/upload-context';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(uploadedBytes: number, totalBytes: number, startMs: number | null): string | null {
  if (!startMs || uploadedBytes <= 0 || totalBytes <= 0 || uploadedBytes >= totalBytes) return null;
  const elapsed = Date.now() - startMs;
  if (elapsed < 2000) return null; // wait 2 s before showing ETA
  const rate = uploadedBytes / elapsed; // bytes/ms
  const remaining = (totalBytes - uploadedBytes) / rate; // ms
  const secs = Math.round(remaining / 1000);
  if (secs < 5)   return 'Almost done';
  if (secs < 60)  return `~${secs}s left`;
  const mins = Math.ceil(secs / 60);
  return `~${mins}m left`;
}

function isImageFile(name: string, type: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || type.startsWith('image/');
}

function getDisplayName(item: UploadItem): string {
  const base = item.uploadName.trim();
  const ext  = item.file.name.includes('.')
    ? `.${item.file.name.split('.').pop()!.toLowerCase()}`
    : '';
  if (!base) return item.file.name;
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

function FileTypeIcon({ item }: { item: UploadItem }) {
  const { name, type } = item.file;
  const sz = 13;
  if (isImageFile(name, type))
    return <FileImage size={sz} style={{ color: '#3b82f6' }} />;
  if (/\.pdf$/i.test(name) || type === 'application/pdf')
    return <FileText  size={sz} style={{ color: '#ef4444' }} />;
  if (/\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name) || type.startsWith('video/'))
    return <FileVideo size={sz} style={{ color: '#8b5cf6' }} />;
  if (type.startsWith('audio/'))
    return <FileAudio size={sz} style={{ color: '#06b6d4' }} />;
  return <File size={sz} style={{ color: 'var(--text-secondary)' }} />;
}

// ── Stage colour map ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<UploadStatus, string> = {
  queued:        'var(--text-secondary)',
  uploading:     'var(--accent)',
  uploaded:      'var(--accent)',
  saved:         'var(--accent)',
  completed:     '#16a34a',
  failed_db:     '#d97706',
  failed_upload: '#ef4444',
};

// ── Per-item row ──────────────────────────────────────────────────────────────

function QueueRow({ item }: { item: UploadItem }) {
  const { retryItem, reconcileItem, removeItem } = useUpload();
  const [expanded, setExpanded] = useState(false);

  const isActive   = item.status === 'uploading' || item.status === 'uploaded' || item.status === 'saved';
  const isComplete = item.status === 'completed';
  const isFailedDb = item.status === 'failed_db';
  const isFailed   = item.status === 'failed_upload';
  const hasDetail  = !!item.errorDetail;

  const statusColor = STATUS_COLOR[item.status];

  // Byte progress (only meaningful when actively uploading).
  const showByteProgress =
    isActive &&
    item.status === 'uploading' &&
    item.totalBytes > 0 &&
    item.uploadedBytes >= 0;

  const eta = showByteProgress
    ? formatEta(item.uploadedBytes, item.totalBytes, item.uploadStartMs ?? null)
    : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
    >
      {/* ── Main row ── */}
      <div className="flex items-start gap-2.5 p-3">
        {/* Thumbnail / icon */}
        <div
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden mt-0.5"
          style={{ background: 'var(--surface)' }}
        >
          {item.previewUrl && isImageFile(item.file.name, item.file.type)
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
            {isComplete  && <CheckCircle   size={13} style={{ color: '#16a34a', flexShrink: 0 }} />}
            {isFailedDb  && <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0 }} />}
            {isFailed    && <AlertCircle   size={13} style={{ color: '#ef4444', flexShrink: 0 }} />}
            {isActive    && <Loader2 size={13} className="animate-spin shrink-0" style={{ color: 'var(--accent)' }} />}
          </div>

          {/* Status line */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {/* File size (total) */}
            {item.file.size > 0 && (
              <span style={{ color: 'var(--text-secondary)' }}>{formatSize(item.file.size)}</span>
            )}
            {item.file.size > 0 && <span style={{ color: 'var(--border)' }}>·</span>}

            {/* Stage label */}
            <span style={{ color: statusColor, fontWeight: 600 }}>
              {/* Use the detailed statusLabel when available */}
              {(item as UploadItem & { statusLabel?: string }).statusLabel ?? item.statusText}
            </span>

            {/* Percentage badge */}
            {isActive && item.status === 'uploading' && (
              <span className="tabular-nums font-bold ml-auto" style={{ color: 'var(--accent)' }}>
                {item.progress}%
              </span>
            )}
          </div>

          {/* Byte progress + ETA row (large files) */}
          {showByteProgress && item.totalBytes > 0 && (
            <div className="flex items-center gap-1.5 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              <span>{formatSize(item.uploadedBytes)}</span>
              <span style={{ opacity: 0.5 }}>/</span>
              <span>{formatSize(item.totalBytes)}</span>
              {eta && (
                <>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span>{eta}</span>
                </>
              )}
            </div>
          )}

          {/* Progress bar */}
          {isActive && (
            <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${item.progress}%`, background: 'var(--accent)' }}
              />
            </div>
          )}

          {/* Brief error summary (failed / failed_db) */}
          {(isFailed || isFailedDb) && item.errorDetail && (
            <p className="text-xs leading-tight line-clamp-2" style={{ color: statusColor, opacity: 0.9 }}>
              {item.errorDetail.message}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5">
          {/* Cancel — only while actively uploading */}
          {isActive && (
            <button
              onClick={() => removeItem(item.id)}
              title="Cancel upload"
              className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
            >
              <X size={10} />
            </button>
          )}
          {/* Retry — only on true upload failures */}
          {isFailed && (
            <button
              onClick={() => retryItem(item.id)}
              title="Retry upload"
              className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
              style={{ background: 'var(--surface)', color: '#f59e0b' }}
            >
              <RotateCcw size={10} />
            </button>
          )}
          {/* Reconcile — only when R2 upload succeeded but DB save failed */}
          {isFailedDb && (
            <button
              onClick={() => reconcileItem(item.id)}
              title="Retry saving to system"
              className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
              style={{ background: 'var(--surface)', color: '#d97706' }}
            >
              <RefreshCw size={10} />
            </button>
          )}
          {/* Expand details — when there's technical error info */}
          {hasDetail && (
            <button
              onClick={() => setExpanded(e => !e)}
              title={expanded ? 'Hide details' : 'Show details'}
              className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
            >
              <ChevronRight
                size={10}
                style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
              />
            </button>
          )}
          {/* Remove — only when not actively uploading */}
          {!isActive && (
            <button
              onClick={() => removeItem(item.id)}
              title="Remove"
              className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>

      {/* ── Expandable details section ── */}
      {expanded && item.errorDetail && (
        <div
          className="px-3 pb-3 pt-0 space-y-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-xs font-semibold pt-2" style={{ color: 'var(--text-secondary)' }}>
            Technical details
          </p>
          {item.errorDetail.step && (
            <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ opacity: 0.6 }}>step: </span>{item.errorDetail.step}
            </p>
          )}
          {item.errorDetail.code && (
            <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ opacity: 0.6 }}>code: </span>{item.errorDetail.code}
            </p>
          )}
          {item.errorDetail.details && (
            <p
              className="text-xs font-mono break-all leading-relaxed"
              style={{ color: 'var(--text-secondary)', opacity: 0.85 }}
            >
              {item.errorDetail.details}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function GlobalUploadQueue() {
  const { queue, clearCompleted } = useUpload();
  const [minimised, setMinimised] = useState(false);

  if (queue.length === 0) return null;

  const completed = queue.filter(i => i.status === 'completed').length;
  const failedDb  = queue.filter(i => i.status === 'failed_db').length;
  const failed    = queue.filter(i => i.status === 'failed_upload').length;
  const active    = queue.filter(i =>
    i.status === 'uploading' || i.status === 'uploaded' || i.status === 'saved',
  ).length;

  const overallPct = queue.length > 0
    ? Math.round(queue.reduce((sum, i) => sum + i.progress, 0) / queue.length)
    : 0;

  const allDone = active === 0 && queue.every(
    i => i.status === 'completed' || i.status === 'failed_db' || i.status === 'failed_upload',
  );

  const titleText = active > 0
    ? `Uploading ${active} file${active !== 1 ? 's' : ''}…`
    : allDone
    ? [
        completed > 0 && `${completed} completed`,
        failedDb  > 0 && `${failedDb} partial`,
        failed    > 0 && `${failed} failed`,
      ].filter(Boolean).join(' · ') || 'Done'
    : `${completed}/${queue.length} files`;

  const clearableCount = completed + failedDb;

  return (
    <div
      className="fixed bottom-[80px] right-5 z-[51] rounded-2xl border overflow-hidden"
      style={{
        background:  'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow:   '0 8px 32px rgba(0,0,0,0.18), 0 1.5px 6px rgba(0,0,0,0.10)',
        width:       'min(320px, calc(100vw - 24px))',
        maxHeight:   minimised ? 'auto' : 480,
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
              : allDone && failed === 0 && failedDb === 0
              ? 'rgba(22,163,74,0.10)'
              : allDone && failedDb > 0 && failed === 0
              ? 'rgba(217,119,6,0.10)'
              : 'var(--surface)',
          }}
        >
          {active > 0
            ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
            : allDone && failed === 0 && failedDb === 0
            ? <CheckCircle   size={14} style={{ color: '#16a34a' }} />
            : allDone && failedDb > 0 && failed === 0
            ? <AlertTriangle size={14} style={{ color: '#d97706' }} />
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
        <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: 360 }}>
          {queue.map(item => <QueueRow key={item.id} item={item} />)}
          {clearableCount > 0 && (
            <button
              onClick={e => { e.stopPropagation(); clearCompleted(); }}
              className="w-full text-xs py-2 rounded-xl font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)' }}
            >
              Clear {clearableCount} completed
            </button>
          )}
        </div>
      )}
    </div>
  );
}
