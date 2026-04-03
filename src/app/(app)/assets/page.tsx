'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Upload, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  Trash2, Eye, Download, Link, X, CheckCircle, ExternalLink, ChevronDown,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import { clientToFolderName } from '@/lib/asset-utils';
import type { Asset, Client } from '@/lib/types';

// ── Fixed content type list ───────────────────────────────────────────────────

const CONTENT_TYPES = [
  'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
  'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATES', 'REPORTS', 'OTHER',
] as const;
type ContentType = typeof CONTENT_TYPES[number];

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

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isImage(name: string, type?: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/i.test(name) || (type?.startsWith('image/') ?? false);
}

function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (/\.pdf$/i.test(name) || type === 'application/pdf') return <FileText size={size} style={{ color: '#ef4444' }} />;
  if (type?.startsWith('video/')) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (type?.startsWith('audio/')) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

function fileTypeLabel(name: string, type?: string): string {
  if (type) {
    const sub = type.split('/')[1]?.toUpperCase();
    if (sub) return sub;
  }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

// ── Upload Progress Bar ───────────────────────────────────────────────────────

const UPLOAD_STAGES = [
  { at: 0,   label: 'Preparing…' },
  { at: 20,  label: 'Creating folders…' },
  { at: 50,  label: 'Uploading to Google Drive…' },
  { at: 85,  label: 'Saving metadata…' },
  { at: 100, label: 'Completed' },
] as const;

function UploadProgress({ progress, status }: { progress: number; status: string }) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color: 'var(--text)' }}>{status}</span>
        <span className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>{progress}%</span>
      </div>
      <div className="w-full rounded-full h-2" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%`, background: 'var(--accent)' }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        {UPLOAD_STAGES.map((s, i) => (
          <span
            key={i}
            className="transition-colors"
            style={{ color: progress >= s.at ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: progress >= s.at ? 600 : 400 }}
          >
            {s.label.replace('…', '')}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Image Preview Modal ───────────────────────────────────────────────────────

function PreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const downloadUrl = asset.download_url ?? asset.file_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.file_url}
          alt={asset.name}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
        />
        <p className="mt-3 text-white/70 text-sm truncate max-w-full px-4">{asset.name}</p>
        <div className="mt-3 flex gap-3">
          <a
            href={downloadUrl}
            download={asset.name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Download size={14} /> Download
          </a>
          {asset.view_url && (
            <a
              href={asset.view_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
              onClick={e => e.stopPropagation()}
            >
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
  const img = isImage(asset.name, asset.file_type);
  const hasDrive = asset.storage_provider === 'google_drive' && !!asset.view_url;
  const downloadUrl = asset.download_url ?? asset.file_url;
  return (
    <div
      className="group rounded-2xl border overflow-hidden flex flex-col"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Thumbnail */}
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }}
        onClick={onView}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.file_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileTypeIcon name={asset.name} type={asset.file_type} size={36} />
          </div>
        )}
        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm">
            <Eye size={18} className="text-white" />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 flex-1 flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }} title={asset.name}>
          {asset.name}
        </p>
        {/* Client + content type */}
        {(asset.client_name || asset.content_type) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {asset.client_name && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {asset.client_name}
              </span>
            )}
            {asset.content_type && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                {asset.content_type}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            {fileTypeLabel(asset.name, asset.file_type)}
          </span>
          {asset.month_key && (
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {asset.month_key}
            </span>
          )}
        </div>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(asset.created_at)} · {formatSize(asset.file_size)}
        </span>
      </div>

      {/* Action buttons */}
      <div
        className="px-3 pb-3 flex items-center gap-1.5"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onView}
          title="View"
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <Eye size={13} />
          <span>View</span>
        </button>
        <a
          href={downloadUrl}
          download={asset.name}
          title="Download"
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <Download size={14} />
        </a>
        <button
          onClick={onCopyLink}
          title="Copy link"
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          <Link size={14} />
        </button>
        {hasDrive && (
          <button
            onClick={onOpenInDrive}
            title="Open in Google Drive"
            className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <ExternalLink size={14} />
          </button>
        )}
        <button
          onClick={onDelete}
          title="Delete"
          className="flex items-center justify-center h-8 w-8 rounded-lg transition-opacity hover:opacity-70"
          style={{ background: 'var(--surface-2)', color: '#ef4444' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

interface UploadModalProps {
  clients: Client[];
  initialClientId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadModal({ clients, initialClientId, onClose, onSuccess }: UploadModalProps) {
  const [clientId, setClientId] = useState(initialClientId ?? '');
  const [contentType, setContentType] = useState<ContentType | ''>('');
  const [monthKey, setMonthKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Default month to current
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    setMonthKey(`${y}-${m}`);
  }, []);

  const selectedClient = clients.find(c => c.id === clientId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) { setError('Please select a client'); return; }
    if (!contentType) { setError('Please select a content type'); return; }
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) { setError('Please select a valid month'); return; }
    if (!file) { setError('Please select a file'); return; }

    setUploading(true);
    setError('');

    const stages: Array<{ delay: number; pct: number; label: string }> = [
      { delay: 0,    pct: 0,  label: 'Preparing…' },
      { delay: 500,  pct: 20, label: 'Creating folders…' },
      { delay: 2000, pct: 50, label: 'Uploading to Google Drive…' },
      { delay: 5000, pct: 85, label: 'Saving metadata…' },
    ];
    const timers = stages.map(s =>
      setTimeout(() => { setProgress(s.pct); setStatus(s.label); }, s.delay),
    );

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('client_id', selectedClient.id);
      fd.append('client_name', selectedClient.name);
      fd.append('content_type', contentType);
      fd.append('month_key', monthKey);

      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), 300_000);

      const res = await fetch('/api/assets/upload', { method: 'POST', body: fd, signal: controller.signal });
      clearTimeout(abort);
      timers.forEach(clearTimeout);

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Upload failed (HTTP ${res.status})`);

      setProgress(85); setStatus('Saving metadata…');
      await new Promise(r => setTimeout(r, 400));
      setProgress(100); setStatus('Completed');
      await new Promise(r => setTimeout(r, 600));

      onSuccess();
      onClose();
    } catch (err: unknown) {
      timers.forEach(clearTimeout);
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? 'Upload timed out' : err.message)
        : String(err);
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={!uploading ? onClose : undefined}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Upload File</h2>
          {!uploading && (
            <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70 transition-opacity">
              <X size={18} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {uploading ? (
            <UploadProgress progress={progress} status={status} />
          ) : (
            <>
              {/* Client */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Client *</label>
                <div className="relative">
                  <select
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    required
                    className="w-full h-9 pl-3 pr-8 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] appearance-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    <option value="">Select client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>

              {/* Content type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Content Type *</label>
                <div className="relative">
                  <select
                    value={contentType}
                    onChange={e => setContentType(e.target.value as ContentType)}
                    required
                    className="w-full h-9 pl-3 pr-8 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)] appearance-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  >
                    <option value="">Select type…</option>
                    {CONTENT_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>

              {/* Month */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Month *</label>
                <input
                  type="month"
                  value={monthKey}
                  onChange={e => setMonthKey(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                />
              </div>

              {/* File */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>File *</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-3 h-9 px-3 rounded-lg text-sm cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: file ? 'var(--text)' : 'var(--text-secondary)' }}
                >
                  <Upload size={14} />
                  <span className="truncate">{file ? file.name : 'Choose file…'}</span>
                </div>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Path preview */}
              {selectedClient && contentType && monthKey && (
                <div
                  className="rounded-lg px-3 py-2 text-xs font-mono"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  <span style={{ color: 'var(--accent)' }}>OPENY_OS_STORAGE</span>
                  {' / '}
                  <span style={{ color: 'var(--text)' }}>
                    {clientToFolderName(selectedClient.name)}
                  </span>
                  {' / '}
                  <span style={{ color: 'var(--text)' }}>{contentType}</span>
                  {' / '}
                  <span style={{ color: 'var(--text)' }}>{monthKey}</span>
                </div>
              )}

              {error && (
                <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={!clientId || !contentType || !monthKey || !file}
                className="w-full h-9 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                Upload File
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TOAST_DURATION_MS = 4500;

export default function AssetsPage() {
  const { t } = useLang();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastIdRef = useRef(0);

  // ── Toast helpers ───────────────────────────────────────────────────────────

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), TOAST_DURATION_MS);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[assets fetch]', error);
        setAssets([]);
      } else {
        setAssets((data ?? []) as Asset[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
    supabase.from('clients').select('id,name').order('name').then(({ data }) => {
      setClients((data ?? []) as Client[]);
    });
  }, [fetchAssets]);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;

    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const json = await res.json();

    if (!res.ok) {
      addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error');
      return;
    }

    setAssets(prev => prev.filter(a => a.id !== asset.id));
    addToast('File deleted', 'success');
  };

  // ── View ────────────────────────────────────────────────────────────────────

  const handleView = (asset: Asset) => {
    if (isImage(asset.name, asset.file_type)) {
      setPreviewAsset(asset);
    } else {
      window.open(asset.view_url ?? asset.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  // ── Copy link ───────────────────────────────────────────────────────────────

  const handleCopyLink = async (asset: Asset) => {
    const link = asset.view_url ?? asset.file_url;
    try {
      await navigator.clipboard.writeText(link);
      addToast('Link copied', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  // ── Open in Drive ───────────────────────────────────────────────────────────

  const handleOpenInDrive = (asset: Asset) => {
    if (asset.view_url) {
      window.open(asset.view_url, '_blank', 'noopener,noreferrer');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Keyframe for toast slide-up */}
      <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('assets')}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Structured archive by client · content type · month</p>
          </div>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <Upload size={16} />
            {t('uploadFile')}
          </button>
        </div>

        {/* Asset grid / empty state / skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl animate-pulse"
                style={{ background: 'var(--surface)', aspectRatio: '1' }}
              />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={t('noAssetsYet')}
            description={t('noAssetsDesc')}
            action={
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Upload size={16} />{t('uploadFile')}
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onView={() => handleView(asset)}
                onDelete={() => handleDelete(asset)}
                onCopyLink={() => handleCopyLink(asset)}
                onOpenInDrive={() => handleOpenInDrive(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {uploadModalOpen && (
        <UploadModal
          clients={clients}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            addToast('File uploaded to Google Drive', 'success');
            void fetchAssets();
          }}
        />
      )}

      {/* Image preview lightbox */}
      {previewAsset && (
        <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      )}

      {/* Toast notifications */}
      <Toast toasts={toasts} remove={removeToast} />
    </>
  );
}
