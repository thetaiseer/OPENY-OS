'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const MAX_CHARS = 20_000;

export function AssetTextViewer({ url, fileSize, onError }: { url: string; fileSize: number | null; onError: () => void }) {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let active = true;

    const run = async () => {
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.text();
        if (!active) return;
        setTruncated(raw.length > MAX_CHARS || (fileSize ?? 0) > MAX_CHARS);
        setText(raw.slice(0, MAX_CHARS));
      } catch (err) {
        if (ctrl.signal.aborted) return;
        console.warn('[AssetTextViewer] failed to load text preview:', err);
        onError();
      } finally {
        if (active) setLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [url, fileSize, onError]);

  if (loading) {
    return (
      <div className="w-full rounded-2xl border border-white/10 bg-slate-900/50 h-[52vh] sm:h-[62vh] grid place-items-center text-white/70 text-sm">
        <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Loading text preview…</div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-4">
      {truncated && <p className="text-xs text-amber-200/90 mb-2">Showing first {MAX_CHARS.toLocaleString()} characters.</p>}
      <pre className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap break-words font-mono max-h-[52vh] sm:max-h-[62vh] overflow-auto">{text || 'No text content available.'}</pre>
    </div>
  );
}
