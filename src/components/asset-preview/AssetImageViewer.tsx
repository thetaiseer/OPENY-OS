'use client';

import { useRef, useState } from 'react';
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

export function AssetImageViewer({ url, alt, onError }: { url: string; alt: string; onError: () => void }) {
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startPosRef = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 5));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.4));
  const resetZoom = () => setScale(1);

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        ref={containerRef}
        className={`relative w-full rounded-2xl border border-white/10 bg-black/30 overflow-auto h-[52vh] sm:h-[62vh] ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={(e) => {
          const el = containerRef.current;
          if (!el) return;
          setDragging(true);
          startPosRef.current = { x: e.clientX, y: e.clientY, sx: el.scrollLeft, sy: el.scrollTop };
        }}
        onMouseMove={(e) => {
          const el = containerRef.current;
          const start = startPosRef.current;
          if (!el || !start || !dragging) return;
          el.scrollLeft = start.sx - (e.clientX - start.x);
          el.scrollTop = start.sy - (e.clientY - start.y);
        }}
        onMouseUp={() => { setDragging(false); startPosRef.current = null; }}
        onMouseLeave={() => { setDragging(false); startPosRef.current = null; }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-slate-900/60">
            <div className="flex items-center gap-2 text-white/70 text-sm"><Loader2 size={16} className="animate-spin" />Loading image…</div>
          </div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt}
          onLoad={() => setLoading(false)}
          onError={onError}
          onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2))}
          className="block mx-auto"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            transition: 'transform 0.18s ease',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        <button onClick={zoomOut} className="h-8 w-8 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 inline-flex items-center justify-center"><ZoomOut size={14} /></button>
        <button onClick={resetZoom} className="h-8 px-3 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 inline-flex items-center gap-1.5 text-xs"><RotateCcw size={12} />{Math.round(scale * 100)}%</button>
        <button onClick={zoomIn} className="h-8 w-8 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 inline-flex items-center justify-center"><ZoomIn size={14} /></button>
      </div>
    </div>
  );
}
