import type { Asset } from '@/lib/types';

export type AssetPreviewType = 'image' | 'pdf' | 'video' | 'audio' | 'text' | 'unsupported';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);
const PDF_EXTS = new Set(['pdf']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a']);
const TEXT_EXTS = new Set(['txt', 'json', 'md', 'csv', 'js', 'ts', 'html', 'css']);

const MIME_MAP: Array<{ prefix: string; type: AssetPreviewType }> = [
  { prefix: 'image/', type: 'image' },
  { prefix: 'video/', type: 'video' },
  { prefix: 'audio/', type: 'audio' },
  { prefix: 'text/',  type: 'text' },
];
const TEXT_MIME_HINTS = ['json', 'javascript', 'typescript', 'html', 'css', 'csv', 'markdown'];

export interface AssetPreviewInput {
  id?: string | null;
  name?: string | null;
  original_name?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  preview_url?: string | null;
  web_view_link?: string | null;
  view_url?: string | null;
  download_url?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  file_ext?: string | null;
  file_size?: number | null;
  storage_provider?: string | null;
  storage_bucket?: string | null;
  bucket_name?: string | null;
  storage_path?: string | null;
  storage_key?: string | null;
  file_path?: string | null;
  is_previewable?: boolean | null;
}

export interface AssetPreviewInfo {
  id: string | null;
  type: AssetPreviewType;
  mime: string | null;
  ext: string;
  previewUrl: string | null;
  openUrl: string | null;
  downloadUrl: string | null;
  urlCandidates: string[];
  isPreviewable: boolean;
  displayTitle: string;
  sizeLabel: string;
  fileSize: number | null;
  storageProvider: string | null;
  storageBucket: string;
  storagePath: string | null;
}

export function formatAssetSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizeUrl(url?: string | null): string | null {
  const value = url?.trim() ?? '';
  return value.length ? value : null;
}

function uniqueUrls(urls: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of urls) {
    const clean = normalizeUrl(value ?? null);
    if (clean && !out.includes(clean)) out.push(clean);
  }
  return out;
}

export function getFileExtensionFromName(name?: string | null, fileExt?: string | null): string {
  const byField = (fileExt ?? '').replace(/^\./, '').trim().toLowerCase();
  if (byField) return byField;
  const source = (name ?? '').trim();
  const lastDot = source.lastIndexOf('.');
  if (lastDot < 0 || lastDot === source.length - 1) return '';
  return source.slice(lastDot + 1).toLowerCase();
}

function inferFromMime(mime?: string | null): AssetPreviewType | null {
  if (!mime) return null;
  const lowered = mime.toLowerCase();
  if (lowered === 'application/pdf') return 'pdf';
  if (TEXT_MIME_HINTS.some((hint) => lowered.includes(hint))) {
    return 'text';
  }
  const direct = MIME_MAP.find((item) => lowered.startsWith(item.prefix));
  return direct?.type ?? null;
}

function inferFromExt(ext: string): AssetPreviewType {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (PDF_EXTS.has(ext)) return 'pdf';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'unsupported';
}

function detectPreviewType(ext: string, mime?: string | null): AssetPreviewType {
  const byMime = inferFromMime(mime);
  if (byMime) return byMime;
  return inferFromExt(ext);
}

export function getAssetPreviewInfo(asset: AssetPreviewInput): AssetPreviewInfo {
  const displayTitle =
    (asset.original_name ?? '').trim() ||
    (asset.file_name ?? '').trim() ||
    (asset.name ?? '').trim() ||
    'Untitled file';

  const mime = (asset.mime_type ?? asset.file_type ?? '').trim().toLowerCase() || null;
  const ext = getFileExtensionFromName(displayTitle, asset.file_ext ?? null);
  const type = detectPreviewType(ext, mime);

  const previewUrl = normalizeUrl(asset.preview_url ?? asset.web_view_link ?? asset.view_url ?? asset.file_url ?? null);
  const openUrl = normalizeUrl(asset.web_view_link ?? asset.view_url ?? previewUrl ?? asset.file_url ?? null);
  const downloadUrl = normalizeUrl(asset.download_url ?? asset.file_url ?? openUrl ?? previewUrl ?? null);

  const urlCandidates = uniqueUrls([
    previewUrl,
    openUrl,
    downloadUrl,
    asset.file_url,
    asset.view_url,
    asset.web_view_link,
  ]);

  const storagePath =
    (asset.storage_path ?? '').trim() ||
    (asset.storage_key ?? '').trim() ||
    (asset.file_path ?? '').trim() ||
    null;

  const storageBucket = (asset.storage_bucket ?? asset.bucket_name ?? '').trim() || 'openy-assets';
  const isPreviewable = typeof asset.is_previewable === 'boolean'
    ? asset.is_previewable
    : type !== 'unsupported';

  return {
    id: asset.id ?? null,
    type,
    mime,
    ext,
    previewUrl,
    openUrl,
    downloadUrl,
    urlCandidates,
    isPreviewable,
    displayTitle,
    sizeLabel: formatAssetSize(asset.file_size ?? null),
    fileSize: asset.file_size ?? null,
    storageProvider: asset.storage_provider ?? null,
    storageBucket,
    storagePath,
  };
}

export function toPreviewInput(asset: Asset): AssetPreviewInput {
  return {
    id: asset.id,
    name: asset.name,
    original_name: asset.original_filename ?? null,
    file_name: asset.name,
    file_url: asset.file_url,
    preview_url: asset.preview_url ?? null,
    web_view_link: asset.web_view_link ?? null,
    view_url: asset.view_url ?? null,
    download_url: asset.download_url ?? null,
    file_type: asset.file_type ?? null,
    mime_type: asset.mime_type ?? null,
    file_size: asset.file_size ?? null,
    storage_provider: asset.storage_provider ?? null,
    storage_bucket: (asset as Asset & { storage_bucket?: string | null }).storage_bucket ?? null,
    bucket_name: asset.bucket_name ?? null,
    storage_path: asset.storage_path ?? null,
    storage_key: asset.storage_key ?? null,
    file_path: asset.file_path ?? null,
    is_previewable: (asset as Asset & { is_previewable?: boolean | null }).is_previewable ?? null,
  };
}
