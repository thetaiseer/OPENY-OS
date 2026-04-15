import { sanitizeDocCode } from '@/lib/docs-client-profiles';

function escHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function printPreviewDocument(previewId: string, documentCode: string, fallbackCode = 'document') {
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
    <title>${escHtml(safeCode)}</title>
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
