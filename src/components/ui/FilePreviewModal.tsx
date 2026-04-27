'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType2,
  Minus,
  Plus,
  Presentation,
} from 'lucide-react';
import AppModal from '@/components/ui/AppModal';
import Button from '@/components/ui/Button';

export default function FilePreviewModal({
  file,
  onClose,
}: {
  file:
    | {
        name: string;
        url: string;
        downloadUrl?: string | null;
        openUrl?: string | null;
        mimeType?: string | null;
        size?: number | null;
      }
    | null
    | undefined;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [textPreview, setTextPreview] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);

  const open = Boolean(file?.url);
  const name = file?.name ?? '';
  const mime = (file?.mimeType ?? '').toLowerCase();
  const extension = useMemo(() => name.split('.').pop()?.toLowerCase() ?? '', [name]);

  const isImage =
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'].includes(extension);
  const isVideo =
    mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'].includes(extension);
  const isPdf = mime === 'application/pdf' || extension === 'pdf';
  const isTextLike =
    mime.startsWith('text/') ||
    [
      'txt',
      'md',
      'json',
      'xml',
      'yml',
      'yaml',
      'csv',
      'ts',
      'tsx',
      'js',
      'jsx',
      'py',
      'sql',
      'html',
      'css',
    ].includes(extension);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      setTextPreview('');
      setTextLoading(false);
      return;
    }
    if (!isTextLike || !file?.url) return;
    const controller = new AbortController();
    setTextLoading(true);
    fetch(file.url, { signal: controller.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((txt) => {
        const clipped = txt.length > 120_000 ? `${txt.slice(0, 120_000)}\n\n…(truncated)` : txt;
        setTextPreview(clipped);
      })
      .catch(() => setTextPreview('Preview unavailable for this file.'))
      .finally(() => setTextLoading(false));
    return () => controller.abort();
  }, [open, isTextLike, file?.url]);

  const infoRows = [
    { label: 'File name', value: name || '—' },
    { label: 'Type', value: file?.mimeType ?? 'Unknown' },
    {
      label: 'Size',
      value:
        typeof file?.size === 'number'
          ? file.size < 1024
            ? `${file.size} B`
            : file.size < 1024 * 1024
              ? `${(file.size / 1024).toFixed(1)} KB`
              : `${(file.size / (1024 * 1024)).toFixed(2)} MB`
          : 'Unknown',
    },
  ];

  const fallbackIcon = (() => {
    if (['doc', 'docx'].includes(extension))
      return <FileType2 size={60} className="text-blue-500" />;
    if (['xls', 'xlsx', 'csv'].includes(extension))
      return <FileSpreadsheet size={60} className="text-emerald-500" />;
    if (['ppt', 'pptx'].includes(extension))
      return <Presentation size={60} className="text-orange-500" />;
    if (isTextLike) return <FileCode2 size={60} className="text-violet-500" />;
    return <FileText size={60} className="text-slate-500" />;
  })();

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={name}
      subtitle="Asset preview"
      size="xl"
      bodyClassName="!px-4 !py-4 sm:!px-5"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div className="text-xs text-[color:var(--text-secondary)]">
            Google Drive-style Preview
          </div>
          <div className="flex items-center gap-2">
            {isImage ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                >
                  <Minus size={14} />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                >
                  <Plus size={14} />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (!file?.downloadUrl && !file?.url) return;
                const href = file?.downloadUrl || file?.url;
                const a = document.createElement('a');
                a.href = href;
                a.download = file?.name ?? 'asset';
                a.click();
              }}
            >
              <Download size={14} /> Download
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div
          className="flex min-h-[52vh] items-center justify-center overflow-auto rounded-xl border bg-[color:var(--surface-2)] p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          {isImage && file?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt={name}
              className="max-h-[72vh] max-w-full select-none rounded-lg object-contain"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            />
          ) : isVideo && file?.url ? (
            <video
              src={file.url}
              controls
              autoPlay
              className="h-auto max-h-[72vh] w-full rounded-lg bg-black object-contain"
            />
          ) : isPdf && file?.url ? (
            <iframe
              title={name || 'PDF Preview'}
              src={file.url}
              className="h-[72vh] w-full rounded-lg bg-white"
            />
          ) : isTextLike ? (
            <pre className="h-[72vh] w-full overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface)] p-4 text-xs leading-relaxed text-[var(--text)]">
              {textLoading ? 'Loading preview...' : textPreview || 'No preview available.'}
            </pre>
          ) : file?.openUrl ? (
            <iframe
              title={name || 'File Preview'}
              src={file.openUrl}
              className="h-[72vh] w-full rounded-lg bg-white"
            />
          ) : (
            <div className="flex h-[52vh] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)]">
              {fallbackIcon}
              <p className="text-sm text-[var(--text-secondary)]">
                No embedded preview for this file type.
              </p>
            </div>
          )}
        </div>

        <div
          className="space-y-2 rounded-xl border bg-[var(--surface)] p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          {infoRows.map((row) => (
            <div
              key={row.label}
              className="rounded-lg border bg-[var(--surface-2)] px-3 py-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                {row.label}
              </div>
              <div className="mt-1 break-all text-sm font-medium text-[var(--text)]">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppModal>
  );
}
