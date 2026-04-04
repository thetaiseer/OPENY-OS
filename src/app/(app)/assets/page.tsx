'use client';

import { useEffect, useState, useRef, useCallback, useDeferredValue } from 'react';
import {
  Upload, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  Trash2, Eye, Download, Link, X, CheckCircle, ExternalLink, AlertCircle,
  Loader2,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import { contentTypeLabel } from '@/lib/asset-utils';
import type { Asset, Client } from '@/lib/types';

// ── Upload config ─────────────────────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES = [
  'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
  'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER',
] as const;

// ── Per-file upload state ─────────────────────────────────────────────────────

type FileStatus = 'queued' | 'preparing' | 'uploading' | 'saving' | 'completed' | 'failed';

interface FileUploadItem {
  id: string;
  file: File;
  previewUrl: string | null;
  status: FileStatus;
  progress: number;
  error: string | null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; message: string; type: 'success' | 'error' }

function Toast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{
            background: toast.type === 'success' ? '#16a34a' : '#dc2626',
            minWidth: 240,
            animation: 'fadeSlideUp 0.2s ease',
          }}
        >
          {toast.type === 'success'
            ? <CheckCircle size={16} className="shrink-0" />
            : <X size={16} className="shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert a Google Drive view URL to a direct-embed URL so browsers can render
 * the image inline.  Non-Drive URLs are returned unchanged.
 *
 * Input:  https://drive.google.com/file/d/FILE_ID/view
 * Output: https://drive.google.com/uc?export=view&id=FILE_ID
 */
function getPreviewUrl(url?: string | null): string {
  if (!url) return '';
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }
  return url;
}

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

function isImage(name: string, type?: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || (type?.startsWith('image/') ?? false);
}

function isPdf(name: string, type?: string): boolean {
  return /\.pdf$/i.test(name) || type === 'application/pdf';
}

function isVideo(name: string, type?: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(name) || (type?.startsWith('video/') ?? false);
}

function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf(name, type)) return <FileText size={size} style={{ color: '#ef4444' }} />;
  if (isVideo(name, type)) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (type?.startsWith('audio/')) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

