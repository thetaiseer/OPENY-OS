/**
 * Chunked resumable upload to Google Drive.
 *
 * Splits a File into 8 MB chunks and sends each one via PUT with a
 * Content-Range header, following the Google Drive resumable upload protocol:
 * https://developers.google.com/drive/api/guides/manage-uploads#resumable
 *
 * Features:
 * - Retry each chunk up to MAX_CHUNK_RETRIES times with exponential backoff
 * - Pause via AbortSignal (throws AbortError)
 * - Resume by passing the last confirmed byte offset
 * - Query Drive for the actual received-byte offset before retrying
 *
 * Server-side code stays unchanged.  The upload URL is obtained from
 * POST /api/assets/upload-session (which calls initiateResumableSession on
 * the server and returns a pre-authenticated Location URL).
 */

/** Chunk size: 8 MiB — must be a multiple of 256 KiB per the Drive spec. */
export const CHUNK_SIZE = 8 * 1024 * 1024;

/** Maximum per-chunk retry attempts (not counting the first attempt). */
export const MAX_CHUNK_RETRIES = 4;

/** HTTP status codes that are worth retrying (transient server errors). */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export interface ChunkUploadOptions {
  /** Called after each chunk with (bytesUploaded, totalBytes). */
  onProgress: (bytesUploaded: number, total: number) => void;
  /** Called when a chunk fails and we are about to retry. */
  onRetrying?: () => void;
  /** Allows pausing: abort the signal to interrupt mid-chunk. */
  signal?: AbortSignal;
  /** Resume from this byte offset (skip bytes already confirmed by Drive). */
  startByte?: number;
}

/**
 * Query Google Drive to find out how many bytes it has received so far.
 *
 * Sends an empty PUT with header: Content-Range: bytes * /{fileSize}
 * - 308 Incomplete -> reads the Range response header (bytes=0-N) -> returns N+1
 * - 200/201         -> upload already complete -> returns totalBytes
 * - anything else   -> returns 0 (treat as start from zero)
 */
export async function queryResumeOffset(
  uploadUrl: string,
  fileSize: number,
): Promise<number> {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes */${fileSize}`,
        'Content-Length': '0',
      },
    });

    if (res.status === 308) {
      const range = res.headers.get('Range');
      if (range) {
        const m = range.match(/bytes=0-(\d+)/);
        if (m?.[1]) return parseInt(m[1], 10) + 1;
      }
      return 0;
    }

    if (res.status === 200 || res.status === 201) {
      return fileSize;
    }
  } catch {
    // Network error while querying — assume 0 rather than failing hard
  }
  return 0;
}

/**
 * Upload a File to Google Drive via chunked resumable upload.
 *
 * @param uploadUrl The pre-authenticated resumable session URL from Drive.
 * @param file      The File to upload.
 * @param options   Callbacks, abort signal, and optional resume offset.
 * @returns         The Drive file ID returned by Google upon completion.
 *
 * @throws DOMException with name 'AbortError' when the signal is aborted (pause).
 * @throws Error with a descriptive message on fatal upload failures.
 */
export async function uploadFileChunked(
  uploadUrl: string,
  file: File,
  options: ChunkUploadOptions,
): Promise<string> {
  const { onProgress, onRetrying, signal, startByte = 0 } = options;
  const totalSize = file.size;
  const mimeType  = file.type || 'application/octet-stream';

  let offset = startByte;

  while (offset < totalSize) {
    if (signal?.aborted) {
      throw new DOMException('Upload paused', 'AbortError');
    }

    const chunkEnd  = Math.min(offset + CHUNK_SIZE, totalSize) - 1;
    const chunkBlob = file.slice(offset, chunkEnd + 1);
    const chunkSize = chunkEnd - offset + 1;

    let lastError: Error | null = null;
    let chunkDone = false;

    for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      if (signal?.aborted) {
        throw new DOMException('Upload paused', 'AbortError');
      }

      if (attempt > 0) {
        onRetrying?.();

        // Exponential backoff: 1 s, 2 s, 4 s, 8 s (capped at 30 s)
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 30_000);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Upload paused', 'AbortError'));
          }, { once: true });
        });

        // Re-query Drive for the confirmed byte offset before retrying
        try {
          const confirmed = await queryResumeOffset(uploadUrl, totalSize);
          if (confirmed > offset) {
            // Drive already has bytes beyond our chunk boundary — jump ahead
            offset = confirmed;
            onProgress(offset, totalSize);
            chunkDone = true;
            break;
          }
        } catch {
          // Ignore query errors; we'll retry the chunk anyway
        }
      }

      try {
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type':   mimeType,
            'Content-Range':  `bytes ${offset}-${chunkEnd}/${totalSize}`,
            'Content-Length': String(chunkSize),
          },
          body: chunkBlob,
          signal,
        });

        // 308 Resume Incomplete — chunk accepted, continue
        if (res.status === 308) {
          const range = res.headers.get('Range');
          if (range) {
            const m = range.match(/bytes=0-(\d+)/);
            offset = m?.[1] ? parseInt(m[1], 10) + 1 : chunkEnd + 1;
          } else {
            offset = chunkEnd + 1;
          }
          onProgress(offset, totalSize);
          chunkDone = true;
          break;
        }

        // 200 / 201 — upload complete
        if (res.status === 200 || res.status === 201) {
          const data = (await res.json()) as { id?: string };
          onProgress(totalSize, totalSize);
          if (!data.id) throw new Error('Google Drive did not return a file ID after upload');
          return data.id;
        }

        // Transient errors — schedule retry
        if (RETRYABLE_STATUSES.has(res.status)) {
          const body = await res.text().catch(() => '');
          lastError = new Error(`Transient error (HTTP ${res.status}): ${body.slice(0, 200)}`);
          continue;
        }

        // Fatal error — throw immediately (no retry)
        const body = await res.text().catch(() => '(body unreadable)');
        throw new Error(`Upload chunk failed (HTTP ${res.status}): ${body.slice(0, 400)}`);

      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') throw err;
        if (attempt === MAX_CHUNK_RETRIES) {
          throw lastError ?? (err instanceof Error ? err : new Error(String(err)));
        }
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    // If chunk was absorbed into a re-query jump, the outer while will re-check
    if (!chunkDone && lastError) {
      throw lastError;
    }
  }

  // All chunks sent but Drive never returned 200/201 — query final state
  const finalId = await resolveCompletedFileId(uploadUrl, totalSize);
  if (finalId) return finalId;
  throw new Error('Upload finished all chunks but Google Drive did not confirm the file ID');
}

/**
 * After all chunks are sent, attempt to retrieve the Drive file ID by querying
 * the upload session status.  Returns null if Drive doesn't provide it.
 *
 * Sends a zero-byte PUT with header: Content-Range: bytes * /{fileSize}
 * and reads the JSON body on 200/201 for the file ID.
 */
async function resolveCompletedFileId(
  uploadUrl: string,
  fileSize: number,
): Promise<string | null> {
  try {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range':  `bytes */${fileSize}`,
        'Content-Length': '0',
      },
    });
    if (res.status === 200 || res.status === 201) {
      const data = (await res.json()) as { id?: string };
      return data.id ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}
