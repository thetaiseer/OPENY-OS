'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Upload, FolderOpen, File, FileText, FileImage, FileVideo, FileAudio,
  Trash2, Eye, Download, Link, X, CheckCircle,
} from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import type { Asset } from '@/lib/types';

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

function isPdf(name: string, type?: string): boolean {
  return /\.pdf$/i.test(name) || type === 'application/pdf';
}

function FileTypeIcon({ name, type, size = 40 }: { name: string; type?: string; size?: number }) {
  if (isImage(name, type)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf(name, type)) return <FileText size={size} style={{ color: '#ef4444' }} />;
  if (type?.startsWith('video/')) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (type?.startsWith('audio/')) return <FileAudio size={size} style={{ color: '#06b6d4' }} />;
  return <File size={size} style={{ color: 'var(--text-secondary)' }} />;
}

function fileTypeLabel(name: string, type?: string): string {
  if (type) {
    const sub = type.split('/')[1]?.toUpperCase();
    if (sub) return sub;
  }
  const ext = name.split('.').pop()?.toUpperCase();
  return ext ?? 'FILE';
}

// ── Upload Progress Bar ───────────────────────────────────────────────────────

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
    </div>
  );
}

// ── Image Preview Modal ───────────────────────────────────────────────────────

function PreviewModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
            href={asset.file_url}
            download={asset.name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <Download size={14} /> Download
          </a>
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
}

function AssetCard({ asset, onView, onDelete, onCopyLink }: AssetCardProps) {
  const img = isImage(asset.name, asset.file_type);
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
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            {fileTypeLabel(asset.name, asset.file_type)}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {formatSize(asset.file_size)}
          </span>
        </div>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {formatDate(asset.created_at)}
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
          href={asset.file_url}
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'client-assets';
const TOAST_DURATION_MS = 4500;
const COMPLETION_DISPLAY_MS = 600;
const DB_INSERT_TIMEOUT_MS = 8000;

// Staged progress – timing (ms) for fake ticks during storage upload
const STAGE_TICK_1_MS = 100;
const STAGE_TICK_2_MS = 400;
const STAGE_TICK_3_MS = 1200;

// Progress reaches 100% after storage upload completes, not after DB insert
const UPLOAD_STAGES = [
  { at: 0,   label: 'Preparing upload' },
  { at: 10,  label: 'Preparing upload' },
  { at: 35,  label: 'Uploading file' },
  { at: 65,  label: 'Uploading file' },
  { at: 100, label: 'Completed' },
] as const;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const { t } = useLang();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
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
        .limit(100);
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

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);

    const safeFileName = file.name
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      || `file-${Date.now()}`;

    const bucket = STORAGE_BUCKET;
    const filePath = `global/${Date.now()}-${safeFileName}`;

    // Helper to advance progress stage
    const setStage = (idx: number) => {
      const s = UPLOAD_STAGES[idx];
      setUploadProgress(s.at);
      setUploadStatus(s.label);
    };

    try {
      setStage(0); // 0%  – start

      // Kick off staged fake progress ticks while upload runs
      const t1 = setTimeout(() => setStage(1), STAGE_TICK_1_MS);
      const t2 = setTimeout(() => setStage(2), STAGE_TICK_2_MS);
      const t3 = setTimeout(() => setStage(3), STAGE_TICK_3_MS);

      // Step 1: Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: false });

      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      console.log('[asset upload] storage response:', uploadData, uploadError);

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Step 2: Get public URL
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl ?? '';
      console.log('[asset upload] public URL:', publicUrl);

      // Progress reaches 100% immediately after storage upload – not after DB insert
      setStage(4); // 100% – completed
      await new Promise(r => setTimeout(r, COMPLETION_DISPLAY_MS)); // briefly show 100%

      addToast('File uploaded successfully', 'success');

      // Step 3: Insert into assets table – non-blocking; UI already complete
      const insertPromise = supabase.from('assets').insert({
        name: file.name,
        file_path: filePath,
        file_url: publicUrl,
        file_type: file.type || null,
        file_size: file.size || null,
        bucket_name: bucket,
      });

      void (async () => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            insertPromise,
            new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('DB insert timed out')), DB_INSERT_TIMEOUT_MS);
            }),
          ]);
          clearTimeout(timeoutId);
          console.log('[asset upload] DB insert response:', result);
          if (result.error) {
            console.error('[asset upload] DB insert failed:', result.error);
            addToast(`Warning: file saved but record not stored (${result.error.message})`, 'error');
          } else {
            // Activity log – fire and forget
            void supabase.from('activities').insert({
              type: 'asset',
              description: `Asset "${file.name}" uploaded`,
            });
            void fetchAssets();
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId);
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[asset upload] DB insert error:', msg);
          addToast(`Warning: file saved but record not stored (${msg})`, 'error');
        }
      })();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[asset upload] ❌', msg);
      addToast(`Upload failed: ${msg}`, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"?`)) return;
    await supabase.storage.from(STORAGE_BUCKET).remove([asset.file_path]);
    const { error } = await supabase.from('assets').delete().eq('id', asset.id);
    if (error) {
      addToast('Delete failed', 'error');
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
      window.open(asset.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  // ── Copy link ───────────────────────────────────────────────────────────────

  const handleCopyLink = async (asset: Asset) => {
    try {
      await navigator.clipboard.writeText(asset.file_url);
      addToast('Link copied', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
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
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage uploaded files</p>
          </div>
          <button
            onClick={() => !uploading && fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <Upload size={16} />
            {uploading ? 'Uploading…' : t('uploadFile')}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
        </div>

        {/* Upload progress */}
        {uploading && (
          <UploadProgress progress={uploadProgress} status={uploadStatus} />
        )}

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
                onClick={() => !uploading && fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white disabled:opacity-60"
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Image preview lightbox */}
      {previewAsset && (
        <PreviewModal asset={previewAsset} onClose={() => setPreviewAsset(null)} />
      )}

      {/* Toast notifications */}
      <Toast toasts={toasts} remove={removeToast} />
    </>
  );
}
