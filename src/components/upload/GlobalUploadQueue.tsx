'use client';

/** GlobalUploadQueue — compact upload progress pill aligned next to the global FAB. */

import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Pause,
  X,
} from 'lucide-react';
import { useUpload, type UploadItem, type UploadStatus } from '@/lib/upload-context';
import { useToast } from '@/lib/toast-context';

function getDisplayName(item: UploadItem): string {
  const base = item.uploadName.trim();
  const ext = item.file.name.includes('.')
    ? `.${item.file.name.split('.').pop()!.toLowerCase()}`
    : '';
  if (!base) return item.file.name;
  return base.toLowerCase().endsWith(ext.toLowerCase()) ? base : `${base}${ext}`;
}

const STATUS_COLOR: Record<UploadStatus, string> = {
  queued: 'var(--text-secondary)',
  uploading: 'var(--accent)',
  uploaded: 'var(--accent)',
  saved: 'var(--accent)',
  completed: '#16a34a',
  paused: '#6366f1',
  failed_db: '#d97706',
  failed_upload: '#ef4444',
};

const COMPLETED_UPLOAD_AUTO_DISMISS_DELAY_MS = 1200;
const FAB_BAR_RIGHT_OFFSET = 'calc(1.75rem + 3.5rem + 0.75rem)';

function pickPrimaryItem(queue: UploadItem[]): UploadItem {
  const active = queue.find(i => i.status === 'uploading' || i.status === 'uploaded' || i.status === 'saved');
  if (active) return active;
  const paused = queue.find(i => i.status === 'paused');
  if (paused) return paused;
  const failed = queue.find(i => i.status === 'failed_upload');
  if (failed) return failed;
  const partial = queue.find(i => i.status === 'failed_db');
  if (partial) return partial;
  return queue[0];
}

export default function GlobalUploadQueue() {
  const { queue, removeItem, pauseItem } = useUpload();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const toastedIds = useRef<Set<string>>(new Set());
  const completedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    for (const item of queue) {
      if (item.status !== 'completed') continue;
      if (completedTimers.current.has(item.id)) continue;
      const timer = setTimeout(() => {
        removeItem(item.id);
        completedTimers.current.delete(item.id);
      }, COMPLETED_UPLOAD_AUTO_DISMISS_DELAY_MS);
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
    const timers = completedTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    for (const item of queue) {
      if (item.status === 'completed' && !toastedIds.current.has(item.id)) {
        toastedIds.current.add(item.id);
        toast(`"${getDisplayName(item)}" uploaded successfully`, 'success');
      }
    }
  }, [queue, toast]);

  if (queue.length === 0) return null;

  const activeCount = queue.filter(i =>
    i.status === 'uploading' || i.status === 'uploaded' || i.status === 'saved',
  ).length;
  const primary = pickPrimaryItem(queue);
  const primaryName = getDisplayName(primary);
  const primaryColor = STATUS_COLOR[primary.status];
  const canCancel = primary.status === 'uploading' || primary.status === 'uploaded' || primary.status === 'saved' || primary.status === 'paused';
  const shouldPause = primary.status === 'uploading' || primary.status === 'uploaded' || primary.status === 'saved';
  const progress = Math.max(0, Math.min(100, primary.progress));
  const extraCount = Math.max(0, queue.length - 1);
  const width = queue.length > 1
    ? 'clamp(14rem, 34vw, 22rem)'
    : 'clamp(12rem, 28vw, 20rem)';

  return (
    <div
      className="fixed z-[41]"
      style={{
        right: FAB_BAR_RIGHT_OFFSET,
        bottom: '1.75rem',
        height: '3.5rem',
        width,
        transformOrigin: 'right center',
        transition: 'width 300ms var(--ease-smooth), opacity 220ms var(--ease-smooth), transform 220ms var(--ease-smooth)',
        transform: mounted ? 'scaleX(1) translateY(0)' : 'scaleX(0.92) translateY(8px)',
        opacity: mounted ? 1 : 0,
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-full pl-2 pr-2"
        style={{
          background: 'color-mix(in srgb, var(--surface-2) 90%, white 10%)',
          border: '1px solid color-mix(in srgb, var(--border) 86%, transparent)',
          boxShadow: '0 6px 14px rgba(8, 16, 35, 0.12)',
        }}
      >
        <div className="flex h-full items-center gap-2.5">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)' }}
          >
            {primary.status === 'uploading' || primary.status === 'uploaded' || primary.status === 'saved' ? (
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
            ) : primary.status === 'completed' ? (
              <CheckCircle size={14} style={{ color: '#16a34a' }} />
            ) : primary.status === 'failed_upload' ? (
              <AlertCircle size={14} style={{ color: '#ef4444' }} />
            ) : primary.status === 'failed_db' ? (
              <AlertTriangle size={14} style={{ color: '#d97706' }} />
            ) : primary.status === 'paused' ? (
              <Pause size={14} style={{ color: '#6366f1' }} />
            ) : (
              <Upload size={14} style={{ color: 'var(--text-secondary)' }} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-semibold" style={{ color: 'var(--text)' }}>
                {primaryName}
              </p>
              {extraCount > 0 && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                  style={{
                    color: 'var(--text-secondary)',
                    background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--border) 90%, transparent)',
                  }}
                >
                  +{extraCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="truncate text-[11px] font-medium" style={{ color: primaryColor }}>
                {primary.statusLabel ?? primary.statusText}
              </p>
              <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: primaryColor }}>
                {activeCount > 0 ? `${progress}%` : primary.status === 'completed' ? 'Done' : '—'}
              </span>
            </div>
          </div>

          {shouldPause && (
            <button
              onClick={() => pauseItem(primary.id)}
              title="Pause upload"
              aria-label="Pause upload"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-75"
              style={{ color: '#6366f1' }}
            >
              <Pause size={12} />
            </button>
          )}

          {canCancel && (
            <button
              onClick={() => removeItem(primary.id)}
              title="Cancel upload"
              aria-label="Cancel upload"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-75"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: 'color-mix(in srgb, var(--border) 90%, transparent)' }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${activeCount > 0 ? progress : primary.status === 'completed' ? 100 : progress}%`,
              background: primary.status === 'completed'
                ? '#16a34a'
                : primary.status === 'paused'
                ? '#6366f1'
                : primary.status === 'failed_upload'
                ? '#ef4444'
                : primary.status === 'failed_db'
                ? '#d97706'
                : 'var(--accent)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
