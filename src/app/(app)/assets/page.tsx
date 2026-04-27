'use client';

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useDeferredValue,
  useMemo,
  Suspense,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  FolderOpen,
  File,
  X,
  Search,
  ChevronRight,
  Folder,
  ChevronLeft,
  Home,
  Download,
  Square,
  CheckSquare,
  Users2,
} from 'lucide-react';
import clsx from 'clsx';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { calendarMonthNow, useAppPeriod } from '@/context/app-period-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import CommentsPanel from '@/components/ui/CommentsPanel';
import SelectDropdown from '@/components/ui/SelectDropdown';
import UploadModal from '@/components/features/upload/UploadModal';
import SchedulePublishingModal from '@/components/features/publishing/SchedulePublishingModal';
import { MAIN_CATEGORIES, mainCategoryLabel, subCategoryLabel } from '@/lib/asset-utils';
import { useUpload } from '@/context/upload-context';
import type { Asset, Client, TeamMember, PublishingSchedule } from '@/lib/types';
import FilePreviewModal from '@/components/ui/FilePreviewModal';
import {
  AssetsGrid,
  isImage as isImageFile,
  isVideo as isVideoFile,
  isPdf as isPdfFile,
} from '@/components/ui/AssetsGrid';
import { ClientBrandMark } from '@/components/ui/ClientBrandMark';
import { generateVideoThumbnail } from '@/lib/video-thumbnail';
import { generatePdfPreview } from '@/lib/pdf-preview';
import AppModal from '@/components/ui/AppModal';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import { workspaceSearchParamFromPathname } from '@/lib/workspace-access';
import { LoadingState, ErrorState, EmptyState as GlobalEmptyState } from '@/components/ui/states';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';
import EntityActionsMenu from '@/components/ui/actions/EntityActionsMenu';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FolderPath {
  client?: string; // client_name
  mainCategory?: string; // slug
  year?: string;
  month?: string; // "YYYY-MM"
  subCategory?: string; // slug
}

const FOLDER_QUERY_KEYS = {
  client: 'client',
  mainCategory: 'category',
  year: 'year',
  month: 'month',
  subCategory: 'sub',
} as const;

function folderPathFromSearchParams(searchParams: URLSearchParams): FolderPath {
  const client = searchParams.get(FOLDER_QUERY_KEYS.client) ?? undefined;
  const mainCategory = searchParams.get(FOLDER_QUERY_KEYS.mainCategory) ?? undefined;
  const year = searchParams.get(FOLDER_QUERY_KEYS.year) ?? undefined;
  const month = searchParams.get(FOLDER_QUERY_KEYS.month) ?? undefined;
  const subCategory = searchParams.get(FOLDER_QUERY_KEYS.subCategory) ?? undefined;
  return { client, mainCategory, year, month, subCategory };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers / sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useLang();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-xs font-medium text-[var(--accent)]">
      {label}
      <button
        onClick={onRemove}
        className="leading-none transition-opacity hover:opacity-70"
        title={t('assetsRemoveFilter')}
      >
        <X size={11} />
      </button>
    </span>
  );
}

interface FileUploadItem {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadName: string;
  thumbnailBlob: Blob | null;
  durationSeconds: number | null;
  previewBlob: Blob | null;
}

// ── File helpers (upload-specific) ────────────────────────────────────────────

function getFileExtension(name: string): string {
  const p = name.split('.');
  const ext = p.length > 1 ? p[p.length - 1] : '';
  return ext ? `.${ext.toLowerCase()}` : '';
}
function getFileBaseName(name: string): string {
  const ext = getFileExtension(name);
  return ext ? name.slice(0, name.length - ext.length) : name;
}

