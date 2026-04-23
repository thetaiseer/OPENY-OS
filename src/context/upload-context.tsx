'use client';

/**
 * Global upload context.
 *
 * Upload status machine:
 *   queued → uploading → uploaded → completed
 *                                 ↘ failed_db     (R2 OK, DB save failed)
 *   queued → uploading → failed_upload (upload / multipart failed)
 *
 * Small files (≤ MULTIPART_THRESHOLD) — R2 direct server upload:
 *   1. POST /api/upload/presign   → server uploads file to R2, returns storageKey + publicUrl
 *   2. POST /api/upload/complete  → save metadata to DB
 *
 * Large files (> MULTIPART_THRESHOLD) — R2 multipart upload (server-side):
 *   1. POST /api/upload/multipart-init  → uploadId + storageKey + publicUrl
 *   2. For each chunk:
 *        POST /api/upload/multipart-part?storageKey=...&uploadId=...&partNumber=N
 *          (raw binary body) → server uploads part to R2, returns { partNumber, etag }
 *   3. POST /api/upload/multipart-complete → assemble parts in R2
 *   4. POST /api/upload/complete           → save metadata to DB
 *
 * Rules:
 *  1. DB metadata is saved only after the full upload is assembled.
 *  2. Failed chunks are retried up to MAX_CHUNK_RETRIES times.
 *  3. User can cancel at any time; pending multipart sessions are aborted.
 *  4. failed_upload → retry full upload.
 *  5. failed_db     → retry DB save only (R2 object already exists).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import type { Asset } from '../lib/types';

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

/** Client-visible bucket label for temporary upload logs. */
const R2_BUCKET_LOG_NAME =
  process.env.NEXT_PUBLIC_R2_BUCKET_NAME?.trim() || 'client-assets';

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
  uploadedByEmail: string | null;
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
  /**
   * Duration of the video in seconds, captured during thumbnail generation.
   * null for non-video files or when duration could not be determined.
   */
  durationSeconds: number | null;
  /**
   * Compressed JPEG blob of the document's first-page preview (e.g. PDF).
   * Uploaded to R2 before metadata is saved; null for non-document files.
   */
  previewBlob: Blob | null;
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
  uploadedByEmail: string | null;
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
  /**
   * Duration of the video in seconds, captured during thumbnail generation.
   */
  durationSeconds?: number | null;
  /**
   * Compressed JPEG blob of a document's first-page preview (e.g. PDF).
   * When present the upload flow will upload it to R2 and save the URL in the DB.
   */
  previewBlob?: Blob | null;
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

  // "Device is offline" — thrown by sendBlobViaXHR when navigator.onLine is false.
  const isOffline =
    raw.includes('device is offline') ||
    raw.includes('internet connection lost');

  // "Upload blocked" — thrown by sendBlobViaXHR when navigator.onLine is true
  // but XHR fires onerror (network-level failure).
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

  let displayMessage: string;
  let code: string;

  // ── DB-save steps (file already in storage) ───────────────────────────────
  if (
    step === 'database_insert' ||
    step === 'complete_network' ||
    step === 'complete_parse'   ||
    step === 'complete_unknown'
  ) {
    displayMessage = DB_FAIL_ARABIC;
    code = step === 'complete_network' ? 'NETWORK_ERROR' : 'DB_SAVE_FAILED';

  // ── CORS / ETag missing ───────────────────────────────────────────────────
  } else if (step.endsWith('_etag') || step === 'missing_etag') {
    displayMessage = 'فشل الرفع: خطأ في إعدادات التخزين (ETag مفقود) — يجب إضافة ExposeHeaders: ["ETag"] في إعدادات CORS للـ Bucket';
    code = 'CORS_MISCONFIGURED';

  // ── CORS blocked (browser rejected PUT before reaching R2) ──────────────
  } else if (isCorsBlocked) {
    displayMessage = 'فشل الرفع: طلب الرفع مرفوض من المتصفح (CORS) — تحقق من إعدادات CORS على الـ Bucket (AllowedHeaders وExposeHeaders)';
    code = 'CORS_MISCONFIGURED';

  // ── Device offline ────────────────────────────────────────────────────────
  } else if (isOffline) {
    displayMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء رفع الملف — تحقق من اتصالك وأعد المحاولة';
    code = 'NETWORK_ERROR';

  // ── Multipart completion ──────────────────────────────────────────────────
  } else if (step === 'multipart_complete') {
    if (isNetworkFailure) {
      displayMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء إكمال الرفع المتعدد';
      code = 'NETWORK_ERROR';
    } else {
      displayMessage = 'فشل الرفع: تعذر إكمال الرفع المتعدد';
      code = httpStatus ? `HTTP_${httpStatus}` : 'MULTIPART_COMPLETE_FAILED';
    }

  // ── Multipart chunk ───────────────────────────────────────────────────────
  } else if (step.startsWith('chunk_')) {
    if (isNetworkFailure) {
      displayMessage = 'فشل الرفع: الاتصال بالإنترنت انقطع أثناء رفع الملف';
      code = 'NETWORK_ERROR';
    } else if (httpStatus === 401 || httpStatus === 403) {
      displayMessage = 'فشل الرفع: رابط الرفع انتهت صلاحيته أو الطلب غير مصرح به';
      code = `HTTP_${httpStatus}`;
    } else {
      displayMessage = 'فشل الرفع: فشل أحد أجزاء الرفع المتعدد';
      code = 'CHUNK_FAILED';
    }

  // ── Network layer ─────────────────────────────────────────────────────────
  } else if (isNetworkFailure) {
    displayMessage = 'Upload failed: network error';
    code = 'NETWORK_ERROR';

  // ── HTTP status codes ─────────────────────────────────────────────────────
  } else if (httpStatus === 401 || httpStatus === 403) {
    displayMessage = 'Upload failed: permission issue';
    code = `HTTP_${httpStatus}`;

  } else if (httpStatus === 404) {
    displayMessage = 'فشل الرفع: مسار الرفع أو التخزين غير موجود — تحقق من إعدادات التخزين';
    code = 'HTTP_404';

  } else if (httpStatus === 413) {
    displayMessage = 'Upload failed: file too large';
    code = 'HTTP_413';

  } else if (httpStatus === 415) {
    displayMessage = 'فشل الرفع: نوع الملف غير مدعوم';
    code = 'HTTP_415';

  } else if (httpStatus === 500) {
    if (step === 'multipart_init' || step === 'multipart_init_parse') {
      displayMessage = 'فشل الرفع: تعذر إنشاء جلسة الرفع من السيرفر (خطأ داخلي)';
    } else {
      displayMessage = 'فشل الرفع: خطأ غير متوقع من السيرفر';
    }
    code = 'HTTP_500';

  } else if (httpStatus && httpStatus >= 400) {
    displayMessage = 'فشل الرفع: السيرفر رفض رفع الملف';
    code = `HTTP_${httpStatus}`;

  // ── Step-based fallbacks ──────────────────────────────────────────────────
  } else if (step === 'multipart_init' || step === 'multipart_init_parse') {
    displayMessage = 'فشل الرفع: تعذر إنشاء جلسة الرفع من السيرفر';
    code = 'MULTIPART_INIT_FAILED';

  } else if (step === 'r2_put') {
    displayMessage = 'فشل الرفع: السيرفر رفض رفع الملف';
    code = 'STORAGE_REJECTED';

  } else {
    displayMessage = 'فشل الرفع: خطأ غير متوقع من السيرفر';
    code = 'UPLOAD_ERROR';
  }

  return {
    step,
    code,
    status:             httpStatus ?? null,
    message:            displayMessage,
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
 * Send a Blob to a URL via XHR (supports both PUT and POST).
 * Reports progress via `onProgress(loadedBytes)`.
 *
 * XHR `onerror` fires for two distinct situations:
 *   1. The device has no internet connection (navigator.onLine === false).
 *   2. A network-level error blocked the request.
 */
function sendBlobViaXHR(
  method:      string,
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
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        reject(new Error('Device is offline — internet connection lost during upload'));
      } else {
        reject(new Error('Upload blocked — possible network or server error'));
      }
    });
    xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')));

    signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.open(method, url);
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

    if (!item.file || item.file.size <= 0 || !item.file.name) {
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: classifyUploadError({
          step:               'file_validation',
          rawMessage:         'Invalid file payload',
          fileReachedStorage: false,
          dbSaved:            false,
        }),
      });
      return;
    }

    const fileMimeType = (item.fileMimeType ?? item.file.type) || 'application/octet-stream';

    try {
      // ── failed_db retry — storage upload already done, skip to DB save ─────
      if (item.r2Key) {
        setStage(item.id, 'uploaded', 'Saving to system\u2026', {
          progress:     100,
          uploadedBytes: item.totalBytes,
        });
        await doSaveMetadata(
          item,
          item.r2Key,
          item.r2FileName ?? item.file.name,
          item.publicUrl ?? '',
          fileMimeType,
          ctrl.signal,
          item.r2Bucket ?? null,
        );
        return;
      }

      if (item.file.size > MULTIPART_THRESHOLD) {
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

    const monthKey = item.monthKey;
    if (!monthKey || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: classifyUploadError({
          step:               'month_key',
          rawMessage:         'monthKey must be in YYYY-MM format before upload.',
          fileReachedStorage: false,
          dbSaved:            false,
        }),
      });
      return;
    }

    setStage(item.id, 'uploading', 'Uploading', { progress: 0 });

    const formData = new FormData();
    formData.append('file', item.file, item.file.name);
    formData.append('fileName', item.file.name);
    formData.append('fileType', mimeType);
    formData.append('fileSize', String(item.file.size));
    formData.append('clientName', item.clientName);
    formData.append('mainCategory', item.mainCategory);
    formData.append('monthKey', monthKey);
    if (item.clientId) formData.append('clientId', item.clientId);
    if (item.subCategory) formData.append('subCategory', item.subCategory);
    if (item.uploadName?.trim()) formData.append('customFileName', item.uploadName.trim());

    let r2UploadRes: Response;
    try {
      r2UploadRes = await fetch('/api/upload/presign', {
        method: 'POST',
        body: formData,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[upload] single upload failed before R2 upload', {
        fileName: item.file.name,
        error: errMsg,
      });
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: classifyUploadError({
          step:               'r2_upload_request',
          rawMessage:         `Request to /api/upload/presign failed: ${errMsg}`,
          providerBody:       errMsg,
          fileReachedStorage: false,
          dbSaved:            false,
        }),
      });
      return;
    }

    const r2UploadText = await r2UploadRes.text();
    type R2UploadResponse = { storageKey?: string; publicUrl?: string; displayName?: string; error?: string };
    let r2UploadJson: R2UploadResponse | null = null;
    try {
      r2UploadJson = r2UploadText ? JSON.parse(r2UploadText) as R2UploadResponse : null;
    } catch {
      r2UploadJson = null;
    }

    if (!r2UploadRes.ok || !r2UploadJson?.storageKey || !r2UploadJson.publicUrl || !r2UploadJson.displayName) {
      const errorMessage = r2UploadJson?.error
        ?? `Upload failed (HTTP ${r2UploadRes.status})`;
      console.error('[upload] single upload failed during R2 upload', {
        fileName: item.file.name,
        fileSize: item.file.size,
        provider: 'cloudflare-r2',
        bucket: R2_BUCKET_LOG_NAME,
        error: errorMessage,
        response: r2UploadText || null,
      });
      setStage(item.id, 'failed_upload', 'Upload failed', {
        errorDetail: classifyUploadError({
          step:               'r2_upload',
          rawMessage:         errorMessage,
          providerBody:       r2UploadText || null,
          httpStatus:         r2UploadRes.status,
          fileReachedStorage: false,
          dbSaved:            false,
        }),
      });
      return;
    }
    if (ctrl.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');

    update(item.id, {
      r2Key: r2UploadJson.storageKey,
      r2Bucket: null,
      r2FileName: r2UploadJson.displayName,
      publicUrl: r2UploadJson.publicUrl,
      fileMimeType: mimeType,
    });
    setStage(item.id, 'uploaded', 'Saving to system\u2026', {
      progress:      100,
      uploadedBytes: item.file.size,
    });

    // Phase 3: save metadata.
    await doSaveMetadata(
      item,
      r2UploadJson.storageKey,
      r2UploadJson.displayName,
      r2UploadJson.publicUrl,
      mimeType,
      ctrl.signal,
      null,
    );
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

      // Persist immediately so pause/resume and failed_db retry can reference these.
      update(item.id, {
        uploadId,
        r2Key:         storageKey,
        r2Bucket:      null,
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
          return;
        }
        // Real cancel — abort the multipart session server-side.
        void abortMultipartSession(storageKey, uploadId);
        throw new DOMException('Upload cancelled', 'AbortError');
      }

      const start = (partNumber - 1) * CHUNK_SIZE;
      const end   = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunk = item.file.slice(start, end);

      // Per-chunk retry loop.
      let chunkResult: XhrResult;
      try {
        chunkResult = await withRetry(
          async () => {
            // POST chunk bytes directly to the server.
            // The server uploads the part to R2 and returns { partNumber, etag }.
            const partUrl = `/api/upload/multipart-part?${new URLSearchParams({
              storageKey,
              uploadId,
              partNumber: String(partNumber),
            }).toString()}`;

            const chunkBytesStart = uploadedBytes;
            // Capture upload start time snapshot for speed calculation.
            const speedBaseMs    = item.uploadStartMs ?? Date.now();

            const result = await sendBlobViaXHR(
              'POST',
              partUrl,
              chunk,
              'application/octet-stream',
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
      // The server returns { partNumber, etag } in the JSON response body.
      let etag = '';
      try {
        const partResp = JSON.parse(chunkResult.body) as { etag?: string };
        etag = partResp.etag ?? '';
      } catch { /* empty */ }
      if (!etag) {
        void abortMultipartSession(storageKey, uploadId);
        setStage(item.id, 'failed_upload', 'Upload failed', {
          errorDetail: classifyUploadError({
            step:               `chunk_${partNumber}_etag`,
            rawMessage:         `Part ${partNumber} server response did not include an ETag.`,
            providerBody:       'Missing ETag in server response',
            fileReachedStorage: false,
            dbSaved:            false,
          }),
        });
        return;
      }
      completedParts.push({ partNumber, etag });
      // Persist completed parts to state immediately for pause/resume.
      update(item.id, { completedParts: [...completedParts], uploadedBytes });
    }

    // Phase 3: complete multipart upload.
    update(item.id, {
      statusText:    'Completing upload\u2026',
      statusLabel:   'Completing',
      progress:      97,
      uploadedBytes: totalBytes,
    });

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

    setStage(item.id, 'uploaded', 'Saving to system\u2026', {
      progress:      100,
      uploadedBytes: totalBytes,
    });

    // Phase 4: save metadata to DB.
    await doSaveMetadata(item, storageKey, displayName, publicUrl, mimeType, ctrl.signal, null);
  }

  // ── Save metadata helper (shared by single + multipart) ───────────────────

  async function doSaveMetadata(
    item:        UploadItem,
    storageKey:  string,
    displayName: string,
    publicUrl:   string,
    mimeType:    string,
    signal:      AbortSignal,
    storageBucket: string | null,
  ) {
    if (signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');

    const completePayload = {
      storageKey,
      displayName,
      publicUrl,
      storageBucket,
      storageProvider: 'r2',
      clientName: item.clientName,
      clientId: item.clientId,
      fileType: mimeType,
      fileSize: item.file.size,
      mainCategory: item.mainCategory || null,
      subCategory: item.subCategory || null,
      monthKey: item.monthKey,
      uploadedBy: item.uploadedBy || item.uploadedByEmail || null,
      durationSeconds: item.durationSeconds,
    };

    let completeRes: Response;
    try {
      completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completePayload),
        signal,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
        progress: 100,
        errorDetail: classifyUploadError({
          step:               'database_insert',
          rawMessage:         `Request to /api/upload/complete failed: ${errMsg}`,
          providerBody:       errMsg,
          fileReachedStorage: true,
          dbSaved:            false,
        }),
      });
      return;
    }

    const responseText = await completeRes.text();
    type UploadCompleteResponse = {
      success?: boolean;
      asset?: Asset;
      error?: unknown;
      stage?: string;
    };
    let completeJson: UploadCompleteResponse | null = null;
    try {
      completeJson = responseText ? JSON.parse(responseText) as UploadCompleteResponse : null;
    } catch {
      completeJson = null;
    }

    if (!completeRes.ok || !completeJson?.success || !completeJson.asset) {
      const errorMessage =
        (typeof completeJson?.error === 'string' && completeJson.error) ||
        (typeof completeJson?.error === 'object' && completeJson?.error && 'message' in completeJson.error
          ? String((completeJson.error as { message?: unknown }).message ?? '')
          : '') ||
        `Upload complete failed (HTTP ${completeRes.status})`;
      console.error('[upload] /api/upload/complete failed:', responseText || '(empty)');
      setStage(item.id, 'failed_db', 'Saved to storage, system save failed', {
        progress: 100,
        errorDetail: classifyUploadError({
          step:               'database_insert',
          rawMessage:         errorMessage,
          providerBody:       responseText || null,
          fileReachedStorage: true,
          dbSaved:            false,
        }),
      });
      return;
    }

    dispatchRef.current({ type: 'SET_LATEST_ASSET', asset: completeJson.asset });
    setStage(item.id, 'completed', 'Completed', { progress: 100 });
  }

  // ── Abort multipart session (fire-and-forget) ─────────────────────────────

  async function abortMultipartSession(storageKey: string, uploadId: string) {
    try {
      await fetch('/api/upload/multipart-abort', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, uploadId }),
      });
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
      uploadedByEmail: meta.uploadedByEmail,
      r2Key:        null,
      r2Bucket:     null,
      r2FileName:   null,
      publicUrl:    null,
      fileMimeType: null,
      thumbnailBlob:   i.thumbnailBlob ?? null,
      durationSeconds: i.durationSeconds ?? null,
      previewBlob:     i.previewBlob ?? null,
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
