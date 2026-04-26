'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type ScaledDocumentPreviewProps = {
  children: ReactNode;
  /** Must match `exportPreviewPdf` / `OpenyDocumentPage` (A4 width). */
  paperWidth?: string;
};

type PreviewLayout = {
  scale: number;
  slotH: number;
  offsetX: number;
};

/**
 * Renders the document at true A4 width (210mm) then scales down so the full
 * page fits inside the preview column — same line breaks as PDF, without
 * clipping or horizontal-only “peek” at the page.
 */
export default function ScaledDocumentPreview({
  children,
  paperWidth = '210mm',
}: ScaledDocumentPreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PreviewLayout>({ scale: 1, slotH: 0, offsetX: 0 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const paper = paperRef.current;
    if (!viewport || !paper) return;

    const measure = () => {
      const prev = paper.style.transform;
      paper.style.transform = 'none';
      const w = paper.offsetWidth;
      const h = Math.max(paper.offsetHeight, paper.scrollHeight);
      paper.style.transform = prev;

      const vw = viewport.clientWidth;
      if (!w || !vw) return;

      const pad = 16;
      const s = Math.min(1, Math.max(0.28, (vw - pad) / w));
      setLayout({
        scale: s,
        slotH: h * s,
        offsetX: Math.max(0, (vw - w * s) / 2),
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    ro.observe(paper);
    return () => ro.disconnect();
  }, [children]);

  const measured = layout.slotH > 8;
  const slotStyle: CSSProperties = measured
    ? { height: layout.slotH, minHeight: undefined }
    : { height: undefined, minHeight: 'min(56vh, 840px)' };

  return (
    <div ref={viewportRef} className="docs-preview-viewport">
      <div
        className={`relative mx-auto w-full ${measured ? 'overflow-hidden' : 'overflow-visible'}`}
        style={slotStyle}
      >
        <div
          ref={paperRef}
          className="docs-preview-paper-root absolute top-0"
          style={{
            left: layout.offsetX,
            width: paperWidth,
            transform: `scale(${layout.scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
