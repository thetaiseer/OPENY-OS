'use client';

/**
 * Global upload context — clean, minimal rebuild.
 *
 * Upload state machine:
 *   queued → uploading → saving → success
 *                              ↘ failed
 *
 * Rules:
 *  - success ONLY when both Drive upload + DB save succeed
 *  - failed ONLY on a real upload/save error
 *  - asset list refresh failure never affects upload state
 *  - the upload-complete request is NOT abortable (prevents orphaned Drive files)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { uploadFileChunked } from './upload-manager';
import type { Asset } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'saving'
  | 'success'
  | 'warning'
  | 'failed';

export interface UploadItem {
  id:         string;
  file:       File;
  previewUrl: string | null;
  /** User-editable base name (no extension). */
  uploadName: string;
  status:     UploadStatus;
  /** 0–100 */
  progress:   number;
  error:      string | null;
  // metadata
  clientName:  string;
  clientId:    string;
  contentType: string;
  monthKey:    string;
  uploadedBy:  string | null;
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

// Keep legacy alias so the pages don't need changes
export type UploadQueueItem = UploadItem;

interface UploadContextValue {
  queue:         UploadItem[];
  isUploading:   boolean;
  /** Most recently completed asset — used by the Assets page to prepend instantly. */
  latestAsset:   Asset | null;
  startBatch:    (items: InitialUploadItem[], meta: BatchMeta) => void;
  retryItem:     (id: string) => void;
  removeItem:    (id: string) => void;
  clearCompleted: () => void;
}

// ── State & reducer ───────────────────────────────────────────────────────────

interface UploadState {
  queue: UploadItem[];
  latestAsset: Asset | null;
}

