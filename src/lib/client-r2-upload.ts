/**
 * Browser-side R2 upload: JSON calls to Next.js + direct PUT to presigned URLs
 * (file bytes never pass through Vercel’s body limit).
 * Use from task modals and any flow outside `UploadProvider`.
 */

import { getMultipartThresholdBytesFromEnv } from '@/lib/upload-config-shared';

/** S3/R2: each multipart part except the last must be ≥ 5 MiB. */
const MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024;
const PART_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type ClientR2AssetMeta = {
  clientName: string;
  clientId?: string | null;
  mainCategory: string;
  subCategory?: string | null;
  monthKey: string;
  customFileName?: string | null;
};

export type ClientR2PresignResult = {
  storageKey: string;
  publicUrl: string;
  displayName: string;
};

async function uploadOneMultipartPart(
  storageKey: string,
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= PART_RETRIES; attempt++) {
    try {
      const urlRes = await fetch('/api/upload/multipart-part-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, uploadId, partNumber }),
        signal,
      });
      const urlText = await urlRes.text();
      if (!urlRes.ok) {
        throw new Error(urlText || `Part ${partNumber} presign failed (HTTP ${urlRes.status})`);
      }
      const { url } = JSON.parse(urlText) as { url?: string };
      if (!url) throw new Error(`Part ${partNumber}: missing presigned url`);

      const bodyBuf = await chunk.arrayBuffer();
      const putRes = await fetch(url, { method: 'PUT', body: bodyBuf, signal });
      if (!putRes.ok) {
        const t = await putRes.text().catch(() => '');
        throw new Error(
          `Part ${partNumber} PUT failed (HTTP ${putRes.status})${t ? `: ${t.slice(0, 200)}` : ''}`,
        );
      }
      const etag = (putRes.headers.get('ETag') ?? putRes.headers.get('etag') ?? '').trim();
      if (!etag) {
        throw new Error(
          'Missing ETag on part upload — add R2 CORS ExposeHeaders: ETag for your app origin.',
        );
      }
      return { etag };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < PART_RETRIES) await sleep(400 * attempt);
    }
  }
  throw lastErr ?? new Error(`Part ${partNumber} failed`);
}

/**
 * Uploads file bytes to R2 (direct PUT / multipart presigned parts) and returns storage metadata
 * (caller still runs `/api/upload/complete` if they need a DB asset row).
 */
export async function uploadFileBytesToR2(
  file: File,
  meta: ClientR2AssetMeta,
  signal?: AbortSignal,
): Promise<ClientR2PresignResult> {
  const mime = file.type || 'application/octet-stream';
  const threshold = getMultipartThresholdBytesFromEnv();

  if (file.size <= threshold) {
    const presignRes = await fetch('/api/upload/presigned-put', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: mime,
        fileSize: file.size,
        clientName: meta.clientName,
        clientId: meta.clientId || undefined,
        mainCategory: meta.mainCategory,
        subCategory: meta.subCategory || undefined,
        monthKey: meta.monthKey,
        customFileName: meta.customFileName?.trim() || undefined,
      }),
      signal,
    });
    const text = await presignRes.text();
    if (!presignRes.ok) {
      let msg = `Presign failed (HTTP ${presignRes.status})`;
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    const presign = JSON.parse(text) as {
      putUrl?: string;
      storageKey?: string;
      publicUrl?: string;
      displayName?: string;
    };
    if (!presign.putUrl || !presign.storageKey || !presign.publicUrl || !presign.displayName) {
      throw new Error('Invalid presigned-put response');
    }
    const putRes = await fetch(presign.putUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': mime },
      signal,
    });
    if (!putRes.ok) {
      const t = await putRes.text().catch(() => '');
      throw new Error(`R2 PUT failed (HTTP ${putRes.status})${t ? `: ${t.slice(0, 200)}` : ''}`);
    }
    return {
      storageKey: presign.storageKey,
      publicUrl: presign.publicUrl,
      displayName: presign.displayName,
    };
  }

  const totalBytes = file.size;
  const totalChunks = Math.ceil(totalBytes / MULTIPART_PART_SIZE_BYTES);

  const initRes = await fetch('/api/upload/multipart-init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: mime,
      fileSize: totalBytes,
      clientName: meta.clientName,
      clientId: meta.clientId || undefined,
      mainCategory: meta.mainCategory,
      subCategory: meta.subCategory || undefined,
      monthKey: meta.monthKey,
      customFileName: meta.customFileName?.trim() || undefined,
    }),
    signal,
  });
  const initText = await initRes.text();
  if (!initRes.ok) {
    let msg = `Multipart init failed (HTTP ${initRes.status})`;
    try {
      const j = JSON.parse(initText) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const initData = JSON.parse(initText) as {
    uploadId: string;
    storageKey: string;
    publicUrl: string;
    displayName: string;
  };

  const { uploadId, storageKey, publicUrl, displayName } = initData;
  const parts: { partNumber: number; etag: string }[] = [];

  for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
    const start = (partNumber - 1) * MULTIPART_PART_SIZE_BYTES;
    const end = Math.min(start + MULTIPART_PART_SIZE_BYTES, totalBytes);
    const chunk = file.slice(start, end);
    const { etag } = await uploadOneMultipartPart(storageKey, uploadId, partNumber, chunk, signal);
    parts.push({ partNumber, etag });
  }

  const completeRes = await fetch('/api/upload/multipart-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storageKey, uploadId, parts }),
    signal,
  });
  const completeText = await completeRes.text();
  if (!completeRes.ok) {
    let msg = `Multipart complete failed (HTTP ${completeRes.status})`;
    try {
      const j = JSON.parse(completeText) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  return { storageKey, publicUrl, displayName };
}
