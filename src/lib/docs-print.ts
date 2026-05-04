import { sanitizeDocCode } from '@/lib/docs-client-profiles';

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function printPreviewDocument(
  previewId: string,
  documentCode: string,
  fallbackCode = 'document',
) {
  const preview = document.getElementById(previewId);
  if (!preview) return false;

  const safeCode = sanitizeDocCode(documentCode, fallbackCode);
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return false;

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(safeCode)}</title>
    <style>
      :root { color-scheme: light only; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { display: flex; justify-content: center; }
      #print-root { width: 100%; max-width: 794px; }
      .openy-doc-page { width: 210mm !important; max-width: 210mm !important; margin: 0 auto !important; overflow: visible !important; }
      .openy-doc-page table { max-width: 100% !important; }
      .openy-doc-page th, .openy-doc-page td { overflow-wrap: anywhere !important; word-break: break-word !important; }
      @media print {
        html, body { width: auto; }
        #print-root { max-width: none; width: 100%; }
        .openy-doc-page { width: 210mm !important; max-width: 210mm !important; }
      }
    </style>
  </head>
  <body>
    <div id="print-root">${preview.outerHTML}</div>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () {
          window.focus();
          window.print();
        }, 80);
      });
    </script>
  </body>
</html>`);
  win.document.close();
  return true;
}

export async function exportPreviewPdf(
  previewId: string,
  documentCode: string,
  fallbackCode = 'document',
  options: { singlePage?: boolean } = {},
) {
  const preview = document.getElementById(previewId);
  if (!preview) return false;

  const safeCode = sanitizeDocCode(documentCode, fallbackCode);
  const html2pdfModule = await import('html2pdf.js');
  type Html2PdfBuilder = {
    from: (element: HTMLElement) => Html2PdfBuilder;
    set: (options: Record<string, unknown>) => Html2PdfBuilder;
    save: () => Promise<void>;
  };
  type Html2PdfFactory = () => Html2PdfBuilder;
  const html2pdf = (html2pdfModule.default ?? html2pdfModule) as Html2PdfFactory;

  const sourceClone = preview.cloneNode(true) as HTMLElement;
  sourceClone.style.width = '210mm';
  sourceClone.style.maxWidth = '210mm';
  sourceClone.style.margin = '0';
  sourceClone.style.background = 'var(--accent-foreground)';
  /** Page padding is already inside `.openy-doc-page` (12mm); extra jsPDF margin caused scaling/clipping vs on-screen preview. */
  sourceClone.style.overflow = 'visible';

  const mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '-10000px';
  mount.style.top = '0';
  mount.style.width = '210mm';
  mount.style.background = 'var(--accent-foreground)';
  mount.appendChild(sourceClone);
  document.body.appendChild(mount);

  // Let layout flush so scrollWidth/Height reflect tables (avoids wrong canvas size).
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const sw = Math.max(1, sourceClone.scrollWidth);
  const sh = Math.max(1, sourceClone.scrollHeight);
  const pageWidthMm = 210;
  const pageHeightMm = Math.max(297, Math.ceil((sh / sw) * pageWidthMm * 100) / 100);
  // html2pdf runs one full-document html2canvas pass, then slices pages. A huge bitmap
  // (especially scale:2 on tall accounting tables) freezes the tab — cap effective edge.
  const longestEdge = Math.max(sw, sh);
  const HARD_CAP_PX = 6144;
  let scale = 2;
  if (longestEdge * scale > HARD_CAP_PX) {
    scale = HARD_CAP_PX / longestEdge;
  }
  scale = Math.min(2, Math.max(0.35, Math.round(scale * 1000) / 1000));

  const opt = {
    margin: 0,
    filename: `${safeCode}.pdf`,
    image: { type: 'jpeg', quality: scale >= 1.5 ? 0.95 : 0.88 },
    html2canvas: {
      scale,
      useCORS: true,
      foreignObjectRendering: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      // Do not pass width/height/windowWidth/windowHeight: they force a single giant
      // canvas matching full scrollHeight and lock the browser on long docs.
    },
    jsPDF: {
      unit: 'mm',
      format: options.singlePage ? [pageWidthMm, pageHeightMm] : 'a4',
      orientation: 'portrait',
    },
    pagebreak: options.singlePage
      ? { mode: [], before: [], after: [], avoid: [] }
      : { mode: ['css', 'legacy'], avoid: ['.avoid-break'] },
  };

  try {
    await html2pdf().set(opt).from(sourceClone).save();
    return true;
  } catch (err) {
    console.error('[docs-print] exportPreviewPdf failed:', err);
    return false;
  } finally {
    mount.remove();
  }
}
