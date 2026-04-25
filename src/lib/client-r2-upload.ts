/**
 * Browser-side R2 upload via Next.js API (presign or multipart).
 * Use from task modals and any flow outside `UploadProvider`.
 */

import { getMultipartThresholdBytesFromEnv } from '@/lib/upload-config-shared';

const CHUNK_SIZE = 8 * 1024 * 1024;
const PART_RETRIES = 3;

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

async function postMultipartPart(
  storageKey: string,
  uploadId: string,
  partNumber: number,
  chunk: Blob,
  signal?: AbortSignal,
): Promise<{ etag: string }> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= PART_RETRIES; attempt++) {
    const url = `/api/upload/multipart-part?${new URLSearchParams({
      storageKey,
      uploadId,
      partNumber: String(partNumber),
    })}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunk,
      signal,
    });
    const text = await res.text();
    if (!res.ok) {
      lastErr = new Error(text || `Part ${partNumber} failed (HTTP ${res.status})`);
      if (attempt < PART_RETRIES) await new Promise((r) => setTimeout(r, 400 * attempt));
      continue;
    }
    try {
      const j = JSON.parse(text) as { etag?: string };
      if (j.etag) return { etag: j.etag };
    } catch {
      /* fall through */
    }
    lastErr = new Error(`Part ${partNumber}: missing ETag in response`);
    if (attempt < PART_RETRIES) await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  throw lastErr ?? new Error(`Part ${partNumber} failed`);
}

/**
 * Uploads file bytes to R2 through the app API and returns storage metadata
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
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('fileName', file.name);
    formData.append('fileType', mime);
    formData.append('fileSize', String(file.size));
    formData.append('clientName', meta.clientName);
    formData.append('mainCategory', meta.mainCategory);
    formData.append('monthKey', meta.monthKey);
    if (meta.clientId) formData.append('clientId', meta.clientId);
    if (meta.subCategory) formData.append('subCategory', meta.subCategory);
    if (meta.customFileName?.trim()) formData.append('customFileName', meta.customFileName.trim());

    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      body: formData,
      signal,
    });
    const text = await presignRes.text();
    if (!presignRes.ok) {
      let msg = `Upload failed (HTTP ${presignRes.status})`;
      try {
        const j = JSON.parse(text) as { error?: string };
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return JSON.parse(text) as ClientR2PresignResult;
  }

  const totalBytes = file.size;
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

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
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const chunk = file.slice(start, end);
    const { etag } = await postMultipartPart(storageKey, uploadId, partNumber, chunk, signal);
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
