'use client';

import type { Asset } from '@/lib/types';
import { cn } from '@/lib/cn';
import {
  Calendar,
  Check,
  Copy,
  Eye,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Pencil,
  Trash2,
  Send,
} from 'lucide-react';

export function isImage(fileName: string, mime?: string | null) {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(ext);
}

export function isVideo(fileName: string, mime?: string | null) {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('video/')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(ext);
}

export function isPdf(fileName: string, mime?: string | null) {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf') return true;
  return fileName.toLowerCase().endsWith('.pdf');
}

function isAudio(fileName: string, mime?: string | null) {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('audio/')) return true;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac'].includes(ext);
}

function thumbUrl(asset: Asset): string | null {
  const mime = asset.file_type ?? asset.mime_type ?? null;
  return (
    asset.thumbnail_url ??
    asset.preview_url ??
    (isImage(asset.name, mime) ? asset.file_url : null) ??
    null
  );
}

export type AssetsGridProps = {
  assets: Asset[];
  canDelete?: boolean;
  canRename?: boolean;
  scheduleCounts?: Record<string, { count: number; nextDate: string | null }>;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onView?: (asset: Asset) => void;
  onDelete?: (asset: Asset) => void;
  onCopyLink?: (asset: Asset) => void;
  onComments?: (asset: Asset) => void;
  onRename?: (asset: Asset, name: string) => void | Promise<void>;
  onSchedule?: (asset: Asset) => void;
  /** When every asset belongs to the same client (client workspace). */
  singleClientLogoUrl?: string | null;
  /** Map `client_id` → logo URL for badges on covers (e.g. videos). */
  clientLogoByClientId?: Record<string, string | null | undefined>;
};

type AssetTileProps = Omit<
  AssetsGridProps,
  'assets' | 'singleClientLogoUrl' | 'clientLogoByClientId'
> & {
  asset: Asset;
  overlayLogoUrl: string | null;
};

function AssetTile({
  asset,
  canDelete,
  canRename,
  scheduleCounts,
  selectable,
  selectedIds,
  onToggleSelect,
  onView,
  onDelete,
  onCopyLink,
  onComments,
  onRename,
  onSchedule,
  overlayLogoUrl,
}: AssetTileProps) {
  const mime = asset.file_type ?? asset.mime_type ?? null;
  const thumb = thumbUrl(asset);
  const video = isVideo(asset.name, mime);
  const pdf = isPdf(asset.name, mime);
  const audio = isAudio(asset.name, mime);
  const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
  const isDoc = ['doc', 'docx'].includes(extension);
  const isSheet = ['xls', 'xlsx', 'csv'].includes(extension);
  const isCode = ['ts', 'tsx', 'js', 'jsx', 'py', 'sql', 'json', 'xml', 'yml', 'yaml'].includes(
    extension,
  );
  const selected = selectedIds?.has(asset.id) ?? false;
  const sched = scheduleCounts?.[asset.id];
  const showSched = sched && sched.count > 0;

  return (
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border transition-all duration-200',
        selected ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface)]' : '',
      )}
      style={{
        background: 'var(--surface)',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-2)]">
        {selectable && onToggleSelect ? (
          <button
            type="button"
            className="bg-[var(--surface)]/95 absolute start-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm"
            style={{ borderColor: 'var(--border)' }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(asset.id);
            }}
            aria-pressed={selected}
            aria-label={selected ? 'Deselect' : 'Select'}
          >
            {selected ? (
              <Check size={16} className="text-[var(--accent)]" />
            ) : (
              <span className="h-3.5 w-3.5 rounded border-2 border-[var(--border)]" />
            )}
          </button>
        ) : null}

        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-4">
            {video ? (
              <Film size={28} className="text-[var(--text-secondary)]" />
            ) : pdf ? (
              <FileText size={28} className="text-rose-500" />
            ) : audio ? (
              <Music size={28} className="text-[var(--text-secondary)]" />
            ) : isSheet ? (
              <FileSpreadsheet size={28} className="text-emerald-500" />
            ) : isDoc ? (
              <FileText size={28} className="text-blue-500" />
            ) : isCode ? (
              <FileCode2 size={28} className="text-violet-500" />
            ) : (
              <ImageIcon size={28} className="text-[var(--text-secondary)]" />
            )}
            <span className="line-clamp-2 text-center text-[10px] font-medium text-[var(--text-secondary)]">
              {asset.name}
            </span>
          </div>
        )}

        {video ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg"
              style={{ background: 'rgba(15,23,42,0.55)' }}
            >
              <span className="ms-0.5 text-lg">▶</span>
            </div>
          </div>
        ) : null}

        {overlayLogoUrl ? (
          <div className="absolute bottom-2 end-2 z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={overlayLogoUrl}
              alt=""
              className="h-8 w-8 rounded-lg border-2 border-white object-cover shadow-md"
              loading="lazy"
            />
          </div>
        ) : null}

        {showSched ? (
          <div
            className="absolute bottom-2 start-2 z-10 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--accent)',
            }}
          >
            <Calendar size={10} />
            {sched.count}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {asset.name}
        </p>
        {asset.client_name ? (
          <p className="truncate text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {asset.client_name}
          </p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-[var(--border)] pt-2">
          {onView ? (
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => onView(asset)}
              title="View"
            >
              <Eye size={14} />
            </button>
          ) : null}
          {onSchedule ? (
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => onSchedule(asset)}
              title="Schedule"
            >
              <Send size={14} />
            </button>
          ) : null}
          {onComments ? (
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => onComments(asset)}
              title="Comments"
            >
              <MessageSquare size={14} />
            </button>
          ) : null}
          {onCopyLink ? (
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => void onCopyLink(asset)}
              title="Copy link"
            >
              <Copy size={14} />
            </button>
          ) : null}
          {canRename && onRename ? (
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => {
                const next = window.prompt('New file name', asset.name);
                if (next != null && next.trim() && next !== asset.name)
                  void onRename(asset, next.trim());
              }}
              title="Rename"
            >
              <Pencil size={14} />
            </button>
          ) : null}
          {canDelete && onDelete ? (
            <button
              type="button"
              className="rounded-lg p-1.5 hover:bg-red-50"
              style={{ color: 'var(--color-danger, #dc2626)' }}
              onClick={() => onDelete(asset)}
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AssetsGrid({
  assets,
  singleClientLogoUrl,
  clientLogoByClientId,
  ...rest
}: AssetsGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => {
        const overlay =
          singleClientLogoUrl ??
          (asset.client_id && clientLogoByClientId
            ? (clientLogoByClientId[asset.client_id] ?? null)
            : null) ??
          null;
        return <AssetTile key={asset.id} {...rest} asset={asset} overlayLogoUrl={overlay} />;
      })}
    </div>
  );
}
