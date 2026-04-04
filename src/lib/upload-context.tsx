'use client';

/**
 * Global upload context.
 *
 * Manages a persistent, route-safe upload queue that survives navigation
 * within the app.  Uploads continue in the background while the user visits
 * Dashboard, Clients, Tasks, Calendar, etc.
 *
 * Architecture:
 *  - State lives here (not on the Assets page).
 *  - LocalStorage preserves queue metadata across soft page refreshes.
 *  - A beforeunload warning fires when uploads are active.
 *  - The Assets page calls startBatch() to hand files off to this context.
 *  - GlobalUploadQueue renders the progress panel (mounted in the app layout).
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
  | 'preparing'
  | 'uploading'
  | 'paused'
  | 'retrying'
  | 'saving'
  | 'completed'
  | 'failed';

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
  /** The most recently completed asset (used by Assets page to refresh list). */
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
      return { ...state, queue: state.queue.filter(i => i.status !== 'completed') };

    case 'RESTORE':
      // Only restore items not already in the queue
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
    // Only persist items that are not completed (completed items don't need recovery)
    const items: PersistedItem[] = queue
      .filter(i => i.status !== 'completed')
      .map(i => ({
        id:               i.id,
        fileName:         i.file?.name ?? i.renamedFileName ?? 'Unknown',
        fileSize:         i.file?.size ?? 0,
        fileType:         i.file?.type ?? '',
        // Active items are saved as paused so they can be retried on next load
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
    const ACTIVE: UploadStatus[] = ['preparing', 'uploading', 'retrying', 'saving'];
    const handler = (e: BeforeUnloadEvent) => {
      const active = state.queue.some(i => ACTIVE.includes(i.status));
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

    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    try {
      // ── Step 1: Create or reuse the resumable upload session ──────────────
      d({ type: 'UPDATE', id: item.id, patch: { status: 'preparing', progress: 2 } });

      let { uploadUrl, driveFolderId, clientFolderName, renamedFileName } = item;

      if (!uploadUrl) {
        const sessionRes = await fetch('/api/assets/upload-session', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName:       item.file.name,
            fileType:       item.file.type || 'application/octet-stream',
            fileSize:       item.file.size,
            clientName:     item.clientName,
            contentType:    item.contentType,
            monthKey:       item.monthKey,
            ...(item.clientId   ? { clientId:       item.clientId }   : {}),
            ...(item.uploadedBy ? { uploadedBy:     item.uploadedBy } : {}),
            ...(item.uploadName.trim() ? { customFileName: item.uploadName.trim() } : {}),
          }),
          signal: ctrl.signal,
        });

        const sessionJson = await sessionRes.json() as {
          success: boolean;
          error?: string;
          uploadUrl?: string;
          drive_folder_id?: string;
          client_folder_name?: string;
          renamedFileName?: string;
        };

        if (!sessionRes.ok || !sessionJson.success) {
          throw new Error(sessionJson.error ?? `Session creation failed (HTTP ${sessionRes.status})`);
        }

        uploadUrl        = sessionJson.uploadUrl        ?? null;
        driveFolderId    = sessionJson.drive_folder_id  ?? null;
        clientFolderName = sessionJson.client_folder_name ?? null;
        renamedFileName  = sessionJson.renamedFileName  ?? null;

        if (!uploadUrl) throw new Error('Server did not return an upload URL');

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
          // Non-fatal: proceed with the stored bytesUploaded
        }
      }

      // ── Step 2: Upload file bytes directly to Google Drive (chunked) ──────
      d({ type: 'UPDATE', id: item.id, patch: { status: 'uploading', progress: 5 } });

      const startByte = item.bytesUploaded || 0;

      const driveFileId = await uploadFileChunked(uploadUrl, item.file, {
        signal: ctrl.signal,
        startByte,
        onProgress: (bytesUploaded, total) => {
          const pct = 5 + Math.round((bytesUploaded / total) * 88); // 5→93
          d({ type: 'UPDATE', id: item.id, patch: { progress: pct, bytesUploaded, status: 'uploading' } });
        },
        onRetrying: () => {
          d({ type: 'UPDATE', id: item.id, patch: { status: 'retrying' } });
        },
      });

      // ── Step 3: Finalize — grant permissions & save to Supabase ──────────
      d({ type: 'UPDATE', id: item.id, patch: { status: 'saving', progress: 94 } });

      const completeRes = await fetch('/api/assets/upload-complete', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId,
          driveFolderId,
          clientFolderName,
          fileName:    renamedFileName ?? item.file.name,
          fileType:    item.file.type  || null,
          fileSize:    item.file.size  || null,
          contentType: item.contentType,
          monthKey:    item.monthKey,
          clientName:  item.clientName,
          clientId:    item.clientId   || null,
          ...(item.uploadedBy ? { uploadedBy: item.uploadedBy } : {}),
        }),
        signal: ctrl.signal,
      });

      const completeJson = await completeRes.json() as {
        success: boolean;
        error?: string;
        asset?: Asset;
      };

      if (!completeRes.ok || !completeJson.success) {
        throw new Error(completeJson.error ?? `Finalize failed (HTTP ${completeRes.status})`);
      }

      d({ type: 'UPDATE', id: item.id, patch: { status: 'completed', progress: 100 } });

      if (completeJson.asset) {
        d({ type: 'SET_LATEST_ASSET', asset: completeJson.asset });
      }

    } catch (err: unknown) {
      const isAbort = (err as Error)?.name === 'AbortError';
      if (isAbort) {
        d({ type: 'UPDATE', id: item.id, patch: { status: 'paused', progress: item.bytesUploaded > 0 ? item.progress : 0 } });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
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
    // Re-queue from scratch (reset byte offset and session URL so a fresh session is created)
    dispatch({
      type: 'UPDATE', id,
      patch: { status: 'queued', error: null, progress: 0, bytesUploaded: 0, uploadUrl: null },
    });
  }, [state.queue]);

  const removeItem = useCallback((id: string) => {
    // Abort if running
    abortControllersRef.current.get(id)?.abort();
    // Revoke object URL if any
    const item = state.queue.find(i => i.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    dispatch({ type: 'REMOVE', id });
  }, [state.queue]);

  const clearCompleted = useCallback(() => {
    state.queue
      .filter(i => i.status === 'completed' && i.previewUrl)
      .forEach(i => URL.revokeObjectURL(i.previewUrl!));
    dispatch({ type: 'CLEAR_COMPLETED' });
  }, [state.queue]);

  const isUploading = state.queue.some(i =>
    ['preparing', 'uploading', 'retrying', 'saving'].includes(i.status),
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
