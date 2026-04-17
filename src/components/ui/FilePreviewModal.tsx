'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Download, ExternalLink, FileText, FileImage, FileVideo, File, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import supabase from '@/lib/supabase';

const PDF_LOAD_TIMEOUT_MS = 10_000;
const SUPABASE_ASSETS_BUCKET = 'openy-assets';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewFile {
  name: string;
  /** URL used for the preview content */
  url: string;
  /** Canonical storage path including full folder structure */
  filePath?: string | null;
  /** URL used for download (falls back to url) */
  downloadUrl?: string | null;
  /** URL to open in a new tab (Google Drive web view etc.) */
  openUrl?: string | null;
  /** MIME type hint */
  mimeType?: string | null;
  /** File size in bytes */
  size?: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// File-type helpers
// ─────────────────────────────────────────────────────────────────────────────

function isImage(name: string, mime?: string | null): boolean {
  return /\.(jpe?g|png|webp|gif|svg|bmp|avif)$/i.test(name) || (!!mime && mime.startsWith('image/'));
}

function isVideo(name: string, mime?: string | null): boolean {
  return /\.(mp4|webm|mov|ogg|avi|mkv)$/i.test(name) || (!!mime && mime.startsWith('video/'));
}

function isPdf(name: string, mime?: string | null): boolean {
  return /\.pdf$/i.test(name) || mime === 'application/pdf';
}

function formatSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fileTypeLabel(name: string, mime?: string | null): string {
  if (mime) {
    const sub = mime.split('/')[1]?.toUpperCase();
    if (sub && sub !== 'OCTET-STREAM') return sub;
  }
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}

function normalizeStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  let trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    trimmed = decodeURIComponent(parsed.pathname);
  } catch {
    // keep as-is
  }
  const publicPrefix = `/storage/v1/object/public/${SUPABASE_ASSETS_BUCKET}/`;
  if (trimmed.includes(publicPrefix)) trimmed = trimmed.split(publicPrefix)[1] ?? trimmed;
  if (trimmed.startsWith('/')) trimmed = trimmed.slice(1);
  if (trimmed.startsWith(`${SUPABASE_ASSETS_BUCKET}/`)) trimmed = trimmed.slice(SUPABASE_ASSETS_BUCKET.length + 1);
  const clean = (trimmed.split('?')[0] ?? '').trim();
  return clean || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon
// ─────────────────────────────────────────────────────────────────────────────

function FileIcon({ name, mime, size = 40 }: { name: string; mime?: string | null; size?: number }) {
  if (isImage(name, mime)) return <FileImage size={size} style={{ color: '#3b82f6' }} />;
  if (isPdf(name, mime))   return <FileText  size={size} style={{ color: '#ef4444' }} />;
  if (isVideo(name, mime)) return <FileVideo size={size} style={{ color: '#8b5cf6' }} />;
  if (isText(name, mime))  return <FileText  size={size} style={{ color: '#10b981' }} />;
  return <File size={size} style={{ color: '#94a3b8' }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview regions
// ─────────────────────────────────────────────────────────────────────────────

function ImagePreview({ src, alt, onError }: { src: string; alt: string; onError: () => void }) {
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  const zoomIn  = () => setScale(s => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const reset   = () => setScale(1);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative overflow-auto max-h-[80vh] w-full flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.4)' }}>
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10" style={{ background: 'rgba(15,15,25,0.7)' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading image…</p>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={onError}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease',
            maxWidth: '100%',
            maxHeight: '80vh',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={zoomOut}
          disabled={scale <= 0.25}
          title="Zoom out"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-colors"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={reset}
          title="Reset zoom"
          className="flex items-center justify-center h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors text-xs font-medium px-3"
          style={{ minWidth: '3.5rem' }}
        >
          <RotateCcw size={13} className="mr-1" />
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={zoomIn}
          disabled={scale >= 4}
          title="Zoom in"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 transition-colors"
        >
          <ZoomIn size={15} />
        </button>
      </div>
    </div>
  );
}

const VIDEO_TYPE_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/mp4',
  ogg: 'video/ogg',
};

