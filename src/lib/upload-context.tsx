'use client';

/**
 * Global upload context.
 *
 * Upload status machine:
 *   queued → uploading (direct PUT to R2) → uploaded → completed
 *                                                      ↘ failed_db     (R2 OK, DB save failed)
 *   queued → uploading → failed_upload (presign or R2 PUT failed)
 *
 * Three-phase upload — no file bytes pass through the Next.js server:
 *   1. POST /api/upload/presign  → get presigned PUT URL + storageKey + publicUrl
 *   2. PUT directly to R2        → browser → R2 (real byte-level XHR progress)
 *   3. POST /api/upload/complete → save metadata to Supabase DB
 *
 * For failed_db retries: item.r2Key (storageKey) and item.r2FileName (displayName)
 * are preserved so phase 3 can be retried without re-uploading the file.
 *
 * Rules:
 *  1. If presign or R2 PUT fails  → failed_upload  (retry full upload)
 *  2. If R2 OK + DB fails         → failed_db      (retry DB save only)
 *  3. NEVER show "Load failed" or generic "Failed"
 *  4. Always show exact stage-based messages
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
  errorDetail: UploadErrorDetail | null;
  // metadata
  clientName:   string;
  clientId:     string;
  contentType:  string;
  mainCategory: string;
  subCategory:  string;
  monthKey:     string;
  uploadedBy:   string | null;
  /**
   * R2 storage key — set after a successful presign + R2 PUT.
   * Used to retry the DB-save step without re-uploading the file.
   */
  r2Key:      string | null;
  r2Bucket:   string | null;
  /** Display name returned by /api/upload/presign. */
  r2FileName: string | null;
  /** Public URL of the uploaded file in R2. */
  publicUrl:   string | null;
  fileMimeType: string | null;
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

// ── Stage text ────────────────────────────────────────────────────────────────

