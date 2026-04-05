'use client';

import { useEffect, useState, useRef, useCallback, useDeferredValue, useMemo } from 'react';
import {
  Upload, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  Trash2, Eye, Download, Link, X, CheckCircle, ExternalLink, AlertCircle,
  Search, ThumbsUp, ThumbsDown, MessageSquare, RefreshCw, Pencil, Check, Loader2,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import EmptyState from '@/components/ui/EmptyState';
import CommentsPanel from '@/components/ui/CommentsPanel';
import { contentTypeLabel } from '@/lib/asset-utils';
import { useUpload, type InitialUploadItem } from '@/lib/upload-context';
import type { Asset, Client } from '@/lib/types';

// ── Upload config ─────────────────────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES = [
  'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
  'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER',
] as const;

const ASSETS_START_YEAR = 2020;

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const;

// ── Filter badge ──────────────────────────────────────────────────────────────

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
      style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:opacity-70 transition-opacity leading-none"
        title="Remove filter"
      >
        <X size={11} />
      </button>
    </span>
  );
}

// ── Per-file pending-batch state (local — before upload starts) ───────────────

interface FileUploadItem {
  id: string;
  file: File;
  previewUrl: string | null;
  uploadName: string; // user-editable name (without extension)
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; message: string; type: 'success' | 'error' }

function Toast({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    // bottom-5 right-5 conflicts with GlobalUploadQueue — offset to the left of it
    <div className="fixed bottom-6 right-[340px] z-50 flex flex-col gap-2 pointer-events-none">
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

function isAudio(name: string, type?: string): boolean {
  return /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(name) || (type?.startsWith('audio/') ?? false);
}

/**
 * Build the Google Drive embedded player URL for in-app preview of videos,
 * PDFs, and audio files.  Falls back to null if no Drive file ID is available.
 *
 * Input (any):  drive_file_id, /file/d/FILE_ID/view, uc?id=FILE_ID, etc.
 * Output:       https://drive.google.com/file/d/FILE_ID/preview
 */
function getDriveEmbedUrl(asset: Asset): string | null {
  // Prefer the explicit Drive file ID stored on the asset record
  if (asset.drive_file_id) {
    return `https://drive.google.com/file/d/${asset.drive_file_id}/preview`;
  }
  // Fall back to extracting from view URLs
  const candidate = asset.file_url || asset.view_url || asset.web_view_link;
  const m = candidate?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) {
    return `https://drive.google.com/file/d/${m[1]}/preview`;
  }
  return null;
}

function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf(name, type)) return <FileText size={size} style={{ color: '#ef4444' }} />;
  if (isVideo(name, type)) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (isAudio(name, type)) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

function fileTypeLabel(name: string, type?: string): string {
  if (type) { const sub = type.split('/')[1]?.toUpperCase(); if (sub) return sub; }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

// ── Filename validation helpers ───────────────────────────────────────────────

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00]/;

function validateUploadName(name: string): string | null {
  const t = name.trim();
  if (!t) return 'Name cannot be empty';
  if (INVALID_FILENAME_CHARS.test(t)) return 'Name contains invalid characters (< > : " / \\ | ? *)';
  if (t.startsWith('.')) return 'Name cannot start with a period';
  if (t.length > 200) return 'Name is too long (max 200 characters)';
  return null;
}

function getFileExtension(name: string): string {
  const parts = name.split('.');
  return parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : '';
}

function getFileBaseName(name: string): string {
  const ext = getFileExtension(name);
  return ext ? name.slice(0, name.length - ext.length) : name;
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
  onUploadNameChange: (id: string, name: string) => void;
}

