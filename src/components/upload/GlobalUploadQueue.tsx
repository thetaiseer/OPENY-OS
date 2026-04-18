'use client';

/** GlobalUploadQueue — upload progress panel attached to the global FAB area. */

import { useEffect, useRef, useState } from 'react';
import {
  Upload, ChevronDown, ChevronUp, CheckCircle, AlertCircle, AlertTriangle,
  Loader2, RotateCcw, RefreshCw, Trash2, X, File, FileImage,
  FileText, FileVideo, FileAudio, Pause, Play,
} from 'lucide-react';
import { useUpload, type UploadItem, type UploadStatus } from '@/lib/upload-context';
import { useToast } from '@/lib/toast-context';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
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
  paused:        '#6366f1',
  failed_db:     '#d97706',
  failed_upload: '#ef4444',
};

// ── Per-item row ──────────────────────────────────────────────────────────────

function QueueRow({ item }: { item: UploadItem }) {
  const { retryItem, reconcileItem, pauseItem, resumeItem, removeItem } = useUpload();

  const isActive    = item.status === 'uploading' || item.status === 'uploaded' || item.status === 'saved';
  const isPaused    = item.status === 'paused';
  const isComplete  = item.status === 'completed';
  const isFailedDb  = item.status === 'failed_db';
  const isFailed    = item.status === 'failed_upload';
  const canPause    = isActive && item.isMultipart;

  const statusColor = STATUS_COLOR[item.status];

  return (
    <div
      className="rounded-2xl overflow-hidden px-3 py-2.5 space-y-2"
      style={{
        background: 'color-mix(in srgb, var(--surface-2) 88%, white 12%)',
        border: '1px solid color-mix(in srgb, var(--border) 85%, transparent)',
        transition: 'opacity 220ms var(--ease-smooth), transform 220ms var(--ease-smooth)',
        opacity: isComplete ? 0.55 : 1,
        transform: isComplete ? 'translateY(-4px)' : 'translateY(0)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full overflow-hidden"
          style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)' }}
        >
          {item.previewUrl && isImageFile(item.file.name, item.file.type)
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
            : <FileTypeIcon item={item} />
          }
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold truncate flex-1 pr-1" style={{ color: 'var(--text)' }}>
              {getDisplayName(item)}
            </p>
            <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: statusColor }}>
              {item.progress}%
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="truncate" style={{ color: statusColor, fontWeight: 600 }}>
              {item.statusLabel ?? item.statusText}
            </span>
            <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {formatSize(item.uploadedBytes)} / {formatSize(item.totalBytes)}
            </span>
          </div>

          <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${item.progress}%`,
                background: isComplete
                  ? '#16a34a'
                  : isPaused
                  ? '#6366f1'
                  : isFailed
                  ? '#ef4444'
                  : isFailedDb
                  ? '#d97706'
                  : 'var(--accent)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 justify-end">
        {isComplete  && <CheckCircle size={12} style={{ color: '#16a34a' }} />}
        {isFailedDb  && <AlertTriangle size={12} style={{ color: '#d97706' }} />}
        {isFailed    && <AlertCircle size={12} style={{ color: '#ef4444' }} />}
        {isPaused    && <Pause size={12} style={{ color: '#6366f1' }} />}
        {isActive    && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)' }} />}

        {canPause && (
          <button
            onClick={() => pauseItem(item.id)}
            title="Pause upload"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: '#6366f1' }}
          >
            <Pause size={10} />
          </button>
        )}
        {isPaused && (
          <button
            onClick={() => resumeItem(item.id)}
            title="Resume upload"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: '#6366f1' }}
          >
            <Play size={10} />
          </button>
        )}
        {(isActive || isPaused) && (
          <button
            onClick={() => removeItem(item.id)}
            title="Cancel upload"
            className="flex items-center justify-center w-6 h-6 rounded-md hover:opacity-70 transition-opacity"
            style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
          >
            <X size={10} />
          </button>
        )}
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
        {!isActive && !isPaused && (
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

      {(isFailed || isFailedDb) && item.errorDetail && (
        <div className="text-xs leading-snug" style={{ color: statusColor, opacity: 0.95 }}>
          {item.errorDetail.message}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function GlobalUploadQueue() {
  const { queue, clearCompleted, removeItem } = useUpload();
  const { toast } = useToast();
  const [minimised, setMinimised] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toastedIds = useRef<Set<string>>(new Set());
  const completedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Show a success toast the first time each item reaches 'completed'.
  useEffect(() => {
    setMounted(false);
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [queue.length]);

  useEffect(() => {
    for (const item of queue) {
      if (item.status !== 'completed') continue;
      if (completedTimers.current.has(item.id)) continue;
      const timer = setTimeout(() => {
        removeItem(item.id);
        completedTimers.current.delete(item.id);
      }, 1200);
      completedTimers.current.set(item.id, timer);
    }
    for (const [id, timer] of completedTimers.current.entries()) {
      const stillCompleted = queue.some(item => item.id === id && item.status === 'completed');
      if (!stillCompleted) {
        clearTimeout(timer);
        completedTimers.current.delete(id);
      }
    }
  }, [queue, removeItem]);

  useEffect(() => {
    return () => {
      for (const timer of completedTimers.current.values()) clearTimeout(timer);
      completedTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    for (const item of queue) {
      if (item.status === 'completed' && !toastedIds.current.has(item.id)) {
        toastedIds.current.add(item.id);
        const name = getDisplayName(item);
        toast(`"${name}" uploaded successfully`, 'success');
      }
    }
  }, [queue, toast]);

  if (queue.length === 0) return null;

  const completed = queue.filter(i => i.status === 'completed').length;
  const failedDb  = queue.filter(i => i.status === 'failed_db').length;
  const failed    = queue.filter(i => i.status === 'failed_upload').length;
  const paused    = queue.filter(i => i.status === 'paused').length;
  const active    = queue.filter(i =>
    i.status === 'uploading' || i.status === 'uploaded' || i.status === 'saved',
  ).length;

  const overallPct = queue.length > 0
    ? Math.round(queue.reduce((sum, i) => sum + i.progress, 0) / queue.length)
    : 0;

  const allDone = active === 0 && paused === 0 && queue.every(
    i => i.status === 'completed' || i.status === 'failed_db' || i.status === 'failed_upload' || i.status === 'paused',
  );

  const titleText = active > 0
    ? `Uploading ${active} file${active !== 1 ? 's' : ''}…`
    : paused > 0 && active === 0
    ? `${paused} upload${paused !== 1 ? 's' : ''} paused`
    : allDone
    ? [
        completed > 0 && `${completed} completed`,
        paused    > 0 && `${paused} paused`,
        failedDb  > 0 && `${failedDb} partial`,
        failed    > 0 && `${failed} failed`,
      ].filter(Boolean).join(' · ') || 'Done'
    : `${completed}/${queue.length} files`;

  const clearableCount = completed + failedDb;
  // Paused items should not be auto-cleared (user can resume them).

  return (
    <div
      className="fixed right-7 z-[41] rounded-3xl overflow-hidden"
      style={{
        bottom:      'calc(1.75rem + 3.5rem + 0.75rem)',
        width:       'min(360px, calc(100vw - 24px))',
        maxHeight:   minimised ? 'auto' : 480,
        transition:  'opacity 220ms var(--ease-smooth), transform 220ms var(--ease-smooth)',
        background:  'color-mix(in srgb, var(--surface-2) 90%, white 10%)',
        border:      '1px solid color-mix(in srgb, var(--border) 86%, transparent)',
        boxShadow:   '0 6px 16px rgba(15, 23, 42, 0.08)',
        transform:   mounted ? 'translateY(0)' : 'translateY(14px)',
        opacity:     mounted ? 1 : 0,
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
          className="flex items-center justify-center w-7 h-7 rounded-full shrink-0"
          style={{
            background: active > 0
              ? 'var(--accent-soft)'
              : allDone && failed === 0 && failedDb === 0
              ? 'rgba(22,163,74,0.10)'
              : allDone && failedDb > 0 && failed === 0
              ? 'rgba(217,119,6,0.10)'
              : 'color-mix(in srgb, var(--surface) 85%, transparent)',
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
        <div className="p-2.5 space-y-2 overflow-y-auto" style={{ maxHeight: 340 }}>
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
