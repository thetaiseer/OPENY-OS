'use client';

/**
 * Global upload context — rebuilt for simplicity and reliability.
 *
 * Upload state machine:
 *   queued → uploading → saving → success
 *                              ↘ failed
 *   (pause) → paused → queued (resume/retry)
 *
 * Rules:
 *  - success ONLY when both Drive upload + DB save succeeded
 *  - failed ONLY on a real upload/save error
 *  - list refresh failure never affects upload state
 *  - the upload-complete request is NOT abortable (prevents false state on pause during DB save)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { uploadFileChunked, queryResumeOffset } from './upload-manager';
import type { Asset } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'saving'
  | 'success'
  | 'failed'
  | 'paused';

export interface UploadQueueItem {
  id:       string;
  /** Null when the item was restored from localStorage (file object is lost). */
  file:     File | null;
  /** Object URL for image previews; null for non-images or after restore. */
  previewUrl:       string | null;
  status:           UploadStatus;
  /** 0-100 */
  progress:         number;
  error:            string | null;
  /** User-editable base name (no extension). */
  uploadName:       string;

  // ── Upload session metadata ──────────────────────────────────────────────
  /** Resumable session URL from Google Drive (persisted to localStorage). */
  uploadUrl:        string | null;
  /** Bytes already confirmed by Drive (for in-session pause/resume). */
  bytesUploaded:    number;
  clientName:       string;
  clientId:         string;
  contentType:      string;
  monthKey:         string;
  uploadedBy:       string | null;
  renamedFileName:  string | null;
  driveFolderId:    string | null;
  clientFolderName: string | null;
}

/** Minimal shape submitted by the Assets page when confirming a batch. */
export interface BatchMeta {
  clientName:  string;
  clientId:    string;
  contentType: string;
  monthKey:    string;
  uploadedBy:  string | null;
}

/** Item passed by the Assets page when opening a batch (before metadata). */
export interface InitialUploadItem {
  id:         string;
  file:       File;
  previewUrl: string | null;
  uploadName: string;
}

interface UploadContextValue {
  queue: UploadQueueItem[];
  isUploading: boolean;
  /** The most recently completed asset (used by Assets page to prepend to list). */
  latestAsset: Asset | null;
  startBatch:    (items: InitialUploadItem[], meta: BatchMeta) => void;
  pauseItem:     (id: string) => void;
  resumeItem:    (id: string) => void;
  retryItem:     (id: string) => void;
  removeItem:    (id: string) => void;
  clearCompleted: () => void;
}

// ── State & reducer ───────────────────────────────────────────────────────────

interface UploadState {
  queue: UploadQueueItem[];
  latestAsset: Asset | null;
}

type UploadAction =
  | { type: 'ENQUEUE';  items: UploadQueueItem[] }
  | { type: 'UPDATE';   id: string; patch: Partial<UploadQueueItem> }
  | { type: 'REMOVE';   id: string }
  | { type: 'CLEAR_COMPLETED' }
  | { type: 'RESTORE';  items: UploadQueueItem[] }
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
      return { ...state, queue: state.queue.filter(i => i.status !== 'success') };

    case 'RESTORE':
      return {
        ...state,
        queue: [...state.queue, ...action.items.filter(
          r => !state.queue.some(q => q.id === r.id),
        )],
      };

    case 'SET_LATEST_ASSET':
      return { ...state, latestAsset: action.asset };

    default:
      return state;
  }
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = 'openy_upload_queue';

type PersistedItem = Omit<
  UploadQueueItem,
  'file' | 'previewUrl' | 'status'
> & { status: 'paused' | 'failed'; fileName: string; fileSize: number; fileType: string };

