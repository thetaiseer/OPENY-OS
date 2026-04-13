'use client';

/**
 * Global upload context.
 *
 * Upload status machine:
 *   queued → uploading → uploaded → completed
 *                                 ↘ failed_db     (R2 OK, DB save failed)
 *   queued → uploading → failed_upload (presign / R2 PUT / multipart failed)
 *
 * Small files (≤ MULTIPART_THRESHOLD) — three-phase direct upload:
 *   1. POST /api/upload/presign        → presigned PUT URL + storageKey + publicUrl
 *   2. PUT directly to R2              → browser → R2 (XHR progress events)
 *   3. POST /api/upload/complete       → save metadata to DB
 *
 * Large files (> MULTIPART_THRESHOLD) — multipart upload:
 *   1. POST /api/upload/multipart-init  → uploadId + storageKey + publicUrl
 *   2. For each chunk:
 *        POST /api/upload/multipart-part → presigned part URL
 *        PUT chunk directly to R2        → browser → R2 (XHR progress)
 *   3. POST /api/upload/multipart-complete → assemble parts in R2
 *   4. POST /api/upload/complete           → save metadata to DB
 *
 * Rules:
 *  1. File bytes NEVER pass through the Next.js / Vercel server.
 *  2. DB metadata is saved only after the full upload is assembled.
 *  3. Failed chunks are retried up to MAX_CHUNK_RETRIES times.
 *  4. User can cancel at any time; pending multipart sessions are aborted.
 *  5. failed_upload → retry full upload.
 *  6. failed_db     → retry DB save only (R2 object already exists).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import type { Asset } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Files larger than this use multipart upload (50 MB). */
const MULTIPART_THRESHOLD = 50 * 1024 * 1024;

/** Size of each multipart chunk (8 MB — well above the R2 5 MB minimum). */
const CHUNK_SIZE = 8 * 1024 * 1024;

/** Maximum number of retry attempts per chunk before giving up. */
const MAX_CHUNK_RETRIES = 3;

/** Base delay (ms) for exponential backoff between chunk retries. */
const RETRY_BASE_DELAY_MS = 1000;

/** Maximum number of concurrent uploads processed from the queue. */
const UPLOAD_CONCURRENCY = 2;

const DB_FAIL_MESSAGE =
  'File uploaded to storage successfully, but could not be saved in the system.';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'saved'
  | 'completed'
  | 'failed_upload'
  | 'failed_db';

/** Human-readable status label shown in the UI. */
export type UploadStatusLabel =
  | 'Queued'
  | 'Preparing'
  | 'Uploading'
  | 'Retrying'
  | 'Completing'
  | 'Saving to system\u2026'
  | 'Saved'
  | 'Completed'
  | 'Upload failed'
  | 'Saved to storage, system save failed';

export interface UploadErrorDetail {
  step:    string;
  message: string;
  code:    string | null;
  details: string | null;
}

export interface UploadItem {
  id:          string;
  file:        File;
  previewUrl:  string | null;
  /** User-editable base name (no extension). */
  uploadName:  string;
  status:      UploadStatus;
  /** 0–100 overall percentage. */
  progress:    number;
  statusText:  string;
  /** Detailed human-readable label for the current stage. */
  statusLabel: UploadStatusLabel;
  errorDetail: UploadErrorDetail | null;
  // ── metadata ───────────────────────────────────────────────────
  clientName:   string;
  clientId:     string;
  contentType:  string;
  mainCategory: string;
  subCategory:  string;
  monthKey:     string;
  uploadedBy:   string | null;
  // ── R2 references (set after successful upload) ──────────────
  /** R2 storage key — set after presign (single) or multipart-init. */
  r2Key:      string | null;
  r2Bucket:   string | null;
  /** Display name returned by presign / multipart-init endpoint. */
  r2FileName: string | null;
  /** Public URL of the uploaded file. */
  publicUrl:  string | null;
  fileMimeType: string | null;
  // ── multipart state ──────────────────────────────────────────
  /** True when this item is using the multipart upload path. */
  isMultipart:  boolean;
  /** Multipart upload session ID (set after multipart-init). */
  uploadId:     string | null;
  // ── progress detail ──────────────────────────────────────────
  /** Bytes uploaded so far (used for display). */
  uploadedBytes: number;
  /** Total file size in bytes (used for display). */
  totalBytes:    number;
  /** Unix timestamp (ms) when the upload started. */
  uploadStartMs: number | null;
}

