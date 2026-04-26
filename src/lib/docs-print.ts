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
) {
  const preview = document.getElementById(previewId);
  if (!preview) return false;

  const safeCode = sanitizeDocCode(documentCode, fallbackCode);
  const html2pdfModule = await import('html2pdf.js');
  const html2pdf = (html2pdfModule.default ?? html2pdfModule) as any;

  const sourceClone = preview.cloneNode(true) as HTMLElement;
  sourceClone.style.width = '210mm';
  sourceClone.style.maxWidth = '210mm';
  sourceClone.style.margin = '0';
  sourceClone.style.background = '#fff';
  /** Page padding is already inside `.openy-doc-page` (12mm); extra jsPDF margin caused scaling/clipping vs on-screen preview. */
  sourceClone.style.overflow = 'visible';

  const mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '-10000px';
  mount.style.top = '0';
  mount.style.width = '210mm';
  mount.style.background = '#fff';
  mount.appendChild(sourceClone);
  document.body.appendChild(mount);

  const w = sourceClone.scrollWidth;
  const h = sourceClone.scrollHeight;

  const opt = {
    margin: 0,
    filename: `${safeCode}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0,
      scrollX: 0,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.avoid-break'] },
  };

  try {
    await html2pdf().set(opt).from(sourceClone).save();
  } finally {
    mount.remove();
  }
  return true;
}
