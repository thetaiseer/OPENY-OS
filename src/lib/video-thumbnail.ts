'use client';

/**
 * Browser-only utility for generating video thumbnails.
 *
 * Captures a single frame from a video file using an off-screen <video> element
 * and an HTML5 Canvas.  The resulting JPEG is compressed and kept small enough
 * to store alongside the original file.
 *
 * MUST only be called in browser environments (never in Server Components or
 * Next.js API routes).
 */

/** Maximum width of the generated thumbnail in pixels (aspect ratio preserved). */
const MAX_WIDTH = 640;

/** JPEG quality 0–1. 0.72 gives a good size/quality tradeoff. */
const JPEG_QUALITY = 0.72;

/** Milliseconds to wait for the video to load / seek before giving up. */
const TIMEOUT_MS = 12_000;

export interface VideoThumbnailResult {
  /** Object-URL pointing to the thumbnail Blob. Caller must revoke when done. */
  blobUrl: string;
  /** The compressed JPEG Blob – pass this to the upload flow for permanent storage. */
  blob:    Blob;
}

/**
 * Generate a JPEG thumbnail from a video File object.
 *
 * @param file      – the video file to thumbnail
 * @param seekTime  – seconds into the video to capture (default 1 s); if the
 *                    video is shorter the frame is taken from 10 % of the
 *                    total duration instead
 * @returns A `VideoThumbnailResult` on success, or `null` if the browser
 *          cannot decode the video or the operation times out.
 */
export function generateVideoThumbnail(
  file:     File,
  seekTime = 1,
): Promise<VideoThumbnailResult | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video     = document.createElement('video');

    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      // Prevent the video element from keeping media resources alive.
      video.src = '';
      video.load();
    };

    const finish = (result: VideoThumbnailResult | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const timeoutId = setTimeout(() => finish(null), TIMEOUT_MS);

    const captureFrame = () => {
      clearTimeout(timeoutId);
      try {
        const aspect = video.videoHeight / (video.videoWidth || 1);
        const width  = Math.min(video.videoWidth, MAX_WIDTH);
        const height = Math.max(1, Math.round(width * aspect));

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) { finish(null); return; }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) { finish(null); return; }
            const blobUrl = URL.createObjectURL(blob);
            finish({ blobUrl, blob });
          },
          'image/jpeg',
          JPEG_QUALITY,
        );
      } catch {
        finish(null);
      }
    };

    video.addEventListener('loadedmetadata', () => {
      // Seek to target time; fall back to 10 % of duration for very short clips.
      const target = video.duration > 0
        ? Math.min(seekTime, video.duration * 0.1)
        : 0;
      video.currentTime = target;
    });

    video.addEventListener('seeked', captureFrame, { once: true });

    video.addEventListener('error', () => {
      clearTimeout(timeoutId);
      finish(null);
    });

    video.preload  = 'metadata';
    video.muted    = true;
    video.playsInline = true;
    video.src      = objectUrl;
    video.load();
  });
}

/** Returns true for MIME types or file names that represent video files. */
export function isVideoFile(name: string, mimeType?: string | null): boolean {
  // mp4, webm, ogg, mov, and m4v have broad browser support.
  // avi, mkv, 3gp, and flv are included so the helper can correctly classify
  // them as video files for UI purposes (e.g. choosing an icon), even though
  // thumbnail generation will fall back gracefully to null for these formats
  // when the browser's <video> element cannot decode them.
  return (
    /\.(mp4|webm|ogg|mov|avi|mkv|m4v|3gp|flv)$/i.test(name) ||
    (mimeType?.startsWith('video/') ?? false)
  );
}
