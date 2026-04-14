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

/**
 * Minimum elapsed time (ms) before upload speed is considered meaningful.
 * Avoids wild speed estimates during the first second of a chunk upload.
 */
const MIN_ELAPSED_MS_FOR_SPEED = 1500;

/** Maximum number of concurrent uploads processed from the queue. */
const UPLOAD_CONCURRENCY = 2;

const DB_FAIL_ARABIC =
  'فشل الرفع: تم رفع الملف إلى التخزين لكن فشل حفظه في قاعدة البيانات';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'saved'
  | 'completed'
  | 'paused'
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
  | 'Paused'
  | 'Upload failed'
  | 'Saved to storage, system save failed';

export interface UploadErrorDetail {
  step:               string;
  code:               string | null;
  /** HTTP status code from the failing request, if available. */
  status:             number | null;
  /** Arabic-language friendly message shown prominently in the UI. */
  message:            string;
  /** Raw error text from the storage provider or server, if available. */
  providerMessage:    string | null;
  /** True when the file bytes successfully reached cloud storage before the failure. */
  fileReachedStorage: boolean;
  /** True when the database save was confirmed. */
  dbSaved:            boolean;
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
  /**
   * Compressed JPEG blob of the video's first frame.
   * Uploaded to R2 before metadata is saved; null for non-video files.
   */
  thumbnailBlob: Blob | null;
  // ── multipart state ──────────────────────────────────────────
  /** True when this item is using the multipart upload path. */
  isMultipart:  boolean;
  /** Multipart upload session ID (set after multipart-init). */
  uploadId:     string | null;
  /**
   * Parts successfully uploaded so far. Persisted after each chunk completes
   * so the upload can be resumed from the correct position after a pause.
   */
  completedParts: { partNumber: number; etag: string }[];
  // ── progress detail ──────────────────────────────────────────
  /** Bytes uploaded so far (used for display). */
  uploadedBytes: number;
  /** Total file size in bytes (used for display). */
  totalBytes:    number;
  /** Unix timestamp (ms) when the upload started (reset on resume). */
  uploadStartMs: number | null;
  /** Current upload speed in bytes/second (rolling average; null when unavailable). */
  uploadSpeedBps: number | null;
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
  id:            string;
  file:          File;
  previewUrl:    string | null;
  uploadName:    string;
  /**
   * Compressed JPEG blob of the video's first frame, generated on the frontend.
   * When present the upload flow will upload it to R2 and save the URL in the DB.
   */
  thumbnailBlob?: Blob | null;
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
  /** Pause an active multipart upload without aborting the R2 session. */
  pauseItem:      (id: string) => void;
  /** Resume a previously paused multipart upload from the last completed part. */
  resumeItem:     (id: string) => void;
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
    case 'paused':        return 'Paused';
    case 'failed_upload': return 'Upload failed';
    case 'failed_db':     return 'Saved to storage, system save failed';
  }
}

// ── Error classification ──────────────────────────────────────────────────────

/**
 * Maps a raw upload error (exception message, HTTP status, step) into a
 * structured `UploadErrorDetail` with a human-readable Arabic message.
 *
 * Arabic message catalogue:
 *   NETWORK_ERROR           → انقطاع الاتصال بالإنترنت
 *   URL_EXPIRED             → رابط الرفع انتهت صلاحيته
 *   UNAUTHORIZED            → طلب غير مصرح به
 *   NOT_FOUND               → مسار الرفع غير موجود
 *   FILE_TOO_LARGE          → حجم الملف أكبر من الحد المسموح
 *   UNSUPPORTED_TYPE        → نوع الملف غير مدعوم
 *   PRESIGN_FAILED          → تعذر إنشاء رابط الرفع
 *   STORAGE_REJECTED        → السيرفر رفض رفع الملف
 *   CORS_MISCONFIGURED      → خطأ في إعدادات التخزين أو الصلاحيات
 *   CHUNK_FAILED            → فشل أحد أجزاء الرفع المتعدد
 *   MULTIPART_COMPLETE_FAILED → تعذر إكمال الرفع المتعدد
 *   DB_SAVE_FAILED          → تم الرفع لكن فشل حفظه في قاعدة البيانات
 *   UPLOAD_ERROR            → خطأ غير متوقع من السيرفر
 */