function persistQueue(queue: UploadQueueItem[]): void {
  try {
    const items: PersistedItem[] = queue
      .filter(i => i.status !== 'success')
      .map(i => ({
        id:               i.id,
        fileName:         i.file?.name ?? i.renamedFileName ?? 'Unknown',
        fileSize:         i.file?.size ?? 0,
        fileType:         i.file?.type ?? '',
        status:           i.status === 'failed' ? 'failed' : 'paused' as 'paused' | 'failed',
        progress:         0,
        error:            i.error,
        uploadName:       i.uploadName,
        uploadUrl:        i.uploadUrl,
        bytesUploaded:    i.bytesUploaded,
        clientName:       i.clientName,
        clientId:         i.clientId,
        contentType:      i.contentType,
        monthKey:         i.monthKey,
        uploadedBy:       i.uploadedBy,
        renamedFileName:  i.renamedFileName,
        driveFolderId:    i.driveFolderId,
        clientFolderName: i.clientFolderName,
      }));
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    // localStorage not available (SSR, private mode)
  }
}

function restoreQueue(): UploadQueueItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as PersistedItem[];
    return items.map(i => ({
      id:               i.id,
      file:             null,
      previewUrl:       null,
      status:           i.status,
      progress:         0,
      error:            i.status === 'failed' ? (i.error ?? 'Upload failed') : 'Upload was interrupted. Click retry to restart.',
      uploadName:       i.uploadName,
      uploadUrl:        i.uploadUrl,
      bytesUploaded:    i.bytesUploaded,
      clientName:       i.clientName,
      clientId:         i.clientId,
      contentType:      i.contentType,
      monthKey:         i.monthKey,
      uploadedBy:       i.uploadedBy,
      renamedFileName:  i.renamedFileName,
      driveFolderId:    i.driveFolderId,
      clientFolderName: i.clientFolderName,
    }));
  } catch {
    return [];
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UPLOAD_CONCURRENCY = 2;

// ── Context ───────────────────────────────────────────────────────────────────

const UploadContext = createContext<UploadContextValue>({
  queue:          [],
  isUploading:    false,
  latestAsset:    null,
  startBatch:     () => {},
  pauseItem:      () => {},
  resumeItem:     () => {},
  retryItem:      () => {},
  removeItem:     () => {},
  clearCompleted: () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { queue: [], latestAsset: null });
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const runningRef          = useRef<Set<string>>(new Set());
  const dispatchRef         = useRef(dispatch);
  dispatchRef.current = dispatch;

  // ── Restore from localStorage on mount ───────────────────────────────────

  useEffect(() => {
    const restored = restoreQueue();
    if (restored.length > 0) {
      dispatch({ type: 'RESTORE', items: restored });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist queue to localStorage on every change ────────────────────────

  useEffect(() => {
    persistQueue(state.queue);
  }, [state.queue]);

  // ── beforeunload warning ──────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const active = state.queue.some(i => i.status === 'uploading' || i.status === 'saving');
      if (active) {
        e.preventDefault();
        e.returnValue = 'Files are still uploading. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.queue]);

  // ── Core upload function (runs per item) ──────────────────────────────────

  const doUploadItem = useCallback(async (item: UploadQueueItem) => {
    const d = dispatchRef.current;

    if (!item.file) {
      d({
        type: 'UPDATE', id: item.id,
        patch: { status: 'failed', error: 'File is no longer available. Please start a new upload.' },
      });
      runningRef.current.delete(item.id);
      return;
    }

    // The abort controller is only used for the Drive upload (chunked PUT).
    // The upload-complete request is intentionally NOT abortable to prevent
    // false failed/paused states when the user pauses during the DB-save step.
    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    try {
      // ── Step 1: Create or reuse the resumable upload session ──────────────
      console.log('[upload] start —', item.file.name, '| client:', item.clientName, '| type:', item.contentType, '| month:', item.monthKey);
      d({ type: 'UPDATE', id: item.id, patch: { status: 'uploading', progress: 2 } });

      let { uploadUrl, driveFolderId, clientFolderName, renamedFileName } = item;

      if (!uploadUrl) {
        const safeFileName = item.file.name.replace(/\s+/g, '_');

        const sessionRes = await fetch('/api/assets/upload-session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName:    safeFileName,
            fileType:    item.file.type || 'application/octet-stream',
            fileSize:    item.file.size,
            clientName:  item.clientName,
            contentType: item.contentType,
            monthKey:    item.monthKey,
            ...(item.clientId   ? { clientId:       item.clientId }   : {}),
            ...(item.uploadedBy ? { uploadedBy:     item.uploadedBy } : {}),
            ...(item.uploadName.trim() ? { customFileName: item.uploadName.trim() } : {}),
          }),
          signal: ctrl.signal,
        });

        console.log('[upload] session response — status:', sessionRes.status);

        let sessionJson: {
          success: boolean;
          step?: string;
          error?: string;
          uploadUrl?: string;
          drive_folder_id?: string;
          client_folder_name?: string;
          renamedFileName?: string;
        };
        try {
          sessionJson = await sessionRes.json();
        } catch (parseErr) {
          throw new Error(`Server returned invalid response for upload session (HTTP ${sessionRes.status}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }

        if (!sessionRes.ok || !sessionJson.success) {
          throw new Error(sessionJson.error ?? `Upload session creation failed (HTTP ${sessionRes.status})`);
        }

        uploadUrl        = sessionJson.uploadUrl        ?? null;
        driveFolderId    = sessionJson.drive_folder_id  ?? null;
        clientFolderName = sessionJson.client_folder_name ?? null;
        renamedFileName  = sessionJson.renamedFileName  ?? null;

        if (!uploadUrl) throw new Error('Server did not return an upload URL');

        console.log('[upload] session ready — folder:', driveFolderId, '| file:', renamedFileName);

        // Persist session URL immediately so we can recover on refresh
        d({ type: 'UPDATE', id: item.id, patch: { uploadUrl, driveFolderId, clientFolderName, renamedFileName } });
      } else {
        // Existing session: query Drive for confirmed offset to resume smoothly
        try {
          const confirmedBytes = await queryResumeOffset(uploadUrl, item.file.size);
          if (confirmedBytes > item.bytesUploaded) {
            d({ type: 'UPDATE', id: item.id, patch: { bytesUploaded: confirmedBytes } });
          }
        } catch {
          // Non-fatal: proceed with stored bytesUploaded
        }
      }

      // ── Step 2: Upload file bytes directly to Google Drive (chunked) ──────
      d({ type: 'UPDATE', id: item.id, patch: { status: 'uploading', progress: 5 } });

      const startByte = item.bytesUploaded || 0;

      const driveFileId = await uploadFileChunked(uploadUrl!, item.file, {
        signal: ctrl.signal,
        startByte,
        onProgress: (bytesUploaded, total) => {
          const pct = 5 + Math.round((bytesUploaded / total) * 88); // 5→93
          d({ type: 'UPDATE', id: item.id, patch: { progress: pct, bytesUploaded, status: 'uploading' } });
        },
        onRetrying: () => {
          // Keep status as 'uploading' — retrying is still an upload in progress
          d({ type: 'UPDATE', id: item.id, patch: { status: 'uploading' } });
        },
      });

      console.log('[upload] Drive upload complete — driveFileId:', driveFileId);

      // ── Step 3: Save to Supabase (NOT abortable — must complete or fail cleanly) ──
      d({ type: 'UPDATE', id: item.id, patch: { status: 'saving', progress: 94 } });

      // Intentionally no signal here: if the user pauses after Drive upload is done,
      // we still complete the DB save so the asset is not left orphaned in Drive.
      const completeRes = await fetch('/api/assets/upload-complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId,
          driveFolderId,
          clientFolderName,
          fileName:    renamedFileName ?? item.file.name.replace(/\s+/g, '_'),
          fileType:    item.file.type  || null,
          fileSize:    item.file.size  || null,
          contentType: item.contentType,
          monthKey:    item.monthKey,
          clientName:  item.clientName,
          clientId:    item.clientId   || null,
          ...(item.uploadedBy ? { uploadedBy: item.uploadedBy } : {}),
        }),
      });

      console.log('[upload] save response — status:', completeRes.status);

      let completeJson: {
        success: boolean;
        step?: string;
        error?: string;
        asset?: Asset;
      };
      try {
        completeJson = await completeRes.json();
        console.log('[upload] save json — success:', completeJson.success, '| step:', completeJson.step ?? 'n/a', '| assetId:', completeJson.asset?.id ?? 'none');
      } catch (parseErr) {
        throw new Error(`Server returned invalid response when saving asset (HTTP ${completeRes.status}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      }

      if (!completeRes.ok || !completeJson.success) {
        // Real failure — Drive file was already rolled back by the server
        throw new Error(completeJson.error ?? `Asset save failed (HTTP ${completeRes.status})`);
      }

      console.log('[upload] ✅ upload success — assetId:', completeJson.asset?.id);

      d({ type: 'UPDATE', id: item.id, patch: { status: 'success', progress: 100 } });

      if (completeJson.asset) {
        d({ type: 'SET_LATEST_ASSET', asset: completeJson.asset });
      }

    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) {
        // User paused during the Drive upload step
        d({ type: 'UPDATE', id: item.id, patch: { status: 'paused', progress: item.bytesUploaded > 0 ? item.progress : 0 } });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[upload] ❌ failed —', item.file?.name ?? item.renamedFileName ?? 'unknown', '| error:', msg);
        d({ type: 'UPDATE', id: item.id, patch: { status: 'failed', error: msg } });
      }
    } finally {
      abortControllersRef.current.delete(item.id);
      runningRef.current.delete(item.id);
    }
  }, []);

  // ── Queue runner — triggered whenever queue changes ───────────────────────

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
    const queueItems: UploadQueueItem[] = items.map(i => ({
      id:               i.id,
      file:             i.file,
      previewUrl:       i.previewUrl,
      status:           'queued',
      progress:         0,
      error:            null,
      uploadName:       i.uploadName,
      uploadUrl:        null,
      bytesUploaded:    0,
      clientName:       meta.clientName,
      clientId:         meta.clientId,
      contentType:      meta.contentType,
      monthKey:         meta.monthKey,
      uploadedBy:       meta.uploadedBy,
      renamedFileName:  null,
      driveFolderId:    null,
      clientFolderName: null,
    }));
    dispatch({ type: 'ENQUEUE', items: queueItems });
  }, []);

  const pauseItem = useCallback((id: string) => {
    const ctrl = abortControllersRef.current.get(id);
    if (ctrl) ctrl.abort();
    // Status update happens in doUploadItem's catch block
  }, []);

  const resumeItem = useCallback((id: string) => {
    const item = state.queue.find(i => i.id === id && i.status === 'paused');
    if (!item) return;
    if (!item.file) {
      dispatch({
        type: 'UPDATE', id,
        patch: { status: 'failed', error: 'File is no longer available. Please start a new upload.' },
      });
      return;
    }
    dispatch({ type: 'UPDATE', id, patch: { status: 'queued', error: null } });
  }, [state.queue]);

  const retryItem = useCallback((id: string) => {
    const item = state.queue.find(i => i.id === id);
    if (!item) return;
    if (!item.file) {
      dispatch({
        type: 'UPDATE', id,
        patch: { status: 'failed', error: 'File is no longer available. Please start a new upload.' },
      });
      return;
    }
    // Reset from scratch: clear session URL so a fresh Drive session is created
    dispatch({
      type: 'UPDATE', id,
      patch: { status: 'queued', error: null, progress: 0, bytesUploaded: 0, uploadUrl: null },
    });
  }, [state.queue]);

  const removeItem = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
    const item = state.queue.find(i => i.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    dispatch({ type: 'REMOVE', id });
  }, [state.queue]);

  const clearCompleted = useCallback(() => {
    state.queue
      .filter(i => i.status === 'success' && i.previewUrl)
      .forEach(i => URL.revokeObjectURL(i.previewUrl!));
    dispatch({ type: 'CLEAR_COMPLETED' });
  }, [state.queue]);

  const isUploading = state.queue.some(i =>
    i.status === 'uploading' || i.status === 'saving',
  );

  return (
    <UploadContext.Provider
      value={{
        queue:          state.queue,
        isUploading,
        latestAsset:    state.latestAsset,
        startBatch,
        pauseItem,
        resumeItem,
        retryItem,
        removeItem,
        clearCompleted,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUpload(): UploadContextValue {
  return useContext(UploadContext);
}