function VideoPreview({ src, name, onError }: { src: string; name: string; onError: () => void }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = VIDEO_TYPE_MAP[ext] ?? 'video/mp4';
  const [loading, setLoading] = useState(true);

  return (
    <div className="w-full flex items-center justify-center relative">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 rounded-xl" style={{ background: 'rgba(15,15,25,0.7)' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading video…</p>
        </div>
      )}
      <video
        controls
        onLoadedData={() => setLoading(false)}
        onError={onError}
        className="rounded-xl shadow-2xl"
        style={{ maxHeight: '80vh', maxWidth: '100%', width: '100%', objectFit: 'contain', background: '#000' }}
      >
        <source src={src} type={mimeType} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function PdfPreview({ src, name, onError }: { src: string; name: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (loaded) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    timeoutRef.current = window.setTimeout(() => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      onError();
    }, PDF_LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [loaded, onError]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-2xl" style={{ height: '80vh', background: '#fff' }}>
      {!loaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#1e1e2e' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading PDF…</p>
        </div>
      )}
      <iframe
        src={src}
        title={name}
        onLoad={() => {
          if (timeoutRef.current !== null) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          setLoaded(true);
        }}
        onError={onError}
        style={{ width: '100%', height: '100%', border: 0, opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
      />
    </div>
  );
}

function FallbackPreview({ name, mime, downloadUrl }: { name: string; mime?: string | null; downloadUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <FileIcon name={name} mime={mime} size={64} />
      <p className="text-white/70 text-sm text-center max-w-xs">
        Preview not available.
      </p>
      <a
        href={downloadUrl}
        download={name}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
      >
        <Download size={14} />
        Download file
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

interface FilePreviewModalProps {
  file: PreviewFile | null;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [resolvingUrl, setResolvingUrl] = useState(false);

  useEffect(() => {
    if (!file) return;
    setPreviewFailed(false);
    const fallbackUrl = file.url?.trim() ?? '';
    const normalizedPath = normalizeStoragePath(file.filePath);
    if (!normalizedPath || !normalizedPath.includes('/')) {
      setResolvedUrl(fallbackUrl);
      setResolvingUrl(false);
      return;
    }
    setResolvingUrl(true);
    const { data } = supabase.storage.from(SUPABASE_ASSETS_BUCKET).getPublicUrl(normalizedPath);
    setResolvedUrl(data?.publicUrl || fallbackUrl);
    setResolvingUrl(false);
  }, [file]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!file) return;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [file, handleKeyDown]);

  if (!file) return null;

  const { name, url, downloadUrl, openUrl, mimeType, size } = file;
  const dl = downloadUrl ?? url;
  const previewUrl = resolvedUrl || file.url;

  const img  = isImage(name, mimeType);
  const vid  = isVideo(name, mimeType);
  const pdf  = isPdf(name, mimeType);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(15,15,25,0.96)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '95vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center gap-3 px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="shrink-0">
            <FileIcon name={name} mime={mimeType} size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-white" title={name}>{name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              >
                {fileTypeLabel(name, mimeType)}
              </span>
              {size && (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {formatSize(size)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in new tab"
                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={15} />
              </a>
            )}
            <a
              href={dl}
              download={name}
              title="Download"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-white transition-colors"
              style={{ background: 'rgba(99,102,241,0.7)' }}
              onClick={e => e.stopPropagation()}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.9)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.7)')}
            >
              <Download size={13} />
              Download
            </a>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Preview body ── */}
        <div className="flex-1 overflow-auto p-5 flex flex-col items-center justify-center min-h-0">
          {resolvingUrl && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading preview…</p>
            </div>
          )}
          {!resolvingUrl && (
            previewFailed
              ? <FallbackPreview name={name} mime={mimeType} downloadUrl={dl} />
              : (
                <>
                  {!previewUrl && <FallbackPreview name={name} mime={mimeType} downloadUrl={dl} />}
                  {img && previewUrl && <ImagePreview src={previewUrl} alt={name} onError={() => setPreviewFailed(true)} />}
                  {vid && previewUrl && <VideoPreview src={previewUrl} name={name} onError={() => setPreviewFailed(true)} />}
                  {pdf && previewUrl && <PdfPreview src={previewUrl} name={name} onError={() => setPreviewFailed(true)} />}
                  {!img && !vid && !pdf && <FallbackPreview name={name} mime={mimeType} downloadUrl={dl} />}
                </>
              )
          )}
        </div>
      </div>
    </div>
  );
}
