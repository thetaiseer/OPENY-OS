'use client';

import { Download, ExternalLink, File, FileAudio, FileImage, FileText, FileVideo, X } from 'lucide-react';
import type { AssetPreviewInfo } from '@/lib/asset-preview';

function KindIcon({ type }: { type: AssetPreviewInfo['type'] }) {
  if (type === 'image') return <FileImage size={18} className="text-blue-300" />;
  if (type === 'pdf') return <FileText size={18} className="text-rose-300" />;
  if (type === 'video') return <FileVideo size={18} className="text-violet-300" />;
  if (type === 'audio') return <FileAudio size={18} className="text-cyan-300" />;
  return <File size={18} className="text-slate-300" />;
}

export function AssetPreviewHeader({ info, onClose }: { info: AssetPreviewInfo; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-white/10">
      <div className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
        <KindIcon type={info.type} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate" title={info.displayTitle}>{info.displayTitle}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/60">
          <span className="px-1.5 py-0.5 rounded bg-white/10 uppercase">{info.ext || info.type}</span>
          <span>{info.sizeLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {info.openUrl && (
          <a
            href={info.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs inline-flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
            title="Open in new tab"
          >
            <ExternalLink size={13} /> Open
          </a>
        )}
        {info.downloadUrl && (
          <a
            href={info.downloadUrl}
            download={info.displayTitle}
            className="h-8 px-2.5 rounded-lg border border-indigo-300/40 bg-indigo-400/20 hover:bg-indigo-400/30 text-indigo-100 text-xs inline-flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <Download size={13} /> Download
          </a>
        )}
        <button
          onClick={onClose}
          className="h-8 w-8 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white inline-flex items-center justify-center"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
