'use client';

import { File, FileAudio, FileImage, FileText, FileVideo, Eye, Link as LinkIcon, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { mainCategoryLabel, subCategoryLabel } from '@/lib/asset-utils';
import type { Asset } from '@/lib/types';

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
  if (isImage(name, type)) return 'Image';
  if (isVideo(name, type)) return 'Video';
  if (isPdf(name, type)) return 'PDF';
  if (isAudio(name, type)) return 'Audio';
  if (type?.startsWith('text/')) return 'Text';
  if (type?.startsWith('application/')) return 'Document';
  return 'File';
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string | null; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: 'var(--accent)' }} />;
  if (isPdf(name, type)) return <FileText size={size} style={{ color: 'var(--color-danger)' }} />;
  if (isVideo(name, type)) return <FileVideo size={size} style={{ color: 'var(--accent-2)' }} />;
  if (isAudio(name, type)) return <FileAudio size={size} style={{ color: 'var(--color-info)' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

export interface AssetCardProps {
  asset: Asset;
  canDelete?: boolean;
  canRename?: boolean;
  scheduleCount?: number;
  nextScheduleDate?: string | null;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onView: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onComments?: () => void;
  onRename?: (name: string) => Promise<void>;
  onSchedule?: () => void;
}

export function AssetCard({
  asset,
  canDelete = false,
  canRename = false,
  scheduleCount,
  nextScheduleDate,
  selectable = false,
  selected = false,
  onToggleSelect,
  onView,
  onDelete,
  onCopyLink,
  onComments,
  onRename,
  onSchedule,
}: AssetCardProps) {
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(asset.name);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setNameDraft(asset.name);
  }, [asset.name]);

  async function commitRename() {
    const next = nameDraft.trim();
    if (!onRename || !next || next === asset.name) {
      setEditing(false);
      setNameDraft(asset.name);
      return;
    }

    setSavingName(true);
    try {
      await onRename(next);
      setEditing(false);
    } finally {
      setSavingName(false);
    }
  }

  const effectiveType = asset.file_type ?? asset.mime_type ?? undefined;

  return (
    <article
      className="openy-card group overflow-hidden rounded-2xl border"
      style={{ borderColor: selected ? 'var(--accent)' : 'var(--border)', boxShadow: selected ? 'var(--glow-button)' : undefined }}
      onClick={selectable ? onToggleSelect : undefined}
    >
      <div className="relative flex aspect-square items-center justify-center border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
        {isImage(asset.name, effectiveType) && asset.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail_url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <FileTypeIcon name={asset.name} type={effectiveType} size={34} />
        )}

        {selectable ? (
          <button
            type="button"
            className="absolute left-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold"
            style={{ borderColor: selected ? 'var(--accent)' : 'var(--border)', background: selected ? 'var(--accent)' : 'var(--surface)' }}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect?.();
            }}
            aria-label="Toggle selection"
          >
            {selected ? '✓' : ''}
          </button>
        ) : (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--overlay-action-border)', background: 'var(--overlay-action-bg)', color: '#fff' }} onClick={(event) => { event.stopPropagation(); onView(); }} title="View">
              <Eye size={13} />
            </button>
            {canDelete ? (
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--overlay-action-border)', background: 'var(--overlay-action-danger-bg)', color: '#fff' }} onClick={(event) => { event.stopPropagation(); onDelete(); }} title="Delete">
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-2.5 p-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitRename();
                if (event.key === 'Escape') {
                  setEditing(false);
                  setNameDraft(asset.name);
                }
              }}
              disabled={savingName}
              className="openy-field h-8 min-w-0 flex-1 rounded-lg px-2 text-sm"
            />
            <button type="button" onClick={() => void commitRename()} className="btn-icon h-8 w-8" disabled={savingName} aria-label="Save name">
              ✓
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <p className="min-w-0 flex-1 truncate text-sm font-medium" title={asset.name}>{asset.name}</p>
            {canRename && onRename ? (
              <button type="button" onClick={() => setEditing(true)} className="btn-icon h-6 w-6" aria-label="Rename asset">
                <Pencil size={11} />
              </button>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            {getFileTypeLabel(asset.name, effectiveType)}
          </span>
          <span className="text-xs text-[var(--text-secondary)]">{formatFileSize(asset.file_size)}</span>
        </div>

        {asset.client_name || asset.main_category ? (
          <div className="flex flex-wrap gap-1">
            {asset.client_name ? (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{asset.client_name}</span>
            ) : null}
            {asset.main_category ? (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{mainCategoryLabel(asset.main_category)}</span>
            ) : null}
          </div>
        ) : null}

        {asset.sub_category ? <p className="text-xs text-[var(--text-secondary)]">{subCategoryLabel(asset.main_category ?? '', asset.sub_category)}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <span>{formatFileDate(asset.created_at)}</span>
          {scheduleCount && scheduleCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Send size={10} /> {scheduleCount}
            </span>
          ) : null}
          {nextScheduleDate ? <span>{new Date(nextScheduleDate).toLocaleDateString()}</span> : null}
        </div>

        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={(event) => { event.stopPropagation(); onCopyLink(); }} className="btn-icon h-7 w-7" aria-label="Copy link">
            <LinkIcon size={12} />
          </button>
          {onComments ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); onComments(); }} className="btn-icon h-7 w-7" aria-label="Open comments">
              <MessageSquare size={12} />
            </button>
          ) : null}
          {onSchedule ? (
            <button type="button" onClick={(event) => { event.stopPropagation(); onSchedule(); }} className="btn-icon h-7 w-7" aria-label="Schedule asset">
              <Send size={12} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export interface AssetsGridProps {
  assets: Asset[];
  canDelete?: boolean;
  canRename?: boolean;
  scheduleCounts?: Record<string, { count: number; nextDate: string | null }>;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onView: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onCopyLink: (asset: Asset) => void;
  onComments?: (asset: Asset) => void;
  onRename?: (asset: Asset, name: string) => Promise<void>;
  onSchedule?: (asset: Asset) => void;
}

export function AssetsGrid({
  assets,
  canDelete = false,
  canRename = false,
  scheduleCounts,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onView,
  onDelete,
  onCopyLink,
  onComments,
  onRename,
  onSchedule,
}: AssetsGridProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          canDelete={canDelete}
          canRename={canRename}
          scheduleCount={scheduleCounts?.[asset.id]?.count}
          nextScheduleDate={scheduleCounts?.[asset.id]?.nextDate}
          selectable={selectable}
          selected={selectedIds?.has(asset.id) ?? false}
          onToggleSelect={onToggleSelect ? () => onToggleSelect(asset.id) : undefined}
          onView={() => onView(asset)}
          onDelete={() => onDelete(asset)}
          onCopyLink={() => onCopyLink(asset)}
          onComments={onComments ? () => onComments(asset) : undefined}
          onRename={onRename ? (name) => onRename(asset, name) : undefined}
          onSchedule={onSchedule ? () => onSchedule(asset) : undefined}
        />
      ))}
    </section>
  );
}