function BatchUploadForm({
  files, contentType, month, clientName, clients,
  onContentTypeChange, onMonthChange, onClientChange,
  onConfirm, onCancel, onRemoveFile, onUploadNameChange,
}: BatchUploadFormProps) {
  const hasErrors = files.some(f => validateUploadName(f.uploadName) !== null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border p-6 space-y-5 shadow-xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
          </h3>
          <button onClick={onCancel} className="opacity-60 hover:opacity-100 transition-opacity"><X size={16} /></button>
        </div>

        {/* Per-file name editor */}
        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {files.map(item => {
            const ext = getFileExtension(item.file.name);
            const nameError = validateUploadName(item.uploadName);
            return (
              <div key={item.id} className="rounded-xl border p-3 space-y-2" style={{ background: 'var(--surface-2)', borderColor: nameError ? '#ef4444' : 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <FileTypeIcon name={item.file.name} type={item.file.type} size={16} />
                  <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{item.file.name}</span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>{formatSize(item.file.size)}</span>
                  <button onClick={() => onRemoveFile(item.id)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"><X size={14} /></button>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Upload name{ext && <span className="ml-1 opacity-60">(extension <code>{ext}</code> will be added)</span>}
                  </label>
                  <input
                    type="text"
                    className="input w-full h-8 text-sm"
                    value={item.uploadName}
                    onChange={e => onUploadNameChange(item.id, e.target.value)}
                    placeholder={getFileBaseName(item.file.name)}
                    style={nameError ? { borderColor: '#ef4444' } : {}}
                  />
                  {nameError && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{nameError}</p>}
                </div>
              </div>
            );
          })}
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
            disabled={!clientName || files.length === 0 || hasErrors}
            className="btn-primary flex-1 h-9 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

/**
 * Wrapper for Drive embed iframes that shows a loading spinner and a
 * fallback "Can't preview" card if the embed doesn't fully load.
 *
 * Google Drive iframes sometimes show their own "Load failed" page which we
 * cannot detect from JS (cross-origin).  We track the onLoad event; if it
 * fires the iframe is shown normally.  The fallback action buttons are always
 * rendered beneath the embed so the user can open in Drive or download.
 */
function DriveEmbed({
  src,
  title,
  allow,
  allowFullScreen,
  height,
  background,
}: {
  src: string;
  title: string;
  allow?: string;
  allowFullScreen?: boolean;
  height: string;
  background?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-2xl" style={{ height, background: background ?? '#000' }}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: background ?? '#000' }}>
          <Loader2 size={32} className="animate-spin text-white/60" />
          <p className="text-white/50 text-xs">Loading preview…</p>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        allow={allow}
        allowFullScreen={allowFullScreen}
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%', border: 0, opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
      />
    </div>
  );
}

function PreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const effectiveMime = asset.file_type ?? asset.mime_type ?? undefined;
  const downloadUrl  = asset.download_url ?? asset.file_url;
  const isImg   = isImage(asset.name, effectiveMime);
  const isVid   = isVideo(asset.name, effectiveMime);
  const isPdf_  = isPdf(asset.name, effectiveMime);
  const isAud   = isAudio(asset.name, effectiveMime);
  const isDrive = asset.storage_provider === 'google_drive';

  // Image: use uc?export=view for direct inline rendering (best quality)
  const imgSrc = asset.preview_url || getPreviewUrl(asset.file_url);

  // Video / PDF / audio from Drive: use the /preview embed URL (Drive's built-in player)
  // For non-Drive video files, try to play the file_url directly.
  const driveEmbedUrl = isDrive ? getDriveEmbedUrl(asset) : null;

  // Link to open file in Drive
  const driveOpenUrl = asset.web_view_link || asset.view_url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-10 right-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Close preview">
          <X size={18} />
        </button>

        {/* ── Image ──────────────────────────────────────────────────────── */}
        {isImg && (
          <>
            {imgSrc ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imgSrc}
                alt={asset.name}
                className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = 'flex';
                }}
              />
            ) : null}
            <div className="flex flex-col items-center gap-4 py-12" style={{ display: imgSrc ? 'none' : 'flex' }}>
              <FileTypeIcon name={asset.name} type={effectiveMime} size={64} />
              <p className="text-white/80 text-sm">{asset.name}</p>
            </div>
          </>
        )}

        {/* ── Video — Drive embed iframe or direct <video> ───────────────── */}
        {isVid && (
          driveEmbedUrl ? (
            <DriveEmbed
              src={driveEmbedUrl}
              title={asset.name}
              allow="autoplay"
              allowFullScreen
              height="75vh"
              background="#000"
            />
          ) : (
            <video
              src={asset.file_url}
              controls
              className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
              style={{ background: '#000' }}
            />
          )
        )}

        {/* ── PDF — Drive embed iframe ──────────────────────────────────── */}
        {isPdf_ && (
          <DriveEmbed
            src={(driveEmbedUrl || asset.view_url || asset.file_url) ?? ''}
            title={asset.name}
            height="75vh"
            background="#fff"
          />
        )}

        {/* ── Audio — Drive embed iframe (has built-in audio player) ───── */}
        {isAud && (
          driveEmbedUrl ? (
            <DriveEmbed
              src={driveEmbedUrl}
              title={asset.name}
              allow="autoplay"
              height="200px"
              background="#1a1a2e"
            />
          ) : (
            <audio
              src={asset.file_url}
              controls
              className="w-full rounded-xl"
              style={{ background: '#1a1a2e', padding: '1rem' }}
            />
          )
        )}

        {/* ── Unsupported file type fallback ────────────────────────────── */}
        {!isImg && !isVid && !isPdf_ && !isAud && (
          <div className="flex flex-col items-center gap-4 py-12">
            <FileTypeIcon name={asset.name} type={effectiveMime} size={64} />
            <p className="text-white/80 text-sm">{asset.name}</p>
            <p className="text-white/50 text-xs text-center max-w-xs">
              This file type cannot be previewed inline. Use the buttons below to open or download it.
            </p>
          </div>
        )}

        <p className="mt-3 text-white/70 text-sm truncate max-w-full px-4">{asset.name}</p>
        <div className="mt-3 flex gap-3 flex-wrap justify-center">
          <a href={downloadUrl} download={asset.name} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors" onClick={e => e.stopPropagation()}>
            <Download size={14} /> Download
          </a>
          {driveOpenUrl && (
            <a href={driveOpenUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors" onClick={e => e.stopPropagation()}>
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
  canDelete: boolean;
  canApprove: boolean;
  canRename: boolean;
  onView: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onOpenInDrive: () => void;
  onApprove: () => void;
  onReject: () => void;
  onComments: () => void;
  onRename: (newName: string) => Promise<void>;
}

function AssetCard({ asset, canDelete, canApprove, canRename, onView, onDelete, onCopyLink, onOpenInDrive, onApprove, onReject, onComments, onRename }: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName]   = useState(asset.name);
  const [renaming, setRenaming]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep editName in sync when the asset name is updated externally (e.g. after sync).
  useEffect(() => {
    setEditName(asset.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.name]);

  const startEdit = () => {
    setEditName(asset.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditName(asset.name);
  };

  const commitEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === asset.name) { cancelEdit(); return; }
    setRenaming(true);
    try {
      await onRename(trimmed);
      setIsEditing(false);
    } finally {
      setRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void commitEdit(); }
    if (e.key === 'Escape') { cancelEdit(); }
  };

  const effectiveMime = asset.file_type ?? asset.mime_type ?? undefined;
  const img      = isImage(asset.name, effectiveMime);
  const hasDrive = asset.storage_provider === 'google_drive' && !!(asset.web_view_link || asset.view_url);
  const downloadUrl = asset.download_url ?? asset.file_url;
  // Use thumbnail_url for card previews (faster/lighter); fall back to preview_url then Drive uc embed.
  // If all are empty we skip the <img> entirely and go straight to the icon fallback.
  const cardThumbSrc = asset.thumbnail_url || asset.preview_url || getPreviewUrl(asset.file_url);
  return (
    <div className="group rounded-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="relative overflow-hidden cursor-pointer" style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }} onClick={onView}>
        {img && cardThumbSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardThumbSrc}
              alt={asset.name}
              className="w-full h-full object-cover"
              onError={e => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
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

      <div className="p-3 flex-1 flex flex-col gap-0.5 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={renaming}
              className="flex-1 text-sm font-medium rounded px-1 py-0.5 min-w-0 outline-none border"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--accent)' }}
            />
            <button onClick={() => void commitEdit()} disabled={renaming} title="Save" className="flex items-center justify-center h-6 w-6 rounded transition-opacity hover:opacity-70" style={{ color: '#16a34a' }}>
              <Check size={13} />
            </button>
            <button onClick={cancelEdit} disabled={renaming} title="Cancel" className="flex items-center justify-center h-6 w-6 rounded transition-opacity hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group/name min-w-0">
            <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text)' }} title={asset.name}>{asset.name}</p>
            {canRename && (
              <button
                onClick={e => { e.stopPropagation(); startEdit(); }}
                title="Rename"
                className="opacity-0 group-hover/name:opacity-100 flex items-center justify-center h-5 w-5 rounded transition-opacity hover:opacity-70 shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              >
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
        {asset.content_type && (
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{contentTypeLabel(asset.content_type)}</span>
        )}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <ApprovalBadge status={asset.approval_status} />
          {asset.publish_date && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              📅 {new Date(asset.publish_date).toLocaleDateString()}
            </span>
          )}
        </div>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{formatDate(asset.created_at)}</span>
      </div>

      <div className="px-3 pb-3 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
        <button onClick={onView} title="View" className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Eye size={13} /><span>View</span>
        </button>
        <a href={downloadUrl} download={asset.name} title="Download" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Download size={14} />
        </a>
        <button onClick={onCopyLink} title="Copy link" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <Link size={14} />
        </button>
        <button onClick={onComments} title="Comments" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
          <MessageSquare size={14} />
        </button>
        {hasDrive && (
          <button onClick={onOpenInDrive} title="Open in Google Drive" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <ExternalLink size={14} />
          </button>
        )}
        {canApprove && asset.approval_status !== 'approved' && (
          <button onClick={onApprove} title="Approve" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>
            <ThumbsUp size={14} />
          </button>
        )}
        {canApprove && asset.approval_status !== 'rejected' && (
          <button onClick={onReject} title="Reject" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'rgba(220,38,38,0.12)', color: '#dc2626' }}>
            <ThumbsDown size={14} />
          </button>
        )}
        {canDelete && (
          <button onClick={onDelete} title="Delete" className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70" style={{ background: 'var(--surface-2)', color: '#ef4444' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
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
  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded font-medium capitalize"
      style={{ background: c.bg, color: c.text }}
    >
      {s}
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOAST_DURATION_MS = 4500;

function nextFileId() { return crypto.randomUUID(); }
function makePreviewUrl(file: File): string | null {
  return isImage(file.name, file.type) ? URL.createObjectURL(file) : null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface SyncLog {
  id: string;
  synced_at: string;
  files_added: number;
  files_updated: number;
  files_removed: number;
  errors_count: number;
  error_details: string[];
  duration_ms: number | null;
  triggered_by: 'manual' | 'cron';
}

export default function AssetsPage() {
  const { t } = useLang();
  const { user } = useAuth();
  const isAdmin     = user?.role === 'admin';
  const canUpload   = isAdmin || user?.role === 'team';

  // ── Global upload context ────────────────────────────────────────────────
  const { startBatch, isUploading, latestAsset } = useUpload();

  const [assets, setAssets]             = useState<Asset[]>([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [commentsAsset, setCommentsAsset] = useState<Asset | null>(null);
  const [toasts, setToasts]             = useState<ToastMsg[]>([]);
  const fileRef                         = useRef<HTMLInputElement>(null);
  const dropZoneRef                     = useRef<HTMLDivElement>(null);
  const toastIdRef                      = useRef(0);

  // Pagination
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery]             = useState('');
  const [filterClient, setFilterClient]           = useState('');
  const [filterContentType, setFilterContentType] = useState('');
  const [filterYear, setFilterYear]               = useState('');
  const [filterMonth, setFilterMonth]             = useState('');
  const [filterApproval, setFilterApproval]       = useState('');
  const [sortBy, setSortBy]                       = useState<'newest' | 'oldest' | 'largest'>('newest');

  // Pending batch (local — shown before upload starts, then handed to context)
  const [pendingItems, setPendingItems]               = useState<FileUploadItem[]>([]);
  const [uploadContentType, setUploadContentType]     = useState<string>(ALLOWED_CONTENT_TYPES[0]);
  const [uploadMonth, setUploadMonth]                 = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [uploadClientName, setUploadClientName]       = useState<string>('');
  const [uploadClientId, setUploadClientId]           = useState<string>('');

  const [isDragOver, setIsDragOver] = useState(false);
  const [clients, setClients]       = useState<Client[]>([]);
  const deferredAssets              = useDeferredValue(assets);

  // Google Drive sync state
  const [isSyncing, setIsSyncing]         = useState(false);
  const [lastSync, setLastSync]           = useState<SyncLog | null>(null);
  const [syncResult, setSyncResult]       = useState<SyncLog | null>(null);
  const [showSyncResult, setShowSyncResult] = useState(false);

  // ── Toast ───────────────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── Data ────────────────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async (pageNum: number = 0) => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/assets?page=${pageNum}`);
      const json = await res.json() as {
        success: boolean;
        assets?: Asset[];
        hasMore?: boolean;
        error?: string;
      };

      if (!res.ok || !json.success) {
        const msg = json.error ?? `Failed to load assets (HTTP ${res.status})`;
        console.error('[assets] fetch error:', msg);
        setFetchError(msg);
        if (pageNum === 0) setAssets([]);
        return;
      }

      const newAssets = json.assets ?? [];
      if (pageNum === 0) setAssets(newAssets);
      else setAssets(prev => [...prev, ...newAssets]);
      setHasMore(json.hasMore ?? false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[assets] unexpected fetch error:', msg);
      setFetchError(`Could not reach server: ${msg}`);
      if (pageNum === 0) setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchAssets(next);
  }, [page, fetchAssets]);

  useEffect(() => { fetchAssets(0); }, [fetchAssets]);

  // ── Refresh asset list when a new upload completes ───────────────────────

  useEffect(() => {
    if (!latestAsset) return;
    // Immediately prepend the new asset for instant feedback
    setAssets(prev => {
      // Avoid duplicates if already in list
      if (prev.some(a => a.id === latestAsset.id)) return prev;
      return [latestAsset, ...prev];
    });
    // Also do a full refresh from the DB so the list stays consistent
    // (correct ordering, any concurrently uploaded assets appear, etc.)
    fetchAssets(0);
  }, [latestAsset, fetchAssets]);

  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data, error }) => {
      if (error) { if (process.env.NODE_ENV === 'development') console.error('[clients]', error); }
      else if (data) setClients(data as Client[]);
    });
  }, []);

  // Fetch last sync info on mount
  useEffect(() => {
    fetch('/api/assets/sync')
      .then(r => r.json())
      .then((json: { success: boolean; last_sync?: SyncLog | null }) => {
        if (json.success && json.last_sync) setLastSync(json.last_sync);
      })
      .catch(() => {/* sync log table may not exist yet */});
  }, []);

  // ── Drive Sync ───────────────────────────────────────────────────────────────

  const handleSyncDrive = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncResult(null);
    setShowSyncResult(false);
    try {
      const res = await fetch('/api/assets/sync', { method: 'POST' });
      const json = await res.json() as SyncLog & { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        addToast(`Sync failed: ${json.error ?? `HTTP ${res.status}`}`, 'error');
      } else {
        setSyncResult(json);
        setLastSync(json);
        setShowSyncResult(true);
        const summary = `Sync complete — +${json.files_added} added, ${json.files_updated} updated, ${json.files_removed} removed`;
        addToast(summary, json.errors_count > 0 ? 'error' : 'success');
        // Refresh the asset list
        setPage(0);
        fetchAssets(0);
      }
    } catch (err: unknown) {
      addToast(`Sync error: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, addToast, fetchAssets]);

  // ── Filtered / sorted assets ─────────────────────────────────────────────────

  const hasActiveFilters = Boolean(searchQuery || filterClient || filterContentType || filterYear || filterMonth || filterApproval);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setFilterClient('');
    setFilterContentType('');
    setFilterYear('');
    setFilterMonth('');
    setFilterApproval('');
  }, []);

  const filteredAssets = useMemo(() => {
    let result = [...deferredAssets];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.client_name?.toLowerCase().includes(q) ?? false) ||
        (a.content_type?.toLowerCase().includes(q) ?? false) ||
        (a.file_type?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filterClient)    result = result.filter(a => a.client_name === filterClient);
    if (filterContentType) result = result.filter(a => a.content_type === filterContentType);
    if (filterYear)      result = result.filter(a => a.month_key?.startsWith(filterYear));
    if (filterMonth)     result = result.filter(a => {
      if (!a.month_key || a.month_key.length !== 7) return false;
      return a.month_key.slice(5) === filterMonth;
    });
    if (filterApproval)  result = result.filter(a => (a.approval_status ?? 'pending') === filterApproval);
    if (sortBy === 'oldest')       result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortBy === 'largest') result.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0));
    else                           result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [deferredAssets, searchQuery, filterClient, filterContentType, filterYear, filterMonth, filterApproval, sortBy]);

  // ── Grouped view ─────────────────────────────────────────────────────────────

  // When no specific client is selected, produce an ordered list of [clientName, assets[]] groups
  const groupedByClient = useMemo(() => {
    if (filterClient) return null;
    const map = new Map<string, Asset[]>();
    for (const asset of filteredAssets) {
      const key = asset.client_name ?? 'No client';
      const list = map.get(key);
      if (list) list.push(asset);
      else map.set(key, [asset]);
    }
    return map.size > 1 ? map : null;
  }, [filteredAssets, filterClient]);

  // ── File helpers ────────────────────────────────────────────────────────────

  const filesToItems = (files: File[]): FileUploadItem[] =>
    files.map(file => ({
      id: nextFileId(),
      file,
      previewUrl: makePreviewUrl(file),
      uploadName: getFileBaseName(file.name),
    }));

  // Revoke all object URLs for a list of items to prevent memory leaks
  const revokeItemUrls = useCallback((items: FileUploadItem[]) => {
    items.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  }, []);

  const openPendingBatch = useCallback((files: File[]) => {
    if (!files.length) return;
    setPendingItems(filesToItems(files));
    setUploadContentType(ALLOWED_CONTENT_TYPES[0]);
    setUploadMonth(new Date().toISOString().slice(0, 7));
    setUploadClientName('');
    setUploadClientId('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    openPendingBatch(Array.from(e.target.files ?? []));
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClientChange = (name: string) => {
    setUploadClientName(name);
    setUploadClientId(clients.find(c => c.name === name)?.id ?? '');
  };

  const handleUploadNameChange = (id: string, name: string) => {
    setPendingItems(prev => prev.map(i => i.id === id ? { ...i, uploadName: name } : i));
  };

  // ── Drag and drop ───────────────────────────────────────────────────────────

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

  // ── Confirm upload — hand off to global UploadContext ───────────────────────

  const handleUploadConfirm = () => {
    const items = [...pendingItems];
    if (!items.length) return;
    // previewUrl object URLs are transferred to the context which owns their lifecycle.
    // Clear pendingItems WITHOUT revoking — the context will revoke them on removeItem/clearCompleted.
    setPendingItems([]);
    const uploadedBy = user?.name || user?.email || null;
    const initialItems: InitialUploadItem[] = items.map(i => ({
      id:         i.id,
      file:       i.file,
      previewUrl: i.previewUrl,
      uploadName: i.uploadName,
    }));
    startBatch(initialItems, {
      clientName:  uploadClientName,
      clientId:    uploadClientId,
      contentType: uploadContentType,
      monthKey:    uploadMonth,
      uploadedBy,
    });
    addToast(`${items.length} file${items.length !== 1 ? 's' : ''} queued for upload`, 'success');
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    const res  = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) { addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error'); return; }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    addToast(json.message ?? json.warning ?? 'Asset deleted successfully.', 'success');
  };

  // ── Rename ──────────────────────────────────────────────────────────────────

  const handleRename = async (asset: Asset, newName: string) => {
    const res  = await fetch(`/api/assets/${asset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json() as { success?: boolean; error?: string; name?: string };
    if (!res.ok) {
      addToast(`Rename failed: ${json.error ?? `HTTP ${res.status}`}`, 'error');
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, name: json.name ?? newName } : a));
    addToast('Asset renamed successfully.', 'success');
  };

  // ── View ────────────────────────────────────────────────────────────────────

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

  const handleOpenInDrive = (asset: Asset) => {
    if (asset.view_url) window.open(asset.view_url, '_blank', 'noopener,noreferrer');
  };

  const handleApprovalAction = async (asset: Asset, action: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('assets')
      .update({ approval_status: action })
      .eq('id', asset.id);
    if (error) { addToast(`Failed to ${action}: ${error.message}`, 'error'); return; }

    // Log to approval_history (best-effort)
    void supabase.from('approval_history').insert({
      asset_id:  asset.id,
      action,
      user_id:   user?.id,
      user_name: user?.name,
    }).then(({ error }) => {
      if (error && process.env.NODE_ENV === 'development') console.error('[approval_history]', error);
    });

    // Log to activities (best-effort)
    void supabase.from('activities').insert({
      type:        action,
      description: `Asset "${asset.name}" was ${action} by ${user?.name ?? 'user'}`,
      user_id:     user?.id,
      client_id:   asset.client_id ?? null,
    }).then(({ error }) => {
      if (error && process.env.NODE_ENV === 'development') console.error('[activities]', error);
    });

    setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, approval_status: action } : a));
    addToast(`Asset ${action}`, 'success');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-6xl mx-auto space-y-6" ref={dropZoneRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('assets')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Manage uploaded files · Drag &amp; drop or click Upload
              {lastSync && (
                <span className="ml-2">
                  · Last synced: <span className="font-medium">{new Date(lastSync.synced_at).toLocaleString()}</span>
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={handleSyncDrive}
                disabled={isSyncing || isUploading}
                title="Sync Google Drive → DB"
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity border"
                style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                {isSyncing ? 'Syncing…' : 'Sync Drive'}
              </button>
            )}
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

        {/* Sync result banner */}
        {showSyncResult && syncResult && (
          <div
            className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
            style={{
              background: syncResult.errors_count > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(22,163,74,0.08)',
              borderColor: syncResult.errors_count > 0 ? '#ef4444' : '#16a34a',
              color: syncResult.errors_count > 0 ? '#ef4444' : '#16a34a',
            }}
          >
            <CheckCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Sync complete</p>
              <p className="opacity-80">
                {syncResult.files_added} added · {syncResult.files_updated} updated · {syncResult.files_removed} removed
                {syncResult.errors_count > 0 && ` · ${syncResult.errors_count} error(s)`}
                {syncResult.duration_ms != null && ` · ${(syncResult.duration_ms / 1000).toFixed(1)}s`}
              </p>
              {syncResult.error_details && syncResult.error_details.length > 0 && (
                <ul className="mt-1 text-xs opacity-80 list-disc list-inside space-y-0.5">
                  {syncResult.error_details.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
            <button onClick={() => setShowSyncResult(false)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div
          className="rounded-2xl border p-4 space-y-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Browse row — client · year · month */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide shrink-0 w-14" style={{ color: 'var(--text-secondary)' }}>Browse</span>
            <select
              className="input h-8 text-sm"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="">All clients</option>
              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select
              className="input h-8 text-sm"
              value={filterYear}
              onChange={e => { setFilterYear(e.target.value); if (!e.target.value) setFilterMonth(''); }}
            >
              <option value="">All years</option>
              {Array.from(
                { length: new Date().getFullYear() - ASSETS_START_YEAR + 1 },
                (_, i) => ASSETS_START_YEAR + i,
              ).reverse().map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <select
              className="input h-8 text-sm"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              disabled={!filterYear}
              title={filterYear ? undefined : 'Select a year first'}
              style={{ opacity: filterYear ? 1 : 0.5 }}
            >
              <option value="">All months</option>
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Search + secondary filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search files, clients, types…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input h-9 text-sm pl-8 w-full"
              />
            </div>
            <select className="input h-9 text-sm" value={filterContentType} onChange={e => setFilterContentType(e.target.value)}>
              <option value="">All types</option>
              {ALLOWED_CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{contentTypeLabel(ct)}</option>)}
            </select>
            <select className="input h-9 text-sm" value={filterApproval} onChange={e => setFilterApproval(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
            </select>
            <select className="input h-9 text-sm" value={sortBy} onChange={e => setSortBy(e.target.value as 'newest' | 'oldest' | 'largest')}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="largest">Largest First</option>
            </select>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                <X size={13} /> Clear filters
              </button>
            )}
          </div>

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-1.5">
              {filterClient && <FilterBadge label={filterClient} onRemove={() => setFilterClient('')} />}
              {filterYear && <FilterBadge label={filterYear} onRemove={() => { setFilterYear(''); setFilterMonth(''); }} />}
              {filterMonth && <FilterBadge label={MONTHS.find(m => m.value === filterMonth)?.label ?? filterMonth} onRemove={() => setFilterMonth('')} />}
              {filterContentType && <FilterBadge label={contentTypeLabel(filterContentType)} onRemove={() => setFilterContentType('')} />}
              {filterApproval && <FilterBadge label={filterApproval} onRemove={() => setFilterApproval('')} />}
              {searchQuery && <FilterBadge label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
            </div>
          )}
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

        {/* Fetch error banner */}
        {fetchError && !loading && (
          <div className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', borderColor: '#ef4444', color: '#ef4444' }}>
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Failed to load assets</p>
              <p className="opacity-80 break-all">{fetchError}</p>
            </div>
            <button
              onClick={() => fetchAssets(0)}
              className="shrink-0 underline opacity-80 hover:opacity-100 transition-opacity font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Grid / empty / skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: 'var(--surface)', aspectRatio: '1' }} />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={hasActiveFilters ? 'No matching files' : t('noAssetsYet')}
            description={
              hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : t('noAssetsDesc')
            }
            action={
              !hasActiveFilters && canUpload ? (
                <button onClick={() => !isUploading && fileRef.current?.click()} disabled={isUploading} className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                  <Upload size={16} />{t('uploadFile')}
                </button>
              ) : hasActiveFilters ? (
                <button onClick={clearFilters} className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <X size={14} /> Clear filters
                </button>
              ) : undefined
            }
          />
        ) : groupedByClient ? (
          /* ── Grouped by client ── */
          <div className="space-y-8">
            {Array.from(groupedByClient.entries()).map(([clientName, clientAssets]) => (
              <div key={clientName}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{clientName}</h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    {clientAssets.length}
                  </span>
                  {/* Only show the filter shortcut when clientName corresponds to a real client */}
                  {clientAssets[0]?.client_name && (
                    <button
                      className="text-xs underline opacity-60 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--accent)' }}
                      onClick={() => setFilterClient(clientAssets[0].client_name!)}
                    >
                      View all →
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {clientAssets.map(asset => (
                    <AssetCard
                      key={asset.id} asset={asset}
                      canDelete={isAdmin} canApprove={isAdmin || user?.role === 'team'} canRename={isAdmin || user?.role === 'team'}
                      onView={() => handleView(asset)} onDelete={() => handleDelete(asset)}
                      onCopyLink={() => handleCopyLink(asset)} onOpenInDrive={() => handleOpenInDrive(asset)}
                      onApprove={() => handleApprovalAction(asset, 'approved')}
                      onReject={() => handleApprovalAction(asset, 'rejected')}
                      onComments={() => setCommentsAsset(asset)}
                      onRename={(newName) => handleRename(asset, newName)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {hasMore && !loading && (
              <div className="flex justify-center pt-2">
                <button onClick={loadMore} className="btn h-9 px-6 text-sm">Load More</button>
              </div>
            )}
          </div>
        ) : (
          /* ── Flat grid ── */
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredAssets.map(asset => (
                <AssetCard
                  key={asset.id} asset={asset}
                  canDelete={isAdmin} canApprove={isAdmin || user?.role === 'team'} canRename={isAdmin || user?.role === 'team'}
                  onView={() => handleView(asset)} onDelete={() => handleDelete(asset)}
                  onCopyLink={() => handleCopyLink(asset)} onOpenInDrive={() => handleOpenInDrive(asset)}
                  onApprove={() => handleApprovalAction(asset, 'approved')}
                  onReject={() => handleApprovalAction(asset, 'rejected')}
                  onComments={() => setCommentsAsset(asset)}
                  onRename={(newName) => handleRename(asset, newName)}
                />
              ))}
            </div>
            {hasMore && !loading && (
              <div className="flex justify-center pt-2">
                <button onClick={loadMore} className="btn h-9 px-6 text-sm">Load More</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Batch metadata modal */}
      {pendingItems.length > 0 && (
        <BatchUploadForm
          files={pendingItems} contentType={uploadContentType} month={uploadMonth} clientName={uploadClientName} clients={clients}
          onContentTypeChange={setUploadContentType} onMonthChange={setUploadMonth} onClientChange={handleClientChange}
          onConfirm={handleUploadConfirm}
          onCancel={() => { revokeItemUrls(pendingItems); setPendingItems([]); }}
          onUploadNameChange={handleUploadNameChange}
          onRemoveFile={id => setPendingItems(prev => {
            const removed = prev.find(i => i.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter(i => i.id !== id);
          })}
        />
      )}

      {/* Preview modal */}
      {previewAsset && <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />}

      {/* Comments modal */}
      {commentsAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setCommentsAsset(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-5 shadow-xl"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
                {commentsAsset.name}
              </h3>
              <button onClick={() => setCommentsAsset(null)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                <X size={16} />
              </button>
            </div>
            <CommentsPanel assetId={commentsAsset.id} />
          </div>
        </div>
      )}

      <Toast toasts={toasts} remove={removeToast} />
    </>
  );
}