/** Minimal shape submitted when confirming a batch. */
export interface BatchMeta {
  clientName:   string;
  clientId:     string;
  contentType:  string;
  mainCategory: string;
  subCategory:  string;
  monthKey:     string;
  uploadedBy:   string | null;
}

/** Item shape passed when opening a batch (before upload starts). */
export interface InitialUploadItem {
  id:         string;
  file:       File;
  previewUrl: string | null;
  uploadName: string;
}

// Keep legacy alias for pages that reference UploadQueueItem
export type UploadQueueItem = UploadItem;

// ── Context value ─────────────────────────────────────────────────────────────

interface UploadContextValue {
  queue:          UploadItem[];
  isUploading:    boolean;
  /** Most recently completed asset — used by the Assets page to prepend instantly. */
  latestAsset:    Asset | null;
  startBatch:     (items: InitialUploadItem[], meta: BatchMeta) => void;
  retryItem:      (id: string) => void;
  reconcileItem:  (id: string) => void;
  removeItem:     (id: string) => void;
  clearCompleted: () => void;
}

// ── State & reducer ───────────────────────────────────────────────────────────

interface UploadState {
  queue:       UploadItem[];
  latestAsset: Asset | null;
}

type UploadAction =
  | { type: 'ENQUEUE';          items: UploadItem[] }
  | { type: 'UPDATE';           id: string; patch: Partial<UploadItem> }
  | { type: 'REMOVE';           id: string }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'SET_LATEST_ASSET'; asset: Asset };

function reducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'ENQUEUE':
      return { ...state, queue: [...state.queue, ...action.items] };
    case 'UPDATE':
      return {
        ...state,
        queue: state.queue.map(item =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      };
    case 'REMOVE':
      return { ...state, queue: state.queue.filter(i => i.id !== action.id) };
    case 'CLEAR_COMPLETED':
      return {
        ...state,
        queue: state.queue.filter(
          i => i.status !== 'completed' && i.status !== 'failed_db',
        ),
      };
    case 'SET_LATEST_ASSET':
      return { ...state, latestAsset: action.asset };
    default:
      return state;
  }
}

// ── Stage text helpers ────────────────────────────────────────────────────────

function stageText(status: UploadStatus, label?: UploadStatusLabel): string {
  if (label) return label;
  switch (status) {
    case 'queued':        return 'Queued';
    case 'uploading':     return 'Uploading';
    case 'uploaded':      return 'Saving to system\u2026';
    case 'saved':         return 'Saved';
    case 'completed':     return 'Completed';
    case 'failed_upload': return 'Upload failed';
    case 'failed_db':     return 'Saved to storage, system save failed';
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const UploadContext = createContext<UploadContextValue>({
  queue:          [],
  isUploading:    false,
  latestAsset:    null,
  startBatch:     () => {},
  retryItem:      () => {},
  reconcileItem:  () => {},
  removeItem:     () => {},
  clearCompleted: () => {},
});

// ── XHR helpers ───────────────────────────────────────────────────────────────

interface XhrResult {
  status:  number;
  body:    string;
  headers: Record<string, string>;
}

/**
 * PUT a Blob directly to a presigned R2 URL via XHR.
 * Reports progress via `onProgress(loadedBytes)`.
 */
function putBlobViaXHR(
  url:         string,
  blob:        Blob,
  contentType: string,
  onProgress:  (loaded: number) => void,
  signal:      AbortSignal,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    });

    xhr.addEventListener('load', () => {
      // Collect response headers into a plain object.
      const headers: Record<string, string> = {};
      xhr.getAllResponseHeaders().split('\r\n').forEach(line => {
        const sep = line.indexOf(':');
        if (sep > 0) {
          headers[line.slice(0, sep).trim().toLowerCase()] = line.slice(sep + 1).trim();
        }
      });
      resolve({ status: xhr.status, body: xhr.responseText, headers });
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload to storage')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')));

    signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(blob);
  });
}

