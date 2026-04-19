'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export function AssetVideoViewer({ url, mime, onError }: { url: string; mime?: string | null; onError: () => void }) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black/40">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center text-white/70 text-sm bg-slate-900/50">
          <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading video…</div>
        </div>
      )}
      <video
        className="w-full h-[54vh] sm:h-[64vh] bg-black"
        controls
        playsInline
        preload="metadata"
        onLoadedData={() => setLoading(false)}
        onError={onError}
      >
        <source src={url} type={mime ?? 'video/mp4'} />
      </video>
    </div>
  );
}
