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
      @media print {
        html, body { width: auto; }
        #print-root { max-width: none; width: 100%; }
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

  const opt = {
    margin: 12,
    filename: `${safeCode}.pdf`,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.avoid-break'] },
  };

  await html2pdf().set(opt).from(preview).save();
  return true;
}
