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

  // ── Core upload function ─────────────────────────────────────────────────

  const doUploadItem = useCallback(async (item: UploadItem) => {
    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    try {
      let xhrResult: XhrResult;

      // ── Client-side size check ──────────────────────────────────────────
      // Skip for failed_db retries — the file is not re-uploaded, only metadata
      // is sent. The file was already accepted and uploaded to Drive previously.
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

      // ── Build FormData ────────────────────────────────────────────────
      const formData = new FormData();

      if (item.driveFileId) {
        // ── Reconcile path: Drive already done — retry DB save only ──────
        formData.append('driveFileId',    item.driveFileId);
        formData.append('driveFolderId',  item.driveFolderId ?? '');
        formData.append('driveFileName',  item.driveFileName ?? item.file.name);
        formData.append('fileMimeType',   (item.fileMimeType ?? item.file.type) || 'application/octet-stream');
        formData.append('fileSize',       String(item.file.size));

        setStage(item.id, 'uploading', { progress: 90 });
      } else {
        // ── Normal path: upload file to server ───────────────────────────
        formData.append('file',       item.file);

        setStage(item.id, 'uploading', { progress: 0 });
      }

      formData.append('clientName',  item.clientName);
      formData.append('contentType', item.contentType);
      formData.append('monthKey',    item.monthKey);
      if (item.clientId)   formData.append('clientId',   item.clientId);
      if (item.uploadedBy) formData.append('uploadedBy', item.uploadedBy);
      if (item.uploadName.trim()) formData.append('customFileName', item.uploadName.trim());

      // ── Upload via XHR (for progress tracking) ──────────────────────
      try {
        xhrResult = await uploadViaXHR(
          '/api/upload',
          formData,
          (pct) => {
            if (!item.driveFileId) {
              setStage(item.id, 'uploading', { progress: pct });
            }
          },
          ctrl.signal,
        );
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') throw err;
        throw new Error(err instanceof Error ? err.message : 'Network error during upload');
      }

      // ── XHR done — bytes sent to server (or DB retry complete) ────────
      setStage(item.id, 'uploaded', { progress: 100 });

      // ── Parse server response ─────────────────────────────────────────
      let json: {
        success:         boolean;
        stage?:          string;
        asset?:          Asset;
        drive_file_id?:  string;
        drive_folder_id?: string;
        drive_file_name?: string;
        error?: { step: string; message: string; code?: string | null; details?: string | null };
      };

      try {
        json = JSON.parse(xhrResult.body);
      } catch {
        // Unreadable response — treat 2xx as completed, others as failed
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
        return;
      }

      if (json.stage === 'failed_db') {
        // Drive upload succeeded — store the Drive info for reconcile retry
        dispatchRef.current({
          type:  'UPDATE',
          id:    item.id,
          patch: {
            driveFileId:   json.drive_file_id   ?? null,
            driveFolderId: json.drive_folder_id ?? null,
            driveFileName: json.drive_file_name ?? null,
            fileMimeType:  item.file.type || null,
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
            step:    err?.step    ?? 'upload',
            message: err?.message ?? 'Upload failed',
            code:    err?.code    ?? `HTTP_${xhrResult.status}`,
            details: err?.details ?? null,
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
      monthKey:      meta.monthKey,
      uploadedBy:    meta.uploadedBy,
      driveFileId:   null,
      driveFolderId: null,
      driveFileName: null,
      fileMimeType:  null,
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
