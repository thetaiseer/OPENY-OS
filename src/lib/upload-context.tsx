'use client';

/**
 * Global upload context — rebuilt from scratch.
 *
 * Upload stage machine:
 *   queued → validating → uploading → uploaded → saving_metadata → completed
 *                                                                  ↘ partial_success
 *   queued → validating → failed   (if session/validation fails)
 *   queued → uploading  → failed   (if Drive upload fails)
 *
 * Rules:
 *  1. If file upload (Drive) fails                → failed
 *  2. If Drive upload succeeded + DB save failed  → partial_success
 *  3. If DB save succeeded + preview failed       → completed (fallback icon)
 *  4. List refresh / assets-reload failure        → keep completed/partial_success (never downgrade)
 *  5. Never show vague "Load failed" — always show exact stage-based messages.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { uploadFileChunked, DriveUploadedNoIdError } from './upload-manager';
import type { Asset } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UploadStatus =
  | 'queued'
  | 'validating'
  | 'uploading'
  | 'uploaded'
  | 'saving_metadata'
  | 'completed'
  | 'partial_success'
  | 'failed';

/** Structured error detail from any stage. */
export interface UploadErrorDetail {
  step:    string;
  message: string;
  code:    string | null;
  details: string | null;
}

export interface UploadItem {
  id:         string;
  file:       File;
  previewUrl: string | null;
  /** User-editable base name (no extension). */
  uploadName: string;
  status:     UploadStatus;
  /** 0–100 */
  progress:   number;
  /** Human-readable stage summary. */
  statusText: string;
  /** Structured error — populated on failed / partial_success. */
  errorDetail: UploadErrorDetail | null;
  // metadata
  clientName:  string;
  clientId:    string;
  contentType: string;
  monthKey:    string;
  uploadedBy:  string | null;
  /**
   * Remote storage info — populated after Drive upload succeeds.
   * Used by reconcileItem to skip the binary re-upload and go
   * directly to the metadata-save step.
   */
  remoteId:               string | null;
  remoteFolderId:         string | null;
  remoteClientFolderName: string | null;
  remoteFileName:         string | null;
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
  reconcileItem: (id: string) => void;
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
  | { type: 'REMOVE';   id: string }
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
          i => i.status !== 'completed' && i.status !== 'partial_success',
        ),
      };

    case 'SET_LATEST_ASSET':
      return { ...state, latestAsset: action.asset };

    default:
      return state;
  }
}

// ── Human-readable stage text ─────────────────────────────────────────────────

function stageText(status: UploadStatus, progress?: number): string {
  switch (status) {
    case 'queued':          return 'Queued';
    case 'validating':      return 'Validating';
    case 'uploading':       return progress != null ? `Uploading ${progress}%` : 'Uploading';
    case 'uploaded':        return 'Uploaded';
    case 'saving_metadata': return 'Saving in system';
    case 'completed':       return 'Completed';
    case 'partial_success': return 'Uploaded, but not saved in system';
    case 'failed':          return 'Failed during upload';
  }
}

