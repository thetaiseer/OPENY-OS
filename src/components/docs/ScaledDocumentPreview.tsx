'use client';

import type { ReactNode } from 'react';

type ScaledDocumentPreviewProps = {
  children: ReactNode;
  /** Must match `exportPreviewPdf` / `OpenyDocumentPage` (A4 width). */
  paperWidth?: string;
};

/**
 * Keeps the live preview at the same physical width as PDF export (`210mm`),
 * so line breaks and tables match the downloaded file. Narrow viewports
 * scroll horizontally instead of squeezing the layout.
 */
export default function ScaledDocumentPreview({
  children,
  paperWidth = '210mm',
}: ScaledDocumentPreviewProps) {
  return (
    <div className="docs-preview-shell w-full overflow-x-auto py-1">
      <div
        className="shrink-0"
        style={{
          width: paperWidth,
          marginInline: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