function fileTypeLabel(name: string, type?: string): string {
  if (type) { const sub = type.split('/')[1]?.toUpperCase(); if (sub) return sub; }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

// ── Batch Metadata Form ───────────────────────────────────────────────────────

interface BatchUploadFormProps {
  files: FileUploadItem[];
  contentType: string;
  month: string;
  clientName: string;
  clients: Client[];
  onContentTypeChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onClientChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onRemoveFile: (id: string) => void;
}

function BatchUploadForm({
  files, contentType, month, clientName, clients,
  onContentTypeChange, onMonthChange, onClientChange,
  onConfirm, onCancel, onRemoveFile,
}: BatchUploadFormProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
          </h3>
          <button onClick={onCancel} className="opacity-60 hover:opacity-100 transition-opacity"><X size={16} /></button>
        </div>

        {/* File list */}
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {files.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
              <FileTypeIcon name={item.file.name} type={item.file.type} size={16} />
              <span className="flex-1 truncate" style={{ color: 'var(--text)' }}>{item.file.name}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{formatSize(item.file.size)}</span>
              <button onClick={() => onRemoveFile(item.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X size={14} /></button>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Client *</label>
          <select className="input w-full" value={clientName} onChange={e => onClientChange(e.target.value)}>
            <option value="">— Select a client —</option>
            {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Content Type *</label>
          <select className="input w-full" value={contentType} onChange={e => onContentTypeChange(e.target.value)}>
            {ALLOWED_CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{contentTypeLabel(ct)}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Month (YYYY-MM) *</label>
          <input type="month" className="input w-full" value={month} onChange={e => onMonthChange(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn flex-1 h-9 text-sm">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!clientName || files.length === 0}
            className="btn-primary flex-1 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Queue UI ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<FileStatus, string> = {
  queued: 'Queued', preparing: 'Preparing…', uploading: 'Uploading to Drive',
  saving: 'Saving metadata', completed: 'Completed', failed: 'Failed',
};

function FileQueueItem({ item }: { item: FileUploadItem }) {
  const isComplete = item.status === 'completed';
  const isFailed   = item.status === 'failed';
  return (
    <div className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
        {item.previewUrl
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
          : <FileTypeIcon name={item.file.name} type={item.file.type} size={20} />}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{item.file.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatSize(item.file.size)}</span>
          <span className="text-xs" style={{ color: isFailed ? '#ef4444' : isComplete ? '#16a34a' : 'var(--accent)' }}>
            {STATUS_LABEL[item.status]}
          </span>
          {!isComplete && !isFailed && (
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{item.progress}%</span>
          )}
        </div>
        {!isComplete && !isFailed && (
          <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${item.progress}%`, background: 'var(--accent)' }} />
          </div>
        )}
        {isFailed && item.error && <p className="text-xs truncate" style={{ color: '#ef4444' }}>{item.error}</p>}
      </div>
      <div className="shrink-0">
        {isComplete && <CheckCircle size={18} style={{ color: '#16a34a' }} />}
        {isFailed && <AlertCircle size={18} style={{ color: '#ef4444' }} />}
        {!isComplete && !isFailed && <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />}
      </div>
    </div>
  );
}

function UploadQueue({ items }: { items: FileUploadItem[] }) {
  if (items.length === 0) return null;
  const completed = items.filter(i => i.status === 'completed').length;
  const failed    = items.filter(i => i.status === 'failed').length;
  const overall   = Math.round((completed / items.length) * 100);
  return (
    <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold" style={{ color: 'var(--text)' }}>
          Uploading {completed}/{items.length} files
          {failed > 0 && <span style={{ color: '#ef4444' }}> · {failed} failed</span>}
        </span>
        <span className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{overall}%</span>
      </div>
      <div className="w-full h-2 rounded-full" style={{ background: 'var(--surface-2)' }}>
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${overall}%`, background: 'var(--accent)' }} />
      </div>
      <div className="space-y-2">{items.map(item => <FileQueueItem key={item.id} item={item} />)}</div>
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const downloadUrl = asset.download_url ?? asset.file_url;
  const isImg  = isImage(asset.name, asset.file_type);
  const isVid  = isVideo(asset.name, asset.file_type);
  const isPdf_ = isPdf(asset.name, asset.file_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Close preview">
          <X size={18} />
        </button>

        {isImg && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPreviewUrl(asset.file_url)}
              alt={asset.name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
              onError={e => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div className="flex flex-col items-center gap-4 py-12" style={{ display: 'none' }}>
              <FileTypeIcon name={asset.name} type={asset.file_type} size={64} />
              <p className="text-white/80 text-sm">{asset.name}</p>
            </div>
          </>
        )}
        {isVid && (
          <video src={asset.file_url} controls className="max-w-full max-h-[80vh] rounded-xl shadow-2xl" style={{ background: '#000' }} />
        )}
        {isPdf_ && (
          <iframe src={asset.view_url ?? asset.file_url} title={asset.name} className="w-full rounded-xl shadow-2xl" style={{ height: '75vh', background: '#fff' }} />
        )}
        {!isImg && !isVid && !isPdf_ && (
          <div className="flex flex-col items-center gap-4 py-12">
            <FileTypeIcon name={asset.name} type={asset.file_type} size={64} />
            <p className="text-white/80 text-sm">{asset.name}</p>
          </div>
        )}

        <p className="mt-3 text-white/70 text-sm truncate max-w-full px-4">{asset.name}</p>
        <div className="mt-3 flex gap-3 flex-wrap justify-center">
          <a href={downloadUrl} download={asset.name} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors" onClick={e => e.stopPropagation()}>
            <Download size={14} /> Download
          </a>
          {asset.view_url && (
            <a href={asset.view_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors" onClick={e => e.stopPropagation()}>
              <ExternalLink size={14} /> Open in Drive
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Asset Card ────────────────────────────────────────────────────────────────

interface AssetCardProps {
  asset: Asset;
  onView: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onOpenInDrive: () => void;
}

function AssetCard({ asset, onView, onDelete, onCopyLink, onOpenInDrive }: AssetCardProps) {
  const img      = isImage(asset.name, asset.file_type);
  const hasDrive = asset.storage_provider === 'google_drive' && !!asset.view_url;
  const downloadUrl = asset.download_url ?? asset.file_url;
  return (
    <div className="group rounded-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="relative overflow-hidden cursor-pointer" style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }} onClick={onView}>
        {img ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getPreviewUrl(asset.file_url)}
              alt={asset.name}
              className="w-full h-full object-cover"
              onError={e => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
            <div className="w-full h-full flex items-center justify-center" style={{ display: 'none' }}>
              <FileTypeIcon name={asset.name} type={asset.file_type} size={36} />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileTypeIcon name={asset.name} type={asset.file_type} size={36} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye size={18} className="text-white" />
          </div>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }} title={asset.name}>{asset.name}</p>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            {fileTypeLabel(asset.name, asset.file_type)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatSize(asset.file_size)}</span>
        </div>
        {asset.content_type && (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{contentTypeLabel(asset.content_type)}</span>
        )}
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatDate(asset.created_at)}</span>
      </div>

      <div className="px-3 pb-3 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <button onClick={onView} title="View" className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Eye size={13} /><span>View</span>
        </button>
        <a href={downloadUrl} download={asset.name} title="Download" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Download size={14} />
        </a>
        <button onClick={onCopyLink} title="Copy link" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Link size={14} />
        </button>
        {hasDrive && (
          <button onClick={onOpenInDrive} title="Open in Google Drive" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <ExternalLink size={14} />
          </button>
        )}
        <button onClick={onDelete} title="Delete" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: '#ef4444' }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOAST_DURATION_MS   = 4500;
const UPLOAD_CONCURRENCY  = 3;

function nextFileId() { return crypto.randomUUID(); }
function makePreviewUrl(file: File): string | null {
  return isImage(file.name, file.type) ? URL.createObjectURL(file) : null;
}

// ── Resumable upload helper ───────────────────────────────────────────────────

/**
 * Upload a File directly to Google Drive using the pre-authenticated resumable
 * upload URL returned by /api/assets/upload-session.
 *
 * Sends the entire file in a single PUT request to the upload URL.
 * Google Drive responds with 200 or 201 and the file metadata JSON (including
 * the Drive file ID) on success.
 */
async function uploadFileResumable(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<string> {
  if (!uploadUrl) {
    throw new Error('upload_url is missing — cannot proceed with upload');
  }

  const mimeType  = file.type || 'application/octet-stream';
  const totalSize = file.size;

  console.log('[upload] upload_url present:', !!uploadUrl);
  console.log('[upload] file size:', totalSize, '| mimeType:', mimeType);

  onProgress(10);

  let res: Response;
  try {
    if (signal.aborted) throw new DOMException('Upload aborted by user', 'AbortError');
    res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: file,
      signal,
    });
  } catch (err: unknown) {
    if (signal.aborted) throw err;
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (res.status === 200 || res.status === 201) {
    const data = await res.json() as { id?: string };
    onProgress(100);
    if (!data.id) throw new Error('Drive did not return a file ID after upload');
    return data.id;
  }

  // Log full response on unexpected status
  const body = await res.text().catch(() => '(could not read body)');
  console.error('[upload] Upload failed — status:', res.status, '| statusText:', res.statusText, '| body:', body);
  throw new Error(`Upload failed (${res.status}): ${body.slice(0, 300)}`);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { t } = useLang();
  const [assets, setAssets]             = useState<Asset[]>([]);
  const [loading, setLoading]           = useState(true);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [toasts, setToasts]             = useState<ToastMsg[]>([]);
  const fileRef                         = useRef<HTMLInputElement>(null);
  const dropZoneRef                     = useRef<HTMLDivElement>(null);
  const toastIdRef                      = useRef(0);

  // Pending batch (waiting for metadata form confirmation)
  const [pendingItems, setPendingItems]               = useState<FileUploadItem[]>([]);
  const [uploadContentType, setUploadContentType]     = useState<string>(ALLOWED_CONTENT_TYPES[0]);
  const [uploadMonth, setUploadMonth]                 = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [uploadClientName, setUploadClientName]       = useState<string>('');
  const [uploadClientId, setUploadClientId]           = useState<string>('');

  // Active upload queue
  const [uploadQueue, setUploadQueue] = useState<FileUploadItem[]>([]);
  const isUploading = uploadQueue.some(i => i.status !== 'completed' && i.status !== 'failed');

  const [isDragOver, setIsDragOver] = useState(false);
  const [clients, setClients]       = useState<Client[]>([]);
  const deferredAssets              = useDeferredValue(assets);

  // ── Toast ───────────────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Data ────────────────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) { if (process.env.NODE_ENV === 'development') console.error('[assets]', error); setAssets([]); }
      else setAssets((data ?? []) as Asset[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data, error }) => {
      if (error) { if (process.env.NODE_ENV === 'development') console.error('[clients]', error); }
      else if (data) setClients(data as Client[]);
    });
  }, []);

  // ── File helpers ────────────────────────────────────────────────────────────

  const filesToItems = (files: File[]): FileUploadItem[] =>
    files.map(file => ({ id: nextFileId(), file, previewUrl: makePreviewUrl(file), status: 'queued' as FileStatus, progress: 0, error: null }));

  // Revoke all object URLs for a list of items to prevent memory leaks
  const revokeItemUrls = useCallback((items: FileUploadItem[]) => {
    items.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  }, []);

  const openPendingBatch = useCallback((files: File[]) => {
    if (!files.length || isUploading) return;
    setPendingItems(filesToItems(files));
    setUploadContentType(ALLOWED_CONTENT_TYPES[0]);
    setUploadMonth(new Date().toISOString().slice(0, 7));
    setUploadClientName('');
    setUploadClientId('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUploading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    openPendingBatch(Array.from(e.target.files ?? []));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClientChange = (name: string) => {
    setUploadClientName(name);
    setUploadClientId(clients.find(c => c.name === name)?.id ?? '');
  };

  // ── Drag and drop ───────────────────────────────────────────────────────────

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const onDragLeave = (e: React.DragEvent) => { if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragOver(false); };
  const onDrop      = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); openPendingBatch(Array.from(e.dataTransfer.files)); };

  // ── Upload single file ──────────────────────────────────────────────────────

  async function uploadOneFile(
    item: FileUploadItem,
    clientName: string, clientId: string, contentType: string, monthKey: string,
    patchItem: (id: string, p: Partial<FileUploadItem>) => void,
  ): Promise<Asset> {
    const ctrl = new AbortController();

    try {
      // ── Step 1: Create resumable upload session (server creates Drive folders) ──
      patchItem(item.id, { status: 'preparing', progress: 5 });

      const sessionRes = await fetch('/api/assets/upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName:    item.file.name,
          fileType:    item.file.type || 'application/octet-stream',
          fileSize:    item.file.size,
          clientName,
          contentType,
          monthKey,
          ...(clientId ? { clientId } : {}),
        }),
        signal: ctrl.signal,
      });
      const sessionJson = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionJson.error ?? `Session creation failed: HTTP ${sessionRes.status}`);
      }
      const { uploadUrl, drive_folder_id, client_folder_name } = sessionJson as {
        uploadUrl: string;
        drive_folder_id: string;
        client_folder_name: string;
      };

      // ── Step 2: Upload file bytes directly to Google Drive ──────────────────
      patchItem(item.id, { status: 'uploading', progress: 10 });

      const driveFileId = await uploadFileResumable(
        uploadUrl,
        item.file,
        (pct) => patchItem(item.id, { progress: pct }),
        ctrl.signal,
      );

      // ── Step 3: Finalize — set permissions + save metadata to Supabase ──────
      patchItem(item.id, { status: 'saving', progress: 96 });

      const completeRes = await fetch('/api/assets/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId,
          driveFolderId:    drive_folder_id,
          clientFolderName: client_folder_name,
          fileName:         item.file.name,
          fileType:         item.file.type || null,
          fileSize:         item.file.size || null,
          contentType,
          monthKey,
          clientName,
          clientId:         clientId || null,
        }),
        signal: ctrl.signal,
      });
      const completeJson = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeJson.error ?? `Finalize failed: HTTP ${completeRes.status}`);
      }

      patchItem(item.id, { status: 'completed', progress: 100 });
      return completeJson.asset as Asset;
    } catch (err: unknown) {
      ctrl.abort();
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? 'Upload cancelled' : err.message)
        : String(err);
      patchItem(item.id, { status: 'failed', progress: 0, error: msg });
      throw err;
    }
  }

  // ── Confirm upload ──────────────────────────────────────────────────────────

  const handleUploadConfirm = async () => {
    const items = [...pendingItems];
    if (!items.length) return;
    setPendingItems([]);
    setUploadQueue(items);

    const patch = (id: string, p: Partial<FileUploadItem>) =>
      setUploadQueue(prev => prev.map(i => i.id === id ? { ...i, ...p } : i));

    const cName = uploadClientName, cId = uploadClientId,
          ct    = uploadContentType, mk  = uploadMonth;
    let ok = 0, fail = 0;
    const newAssets: Asset[] = [];

    const CONCURRENCY = UPLOAD_CONCURRENCY;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      await Promise.all(items.slice(i, i + CONCURRENCY).map(async item => {
        try { newAssets.push(await uploadOneFile(item, cName, cId, ct, mk, patch)); ok++; }
        catch { fail++; }
      }));
    }

    if (newAssets.length) setAssets(prev => [...newAssets.reverse(), ...prev]);

    if (!fail) addToast(`${ok} file${ok !== 1 ? 's' : ''} uploaded to Google Drive`, 'success');
    else addToast(`${ok} uploaded, ${fail} failed`, fail === items.length ? 'error' : 'success');

    setTimeout(() => {
      setUploadQueue(prev => { revokeItemUrls(prev); return []; });
    }, 4000);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    const res  = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error'); return; }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    addToast(json.warning ?? 'File deleted', 'success');
  };

  // ── View ────────────────────────────────────────────────────────────────────

  const handleView = (asset: Asset) => {
    if (isImage(asset.name, asset.file_type) || isVideo(asset.name, asset.file_type) || isPdf(asset.name, asset.file_type)) {
      setPreviewAsset(asset);
    } else {
      window.open(asset.view_url ?? asset.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCopyLink = async (asset: Asset) => {
    try { await navigator.clipboard.writeText(asset.view_url ?? asset.file_url); addToast('Link copied', 'success'); }
    catch { addToast('Failed to copy link', 'error'); }
  };

  const handleOpenInDrive = (asset: Asset) => {
    if (asset.view_url) window.open(asset.view_url, '_blank', 'noopener,noreferrer');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-6xl mx-auto space-y-6" ref={dropZoneRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('assets')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Manage uploaded files · Drag &amp; drop or click Upload
            </p>
          </div>
          <button
            onClick={() => !isUploading && fileRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <Upload size={16} />{isUploading ? 'Uploading…' : t('uploadFile')}
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleInputChange} />
        </div>

        {/* Drag-over overlay */}
        {isDragOver && (
          <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(99,102,241,0.12)', outline: '3px dashed var(--accent)' }}>
            <div className="text-center space-y-2">
              <Upload size={48} style={{ color: 'var(--accent)', margin: '0 auto' }} />
              <p className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>Drop files to upload</p>
            </div>
          </div>
        )}

        {/* Upload queue */}
        {uploadQueue.length > 0 && <UploadQueue items={uploadQueue} />}

        {/* Grid / empty / skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: 'var(--surface)', aspectRatio: '1' }} />
            ))}
          </div>
        ) : deferredAssets.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={t('noAssetsYet')}
            description={t('noAssetsDesc')}
            action={
              <button onClick={() => !isUploading && fileRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                <Upload size={16} />{t('uploadFile')}
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {deferredAssets.map(asset => (
              <AssetCard
                key={asset.id} asset={asset}
                onView={() => handleView(asset)} onDelete={() => handleDelete(asset)}
                onCopyLink={() => handleCopyLink(asset)} onOpenInDrive={() => handleOpenInDrive(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Batch metadata modal */}
      {pendingItems.length > 0 && (
        <BatchUploadForm
          files={pendingItems} contentType={uploadContentType} month={uploadMonth} clientName={uploadClientName} clients={clients}
          onContentTypeChange={setUploadContentType} onMonthChange={setUploadMonth} onClientChange={handleClientChange}
          onConfirm={handleUploadConfirm}
          onCancel={() => { revokeItemUrls(pendingItems); setPendingItems([]); }}
          onRemoveFile={id => setPendingItems(prev => {
            const removed = prev.find(i => i.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter(i => i.id !== id);
          })}
        />
      )}

      {/* Preview modal */}
      {previewAsset && <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />}

      <Toast toasts={toasts} remove={removeToast} />
    </>
  );
}
