'use client';

import { useEffect, useState, useRef, useCallback, useDeferredValue, useMemo } from 'react';
import {
  Upload, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  Trash2, Eye, Download, Link, X, CheckCircle, AlertCircle,
  Search, ThumbsUp, ThumbsDown, MessageSquare, Pencil, Check,
  ChevronRight, Folder, Send, Calendar, ChevronLeft, Home,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/ui/EmptyState';
import CommentsPanel from '@/components/ui/CommentsPanel';
import SelectDropdown from '@/components/ui/SelectDropdown';
import UploadModal from '@/components/upload/UploadModal';
import SchedulePublishingModal from '@/components/publishing/SchedulePublishingModal';
import {
  MAIN_CATEGORIES,
  SUBCATEGORIES,
  mainCategoryLabel,
  subCategoryLabel,
  type MainCategorySlug,
} from '@/lib/asset-utils';
import { useUpload, type InitialUploadItem } from '@/lib/upload-context';
import type { Asset, Client, TeamMember, PublishingSchedule } from '@/lib/types';
import FilePreviewModal from '@/components/ui/FilePreviewModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FolderPath {
  client?:       string; // client_name
  mainCategory?: string; // slug
  year?:         string;
  month?:        string; // "YYYY-MM"
  subCategory?:  string; // slug
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers / sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
      style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70 transition-opacity leading-none" title="Remove filter">
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
}

interface ToastMsg { id: number; message: string; type: 'success' | 'error' }

function Toast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-[340px] z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{ background: toast.type === 'success' ? '#16a34a' : '#dc2626', minWidth: 240, animation: 'fadeSlideUp 0.2s ease' }}
        >
          {toast.type === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <X size={16} className="shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── File type helpers ─────────────────────────────────────────────────────────

function getPreviewUrl(url?: string | null): string { return url ?? ''; }

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isImage(name: string, type?: string) { return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || (type?.startsWith('image/') ?? false); }
function isPdf(name: string, type?: string)   { return /\.pdf$/i.test(name) || type === 'application/pdf'; }
function isVideo(name: string, type?: string) { return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name) || (type?.startsWith('video/') ?? false); }
function isAudio(name: string, type?: string) { return /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(name) || (type?.startsWith('audio/') ?? false); }
function getEmbedUrl(asset: Asset): string | null { return asset.file_url || asset.view_url || null; }

function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf(name, type))   return <FileText  size={size} style={{ color: '#ef4444' }} />;
  if (isVideo(name, type)) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (isAudio(name, type)) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

function fileTypeLabel(name: string, type?: string): string {
  if (type) { const sub = type.split('/')[1]?.toUpperCase(); if (sub) return sub; }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00]/;
function validateUploadName(name: string): string | null {
  const t = name.trim();
  if (!t) return 'Name cannot be empty';
  if (INVALID_FILENAME_CHARS.test(t)) return 'Name contains invalid characters';
  if (t.startsWith('.')) return 'Name cannot start with a period';
  if (t.length > 200) return 'Name is too long (max 200 characters)';
  return null;
}

