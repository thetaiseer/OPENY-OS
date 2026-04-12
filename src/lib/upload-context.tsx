'use client';

/**
 * Global upload context — rebuilt from scratch.
 *
 * Upload status machine:
 *   queued → uploading → uploaded → completed
 *                                  ↘ failed_db     (Storage OK, DB save failed)
 *   queued → uploading → failed_upload (Storage upload failed)
 *
 * Rules:
 *  1. If Storage upload fails    → failed_upload  (can retry full upload)
 *  2. If Storage OK + DB fails   → failed_db      (can retry DB save only)
 *  3. NEVER show "Load failed" or generic "Failed"
 *  4. Always show exact stage-based messages
 *
 * Storage upload strategy: direct client-side upload to Supabase Storage
 * (browser → Supabase Storage via anon key + user session), then API call
 * for DB metadata save only.  This bypasses the server-side Buffer path that
 * was returning HTTP 500 from the storage service.
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
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'saved'
  | 'completed'
  | 'failed_upload'
  | 'failed_db';

export interface UploadErrorDetail {
  step:         string;
  message:      string;
  code:         string | null;
  details:      string | null;
  bucket?:      string | null;
  path?:        string | null;
  supabase_url?: string | null;
}

export interface UploadItem {
  id:          string;
  file:        File;
  previewUrl:  string | null;
  /** User-editable base name (no extension). */
  uploadName:  string;
  status:      UploadStatus;
  /** 0–100 */
  progress:    number;
  statusText:  string;
  errorDetail: UploadErrorDetail | null; // populated for failed_upload and failed_db statuses
  // metadata
  clientName:  string;
  clientId:    string;
  contentType: string;
  monthKey:    string;
  uploadedBy:  string | null;
  /** Set after a successful Drive upload — used to retry DB save without re-uploading. */
  driveFileId:   string | null;
  driveFolderId: string | null;
  driveFileName: string | null;
  fileMimeType:  string | null;
  /** Warning message shown when the post-upload Google Drive sync fails (non-blocking). */
  driveWarning:  string | null;
}