function stageText(status: UploadStatus, progress?: number): string {
  switch (status) {
    case 'queued':        return 'Queued';
    case 'uploading':     return progress != null ? `Uploading ${progress}%` : 'Uploading';
    case 'uploaded':      return 'Saving to system\u2026';
    case 'saved':         return 'Saved';
    case 'completed':     return 'Completed';
    case 'failed_upload': return 'Upload failed';
    case 'failed_db':     return 'Saved to storage, system save failed';
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UPLOAD_CONCURRENCY = 2;

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

// ── XHR PUT helper (direct to R2) ─────────────────────────────────────────────

interface XhrResult {
  status: number;
  body:   string;
}

/**
 * PUT the file binary directly to a presigned R2 URL via XHR so we get
 * real byte-level upload progress events.  No file bytes pass through
 * the Next.js server.
 */
function putFileViaXHR(
  url:         string,
  file:        File,
  contentType: string,
  onProgress:  (pct: number) => void,
  signal:      AbortSignal,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load',  () => resolve({ status: xhr.status, body: xhr.responseText }));
    xhr.addEventListener('error', () => reject(new Error('Network error during upload to storage')));
    xhr.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')));

    signal.addEventListener('abort', () => xhr.abort(), { once: true });

    xhr.open('PUT', url);
    // R2 requires the Content-Type header to match what was used to sign the URL.
    xhr.setRequestHeader('Content-Type', contentType);
    // Send the raw file bytes — no wrapping, no encoding.
    xhr.send(file);
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

  // ── Core upload function ───────────────────────────────────────────────────
  //
  // Three-phase strategy (file bytes NEVER go through the Next.js server):
  //
  //   Phase 1 – Presign:
  //     POST /api/upload/presign  with JSON metadata
  //     → { uploadUrl, storageKey, publicUrl, displayName }
  //
  //   Phase 2 – Direct R2 PUT:
  //     PUT <uploadUrl>  with raw file bytes via XHR (real progress events)
  //
  //   Phase 3 – Complete (DB save):
  //     POST /api/upload/complete  with JSON metadata + storageKey
  //
  // For failed_db retries: item.r2Key is set → skip phases 1 and 2.

  const doUploadItem = useCallback(async (item: UploadItem) => {
    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    try {
      setStage(item.id, 'uploading', { progress: 0 });

      let storageKey:  string;
      let displayName: string;
      let publicUrl:   string;
      const fileMimeType = (item.fileMimeType ?? item.file.type) || 'application/octet-stream';

      if (item.r2Key) {
        // ── failed_db retry — R2 upload already done, skip phases 1 & 2 ──────
        storageKey  = item.r2Key;
        displayName = item.r2FileName ?? item.file.name;
        // publicUrl is preserved from the original presign phase.
        // If unavailable (edge case), the complete endpoint rebuilds it server-side.
        publicUrl   = item.publicUrl ?? '';
        // Jump straight to phase 3 — show "Saving to system…"
        setStage(item.id, 'uploaded', { progress: 100 });
      } else {
        // ── Phase 1: request a presigned PUT URL ─────────────────────────────
        let presignRes: Response;
        try {
          presignRes = await fetch('/api/upload/presign', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName:       item.file.name,
              fileType:       fileMimeType,
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
          try {
            const errJson = await presignRes.json() as { error?: string };
            if (errJson.error) errMsg = errJson.error;
          } catch { /* ignore */ }
          setStage(item.id, 'failed_upload', {
            errorDetail: {
              step:    'presign',
              message: errMsg,
              code:    `HTTP_${presignRes.status}`,
              details: null,
            },
          });
          return;
        }

        let presignData: {
          uploadUrl:   string;
          storageKey:  string;
          publicUrl:   string;
          displayName: string;
        };
        try {
          presignData = await presignRes.json() as typeof presignData;
        } catch {
          setStage(item.id, 'failed_upload', {
            errorDetail: {
              step:    'presign_parse',
              message: 'Invalid response from upload presign endpoint',
              code:    null,
              details: null,
            },
          });
          return;
        }

        storageKey  = presignData.storageKey;
        displayName = presignData.displayName;
        publicUrl   = presignData.publicUrl;

        // Persist storageKey + displayName + publicUrl so failed_db retry
        // can skip phases 1 & 2 even if the tab reloads within the session.
        dispatchRef.current({
          type:  'UPDATE',
          id:    item.id,
          patch: {
            r2Key:       storageKey,
            r2FileName:  displayName,
            publicUrl,
            fileMimeType,
          },
        });

        // ── Phase 2: PUT file bytes directly to R2 ───────────────────────────
        let putResult: XhrResult;
        try {
          putResult = await putFileViaXHR(
            presignData.uploadUrl,
            item.file,
            fileMimeType,
            (pct) => setStage(item.id, 'uploading', { progress: Math.min(pct, 95) }),
            ctrl.signal,
          );
        } catch (err: unknown) {
          if ((err as Error)?.name === 'AbortError') throw err;
          throw new Error(err instanceof Error ? err.message : 'Network error during file upload');
        }

        // R2 presigned PUT returns 200 on success; non-2xx is a failure.
        if (putResult.status < 200 || putResult.status >= 300) {
          setStage(item.id, 'failed_upload', {
            errorDetail: {
              step:    'r2_put',
              message: `File upload to storage failed (HTTP ${putResult.status})`,
              code:    `HTTP_${putResult.status}`,
              details: putResult.body.slice(0, 300) || null,
            },
          });
          return;
        }

        setStage(item.id, 'uploaded', { progress: 100 });
      }

      // ── Phase 3: save metadata to DB ────────────────────────────────────────
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
            fileType:     fileMimeType,
            fileSize:     item.file.size,
            mainCategory: item.mainCategory || undefined,
            subCategory:  item.subCategory  || undefined,
            monthKey:     item.monthKey,
            uploadedBy:   item.uploadedBy   || undefined,
          }),
          signal: ctrl.signal,
        });
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') throw err;
        // Network error during DB save — file is already in R2.
        // Mark as failed_db so user can retry just the DB save.
        setStage(item.id, 'failed_db', {
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
          setStage(item.id, 'completed', { progress: 100 });
        } else {
          setStage(item.id, 'failed_db', {
            progress: 100,
            errorDetail: {
              step:    'complete_parse',
              message: DB_FAIL_MESSAGE,
              code:    `HTTP_${completeRes.status}`,
              details: null,
            },
          });
        }
        return;
      }

      if (json.stage === 'completed') {
        if (json.asset) dispatchRef.current({ type: 'SET_LATEST_ASSET', asset: json.asset });
        setStage(item.id, 'completed', { progress: 100 });
        return;
      }

      if (json.stage === 'failed_db') {
        // Preserve R2 info for reconcile retry.
        dispatchRef.current({
          type:  'UPDATE',
          id:    item.id,
          patch: {
            r2Key:      json.r2_key      ?? storageKey,
            r2Bucket:   json.r2_bucket   ?? null,
            r2FileName: json.r2_filename ?? displayName,
            publicUrl,
            fileMimeType,
          },
        });
        const dbErr = json.error as { message?: string; code?: string } | null | undefined;
        setStage(item.id, 'failed_db', {
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

      // Unexpected response — treat as failed_db (file is already in R2).
      setStage(item.id, 'failed_db', {
        progress: 100,
        errorDetail: {
          step:    'complete_unknown',
          message: DB_FAIL_MESSAGE,
          code:    `HTTP_${completeRes.status}`,
          details: null,
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
  }, [setStage]);

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
      mainCategory:  meta.mainCategory,
      subCategory:   meta.subCategory,
      monthKey:      meta.monthKey,
      uploadedBy:    meta.uploadedBy,
      r2Key:        null,
      r2Bucket:     null,
      r2FileName:   null,
      publicUrl:    null,
      fileMimeType: null,
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
        progress:     0,
        errorDetail:  null,
        r2Key:        null,
        r2Bucket:     null,
        r2FileName:   null,
        publicUrl:    null,
        fileMimeType: null,
      },
    });
  }, []);

  /** Retry a failed_db item — skip phases 1 & 2, retry DB save only. */
  const reconcileItem = useCallback((id: string) => {
    dispatchRef.current({
      type:  'UPDATE',
      id,
      patch: {
        status:      'queued',
        statusText:  stageText('queued'),
        progress:    0,
        errorDetail: null,
        // r2Key / r2FileName / publicUrl / fileMimeType preserved — doUploadItem
        // detects item.r2Key and skips phases 1 and 2.
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
