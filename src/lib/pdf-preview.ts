'use client';

/**
 * Browser-only utility for generating PDF first-page previews.
 *
 * Renders the first page of a PDF file to a JPEG using PDF.js.
 * The result is a compressed JPEG Blob suitable for uploading to R2
 * alongside the original file.
 *
 * MUST only be called in browser environments (never in Server Components or
 * Next.js API routes).
 */

/** Maximum width of the generated preview in pixels (aspect ratio preserved). */
const MAX_WIDTH = 640;

/** JPEG quality 0–1. */
const JPEG_QUALITY = 0.82;

export interface PdfPreviewResult {
  /** Object-URL pointing to the preview Blob. Caller must revoke when done. */
  blobUrl: string;
  /** The compressed JPEG Blob – pass this to the upload flow for permanent storage. */
  blob: Blob;
}

/**
 * Generate a JPEG preview of the first page of a PDF File object.
 *
 * @param file – the PDF file to preview
 * @returns A `PdfPreviewResult` on success, or `null` if rendering fails.
 */
export async function generatePdfPreview(file: File): Promise<PdfPreviewResult | null> {
  try {
    // Dynamically import pdfjs-dist to keep it out of the initial bundle.
    const pdfjsLib = await import('pdfjs-dist');

    // Configure the worker using a statically served copy of the worker file
    // from the /public directory. This avoids CDN dependencies and reliably
    // resolves in Next.js browser bundles (import.meta.url resolves to the
    // bundle, not the node_modules source tree).
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);

    // Scale so the rendered width does not exceed MAX_WIDTH.
    const viewport = page.getViewport({ scale: 1 });
    const scale    = Math.min(1, MAX_WIDTH / viewport.width);
    const scaled   = page.getViewport({ scale });

    const canvas  = document.createElement('canvas');
    canvas.width  = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;

    return new Promise<PdfPreviewResult | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(null); return; }
          resolve({ blobUrl: URL.createObjectURL(blob), blob });
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } catch (err) {
    console.warn('[pdf-preview] failed to generate PDF preview:', err);
    return null;
  }
}

/** Returns true for MIME types or file names that represent PDF files. */
export function isPdfFile(name: string, mimeType?: string | null): boolean {
  return /\.pdf$/i.test(name) || mimeType === 'application/pdf';
}