type UploadAction =
  | { type: 'ENQUEUE';  items: UploadItem[] }
  | { type: 'UPDATE';   id: string; patch: Partial<UploadItem> }
  | { type: 'REMOVE';          id: string }
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
      return { ...state, queue: state.queue.filter(i => i.status !== 'success' && i.status !== 'warning') };

    case 'SET_LATEST_ASSET':
      return { ...state, latestAsset: action.asset };

    default:
      return state;
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

  // ── Core upload function (runs per item) ──────────────────────────────────

  const doUploadItem = useCallback(async (item: UploadItem) => {
    const d = dispatchRef.current;

    // Each upload gets its own AbortController so removeItem can cancel it.
    const ctrl = new AbortController();
    abortControllersRef.current.set(item.id, ctrl);

    try {
      // ── Phase 1: drive_upload ─────────────────────────────────────────────
      // Errors in this phase mark the item as 'failed'.
      console.log('[upload] drive_upload start —', item.file.name, '| client:', item.clientName, '| type:', item.contentType, '| month:', item.monthKey);
      d({ type: 'UPDATE', id: item.id, patch: { status: 'uploading', progress: 2 } });

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
          ...(item.clientId    ? { clientId:       item.clientId }    : {}),
          ...(item.uploadedBy  ? { uploadedBy:     item.uploadedBy }  : {}),
          ...(item.uploadName.trim() ? { customFileName: item.uploadName.trim() } : {}),
        }),
        signal: ctrl.signal,
      });

      let sessionJson: {
        success: boolean; error?: string;
        uploadUrl?: string; drive_folder_id?: string;
        client_folder_name?: string; renamedFileName?: string;
      };
      try {
        sessionJson = await sessionRes.json();
      } catch (parseErr) {
        throw new Error(`Failed to parse upload session response (HTTP ${sessionRes.status}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
      }
      if (!sessionRes.ok || !sessionJson.success) {
        throw new Error(sessionJson.error ?? `Upload session failed (HTTP ${sessionRes.status})`);
      }

      const uploadUrl        = sessionJson.uploadUrl;
      const driveFolderId    = sessionJson.drive_folder_id    ?? null;
      const clientFolderName = sessionJson.client_folder_name ?? null;
      const renamedFileName  = sessionJson.renamedFileName    ?? null;

      if (!uploadUrl) throw new Error('Server did not return an upload URL');
      console.log('[upload] drive_upload session ready — folder:', driveFolderId, '| file:', renamedFileName);

      d({ type: 'UPDATE', id: item.id, patch: { status: 'uploading', progress: 5 } });

      const driveFileId = await uploadFileChunked(uploadUrl, item.file, {
        signal: ctrl.signal,
        onProgress: (bytesUploaded, total) => {
          const pct = 5 + Math.round((bytesUploaded / total) * 88); // 5 → 93
          d({ type: 'UPDATE', id: item.id, patch: { progress: pct } });
        },
      });

      console.log('[upload] ✅ drive_upload complete — driveFileId:', driveFileId);

      // ── Phase 2: database_insert ──────────────────────────────────────────
      // Drive upload succeeded. Any error from here → 'warning', NOT 'failed'.
      const DB_SAVE_WARNING = 'File uploaded to Drive but metadata not saved';
      d({ type: 'UPDATE', id: item.id, patch: { status: 'saving', progress: 94 } });

      try {
        const completeRes = await fetch('/api/assets/upload-complete', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFileId,
            driveFolderId,
            clientFolderName,
            fileName:    renamedFileName ?? safeFileName,
            fileType:    item.file.type  || null,
            fileSize:    item.file.size  || null,
            contentType: item.contentType,
            monthKey:    item.monthKey,
            clientName:  item.clientName,
            clientId:    item.clientId   || null,
            ...(item.uploadedBy ? { uploadedBy: item.uploadedBy } : {}),
          }),
        });

        let completeJson: {
          success: boolean;
          driveUploaded?: boolean;
          dbSaved?: boolean;
          warning?: string;
          error?: string;
          asset?: Asset;
        };
        try {
          completeJson = await completeRes.json();
        } catch {
          // Unreadable body — treat 2xx as full success, anything else as warning.
          if (completeRes.status === 200 || completeRes.status === 201) {
            console.log('[upload] ✅ database_insert OK (unreadable body, HTTP', completeRes.status, ')');
            d({ type: 'UPDATE', id: item.id, patch: { status: 'success', progress: 100 } });
          } else {
            console.warn('[upload] ⚠️ database_insert: unreadable response (HTTP', completeRes.status, ') — Drive file exists');
            d({ type: 'UPDATE', id: item.id, patch: { status: 'warning', progress: 100, error: DB_SAVE_WARNING } });
          }
          return;
        }

        console.log('[upload] database_insert result — success:', completeJson.success, '| driveUploaded:', completeJson.driveUploaded, '| dbSaved:', completeJson.dbSaved);

        if (completeJson.success && completeJson.dbSaved === false) {
          // Partial success: Drive file exists, DB metadata not saved.
          console.warn('[upload] ⚠️ partial success — driveUploaded: true, dbSaved: false:', completeJson.warning);
          d({ type: 'UPDATE', id: item.id, patch: { status: 'warning', progress: 100, error: completeJson.warning ?? DB_SAVE_WARNING } });
          return;
        }

        if (!completeJson.success) {
          // upload-complete failed, but Drive upload already succeeded → warning.
          console.warn('[upload] ⚠️ database_insert failed (HTTP', completeRes.status, ') — Drive file exists:', completeJson.error);
          d({ type: 'UPDATE', id: item.id, patch: { status: 'warning', progress: 100, error: completeJson.error ?? DB_SAVE_WARNING } });
          return;
        }

        // Full success.
        console.log('[upload] ✅ response_return — upload success, assetId:', completeJson.asset?.id);
        if (completeJson.asset) {
          d({ type: 'SET_LATEST_ASSET', asset: completeJson.asset });
        }
        d({ type: 'UPDATE', id: item.id, patch: { status: 'success', progress: 100 } });

      } catch (saveErr: unknown) {
        // Re-throw AbortErrors so the outer catch handles removal correctly.
        if ((saveErr as Error)?.name === 'AbortError') throw saveErr;
        const saveMsg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.warn('[upload] ⚠️ database_insert exception — Drive file exists:', saveMsg);
        d({ type: 'UPDATE', id: item.id, patch: { status: 'warning', progress: 100, error: DB_SAVE_WARNING } });
      }

    } catch (err: unknown) {
      // Catch errors from Phase 1 (drive_upload failures) and re-thrown AbortErrors.
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[upload] ❌ drive_upload failed —', item.file.name, '| error:', msg);
      d({ type: 'UPDATE', id: item.id, patch: { status: 'failed', error: msg } });
    } finally {
      abortControllersRef.current.delete(item.id);
      runningRef.current.delete(item.id);
    }
  }, []);

  // ── Queue runner — starts uploads whenever slots are free ─────────────────

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
      id:          i.id,
      file:        i.file,
      previewUrl:  i.previewUrl,
      status:      'queued',
      progress:    0,
      error:       null,
      uploadName:  i.uploadName,
      clientName:  meta.clientName,
      clientId:    meta.clientId,
      contentType: meta.contentType,
      monthKey:    meta.monthKey,
      uploadedBy:  meta.uploadedBy,
    }));
    dispatch({ type: 'ENQUEUE', items: queueItems });
  }, []);

  const retryItem = useCallback((id: string) => {
    dispatch({ type: 'UPDATE', id, patch: { status: 'queued', error: null, progress: 0 } });
  }, []);

  const removeItem = useCallback((id: string) => {
    // Abort any in-flight upload for this item
    abortControllersRef.current.get(id)?.abort();
    const item = state.queue.find(i => i.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    dispatch({ type: 'REMOVE', id });
  }, [state.queue]);

  const clearCompleted = useCallback(() => {
    state.queue
      .filter(i => (i.status === 'success' || i.status === 'warning') && i.previewUrl)
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