function monthLabel(mm: string, tf: (key: string) => string): string {
  const idx = parseInt(mm, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return mm;
  return tf(`calMonth${idx}`);
}

function getAssetYear(asset: Asset): string {
  if (asset.month_key && asset.month_key.length >= 4) return asset.month_key.slice(0, 4);
  if (asset.created_at) return new Date(asset.created_at).getFullYear().toString();
  return 'Unknown';
}

/** IDs of assets grouped under this folder card at the current breadcrumb depth. */
function assetIdsForFolderEntry(assets: Asset[], pathDepth: number, key: string): string[] {
  if (pathDepth === 0) {
    return assets.filter((a) => (a.client_name ?? 'No Client') === key).map((a) => a.id);
  }
  if (pathDepth === 1) {
    return assets.filter((a) => (a.main_category ?? 'other') === key).map((a) => a.id);
  }
  if (pathDepth === 2) {
    return assets.filter((a) => getAssetYear(a) === key).map((a) => a.id);
  }
  if (pathDepth === 3) {
    return assets.filter((a) => (a.month_key ?? '') === key).map((a) => a.id);
  }
  if (pathDepth === 4) {
    return assets.filter((a) => (a.sub_category ?? 'general') === key).map((a) => a.id);
  }
  return [];
}

function formatFolderBytes(bytes: number, tf: (key: string) => string): string {
  if (!bytes || bytes < 0) return tf('assetsEmDash');
  if (bytes < 1024) return `${bytes} ${tf('assetsUnitB')}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${tf('assetsUnitKb')}`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${tf('assetsUnitMb')}`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${tf('assetsUnitGb')}`;
}

type FolderAssetKind = 'image' | 'video' | 'pdf' | 'document' | 'audio' | 'archive' | 'other';

type FolderKindCounts = Record<FolderAssetKind, number>;

function emptyFolderKindCounts(): FolderKindCounts {
  return { image: 0, video: 0, pdf: 0, document: 0, audio: 0, archive: 0, other: 0 };
}

function folderAssetKind(asset: Asset): FolderAssetKind {
  const mime = (asset.file_type ?? asset.mime_type ?? asset.content_type ?? '').toLowerCase();
  const name = (asset.original_filename ?? asset.name ?? '').toLowerCase();
  const extMatch = name.match(/\.([a-z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : '';

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (
    /\.(zip|rar|7z|tar|gz|tgz|bz2)$/i.test(name) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('x-rar') ||
    mime.includes('x-7z')
  )
    return 'archive';
  if (
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime.includes('sheet') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('msword') ||
    mime.includes('officedocument') ||
    /\.(doc|docx|xls|xlsx|ppt|pptx|csv|txt|rtf|odt|ods|odp)$/i.test(name)
  )
    return 'document';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.bmp', '.ico'].includes(ext))
    return 'image';
  if (['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'].includes(ext)) return 'video';
  if (['.mp3', '.wav', '.aac', '.flac', '.m4a', '.ogg'].includes(ext)) return 'audio';
  return 'other';
}

function buildFolderKindSummary(
  kinds: FolderKindCounts,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const slots: { count: number; labelKey: string }[] = [
    { count: kinds.image, labelKey: 'assetsTypeImages' },
    { count: kinds.video, labelKey: 'assetsTypeVideos' },
    { count: kinds.pdf, labelKey: 'assetsTypePdfs' },
    { count: kinds.document, labelKey: 'assetsTypeDocuments' },
    { count: kinds.audio, labelKey: 'assetsTypeAudio' },
    { count: kinds.archive, labelKey: 'assetsTypeArchives' },
    { count: kinds.other, labelKey: 'assetsTypeOther' },
  ].filter((s) => s.count > 0);

  if (!slots.length) return '';

  return slots
    .map(({ count, labelKey }) => t('assetsFolderKindSlot', { count, label: t(labelKey) }))
    .join(' · ');
}

// ── Folder Card ───────────────────────────────────────────────────────────────

interface FolderCardProps {
  label: string;
  count: number;
  totalBytes: number;
  kindSummary: string;
  color?: string;
  onClick: () => void;
  onView?: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
  selectionMode?: boolean;
  folderAssetIds?: string[];
  selectedIds?: Set<string>;
  onToggleFolderSelect?: () => void;
}

function FolderCard({
  label,
  count,
  totalBytes,
  kindSummary,
  color,
  onClick,
  onView,
  onDownload,
  isDownloading,
  selectionMode = false,
  folderAssetIds = [],
  selectedIds,
  onToggleFolderSelect,
}: FolderCardProps) {
  const { t } = useLang();
  const hasActions = onView || onDownload;
  const sizeLine = t('assetsFolderTotalSize', { size: formatFolderBytes(totalBytes, t) });
  const ids = folderAssetIds;
  const sel = selectedIds ?? new Set<string>();
  const allSelected = ids.length > 0 && ids.every((id) => sel.has(id));
  const someSelected = ids.some((id) => sel.has(id)) && !allSelected;
  const showFolderCheckbox = Boolean(selectionMode && ids.length > 0 && onToggleFolderSelect);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="shadow-card relative flex min-h-[11.5rem] cursor-pointer select-none flex-col gap-3 rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] active:translate-y-0 active:scale-[0.99] sm:min-h-[12rem] sm:p-5"
      style={{
        background: 'var(--surface)',
        borderColor: allSelected
          ? 'var(--accent)'
          : someSelected
            ? 'color-mix(in srgb, var(--accent) 55%, var(--border))'
            : 'var(--border)',
        boxShadow:
          allSelected || someSelected
            ? '0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)'
            : undefined,
      }}
    >
      {showFolderCheckbox ? (
        <div
          className="absolute start-4 top-4 z-10 flex items-center gap-2 rounded-lg border bg-[var(--surface)] px-2 py-1.5 shadow-sm"
          style={{ borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => onToggleFolderSelect?.()}
            className="h-4 w-4 shrink-0 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            aria-label={t('assetsSelectFolderAria', { count: ids.length })}
          />
          <span className="max-w-[8rem] truncate text-[10px] font-medium text-[var(--text-secondary)] sm:max-w-[10rem] sm:text-[11px]">
            {t('assetsSelect')}
          </span>
        </div>
      ) : null}
      <div
        className={clsx(
          'rounded-xl border px-3 py-2.5 text-start text-[11px] leading-snug sm:text-xs',
          showFolderCheckbox && 'mt-10',
        )}
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text-secondary)',
        }}
      >
        {kindSummary ? (
          <p className="line-clamp-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            {kindSummary}
          </p>
        ) : null}
        <p
          className={kindSummary ? 'mt-1 font-semibold' : 'font-semibold'}
          style={{ color: 'var(--text-primary)' }}
        >
          {sizeLine}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 sm:h-14 sm:w-14"
          style={{ background: color ? `${color}22` : 'rgba(99,102,241,0.1)' }}
        >
          <Folder className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: color ?? 'var(--accent)' }} />
        </div>
        <div className="w-full min-w-0">
          <p className="truncate text-base font-semibold" style={{ color: 'var(--text)' }}>
            {label}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {count === 1 ? t('assetsFileCount', { count }) : t('assetsFileCountPlural', { count })}
          </p>
        </div>
      </div>
      {hasActions && (
        <div className="mt-auto flex gap-2">
          {onView && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 sm:text-sm"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              <FolderOpen size={14} /> {t('assetsView')}
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              disabled={isDownloading}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
              style={{
                background: 'rgba(99,102,241,0.1)',
                color: 'var(--accent)',
                border: '1px solid rgba(99,102,241,0.3)',
              }}
            >
              <Download size={14} />
              {isDownloading ? t('assetsZipping') : t('assetsDownload')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Client Folder Card (depth 0) ──────────────────────────────────────────────

function ClientFolderCard({
  label,
  count,
  totalBytes,
  kindSummary,
  slug,
  logoUrl,
  onView,
  onDownload,
  onDelete,
  isDownloading,
  isDeleting = false,
  canDelete = false,
  selectionMode = false,
  folderAssetIds = [],
  selectedIds,
  onToggleFolderSelect,
}: {
  label: string;
  count: number;
  totalBytes: number;
  kindSummary: string;
  slug?: string;
  /** Client brand image when this card is a client folder (depth 0). */
  logoUrl?: string | null;
  onView: () => void;
  onDownload: () => void;
  onDelete?: () => void;
  isDownloading: boolean;
  isDeleting?: boolean;
  canDelete?: boolean;
  selectionMode?: boolean;
  folderAssetIds?: string[];
  selectedIds?: Set<string>;
  onToggleFolderSelect?: () => void;
}) {
  const { t } = useLang();
  const sizeLine = t('assetsFolderTotalSize', { size: formatFolderBytes(totalBytes, t) });
  const ids = folderAssetIds;
  const sel = selectedIds ?? new Set<string>();
  const allSelected = ids.length > 0 && ids.every((id) => sel.has(id));
  const someSelected = ids.some((id) => sel.has(id)) && !allSelected;
  const showFolderCheckbox = Boolean(selectionMode && ids.length > 0 && onToggleFolderSelect);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView();
        }
      }}
      className="shadow-card relative flex min-h-[11.5rem] cursor-pointer select-none flex-col gap-3 rounded-2xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] active:translate-y-0 active:scale-[0.99] sm:min-h-[12rem] sm:p-5"
      style={{
        background: 'var(--surface)',
        borderColor: allSelected
          ? 'var(--accent)'
          : someSelected
            ? 'color-mix(in srgb, var(--accent) 55%, var(--border))'
            : 'var(--border)',
        boxShadow:
          allSelected || someSelected
            ? '0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)'
            : undefined,
      }}
    >
      {showFolderCheckbox ? (
        <div
          className="absolute start-4 top-4 z-10 flex items-center gap-2 rounded-lg border bg-[var(--surface)] px-2 py-1.5 shadow-sm"
          style={{ borderColor: 'var(--border)' }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => onToggleFolderSelect?.()}
            className="h-4 w-4 shrink-0 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
            aria-label={t('assetsSelectFolderAria', { count: ids.length })}
          />
          <span className="max-w-[8rem] truncate text-[10px] font-medium text-[var(--text-secondary)] sm:max-w-[10rem] sm:text-[11px]">
            {t('assetsSelect')}
          </span>
        </div>
      ) : null}
      <div
        className={clsx(
          'rounded-xl border px-3 py-2.5 text-start text-[11px] leading-snug sm:text-xs',
          showFolderCheckbox && 'mt-10',
        )}
        style={{
          borderColor: 'var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text-secondary)',
        }}
      >
        {kindSummary ? (
          <p className="line-clamp-2 font-medium" style={{ color: 'var(--text-primary)' }}>
            {kindSummary}
          </p>
        ) : null}
        <p
          className={kindSummary ? 'mt-1 font-semibold' : 'font-semibold'}
          style={{ color: 'var(--text-primary)' }}
        >
          {sizeLine}
        </p>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-colors duration-200 sm:h-14 sm:w-14"
          style={{ background: logoUrl ? 'var(--surface-2)' : 'rgba(99,102,241,0.1)' }}
        >
          {logoUrl ? (
            <ClientBrandMark
              name={label}
              logoUrl={logoUrl}
              size={56}
              roundedClassName="rounded-xl"
            />
          ) : (
            <Folder className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: 'var(--accent)' }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold" style={{ color: 'var(--text)' }}>
            {label}
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {count === 1 ? t('assetsFileCount', { count }) : t('assetsFileCountPlural', { count })}
          </p>
        </div>
      </div>
      <div className="mt-auto flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onView}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 sm:text-sm"
          style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)' }}
        >
          <FolderOpen size={14} /> {t('assetsView')}
        </button>
        {slug ? (
          <a
            href={`/clients/${slug}/assets`}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 sm:text-sm"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
            }}
          >
            <Users2 size={14} /> {t('assetsWorkspace')}
          </a>
        ) : (
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          >
            <Download size={14} />
            {isDownloading ? '…' : t('assetsDownload')}
          </button>
        )}
        <div title={canDelete ? undefined : "You don't have permission"}>
          <EntityActionsMenu
            loading={isDeleting}
            onDelete={canDelete && onDelete ? onDelete : undefined}
            deleteLabel={t('deleteAction')}
            disabled={!canDelete}
          />
        </div>
      </div>
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

interface BreadcrumbItem {
  label: string;
  path: FolderPath;
}

function Breadcrumb({
  items,
  onNavigate,
}: {
  items: BreadcrumbItem[];
  onNavigate: (path: FolderPath) => void;
}) {
  const { t } = useLang();
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label={t('assetsFolderNav')}>
      <button
        type="button"
        onClick={() => onNavigate({})}
        className="flex h-7 w-7 items-center justify-center rounded-lg transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)' }}
        title={t('assetsAllClients')}
      >
        <Home size={13} />
      </button>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <ChevronRight size={13} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          {idx < items.length - 1 ? (
            <button
              type="button"
              onClick={() => onNavigate(item.path)}
              className="px-1 text-xs font-medium hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {item.label}
            </button>
          ) : (
            <span className="px-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'social-media': '#3b82f6',
  videos: '#8b5cf6',
  designs: '#f59e0b',
  documents: '#10b981',
  other: '#6b7280',
};

function fileTypeFilterLabel(
  value: string,
  tf: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const keys: Record<string, string> = {
    image: 'assetsTypeImages',
    video: 'assetsTypeVideos',
    audio: 'assetsTypeAudio',
    'application/pdf': 'assetsTypePdfs',
  };
  const k = keys[value];
  return k
    ? tf(k)
    : tf('assetsOtherMimePrefix', { type: value.charAt(0).toUpperCase() + value.slice(1) });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;
function nextFileId() {
  return crypto.randomUUID();
}
function makePreviewUrl(file: File): string | null {
  return isImageFile(file.name, file.type) ? URL.createObjectURL(file) : null;
}

/** Trigger a browser download from a URL without relying on component state. */
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

function assetsFetchQuery(folderPath: FolderPath, periodYm: string): string {
  if (folderPath.month) return `&month_key=${encodeURIComponent(folderPath.month)}`;
  if (folderPath.year) return `&year=${encodeURIComponent(folderPath.year)}`;
  return `&month_key=${encodeURIComponent(periodYm)}`;
}

function AssetsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLang();
  const { periodYm } = useAppPeriod();
  const { user, defaultWorkspaceId } = useAuth();
  const workspaceQs = useMemo(() => {
    if (defaultWorkspaceId) {
      return `workspace_id=${encodeURIComponent(defaultWorkspaceId)}`;
    }
    return workspaceSearchParamFromPathname(pathname);
  }, [defaultWorkspaceId, pathname]);
  const { toast } = useToast();
  const canDeleteFiles =
    user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager';
  const canUpload = canDeleteFiles || user?.role === 'team_member';

  const { startBatch, isUploading, latestAsset } = useUpload();
  // ── Data state ────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const clientLogoByClientId = useMemo(() => {
    const m: Record<string, string | null | undefined> = {};
    for (const c of clients) m[c.id] = c.logo ?? null;
    return m;
  }, [clients]);
  const clientNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of clients) m[c.id] = c.name;
    return m;
  }, [clients]);
  const clientByName = useMemo(() => {
    const m = new Map<string, Client>();
    for (const c of clients) m.set(c.name, c);
    return m;
  }, [clients]);
  const getAssetClientFolderName = useCallback(
    (asset: Asset): string | null => {
      const byId = asset.client_id ? clientNameById[asset.client_id] : '';
      if (byId) return byId;
      const byName = asset.client_name?.trim() ?? '';
      if (byName) return byName;
      return null;
    },
    [clientNameById],
  );
  const [scheduleCounts, setScheduleCounts] = useState<
    Record<string, { count: number; nextDate: string | null }>
  >({});

  // ── UI state ──────────────────────────────────────────────────────────────
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [commentsAsset, setCommentsAsset] = useState<Asset | null>(null);
  const [scheduleAsset, setScheduleAsset] = useState<Asset | null>(null);
  const [scheduleAfterUpload, setScheduleAfterUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ── Folder navigation ─────────────────────────────────────────────────────
  const [folderPath, setFolderPath] = useState<FolderPath>({});

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFileType, setFilterFileType] = useState('');

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'largest'>('newest');

  // ── Upload modal state ────────────────────────────────────────────────────
  const [pendingItems, setPendingItems] = useState<FileUploadItem[]>([]);
  const [uploadMainCategory, setUploadMainCategory] = useState<string>(MAIN_CATEGORIES[0].slug);
  const [uploadSubCategory, setUploadSubCategory] = useState<string>('');
  const [uploadMonth, setUploadMonth] = useState<string>(calendarMonthNow);
  const [uploadClientName, setUploadClientName] = useState<string>('');
  const [uploadClientId, setUploadClientId] = useState<string>('');
  const [quickActionUploadOpen, setQuickActionUploadOpen] = useState(false);

  const deferredAssets = useDeferredValue(assets);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const updateAssetsUrl = useCallback(
    (
      nextFolderPath: FolderPath,
      previewAssetName: string | null,
      previewAssetId?: string | null,
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      const entries: Array<[keyof FolderPath, string]> = [
        ['client', FOLDER_QUERY_KEYS.client],
        ['mainCategory', FOLDER_QUERY_KEYS.mainCategory],
        ['year', FOLDER_QUERY_KEYS.year],
        ['month', FOLDER_QUERY_KEYS.month],
        ['subCategory', FOLDER_QUERY_KEYS.subCategory],
      ];
      for (const [pathKey, queryKey] of entries) {
        const value = nextFolderPath[pathKey];
        if (value) params.set(queryKey, value);
        else params.delete(queryKey);
      }
      if (previewAssetName) params.set('preview', previewAssetName);
      else params.delete('preview');
      if (previewAssetId) params.set('previewId', previewAssetId);
      else params.delete('previewId');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // ── Fetch assets ──────────────────────────────────────────────────────────

  const fetchAssets = useCallback(
    async (pageNum: number = 0) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        setFetchError(null);
        const periodQs = assetsFetchQuery(folderPath, periodYm);
        const res = await fetch(`/api/assets?page=${pageNum}&${workspaceQs}${periodQs}`, {
          signal: controller.signal,
        });
        let json: { success: boolean; assets?: Asset[]; hasMore?: boolean; error?: string };
        try {
          json = await res.json();
        } catch {
          throw new Error(t('assetsServerNonJson', { status: res.status }));
        }
        if (!res.ok || !json.success) {
          const msg = json.error ?? t('assetsFailedLoadHttp', { status: res.status });
          setFetchError(msg);
          if (pageNum === 0) setAssets([]);
          return;
        }
        const newAssets = json.assets ?? [];
        if (pageNum === 0) setAssets(newAssets);
        else setAssets((prev) => [...prev, ...newAssets]);
        setHasMore(json.hasMore ?? false);
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const msg = isAbort
          ? t('assetsLoadTimeout')
          : err instanceof Error
            ? err.message
            : String(err);
        setFetchError(isAbort ? msg : t('assetsCouldNotReach', { message: msg }));
        if (pageNum === 0) setAssets([]);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [workspaceQs, t, folderPath, periodYm],
  );

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchAssets(next);
  }, [page, fetchAssets]);

  useEffect(() => {
    setPage(0);
    fetchAssets(0);
  }, [fetchAssets]);

  useEffect(() => {
    const nextPath = folderPathFromSearchParams(new URLSearchParams(searchParams.toString()));
    setFolderPath((prev) => {
      if (
        prev.client === nextPath.client &&
        prev.mainCategory === nextPath.mainCategory &&
        prev.year === nextPath.year &&
        prev.month === nextPath.month &&
        prev.subCategory === nextPath.subCategory
      ) {
        return prev;
      }
      return nextPath;
    });
  }, [searchParams]);

  useEffect(() => {
    setUploadMonth(periodYm);
  }, [periodYm]);

  // Prepend latest uploaded asset
  useEffect(() => {
    if (!latestAsset) return;
    setAssets((prev) => {
      if (prev.some((a) => a.id === latestAsset.id)) return prev;
      return [latestAsset, ...prev];
    });
    if (scheduleAfterUpload) {
      setScheduleAfterUpload(false);
      setScheduleAsset(latestAsset as Asset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAsset]);

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name, slug, logo')
      .order('name')
      .then(({ data }) => {
        if (data) setClients(data as Client[]);
      });
  }, []);

  useEffect(() => {
    supabase
      .from('team_members')
      .select('*')
      .order('full_name')
      .then(({ data }) => {
        if (data) setTeam(data as TeamMember[]);
      });
  }, []);

  useEffect(() => {
    if (assets.length === 0) return;
    supabase
      .from('publishing_schedules')
      .select('asset_id, scheduled_date, status')
      .in(
        'asset_id',
        assets.map((a) => a.id),
      )
      .neq('status', 'cancelled')
      .order('scheduled_date', { ascending: true })
      .then(({ data }) => {
        const counts: Record<string, { count: number; nextDate: string | null }> = {};
        for (const row of data ?? []) {
          const id = row.asset_id as string;
          if (!counts[id]) counts[id] = { count: 0, nextDate: null };
          counts[id].count++;
          if (!counts[id].nextDate) counts[id].nextDate = row.scheduled_date as string;
        }
        setScheduleCounts(counts);
      });
  }, [assets]);

  // ── Derived: path depth ───────────────────────────────────────────────────

  const pathDepth = useMemo(() => {
    if (folderPath.subCategory) return 5;
    if (folderPath.month) return 4;
    if (folderPath.year) return 3;
    if (folderPath.mainCategory) return 2;
    if (folderPath.client) return 1;
    return 0;
  }, [folderPath]);

  // ── Filtered assets ───────────────────────────────────────────────────────

  const filteredAssets = useMemo(() => {
    let result = [...deferredAssets];

    // Folder path filters
    if (folderPath.client)
      result = result.filter((a) => getAssetClientFolderName(a) === folderPath.client);
    if (folderPath.mainCategory)
      result = result.filter((a) => (a.main_category ?? 'other') === folderPath.mainCategory);
    if (folderPath.year) result = result.filter((a) => getAssetYear(a) === folderPath.year);
    if (folderPath.month) result = result.filter((a) => a.month_key === folderPath.month);
    if (folderPath.subCategory)
      result = result.filter((a) => (a.sub_category ?? 'general') === folderPath.subCategory);

    // Text search
    if (deferredSearchQuery) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.client_name?.toLowerCase().includes(q) ?? false) ||
          (a.main_category?.toLowerCase().includes(q) ?? false) ||
          (a.sub_category?.toLowerCase().includes(q) ?? false) ||
          (a.file_type?.toLowerCase().includes(q) ?? false) ||
          (a.month_key?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filterFileType)
      result = result.filter((a) => (a.file_type ?? a.mime_type ?? '').startsWith(filterFileType));

    if (sortBy === 'oldest')
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === 'largest') result.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0));
    else result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [
    deferredAssets,
    deferredSearchQuery,
    folderPath,
    filterFileType,
    sortBy,
    getAssetClientFolderName,
  ]);

  // ── Folder entries for next level ─────────────────────────────────────────

  const folderEntries = useMemo(() => {
    if (pathDepth >= 5) return [];
    type Agg = { key: string; count: number; totalBytes: number; kinds: FolderKindCounts };
    const map = new Map<string, Agg>();
    for (const asset of filteredAssets) {
      let key: string | undefined;
      if (pathDepth === 0) key = getAssetClientFolderName(asset) ?? undefined;
      else if (pathDepth === 1) key = asset.main_category ?? 'other';
      else if (pathDepth === 2) key = getAssetYear(asset);
      else if (pathDepth === 3) key = asset.month_key ?? '';
      else if (pathDepth === 4) key = asset.sub_category ?? 'general';
      if (!key) continue;
      let row = map.get(key);
      if (!row) {
        row = { key, count: 0, totalBytes: 0, kinds: emptyFolderKindCounts() };
        map.set(key, row);
      }
      row.count++;
      row.totalBytes += asset.file_size ?? 0;
      row.kinds[folderAssetKind(asset)]++;
    }
    return [...map.values()]
      .map((row) => ({
        key: row.key,
        count: row.count,
        totalBytes: row.totalBytes,
        kindSummary: buildFolderKindSummary(row.kinds, t),
      }))
      .sort((a, b) => {
        if (pathDepth === 2 || pathDepth === 3) return b.key.localeCompare(a.key);
        return a.key.localeCompare(b.key);
      });
  }, [filteredAssets, pathDepth, t, getAssetClientFolderName]);

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    if (folderPath.client) {
      items.push({ label: folderPath.client, path: { client: folderPath.client } });
    }
    if (folderPath.mainCategory) {
      items.push({
        label: mainCategoryLabel(folderPath.mainCategory),
        path: { client: folderPath.client, mainCategory: folderPath.mainCategory },
      });
    }
    if (folderPath.year) {
      items.push({
        label: folderPath.year,
        path: {
          client: folderPath.client,
          mainCategory: folderPath.mainCategory,
          year: folderPath.year,
        },
      });
    }
    if (folderPath.month) {
      const mk = folderPath.month;
      const label = mk.length >= 7 ? `${monthLabel(mk.slice(5, 7), t)} ${mk.slice(0, 4)}` : mk;
      items.push({
        label,
        path: {
          client: folderPath.client,
          mainCategory: folderPath.mainCategory,
          year: folderPath.year,
          month: folderPath.month,
        },
      });
    }
    if (folderPath.subCategory) {
      items.push({
        label: subCategoryLabel(folderPath.mainCategory ?? '', folderPath.subCategory),
        path: { ...folderPath },
      });
    }
    return items;
  }, [folderPath, t]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo = useCallback(
    (path: FolderPath) => {
      setFolderPath(path);
      setSearchQuery('');
      updateAssetsUrl(path, previewAsset?.name ?? null, previewAsset?.id ?? null);
    },
    [updateAssetsUrl, previewAsset],
  );

  const navigateInto = useCallback(
    (key: string) => {
      setFolderPath((prev) => {
        let next = prev;
        if (pathDepth === 0) next = { client: key };
        else if (pathDepth === 1) next = { ...prev, mainCategory: key };
        else if (pathDepth === 2) next = { ...prev, year: key };
        else if (pathDepth === 3) next = { ...prev, month: key };
        else if (pathDepth === 4) next = { ...prev, subCategory: key };
        updateAssetsUrl(next, previewAsset?.name ?? null, previewAsset?.id ?? null);
        return next;
      });
      setSearchQuery('');
    },
    [pathDepth, updateAssetsUrl, previewAsset],
  );

  const goUp = useCallback(() => {
    setFolderPath((prev) => {
      const p = { ...prev };
      if (p.subCategory) {
        delete p.subCategory;
      } else if (p.month) {
        delete p.month;
      } else if (p.year) {
        delete p.year;
      } else if (p.mainCategory) {
        delete p.mainCategory;
      } else if (p.client) {
        delete p.client;
      }
      updateAssetsUrl(p, previewAsset?.name ?? null, previewAsset?.id ?? null);
      return p;
    });
  }, [updateAssetsUrl, previewAsset]);

  // ── Folder card labels ────────────────────────────────────────────────────

  const folderCardLabel = (key: string): string => {
    if (pathDepth === 0) return key === 'No Client' ? t('assetsNoClient') : key;
    if (pathDepth === 1) return mainCategoryLabel(key);
    if (pathDepth === 2) return key === 'Unknown' ? t('assetsYearUnknown') : key;
    if (pathDepth === 3) {
      if (key.length >= 7) return `${monthLabel(key.slice(5, 7), t)} ${key.slice(0, 4)}`;
      return key || t('assetsUnknownType');
    }
    if (pathDepth === 4) return subCategoryLabel(folderPath.mainCategory ?? '', key);
    return key;
  };

  const folderCardColor = (key: string): string | undefined => {
    if (pathDepth === 1) return CATEGORY_COLORS[key];
    return undefined;
  };

  // ── File helpers ──────────────────────────────────────────────────────────

  const filesToItems = (files: File[]): FileUploadItem[] =>
    files.map((file) => ({
      id: nextFileId(),
      file,
      previewUrl: makePreviewUrl(file),
      uploadName: getFileBaseName(file.name),
      thumbnailBlob: null,
      durationSeconds: null,
      previewBlob: null,
    }));

  const revokeItemUrls = useCallback((items: FileUploadItem[]) => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }, []);

  const openPendingBatch = useCallback(
    (files: File[], opts?: { append?: boolean }) => {
      if (!files.length) return;
      const append = Boolean(opts?.append);
      const items = filesToItems(files);
      setPendingItems((prev) => (append && prev.length ? [...prev, ...items] : items));
      setUploadMainCategory(folderPath.mainCategory ?? MAIN_CATEGORIES[0].slug);
      setUploadSubCategory(folderPath.subCategory ?? '');
      setUploadMonth(folderPath.month ?? periodYm);
      if (folderPath.client) {
        const found = clients.find((c) => c.name === folderPath.client);
        setUploadClientName(folderPath.client);
        setUploadClientId(found?.id ?? '');
      } else if (!append) {
        setUploadClientName('');
        setUploadClientId('');
      }

      // Asynchronously generate thumbnails for video files.
      items.forEach((item) => {
        if (!isVideoFile(item.file.name, item.file.type)) return;
        void generateVideoThumbnail(item.file).then((result) => {
          if (!result) return;
          setPendingItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    previewUrl: result.blobUrl,
                    thumbnailBlob: result.blob,
                    durationSeconds: result.durationSeconds,
                  }
                : i,
            ),
          );
        });
      });

      // Asynchronously generate first-page previews for PDF files.
      items.forEach((item) => {
        if (!isPdfFile(item.file.name, item.file.type)) return;
        void generatePdfPreview(item.file).then((result) => {
          if (!result) return;
          setPendingItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, previewUrl: result.blobUrl, previewBlob: result.blob } : i,
            ),
          );
        });
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [folderPath, clients, periodYm],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    openPendingBatch(Array.from(e.target.files ?? []));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleNewClientCreated = useCallback((client: Client) => {
    setClients((prev) => {
      if (prev.some((c) => c.id === client.id)) return prev;
      return [...prev, client].sort((a, b) => a.name.localeCompare(b.name));
    });
    setUploadClientName(client.name);
    setUploadClientId(client.id);
  }, []);

  const handleUploadNameChange = (id: string, name: string) => {
    setPendingItems((prev) => prev.map((i) => (i.id === id ? { ...i, uploadName: name } : i)));
  };

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const onDragOver = (e: React.DragEvent) => {
    if (!canUpload) return;
    e.preventDefault();
    setIsDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (canUpload) openPendingBatch(Array.from(e.dataTransfer.files));
  };

  // ── Upload confirm ────────────────────────────────────────────────────────

  const startUploadBatch = (andSchedule: boolean) => {
    const items = [...pendingItems];
    if (!items.length) return;
    let clientName = uploadClientName.trim();
    let clientId = uploadClientId.trim();
    if (clientId && !clientName) {
      clientName = clients.find((c) => c.id === clientId)?.name?.trim() ?? '';
    }
    if (clientName && !clientId) {
      clientId = clients.find((c) => c.name === clientName)?.id?.trim() ?? '';
    }
    if (!clientName) {
      toast(t('uploadClientRequired'), 'error');
      return;
    }
    setPendingItems([]);
    setQuickActionUploadOpen(false);
    if (andSchedule) setScheduleAfterUpload(true);
    const uploadedBy = user?.name || user?.email || null;
    const uploadedByEmail = user?.email || null;
    startBatch(
      items.map((i) => ({
        id: i.id,
        file: i.file,
        previewUrl: i.previewUrl,
        uploadName: i.uploadName,
        thumbnailBlob: i.thumbnailBlob,
        durationSeconds: i.durationSeconds,
        previewBlob: i.previewBlob,
      })),
      {
        clientName,
        clientId,
        contentType: '',
        mainCategory: uploadMainCategory,
        subCategory: uploadSubCategory,
        monthKey: uploadMonth,
        uploadedBy,
        uploadedByEmail,
      },
    );
    toast(
      items.length === 1
        ? t('assetsUploadQueuedOne')
        : t('assetsUploadQueuedMany', { count: items.length }),
      'success',
    );
  };

  // ── Selection state ───────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingClient, setDownloadingClient] = useState<string | null>(null);
  const [deletingClientFolder, setDeletingClientFolder] = useState<string | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<Asset | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<{
    clientLabel: string;
    ids: string[];
  } | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectFolder = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setSelectedIds((prev) => {
      const allIn = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allIn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(true);
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    const allIds = filteredAssets.map((a) => a.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }, [filteredAssets, selectedIds]);

  // ── Download helpers ──────────────────────────────────────────────────────

  /** Fetch a ZIP from the API and download it. */
  const downloadZip = useCallback(
    async (ids: string[], archiveName: string) => {
      if (ids.length === 0) return;
      setDownloadingZip(true);
      try {
        const res = await fetch(`/api/assets/download-zip?ids=${ids.join(',')}&${workspaceQs}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          toast(
            (json as { error?: string }).error ??
              t('assetsDownloadFailedHttp', { status: res.status }),
            'error',
          );
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        triggerDownload(url, archiveName);
        URL.revokeObjectURL(url);
        toast(t('assetsDownloadReady'), 'success');
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : t('assetsDownloadFailed'), 'error');
      } finally {
        setDownloadingZip(false);
      }
    },
    [toast, workspaceQs, t],
  );

  const handleDownloadClient = useCallback(
    async (clientName: string) => {
      setDownloadingClient(clientName);
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('id')
          .eq('client_name', clientName);
        if (error) {
          toast(t('assetsFetchForZipFailed', { message: error.message }), 'error');
          return;
        }
        const ids = (data ?? []).map((r: { id: string }) => r.id).filter(Boolean);
        if (ids.length === 0) {
          toast(t('assetsNoZipFilesForClient'), 'error');
          return;
        }
        await downloadZip(ids, `${clientName.replace(/[/\\:*?"<>|]/g, '_')}.zip`);
      } catch (err: unknown) {
        toast(err instanceof Error ? err.message : t('assetsDownloadFailed'), 'error');
      } finally {
        setDownloadingClient(null);
      }
    },
    [downloadZip, toast, t],
  );

  const handleDownloadSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (ids.length === 1) {
      const asset = filteredAssets.find((a) => a.id === ids[0]);
      if (asset) {
        triggerDownload(asset.download_url ?? asset.file_url, asset.name);
        return;
      }
    }
    await downloadZip(ids, `assets-selected-${ids.length}.zip`);
  }, [selectedIds, filteredAssets, downloadZip]);

  const handleDeleteClientFolder = useCallback(
    async (clientLabel: string, ids: string[]) => {
      if (!ids.length) return;
      setDeletingClientFolder(clientLabel);
      const actionLabel = `${t('deleteAction')} / ${clientLabel}`;
      try {
        const results = await Promise.allSettled(
          ids.map(async (id) => {
            const res = await fetch(`/api/assets/${id}?${workspaceQs}`, { method: 'DELETE' });
            if (!res.ok) {
              const j = (await res.json().catch(() => ({}))) as { error?: string };
              throw new Error(j.error ?? `HTTP ${res.status}`);
            }
            return id;
          }),
        );
        const deletedIds = results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
          .map((r) => r.value);
        const failedCount = results.length - deletedIds.length;
        if (deletedIds.length > 0) {
          const deletedSet = new Set(deletedIds);
          setAssets((prev) => prev.filter((a) => !deletedSet.has(a.id)));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            deletedIds.forEach((id) => next.delete(id));
            return next;
          });
        }
        if (failedCount > 0) {
          toast(`${actionLabel}: ${failedCount} failed, ${deletedIds.length} deleted`, 'error');
          return;
        }
        toast(`${actionLabel}: ${t('assetsDeletedSuccess')}`, 'success');
      } catch (err: unknown) {
        toast(
          `${actionLabel}: ${t('assetsDeleteFailed', { error: err instanceof Error ? err.message : t('unknownError') })}`,
          'error',
        );
      } finally {
        setDeletingClientFolder(null);
      }
    },
    [t, toast, workspaceQs],
  );

  const handleDelete = async (asset: Asset) => {
    const actionLabel = `${t('deleteAction')} / ${asset.name}`;
    try {
      setDeletingAssetId(asset.id);
      const response = await fetch(`/api/assets/${asset.id}?${workspaceQs}`, { method: 'DELETE' });
      const json = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };
      if (!response.ok || json.success === false) {
        throw new Error(json.error ?? `HTTP ${response.status}`);
      }
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      void fetchAssets(0);
      toast(`${actionLabel}: ${t('assetsDeletedSuccess')}`, 'success');
      setPendingDeleteAsset(null);
    } catch (err) {
      toast(
        `${actionLabel}: ${t('assetsDeleteFailed', { error: err instanceof Error ? err.message : t('unknownError') })}`,
        'error',
      );
    } finally {
      setDeletingAssetId((current) => (current === asset.id ? null : current));
    }
  };

  const handleRename = async (asset: Asset, newName: string) => {
    const actionLabel = `Rename / ${asset.name}`;
    const res = await fetch(`/api/assets/${asset.id}?${workspaceQs}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const json = (await res.json()) as { success?: boolean; error?: string; name?: string };
    if (!res.ok) {
      toast(
        `${actionLabel}: ${t('assetsRenameFailed', { error: String(json.error ?? `HTTP ${res.status}`) })}`,
        'error',
      );
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    setAssets((prev) =>
      prev.map((a) => (a.id === asset.id ? { ...a, name: json.name ?? newName } : a)),
    );
    toast(`${actionLabel}: ${t('assetsRenamedSuccess')}`, 'success');
  };

  const handleView = (asset: Asset) => {
    setPreviewAsset(asset);
    updateAssetsUrl(folderPath, asset.name, asset.id);
  };

  const closePreview = useCallback(() => {
    setPreviewAsset(null);
    updateAssetsUrl(folderPath, null, null);
  }, [folderPath, updateAssetsUrl]);

  useEffect(() => {
    const previewName = searchParams.get('preview');
    const previewId = searchParams.get('previewId');
    if (!previewName && !previewId) {
      if (previewAsset) setPreviewAsset(null);
      return;
    }
    const match =
      (previewId ? assets.find((a) => a.id === previewId) : null) ??
      assets.find((a) => a.name === previewName);
    if (!match) return;
    setPreviewAsset((prev) => (prev?.id === match.id ? prev : match));
  }, [searchParams, assets, previewAsset]);

  const handleCopyLink = async (asset: Asset) => {
    try {
      await navigator.clipboard.writeText(asset.view_url ?? asset.file_url);
      toast(t('assetsLinkCopied'), 'success');
    } catch {
      toast(t('assetsLinkCopyFailed'), 'error');
    }
  };

  const handleScheduleCreated = (schedule: PublishingSchedule) => {
    if (schedule.asset_id) {
      const assetId = schedule.asset_id;
      setScheduleCounts((prev) => {
        const existing = prev[assetId] ?? { count: 0, nextDate: null };
        const existingTime = existing.nextDate ? new Date(existing.nextDate).getTime() : Infinity;
        const newTime = new Date(schedule.scheduled_date).getTime();
        const nextDate = existingTime <= newTime ? existing.nextDate : schedule.scheduled_date;
        return { ...prev, [assetId]: { count: existing.count + 1, nextDate } };
      });
    }
    toast(t('assetsPublishingScheduled'), 'success');
  };

  const hasActiveFilters = Boolean(searchQuery || filterFileType);
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterFileType('');
  }, []);

  const availableFileTypes = useMemo(() => {
    const types = new Set<string>();
    for (const a of assets) {
      const mt = a.file_type ?? a.mime_type ?? '';
      const prefix = mt.split('/')[0];
      if (prefix) types.add(prefix);
    }
    return Array.from(types).sort();
  }, [assets]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <PageShell
        className="max-w-6xl space-y-6"
        ref={dropZoneRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <PageHeader
          title={t('assets')}
          subtitle={t('assetsSubtitle')}
          actions={
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canUpload && !selectionMode && (
                <Button
                  type="button"
                  variant="primary"
                  disabled={isUploading}
                  onClick={() => !isUploading && fileRef.current?.click()}
                >
                  <Upload size={16} />
                  {isUploading ? t('assetsUploading') : t('uploadFile')}
                </Button>
              )}
              {!selectionMode ? (
                <Button type="button" variant="secondary" onClick={enterSelectionMode}>
                  <Square size={14} /> {t('assetsSelect')}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={handleToggleSelectAll}>
                    <CheckSquare size={14} />
                    {filteredAssets.length > 0 && filteredAssets.every((a) => selectedIds.has(a.id))
                      ? t('assetsDeselectAll')
                      : t('assetsSelectAll')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-2 border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] disabled:opacity-40"
                    onClick={() => void handleDownloadSelected()}
                    disabled={selectedIds.size === 0 || downloadingZip}
                  >
                    <Download size={14} />
                    {downloadingZip
                      ? t('assetsPreparing')
                      : selectedIds.size > 0
                        ? t('assetsDownloadCount', { n: selectedIds.size })
                        : t('assetsDownloadSelected')}
                  </Button>
                  <Button type="button" variant="danger" onClick={exitSelectionMode}>
                    <X size={14} /> {t('cancel')}
                  </Button>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
          }
        />

        {/* ── Breadcrumb navigation ────────────────────────────────────────── */}
        {breadcrumbItems.length > 0 && (
          <Card padding="sm" className="sm:px-5 sm:py-3">
            <CardContent className="flex items-center gap-2 !p-0">
              <Breadcrumb items={breadcrumbItems} onNavigate={navigateTo} />
              <Button
                type="button"
                variant="ghost"
                className="ms-auto gap-1.5 text-sm"
                onClick={goUp}
              >
                <ChevronLeft size={12} /> {t('assetsUp')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Filter bar ───────────────────────────────────────────────────── */}
        <Card padding="sm" className="sm:p-5">
          <CardContent className="space-y-3 !p-0">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute start-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--text-secondary)]"
                />
                <Input
                  type="text"
                  placeholder={t('assetsSearchFilesPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-8"
                />
              </div>
              <SelectDropdown
                value={filterFileType}
                onChange={setFilterFileType}
                placeholder={t('assetsAllFileTypes')}
                options={[
                  { value: '', label: t('assetsAllFileTypes') },
                  { value: 'image', label: t('assetsTypeImages') },
                  { value: 'video', label: t('assetsTypeVideos') },
                  { value: 'audio', label: t('assetsTypeAudio') },
                  { value: 'application/pdf', label: t('assetsTypePdfs') },
                  ...availableFileTypes
                    .filter((tp) => !['image', 'video', 'audio'].includes(tp))
                    .map((tp) => ({ value: tp, label: tp.charAt(0).toUpperCase() + tp.slice(1) })),
                ]}
              />
              <SelectDropdown
                value={sortBy}
                onChange={(v) => setSortBy(v as 'newest' | 'oldest' | 'largest')}
                options={[
                  { value: 'newest', label: t('assetsSortNewest') },
                  { value: 'oldest', label: t('assetsSortOldest') },
                  { value: 'largest', label: t('assetsSortLargest') },
                ]}
              />
              {hasActiveFilters && (
                <Button type="button" variant="danger" onClick={clearFilters}>
                  <X size={13} /> {t('clear')}
                </Button>
              )}
            </div>
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5">
                {filterFileType && (
                  <FilterBadge
                    label={fileTypeFilterLabel(filterFileType, t)}
                    onRemove={() => setFilterFileType('')}
                  />
                )}
                {searchQuery && (
                  <FilterBadge label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Drag-over overlay ────────────────────────────────────────────── */}
        {isDragOver && (
          <div
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', outline: '3px dashed var(--accent)' }}
          >
            <div className="space-y-2 text-center">
              <Upload size={48} style={{ color: 'var(--accent)', margin: '0 auto' }} />
              <p className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>
                {t('assetsDropToUpload')}
              </p>
            </div>
          </div>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        {loading ? (
          <LoadingState
            rows={6}
            className="min-[440px]:grid-cols-2 grid-cols-1 xl:grid-cols-3"
            cardHeightClass="min-h-[12rem]"
          />
        ) : fetchError ? (
          <ErrorState
            title={t('assetsFailedLoadTitle')}
            description={fetchError}
            actionLabel={t('assetsRetry')}
            onAction={() => void fetchAssets(0)}
          />
        ) : filteredAssets.length === 0 ? (
          /* Empty state */
          <GlobalEmptyState
            title={
              hasActiveFilters || breadcrumbItems.length > 0
                ? t('assetsNoMatchingFiles')
                : t('noAssetsYet')
            }
            description={
              hasActiveFilters || breadcrumbItems.length > 0
                ? t('assetsNoMatchingDesc')
                : t('noAssetsDesc')
            }
            actionLabel={
              !hasActiveFilters && canUpload
                ? t('uploadFile')
                : hasActiveFilters || breadcrumbItems.length > 0
                  ? t('assetsClearAll')
                  : undefined
            }
            onAction={
              !hasActiveFilters && canUpload
                ? () => !isUploading && fileRef.current?.click()
                : hasActiveFilters || breadcrumbItems.length > 0
                  ? () => {
                      clearFilters();
                      navigateTo({});
                    }
                  : undefined
            }
          />
        ) : pathDepth < 5 && folderEntries.length > 0 ? (
          /* ── Folder grid (navigate deeper) ─────────────────────────────── */
          <>
            {selectionMode ? (
              <div
                className="mb-4 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                style={{
                  borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
                  background: 'color-mix(in srgb, var(--accent) 7%, var(--surface-2))',
                  color: 'var(--text)',
                }}
              >
                {t('assetsSelectionFolderHint')}
              </div>
            ) : null}
            <div className="min-[440px]:grid-cols-2 grid grid-cols-1 gap-4 xl:grid-cols-3">
              {folderEntries.map(({ key, count, totalBytes, kindSummary }) => {
                const folderIds =
                  pathDepth === 0
                    ? filteredAssets
                        .filter((a) => getAssetClientFolderName(a) === key)
                        .map((a) => a.id)
                    : assetIdsForFolderEntry(filteredAssets, pathDepth, key);
                return pathDepth === 0 ? (
                  <ClientFolderCard
                    key={key}
                    label={key}
                    count={count}
                    totalBytes={totalBytes}
                    kindSummary={kindSummary}
                    slug={clientByName.get(key)?.slug}
                    logoUrl={clientByName.get(key)?.logo}
                    onView={() => navigateInto(key)}
                    onDownload={() => void handleDownloadClient(key)}
                    onDelete={() => setPendingDeleteFolder({ clientLabel: key, ids: folderIds })}
                    isDownloading={downloadingClient === key}
                    isDeleting={deletingClientFolder === key}
                    canDelete={canDeleteFiles}
                    selectionMode={selectionMode}
                    folderAssetIds={folderIds}
                    selectedIds={selectedIds}
                    onToggleFolderSelect={() => toggleSelectFolder(folderIds)}
                  />
                ) : (
                  <FolderCard
                    key={key}
                    label={folderCardLabel(key)}
                    count={count}
                    totalBytes={totalBytes}
                    kindSummary={kindSummary}
                    color={folderCardColor(key)}
                    onClick={() => navigateInto(key)}
                    selectionMode={selectionMode}
                    folderAssetIds={folderIds}
                    selectedIds={selectedIds}
                    onToggleFolderSelect={() => toggleSelectFolder(folderIds)}
                  />
                );
              })}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="secondary" className="px-6" onClick={loadMore}>
                  Load More
                </Button>
              </div>
            )}
          </>
        ) : (
          /* ── File grid (deepest level or flat search results) ──────────── */
          <>
            {pathDepth >= 5 && (
              <div className="flex items-center gap-2">
                <File size={14} style={{ color: 'var(--text-secondary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {filteredAssets.length} {filteredAssets.length === 1 ? 'file' : 'files'}
                </span>
              </div>
            )}
            <AssetsGrid
              assets={filteredAssets}
              canDelete={canDeleteFiles}
              canRename={canDeleteFiles || user?.role === 'team_member'}
              scheduleCounts={scheduleCounts}
              selectable={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onView={handleView}
              onDelete={(asset) => setPendingDeleteAsset(asset)}
              onCopyLink={(asset) => void handleCopyLink(asset)}
              onComments={(asset) => setCommentsAsset(asset)}
              onRename={(asset, name) => handleRename(asset, name)}
              onSchedule={(asset) => setScheduleAsset(asset)}
              clientLogoByClientId={clientLogoByClientId}
            />
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="secondary" className="px-6" onClick={loadMore}>
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </PageShell>

      {/* ── Upload modal ─────────────────────────────────────────────────────── */}
      {(pendingItems.length > 0 || quickActionUploadOpen) && (
        <UploadModal
          files={pendingItems}
          mainCategory={uploadMainCategory}
          subCategory={uploadSubCategory}
          monthKey={uploadMonth}
          clientName={uploadClientName}
          clientId={uploadClientId}
          clients={clients}
          onMainCategoryChange={setUploadMainCategory}
          onSubCategoryChange={setUploadSubCategory}
          onMonthChange={setUploadMonth}
          onClientChange={(name, id) => {
            setUploadClientName(name);
            setUploadClientId(id);
          }}
          onNewClientCreated={handleNewClientCreated}
          onConfirm={() => startUploadBatch(false)}
          onConfirmAndSchedule={() => startUploadBatch(true)}
          onCancel={() => {
            revokeItemUrls(pendingItems);
            setPendingItems([]);
            setQuickActionUploadOpen(false);
          }}
          onAddFiles={(files) => openPendingBatch(Array.from(files), { append: true })}
          onUploadNameChange={handleUploadNameChange}
          onRemoveFile={(id) =>
            setPendingItems((prev) => {
              const removed = prev.find((i) => i.id === id);
              if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
              return prev.filter((i) => i.id !== id);
            })
          }
        />
      )}

      {/* ── Schedule publishing modal ─────────────────────────────────────── */}
      {scheduleAsset && (
        <SchedulePublishingModal
          asset={scheduleAsset}
          clients={clients}
          team={team}
          onCreated={handleScheduleCreated}
          onClose={() => setScheduleAsset(null)}
        />
      )}

      {/* ── Preview modal ─────────────────────────────────────────────────── */}
      {previewAsset && (
        <FilePreviewModal
          file={{
            name: previewAsset.name,
            url: previewAsset.preview_url || previewAsset.file_url,
            downloadUrl: previewAsset.download_url ?? previewAsset.file_url,
            openUrl: previewAsset.web_view_link || previewAsset.view_url || null,
            mimeType: previewAsset.file_type ?? previewAsset.mime_type ?? null,
            size: previewAsset.file_size ?? null,
          }}
          onClose={closePreview}
        />
      )}

      {/* ── Comments modal ────────────────────────────────────────────────── */}
      {commentsAsset && (
        <AppModal
          open
          onClose={() => setCommentsAsset(null)}
          title={commentsAsset.name}
          subtitle={t('assetsModalCommentsSubtitle')}
          size="sm"
        >
          <CommentsPanel assetId={commentsAsset.id} />
        </AppModal>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteAsset)}
        title={t('deleteAction')}
        description={
          pendingDeleteAsset
            ? t('assetsDeleteConfirm', { name: pendingDeleteAsset.name })
            : t('deleteAction')
        }
        confirmLabel={t('deleteAction')}
        cancelLabel={t('cancel')}
        destructive
        loading={Boolean(pendingDeleteAsset) && deletingAssetId === pendingDeleteAsset?.id}
        onCancel={() => setPendingDeleteAsset(null)}
        onConfirm={async () => {
          if (!pendingDeleteAsset) return;
          await handleDelete(pendingDeleteAsset);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteFolder)}
        title={t('deleteAction')}
        description={
          pendingDeleteFolder
            ? t('assetsDeleteConfirm', { name: pendingDeleteFolder.clientLabel })
            : t('deleteAction')
        }
        confirmLabel={t('deleteAction')}
        cancelLabel={t('cancel')}
        destructive
        loading={
          Boolean(pendingDeleteFolder) && deletingClientFolder === pendingDeleteFolder?.clientLabel
        }
        onCancel={() => setPendingDeleteFolder(null)}
        onConfirm={async () => {
          if (!pendingDeleteFolder) return;
          await handleDeleteClientFolder(pendingDeleteFolder.clientLabel, pendingDeleteFolder.ids);
          setPendingDeleteFolder(null);
        }}
      />
    </>
  );
}

export default function AssetsPageWrapper() {
  return (
    <Suspense>
      <AssetsPage />
    </Suspense>
  );
}