// ── Retry / backoff helpers ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run `fn` up to `maxRetries` times with exponential backoff.
 * Throws the last error if all attempts fail.
 */
async function withRetry<T>(
  fn:         () => Promise<T>,
  maxRetries: number,
  onRetry?:   (attempt: number, err: Error) => void,
): Promise<T> {
  let lastErr: Error = new Error('Unknown error');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, lastErr);
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  throw lastErr;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { queue: [], latestAsset: null });
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const runningRef          = useRef<Set<string>>(new Set());
  const dispatchRef         = useRef(dispatch);
  dispatchRef.current = dispatch;

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    dispatchRef.current({ type: 'UPDATE', id, patch });
  }, []);

  const setStage = useCallback((
    id:     string,
    status: UploadStatus,
    label:  UploadStatusLabel,
    extra?: Partial<Omit<UploadItem, 'id' | 'status' | 'statusText' | 'statusLabel'>>,
  ) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status,
        statusText:  stageText(status, label),
        statusLabel: label,
        ...extra,
      },
    });
  }, []);

  // ── Core upload function ───────────────────────────────────────────────────
  //
  // Decides between single-PUT and multipart based on file size.

  const doUploadItem = useCallback(async (item: UploadItem) => {
    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    const fileMimeType = (item.fileMimeType ?? item.file.type) || 'application/octet-stream';

    try {
      // ── failed_db retry — R2 upload already done, skip to phase 3 ──────────
      if (item.r2Key) {
        setStage(item.id, 'uploaded', 'Saving to system\u2026', {
          progress:     100,
          uploadedBytes: item.totalBytes,
        });
        await doSaveMetadata(item, item.r2Key, item.r2FileName ?? item.file.name, item.publicUrl ?? '', fileMimeType, ctrl.signal);
        return;
      }

      const useMultipart = item.file.size > MULTIPART_THRESHOLD;

      console.log('[upload] start:', {
        name:         item.file.name,
        size:         item.file.size,
        multipart:    useMultipart,
        chunkSize:    useMultipart ? CHUNK_SIZE : 'n/a',
        totalChunks:  useMultipart ? Math.ceil(item.file.size / CHUNK_SIZE) : 1,
      });

      if (useMultipart) {
        await doMultipartUpload(item, fileMimeType, ctrl);
      } else {
        await doSingleUpload(item, fileMimeType, ctrl);
      }

    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;

      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] unhandled error for item', item.id, msg);
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: { step: 'upload', message: msg, code: 'UPLOAD_ERROR', details: null },
      });
    } finally {
      abortControllersRef.current.delete(item.id);
      runningRef.current.delete(item.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStage]);

  // ── Single-file upload (≤ MULTIPART_THRESHOLD) ────────────────────────────

  async function doSingleUpload(
    item:        UploadItem,
    mimeType:    string,
    ctrl:        AbortController,
  ) {
    setStage(item.id, 'uploading', 'Preparing', {
      progress:      0,
      isMultipart:   false,
      uploadStartMs: Date.now(),
      totalBytes:    item.file.size,
      uploadedBytes: 0,
    });

    // Phase 1: get presigned PUT URL.
    let presignRes: Response;
    try {
      presignRes = await fetch('/api/upload/presign', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName:       item.file.name,
          fileType:       mimeType,
          fileSize:       item.file.size,
          clientName:     item.clientName,
          clientId:       item.clientId   || undefined,
          mainCategory:   item.mainCategory,
          subCategory:    item.subCategory || undefined,
          monthKey:       item.monthKey,
          uploadedBy:     item.uploadedBy  || undefined,
          customFileName: item.uploadName.trim() || undefined,
        }),
        signal: ctrl.signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new Error('Network error while requesting upload URL');
    }

    if (!presignRes.ok) {
      let errMsg = `Failed to obtain upload URL (HTTP ${presignRes.status})`;
      try { const j = await presignRes.json() as { error?: string }; if (j.error) errMsg = j.error; } catch { /* ignore */ }
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: { step: 'presign', message: errMsg, code: `HTTP_${presignRes.status}`, details: null },
      });
      return;
    }

    let presignData: { uploadUrl: string; storageKey: string; publicUrl: string; displayName: string };
    try {
      presignData = await presignRes.json() as typeof presignData;
    } catch {
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: { step: 'presign_parse', message: 'Invalid response from upload presign endpoint', code: null, details: null },
      });
      return;
    }

    const { storageKey, displayName, publicUrl } = presignData;

    // Persist key info immediately in case tab reloads during upload.
    update(item.id, { r2Key: storageKey, r2FileName: displayName, publicUrl, fileMimeType: mimeType });

    // Phase 2: direct PUT to R2.
    setStage(item.id, 'uploading', 'Uploading', { progress: 0 });

    let putResult: XhrResult;
    try {
      putResult = await putBlobViaXHR(
        presignData.uploadUrl,
        item.file,
        mimeType,
        (loaded) => {
          const pct = Math.round((loaded / item.file.size) * 95);
          update(item.id, {
            progress:     pct,
            uploadedBytes: loaded,
            statusText:   `Uploading ${pct}%`,
            statusLabel:  'Uploading',
          });
        },
        ctrl.signal,
      );
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new Error(err instanceof Error ? err.message : 'Network error during file upload');
    }

    if (putResult.status < 200 || putResult.status >= 300) {
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: {
          step:    'r2_put',
          message: `File upload to storage failed (HTTP ${putResult.status})`,
          code:    `HTTP_${putResult.status}`,
          details: putResult.body.slice(0, 300) || null,
        },
      });
      return;
    }

    setStage(item.id, 'uploaded', 'Saving to system\u2026', {
      progress:      100,
      uploadedBytes: item.file.size,
    });

    // Phase 3: save metadata.
    await doSaveMetadata(item, storageKey, displayName, publicUrl, mimeType, ctrl.signal);
  }

  // ── Multipart upload (> MULTIPART_THRESHOLD) ──────────────────────────────

  async function doMultipartUpload(
    item:     UploadItem,
    mimeType: string,
    ctrl:     AbortController,
  ) {
    const totalBytes  = item.file.size;
    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

    setStage(item.id, 'uploading', 'Preparing', {
      progress:      0,
      isMultipart:   true,
      uploadStartMs: Date.now(),
      totalBytes,
      uploadedBytes: 0,
    });

    // Phase 1: initiate multipart upload.
    console.log('[upload] multipart init:', { key: item.file.name, totalChunks });

    let initRes: Response;
    try {
      initRes = await fetch('/api/upload/multipart-init', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName:       item.file.name,
          fileType:       mimeType,
          fileSize:       totalBytes,
          clientName:     item.clientName,
          clientId:       item.clientId    || undefined,
          mainCategory:   item.mainCategory,
          subCategory:    item.subCategory  || undefined,
          monthKey:       item.monthKey,
          uploadedBy:     item.uploadedBy   || undefined,
          customFileName: item.uploadName.trim() || undefined,
        }),
        signal: ctrl.signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new Error('Network error while initiating multipart upload');
    }

    if (!initRes.ok) {
      let errMsg = `Failed to initiate multipart upload (HTTP ${initRes.status})`;
      try { const j = await initRes.json() as { error?: string }; if (j.error) errMsg = j.error; } catch { /* ignore */ }
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: { step: 'multipart_init', message: errMsg, code: `HTTP_${initRes.status}`, details: null },
      });
      return;
    }

    let initData: { uploadId: string; storageKey: string; publicUrl: string; displayName: string };
    try {
      initData = await initRes.json() as typeof initData;
    } catch {
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: { step: 'multipart_init_parse', message: 'Invalid response from multipart-init endpoint', code: null, details: null },
      });
      return;
    }

    const { uploadId, storageKey, publicUrl, displayName } = initData;
    console.log('[upload] multipart uploadId:', uploadId, '| key:', storageKey);

    // Persist immediately so failed_db retry can reference these.
    update(item.id, {
      uploadId,
      r2Key:      storageKey,
      r2FileName: displayName,
      publicUrl,
      fileMimeType: mimeType,
    });

    // Phase 2: upload parts.
    const completedParts: { partNumber: number; etag: string }[] = [];
    let   uploadedBytes = 0;

    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      if (ctrl.signal.aborted) {
        // User cancelled — abort the multipart session server-side.
        void abortMultipartSession(storageKey, uploadId);
        throw new DOMException('Upload cancelled', 'AbortError');
      }

      const start = (partNumber - 1) * CHUNK_SIZE;
      const end   = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunk = item.file.slice(start, end);

      console.log(`[upload] chunk ${partNumber}/${totalChunks}: bytes ${start}–${end} (${chunk.size} bytes)`);

      // Per-chunk retry loop.
      let chunkResult: XhrResult;
      try {
        chunkResult = await withRetry(
          async () => {
            // Get a fresh presigned URL for this part.
            let partRes: Response;
            try {
              partRes = await fetch('/api/upload/multipart-part', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storageKey, uploadId, partNumber }),
                signal: ctrl.signal,
              });
            } catch (err: unknown) {
              if ((err as Error)?.name === 'AbortError') throw err;
              throw new Error(`Network error while obtaining presigned URL for part ${partNumber}`);
            }

            if (!partRes.ok) {
              let em = `Failed to get part URL (HTTP ${partRes.status})`;
              try { const j = await partRes.json() as { error?: string }; if (j.error) em = j.error; } catch { /* ignore */ }
              throw new Error(em);
            }

            const partData = await partRes.json() as { uploadUrl: string };
            const chunkBytesStart = uploadedBytes;

            const result = await putBlobViaXHR(
              partData.uploadUrl,
              chunk,
              mimeType,
              (loaded) => {
                const totalLoaded = chunkBytesStart + loaded;
                const pct = Math.round((totalLoaded / totalBytes) * 95);
                update(item.id, {
                  progress:      pct,
                  uploadedBytes: totalLoaded,
                  statusText:    `Uploading part ${partNumber}/${totalChunks} — ${pct}%`,
                  statusLabel:   'Uploading',
                });
              },
              ctrl.signal,
            );

            if (result.status < 200 || result.status >= 300) {
              throw new Error(`Part ${partNumber} upload failed (HTTP ${result.status}): ${result.body.slice(0, 200)}`);
            }

            return result;
          },
          MAX_CHUNK_RETRIES,
          (attempt, err) => {
            console.warn(`[upload] chunk ${partNumber} retry ${attempt}/${MAX_CHUNK_RETRIES}:`, err.message);
            update(item.id, { statusText: `Retrying part ${partNumber} (attempt ${attempt})…`, statusLabel: 'Retrying' });
          },
        );
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          void abortMultipartSession(storageKey, uploadId);
          throw err;
        }
        // All retries exhausted — abort and surface the error.
        void abortMultipartSession(storageKey, uploadId);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[upload] chunk ${partNumber} permanently failed:`, msg);
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: {
            step:    `chunk_${partNumber}`,
            message: `Upload failed at part ${partNumber}/${totalChunks}: ${msg}`,
            code:    'CHUNK_FAILED',
            details: null,
          },
        });
        return;
      }

      uploadedBytes += chunk.size;
      const etag = chunkResult.headers['etag'] ?? '';
      if (!etag) {
        console.warn(`[upload] chunk ${partNumber} response missing ETag — R2 may not return ETag for presigned parts`);
      }
      completedParts.push({ partNumber, etag });
      console.log(`[upload] chunk ${partNumber}/${totalChunks} done. ETag:`, etag || '(none)');
    }

    // Phase 3: complete multipart upload.
    update(item.id, {
      statusText:    'Completing upload\u2026',
      statusLabel:   'Completing',
      progress:      97,
      uploadedBytes: totalBytes,
    });

    console.log('[upload] multipart complete: assembling', completedParts.length, 'parts');

    let completeRes: Response;
    try {
      completeRes = await fetch('/api/upload/multipart-complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, uploadId, parts: completedParts }),
        signal: ctrl.signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        void abortMultipartSession(storageKey, uploadId);
        throw err;
      }
      throw new Error('Network error while completing multipart upload');
    }

    if (!completeRes.ok) {
      let errMsg = `Failed to complete multipart upload (HTTP ${completeRes.status})`;
      try { const j = await completeRes.json() as { error?: string }; if (j.error) errMsg = j.error; } catch { /* ignore */ }
      // Don't abort — parts are already in R2; surface for manual reconciliation.
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: { step: 'multipart_complete', message: errMsg, code: `HTTP_${completeRes.status}`, details: null },
      });
      return;
    }

    console.log('[upload] multipart complete succeeded for key:', storageKey);

    setStage(item.id, 'uploaded', 'Saving to system\u2026', {
      progress:      100,
      uploadedBytes: totalBytes,
    });

    // Phase 4: save metadata to DB.
    await doSaveMetadata(item, storageKey, displayName, publicUrl, mimeType, ctrl.signal);
  }

  // ── Save metadata helper (shared by single + multipart) ───────────────────

  async function doSaveMetadata(
    item:        UploadItem,
    storageKey:  string,
    displayName: string,
    publicUrl:   string,
    mimeType:    string,
    signal:      AbortSignal,
  ) {
    let completeRes: Response;
    try {
      completeRes = await fetch('/api/upload/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey,
          displayName,
          clientName:   item.clientName,
          clientId:     item.clientId   || undefined,
          fileType:     mimeType,
          fileSize:     item.file.size,
          mainCategory: item.mainCategory || undefined,
          subCategory:  item.subCategory  || undefined,
          monthKey:     item.monthKey,
          uploadedBy:   item.uploadedBy   || undefined,
        }),
        signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
        progress: 100,
        errorDetail: {
          step:    'complete_network',
          message: DB_FAIL_MESSAGE,
          code:    'NETWORK_ERROR',
          details: err instanceof Error ? err.message : null,
        },
      });
      return;
    }

    let json: {
      success:      boolean;
      stage?:       string;
      asset?:       Asset;
      r2_key?:      string;
      r2_bucket?:   string;
      r2_filename?: string;
      error?:       unknown;
    };

    try {
      json = await completeRes.json() as typeof json;
    } catch {
      if (completeRes.ok) {
        setStage(item.id, 'completed', 'Completed', { progress: 100 });
      } else {
        setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
          progress: 100,
          errorDetail: { step: 'complete_parse', message: DB_FAIL_MESSAGE, code: `HTTP_${completeRes.status}`, details: null },
        });
      }
      return;
    }

    if (json.stage === 'completed') {
      if (json.asset) dispatchRef.current({ type: 'SET_LATEST_ASSET', asset: json.asset });
      setStage(item.id, 'completed', 'Completed', { progress: 100 });
      return;
    }

    if (json.stage === 'failed_db') {
      update(item.id, {
        r2Key:      json.r2_key      ?? storageKey,
        r2Bucket:   json.r2_bucket   ?? null,
        r2FileName: json.r2_filename ?? displayName,
        publicUrl,
        fileMimeType: mimeType,
      });
      const dbErr = json.error as { message?: string; code?: string } | null | undefined;
      setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
        progress: 100,
        errorDetail: {
          step:    'database_insert',
          message: DB_FAIL_MESSAGE,
          code:    dbErr?.code    ?? null,
          details: dbErr?.message ?? null,
        },
      });
      return;
    }

    // Unexpected response — treat as failed_db.
    setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
      progress: 100,
      errorDetail: { step: 'complete_unknown', message: DB_FAIL_MESSAGE, code: `HTTP_${completeRes.status}`, details: null },
    });
  }

  // ── Abort multipart session (fire-and-forget) ─────────────────────────────

  async function abortMultipartSession(storageKey: string, uploadId: string) {
    try {
      await fetch('/api/upload/multipart-abort', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, uploadId }),
      });
      console.log('[upload] multipart aborted:', storageKey, uploadId);
    } catch (err) {
      console.warn('[upload] multipart-abort request failed:', err);
    }
  }

  // ── Queue runner ──────────────────────────────────────────────────────────

  useEffect(() => {
    const queued = state.queue.filter(
      i => i.status === 'queued' && !runningRef.current.has(i.id),
    );
    const slots = UPLOAD_CONCURRENCY - runningRef.current.size;
    if (slots <= 0 || queued.length === 0) return;

    queued.slice(0, slots).forEach(item => {
      if (!runningRef.current.has(item.id)) {
        runningRef.current.add(item.id);
        void doUploadItem(item);
      }
    });
  }, [state.queue, doUploadItem]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startBatch = useCallback((items: InitialUploadItem[], meta: BatchMeta) => {
    const queueItems: UploadItem[] = items.map(i => ({
      id:            i.id,
      file:          i.file,
      previewUrl:    i.previewUrl,
      status:        'queued',
      statusText:    stageText('queued'),
      statusLabel:   'Queued',
      progress:      0,
      errorDetail:   null,
      uploadName:    i.uploadName,
      clientName:    meta.clientName,
      clientId:      meta.clientId,
      contentType:   meta.contentType,
      mainCategory:  meta.mainCategory,
      subCategory:   meta.subCategory,
      monthKey:      meta.monthKey,
      uploadedBy:    meta.uploadedBy,
      r2Key:        null,
      r2Bucket:     null,
      r2FileName:   null,
      publicUrl:    null,
      fileMimeType: null,
      isMultipart:  false,
      uploadId:     null,
      uploadedBytes: 0,
      totalBytes:    i.file.size,
      uploadStartMs: null,
    }));
    dispatch({ type: 'ENQUEUE', items: queueItems });
  }, []);

  /** Retry a failed_upload item — full upload from scratch. */
  const retryItem = useCallback((id: string) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status:       'queued',
        statusText:   stageText('queued'),
        statusLabel:  'Queued',
        progress:     0,
        errorDetail:  null,
        r2Key:        null,
        r2Bucket:     null,
        r2FileName:   null,
        publicUrl:    null,
        fileMimeType: null,
        isMultipart:  false,
        uploadId:     null,
        uploadedBytes: 0,
        uploadStartMs: null,
      },
    });
  }, []);

  /** Retry a failed_db item — skip R2 upload, retry DB save only. */
  const reconcileItem = useCallback((id: string) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status:      'queued',
        statusText:  stageText('queued'),
        statusLabel: 'Queued',
        progress:    0,
        errorDetail: null,
        // r2Key / r2FileName / publicUrl / fileMimeType preserved.
      },
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    const ctrl = abortControllersRef.current.get(id);
    if (ctrl) { ctrl.abort(); abortControllersRef.current.delete(id); }
    runningRef.current.delete(id);
    dispatchRef.current({ type: 'REMOVE', id });
  }, []);

  const clearCompleted = useCallback(() => {
    dispatchRef.current({ type: 'CLEAR_COMPLETED' });
  }, []);

  const isUploading = state.queue.some(
    i => i.status === 'uploading' || i.status === 'uploaded' || i.status === 'saved',
  );

  return (
    <UploadContext.Provider value={{
      queue:          state.queue,
      isUploading,
      latestAsset:    state.latestAsset,
      startBatch,
      retryItem,
      reconcileItem,
      removeItem,
      clearCompleted,
    }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload(): UploadContextValue {
  return useContext(UploadContext);
}