/** Replace whitespace with underscores to produce a safe file name for upload. */
function sanitizeUploadFileName(name: string): string {
  return name.replace(/\s+/g, '_');
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UPLOAD_CONCURRENCY = 2;

/** Shown to the user whenever Drive upload succeeded but DB save failed. */
const PARTIAL_SUCCESS_MESSAGE = 'Uploaded successfully, but failed to save inside the system.';

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

// ── Provider ──────────────────────────────────────────────────────────────────

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { queue: [], latestAsset: null });
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const runningRef          = useRef<Set<string>>(new Set());
  const dispatchRef         = useRef(dispatch);
  dispatchRef.current = dispatch;

  // ── Helper: dispatch a stage update ──────────────────────────────────────

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

  // ── Core upload function (runs per item) ──────────────────────────────────

  const doUploadItem = useCallback(async (item: UploadItem) => {
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
        credentials: 'include',
        body: JSON.stringify({
          fileName:    safeFileName,
          fileType:    item.file.type || 'application/octet-stream',
          fileSize:    item.file.size,
          clientName:  item.clientName,
      let driveFileId:    string;
      let driveFolderId:  string | null;
      let clientFolderName: string | null;
      let renamedFileName:  string | null;

      if (item.remoteId) {
        // ── Reconcile path: Drive upload already done — skip directly to metadata save ──
        // This branch is entered when reconcileItem re-queues a partial_success item.
        // The remote info (driveFileId, folderId, etc.) was stored in the item when the
        // original Drive upload succeeded.  We skip the session + binary upload entirely
        // to prevent a duplicate Drive file.
        driveFileId    = item.remoteId;
        driveFolderId  = item.remoteFolderId;
        clientFolderName = item.remoteClientFolderName;
        renamedFileName  = item.remoteFileName;

        console.log(JSON.stringify({
          step: 'reconcile',
          ok: true,
          fileName: item.file.name,
          remoteId: driveFileId,
          note: 'skipping Drive re-upload — using stored remote info',
        }));

        // Show uploaded stage briefly so the UI reflects the reconcile flow
        setStage(item.id, 'uploaded', { progress: 94 });

      } else {
        // ── Normal path: full session + Drive upload ──────────────────────────
        setStage(item.id, 'validating', { progress: 1 });
        console.log(JSON.stringify({
          step: 'validating',
          ok: true,
          fileName: item.file.name,
          client: item.clientName,
          contentType: item.contentType,
          monthKey: item.monthKey,
        }));

        const safeFileName = sanitizeUploadFileName(item.file.name);

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
          success: boolean;
          error?: string;
          uploadUrl?: string;
          drive_folder_id?: string;
          client_folder_name?: string;
          renamedFileName?: string;
        };
        try {
          sessionJson = await sessionRes.json();
        } catch (parseErr) {
          throw new Error(`Failed to parse upload session response (HTTP ${sessionRes.status}): ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
        }

        if (!sessionRes.ok || !sessionJson.success) {
          console.error(JSON.stringify({
            step: 'upload_session',
            ok: false,
            fileName: item.file.name,
            error: { message: sessionJson.error ?? `Upload session failed (HTTP ${sessionRes.status})` },
          }));
          throw new Error(sessionJson.error ?? `Upload session failed (HTTP ${sessionRes.status})`);
        }

        const uploadUrl = sessionJson.uploadUrl;
        driveFolderId    = sessionJson.drive_folder_id    ?? null;
        clientFolderName = sessionJson.client_folder_name ?? null;
        renamedFileName  = sessionJson.renamedFileName    ?? null;

        if (!uploadUrl) throw new Error('Server did not return an upload URL');
        console.log(JSON.stringify({
          step: 'upload_session',
          ok: true,
          fileName: item.file.name,
          remoteFolderId: driveFolderId,
          renamedFileName,
        }));

        // ── Stage: uploading ──────────────────────────────────────────────────
        setStage(item.id, 'uploading', { progress: 5 });

        driveFileId = await uploadFileChunked(uploadUrl, item.file, {
          signal: ctrl.signal,
          onProgress: (bytesUploaded, total) => {
            const pct = 5 + Math.round((bytesUploaded / total) * 88); // 5 → 93
            setStage(item.id, 'uploading', { progress: pct });
          },
        });

        console.log(JSON.stringify({
          step: 'remote_upload',
          ok: true,
          fileName: item.file.name,
          remoteId: driveFileId,
        }));

        // ── Stage: uploaded ───────────────────────────────────────────────────
        // Drive file is on Google Drive. Anything from here failing → partial_success.
        setStage(item.id, 'uploaded', { progress: 94 });

        // Persist remote info into item state so reconcileItem can use it later
        // without triggering a re-upload.
        dispatchRef.current({
          type:  'UPDATE',
          id:    item.id,
          patch: {
            remoteId:               driveFileId,
            remoteFolderId:         driveFolderId,
            remoteClientFolderName: clientFolderName,
            remoteFileName:         renamedFileName ?? safeFileName,
          },
        });
      }

      // ── Stage: saving_metadata ────────────────────────────────────────────
      setStage(item.id, 'saving_metadata', { progress: 95 });
      const effectiveFileName = renamedFileName ?? sanitizeUploadFileName(item.file.name);
      console.log(JSON.stringify({
        step: 'db_insert',
        ok: null,
        fileName: effectiveFileName,
        remoteId: driveFileId,
        note: 'calling upload-complete',
      }));

      let completeJson: {
        success: boolean;
        stage?: string;
        file?: { name: string; size: number | null };
        remote?: { uploaded: boolean; id?: string };
        database?: {
          saved: boolean;
          id?: string | null;
          error?: { message: string; code: string | null; details: string | null; hint?: string | null };
        };
        preview?: { ok: boolean; reason: string | null };
        error?: { step: string; message: string; code: string | null; details: string | null };
        asset?: Asset;
        // Legacy fields (backward compat — will be removed once backend fully deployed)
        driveUploaded?: boolean;
        dbSaved?: boolean;
        warning?: string;
        dbErrorMessage?: string;
        dbErrorCode?: string;
        dbErrorDetails?: string;
        dbErrorHint?: string;
      };

      try {
        const completeRes = await fetch('/api/assets/upload-complete', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            driveFileId,
            driveFolderId,
            clientFolderName,
            fileName:    effectiveFileName,
            fileType:    item.file.type  || null,
            fileSize:    item.file.size  || null,
            contentType: item.contentType,
            monthKey:    item.monthKey,
            clientName:  item.clientName,
            clientId:    item.clientId   || null,
            ...(item.uploadedBy ? { uploadedBy: item.uploadedBy } : {}),
          }),
          // NOTE: no AbortSignal — Drive file already exists, must not orphan it
        });

        try {
          completeJson = await completeRes.json();
        } catch {
          // Unreadable body — treat 2xx as completed, anything else as partial_success.
          if (completeRes.status === 200 || completeRes.status === 201) {
            console.log('[upload] ✅ saving_metadata OK (unreadable body, HTTP', completeRes.status, ')');
            setStage(item.id, 'completed', { progress: 100 });
          } else {
            console.warn('[upload] ⚠️ saving_metadata: unreadable response (HTTP', completeRes.status, ') — Drive file exists');
            setStage(item.id, 'partial_success', {
              progress: 100,
              errorDetail: {
                step:    'saving_metadata',
                message: PARTIAL_SUCCESS_MESSAGE,
                code:    `HTTP_${completeRes.status}`,
                details: null,
              },
            });
          }
          return;
        }

        console.log(JSON.stringify({
          step: 'db_insert',
          ok: true,
          stage: completeJson.stage,
          success: completeJson.success,
          fileName: effectiveFileName,
          remoteId: driveFileId,
          dbSaved: completeJson.database?.saved,
          dbId: completeJson.database?.id,
        }));

        // ── Handle new structured response ────────────────────────────────
        if (completeJson.stage === 'completed' || (completeJson.success && completeJson.database?.saved === true)) {
          // Full success (new or legacy format).
          if (completeJson.asset) {
            dispatchRef.current({ type: 'SET_LATEST_ASSET', asset: completeJson.asset });
          }
          // Preview failure inside completed is NOT a failure.
          if (completeJson.preview && !completeJson.preview.ok) {
            console.log(JSON.stringify({ step: 'preview', ok: false, reason: completeJson.preview.reason, note: 'still completed' }));
          }
          setStage(item.id, 'completed', { progress: 100 });
          return;
        }

        if (completeJson.stage === 'partial_success' || (completeJson.success && completeJson.database?.saved === false)) {
          // Partial success: Drive OK, DB failed.
          const dbErr = completeJson.database?.error;
          const errMsg = dbErr?.message
            ?? completeJson.dbErrorMessage
            ?? 'Uploaded successfully, but failed to save inside the system.';
          const errCode = dbErr?.code ?? completeJson.dbErrorCode ?? null;
          const errDetails = dbErr?.details ?? completeJson.dbErrorDetails ?? null;

          console.warn(JSON.stringify({
            step: 'db_insert',
            ok: false,
            fileName: effectiveFileName,
            remoteId: driveFileId,
            error: { message: errMsg, code: errCode, details: errDetails, hint: dbErr?.hint ?? null },
          }));
          setStage(item.id, 'partial_success', {
            progress: 100,
            errorDetail: {
              step:    'saving_metadata',
              message: PARTIAL_SUCCESS_MESSAGE,
              code:    errCode,
              details: errMsg !== PARTIAL_SUCCESS_MESSAGE ? errMsg : errDetails,
            },
          });
          return;
        }

        // upload-complete returned an error — but Drive upload already succeeded.
        // Treat as partial_success so the Drive file is not silently ignored.
        const srvErr = completeJson.error;
        const srvMsg = srvErr?.message ?? completeJson.warning ?? 'Metadata save failed (server error)';
        console.warn(JSON.stringify({
          step: 'db_insert',
          ok: false,
          fileName: effectiveFileName,
          remoteId: driveFileId,
          error: { message: srvMsg, code: srvErr?.code ?? null, details: srvErr?.details ?? null },
        }));
        setStage(item.id, 'partial_success', {
          progress: 100,
          errorDetail: {
            step:    'saving_metadata',
            message: PARTIAL_SUCCESS_MESSAGE,
            code:    srvErr?.code ?? null,
            details: srvMsg,
          },
        });

      } catch (saveErr: unknown) {
        // Re-throw AbortErrors — these happen before saving_metadata starts and
        // should remove the item via the outer catch.
        if ((saveErr as Error)?.name === 'AbortError') throw saveErr;

        // Network/timeout error calling upload-complete.
        // Drive upload already completed → partial_success (not failed).
        const saveMsg = saveErr instanceof Error ? saveErr.message : String(saveErr);
        console.warn(JSON.stringify({
          step: 'db_insert',
          ok: false,
          fileName: effectiveFileName,
          remoteId: driveFileId,
          error: { message: saveMsg, code: 'NETWORK_ERROR', details: null },
        }));
        setStage(item.id, 'partial_success', {
          progress: 100,
          errorDetail: {
            step:    'saving_metadata',
            message: PARTIAL_SUCCESS_MESSAGE,
            code:    'NETWORK_ERROR',
            details: saveMsg,
          },
        });
      }

    } catch (err: unknown) {
      // AbortError — item is being removed, do nothing.
      if ((err as Error)?.name === 'AbortError') return;

      // DriveUploadedNoIdError — file IS on Drive but ID could not be confirmed.
      // Treat as partial_success (Drive file exists, we just can't track it yet).
      if (err instanceof DriveUploadedNoIdError) {
        console.warn(JSON.stringify({
          step: 'remote_upload',
          ok: false,
          fileName: item.file.name,
          error: { message: err.message, code: 'DRIVE_NO_ID', details: 'File uploaded to Google Drive but the file ID could not be confirmed. Check Google Drive manually.' },
        }));
        setStage(item.id, 'partial_success', {
          progress: 100,
          errorDetail: {
            step:    'uploaded',
            message: PARTIAL_SUCCESS_MESSAGE,
            code:    'DRIVE_NO_ID',
            details: 'File uploaded to Google Drive but the file ID could not be confirmed. Check Google Drive manually.',
          },
        });
        return;
      }

      // All other errors are Phase 1 (session fetch or Drive chunk upload) → failed.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({
        step: 'remote_upload',
        ok: false,
        fileName: item.file.name,
        error: { message: msg, code: 'UPLOAD_ERROR', details: null },
      }));
      setStage(item.id, 'failed', {
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
      statusText:  stageText('queued'),
      progress:    0,
      errorDetail: null,
      uploadName:  i.uploadName,
      clientName:  meta.clientName,
      clientId:    meta.clientId,
      contentType: meta.contentType,
      monthKey:    meta.monthKey,
      uploadedBy:  meta.uploadedBy,
      // Remote info — populated after Drive upload succeeds
      remoteId:               null,
      remoteFolderId:         null,
      remoteClientFolderName: null,
      remoteFileName:         null,
    }));
    dispatch({ type: 'ENQUEUE', items: queueItems });
  }, []);

  /** Retry is only meaningful for items that failed before Drive upload completed. */
  const retryItem = useCallback((id: string) => {
    dispatch({
      type:  'UPDATE',
      id,
      patch: {
        status:                 'queued',
        statusText:             stageText('queued'),
        errorDetail:            null,
        progress:               0,
        // Clear any stale remote info so the full upload runs from scratch
        remoteId:               null,
        remoteFolderId:         null,
        remoteClientFolderName: null,
        remoteFileName:         null,
      },
    });
  }, []);

  /**
   * Reconcile: re-queue an item that reached partial_success so that the
   * metadata save step can be retried WITHOUT re-uploading the binary.
   *
   * The item already has remoteId / remoteFolderId / remoteFileName stored
   * from when the Drive upload succeeded.  doUploadItem detects a non-null
   * remoteId and skips the Drive upload phase, going directly to saving_metadata.
   *
   * This prevents duplicate Drive uploads and does NOT create duplicate DB rows
   * because upload-complete checks for an existing asset with the same
   * drive_file_id before inserting.
   */
  const reconcileItem = useCallback((id: string) => {
    dispatch({
      type:  'UPDATE',
      id,
      // Re-queue while intentionally preserving remoteId/remoteFolderId/etc.
      // doUploadItem will detect remoteId and skip the Drive upload phase.
      patch: { status: 'queued', statusText: stageText('queued'), errorDetail: null, progress: 0 },
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
    const item = state.queue.find(i => i.id === id);
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    dispatch({ type: 'REMOVE', id });
  }, [state.queue]);

  const clearCompleted = useCallback(() => {
    state.queue
      .filter(i => (i.status === 'completed' || i.status === 'partial_success') && i.previewUrl)
      .forEach(i => URL.revokeObjectURL(i.previewUrl!));
    dispatch({ type: 'CLEAR_COMPLETED' });
  }, [state.queue]);

  const isUploading = state.queue.some(i =>
    i.status === 'validating' ||
    i.status === 'uploading' ||
    i.status === 'uploaded' ||
    i.status === 'saving_metadata',
  );

  return (
    <UploadContext.Provider
      value={{
        queue:          state.queue,
        isUploading,
        latestAsset:    state.latestAsset,
        startBatch,
        retryItem,
        reconcileItem,
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
