'use client';

import { Download, ExternalLink, File } from 'lucide-react';
import type { AssetPreviewInfo } from '@/lib/asset-preview';

export function AssetUnsupportedViewer({ info }: { info: AssetPreviewInfo }) {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-white/5 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 inline-flex items-center justify-center text-slate-200"><File size={24} /></div>
      <p className="mt-3 text-sm text-white font-medium truncate" title={info.displayTitle}>{info.displayTitle}</p>
      <p className="mt-1 text-xs text-white/60 uppercase">{info.ext || info.type} · {info.sizeLabel}</p>
      <p className="mt-4 text-sm text-white/70">Preview unavailable for this file.</p>

      <div className="mt-5 flex items-center justify-center gap-2">
        {info.openUrl && (
          <a
            href={info.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm inline-flex items-center gap-1.5"
          >
            <ExternalLink size={14} /> Open
          </a>
        )}
        {info.downloadUrl && (
          <a
            href={info.downloadUrl}
            download={info.displayTitle}
            className="h-9 px-3 rounded-lg border border-indigo-300/40 bg-indigo-400/20 hover:bg-indigo-400/30 text-indigo-100 text-sm inline-flex items-center gap-1.5"
          >
            <Download size={14} /> Download
          </a>
        )}
      </div>
    </div>
  );
}