/** Minimal shape submitted when confirming a batch. */
export interface BatchMeta {
  clientName:  string;
  clientId:    string;
  contentType: string;
  monthKey:    string;
  uploadedBy:  string | null;
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

// ── Stage text ────────────────────────────────────────────────────────────────

function stageText(status: UploadStatus, progress?: number): string {
  switch (status) {
    case 'queued':        return 'Queued';
    case 'uploading':     return progress != null ? `Uploading ${progress}%` : 'Uploading';
    case 'uploaded':      return 'Uploaded';
    case 'saved':         return 'Saved to Drive';
    case 'completed':     return 'Completed';
    case 'failed_upload': return 'Upload failed';
    case 'failed_db':     return 'Saved to storage, system save failed';
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UPLOAD_CONCURRENCY = 2;

/** Maximum file size before showing a client-side error (250 MB). */
const MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024;

const DB_FAIL_MESSAGE = 'File uploaded to storage successfully, but could not be saved in the system.';

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

// ── XHR upload helper ─────────────────────────────────────────────────────────

interface XhrResult {
  status: number;
  body:   string;
}

function uploadViaXHR(
  url: string,
  formData: FormData,
  onProgress: (pct: number) => void,
  signal: AbortSignal,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => resolve({ status: xhr.status, body: xhr.responseText }));
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')));

    signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.open('POST', url);
    xhr.send(formData);
  });
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { queue: [], latestAsset: null });
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const runningRef          = useRef<Set<string>>(new Set());
  const dispatchRef         = useRef(dispatch);
  dispatchRef.current = dispatch;

  const setStage = useCallback((
    id: string,
    status: UploadStatus,
    extra?: Partial<Omit<UploadItem, 'id' | 'status' | 'statusText'>>,
  ) => {
    const progress = extra?.progress;
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status,
        statusText: stageText(status, progress),
        ...extra,
      },
    });
  }, []);

  // ── Google Drive background sync ─────────────────────────────────────────
  //
  // Called after a successful upload + DB save (fire-and-forget).
  // If Drive is not configured the server returns { driveConfigured: false }
  // and we skip silently.  On any failure we set driveWarning on the item
  // so the queue row can show a non-blocking warning.

  const syncToDrive = useCallback(async (itemId: string, assetId: string) => {
    console.log('[DRIVE SYNC] triggering Drive sync for assetId:', assetId);
    try {
      const res = await fetch('/api/drive-sync', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ assetId }),
        credentials: 'include',
      });

      const json = await res.json() as {
        success:          boolean;
        driveConfigured?: boolean;
        missingVars?:     string[];
        error?:           string;
        warning?:         string;
        driveAuthError?:  boolean;
      };

      console.log('[DRIVE SYNC] /api/drive-sync response (HTTP', res.status, '):', JSON.stringify(json));

      // Drive not configured — skip silently (not an error).
      if (!json.driveConfigured) {
        console.log('[DRIVE SYNC] Drive not configured — skipped. missingVars:', json.missingVars);
        return;
      }

      // Partial success (Drive upload OK but DB update failed) — show warning.
      if (json.success && json.warning) {
        console.warn('[DRIVE SYNC] Drive upload succeeded but DB update failed:', json.warning);
        dispatchRef.current({ type: 'UPDATE', id: itemId, patch: { driveWarning: json.warning } });
        return;
      }

      // True failure — show warning.
      if (!json.success) {
        const warning = json.error ?? 'Google Drive sync failed';
        console.error('[DRIVE SYNC] Drive sync FAILED for assetId:', assetId,
          '| driveAuthError:', json.driveAuthError,
          '| error:', warning);
        dispatchRef.current({
          type:  'UPDATE',
          id:    itemId,
          patch: { driveWarning: warning },
        });
      } else {
        console.log('[DRIVE SYNC] Drive sync completed successfully for assetId:', assetId);
      }
    } catch (err: unknown) {
      // Network / parse error — show warning, do not change upload status.
      const msg = err instanceof Error ? err.message : 'Network error during Drive sync';
      console.error('[DRIVE SYNC] Drive sync exception for assetId:', assetId, ':', msg);
      dispatchRef.current({ type: 'UPDATE', id: itemId, patch: { driveWarning: msg } });
    }
  }, []);

  // ── Core upload function ─────────────────────────────────────────────────
  //
  // Strategy (two-phase):
  //   Phase 1 – Client-side Supabase Storage upload (browser → storage directly).
  //             Skipped for failed_db retries where storage already succeeded.
  //   Phase 2 – API call to /api/upload with retry-path fields (driveFileId etc.)
  //             to persist metadata to the DB.  No file bytes are sent in phase 2.

  const doUploadItem = useCallback(async (item: UploadItem) => {
    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    try {
      // ── Client-side size check ──────────────────────────────────────────
      // Skip for failed_db retries — the file is not re-uploaded.
      if (item.file.size > MAX_FILE_SIZE_BYTES && !item.driveFileId) {
        setStage(item.id, 'failed_upload', {
          errorDetail: {
            step:    'size_limit',
            message: `File is too large (${(item.file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
            code:    'SIZE_LIMIT_EXCEEDED',
            details: null,
          },
        });
        return;
      }

      // ── Carry-forward storage coords (set during Phase 1 or reconcile) ──
      let currentDriveFileId   = item.driveFileId;
      let currentDriveFolderId = item.driveFolderId;
      let currentDriveFileName = item.driveFileName;
      let currentFileMimeType  = item.fileMimeType;

      // ── Phase 1: Direct client-side Supabase Storage upload ─────────────
      if (!currentDriveFileId) {
        setStage(item.id, 'uploading', { progress: 0 });

        // Get authenticated user from the browser Supabase client.
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          const msg = authError?.message ?? 'Not authenticated';
          console.error('[UPLOAD CLIENT] auth error:', msg);
          setStage(item.id, 'failed_upload', {
            errorDetail: {
              step:    'auth',
              message: `Could not get current user: ${msg}`,
              code:    'AUTH_ERROR',
              details: null,
            },
          });
          return;
        }

        const bucket           = 'client-assets';
        const safeFileName     = item.file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._\-]/g, '');
        const storagePath      = `${user.id}/${safeFileName}`;
        const mimeType         = item.file.type || 'application/octet-stream';

        // Full diagnostic log before upload attempt.
        console.log('[UPLOAD CLIENT] ── pre-upload diagnostics ───────────────────');
        console.log('[UPLOAD CLIENT] client_type :', 'browser (anon key + user session)');
        console.log('[UPLOAD CLIENT] user_id     :', user.id);
        console.log('[UPLOAD CLIENT] file_name   :', item.file.name);
        console.log('[UPLOAD CLIENT] file_type   :', mimeType);
        console.log('[UPLOAD CLIENT] file_size   :', item.file.size, 'bytes');
        console.log('[UPLOAD CLIENT] bucket      :', bucket);
        console.log('[UPLOAD CLIENT] upload_path :', storagePath);
        console.log('[UPLOAD CLIENT] ─────────────────────────────────────────────');

        const { data: storageData, error: storageError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, item.file, { upsert: false });

        if (storageError) {
          // Log the full Supabase error object — nothing hidden.
          console.error('[UPLOAD CLIENT] ── storage upload FAILED ──────────────────');
          console.error('[UPLOAD CLIENT] full_error  :', JSON.stringify(storageError, null, 2));
          console.error('[UPLOAD CLIENT] bucket      :', bucket);
          console.error('[UPLOAD CLIENT] upload_path :', storagePath);
          console.error('[UPLOAD CLIENT] file_name   :', item.file.name);
          console.error('[UPLOAD CLIENT] file_type   :', mimeType);
          console.error('[UPLOAD CLIENT] file_size   :', item.file.size, 'bytes');
          console.error('[UPLOAD CLIENT] user_id     :', user.id);
          console.error('[UPLOAD CLIENT] ─────────────────────────────────────────');

          const errAny = storageError as unknown as Record<string, unknown>;
          setStage(item.id, 'failed_upload', {
            errorDetail: {
              step:         'storage_upload',
              message:      storageError.message,
              code:         String(errAny['statusCode'] ?? errAny['error'] ?? ''),
              details:      JSON.stringify(storageError),
              bucket,
              path:         storagePath,
            },
          });
          return;
        }

        console.log('[UPLOAD CLIENT] storage upload succeeded. path:', storageData?.path ?? storagePath);

        currentDriveFileId   = storagePath;
        currentDriveFolderId = bucket;
        currentFileMimeType  = mimeType;
        // Use custom name if provided, otherwise the original file name.
        currentDriveFileName = item.uploadName.trim() || item.file.name;

        // Persist storage coords on the item so reconcile retry can skip Phase 1.
        dispatchRef.current({
          type:  'UPDATE',
          id:    item.id,
          patch: {
            driveFileId:   currentDriveFileId,
            driveFolderId: currentDriveFolderId,
            driveFileName: currentDriveFileName,
            fileMimeType:  currentFileMimeType,
          },
        });

        setStage(item.id, 'uploaded', { progress: 50 });
      }

      // ── Phase 2: Save metadata to DB via API route (retry/DB-only path) ──
      if (!currentDriveFileId) {
        // Should never happen — Phase 1 always sets currentDriveFileId.
        // Guard against any unexpected code path.
        setStage(item.id, 'failed_upload', {
          errorDetail: {
            step:    'internal',
            message: 'Storage path unavailable after upload phase — please retry.',
            code:    'MISSING_STORAGE_PATH',
            details: null,
          },
        });
        return;
      }

      const formData = new FormData();
      formData.append('driveFileId',    currentDriveFileId);
      formData.append('driveFolderId',  currentDriveFolderId ?? '');
      formData.append('driveFileName',  currentDriveFileName ?? item.file.name);
      formData.append('fileMimeType',   (currentFileMimeType ?? item.file.type) || 'application/octet-stream');
      formData.append('fileSize',       String(item.file.size));
      formData.append('clientName',     item.clientName);
      formData.append('contentType',    item.contentType);
      formData.append('monthKey',       item.monthKey);
      if (item.clientId)            formData.append('clientId',      item.clientId);
      if (item.uploadedBy)          formData.append('uploadedBy',    item.uploadedBy);
      if (item.uploadName.trim())   formData.append('customFileName', item.uploadName.trim());

      setStage(item.id, 'uploading', { progress: 90 });

      let xhrResult: XhrResult;
      try {
        xhrResult = await uploadViaXHR('/api/upload', formData, () => {}, ctrl.signal);
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') throw err;
        throw new Error(err instanceof Error ? err.message : 'Network error saving metadata');
      }

      setStage(item.id, 'uploaded', { progress: 100 });

      // ── Parse server response ─────────────────────────────────────────
      let json: {
        success:          boolean;
        stage?:           string;
        asset?:           Asset;
        drive_file_id?:   string;
        drive_folder_id?: string;
        drive_file_name?: string;
        error?: { step: string; message: string; code?: string | null; details?: string | null; bucket?: string | null; path?: string | null; supabase_url?: string | null };
      };

      try {
        json = JSON.parse(xhrResult.body);
      } catch {
        if (xhrResult.status >= 200 && xhrResult.status < 300) {
          setStage(item.id, 'completed', { progress: 100 });
        } else {
          setStage(item.id, 'failed_upload', {
            errorDetail: {
              step:    'response_parse',
              message: 'Upload failed with an unreadable server response',
              code:    `HTTP_${xhrResult.status}`,
              details: xhrResult.body.slice(0, 300),
            },
          });
        }
        return;
      }

      // ── Handle response stage ─────────────────────────────────────────
      if (json.stage === 'completed') {
        if (json.asset) dispatchRef.current({ type: 'SET_LATEST_ASSET', asset: json.asset });
        setStage(item.id, 'completed', { progress: 100 });
        // Fire Google Drive sync in background — non-blocking.
        // Failure shows a warning but does not change the upload status.
        if (json.asset?.id) {
          void syncToDrive(item.id, json.asset.id);
        }
        return;
      }

      if (json.stage === 'failed_db') {
        dispatchRef.current({
          type:  'UPDATE',
          id:    item.id,
          patch: {
            driveFileId:   json.drive_file_id   ?? currentDriveFileId,
            driveFolderId: json.drive_folder_id ?? currentDriveFolderId,
            driveFileName: json.drive_file_name ?? currentDriveFileName,
            fileMimeType:  (currentFileMimeType ?? item.file.type) || null,
          },
        });
        setStage(item.id, 'failed_db', {
          progress: 100,
          errorDetail: {
            step:    'database_insert',
            message: DB_FAIL_MESSAGE,
            code:    json.error?.code    ?? null,
            details: json.error?.message ?? null,
          },
        });
        return;
      }

      if (json.stage === 'failed_upload' || !json.success) {
        const err = json.error;
        setStage(item.id, 'failed_upload', {
          errorDetail: {
            step:         err?.step         ?? 'upload',
            message:      err?.message      ?? 'Upload failed',
            code:         err?.code         ?? `HTTP_${xhrResult.status}`,
            details:      err?.details      ?? null,
            bucket:       err?.bucket       ?? null,
            path:         err?.path         ?? null,
            supabase_url: err?.supabase_url ?? null,
          },
        });
        return;
      }

      // Unknown stage — treat as failure
      setStage(item.id, 'failed_upload', {
        errorDetail: {
          step:    'unknown',
          message: 'Upload failed with an unexpected server response',
          code:    null,
          details: xhrResult.body.slice(0, 300),
        },
      });

    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;

      const msg = err instanceof Error ? err.message : String(err);
      setStage(item.id, 'failed_upload', {
        errorDetail: {
          step:    'upload',
          message: msg,
          code:    'UPLOAD_ERROR',
          details: null,
        },
      });
    } finally {
      abortControllersRef.current.delete(item.id);
      runningRef.current.delete(item.id);
    }
  }, [setStage, syncToDrive]);

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
      progress:      0,
      errorDetail:   null,
      uploadName:    i.uploadName,
      clientName:    meta.clientName,
      clientId:      meta.clientId,
      contentType:   meta.contentType,
      monthKey:      meta.monthKey,
      uploadedBy:    meta.uploadedBy,
      driveFileId:   null,
      driveFolderId: null,
      driveFileName: null,
      fileMimeType:  null,
      driveWarning:  null,
    }));
    dispatch({ type: 'ENQUEUE', items: queueItems });
  }, []);

  /** Retry a failed_upload item — full upload from scratch. */
  const retryItem = useCallback((id: string) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status:        'queued',
        statusText:    stageText('queued'),
        progress:      0,
        errorDetail:   null,
        driveFileId:   null,
        driveFolderId: null,
        driveFileName: null,
        fileMimeType:  null,
        driveWarning:  null,
      },
    });
  }, []);

  /** Retry a failed_db item — skip storage upload, retry DB save only. */
  const reconcileItem = useCallback((id: string) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status:      'queued',
        statusText:  stageText('queued'),
        progress:    0,
        errorDetail: null,
        // driveFileId/driveFolderId/driveFileName preserved — doUploadItem will skip Drive upload
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
