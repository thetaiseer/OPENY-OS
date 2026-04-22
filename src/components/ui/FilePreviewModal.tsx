'use client';

import { useEffect, useState } from 'react';
import { X, Download, ExternalLink, FileText, FileImage, FileVideo, File, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import AppModal from '@/components/ui/AppModal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewFile {
  name: string;
  /** URL used for the preview content */
  url: string;
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

function isText(name: string, mime?: string | null): boolean {
  return /\.(txt|md|log|ini|yaml|yml|toml|xml|html|htm|css|js|ts|sh|py|rb|java|go|rs|c|cpp|h|php)$/i.test(name) ||
    (!!mime && (mime.startsWith('text/') || mime === 'application/json' || mime === 'text/csv'));
}

function isJson(name: string): boolean {
  return /\.json$/i.test(name);
}

function isCsv(name: string): boolean {
  return /\.csv$/i.test(name);
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

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [failed, setFailed] = useState(false);

  const zoomIn  = () => setScale(s => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.25));
  const reset   = () => setScale(1);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <FileImage size={64} style={{ color: '#3b82f6', opacity: 0.5 }} />
        <p className="text-white/60 text-sm">Image could not be loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative overflow-auto max-h-[80vh] w-full flex items-center justify-center rounded-xl" style={{ background: 'rgba(0,0,0,0.4)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
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

function VideoPreview({ src, name }: { src: string; name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = VIDEO_TYPE_MAP[ext] ?? 'video/mp4';

  return (
    <div className="w-full flex items-center justify-center">
      <video
        controls
        className="rounded-xl shadow-2xl"
        style={{ maxHeight: '80vh', maxWidth: '100%', width: '100%', objectFit: 'contain', background: '#000' }}
      >
        <source src={src} type={mimeType} />
        Your browser does not support video playback.
      </video>
    </div>
  );
}

function PdfPreview({ src, name }: { src: string; name: string }) {
  const [loaded, setLoaded] = useState(false);

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
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%', border: 0, opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
      />
    </div>
  );
}

function TextPreview({ src, name }: { src: string; name: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const json = isJson(name);
  const csv  = isCsv(name);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(src)
      .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.text(); })
      .then(text => {
        if (json) {
          try { setContent(JSON.stringify(JSON.parse(text), null, 2)); }
          catch { setContent(text); }
        } else {
          setContent(text);
        }
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, [src, json]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Loading file…</p>
      </div>
    );
  }

  if (error || content === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <FileText size={64} style={{ color: '#10b981', opacity: 0.5 }} />
        <p className="text-white/60 text-sm">Could not load file content</p>
      </div>
    );
  }

  if (csv) {
    const rows = content.split('\n').filter(r => r.trim()).map(r => r.split(','));
    return (
      <div className="w-full overflow-auto rounded-xl max-h-[80vh] shadow-2xl" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <table className="w-full text-xs text-left border-collapse" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <thead>
            {rows[0] && (
              <tr style={{ background: 'rgba(99,102,241,0.2)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {rows[0].map((cell, i) => (
                  <th key={`h-${i}`} className="px-3 py-2 font-semibold whitespace-nowrap">{cell.replace(/^"|"$/g, '')}</th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.slice(1).map((row, ri) => (
              <tr key={`r-${ri}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {row.map((cell, ci) => (
                  <td key={`r-${ri}-c-${ci}`} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">{cell.replace(/^"|"$/g, '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="w-full overflow-auto rounded-xl max-h-[80vh] shadow-2xl" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <pre
        className="text-xs p-4 whitespace-pre-wrap break-words leading-relaxed"
        style={{ color: 'rgba(255,255,255,0.82)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
      >
        {content}
      </pre>
    </div>
  );
}

function FallbackPreview({ name, mime }: { name: string; mime?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <FileIcon name={name} mime={mime} size={64} />
      <p className="text-white/70 text-sm text-center max-w-xs">
        This file type cannot be previewed. Download it to open locally.
      </p>
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
  if (!file) return null;

  const { name, url, downloadUrl, openUrl, mimeType, size } = file;
  const dl = downloadUrl ?? url;

  const img  = isImage(name, mimeType);
  const vid  = isVideo(name, mimeType);
  const pdf  = isPdf(name, mimeType);
  const text = isText(name, mimeType);

  return (
    <AppModal
      open
      onClose={onClose}
      hideHeader
      size="xl"
      zIndexClassName="z-[100]"
      panelClassName="max-w-4xl overflow-hidden border border-white/10 bg-[rgba(15,15,25,0.96)]"
      bodyClassName="p-0"
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
          {img  && <ImagePreview src={url} alt={name} />}
          {vid  && <VideoPreview src={url} name={name} />}
          {pdf  && <PdfPreview   src={url} name={name} />}
          {text && !img && !vid && !pdf && <TextPreview src={url} name={name} />}
          {!img && !vid && !pdf && !text && <FallbackPreview name={name} mime={mimeType} />}
        </div>
    </AppModal>
  );
}