function getFileExtension(name: string): string { const p = name.split('.'); return p.length > 1 ? `.${p.pop()!.toLowerCase()}` : ''; }
function getFileBaseName(name: string): string { const ext = getFileExtension(name); return ext ? name.slice(0, name.length - ext.length) : name; }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthLabel(mm: string): string {
  const idx = parseInt(mm, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return mm;
  return MONTH_NAMES[idx] ?? mm;
}

function getAssetYear(asset: Asset): string {
  if (asset.month_key && asset.month_key.length >= 4) return asset.month_key.slice(0, 4);
  if (asset.created_at) return new Date(asset.created_at).getFullYear().toString();
  return 'Unknown';
}

// ── Folder Card ───────────────────────────────────────────────────────────────

function FolderCard({ label, count, color, onClick }: { label: string; count: number; color?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border text-left transition-all hover:border-[var(--accent)] hover:shadow-sm"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', minHeight: 100 }}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: color ? `${color}22` : 'rgba(99,102,241,0.1)' }}>
        <Folder size={20} style={{ color: color ?? 'var(--accent)' }} />
      </div>
      <div className="text-center min-w-0 w-full">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{count} {count === 1 ? 'file' : 'files'}</p>
      </div>
    </button>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

interface BreadcrumbItem { label: string; path: FolderPath; }

function Breadcrumb({ items, onNavigate }: { items: BreadcrumbItem[]; onNavigate: (path: FolderPath) => void }) {
  return (
    <nav className="flex items-center gap-1 flex-wrap" aria-label="Folder navigation">
      <button
        type="button"
        onClick={() => onNavigate({})}
        className="flex items-center justify-center h-7 w-7 rounded-lg transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-secondary)', background: 'var(--surface-2)' }}
        title="All clients"
      >
        <Home size={13} />
      </button>
      {items.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <ChevronRight size={13} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
          {idx < items.length - 1 ? (
            <button type="button" onClick={() => onNavigate(item.path)} className="text-xs font-medium hover:underline px-1" style={{ color: 'var(--accent)' }}>
              {item.label}
            </button>
          ) : (
            <span className="text-xs font-semibold px-1" style={{ color: 'var(--text)' }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ── Approval badge ────────────────────────────────────────────────────────────

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
  return <span className="text-xs px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: c.bg, color: c.text }}>{s}</span>;
}

// ── Asset Card ────────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: Asset;
  canDelete: boolean; canApprove: boolean; canRename: boolean;
  scheduleCount?: number; nextScheduleDate?: string | null;
  onView: () => void; onDelete: () => void; onCopyLink: () => void;
  onApprove: () => void; onReject: () => void; onComments: () => void;
  onRename: (n: string) => Promise<void>; onSchedule: () => void;
}

function AssetCard({ asset, canDelete, canApprove, canRename, scheduleCount, nextScheduleDate, onView, onDelete, onCopyLink, onApprove, onReject, onComments, onRename, onSchedule }: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState(asset.name);
  const [renaming, setRenaming]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditName(asset.name); }, [asset.name]);

  const startEdit  = () => { setEditName(asset.name); setIsEditing(true); setTimeout(() => inputRef.current?.select(), 0); };
  const cancelEdit = () => { setIsEditing(false); setEditName(asset.name); };
  const commitEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === asset.name) { cancelEdit(); return; }
    setRenaming(true);
    try { await onRename(trimmed); setIsEditing(false); } finally { setRenaming(false); }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commitEdit(); }
    if (e.key === 'Escape') cancelEdit();
  };

  const effectiveMime = asset.file_type ?? asset.mime_type ?? undefined;
  const img = isImage(asset.name, effectiveMime);
  const downloadUrl = asset.download_url ?? asset.file_url;
  const cardThumbSrc = asset.thumbnail_url || asset.preview_url || getPreviewUrl(asset.file_url);

  return (
    <div className="group rounded-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Thumbnail */}
      <div className="relative overflow-hidden cursor-pointer" style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }} onClick={onView}>
        {img && cardThumbSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cardThumbSrc} alt={asset.name} className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none'; const fb = e.currentTarget.nextElementSibling as HTMLElement | null; if (fb) fb.style.display = 'flex'; }} />
            <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
              <FileTypeIcon name={asset.name} type={effectiveMime} size={36} />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileTypeIcon name={asset.name} type={effectiveMime} size={36} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-0.5 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={handleKeyDown} disabled={renaming}
              className="flex-1 text-sm font-medium rounded px-1 py-0.5 min-w-0 outline-none border"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--accent)' }} />
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
            {canRename && (
              <button onClick={e => { e.stopPropagation(); startEdit(); }} title="Rename"
                className="opacity-0 group-hover/name:opacity-100 flex items-center justify-center h-5 w-5 rounded hover:opacity-70 shrink-0"
                style={{ color: 'var(--text-secondary)' }}>
                <Pencil size={11} />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {fileTypeLabel(asset.name, effectiveMime)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatSize(asset.file_size)}</span>
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
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatDate(asset.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
        <button onClick={onView} title="View" className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Eye size={13} /><span>View</span>
        </button>
        <button onClick={onSchedule} title="Schedule" className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium hover:opacity-70" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
          <Send size={13} /><span>Schedule</span>
        </button>
        <a href={downloadUrl} download={asset.name} title="Download" className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Download size={14} />
        </a>
        <button onClick={onCopyLink} title="Copy link" className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Link size={14} />
        </button>
        <button onClick={onComments} title="Comments" className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <MessageSquare size={14} />
        </button>
        {canApprove && asset.approval_status !== 'approved' && (
          <button onClick={onApprove} title="Approve" className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70" style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>
            <ThumbsUp size={14} />
          </button>
        )}
        {canApprove && asset.approval_status !== 'rejected' && (
          <button onClick={onReject} title="Reject" className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
            <ThumbsDown size={14} />
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} title="Delete" className="flex items-center justify-center h-8 w-8 rounded-lg hover:opacity-70" style={{ background: 'var(--surface-2)', color: '#ef4444' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'social-media': '#3b82f6',
  'videos':       '#8b5cf6',
  'designs':      '#f59e0b',
  'documents':    '#10b981',
  'other':        '#6b7280',
};

const FILE_TYPE_LABELS: Record<string, string> = {
  'image':           'Images',
  'video':           'Videos',
  'audio':           'Audio',
  'application/pdf': 'PDFs',
};

function fileTypeFilterLabel(value: string): string {
  return FILE_TYPE_LABELS[value] ?? (value.charAt(0).toUpperCase() + value.slice(1));
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS  = 15_000;
const TOAST_DURATION_MS = 4500;
function nextFileId() { return crypto.randomUUID(); }
function makePreviewUrl(file: File): string | null { return isImage(file.name, file.type) ? URL.createObjectURL(file) : null; }

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const isAdmin   = user?.role === 'admin';
  const canUpload = isAdmin || user?.role === 'team';

  const { startBatch, isUploading, latestAsset } = useUpload();

  // ── Data state ────────────────────────────────────────────────────────────
  const [assets, setAssets]           = useState<Asset[]>([]);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [page, setPage]               = useState(0);
  const [hasMore, setHasMore]         = useState(true);
  const [clients, setClients]         = useState<Client[]>([]);
  const [team, setTeam]               = useState<TeamMember[]>([]);
  const [scheduleCounts, setScheduleCounts] = useState<Record<string, { count: number; nextDate: string | null }>>({});

  // ── UI state ──────────────────────────────────────────────────────────────
  const [previewAsset, setPreviewAsset]   = useState<Asset | null>(null);
  const [commentsAsset, setCommentsAsset] = useState<Asset | null>(null);
  const [scheduleAsset, setScheduleAsset] = useState<Asset | null>(null);
  const [scheduleAfterUpload, setScheduleAfterUpload] = useState(false);
  const [toasts, setToasts]   = useState<ToastMsg[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef     = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const toastIdRef  = useRef(0);

  // ── Folder navigation ─────────────────────────────────────────────────────
  const [folderPath, setFolderPath] = useState<FolderPath>({});

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterFileType, setFilterFileType] = useState('');
  const [filterApproval, setFilterApproval] = useState('');
  const [sortBy, setSortBy]               = useState<'newest' | 'oldest' | 'largest'>('newest');

  // ── Upload modal state ────────────────────────────────────────────────────
  const [pendingItems, setPendingItems]             = useState<FileUploadItem[]>([]);
  const [uploadMainCategory, setUploadMainCategory] = useState<string>(MAIN_CATEGORIES[0].slug);
  const [uploadSubCategory, setUploadSubCategory]   = useState<string>('');
  const [uploadMonth, setUploadMonth]               = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [uploadClientName, setUploadClientName]     = useState<string>('');
  const [uploadClientId, setUploadClientId]         = useState<string>('');

  const deferredAssets      = useDeferredValue(assets);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // ── Toast ─────────────────────────────────────────────────────────────────

  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      toastTimersRef.current = toastTimersRef.current.filter(t => t !== timer);
    }, TOAST_DURATION_MS);
    toastTimersRef.current.push(timer);
  }, []);

  useEffect(() => () => { toastTimersRef.current.forEach(clearTimeout); }, []);
  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Fetch assets ──────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async (pageNum: number = 0) => {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      setFetchError(null);
      const res  = await fetch(`/api/assets?page=${pageNum}`, { signal: controller.signal });
      let json: { success: boolean; assets?: Asset[]; hasMore?: boolean; error?: string };
      try { json = await res.json(); } catch { throw new Error(`Server returned non-JSON response (HTTP ${res.status})`); }
      if (!res.ok || !json.success) {
        const msg = json.error ?? `Failed to load assets (HTTP ${res.status})`;
        setFetchError(msg);
        if (pageNum === 0) setAssets([]);
        return;
      }
      const newAssets = json.assets ?? [];
      if (pageNum === 0) setAssets(newAssets);
      else setAssets(prev => [...prev, ...newAssets]);
      setHasMore(json.hasMore ?? false);
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = isAbort ? 'Assets took too long to load. Please try again.' : (err instanceof Error ? err.message : String(err));
      setFetchError(isAbort ? msg : `Could not reach server: ${msg}`);
      if (pageNum === 0) setAssets([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchAssets(next);
  }, [page, fetchAssets]);

  useEffect(() => { fetchAssets(0); }, [fetchAssets]);

  // Prepend latest uploaded asset
  useEffect(() => {
    if (!latestAsset) return;
    setAssets(prev => {
      if (prev.some(a => a.id === latestAsset.id)) return prev;
      return [latestAsset, ...prev];
    });
    if (scheduleAfterUpload) {
      setScheduleAfterUpload(false);
      setScheduleAsset(latestAsset as Asset);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAsset]);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => { if (data) setClients(data as Client[]); });
  }, []);

  useEffect(() => {
    supabase.from('team_members').select('*').order('full_name').then(({ data }) => { if (data) setTeam(data as TeamMember[]); });
  }, []);

  useEffect(() => {
    if (assets.length === 0) return;
    supabase.from('publishing_schedules').select('asset_id, scheduled_date, status')
      .in('asset_id', assets.map(a => a.id)).neq('status', 'cancelled').order('scheduled_date', { ascending: true })
      .then(({ data }) => {
        const counts: Record<string, { count: number; nextDate: string | null }> = {};
        for (const row of (data ?? [])) {
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
    if (folderPath.subCategory)   return 5;
    if (folderPath.month)         return 4;
    if (folderPath.year)          return 3;
    if (folderPath.mainCategory)  return 2;
    if (folderPath.client)        return 1;
    return 0;
  }, [folderPath]);

  // ── Filtered assets ───────────────────────────────────────────────────────

  const filteredAssets = useMemo(() => {
    let result = [...deferredAssets];

    // Folder path filters
    if (folderPath.client)       result = result.filter(a => (a.client_name ?? 'No Client') === folderPath.client);
    if (folderPath.mainCategory) result = result.filter(a => (a.main_category ?? 'other') === folderPath.mainCategory);
    if (folderPath.year)         result = result.filter(a => getAssetYear(a) === folderPath.year);
    if (folderPath.month)        result = result.filter(a => a.month_key === folderPath.month);
    if (folderPath.subCategory)  result = result.filter(a => (a.sub_category ?? 'general') === folderPath.subCategory);

    // Text search
    if (deferredSearchQuery) {
      const q = deferredSearchQuery.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.client_name?.toLowerCase().includes(q) ?? false) ||
        (a.main_category?.toLowerCase().includes(q) ?? false) ||
        (a.sub_category?.toLowerCase().includes(q) ?? false) ||
        (a.file_type?.toLowerCase().includes(q) ?? false) ||
        (a.month_key?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filterFileType) result = result.filter(a => (a.file_type ?? a.mime_type ?? '').startsWith(filterFileType));
    if (filterApproval) result = result.filter(a => (a.approval_status ?? 'pending') === filterApproval);

    if (sortBy === 'oldest')       result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === 'largest') result.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0));
    else                           result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return result;
  }, [deferredAssets, deferredSearchQuery, folderPath, filterFileType, filterApproval, sortBy]);

  // ── Folder entries for next level ─────────────────────────────────────────

  const folderEntries = useMemo(() => {
    if (pathDepth >= 5) return [];
    return filteredAssets.reduce<{ key: string; count: number }[]>((acc, asset) => {
      let key: string | undefined;
      if (pathDepth === 0) key = asset.client_name ?? 'No Client';
      else if (pathDepth === 1) key = asset.main_category ?? 'other';
      else if (pathDepth === 2) key = getAssetYear(asset);
      else if (pathDepth === 3) key = asset.month_key ?? '';
      else if (pathDepth === 4) key = asset.sub_category ?? 'general';
      if (!key) return acc;
      const existing = acc.find(e => e.key === key);
      if (existing) existing.count++;
      else acc.push({ key, count: 1 });
      return acc;
    }, []).sort((a, b) => {
      if (pathDepth === 2 || pathDepth === 3) return b.key.localeCompare(a.key);
      return a.key.localeCompare(b.key);
    });
  }, [filteredAssets, pathDepth]);

  // ── Breadcrumb ────────────────────────────────────────────────────────────

  const breadcrumbItems = useMemo((): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    if (folderPath.client) {
      items.push({ label: folderPath.client, path: { client: folderPath.client } });
    }
    if (folderPath.mainCategory) {
      items.push({ label: mainCategoryLabel(folderPath.mainCategory), path: { client: folderPath.client, mainCategory: folderPath.mainCategory } });
    }
    if (folderPath.year) {
      items.push({ label: folderPath.year, path: { client: folderPath.client, mainCategory: folderPath.mainCategory, year: folderPath.year } });
    }
    if (folderPath.month) {
      const mk = folderPath.month;
      const label = mk.length >= 7 ? `${monthLabel(mk.slice(5, 7))} ${mk.slice(0, 4)}` : mk;
      items.push({ label, path: { client: folderPath.client, mainCategory: folderPath.mainCategory, year: folderPath.year, month: folderPath.month } });
    }
    if (folderPath.subCategory) {
      items.push({ label: subCategoryLabel(folderPath.mainCategory ?? '', folderPath.subCategory), path: { ...folderPath } });
    }
    return items;
  }, [folderPath]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const navigateTo   = useCallback((path: FolderPath) => { setFolderPath(path); setSearchQuery(''); }, []);

  const navigateInto = useCallback((key: string) => {
    setFolderPath(prev => {
      if (pathDepth === 0) return { client: key };
      if (pathDepth === 1) return { ...prev, mainCategory: key };
      if (pathDepth === 2) return { ...prev, year: key };
      if (pathDepth === 3) return { ...prev, month: key };
      if (pathDepth === 4) return { ...prev, subCategory: key };
      return prev;
    });
    setSearchQuery('');
  }, [pathDepth]);

  const goUp = useCallback(() => {
    setFolderPath(prev => {
      const p = { ...prev };
      if (p.subCategory)   { delete p.subCategory; }
      else if (p.month)    { delete p.month; }
      else if (p.year)     { delete p.year; }
      else if (p.mainCategory) { delete p.mainCategory; }
      else if (p.client)   { delete p.client; }
      return p;
    });
  }, []);

  // ── Folder card labels ────────────────────────────────────────────────────

  const folderCardLabel = (key: string): string => {
    if (pathDepth === 0) return key;
    if (pathDepth === 1) return mainCategoryLabel(key);
    if (pathDepth === 2) return key;
    if (pathDepth === 3) {
      if (key.length >= 7) return `${monthLabel(key.slice(5, 7))} ${key.slice(0, 4)}`;
      return key || 'Unknown';
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
    files.map(file => ({ id: nextFileId(), file, previewUrl: makePreviewUrl(file), uploadName: getFileBaseName(file.name) }));

  const revokeItemUrls = useCallback((items: FileUploadItem[]) => {
    items.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  }, []);

  const openPendingBatch = useCallback((files: File[]) => {
    if (!files.length) return;
    setPendingItems(filesToItems(files));
    setUploadMainCategory(folderPath.mainCategory ?? MAIN_CATEGORIES[0].slug);
    setUploadSubCategory(folderPath.subCategory ?? '');
    setUploadMonth(folderPath.month ?? new Date().toISOString().slice(0, 7));
    if (folderPath.client) {
      const found = clients.find(c => c.name === folderPath.client);
      setUploadClientName(folderPath.client);
      setUploadClientId(found?.id ?? '');
    } else {
      setUploadClientName('');
      setUploadClientId('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderPath, clients]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    openPendingBatch(Array.from(e.target.files ?? []));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleNewClientCreated = useCallback((client: Client) => {
    setClients(prev => {
      if (prev.some(c => c.id === client.id)) return prev;
      return [...prev, client].sort((a, b) => a.name.localeCompare(b.name));
    });
    setUploadClientName(client.name);
    setUploadClientId(client.id);
  }, []);

  const handleUploadNameChange = (id: string, name: string) => {
    setPendingItems(prev => prev.map(i => i.id === id ? { ...i, uploadName: name } : i));
  };

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const onDragOver  = (e: React.DragEvent) => { if (!canUpload) return; e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => { if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false); };
  const onDrop      = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); if (canUpload) openPendingBatch(Array.from(e.dataTransfer.files)); };

  // ── Upload confirm ────────────────────────────────────────────────────────

  const startUploadBatch = (andSchedule: boolean) => {
    const items = [...pendingItems];
    if (!items.length) return;
    setPendingItems([]);
    if (andSchedule) setScheduleAfterUpload(true);
    const uploadedBy = user?.name || user?.email || null;
    startBatch(items.map(i => ({ id: i.id, file: i.file, previewUrl: i.previewUrl, uploadName: i.uploadName })), {
      clientName:   uploadClientName,
      clientId:     uploadClientId,
      contentType:  '',
      mainCategory: uploadMainCategory,
      subCategory:  uploadSubCategory,
      monthKey:     uploadMonth,
      uploadedBy,
    });
    addToast(`${items.length} file${items.length !== 1 ? 's' : ''} queued for upload`, 'success');
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    const res  = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error'); return; }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    addToast(json.message ?? json.warning ?? 'Asset deleted successfully.', 'success');
  };

  const handleRename = async (asset: Asset, newName: string) => {
    const res  = await fetch(`/api/assets/${asset.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
    const json = await res.json() as { success?: boolean; error?: string; name?: string };
    if (!res.ok) { addToast(`Rename failed: ${json.error ?? `HTTP ${res.status}`}`, 'error'); throw new Error(json.error ?? `HTTP ${res.status}`); }
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, name: json.name ?? newName } : a));
    addToast('Asset renamed successfully.', 'success');
  };

  const handleView = (asset: Asset) => {
    if (isImage(asset.name, asset.file_type) || isVideo(asset.name, asset.file_type) || isPdf(asset.name, asset.file_type) || isAudio(asset.name, asset.file_type)) {
      setPreviewAsset(asset);
    } else {
      window.open(asset.view_url ?? asset.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = async (asset: Asset) => {
    try { await navigator.clipboard.writeText(asset.view_url ?? asset.file_url); addToast('Link copied', 'success'); }
    catch { addToast('Failed to copy link', 'error'); }
  };

  const handleApprovalAction = async (asset: Asset, action: 'approved' | 'rejected') => {
    const { error } = await supabase.from('assets').update({ approval_status: action }).eq('id', asset.id);
    if (error) { addToast(`Failed to ${action}: ${error.message}`, 'error'); return; }
    void supabase.from('activities').insert({ type: action, description: `Asset "${asset.name}" was ${action} by ${user?.name ?? 'user'}`, user_id: user?.id, client_id: asset.client_id ?? null });
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, approval_status: action } : a));
    addToast(`Asset ${action}`, 'success');
  };

  const handleScheduleCreated = (schedule: PublishingSchedule) => {
    if (schedule.asset_id) {
      const assetId = schedule.asset_id;
      setScheduleCounts(prev => {
        const existing = prev[assetId] ?? { count: 0, nextDate: null };
        const existingTime = existing.nextDate ? new Date(existing.nextDate).getTime() : Infinity;
        const newTime = new Date(schedule.scheduled_date).getTime();
        const nextDate = existingTime <= newTime ? existing.nextDate : schedule.scheduled_date;
        return { ...prev, [assetId]: { count: existing.count + 1, nextDate } };
      });
    }
    addToast('Publishing scheduled successfully!', 'success');
  };

  const hasActiveFilters = Boolean(searchQuery || filterFileType || filterApproval);
  const clearFilters = useCallback(() => { setSearchQuery(''); setFilterFileType(''); setFilterApproval(''); }, []);

  const availableFileTypes = useMemo(() => {
    const types = new Set<string>();
    for (const a of assets) { const mt = a.file_type ?? a.mime_type ?? ''; const prefix = mt.split('/')[0]; if (prefix) types.add(prefix); }
    return Array.from(types).sort();
  }, [assets]);

  const assetCardProps = (asset: Asset) => ({
    asset,
    canDelete: isAdmin, canApprove: isAdmin || user?.role === 'team', canRename: isAdmin || user?.role === 'team',
    scheduleCount: scheduleCounts[asset.id]?.count, nextScheduleDate: scheduleCounts[asset.id]?.nextDate,
    onView:     () => handleView(asset),
    onDelete:   () => void handleDelete(asset),
    onCopyLink: () => void handleCopyLink(asset),
    onApprove:  () => void handleApprovalAction(asset, 'approved'),
    onReject:   () => void handleApprovalAction(asset, 'rejected'),
    onComments: () => setCommentsAsset(asset),
    onRename:   (n: string) => handleRename(asset, n),
    onSchedule: () => setScheduleAsset(asset),
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-6xl mx-auto space-y-6" ref={dropZoneRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('assets')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Manage uploaded files · Drag &amp; drop or click Upload
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canUpload && (
              <button
                onClick={() => !isUploading && fileRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                style={{ background: 'var(--accent)' }}
              >
                <Upload size={16} />{isUploading ? 'Uploading…' : t('uploadFile')}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleInputChange} />
        </div>

        {/* ── Breadcrumb navigation ────────────────────────────────────────── */}
        {breadcrumbItems.length > 0 && (
          <div className="rounded-xl border px-4 py-2.5 flex items-center gap-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <Breadcrumb items={breadcrumbItems} onNavigate={navigateTo} />
            <button
              type="button"
              onClick={goUp}
              className="ml-auto flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={12} /> Up
            </button>
          </div>
        )}

        {/* ── Filter bar ───────────────────────────────────────────────────── */}
        <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search files…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-9 text-sm pl-8 w-full rounded-lg outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <SelectDropdown
              value={filterFileType}
              onChange={setFilterFileType}
              placeholder="All file types"
              options={[
                { value: '', label: 'All file types' },
                { value: 'image',  label: 'Images' },
                { value: 'video',  label: 'Videos' },
                { value: 'audio',  label: 'Audio' },
                { value: 'application/pdf', label: 'PDFs' },
                ...availableFileTypes
                  .filter(tp => !['image','video','audio'].includes(tp))
                  .map(tp => ({ value: tp, label: tp.charAt(0).toUpperCase() + tp.slice(1) })),
              ]}
            />
            <SelectDropdown
              value={filterApproval}
              onChange={setFilterApproval}
              placeholder="All statuses"
              options={[
                { value: '',          label: 'All statuses' },
                { value: 'pending',   label: 'Pending' },
                { value: 'approved',  label: 'Approved' },
                { value: 'rejected',  label: 'Rejected' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'published', label: 'Published' },
              ]}
            />
            <SelectDropdown
              value={sortBy}
              onChange={v => setSortBy(v as 'newest' | 'oldest' | 'largest')}
              options={[
                { value: 'newest',  label: 'Newest First' },
                { value: 'oldest',  label: 'Oldest First' },
                { value: 'largest', label: 'Largest First' },
              ]}
            />
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium hover:opacity-80" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5">
              {filterFileType && <FilterBadge label={fileTypeFilterLabel(filterFileType)} onRemove={() => setFilterFileType('')} />}
              {filterApproval && <FilterBadge label={filterApproval} onRemove={() => setFilterApproval('')} />}
              {searchQuery && <FilterBadge label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
            </div>
          )}
        </div>

        {/* ── Drag-over overlay ────────────────────────────────────────────── */}
        {isDragOver && (
          <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(99,102,241,0.12)', outline: '3px dashed var(--accent)' }}>
            <div className="text-center space-y-2">
              <Upload size={48} style={{ color: 'var(--accent)', margin: '0 auto' }} />
              <p className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>Drop files to upload</p>
            </div>
          </div>
        )}

        {/* ── Fetch error ──────────────────────────────────────────────────── */}
        {fetchError && !loading && (
          <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', borderColor: '#ef4444', color: '#ef4444' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Failed to load assets</p>
              <p className="opacity-80 break-all">{fetchError}</p>
            </div>
            <button onClick={() => fetchAssets(0)} className="shrink-0 underline opacity-80 hover:opacity-100 font-medium">Retry</button>
          </div>
        )}

        {/* ── Content area ─────────────────────────────────────────────────── */}
        {loading ? (
          /* Skeleton */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: 'var(--surface)', aspectRatio: '1' }} />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          /* Empty state */
          <EmptyState
            icon={FolderOpen}
            title={hasActiveFilters || breadcrumbItems.length > 0 ? 'No matching files' : t('noAssetsYet')}
            description={
              hasActiveFilters || breadcrumbItems.length > 0
                ? 'Try adjusting your search or navigate to a different folder.'
                : t('noAssetsDesc')
            }
            action={
              !hasActiveFilters && canUpload ? (
                <button onClick={() => !isUploading && fileRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                  <Upload size={16} />{t('uploadFile')}
                </button>
              ) : (hasActiveFilters || breadcrumbItems.length > 0) ? (
                <button onClick={() => { clearFilters(); setFolderPath({}); }} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium hover:opacity-80" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <X size={14} /> Clear all
                </button>
              ) : undefined
            }
          />
        ) : pathDepth < 5 && folderEntries.length > 0 ? (
          /* ── Folder grid (navigate deeper) ─────────────────────────────── */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {folderEntries.map(({ key, count }) => (
                <FolderCard
                  key={key}
                  label={folderCardLabel(key)}
                  count={count}
                  color={folderCardColor(key)}
                  onClick={() => navigateInto(key)}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button onClick={loadMore} className="btn h-9 px-6 text-sm">Load More</button>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAssets.map(asset => (
                <AssetCard key={asset.id} {...assetCardProps(asset)} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button onClick={loadMore} className="btn h-9 px-6 text-sm">Load More</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Upload modal ─────────────────────────────────────────────────────── */}
      {pendingItems.length > 0 && (
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
          onClientChange={(name, id) => { setUploadClientName(name); setUploadClientId(id); }}
          onNewClientCreated={handleNewClientCreated}
          onConfirm={() => startUploadBatch(false)}
          onConfirmAndSchedule={() => startUploadBatch(true)}
          onCancel={() => { revokeItemUrls(pendingItems); setPendingItems([]); }}
          onUploadNameChange={handleUploadNameChange}
          onRemoveFile={id => setPendingItems(prev => {
            const removed = prev.find(i => i.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter(i => i.id !== id);
          })}
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
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {/* ── Comments modal ────────────────────────────────────────────────── */}
      {commentsAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setCommentsAsset(null)}>
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-xl" style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>{commentsAsset.name}</h3>
              <button onClick={() => setCommentsAsset(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"><X size={16} /></button>
            </div>
            <CommentsPanel assetId={commentsAsset.id} />
          </div>
        </div>
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </>
  );
}