function classifyUploadError(opts: {
  step:                string;
  rawMessage:          string;
  httpStatus?:         number | null;
  providerBody?:       string | null;
  fileReachedStorage?: boolean;
  dbSaved?:            boolean;
}): UploadErrorDetail {
  const {
    step,
    rawMessage,
    httpStatus         = null,
    providerBody       = null,
    fileReachedStorage = false,
    dbSaved            = false,
  } = opts;

  const raw = rawMessage.toLowerCase();

  // "Device is offline" — thrown by putBlobViaXHR when navigator.onLine is false.
  const isOffline =
    raw.includes('device is offline') ||
    raw.includes('internet connection lost');

  // "Upload blocked" — thrown by putBlobViaXHR when navigator.onLine is true
  // but XHR fires onerror, which most commonly means the R2 bucket's CORS policy
  // is blocking the browser's PUT request.
  const isCorsBlocked =
    raw.includes('upload blocked') ||
    raw.includes('cors misconfiguration') ||
    raw.includes('cors') ||
    raw.includes('possible cors');

  const isNetworkFailure =
    raw.includes('fetch failed')         ||
    raw.includes('failed to fetch')      ||
    raw.includes('networkerror')         ||
    raw.includes('network error')        ||
    (raw.includes('typeerror') && (raw.includes('fetch') || raw.includes('network'))) ||
    raw.includes('timeout')              ||
    raw.includes('etimedout')            ||
    raw.includes('econnrefused')         ||
    raw.includes('econnreset')           ||
    isOffline;

  let arabicMessage: string;
  let code: string;

  // ── DB-save steps (file already in storage) ───────────────────────────────
  if (
    step === 'database_insert' ||
    step === 'complete_network' ||
    step === 'complete_parse'   ||
    step === 'complete_unknown'
  ) {
    arabicMessage = DB_FAIL_ARABIC;
    code = step === 'complete_network' ? 'NETWORK_ERROR' : 'DB_SAVE_FAILED';

  // ── CORS / ETag missing ───────────────────────────────────────────────────
  } else if (step.endsWith('_etag') || step === 'missing_etag') {
    arabicMessage = 'فشل الرفع: خطأ في إعدادات التخزين (ETag مفقود) — يجب إضافة ExposeHeaders: ["ETag"] في إعدادات CORS للـ Bucket';
    code = 'CORS_MISCONFIGURED';

  // ── CORS blocked (browser rejected PUT before reaching R2) ──────────────
  } else if (isCorsBlocked) {
    arabicMessage = 'فشل الرفع: طلب الرفع مرفوض من المتصفح (CORS) — تحقق من إعدادات CORS على الـ Bucket (AllowedHeaders وExposeHeaders)';
    code = 'CORS_MISCONFIGURED';

  // ── Device offline ────────────────────────────────────────────────────────
  } else if (isOffline) {
    arabicMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء رفع الملف — تحقق من اتصالك وأعد المحاولة';
    code = 'NETWORK_ERROR';

  // ── Multipart completion ──────────────────────────────────────────────────
  } else if (step === 'multipart_complete') {
    if (isNetworkFailure) {
      arabicMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء إكمال الرفع المتعدد';
      code = 'NETWORK_ERROR';
    } else {
      arabicMessage = 'فشل الرفع: تعذر إكمال الرفع المتعدد';
      code = httpStatus ? `HTTP_${httpStatus}` : 'MULTIPART_COMPLETE_FAILED';
    }

  // ── Multipart chunk ───────────────────────────────────────────────────────
  } else if (step.startsWith('chunk_')) {
    if (isNetworkFailure) {
      arabicMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء رفع الملف';
      code = 'NETWORK_ERROR';
    } else if (httpStatus === 401 || httpStatus === 403) {
      arabicMessage = 'فشل الرفع: رابط الرفع انتهت صلاحيته أو الطلب غير مصرح به';
      code = `HTTP_${httpStatus}`;
    } else {
      arabicMessage = 'فشل الرفع: فشل أحد أجزاء الرفع المتعدد';
      code = 'CHUNK_FAILED';
    }

  // ── Network layer ─────────────────────────────────────────────────────────
  } else if (isNetworkFailure) {
    arabicMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء رفع الملف';
    code = 'NETWORK_ERROR';

  // ── HTTP status codes ─────────────────────────────────────────────────────
  } else if (httpStatus === 401 || httpStatus === 403) {
    arabicMessage = 'فشل الرفع: رابط الرفع انتهت صلاحيته أو الطلب غير مصرح به';
    code = `HTTP_${httpStatus}`;

  } else if (httpStatus === 404) {
    arabicMessage = 'فشل الرفع: مسار الرفع أو التخزين غير موجود — تحقق من إعدادات التخزين';
    code = 'HTTP_404';

  } else if (httpStatus === 413) {
    arabicMessage = 'فشل الرفع: حجم الملف أكبر من الحد المسموح به';
    code = 'HTTP_413';

  } else if (httpStatus === 415) {
    arabicMessage = 'فشل الرفع: نوع الملف غير مدعوم';
    code = 'HTTP_415';

  } else if (httpStatus === 500) {
    if (step === 'presign' || step === 'presign_parse' || step === 'multipart_init' || step === 'multipart_init_parse') {
      arabicMessage = 'فشل الرفع: تعذر إنشاء رابط الرفع من السيرفر (خطأ داخلي)';
    } else {
      arabicMessage = 'فشل الرفع: خطأ غير متوقع من السيرفر';
    }
    code = 'HTTP_500';

  } else if (httpStatus && httpStatus >= 400) {
    arabicMessage = 'فشل الرفع: السيرفر رفض رفع الملف';
    code = `HTTP_${httpStatus}`;

  // ── Step-based fallbacks ──────────────────────────────────────────────────
  } else if (step === 'presign' || step === 'presign_parse' || step === 'multipart_init' || step === 'multipart_init_parse') {
    arabicMessage = 'فشل الرفع: تعذر إنشاء رابط الرفع من السيرفر';
    code = 'PRESIGN_FAILED';

  } else if (step === 'r2_put') {
    arabicMessage = 'فشل الرفع: السيرفر رفض رفع الملف';
    code = 'STORAGE_REJECTED';

  } else {
    arabicMessage = 'فشل الرفع: خطأ غير متوقع من السيرفر';
    code = 'UPLOAD_ERROR';
  }

  return {
    step,
    code,
    status:             httpStatus ?? null,
    message:            arabicMessage,
    providerMessage:    providerBody ? providerBody.slice(0, 400) : null,
    fileReachedStorage,
    dbSaved,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

const UploadContext = createContext<UploadContextValue>({
  queue:          [],
  isUploading:    false,
  latestAsset:    null,
  startBatch:     () => {},
  retryItem:      () => {},
  reconcileItem:  () => {},
  pauseItem:      () => {},
  resumeItem:     () => {},
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
 *
 * XHR `onerror` fires for two distinct situations:
 *   1. The device has no internet connection (navigator.onLine === false).
 *   2. The browser blocked the request due to CORS misconfiguration.
 *      In this case the browser never gets an HTTP status — the request is
 *      rejected before it reaches R2, making it appear identical to a network
 *      failure.  We distinguish these by checking navigator.onLine.
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

    xhr.addEventListener('error', () => {
      // Check navigator.onLine to distinguish device offline from CORS blocking.
      // When CORS blocks the request the browser fires onerror with no status —
      // the same as a genuine network failure, but navigator.onLine stays true.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        reject(new Error('Device is offline — internet connection lost during upload'));
      } else {
        // The upload URL itself succeeded the network path but the request was
        // blocked.  Most common cause is missing / misconfigured CORS on the R2
        // bucket (AllowedHeaders, ExposeHeaders, AllowedOrigins).
        reject(new Error('Upload blocked — possible CORS misconfiguration on storage bucket'));
      }
    });
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
  /** IDs of items currently being intentionally paused (used to distinguish pause vs cancel abort). */
  const pauseIntentRef      = useRef<Set<string>>(new Set());
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
      // ── multipart resume — uploadId still active, resume from last completed part ──
      if (item.uploadId && item.r2Key && item.isMultipart) {
        console.log('[upload] resuming multipart:', {
          key:           item.r2Key,
          uploadId:      item.uploadId,
          resumeFromPart: item.completedParts.length + 1,
        });
        await doMultipartUpload(item, fileMimeType, ctrl);
        return;
      }

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
        errorDetail: classifyUploadError({ step: 'upload', rawMessage: msg, fileReachedStorage: false, dbSaved: false }),
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

    // Helper: fetch a fresh presigned PUT URL from the server.
    async function fetchPresignedUrl(): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string; displayName: string } | null> {
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
        let providerBody: string | null = null;
        try {
          providerBody = await presignRes.text();
          const j = JSON.parse(providerBody) as { error?: string };
          if (j.error) errMsg = j.error;
        } catch { /* ignore */ }
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               'presign',
            rawMessage:         errMsg,
            httpStatus:         presignRes.status,
            providerBody,
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return null;
      }

      try {
        return await presignRes.json() as { uploadUrl: string; storageKey: string; publicUrl: string; displayName: string };
      } catch {
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               'presign_parse',
            rawMessage:         'Invalid response from upload presign endpoint',
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return null;
      }
    }

    // Phase 1: get presigned PUT URL.
    const presignData = await fetchPresignedUrl();
    if (!presignData) return;

    const { storageKey, displayName, publicUrl } = presignData;
    let   { uploadUrl } = presignData;

    // Persist key info immediately in case tab reloads during upload.
    update(item.id, { r2Key: storageKey, r2FileName: displayName, publicUrl, fileMimeType: mimeType });

    // Phase 2: direct PUT to R2.
    // On 401/403 (expired presign URL), automatically regenerate and retry once.
    setStage(item.id, 'uploading', 'Uploading', { progress: 0 });

    let putResult: XhrResult;
    try {
      putResult = await putBlobViaXHR(
        uploadUrl,
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

    // Auto-refresh expired/unauthorised presign URL and retry once.
    if (putResult.status === 401 || putResult.status === 403) {
      console.warn('[upload] presign URL rejected (HTTP', putResult.status, ') — refreshing URL and retrying');
      update(item.id, { statusText: 'Refreshing upload URL\u2026', statusLabel: 'Preparing' });

      const refreshed = await fetchPresignedUrl();
      if (!refreshed) return; // fetchPresignedUrl already set the failed stage

      uploadUrl = refreshed.uploadUrl;

      setStage(item.id, 'uploading', 'Uploading', { progress: 0 });

      try {
        putResult = await putBlobViaXHR(
          uploadUrl,
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
    }

    if (putResult.status < 200 || putResult.status >= 300) {
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: classifyUploadError({
          step:               'r2_put',
          rawMessage:         `File upload to storage failed (HTTP ${putResult.status})`,
          httpStatus:         putResult.status,
          providerBody:       putResult.body.slice(0, 400) || null,
          fileReachedStorage: false,
          dbSaved:            false,
        }),
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

    // ── Resume or fresh start ─────────────────────────────────────────────────
    const isResuming = !!item.uploadId && !!item.r2Key && item.completedParts.length > 0;
    let storageKey: string;
    let uploadId:   string;
    let publicUrl:  string;
    let displayName: string;
    let completedParts: { partNumber: number; etag: string }[];
    let uploadedBytes:  number;
    let startFromPart:  number;

    if (isResuming) {
      storageKey    = item.r2Key!;
      uploadId      = item.uploadId!;
      publicUrl     = item.publicUrl!;
      displayName   = item.r2FileName ?? item.file.name;
      completedParts = [...item.completedParts];
      uploadedBytes  = item.uploadedBytes;
      startFromPart  = item.completedParts.length + 1;

      setStage(item.id, 'uploading', 'Uploading', {
        isMultipart:   true,
        uploadStartMs: Date.now(), // reset speed calculation on resume
        totalBytes,
        uploadedBytes,
        progress: Math.round((uploadedBytes / totalBytes) * 95),
      });

      console.log('[upload] multipart resumed:', {
        key:       storageKey,
        uploadId,
        startFrom: startFromPart,
        totalChunks,
      });
    } else {
      completedParts = [];
      uploadedBytes  = 0;
      startFromPart  = 1;

      setStage(item.id, 'uploading', 'Preparing', {
        progress:      0,
        isMultipart:   true,
        uploadStartMs: Date.now(),
        totalBytes,
        uploadedBytes: 0,
        completedParts: [],
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
        let providerBody: string | null = null;
        try {
          providerBody = await initRes.text();
          const j = JSON.parse(providerBody) as { error?: string };
          if (j.error) errMsg = j.error;
        } catch { /* ignore */ }
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               'multipart_init',
            rawMessage:         errMsg,
            httpStatus:         initRes.status,
            providerBody,
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return;
      }

      let initData: { uploadId: string; storageKey: string; publicUrl: string; displayName: string };
      try {
        initData = await initRes.json() as typeof initData;
      } catch {
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               'multipart_init_parse',
            rawMessage:         'Invalid response from multipart-init endpoint',
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return;
      }

      ({ uploadId, storageKey, publicUrl, displayName } = initData);
      console.log('[upload] multipart uploadId:', uploadId, '| key:', storageKey);

      // Persist immediately so pause/resume and failed_db retry can reference these.
      update(item.id, {
        uploadId,
        r2Key:         storageKey,
        r2FileName:    displayName,
        publicUrl,
        fileMimeType:  mimeType,
        completedParts: [],
      });
    }

    // Phase 2: upload parts (from startFromPart).
    for (let partNumber = startFromPart; partNumber <= totalChunks; partNumber++) {
      if (ctrl.signal.aborted) {
        if (pauseIntentRef.current.has(item.id)) {
          // Intentional pause — preserve the multipart session in R2.
          pauseIntentRef.current.delete(item.id);
          setStage(item.id, 'paused', 'Paused', {
            // completedParts already persisted to state after each chunk
            uploadedBytes,
          });
          console.log('[upload] multipart paused:', { storageKey, uploadId, partsCompleted: completedParts.length });
          return;
        }
        // Real cancel — abort the multipart session server-side.
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
            // Capture upload start time snapshot for speed calculation.
            const speedBaseMs    = item.uploadStartMs ?? Date.now();

            const result = await putBlobViaXHR(
              partData.uploadUrl,
              chunk,
              mimeType,
              (loaded) => {
                const totalLoaded = chunkBytesStart + loaded;
                const elapsed     = Date.now() - speedBaseMs;
                const speedBps    = elapsed > MIN_ELAPSED_MS_FOR_SPEED ? Math.round((totalLoaded / elapsed) * 1000) : null;
                const pct = Math.round((totalLoaded / totalBytes) * 95);
                update(item.id, {
                  progress:       pct,
                  uploadedBytes:  totalLoaded,
                  statusText:     `Uploading part ${partNumber}/${totalChunks} — ${pct}%`,
                  statusLabel:    'Uploading',
                  uploadSpeedBps: speedBps,
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
          if (pauseIntentRef.current.has(item.id)) {
            // Abort during in-flight XHR due to pause intent.
            pauseIntentRef.current.delete(item.id);
            // completedParts up to (but not including) current chunk are valid.
            setStage(item.id, 'paused', 'Paused', { uploadedBytes });
            console.log('[upload] multipart paused mid-chunk:', { storageKey, uploadId, partsCompleted: completedParts.length });
            return;
          }
          void abortMultipartSession(storageKey, uploadId);
          throw err;
        }
        // All retries exhausted — abort and surface the error.
        void abortMultipartSession(storageKey, uploadId);
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[upload] chunk ${partNumber} permanently failed:`, msg);
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               `chunk_${partNumber}`,
            rawMessage:         msg,
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return;
      }

      uploadedBytes += chunk.size;
      const etag = chunkResult.headers['etag'] ?? '';
      if (!etag) {
        // ETag is required to complete the multipart upload.
        // This likely means R2's CORS config does not expose the ETag header.
        // Add `expose-headers: etag` to your R2 bucket's CORS settings.
        void abortMultipartSession(storageKey, uploadId);
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               `chunk_${partNumber}_etag`,
            rawMessage:         `Part ${partNumber} response did not include an ETag header. Ensure R2 CORS exposes the ETag header (expose-headers: etag).`,
            providerBody:       'Missing ETag header in PUT response',
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return;
      }
      completedParts.push({ partNumber, etag });
      // Persist completed parts to state immediately for pause/resume.
      update(item.id, { completedParts: [...completedParts], uploadedBytes });
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
      let providerBody: string | null = null;
      try {
        providerBody = await completeRes.text();
        const j = JSON.parse(providerBody) as { error?: string };
        if (j.error) errMsg = j.error;
      } catch { /* ignore */ }
      // Don't abort — parts are already in R2; surface for manual reconciliation.
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: classifyUploadError({
          step:               'multipart_complete',
          rawMessage:         errMsg,
          httpStatus:         completeRes.status,
          providerBody,
          fileReachedStorage: false,
          dbSaved:            false,
        }),
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
    // ── Optional: upload video thumbnail to R2 ─────────────────────────────
    let thumbnailStorageKey: string | undefined;

    if (item.thumbnailBlob) {
      try {
        // Get a presigned URL for the thumbnail.
        const presignRes = await fetch('/api/upload/thumbnail-presign', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ videoStorageKey: storageKey }),
          signal,
        });

        if (presignRes.ok) {
          const presignData = await presignRes.json() as {
            uploadUrl:           string;
            thumbnailStorageKey: string;
          };

          // PUT thumbnail blob directly to R2.
          const putRes = await fetch(presignData.uploadUrl, {
            method:  'PUT',
            headers: { 'Content-Type': 'image/jpeg' },
            body:    item.thumbnailBlob,
            signal,
          });

          if (putRes.ok) {
            thumbnailStorageKey = presignData.thumbnailStorageKey;
            console.log('[upload] thumbnail uploaded:', thumbnailStorageKey);
          } else {
            console.warn('[upload] thumbnail PUT failed:', putRes.status);
          }
        } else {
          console.warn('[upload] thumbnail presign failed:', presignRes.status);
        }
      } catch (err: unknown) {
        // Thumbnail upload failure is non-fatal — continue without it.
        if ((err as Error)?.name === 'AbortError') throw err;
        console.warn('[upload] thumbnail upload error (non-fatal):', err instanceof Error ? err.message : err);
      }
    }

    let completeRes: Response;
    try {
      completeRes = await fetch('/api/upload/complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey,
          displayName,
          clientName:          item.clientName,
          clientId:            item.clientId   || undefined,
          fileType:            mimeType,
          fileSize:            item.file.size,
          mainCategory:        item.mainCategory || undefined,
          subCategory:         item.subCategory  || undefined,
          monthKey:            item.monthKey,
          uploadedBy:          item.uploadedBy   || undefined,
          ...(thumbnailStorageKey ? { thumbnailStorageKey } : {}),
        }),
        signal,
      });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
        progress: 100,
        errorDetail: classifyUploadError({
          step:               'complete_network',
          rawMessage:         err instanceof Error ? err.message : String(err),
          fileReachedStorage: true,
          dbSaved:            false,
        }),
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
          errorDetail: classifyUploadError({
            step:               'complete_parse',
            rawMessage:         `Invalid response from complete endpoint (HTTP ${completeRes.status})`,
            httpStatus:         completeRes.status,
            fileReachedStorage: true,
            dbSaved:            false,
          }),
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
        errorDetail: classifyUploadError({
          step:               'database_insert',
          rawMessage:         dbErr?.message ?? 'Database insert failed',
          providerBody:       dbErr?.code    ?? null,
          fileReachedStorage: true,
          dbSaved:            false,
        }),
      });
      return;
    }

    // Unexpected response — treat as failed_db.
    setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
      progress: 100,
      errorDetail: classifyUploadError({
        step:               'complete_unknown',
        rawMessage:         `Unexpected response from complete endpoint (HTTP ${completeRes.status})`,
        httpStatus:         completeRes.status,
        fileReachedStorage: true,
        dbSaved:            false,
      }),
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
      thumbnailBlob: i.thumbnailBlob ?? null,
      isMultipart:    false,
      uploadId:       null,
      completedParts: [],
      uploadedBytes:  0,
      totalBytes:     i.file.size,
      uploadStartMs:  null,
      uploadSpeedBps: null,
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
        isMultipart:    false,
        uploadId:       null,
        completedParts: [],
        uploadedBytes:  0,
        uploadStartMs:  null,
        uploadSpeedBps: null,
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

  /**
   * Pause an active multipart upload.
   * Aborts the current in-flight XHR but does NOT abort the R2 multipart
   * session, so the upload can be resumed from the last completed part.
   * Only works for multipart uploads; single-part uploads are too small to
   * benefit from pause/resume.
   */
  const pauseItem = useCallback((id: string) => {
    // Signal that this abort is intentional (pause, not cancel).
    pauseIntentRef.current.add(id);
    const ctrl = abortControllersRef.current.get(id);
    if (ctrl) ctrl.abort();
    // doMultipartUpload detects the pause intent and transitions to 'paused'.
  }, []);

  /**
   * Resume a previously paused multipart upload.
   * Re-queues the item with its uploadId and completedParts intact so
   * doMultipartUpload can continue from the last completed part.
   */
  const resumeItem = useCallback((id: string) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status:        'queued',
        statusText:    stageText('queued'),
        statusLabel:   'Queued',
        errorDetail:   null,
        uploadStartMs: null,
        uploadSpeedBps: null,
        // uploadId, r2Key, r2FileName, publicUrl, completedParts, uploadedBytes preserved.
      },
    });
    console.log('[upload] resuming item:', id);
  }, []);

  const removeItem = useCallback((id: string) => {
    pauseIntentRef.current.delete(id); // clear any pending pause intent
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
      pauseItem,
      resumeItem,
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
