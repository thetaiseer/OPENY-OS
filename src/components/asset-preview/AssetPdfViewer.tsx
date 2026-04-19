'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const LOAD_TIMEOUT_MS = 12000;

export function AssetPdfViewer({ url, title, onError }: { url: string; title: string; onError: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => {
      if (!loaded) onError();
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [loaded, onError]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 h-[58vh] sm:h-[66vh] bg-white">
      {!loaded && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-slate-900/80 text-white/70 text-sm">
          <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading PDF…</div>
        </div>
      )}
      <iframe
        src={url}
        title={title}
        className="w-full h-full border-0"
        onLoad={() => setLoaded(true)}
        onError={onError}
      />
    </div>
  );
}
